"""حلقهٔ پایش در رشتهٔ پس‌زمینه (QThread) بدون قفل‌کردن رابط کاربری."""

from __future__ import annotations

import threading
import time
import traceback

from PySide6.QtCore import QThread, Signal

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]

from .click_engine import ClickEngine, ClickError
from .detector import Detector, MatchResult
from .safety_manager import REASON_OK, SafetyManager
from .screen_capture import CaptureError, ScreenCapture

STATUS_IDLE = "idle"            # قرمز - پایش متوقف
STATUS_MONITORING = "monitoring"  # سبز - پایش فعال
STATUS_WAITING = "waiting"      # نارنجی - در انتظار / خنک‌سازی
STATUS_DETECTED = "detected"    # آبی - تماس شناسایی شد
STATUS_ERROR = "error"          # خطا

# تعداد چرخه‌های پی‌درپی تشخیص پس از هر تغییر صفحه (برای پایدارترکردن پاسخ سریع)
_SCAN_BURST = 3

# تعداد چرخه‌های پی‌درپی «بدون تشخیص» که پس از آن، تماس فعلی تمام‌شده در نظر گرفته می‌شود
_ANSWER_RELEASE_CYCLES = 3


def blank_rect(frame, origin_left: int, origin_top: int,
               rect: tuple[int, int, int, int] | None) -> None:
    """سیاه‌کردن یک ناحیه (مثلاً پنجرهٔ خود برنامه) داخل تصویر گرفته‌شده.

    مختصات `rect` مطلق صفحه و `frame` نسبت به مبدأ ناحیه است.
    """
    if rect is None or frame is None or getattr(frame, "size", 0) == 0:
        return
    ex_left, ex_top, ex_w, ex_h = rect
    frame_h, frame_w = frame.shape[:2]
    x0 = max(0, ex_left - origin_left)
    y0 = max(0, ex_top - origin_top)
    x1 = min(frame_w, ex_left + ex_w - origin_left)
    y1 = min(frame_h, ex_top + ex_h - origin_top)
    if x1 > x0 and y1 > y0:
        frame[y0:y1, x0:x1] = 0


class MonitorWorker(QThread):
    """رشتهٔ پایش تماس‌ها: گرفتن تصویر، تشخیص، بررسی ایمنی و کلیک."""

    status_changed = Signal(str)
    call_detected = Signal(dict)
    button_recognized = Signal(dict)
    clicked = Signal(dict)
    heartbeat = Signal(dict)
    error_occurred = Signal(str)
    cycle_finished = Signal(float)
    preview_ready = Signal(object, object, object)   # تصویر ناحیه، کادر محلی، مبدأ

    def __init__(self, config, store, detector: Detector, click_engine: ClickEngine,
                 safety: SafetyManager, logger) -> None:
        super().__init__()
        self.config = config
        self.store = store
        self.detector = detector
        self.click_engine = click_engine
        self.safety = safety
        self.logger = logger
        self._stop_event = False
        self._capture: ScreenCapture | None = None
        self._cached_rect: tuple[int, int, int, int] | None = None
        self._frame_counter = 0
        self._last_heartbeat = 0.0
        self._last_preview = 0.0
        self._last_status = ""
        self._gate_gray = None            # تصویر کوچک‌شدهٔ چرخهٔ قبل برای سنجش تغییر صفحه
        self._last_heavy_scan = 0.0       # زمان آخرین تشخیص سنگین
        self._scan_burst = 0              # چرخه‌های باقی‌ماندهٔ تشخیص پی‌درپی
        self._exclude_lock = threading.Lock()
        self._exclude_rect: tuple[int, int, int, int] | None = None
        self._answered_latch = False      # آیا تماس فعلی قبلاً پاسخ داده شده است؟
        self._absent_cycles = 0           # چرخه‌های پی‌درپی بدون تشخیص (برای آزادکردن قفل تماس)
        self._call_announced = False      # آیا برای تماس فعلی یک‌بار اعلان/ثبت انجام شده است؟
        self.last_frame = None
        self.last_result: MatchResult | None = None
        self.last_cycle_ms = 0.0

    # ------------------------------------------------------------------ کنترل
    def stop_monitoring(self) -> None:
        """درخواست توقف ایمن رشتهٔ پایش."""
        self._stop_event = True
        self.click_engine.request_stop()

    def set_exclusion_rect(self, rect: tuple[int, int, int, int] | None) -> None:
        """تعیین ناحیه‌ای که باید از تشخیص کنار گذاشته شود (پنجرهٔ خود برنامه)."""
        value = None
        if rect is not None:
            try:
                value = (int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3]))
            except (TypeError, ValueError, IndexError):
                value = None
        with self._exclude_lock:
            self._exclude_rect = value

    def _exclusion_rect(self) -> tuple[int, int, int, int] | None:
        with self._exclude_lock:
            return self._exclude_rect

    # ------------------------------------------------------------------ ناحیه
    def _region(self) -> tuple[int, int, int, int]:
        if self._cached_rect is None:
            left, top, width, height = self.config.region()
            if width <= 0 or height <= 0:
                monitor = self._capture.virtual_monitor() if self._capture else {"left": 0, "top": 0,
                                                                                 "width": 1920, "height": 1080}
                left, top = int(monitor["left"]), int(monitor["top"])
                width, height = int(monitor["width"]), int(monitor["height"])
            self._cached_rect = (left, top, width, height)
        return self._cached_rect

    def invalidate_region(self) -> None:
        """پاک‌کردن ناحیهٔ کش‌شده (پس از تغییر تنظیمات ناحیه)."""
        self._cached_rect = None
        self._gate_gray = None

    # --------------------------------------------------- صرفه‌جویی مصرف پردازنده
    def _smart_idle_enabled(self) -> bool:
        return bool(self.config.get("detection.smart_idle", True))

    def _idle_interval(self) -> float:
        """فاصلهٔ پایش در حالت بی‌حرکت صفحه (کم‌مصرف‌تر)."""
        try:
            value = float(self.config.get("detection.idle_interval_ms", 700))
        except (TypeError, ValueError):
            value = 700.0
        return max(0.15, value / 1000.0)

    def _force_scan_interval(self) -> float:
        """حداکثر فاصلهٔ مجاز بین دو تشخیص سنگین (تور ایمنی)."""
        try:
            value = float(self.config.get("detection.force_scan_ms", 3000))
        except (TypeError, ValueError):
            value = 3000.0
        return max(0.5, value / 1000.0)

    def _screen_changed(self, frame) -> bool:
        """آیا صفحه نسبت به چرخهٔ قبل تغییر محسوسی داشته است؟ (بسیار سبک)"""
        if cv2 is None or frame is None or getattr(frame, "size", 0) == 0:
            return True
        try:
            small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        except cv2.error:
            return True
        previous = self._gate_gray
        self._gate_gray = gray
        if previous is None or getattr(previous, "shape", None) != gray.shape:
            return True
        try:
            threshold = float(self.config.get("detection.static_diff_threshold", 1.2))
        except (TypeError, ValueError):
            threshold = 1.2
        return float(cv2.absdiff(gray, previous).mean()) >= max(0.1, threshold)

    # -------------------------------------------------------------------- حلقه
    def run(self) -> None:  # noqa: C901 - حلقهٔ اصلی پایش
        self._stop_event = False
        self.click_engine.reset_stop()
        self._capture = ScreenCapture()
        self._cached_rect = None
        self._gate_gray = None
        self._last_heavy_scan = 0.0
        self._scan_burst = 0
        self._answered_latch = False
        self._absent_cycles = 0
        self._call_announced = False
        self.safety.reset_session()
        self._emit_status(STATUS_MONITORING)
        try:
            while not self._stop_event:
                cycle_start = time.perf_counter()
                idle_cycle = False
                try:
                    idle_cycle = self._cycle()
                except CaptureError as exc:
                    self.error_occurred.emit(str(exc))
                    self.logger.log("خطای برنامه", "ناموفق", str(exc), level="error")
                    self._emit_status(STATUS_ERROR)
                    time.sleep(1.0)
                    self._emit_status(STATUS_MONITORING)
                except Exception as exc:  # هیچ خطایی نباید کل برنامه را از کار بیندازد
                    detail = f"{exc}"
                    self.logger.technical_error("خطای غیرمنتظره در حلقهٔ پایش", exc)
                    self.error_occurred.emit(f"خطای غیرمنتظره: {detail}")
                    time.sleep(0.8)
                cycle_ms = (time.perf_counter() - cycle_start) * 1000.0
                self.last_cycle_ms = cycle_ms
                self.cycle_finished.emit(cycle_ms)
                # در حالت بی‌حرکت، فاصلهٔ پایش طولانی‌تر می‌شود تا کمپیوتر کمتر درگیر شود
                if idle_cycle:
                    interval = self._idle_interval()
                else:
                    interval = max(0.03, self.config.interval_ms() / 1000.0)
                remaining = interval - (time.perf_counter() - cycle_start)
                # خواب تدریجی تا واکنش سریع به درخواست توقف
                while remaining > 0 and not self._stop_event:
                    step = min(remaining, 0.02)
                    time.sleep(step)
                    remaining -= step
        finally:
            if self._capture is not None:
                self._capture.close()
            self._capture = None
            self._emit_status(STATUS_IDLE)

    def _cycle(self) -> bool:
        """یک چرخهٔ پایش. اگر تشخیص سنگین اجرا نشد (صرفه‌جویی پردازنده) True برمی‌گرداند."""
        assert self._capture is not None
        left, top, width, height = self._region()
        frame = self._capture.grab(left, top, width, height)
        # پنجرهٔ خود برنامه سیاه می‌شود تا هرگز به‌عنوان دکمهٔ پاسخ تشخیص داده نشود
        blank_rect(frame, left, top, self._exclusion_rect())
        self.last_frame = frame
        self._frame_counter += 1
        now = time.perf_counter()

        # --- دروازهٔ کم‌مصرف: تا وقتی تصویر تغییر نکند، تشخیص سنگین اجرا نمی‌شود ---
        changed = self._screen_changed(frame)
        force_scan = (now - self._last_heavy_scan) >= self._force_scan_interval()
        if changed:
            # پس از هر تغییر، چند چرخهٔ پی‌درپی تشخیص انجام می‌شود تا پاسخ پایدار بماند
            self._scan_burst = _SCAN_BURST
        skip_detection = (self._smart_idle_enabled() and not force_scan and self._scan_burst <= 0
                          and (not changed or self.safety.in_cooldown()))
        if not skip_detection:
            self._last_heavy_scan = now
            if self._scan_burst > 0:
                self._scan_burst -= 1

        # ثبت نبض وضعیت به‌صورت دوره‌ای برای تازه‌سازی داشبورد
        if now - self._last_heartbeat > 0.2:
            self._last_heartbeat = now
            self._emit_heartbeat()
        preview_due = self.config.get("ui.live_preview", True) and now - self._last_preview > 0.35
        if skip_detection:
            if preview_due:
                self._last_preview = now
                self.preview_ready.emit(frame, None, (0, 0))
            if self.safety.in_cooldown() or not self.config.get("general.auto_click_enabled", True):
                self._emit_status(STATUS_WAITING)
            else:
                self._emit_status(STATUS_MONITORING)
            return True

        config_data = {"detection": self.config.get("detection", {}) or {}}
        result = self.detector.detect(frame, origin=(left, top), config=config_data)
        self.last_result = result

        if preview_due:
            self._last_preview = now
            local_box = None
            if result is not None and result.found:
                local_box = (result.box[0] - left, result.box[1] - top, result.box[2], result.box[3])
            self.preview_ready.emit(frame, local_box, (0, 0))

        if result is None or not result.found:
            self.safety.register_miss()
            # اگر تماس فعلی تمام شده باشد (چند چرخه پی‌درپی بدون تشخیص)، قفل پاسخ آزاد می‌شود
            self._absent_cycles += 1
            if self._absent_cycles >= _ANSWER_RELEASE_CYCLES:
                self._answered_latch = False
                self._call_announced = False
            if self.safety.in_cooldown():
                self._emit_status(STATUS_WAITING)
            elif not self.config.get("general.auto_click_enabled", True):
                self._emit_status(STATUS_WAITING)
            else:
                self._emit_status(STATUS_MONITORING)
            return False

        payload = self._result_payload(result)
        self.button_recognized.emit(payload)
        self._absent_cycles = 0

        # «تماس جدید» فقط یک‌بار برای هر تماس اعلان، ثبت و شمرده می‌شود
        # تا پیام‌ها، صدا و آمار تکرار نشوند.
        new_call = not self._call_announced
        if new_call:
            self._call_announced = True
            self.safety.register_detection(result.confidence, (result.center_x, result.center_y))
            self.logger.log(
                "تشخیص دکمهٔ پاسخ", "موفق",
                f"{result.title} | {result.label} | اطمینان {result.confidence * 100:.1f}%",
                extra={"mode": result.mode, "confidence": round(result.confidence, 4)},
            )

        if not self.config.get("general.auto_click_enabled", True):
            self._emit_status(STATUS_DETECTED)
            if new_call:
                self.call_detected.emit({**payload, "new_call": True, "click_allowed": False,
                                         "reason": "کلیک خودکار خاموش است."})
            return False

        if self._answered_latch:
            # این تماس قبلاً پاسخ داده شده است؛ کلیک دوباره تماس را قطع می‌کند
            self._emit_status(STATUS_DETECTED)
            return False

        in_region = self._point_in_region(result.center_x, result.center_y)
        decision = self.safety.evaluate(
            confidence=result.confidence,
            center=(result.center_x, result.center_y),
            in_region=in_region,
            threshold=result.threshold,
        )
        if not decision.allowed:
            self._emit_status(STATUS_WAITING if self.safety.in_cooldown() else STATUS_DETECTED)
            if new_call:
                self.call_detected.emit({**payload, "new_call": True, "click_allowed": False,
                                         "reason": decision.text})
            return False

        if new_call:
            self.call_detected.emit({**payload, "new_call": True, "click_allowed": True})
        self._emit_status(STATUS_DETECTED)

        if self.config.get("click.verify_before_click", True) and not self._verify_before_click(result):
            if new_call:
                self.logger.log("ناموفق در شناسایی", "هشدار",
                                "پیش از کلیک، تشخیص دوباره تأیید نشد و کلیک انجام نشد.", level="warning")
            return False

        self._do_click(result)
        return False

    # ------------------------------------------------------------------- کلیک
    def _do_click(self, result: MatchResult) -> None:
        try:
            self.click_engine.click(
                result.center_x, result.center_y,
                button="left",
                double=bool(self.config.get("click.double_click", False)),
                restore_cursor=bool(self.config.get("click.restore_cursor", True)),
            )
        except ClickError as exc:
            self.logger.log("کلیک خودکار", "ناموفق", str(exc), level="error")
            self.error_occurred.emit(f"کلیک ناموفق بود: {exc}")
            return
        self.safety.register_click()
        # قفل «یک‌بار پاسخ در هر تماس» تا تماسِ پاسخ‌داده‌شده دوباره قطع نشود
        self._answered_latch = True
        self._absent_cycles = 0
        payload = {
            **self._result_payload(result),
            "point": [result.center_x, result.center_y],
            "clicked_at": time.time(),
            "answered_count": self.safety.answered_count,
        }
        self.logger.log(
            "کلیک خودکار", "موفق",
            f"کلیک در نقطه ({result.center_x}, {result.center_y}) انجام شد - {result.title} | {result.label}",
            extra={"mode": result.mode, "point": [result.center_x, result.center_y]},
        )
        self.clicked.emit(payload)
        self._emit_heartbeat()
        self._emit_status(STATUS_WAITING)

    def _verify_before_click(self, result: MatchResult) -> bool:
        """تأیید دوبارهٔ تشخیص روی یک ناحیهٔ کوچک پیش از کلیک."""
        assert self._capture is not None
        box_left, box_top, box_w, box_h = result.box
        margin = int(max(20, min(box_w, box_h) * 0.5))
        left = max(0, box_left - margin)
        top = max(0, box_top - margin)
        width = box_w + margin * 2
        height = box_h + margin * 2
        try:
            frame = self._capture.grab(left, top, width, height)
        except CaptureError:
            return False
        blank_rect(frame, left, top, self._exclusion_rect())
        config_data = {"detection": self.config.get("detection", {}) or {}}
        check = self.detector.detect(frame, origin=(left, top), config=config_data, force_ocr=True)
        if check is None or not check.found:
            return False
        tolerance = max(18, int(min(box_w, box_h) * 0.75))
        if abs(check.center_x - result.center_x) > tolerance or abs(check.center_y - result.center_y) > tolerance:
            return False
        if check.confidence + 0.05 < result.confidence:
            return False
        # استفاده از نقطهٔ تأییدشدهٔ دوم برای کلیک دقیق‌تر
        result.center_x, result.center_y = check.center_x, check.center_y
        result.box = check.box
        result.confidence = check.confidence
        return True

    # ------------------------------------------------------------------ کمکی‌ها
    def _point_in_region(self, x: int, y: int) -> bool:
        left, top, width, height = self._region()
        return (left - 2) <= x <= (left + width + 2) and (top - 2) <= y <= (top + height + 2)

    @staticmethod
    def _result_payload(result: MatchResult) -> dict:
        return {
            "mode": result.mode,
            "title": result.title,
            "label": result.label,
            "confidence": round(result.confidence, 4),
            "center": [result.center_x, result.center_y],
            "box": list(result.box),
            "elapsed_ms": round(result.elapsed_ms, 2),
            "timestamp": time.time(),
        }

    def _emit_status(self, status: str) -> None:
        if status != self._last_status:
            self._last_status = status
            self.status_changed.emit(status)

    def _emit_heartbeat(self) -> None:
        snapshot = self.safety.snapshot()
        snapshot["cycle_ms"] = round(self.last_cycle_ms, 2)
        snapshot["interval_ms"] = self.config.interval_ms()
        snapshot["frames"] = self._frame_counter
        snapshot["auto_click_enabled"] = bool(self.config.get("general.auto_click_enabled", True))
        self.heartbeat.emit(snapshot)


class DetectionTester(QThread):
    """اجرای یک‌بارهٔ تشخیص برای دکمهٔ «آزمون تشخیص» (بدون کلیک)."""

    finished_result = Signal(object, object, object)   # MatchResult | None، تصویر، مبدأ ناحیه
    failed = Signal(str)

    def __init__(self, config, detector: Detector, region: tuple[int, int, int, int] | None = None,
                 exclude_rect: tuple[int, int, int, int] | None = None) -> None:
        super().__init__()
        self.config = config
        self.detector = detector
        self._region = region
        self._exclude_rect = tuple(exclude_rect) if exclude_rect else None

    def run(self) -> None:
        capture = ScreenCapture()
        try:
            if self._region and self._region[2] > 0 and self._region[3] > 0:
                left, top, width, height = self._region
            else:
                rect = self.config.region()
                if rect[2] > 0 and rect[3] > 0:
                    left, top, width, height = rect
                else:
                    monitor = capture.virtual_monitor()
                    left, top, width, height = (int(monitor["left"]), int(monitor["top"]),
                                                int(monitor["width"]), int(monitor["height"]))
            frame = capture.grab(left, top, width, height)
            blank_rect(frame, left, top, self._exclude_rect)
            config_data = {"detection": self.config.get("detection", {}) or {}}
            result = self.detector.detect(frame, origin=(left, top), config=config_data, force_ocr=True)
            self.finished_result.emit(result, frame, (left, top))
        except CaptureError as exc:
            self.failed.emit(f"گرفتن تصویر صفحه ناموفق بود: {exc}")
        except Exception as exc:  # محافظت از رابط کاربری
            self.failed.emit(f"خطای تشخیص: {exc}")
            traceback.print_exc()
        finally:
            capture.close()
