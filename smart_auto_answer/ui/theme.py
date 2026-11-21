"""پوستهٔ بصری برنامه: رنگ‌ها، فونت و شیوه‌نامهٔ QSS (راست‌به‌چپ)."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPixmap

COLORS = {
    "bg": "#0B1220",
    "bg_alt": "#0F1729",
    "panel": "#131C2E",
    "panel_alt": "#182238",
    "panel_hover": "#1E2A44",
    "border": "#243353",
    "border_soft": "#1B2740",
    "text": "#E8EFF9",
    "muted": "#8FA3BF",
    "muted_soft": "#6C7F9C",
    "primary": "#2F7BF6",
    "primary_hover": "#3F8BFF",
    "primary_press": "#1F63D0",
    "green": "#22C55E",
    "green_dark": "#12813D",
    "red": "#EF4444",
    "red_dark": "#B91C1C",
    "orange": "#F59E0B",
    "blue": "#38BDF8",
    "purple": "#A855F7",
    "teal": "#14B8A6",
}

# رنگ وضعیت‌های چهارگانهٔ درخواستی
STATUS_COLORS = {
    "idle": COLORS["red"],
    "monitoring": COLORS["green"],
    "waiting": COLORS["orange"],
    "detected": COLORS["blue"],
    "error": "#FB7185",
}

STATUS_LABELS = {
    "idle": "پایش متوقف است",
    "monitoring": "پایش فعال است",
    "waiting": "در انتظار تماس / خنک‌سازی",
    "detected": "تماس شناسایی شد",
    "error": "خطا",
}

FONT_FAMILIES = ["Vazirmatn", "Vazir", "IRANSans", "Tahoma", "Segoe UI", "Arial"]

BASE_FONT_SIZE = 12
TITLE_FONT_SIZE = 14


def app_font(size: int = BASE_FONT_SIZE, bold: bool = False) -> QFont:
    """ساخت قلم برنامه با زنجیرهٔ جانشین مناسب متن دری."""
    font = QFont()
    font.setFamilies(FONT_FAMILIES)
    font.setPointSize(size)
    font.setBold(bold)
    return font


def color(name: str) -> QColor:
    return QColor(COLORS.get(name, "#FFFFFF"))


def status_icon(status: str, size: int = 24) -> QIcon:
    """ساخت آیکون دایره‌ای رنگی متناسب با وضعیت پایش."""
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    fill = QColor(STATUS_COLORS.get(status, COLORS["muted"]))
    painter.setBrush(fill)
    painter.setPen(Qt.PenStyle.NoPen)
    margin = max(2, size // 10)
    painter.drawEllipse(margin, margin, size - margin * 2, size - margin * 2)
    painter.end()
    return QIcon(pixmap)


def build_stylesheet() -> str:
    """شیوه‌نامهٔ کامل رابط کاربری."""
    c = COLORS
    return f"""
    * {{
        outline: 0;
    }}
    QWidget {{
        color: {c['text']};
        font-size: 12px;
    }}
    QMainWindow, #Root, #PageArea {{
        background: {c['bg']};
    }}
    #Sidebar {{
        background: {c['bg_alt']};
        border-left: 1px solid {c['border_soft']};
    }}
    #SidebarTitle {{
        color: {c['text']};
        font-size: 15px;
        font-weight: bold;
        padding: 16px 14px 4px 14px;
    }}
    #SidebarSubtitle {{
        color: {c['muted_soft']};
        font-size: 11px;
        padding: 0 14px 14px 14px;
    }}
    #AppHeader {{
        background: {c['bg_alt']};
        border-bottom: 1px solid {c['border_soft']};
    }}
    #AppTitle {{
        font-size: 16px;
        font-weight: bold;
        color: {c['text']};
    }}
    #AppSubtitle {{
        color: {c['muted']};
        font-size: 11px;
    }}
    #Card, #Section {{
        background: {c['panel']};
        border: 1px solid {c['border_soft']};
        border-radius: 12px;
    }}
    #SectionTitle {{
        font-size: 14px;
        font-weight: bold;
        color: {c['text']};
    }}
    #SectionHint, #Hint, #MutedText {{
        color: {c['muted']};
        font-size: 11px;
    }}
    #StatValue {{
        font-size: 22px;
        font-weight: bold;
        color: {c['text']};
    }}
    #StatTitle {{
        color: {c['muted']};
        font-size: 11px;
    }}
    #StatIcon {{
        background: {c['panel_alt']};
        border-radius: 9px;
    }}

    QPushButton {{
        background: {c['panel_alt']};
        border: 1px solid {c['border']};
        border-radius: 9px;
        padding: 8px 14px;
        color: {c['text']};
        font-size: 12px;
    }}
    QPushButton:hover {{
        background: {c['panel_hover']};
        border-color: {c['primary']};
    }}
    QPushButton:pressed {{
        background: {c['panel']};
    }}
    QPushButton:disabled {{
        color: {c['muted_soft']};
        background: {c['panel']};
        border-color: {c['border_soft']};
    }}
    QPushButton[variant="primary"] {{
        background: {c['primary']};
        border-color: {c['primary']};
        color: #FFFFFF;
        font-weight: bold;
    }}
    QPushButton[variant="primary"]:hover {{
        background: {c['primary_hover']};
        border-color: {c['primary_hover']};
    }}
    QPushButton[variant="success"] {{
        background: {c['green_dark']};
        border-color: {c['green_dark']};
        color: #FFFFFF;
        font-weight: bold;
    }}
    QPushButton[variant="success"]:hover {{
        background: {c['green']};
        border-color: {c['green']};
    }}
    QPushButton[variant="danger"] {{
        background: {c['red_dark']};
        border-color: {c['red_dark']};
        color: #FFFFFF;
        font-weight: bold;
    }}
    QPushButton[variant="danger"]:hover {{
        background: {c['red']};
        border-color: {c['red']};
    }}
    QPushButton[variant="warning"] {{
        background: #A16207;
        border-color: #A16207;
        color: #FFFFFF;
    }}
    QPushButton[variant="warning"]:hover {{
        background: {c['orange']};
    }}
    QPushButton[variant="ghost"] {{
        background: transparent;
        border: 1px solid {c['border']};
    }}
    QPushButton[big="true"] {{
        font-size: 13px;
        padding: 14px 18px;
        font-weight: bold;
    }}
    QPushButton[nav="true"] {{
        text-align: right;
        padding: 11px 14px;
        border-radius: 9px;
        border: 1px solid transparent;
        background: transparent;
        color: {c['muted']};
        font-size: 12px;
    }}
    QPushButton[nav="true"]:hover {{
        background: {c['panel']};
        color: {c['text']};
    }}
    QPushButton[nav="true"]:checked {{
        background: {c['panel_alt']};
        border-color: {c['primary']};
        color: {c['text']};
        font-weight: bold;
    }}

    QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QPlainTextEdit, QTextEdit {{
        background: {c['bg_alt']};
        border: 1px solid {c['border']};
        border-radius: 8px;
        padding: 6px 10px;
        selection-background-color: {c['primary']};
        color: {c['text']};
    }}
    QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus, QPlainTextEdit:focus {{
        border-color: {c['primary']};
    }}
    QComboBox::drop-down {{
        border: none;
        width: 22px;
    }}
    QComboBox QAbstractItemView {{
        background: {c['panel']};
        border: 1px solid {c['border']};
        selection-background-color: {c['primary']};
        color: {c['text']};
        outline: 0;
    }}
    QSpinBox::up-button, QSpinBox::down-button,
    QDoubleSpinBox::up-button, QDoubleSpinBox::down-button {{
        background: {c['panel_alt']};
        border: none;
        width: 18px;
    }}

    QGroupBox {{
        background: {c['panel']};
        border: 1px solid {c['border_soft']};
        border-radius: 12px;
        margin-top: 18px;
        padding: 14px 12px 12px 12px;
        font-size: 12px;
    }}
    QGroupBox::title {{
        subcontrol-origin: margin;
        subcontrol-position: top right;
        right: 14px;
        padding: 2px 8px;
        color: {c['text']};
        font-size: 13px;
        font-weight: bold;
    }}

    QCheckBox, QRadioButton {{
        spacing: 8px;
        color: {c['text']};
    }}
    QCheckBox::indicator, QRadioButton::indicator {{
        width: 18px;
        height: 18px;
        border: 1px solid {c['border']};
        border-radius: 5px;
        background: {c['bg_alt']};
    }}
    QRadioButton::indicator {{
        border-radius: 9px;
    }}
    QCheckBox::indicator:checked, QRadioButton::indicator:checked {{
        background: {c['primary']};
        border-color: {c['primary']};
    }}
    QCheckBox::indicator:hover, QRadioButton::indicator:hover {{
        border-color: {c['primary']};
    }}

    QListWidget, QTableWidget, QTreeWidget {{
        background: {c['bg_alt']};
        border: 1px solid {c['border_soft']};
        border-radius: 10px;
        gridline-color: {c['border_soft']};
        alternate-background-color: {c['panel']};
    }}
    QListWidget::item {{
        padding: 7px 9px;
        border-radius: 7px;
        margin: 1px 3px;
    }}
    QListWidget::item:selected {{
        background: {c['panel_alt']};
        border: 1px solid {c['primary']};
    }}
    QListWidget::item:hover {{
        background: {c['panel']};
    }}
    QTableWidget::item:selected {{
        background: {c['panel_alt']};
        color: {c['text']};
    }}
    QHeaderView::section {{
        background: {c['panel_alt']};
        color: {c['muted']};
        padding: 7px 8px;
        border: none;
        border-bottom: 1px solid {c['border_soft']};
        font-size: 11px;
    }}
    QTableCornerButton::section {{
        background: {c['panel_alt']};
        border: none;
    }}

    QTabWidget::pane {{
        border: 1px solid {c['border_soft']};
        border-radius: 10px;
        background: {c['panel']};
        top: -1px;
    }}
    QTabBar::tab {{
        background: {c['bg_alt']};
        color: {c['muted']};
        padding: 9px 16px;
        border: 1px solid {c['border_soft']};
        border-bottom: none;
        border-top-left-radius: 9px;
        border-top-right-radius: 9px;
        margin-left: 3px;
    }}
    QTabBar::tab:selected {{
        background: {c['panel']};
        color: {c['text']};
        font-weight: bold;
    }}

    QSlider::groove:horizontal {{
        height: 6px;
        background: {c['bg_alt']};
        border-radius: 3px;
    }}
    QSlider::sub-page:horizontal {{
        background: {c['primary']};
        border-radius: 3px;
    }}
    QSlider::handle:horizontal {{
        background: #FFFFFF;
        width: 16px;
        height: 16px;
        margin: -6px 0;
        border-radius: 8px;
        border: 2px solid {c['primary']};
    }}
    QSlider::handle:horizontal:hover {{
        background: {c['primary_hover']};
        border-color: #FFFFFF;
    }}

    QScrollBar:vertical {{
        background: transparent;
        width: 11px;
        margin: 4px 2px 4px 2px;
    }}
    QScrollBar::handle:vertical {{
        background: {c['border']};
        border-radius: 5px;
        min-height: 28px;
    }}
    QScrollBar::handle:vertical:hover {{
        background: {c['muted_soft']};
    }}
    QScrollBar:horizontal {{
        background: transparent;
        height: 11px;
        margin: 2px 4px 2px 4px;
    }}
    QScrollBar::handle:horizontal {{
        background: {c['border']};
        border-radius: 5px;
        min-width: 28px;
    }}
    QScrollBar::add-line, QScrollBar::sub-line {{
        width: 0; height: 0;
    }}
    QScrollBar::add-page, QScrollBar::sub-page {{
        background: transparent;
    }}

    QProgressBar {{
        background: {c['bg_alt']};
        border: 1px solid {c['border_soft']};
        border-radius: 7px;
        text-align: center;
        color: {c['text']};
        height: 14px;
    }}
    QProgressBar::chunk {{
        background: {c['primary']};
        border-radius: 6px;
    }}

    QMenu {{
        background: {c['panel']};
        border: 1px solid {c['border']};
        border-radius: 10px;
        padding: 6px;
    }}
    QMenu::item {{
        padding: 8px 22px 8px 14px;
        border-radius: 7px;
        color: {c['text']};
    }}
    QMenu::item:selected {{
        background: {c['panel_alt']};
    }}
    QMenu::separator {{
        height: 1px;
        background: {c['border_soft']};
        margin: 5px 8px;
    }}

    QToolTip {{
        background: {c['panel_alt']};
        color: {c['text']};
        border: 1px solid {c['border']};
        border-radius: 6px;
        padding: 5px 8px;
    }}

    QStatusBar {{
        background: {c['bg_alt']};
        color: {c['muted']};
        border-top: 1px solid {c['border_soft']};
        font-size: 11px;
    }}
    QSplitter::handle {{
        background: {c['border_soft']};
    }}
    """
