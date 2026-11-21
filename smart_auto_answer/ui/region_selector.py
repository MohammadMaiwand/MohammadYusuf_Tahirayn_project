"""ابزارهای انتخاب روی صفحه: ناحیهٔ پایش، گرفتن تصویر دکمه و برداشتن رنگ."""

from __future__ import annotations

import time

import numpy as np
from PySide6.QtCore import QPoint, QRect, Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFont, QGuiApplication, QPainter, QPen
from PySide6.QtWidgets import QWidget

from .screen_mapper import ScreenMapper
from .theme import COLORS, app_font

MODE_REGION = "region"
MODE_TEMPLATE = "template"
MODE_COLOR = "color"

_INSTRUCTIONS = {
    MODE_REGION: "کادر ناحیهٔ پایش را با ماوس بکشید  |  Esc برای لغو",
    MODE_TEMPLATE: "دور دکمهٔ پاسخ کادر بکشید تا به‌عنوان تصویر مرجع ذخیره شود  |  Esc برای لغو",
    MODE_COLOR: "روی رنگ دکمهٔ پاسخ کلیک کنید  |  Esc برای لغو",
}


class _Overlay(QWidget):
    """پنجرهٔ شفاف تمام‌صفحه برای انتخاب روی هر نمایشگر."""

    def __init__(self, controller: "ScreenSelector", screen) -> None:
        super().__init__(None)
        self._controller = controller
        self._screen = screen
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
            | Qt.WindowType.NoDropShadowWindowHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.setCursor(Qt.CursorShape.CrossCursor)
        self.setGeometry(screen.geometry())
        self._dragging = False
        self._start: QPoint | None = None
        self._hover: QPoint | None = None

    # رسم
    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.fillRect(self.rect(), QColor(4, 10, 20, 118))

        selection = self._controller.selection_local(self.geometry())
        if selection is not None and not selection.isEmpty():
            painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_Clear)
            painter.fillRect(selection, Qt.GlobalColor.transparent)
            painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
            pen = QPen(QColor(COLORS["green"]))
            pen.setWidth(2)
            painter.setPen(pen)
            painter.drawRect(selection)
            label = f"{selection.width()} × {selection.height()}"
            painter.setFont(app_font(11, bold=True))
            text_x = selection.x()
            text_y = selection.y() - 8 if selection.y() > 24 else selection.bottom() + 18
            painter.setPen(QColor(COLORS["green"]))
            painter.drawText(QPoint(text_x + 2, text_y), label)

        self._draw_instructions(painter)
        if self._controller.mode == MODE_COLOR:
            self._draw_color_picker(painter)
        painter.end()

    def _draw_instructions(self, painter: QPainter) -> None:
        text = _INSTRUCTIONS.get(self._controller.mode, "")
        if not text:
            return
        painter.setFont(app_font(13, bold=True))
        metrics = painter.fontMetrics()
        width = metrics.horizontalAdvance(text) + 34
        height = metrics.height() + 20
        x = (self.width() - width) // 2
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(12, 20, 34, 226))
        painter.drawRoundedRect(QRect(x, 26, width, height), 12, 12)
        painter.setPen(QColor(COLORS["text"]))
        painter.drawText(QRect(x, 26, width, height), Qt.AlignmentFlag.AlignCenter, text)

    def _draw_color_picker(self, painter: QPainter) -> None:
        if self._hover is None:
            return
        image = self._controller.screen_array()
        if image is None:
            return
        physical = self._controller.mapper.logical_to_physical_point(
            self.geometry().x() + self._hover.x(), self.geometry().y() + self._hover.y()
        )
        left, top, _, _ = self._controller.virtual_origin
        px = int(physical[0] - left)
        py = int(physical[1] - top)
        height, width = image.shape[:2]
        if not (0 <= px < width and 0 <= py < height):
            return
        hex_color = self._controller.pixel_hex(px, py)
        panel_size = 116
        sample = 13
        x0 = self._hover.x() + 24
        y0 = self._hover.y() + 24
        if x0 + panel_size > self.width():
            x0 = self._hover.x() - panel_size - 24
        if y0 + panel_size + 30 > self.height():
            y0 = self._hover.y() - panel_size - 54
        panel = QRect(x0, y0, panel_size, panel_size + 30)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(12, 20, 34, 235))
        painter.drawRoundedRect(panel, 10, 10)

        half = sample // 2
        left_sample = min(max(px - half, 0), max(0, width - sample))
        top_sample = min(max(py - half, 0), max(0, height - sample))
        crop = image[top_sample:top_sample + sample, left_sample:left_sample + sample]
        if crop.size:
            scaled = np.repeat(np.repeat(crop, panel_size // sample, axis=0), panel_size // sample, axis=1)
            from ..core.screen_capture import bgr_to_qimage

            zoom = bgr_to_qimage(scaled)
            painter.drawImage(QRect(x0 + 4, y0 + 4, panel_size - 8, panel_size - 8), zoom)
            center = (panel_size - 8) // 2
            painter.setPen(QPen(QColor(255, 255, 255), 1))
            painter.drawRect(x0 + 4 + center - 3, y0 + 4 + center - 3, 6, 6)
        painter.setPen(QColor(COLORS["text"]))
        painter.setFont(app_font(11, bold=True))
        painter.drawText(QRect(x0, y0 + panel_size, panel_size, 26),
                         Qt.AlignmentFlag.AlignCenter, hex_color.upper())
        painter.setPen(QPen(QColor(COLORS["green"]), 2))
        painter.drawRect(panel)

        # خطوط نشانگر
        painter.setPen(QPen(QColor(COLORS["blue"]), 1))
        painter.drawLine(0, self._hover.y(), self.width(), self._hover.y())
        painter.drawLine(self._hover.x(), 0, self._hover.x(), self.height())

    # رویدادها
    def mousePressEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.MouseButton.RightButton:
            self._controller.cancel()
            return
        if self._controller.mode == MODE_COLOR:
            global_point = self.geometry().topLeft() + event.position().toPoint()
            self._controller.pick_color_at(global_point)
            return
        self._dragging = True
        self._start = event.position().toPoint()
        self._controller.update_selection(self.geometry().topLeft() + self._start,
                                          self.geometry().topLeft() + self._start)

    def mouseMoveEvent(self, event) -> None:  # noqa: N802
        position = event.position().toPoint()
        if self._controller.mode == MODE_COLOR:
            self._hover = position
            self._controller.refresh_overlays()
            return
        if self._dragging and self._start is not None:
            origin = self.geometry().topLeft()
            self._controller.update_selection(origin + self._start, origin + position)

    def mouseReleaseEvent(self, event) -> None:  # noqa: N802
        if self._controller.mode == MODE_COLOR or not self._dragging:
            return
        self._dragging = False
        if self._start is None:
            return
        origin = self.geometry().topLeft()
        self._controller.finish_selection(origin + self._start, origin + event.position().toPoint())

    def keyPressEvent(self, event) -> None:  # noqa: N802
        if event.key() == Qt.Key.Key_Escape:
            self._controller.cancel()


class ScreenSelector(QWidget):
    """هماهنگ‌کنندهٔ انتخاب روی صفحه (ناحیه، تصویر دکمه، رنگ)."""

    region_selected = Signal(int, int, int, int)   # مختصات فیزیکی
    template_captured = Signal(object)             # آرایهٔ BGR
    color_picked = Signal(str)                     # کد رنگ
    cancelled = Signal()

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowFlag(Qt.WindowType.Tool)
        self.hide()
        self.mapper = ScreenMapper()
        self.mode = MODE_REGION
        self._overlays: list[_Overlay] = []
        self._start_point: QPoint | None = None
        self._end_point: QPoint | None = None
        self._screen_image: np.ndarray | None = None
        self._virtual_origin = (0, 0, 0, 0)
        self._active = False
        self._tick = QTimer(self)
        self._tick.setInterval(70)
        self._tick.timeout.connect(self._poll_cursor)
        self._hover_global: QPoint | None = None

    # ------------------------------------------------------------------ شروع
    def start(self, mode: str) -> None:
        """آغاز حالت انتخاب روی صفحه."""
        self.mode = mode
        self._start_point = None
        self._end_point = None
        self.mapper.refresh()
        if mode == MODE_COLOR:
            self._grab_full_screen()
        self._create_overlays()
        self._active = True
        if mode == MODE_COLOR:
            self._tick.start()

    def _create_overlays(self) -> None:
        self._close_overlays()
        for screen in QGuiApplication.screens():
            overlay = _Overlay(self, screen)
            overlay.show()
            overlay.raise_()
            overlay.activateWindow()
            self._overlays.append(overlay)
        if self._overlays:
            self._overlays[0].setFocus()

    def _close_overlays(self) -> None:
        self._tick.stop()
        for overlay in self._overlays:
            try:
                overlay.close()
                overlay.deleteLater()
            except RuntimeError:
                pass
        self._overlays = []

    def _grab_full_screen(self) -> None:
        from ..core.screen_capture import ScreenCapture

        capture = ScreenCapture()
        try:
            monitor = capture.virtual_monitor()
            self._virtual_origin = (int(monitor["left"]), int(monitor["top"]),
                                    int(monitor["width"]), int(monitor["height"]))
            self._screen_image = capture.grab(monitor["left"], monitor["top"],
                                              monitor["width"], monitor["height"])
        except Exception:
            self._screen_image = None
        finally:
            capture.close()

    # ------------------------------------------------------------- اطلاعات
    def screen_array(self) -> np.ndarray | None:
        return self._screen_image

    @property
    def virtual_origin(self) -> tuple[int, int, int, int]:
        return self._virtual_origin

    def pixel_hex(self, x: int, y: int) -> str:
        if self._screen_image is None:
            return "#000000"
        height, width = self._screen_image.shape[:2]
        x = min(max(int(x), 0), width - 1)
        y = min(max(int(y), 0), height - 1)
        pixel = self._screen_image[y, x]
        return f"#{int(pixel[2]):02X}{int(pixel[1]):02X}{int(pixel[0]):02X}"

    def selection_local(self, overlay_rect: QRect) -> QRect | None:
        """مستطیل انتخاب‌شده در مختصات محلی یک پوشش."""
        if self._start_point is None or self._end_point is None:
            return None
        rect = QRect(self._start_point, self._end_point).normalized()
        local = rect.translated(-overlay_rect.x(), -overlay_rect.y())
        return local.intersected(QRect(0, 0, overlay_rect.width(), overlay_rect.height()))

    # ------------------------------------------------------------- به‌روزرسانی
    def update_selection(self, start: QPoint, end: QPoint) -> None:
        if not self._active:
            return
        self._start_point = start
        self._end_point = end
        self.refresh_overlays()

    def refresh_overlays(self) -> None:
        for overlay in self._overlays:
            try:
                overlay.update()
            except RuntimeError:
                pass

    def _poll_cursor(self) -> None:
        """به‌روزرسانی ذره‌بین رنگ با حرکت ماوس."""
        from ..core.winutils import cursor_position

        physical = cursor_position()
        left, top, width, height = self._virtual_origin
        if not (left <= physical[0] < left + width and top <= physical[1] < top + height):
            return
        self.refresh_overlays()

    # ------------------------------------------------------------------ پایان
    def finish_selection(self, start: QPoint, end: QPoint) -> None:
        rect = QRect(start, end).normalized()
        if rect.width() < 6 or rect.height() < 6:
            self.cancel()
            return
        self._start_point = start
        self._end_point = end
        self.refresh_overlays()
        physical = self.mapper.logical_rect_to_physical(rect)
        mode = self.mode
        self._close_overlays()
        self._active = False
        if mode == MODE_REGION:
            self.region_selected.emit(*physical)
        else:
            frame = self._capture_physical(physical)
            if frame is None:
                self.cancelled.emit()
            else:
                self.template_captured.emit(frame)

    def pick_color_at(self, global_point: QPoint) -> None:
        physical = self.mapper.logical_to_physical_point(global_point.x(), global_point.y())
        left, top, _, _ = self._virtual_origin
        x = int(physical[0] - left)
        y = int(physical[1] - top)
        color = self.pixel_hex(x, y)
        self._close_overlays()
        self._active = False
        self.color_picked.emit(color)

    def cancel(self) -> None:
        self._close_overlays()
        self._active = False
        self._screen_image = None
        self.cancelled.emit()

    # ------------------------------------------------------------------ گرفتن
    def _capture_physical(self, physical: tuple[int, int, int, int]) -> np.ndarray | None:
        """گرفتن تصویر پس از پنهان‌کردن پوشش‌ها."""
        from ..core.screen_capture import ScreenCapture

        QGuiApplication.processEvents()
        time.sleep(0.16)
        capture = ScreenCapture()
        try:
            return capture.grab(*physical)
        except Exception:
            return None
        finally:
            capture.close()

    @property
    def active(self) -> bool:
        return self._active
