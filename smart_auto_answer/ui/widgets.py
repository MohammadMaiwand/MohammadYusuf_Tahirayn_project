"""ابزارهای رابط کاربری مشترک: کارت‌ها، نشانگر وضعیت، اعلان شناور و پیش‌نمایش."""

from __future__ import annotations

import numpy as np
from PySide6.QtCore import QEasingCurve, QPoint, QPropertyAnimation, QRectF, QSize, Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPainterPath, QPen, QPixmap, QPolygonF
from PySide6.QtWidgets import (
    QFrame, QGraphicsOpacityEffect, QHBoxLayout, QLabel, QPushButton, QSizePolicy,
    QStyle, QVBoxLayout, QWidget,
)

from .theme import BASE_FONT_SIZE, COLORS, STATUS_COLORS, STATUS_LABELS, app_font


# --------------------------------------------------------------------- کارت‌ها
class Card(QFrame):
    """کارت پایه با پس‌زمینه و حاشیهٔ یکسان."""

    def __init__(self, parent: QWidget | None = None, padding: int = 14, spacing: int = 10) -> None:
        super().__init__(parent)
        self.setObjectName("Card")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(padding, padding, padding, padding)
        self._layout.setSpacing(spacing)

    def body(self) -> QVBoxLayout:
        return self._layout


class SectionCard(Card):
    """کارت دارای عنوان و توضیح کوتاه."""

    def __init__(self, title: str, hint: str = "", parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setObjectName("Section")
        header = QVBoxLayout()
        header.setSpacing(2)
        title_label = QLabel(title)
        title_label.setObjectName("SectionTitle")
        header.addWidget(title_label)
        if hint:
            hint_label = QLabel(hint)
            hint_label.setObjectName("SectionHint")
            hint_label.setWordWrap(True)
            header.addWidget(hint_label)
        self._layout.addLayout(header)
        self._content = QVBoxLayout()
        self._content.setSpacing(10)
        self._layout.addLayout(self._content)

    def content(self) -> QVBoxLayout:
        return self._content


# ------------------------------------------------------------------ نشانگر وضعیت
class StatusPill(QFrame):
    """نمایشگر وضعیت با نقطهٔ رنگی و متن."""

    def __init__(self, parent: QWidget | None = None, compact: bool = False) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(12 if not compact else 8, 5, 12 if not compact else 8, 5)
        layout.setSpacing(8)
        self._dot = QLabel()
        self._dot.setFixedSize(12, 12)
        self._text = QLabel(STATUS_LABELS["idle"])
        self._text.setFont(app_font(BASE_FONT_SIZE, bold=True))
        layout.addWidget(self._dot)
        layout.addWidget(self._text)
        layout.addStretch(1)
        self.set_status("idle")

    def set_status(self, status: str, extra: str = "") -> None:
        color = STATUS_COLORS.get(status, COLORS["muted"])
        self._dot.setStyleSheet(f"background:{color}; border-radius:6px;")
        label = STATUS_LABELS.get(status, status)
        if extra:
            label = f"{label} — {extra}"
        self._text.setText(label)
        self._text.setStyleSheet(f"color:{color};")

    def set_text(self, status: str, text: str) -> None:
        color = STATUS_COLORS.get(status, COLORS["muted"])
        self._dot.setStyleSheet(f"background:{color}; border-radius:6px;")
        self._text.setText(text)
        self._text.setStyleSheet(f"color:{color};")


# ---------------------------------------------------------------- کارت آماری
def make_glyph(kind: str, color: str, size: int = 30) -> QPixmap:
    """رسم آیکون‌های برداری ساده (بدون نیاز به فایل تصویر خارجی)."""
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    pen = QPen(QColor(color))
    pen.setWidthF(max(1.8, size / 14))
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    painter.setPen(pen)
    box = QRectF(size * 0.18, size * 0.18, size * 0.64, size * 0.64)

    if kind == "play":
        polygon = QPolygonF([QPoint(int(size * 0.32), int(size * 0.24)),
                             QPoint(int(size * 0.78), int(size * 0.5)),
                             QPoint(int(size * 0.32), int(size * 0.76))])
        painter.setBrush(QColor(color))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawPolygon(polygon)
    elif kind == "stop":
        painter.setBrush(QColor(color))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(box, 3, 3)
    elif kind == "target":
        painter.drawEllipse(box)
        painter.drawEllipse(QRectF(size * 0.36, size * 0.36, size * 0.28, size * 0.28))
        painter.drawLine(QPoint(size // 2, int(size * 0.08)), QPoint(size // 2, int(size * 0.24)))
        painter.drawLine(QPoint(size // 2, int(size * 0.76)), QPoint(size // 2, int(size * 0.92)))
    elif kind == "phone":
        path = QPainterPath()
        path.moveTo(size * 0.28, size * 0.22)
        path.lineTo(size * 0.72, size * 0.22)
        path.lineTo(size * 0.72, size * 0.78)
        path.lineTo(size * 0.28, size * 0.78)
        path.closeSubpath()
        painter.drawPath(path)
        painter.drawLine(QPoint(int(size * 0.42), int(size * 0.68)), QPoint(int(size * 0.58), int(size * 0.68)))
    elif kind == "check":
        painter.drawLine(QPoint(int(size * 0.24), int(size * 0.54)), QPoint(int(size * 0.44), int(size * 0.72)))
        painter.drawLine(QPoint(int(size * 0.44), int(size * 0.72)), QPoint(int(size * 0.78), int(size * 0.30)))
    elif kind == "clock":
        painter.drawEllipse(box)
        painter.drawLine(QPoint(size // 2, size // 2), QPoint(size // 2, int(size * 0.31)))
        painter.drawLine(QPoint(size // 2, size // 2), QPoint(int(size * 0.65), size // 2))
    elif kind == "gear":
        painter.drawEllipse(QRectF(size * 0.34, size * 0.34, size * 0.32, size * 0.32))
        for index in range(6):
            import math

            angle = math.radians(index * 60)
            x1 = size / 2 + math.cos(angle) * size * 0.20
            y1 = size / 2 + math.sin(angle) * size * 0.20
            x2 = size / 2 + math.cos(angle) * size * 0.40
            y2 = size / 2 + math.sin(angle) * size * 0.40
            painter.drawLine(QPoint(int(x1), int(y1)), QPoint(int(x2), int(y2)))
    elif kind == "list":
        for index in range(3):
            y = int(size * (0.32 + index * 0.18))
            painter.drawLine(QPoint(int(size * 0.42), y), QPoint(int(size * 0.78), y))
            painter.drawEllipse(QRectF(size * 0.22, y - size * 0.045, size * 0.10, size * 0.10))
    elif kind == "palette":
        painter.drawEllipse(box)
        painter.setBrush(QColor(color))
        for offset in ((0.38, 0.38), (0.60, 0.42), (0.46, 0.62)):
            painter.drawEllipse(QRectF(size * offset[0], size * offset[1], size * 0.10, size * 0.10))
    elif kind == "text":
        painter.drawLine(QPoint(int(size * 0.26), int(size * 0.26)), QPoint(int(size * 0.74), int(size * 0.26)))
        painter.drawLine(QPoint(size // 2, int(size * 0.26)), QPoint(size // 2, int(size * 0.76)))
    else:
        painter.drawEllipse(box)
    painter.end()
    return pixmap


class StatCard(Card):
    """کارت نمایش یک عدد/زمان کلیدی."""

    def __init__(self, title: str, glyph: str, color: str, parent: QWidget | None = None) -> None:
        super().__init__(parent, padding=12, spacing=6)
        layout = QHBoxLayout()
        layout.setSpacing(10)
        icon = QLabel()
        icon.setObjectName("StatIcon")
        icon.setFixedSize(38, 38)
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon.setPixmap(make_glyph(glyph, color, 24))
        layout.addWidget(icon)

        texts = QVBoxLayout()
        texts.setSpacing(1)
        self._value = QLabel("—")
        self._value.setObjectName("StatValue")
        self._value.setFont(app_font(20, bold=True))
        self._title = QLabel(title)
        self._title.setObjectName("StatTitle")
        texts.addWidget(self._value)
        texts.addWidget(self._title)

        layout.addLayout(texts)
        layout.addStretch(1)
        self.body().addLayout(layout)

    def set_value(self, text: str) -> None:
        self._value.setText(text)


# ------------------------------------------------------------------ دکمه‌های بزرگ
class ActionButton(QPushButton):
    """دکمهٔ اصلی با آماده‌سازی ظاهر و اندازهٔ بزرگ."""

    def __init__(self, text: str, variant: str = "default", big: bool = False,
                 glyph: str = "", parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setProperty("variant", variant)
        self.setProperty("big", "true" if big else "false")
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(38 if not big else 52)
        if big:
            self.setFont(app_font(13, bold=True))
        if glyph:
            color = "#FFFFFF" if variant in ("primary", "success", "danger", "warning") else COLORS["text"]
            self.setIcon(QIcon(make_glyph(glyph, color, 20)))
            self.setIconSize(QSize(20, 20))


class IconButton(QPushButton):
    """دکمهٔ کوچک با آیکون سیستمی."""

    def __init__(self, text: str, standard_icon: QStyle.StandardPixmap | None = None,
                 parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(32)
        if standard_icon is not None:
            self.setIcon(self.style().standardIcon(standard_icon))


# ---------------------------------------------------------------- پیش‌نمایش تصویر
_PREVIEW_MAX_WIDTH = 640  # پیش‌نمایش فقط در همین اندازه ساخته می‌شود (صرفه‌جویی پردازنده)


class FramePreview(QLabel):
    """نمایش پیش‌نمایش زندهٔ ناحیهٔ پایش همراه با کادر تشخیص.

    برای کم‌کردن فشار روی پردازنده، تصویر فقط یک‌بار و در اندازهٔ کوچک به QImage
    تبدیل و ذخیره می‌شود؛ در زمان ترسیم هیچ تبدیل سنگینی انجام نمی‌گیرد.
    """

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setMinimumHeight(190)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setStyleSheet(
            f"background:{COLORS['bg_alt']}; border:1px solid {COLORS['border_soft']};"
            f"border-radius:10px; color:{COLORS['muted']};"
        )
        self.setText("پیش‌نمایش ناحیهٔ پایش")
        self._image = None            # QImage کوچک‌شده (کش‌شده)
        self._image_scale = 1.0       # نسبت تصویر کوچک به تصویر اصلی
        self._image_size = (0, 0)     # اندازهٔ تصویر کوچک
        self._box: tuple[int, int, int, int] | None = None
        self._origin: tuple[int, int] = (0, 0)

    @staticmethod
    def _to_qimage(frame):
        """تبدیل سبک آرایهٔ BGR به QImage با کوچک‌کردن ابعاد در صورت لزوم."""
        from PySide6.QtGui import QImage

        height, width = frame.shape[:2]
        scale = 1.0
        if width > _PREVIEW_MAX_WIDTH:
            try:
                import cv2

                new_w = _PREVIEW_MAX_WIDTH
                new_h = max(1, int(height * new_w / width))
                frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
                scale = new_w / width
            except Exception:
                pass
        height, width = frame.shape[:2]
        rgb = np.ascontiguousarray(frame[:, :, ::-1])
        image = QImage(rgb.data, width, height, 3 * width, QImage.Format.Format_RGB888)
        return image.copy(), scale, (width, height)

    def set_frame(self, frame: np.ndarray | None, box: tuple[int, int, int, int] | None = None,
                  origin: tuple[int, int] = (0, 0)) -> None:
        if frame is None or getattr(frame, "size", 0) == 0:
            self._image = None
            self._box = None
            self.update()
            return
        try:
            self._image, self._image_scale, self._image_size = self._to_qimage(frame)
        except Exception:
            self._image = None
            self._box = None
            self.update()
            return
        self._box = box
        self._origin = origin
        self.update()

    def clear_frame(self) -> None:
        self._image = None
        self._box = None
        self.setText("پیش‌نمایش ناحیهٔ پایش")
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 - نام Qt
        if self._image is None:
            super().paintEvent(event)
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
        width, height = self._image_size
        target = self.rect().adjusted(1, 1, -1, -1)
        scale = min(target.width() / max(1, width), target.height() / max(1, height))
        draw_w = max(1, int(width * scale))
        draw_h = max(1, int(height * scale))
        offset_x = target.x() + (target.width() - draw_w) // 2
        offset_y = target.y() + (target.height() - draw_h) // 2

        painter.drawImage(QRectF(offset_x, offset_y, draw_w, draw_h), self._image)

        if self._box:
            left, top, box_w, box_h = self._box
            factor = scale * self._image_scale
            x = offset_x + (left - self._origin[0]) * factor
            y = offset_y + (top - self._origin[1]) * factor
            pen = QPen(QColor(COLORS["green"]))
            pen.setWidth(2)
            painter.setPen(pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(QRectF(x, y, box_w * factor, box_h * factor))
            painter.setBrush(QColor(COLORS["green"]))
            painter.setPen(Qt.PenStyle.NoPen)
            center_x = x + box_w * factor / 2
            center_y = y + box_h * factor / 2
            painter.drawEllipse(QRectF(center_x - 3, center_y - 3, 6, 6))
        painter.end()


# ------------------------------------------------------------------ اعلان شناور
class Toast(QFrame):
    """پیام شناور کوتاه در پایین پنجره."""

    def __init__(self, parent: QWidget) -> None:
        super().__init__(parent)
        self.setObjectName("Card")
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(14, 9, 14, 9)
        layout.setSpacing(9)
        self._dot = QLabel()
        self._dot.setFixedSize(10, 10)
        self._text = QLabel()
        self._text.setFont(app_font(BASE_FONT_SIZE, bold=True))
        layout.addWidget(self._dot)
        layout.addWidget(self._text)
        self._effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self._effect)
        self._effect.setOpacity(0.0)
        self._animation = QPropertyAnimation(self._effect, b"opacity", self)
        self._animation.setDuration(220)
        self._animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self.hide_animated)
        self.hide()

    def show_message(self, text: str, level: str = "info", msec: int = 3500) -> None:
        palette = {
            "info": COLORS["primary"], "success": COLORS["green"],
            "warn": COLORS["orange"], "error": COLORS["red"],
        }
        color = palette.get(level, COLORS["primary"])
        self._dot.setStyleSheet(f"background:{color}; border-radius:5px;")
        self._text.setText(text)
        self._text.setStyleSheet(f"color:{color};")
        self.adjustSize()
        self.reposition()
        self.show()
        self.raise_()
        self._animation.stop()
        self._animation.setStartValue(self._effect.opacity())
        self._animation.setEndValue(1.0)
        self._animation.start()
        self._timer.start(msec)

    def reposition(self) -> None:
        parent = self.parentWidget()
        if parent is None:
            return
        self.adjustSize()
        x = (parent.width() - self.width()) // 2
        y = parent.height() - self.height() - 18
        self.move(max(10, x), max(10, y))

    def hide_animated(self) -> None:
        self._animation.stop()
        self._animation.setStartValue(self._effect.opacity())
        self._animation.setEndValue(0.0)
        self._animation.start()
        QTimer.singleShot(260, self.hide)
