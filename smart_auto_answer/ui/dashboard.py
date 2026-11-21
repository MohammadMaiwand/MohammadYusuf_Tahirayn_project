"""صفحهٔ داشبورد: وضعیت زنده، آمار و کنترل‌های اصلی."""

from __future__ import annotations

import time

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QGridLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea, QSizePolicy,
    QVBoxLayout, QWidget,
)

from .theme import COLORS, STATUS_LABELS, app_font
from .widgets import ActionButton, Card, FramePreview, SectionCard, StatCard, StatusPill


def format_time(timestamp: float | None) -> str:
    """نمایش ساعت خوانا از برچسب زمانی یونیکس."""
    if not timestamp:
        return "—"
    return time.strftime("%H:%M:%S", time.localtime(timestamp))


class DashboardPage(QWidget):
    """داشبورد اصلی برنامه."""

    start_requested = Signal()
    stop_requested = Signal()
    test_requested = Signal()
    settings_requested = Signal()
    logs_requested = Signal()
    emergency_stop_requested = Signal()
    preview_toggled = Signal(bool)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(14)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        container = QWidget()
        scroll.setWidget(container)
        layout = QVBoxLayout(container)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(14)

        # ---------------------------------------------------------- نوار وضعیت
        status_card = Card(padding=14)
        status_row = QHBoxLayout()
        status_row.setSpacing(12)
        self.status_pill = StatusPill()
        self.status_pill.setStyleSheet(
            f"#Card {{ background:{COLORS['panel_alt']}; border:1px solid {COLORS['border_soft']};"
            f"border-radius:10px; }}"
        )
        self.status_pill.setMinimumWidth(320)
        status_row.addWidget(self.status_pill, 1)

        self.detail_label = QLabel("آماده به کار")
        self.detail_label.setObjectName("MutedText")
        self.detail_label.setWordWrap(True)
        self.detail_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        status_row.addWidget(self.detail_label, 2)

        self.emergency_button = ActionButton("توقف اضطراری کلیک", variant="danger", glyph="stop")
        self.emergency_button.setToolTip("جلوگیری فوری از هر کلیک خودکار (کلید میان‌بر را در تنظیمات ببینید)")
        self.emergency_button.clicked.connect(self.emergency_stop_requested.emit)
        status_row.addWidget(self.emergency_button)
        status_card.body().addLayout(status_row)
        layout.addWidget(status_card)

        # ------------------------------------------------------------- آمار
        stats_grid = QGridLayout()
        stats_grid.setSpacing(12)
        self.card_detected = StatCard("تماس‌های شناسایی‌شده", "phone", COLORS["blue"])
        self.card_answered = StatCard("تماس‌های پاسخ‌داده‌شده", "check", COLORS["green"])
        self.card_last_detect = StatCard("آخرین شناسایی", "target", COLORS["orange"])
        self.card_last_click = StatCard("آخرین کلیک موفق", "clock", COLORS["primary"])
        self.card_cycle = StatCard("زمان هر چرخهٔ پایش", "gear", COLORS["purple"])
        self.card_auto = StatCard("وضعیت کلیک خودکار", "play", COLORS["teal"])
        stats_grid.addWidget(self.card_detected, 0, 0)
        stats_grid.addWidget(self.card_answered, 0, 1)
        stats_grid.addWidget(self.card_last_detect, 0, 2)
        stats_grid.addWidget(self.card_last_click, 1, 0)
        stats_grid.addWidget(self.card_cycle, 1, 1)
        stats_grid.addWidget(self.card_auto, 1, 2)
        layout.addLayout(stats_grid)

        # --------------------------------------------------------- کنترل‌ها
        controls = SectionCard("کنترل‌های اصلی", "با دکمه‌های زیر پایش را آغاز یا متوقف کنید.")
        buttons_row = QGridLayout()
        buttons_row.setSpacing(10)
        self.start_button = ActionButton("شروع پایش (F8)", variant="success", big=True, glyph="play")
        self.stop_button = ActionButton("توقف پایش (F9)", variant="danger", big=True, glyph="stop")
        self.toggle_auto_button = ActionButton("کلیک خودکار: روشن (F10)", variant="primary", big=True, glyph="check")
        self.test_button = ActionButton("آزمون تشخیص", big=True, glyph="target")
        self.settings_button = ActionButton("تنظیمات", big=True, glyph="gear")
        self.logs_button = ActionButton("مشاهدهٔ رویدادها", big=True, glyph="list")
        buttons_row.addWidget(self.start_button, 0, 0)
        buttons_row.addWidget(self.stop_button, 0, 1)
        buttons_row.addWidget(self.toggle_auto_button, 0, 2)
        buttons_row.addWidget(self.test_button, 1, 0)
        buttons_row.addWidget(self.settings_button, 1, 1)
        buttons_row.addWidget(self.logs_button, 1, 2)
        controls.content().addLayout(buttons_row)

        self.hint_label = QLabel()
        self.hint_label.setObjectName("Hint")
        self.hint_label.setWordWrap(True)
        controls.content().addWidget(self.hint_label)
        layout.addWidget(controls)

        # ------------------------------------------------- پیش‌نمایش و گزارش
        lower = QHBoxLayout()
        lower.setSpacing(14)

        preview_card = SectionCard("پیش‌نمایش ناحیهٔ پایش", "کادر سبز همان جایی است که برنامه دکمهٔ پاسخ را دیده است.")
        self.preview = FramePreview()
        preview_card.content().addWidget(self.preview)
        self.preview_toggle = QPushButton("خاموش‌کردن پیش‌نمایش")
        self.preview_toggle.setCheckable(True)
        self.preview_toggle.setMinimumHeight(32)
        self.preview_toggle.clicked.connect(self._on_preview_toggled)
        preview_card.content().addWidget(self.preview_toggle)
        lower.addWidget(preview_card, 3)

        info_card = SectionCard("آخرین تشخیص", "جزئیات آخرین نتیجهٔ موتور تشخیص.")
        self.info_label = QLabel("هنوز تشخیصی انجام نشده است.")
        self.info_label.setWordWrap(True)
        self.info_label.setObjectName("MutedText")
        self.info_label.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.info_label.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        info_card.content().addWidget(self.info_label)
        lower.addWidget(info_card, 2)
        layout.addLayout(lower)
        layout.addStretch(1)

        root.addWidget(scroll)

        # اتصال دکمه‌ها
        self.start_button.clicked.connect(self.start_requested.emit)
        self.stop_button.clicked.connect(self.stop_requested.emit)
        self.test_button.clicked.connect(self.test_requested.emit)
        self.settings_button.clicked.connect(self.settings_requested.emit)
        self.logs_button.clicked.connect(self.logs_requested.emit)

        self.set_monitoring(False)
        self.set_auto_click(True)

    # ------------------------------------------------------------------ عمومی
    def bind_auto_toggle(self, handler) -> None:
        """اتصال دکمهٔ کلیک خودکار به گردانندهٔ اصلی."""
        if getattr(self, "_auto_handler_bound", False):
            try:
                self.toggle_auto_button.clicked.disconnect()
            except (RuntimeError, TypeError):
                pass
        self.toggle_auto_button.clicked.connect(handler)
        self._auto_handler_bound = True

    def set_monitoring(self, active: bool) -> None:
        self.start_button.setEnabled(not active)
        self.stop_button.setEnabled(active)

    def set_auto_click(self, enabled: bool) -> None:
        self.toggle_auto_button.setText(
            f"کلیک خودکار: {'روشن' if enabled else 'خاموش'} (F10)"
        )
        self.toggle_auto_button.setProperty("variant", "primary" if enabled else "warning")
        self.toggle_auto_button.style().unpolish(self.toggle_auto_button)
        self.toggle_auto_button.style().polish(self.toggle_auto_button)
        self.card_auto.set_value("روشن" if enabled else "خاموش")

    def set_emergency(self, active: bool) -> None:
        self.emergency_button.setText("کلیک اضطراری فعال است - بازگرداندن" if active
                                      else "توقف اضطراری کلیک")
        self.emergency_button.setProperty("variant", "warning" if active else "danger")
        self.emergency_button.style().unpolish(self.emergency_button)
        self.emergency_button.style().polish(self.emergency_button)

    def set_status(self, status: str, extra: str = "") -> None:
        self.status_pill.set_status(status, extra)

    def set_status_text(self, status: str, text: str) -> None:
        self.status_pill.set_text(status, text)

    def set_detail(self, text: str) -> None:
        self.detail_label.setText(text)

    def set_hint(self, text: str) -> None:
        self.hint_label.setText(text)

    def update_stats(self, snapshot: dict) -> None:
        self.card_detected.set_value(str(snapshot.get("detected_count", 0)))
        self.card_answered.set_value(str(snapshot.get("answered_count", 0)))
        self.card_last_detect.set_value(format_time(snapshot.get("last_detection_time")))
        self.card_last_click.set_value(format_time(snapshot.get("last_click_time")))
        cycle = snapshot.get("cycle_ms")
        interval = snapshot.get("interval_ms")
        if cycle is not None:
            self.card_cycle.set_value(f"{cycle:.0f} / {interval} ms")
        self.card_auto.set_value("روشن" if snapshot.get("auto_click_enabled", True) else "خاموش")

    def set_preview(self, frame, box=None, origin=(0, 0)) -> None:
        self.preview.set_frame(frame, box, origin)

    def set_detection_info(self, result) -> None:
        if result is None:
            self.info_label.setText("نتیجه‌ای برای نمایش وجود ندارد.")
            return
        if not result.found:
            modes = "، ".join(item.get("mode", "") for item in (result.candidates or [])[:3]) or "—"
            self.info_label.setText(
                f"<b>چیزی شناسایی نشد</b><br>حالت‌های فعال: {modes}<br>"
                f"بالاترین اطمینان: {result.confidence * 100:.1f}%<br>"
                f"آستانهٔ لازم: {result.threshold * 100:.1f}%"
            )
            return
        left, top, width, height = result.box
        self.info_label.setText(
            f"<b>{result.title}</b><br>"
            f"برچسب: {result.label}<br>"
            f"میزان اطمینان: <b>{result.confidence * 100:.1f}%</b> (آستانه {result.threshold * 100:.1f}%)<br>"
            f"مرکز دکمه: {result.center_x} , {result.center_y}<br>"
            f"اندازهٔ کادر: {width} × {height} در ({left}, {top})<br>"
            f"زمان صرف‌شده: {result.elapsed_ms:.0f} میلی‌ثانیه"
        )

    def _on_preview_toggled(self) -> None:
        enabled = not self.preview_toggle.isChecked()
        self.preview_toggle.setText("خاموش‌کردن پیش‌نمایش" if enabled else "روشن‌کردن پیش‌نمایش")
        self.preview.setVisible(enabled)
        self.preview_toggled.emit(enabled)

    def set_preview_enabled(self, enabled: bool) -> None:
        self.preview_toggle.setChecked(not enabled)
        self.preview_toggle.setText("خاموش‌کردن پیش‌نمایش" if enabled else "روشن‌کردن پیش‌نمایش")
        self.preview.setVisible(enabled)
