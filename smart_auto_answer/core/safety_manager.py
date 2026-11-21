"""مدیر ایمنی: جلوگیری از کلیک تکراری، اعمال فاصلهٔ زمانی و محدودیت نرخ."""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass

STATE_IDLE = "idle"
STATE_CALL_ACTIVE = "call_active"
STATE_COOLDOWN = "cooldown"

REASON_OK = "ok"
REASON_DUPLICATE = "duplicate"
REASON_COOLDOWN = "cooldown"
REASON_RATE_LIMIT = "rate_limit"
REASON_LOW_CONFIDENCE = "low_confidence"
REASON_OUT_OF_REGION = "out_of_region"
REASON_STOPPED = "stopped"
REASON_NO_TARGET = "no_target"

REASON_TEXT = {
    REASON_OK: "اجازهٔ کلیک صادر شد",
    REASON_DUPLICATE: "همین تماس قبلاً پاسخ داده شده است",
    REASON_COOLDOWN: "در دورهٔ خنک‌سازی پس از کلیک قبلی هستیم",
    REASON_RATE_LIMIT: "سقف کلیک در یک دقیقه پر شده است",
    REASON_LOW_CONFIDENCE: "میزان اطمینان تشخیص کمتر از حد مجاز است",
    REASON_OUT_OF_REGION: "نقطهٔ تشخیص خارج از ناحیهٔ پایش است",
    REASON_STOPPED: "کلیک اضطراری غیرفعال است",
    REASON_NO_TARGET: "هدف معتبری برای کلیک وجود ندارد",
}


@dataclass
class Decision:
    allowed: bool
    reason: str
    message: str = ""

    @property
    def text(self) -> str:
        return self.message or REASON_TEXT.get(self.reason, self.reason)


class SafetyManager:
    """تصمیم‌گیری دربارهٔ مجازبودن کلیک و نگه‌داشتن آمار."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.state = STATE_IDLE
        self.cooldown_ms = 3000
        self.max_clicks_per_minute = 15
        self.release_frames = 3
        self.min_confidence = 0.0
        self.emergency_stop = False
        self.auto_click_enabled = True
        self.last_click_time = 0.0
        self.last_detection_time = 0.0
        self.last_confidence = 0.0
        self.last_point: tuple[int, int] = (0, 0)
        self.detected_count = 0
        self.answered_count = 0
        self.rejected_count = 0
        self._miss_counter = 0
        self._click_history: deque[float] = deque(maxlen=200)
        self.last_reason = REASON_NO_TARGET

    # ------------------------------------------------------------------ تنظیم
    def configure(
        self,
        cooldown_ms: int | None = None,
        max_clicks_per_minute: int | None = None,
        release_frames: int | None = None,
        min_confidence: float | None = None,
    ) -> None:
        with self._lock:
            if cooldown_ms is not None:
                self.cooldown_ms = max(0, int(cooldown_ms))
            if max_clicks_per_minute is not None:
                self.max_clicks_per_minute = max(1, int(max_clicks_per_minute))
            if release_frames is not None:
                self.release_frames = max(1, int(release_frames))
            if min_confidence is not None:
                self.min_confidence = float(min_confidence)

    def reset_session(self) -> None:
        """آماده‌سازی برای شروع یک دورهٔ پایش تازه (شمارندهٔ تماس صفر می‌شود)."""
        with self._lock:
            self.state = STATE_IDLE
            self._miss_counter = 0
            self._click_history.clear()
            self.detected_count = 0
            self.answered_count = 0
            self.rejected_count = 0
            self.last_confidence = 0.0
            self.last_reason = REASON_NO_TARGET

    def set_emergency_stop(self, active: bool) -> None:
        """فعال/غیرفعال‌کردن توقف اضطراری کلیک."""
        with self._lock:
            self.emergency_stop = bool(active)
            if active:
                self.last_reason = REASON_STOPPED

    # ------------------------------------------------------------------ تصمیم
    def evaluate(
        self,
        confidence: float,
        center: tuple[int, int],
        in_region: bool = True,
        threshold: float = 0.0,
    ) -> Decision:
        """بررسی مجازبودن کلیک برای یک تشخیص."""
        with self._lock:
            now = time.time()
            effective_threshold = max(self.min_confidence, threshold)
            if self.emergency_stop or not self.auto_click_enabled:
                self.rejected_count += 1
                self.last_reason = REASON_STOPPED
                return Decision(False, REASON_STOPPED)
            if confidence < effective_threshold:
                self.rejected_count += 1
                self.last_reason = REASON_LOW_CONFIDENCE
                return Decision(False, REASON_LOW_CONFIDENCE,
                                f"{REASON_TEXT[REASON_LOW_CONFIDENCE]} "
                                f"({confidence * 100:.1f}% < {effective_threshold * 100:.1f}%)")
            if not in_region:
                self.rejected_count += 1
                self.last_reason = REASON_OUT_OF_REGION
                return Decision(False, REASON_OUT_OF_REGION)
            if self.state == STATE_CALL_ACTIVE:
                self.rejected_count += 1
                self.last_reason = REASON_DUPLICATE
                return Decision(False, REASON_DUPLICATE)
            elapsed_ms = (now - self.last_click_time) * 1000.0
            if self.last_click_time and elapsed_ms < self.cooldown_ms:
                self.rejected_count += 1
                self.last_reason = REASON_COOLDOWN
                return Decision(False, REASON_COOLDOWN,
                                f"{REASON_TEXT[REASON_COOLDOWN]} "
                                f"({int(self.cooldown_ms - elapsed_ms)} میلی‌ثانیه باقی مانده)")
            recent = len([value for value in self._click_history if now - value <= 60.0])
            if recent >= self.max_clicks_per_minute:
                self.rejected_count += 1
                self.last_reason = REASON_RATE_LIMIT
                return Decision(False, REASON_RATE_LIMIT)
            self.last_reason = REASON_OK
            self.last_confidence = float(confidence)
            self.last_point = (int(center[0]), int(center[1]))
            return Decision(True, REASON_OK)

    def register_detection(self, confidence: float, center: tuple[int, int]) -> None:
        """ثبت یک تشخیص موفق (تماس ورودی دیده شد)."""
        with self._lock:
            self.last_detection_time = time.time()
            self.last_confidence = float(confidence)
            self.last_point = (int(center[0]), int(center[1]))
            self.detected_count += 1
            self._miss_counter = 0

    def register_click(self) -> None:
        """ثبت کلیک موفق روی دکمهٔ پاسخ."""
        with self._lock:
            now = time.time()
            self.last_click_time = now
            self._click_history.append(now)
            self.answered_count += 1
            self.state = STATE_CALL_ACTIVE
            self._miss_counter = 0

    def register_miss(self) -> None:
        """ثبت یک چرخهٔ پایش بدون تشخیص."""
        with self._lock:
            self._miss_counter += 1
            if self.state == STATE_CALL_ACTIVE and self._miss_counter >= self.release_frames:
                self.state = STATE_IDLE
            if self.state == STATE_COOLDOWN and not self.last_click_time:
                self.state = STATE_IDLE

    def note_cooldown(self) -> None:
        with self._lock:
            if self.state != STATE_CALL_ACTIVE:
                self.state = STATE_COOLDOWN

    # -------------------------------------------------------------------- وضعیت
    def seconds_until_cooldown_end(self) -> float:
        with self._lock:
            if not self.last_click_time:
                return 0.0
            remaining = self.cooldown_ms / 1000.0 - (time.time() - self.last_click_time)
            return max(0.0, remaining)

    def in_cooldown(self) -> bool:
        return self.seconds_until_cooldown_end() > 0.0

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "state": self.state,
                "detected_count": self.detected_count,
                "answered_count": self.answered_count,
                "rejected_count": self.rejected_count,
                "last_detection_time": self.last_detection_time,
                "last_click_time": self.last_click_time,
                "last_confidence": self.last_confidence,
                "last_point": self.last_point,
                "last_reason": self.last_reason,
                "cooldown_remaining": self.seconds_until_cooldown_end(),
                "emergency_stop": self.emergency_stop,
                "auto_click_enabled": self.auto_click_enabled,
            }
