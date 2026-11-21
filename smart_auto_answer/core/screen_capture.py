"""موتور گرفتن تصویر از صفحه با استفاده از mss (سریع و سبک)."""

from __future__ import annotations

import threading
from typing import Any

import numpy as np

try:
    import mss
except ImportError:  # pragma: no cover
    mss = None  # type: ignore[assignment]


class CaptureError(RuntimeError):
    """خطا در گرفتن تصویر از صفحه."""


class ScreenCapture:
    """گرفتن تصویر از ناحیهٔ مشخص‌شده از صفحه.

    هر رشته (thread) نمونهٔ مخصوص خود را می‌سازد، چون mss بین رشته‌ها ایمن نیست.
    """

    def __init__(self, monitor_index: int = 0) -> None:
        self._local = threading.local()
        self._monitor_index = monitor_index

    # ------------------------------------------------------------ نمونهٔ رشته
    def _instance(self):
        if mss is None:
            raise CaptureError("کتابخانهٔ mss نصب نیست.")
        instance = getattr(self._local, "sct", None)
        if instance is None:
            factory = getattr(mss, "MSS", None) or getattr(mss, "mss", None)
            instance = factory()
            self._local.sct = instance
        return instance

    def close(self) -> None:
        instance = getattr(self._local, "sct", None)
        if instance is not None:
            try:
                instance.close()
            except Exception:
                pass
            self._local.sct = None

    # ---------------------------------------------------------------- ناحیه‌ها
    @staticmethod
    def virtual_monitor() -> dict[str, int]:
        """مستطیل کل صفحهٔ مجازی."""
        instance = ScreenCapture._new_instance()
        try:
            monitors = instance.monitors
            if len(monitors) > 1:
                return dict(monitors[0])
            return {"left": 0, "top": 0, "width": 1920, "height": 1080}
        finally:
            try:
                instance.close()
            except Exception:
                pass

    @staticmethod
    def _new_instance():
        if mss is None:
            raise CaptureError("کتابخانهٔ mss نصب نیست.")
        factory = getattr(mss, "MSS", None) or getattr(mss, "mss", None)
        return factory()

    def monitors(self) -> list[dict[str, int]]:
        instance = self._instance()
        return [dict(item) for item in instance.monitors]

    # ------------------------------------------------------------------ گرفتن
    def grab(self, left: int, top: int, width: int, height: int) -> np.ndarray:
        """گرفتن تصویر ناحیه؛ خروجی آرایهٔ BGR به شکل (height, width, 3)."""
        if width <= 0 or height <= 0:
            raise CaptureError("ناحیهٔ پایش نامعتبر است.")
        instance = self._instance()
        region = {"left": int(left), "top": int(top), "width": int(width), "height": int(height)}
        try:
            shot = instance.grab(region)
        except Exception as exc:  # mss.ScreenShotError و خطاهای سیستمی
            raise CaptureError(f"گرفتن تصویر صفحه ناموفق بود: {exc}") from exc
        # mss روی ویندوز همیشه BGRA برمی‌گرداند؛ حذف کانال آلفا ⇒ BGR
        frame = np.frombuffer(shot.raw, dtype=np.uint8)
        expected = int(shot.width) * int(shot.height) * 4
        if frame.size != expected:
            frame = frame.reshape((shot.height, shot.width, -1))
            return np.ascontiguousarray(frame[:, :, :3])
        frame = frame.reshape((shot.height, shot.width, 4))[:, :, :3]
        return np.ascontiguousarray(frame)

    def grab_full(self) -> np.ndarray:
        """گرفتن تصویر کل صفحهٔ مجازی."""
        rect = self.virtual_monitor()
        return self.grab(rect["left"], rect["top"], rect["width"], rect["height"])

    def grab_bgra(self, left: int, top: int, width: int, height: int) -> np.ndarray:
        """گرفتن تصویر با کانال آلفا (برای تبدیل سریع به QImage)."""
        instance = self._instance()
        region = {"left": int(left), "top": int(top), "width": int(width), "height": int(height)}
        try:
            shot = instance.grab(region)
        except Exception as exc:
            raise CaptureError(str(exc)) from exc
        frame = np.frombuffer(shot.raw, dtype=np.uint8)
        return frame.reshape((shot.height, shot.width, 4))


def bgr_to_qimage(frame: np.ndarray):
    """تبدیل آرایهٔ BGR به QImage (بدون کپی اضافی در حد امکان)."""
    from PySide6.QtGui import QImage

    if frame.ndim != 3 or frame.shape[2] != 3:
        raise ValueError("آرایهٔ ورودی باید BGR سه‌کاناله باشد.")
    height, width = frame.shape[:2]
    rgb = np.ascontiguousarray(frame[:, :, ::-1])
    image = QImage(rgb.data, width, height, 3 * width, QImage.Format.Format_RGB888)
    return image.copy()


def capture_screen_shot(region: dict[str, Any] | None = None) -> np.ndarray:
    """تابع کمکی برای گرفتن سریع یک تصویر (استفادهٔ موردی)."""
    capturer = ScreenCapture()
    try:
        if region:
            return capturer.grab(int(region.get("left", 0)), int(region.get("top", 0)),
                                 int(region.get("width", 1)), int(region.get("height", 1)))
        return capturer.grab_full()
    finally:
        capturer.close()
