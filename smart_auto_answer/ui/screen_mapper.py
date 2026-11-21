"""تبدیل مختصات منطقی Qt به مختصات فیزیکی صفحه (سازگار با پیکسل‌های ویندوز)."""

from __future__ import annotations

from PySide6.QtCore import QRect
from PySide6.QtGui import QGuiApplication

from ..core.screen_capture import ScreenCapture


class ScreenMapper:
    """نقشهٔ تبدیل بین مختصات منطقی (Qt) و مختصات فیزیکی (mss/Win32).

    طول‌ومساحت در پنجره‌های Qt منطقی است، اما تشخیص تصویر و کلیک در پیکسل‌های
    فیزیکی انجام می‌شود؛ این کلاس این تفاوت را مدیریت می‌کند (نمایش‌های ۱۲۵٪، ۱۵۰٪ ...).
    """

    def __init__(self) -> None:
        self._pairs: list[tuple[QRect, float, dict]] = []
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        screens = QGuiApplication.screens()
        try:
            capture = ScreenCapture()
            monitors = capture.monitors()[1:]   # شاخص صفر کل صفحهٔ مجازی است
            capture.close()
        except Exception:
            monitors = []
        for screen in screens:
            geometry = screen.geometry()
            ratio = float(screen.devicePixelRatio() or 1.0)
            estimate = QRect(int(geometry.x() * ratio), int(geometry.y() * ratio),
                             int(geometry.width() * ratio), int(geometry.height() * ratio))
            best = None
            best_score = 0.0
            for monitor in monitors:
                score = self._overlap_ratio(estimate, monitor)
                if score > best_score:
                    best_score = score
                    best = monitor
            if best is None:
                best = {"left": estimate.x(), "top": estimate.y(),
                        "width": estimate.width(), "height": estimate.height()}
            self._pairs.append((geometry, ratio, dict(best)))

    @staticmethod
    def _overlap_ratio(rect: QRect, monitor: dict) -> float:
        left = max(rect.x(), int(monitor["left"]))
        top = max(rect.y(), int(monitor["top"]))
        right = min(rect.x() + rect.width(), int(monitor["left"]) + int(monitor["width"]))
        bottom = min(rect.y() + rect.height(), int(monitor["top"]) + int(monitor["height"]))
        if right <= left or bottom <= top:
            return 0.0
        intersection = (right - left) * (bottom - top)
        return intersection / float(max(1, rect.width() * rect.height()))

    def refresh(self) -> None:
        self._pairs.clear()
        self._loaded = False

    # ------------------------------------------------------------------ تبدیل
    def logical_to_physical_point(self, x: float, y: float) -> tuple[int, int]:
        """تبدیل یک نقطهٔ منطقی به پیکسل فیزیکی."""
        self._load()
        for geometry, ratio, monitor in self._pairs:
            if geometry.contains(int(x), int(y)):
                return (int(monitor["left"] + (x - geometry.x()) * ratio),
                        int(monitor["top"] + (y - geometry.y()) * ratio))
        if self._pairs:
            geometry, ratio, monitor = self._pairs[0]
            return (int(monitor["left"] + (x - geometry.x()) * ratio),
                    int(monitor["top"] + (y - geometry.y()) * ratio))
        return (int(x), int(y))

    def logical_rect_to_physical(self, rect: QRect) -> tuple[int, int, int, int]:
        """تبدیل یک مستطیل منطقی به مستطیل فیزیکی: (left, top, width, height)."""
        self._load()
        left, top = self.logical_to_physical_point(rect.x(), rect.y())
        right, bottom = self.logical_to_physical_point(rect.x() + rect.width(),
                                                       rect.y() + rect.height())
        return (left, top, max(1, right - left), max(1, bottom - top))

    def physical_rect_to_logical(self, left: int, top: int, width: int, height: int) -> QRect:
        """تبدیل مستطیل فیزیکی به مستطیل منطقی (برای نمایش ناحیهٔ ذخیره‌شده)."""
        self._load()
        for geometry, ratio, monitor in self._pairs:
            if (monitor["left"] == left and monitor["top"] == top) or abs(
                    monitor["width"] - width) < 4:
                x = geometry.x() + (left - monitor["left"]) / ratio
                y = geometry.y() + (top - monitor["top"]) / ratio
                return QRect(int(x), int(y), int(width / ratio), int(height / ratio))
        ratio = self.primary_ratio()
        return QRect(int(left / ratio), int(top / ratio), int(width / ratio), int(height / ratio))

    def primary_ratio(self) -> float:
        self._load()
        screen = QGuiApplication.primaryScreen()
        return float(screen.devicePixelRatio() or 1.0) if screen else 1.0

    def virtual_logical_rect(self) -> QRect:
        """مستطیل کل فضای رومیزی در مختصات منطقی."""
        rect = QRect()
        for screen in QGuiApplication.screens():
            rect = rect.united(screen.geometry())
        return rect

    def describe(self) -> str:
        """گزارش خلاصه برای نمایش در رابط کاربری."""
        self._load()
        parts = []
        for geometry, ratio, monitor in self._pairs:
            parts.append(f"{monitor['width']}×{monitor['height']} @ {int(ratio * 100)}%")
        return " | ".join(parts) if parts else "نامشخص"
