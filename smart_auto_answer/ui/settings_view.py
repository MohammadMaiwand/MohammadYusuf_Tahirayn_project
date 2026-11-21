"""صفحهٔ تنظیمات: زمان‌بندی، ناحیهٔ پایش، ایمنی کلیک، میان‌برها و عمومی."""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QKeyEvent
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout, QGroupBox, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QScrollArea, QSlider, QSpinBox, QVBoxLayout, QWidget,
)

from ..core import winutils
from ..core.shortcut_manager import format_hotkey, parse_hotkey
from .context import AppContext
from .theme import COLORS
from .widgets import ActionButton, Card, SectionCard

_MODIFIER_KEYS = {
    Qt.Key.Key_Control: "Ctrl",
    Qt.Key.Key_Shift: "Shift",
    Qt.Key.Key_Alt: "Alt",
    Qt.Key.Key_Meta: "Win",
}


class HotkeyEdit(QLineEdit):
    """کادر ورودی که با فشردن کلید، میان‌بر را ثبت می‌کند."""

    hotkey_changed = Signal(str)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setReadOnly(True)
        self.setPlaceholderText("برای ثبت، کلیدها را فشار دهید")
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._value = ""

    def set_hotkey(self, text: str) -> None:
        self._value = text or ""
        self.setText(format_hotkey(self._value) if self._value else "")

    def hotkey(self) -> str:
        return self._value

    def keyPressEvent(self, event: QKeyEvent) -> None:  # noqa: N802
        key = event.key()
        if key in (Qt.Key.Key_Backspace, Qt.Key.Key_Delete):
            self._value = ""
            self.setText("")
            self.hotkey_changed.emit("")
            return
        if key in (Qt.Key.Key_Escape, Qt.Key.Key_Tab, Qt.Key.Key_Backtab):
            self.clearFocus()
            return
        if key in _MODIFIER_KEYS:
            return
        parts = []
        modifiers = event.modifiers()
        if modifiers & Qt.KeyboardModifier.ControlModifier:
            parts.append("Ctrl")
        if modifiers & Qt.KeyboardModifier.AltModifier:
            parts.append("Alt")
        if modifiers & Qt.KeyboardModifier.ShiftModifier:
            parts.append("Shift")
        if modifiers & Qt.KeyboardModifier.MetaModifier:
            parts.append("Win")
        name = self._key_name(key)
        if name:
            parts.append(name)
        candidate = "+".join(parts)
        if parse_hotkey(candidate) is None:
            return
        self._value = candidate
        self.setText(format_hotkey(candidate))
        self.hotkey_changed.emit(candidate)

    @staticmethod
    def _key_name(key: int) -> str:
        if Qt.Key.Key_F1 <= key <= Qt.Key.Key_F24:
            return f"F{key - Qt.Key.Key_F1 + 1}"
        if Qt.Key.Key_A <= key <= Qt.Key.Key_Z:
            return chr(key)
        if Qt.Key.Key_0 <= key <= Qt.Key.Key_9:
            return chr(key)
        specials = {
            Qt.Key.Key_Space: "Space", Qt.Key.Key_Return: "Enter", Qt.Key.Key_Enter: "Enter",
            Qt.Key.Key_Insert: "Insert", Qt.Key.Key_Home: "Home", Qt.Key.Key_End: "End",
            Qt.Key.Key_PageUp: "PageUp", Qt.Key.Key_PageDown: "PageDown",
            Qt.Key.Key_Left: "Left", Qt.Key.Key_Up: "Up", Qt.Key.Key_Right: "Right",
            Qt.Key.Key_Down: "Down", Qt.Key.Key_Print: "PrintScreen", Qt.Key.Key_Pause: "Pause",
        }
        return specials.get(key, "")


class SettingsPage(QWidget):
    """تنظیمات کامل برنامه."""

    region_changed = Signal()
    settings_applied = Signal()
    shortcuts_changed = Signal(dict)
    reset_requested = Signal()

    def __init__(self, context: AppContext, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.context = context
        self._loading = True

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        container = QWidget()
        scroll.setWidget(container)
        layout = QVBoxLayout(container)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(14)

        layout.addWidget(self._build_general())
        layout.addWidget(self._build_timing())
        layout.addWidget(self._build_region())
        layout.addWidget(self._build_click_safety())
        layout.addWidget(self._build_shortcuts())
        layout.addWidget(self._build_advanced())
        layout.addStretch(1)
        root.addWidget(scroll)

        self._load_values()

    # ------------------------------------------------------------- بخش‌ها
    def _build_general(self) -> QWidget:
        box = QGroupBox("عمومی")
        form = QFormLayout(box)
        form.setSpacing(9)

        self.autostart_monitor_check = QCheckBox("پایش تماس‌ها به‌طور خودکار هنگام اجرای برنامه آغاز شود")
        self.autostart_monitor_check.toggled.connect(
            lambda value: self._set("general.start_monitoring_on_launch", bool(value)))
        form.addRow(self.autostart_monitor_check)

        self.startup_check = QCheckBox("اجرای خودکار برنامه همراه با روشن‌شدن ویندوز")
        self.startup_check.toggled.connect(self._on_startup_toggled)
        form.addRow(self.startup_check)

        self.close_to_tray_check = QCheckBox("با زدن دکمهٔ بستن، برنامه به نوار وظیفه برود (پایش متوقف نشود)")
        self.close_to_tray_check.toggled.connect(
            lambda value: self._set("general.close_to_tray", bool(value)))
        form.addRow(self.close_to_tray_check)

        self.ask_close_check = QCheckBox("هنگام بستن پنجره، از من پرسیده شود")
        self.ask_close_check.toggled.connect(lambda value: self._set("general.ask_on_close", bool(value)))
        form.addRow(self.ask_close_check)

        self.notifications_check = QCheckBox("نمایش اعلان‌های رومیزی")
        self.notifications_check.toggled.connect(self._on_notifications_toggled)
        form.addRow(self.notifications_check)

        self.sound_check = QCheckBox("پخش صدا برای رویدادها")
        self.sound_check.toggled.connect(self._on_sound_toggled)
        form.addRow(self.sound_check)

        sound_row = QHBoxLayout()
        self.sound_test_button = ActionButton("آزمون زنگ (پخش صدا)", glyph="phone")
        self.sound_test_button.setToolTip(
            "یک زنگ نمونه پخش می‌کند تا مطمئن شوید صدای کمپیوتر و بلندگوها درست کار می‌کنند."
        )
        self.sound_test_button.clicked.connect(self._on_sound_test)
        self.notification_test_button = ActionButton("آزمون اعلان رومیزی")
        self.notification_test_button.clicked.connect(self._on_notification_test)
        sound_row.addWidget(self.sound_test_button)
        sound_row.addWidget(self.notification_test_button)
        sound_row.addStretch(1)
        sound_widget = QWidget()
        sound_widget.setLayout(sound_row)
        form.addRow(sound_widget)

        self.boost_volume_check = QCheckBox("هنگام زنگ تماس، صدای سیستم خودکار بلند شود")
        self.boost_volume_check.setToolTip(
            "به‌محض شناسایی تماس، صدای ویندوز تا سطح انتخاب‌شدهٔ زیر بالا می‌رود تا زنگ و "
            "صدای طرف مقابل به‌خوبی شنیده شود (چون پاسخ‌دهی توسط خود برنامه انجام می‌شود)."
        )
        self.boost_volume_check.toggled.connect(self._on_boost_volume_toggled)
        form.addRow(self.boost_volume_check)

        self.volume_percent_spin = QSpinBox()
        self.volume_percent_spin.setRange(10, 100)
        self.volume_percent_spin.setSingleStep(10)
        self.volume_percent_spin.setSuffix(" درصد")
        self.volume_percent_spin.valueChanged.connect(
            lambda value: self._set("general.call_volume_percent", int(value)))
        form.addRow("سطح صدای هدف هنگام تماس:", self.volume_percent_spin)
        return box

    def _build_timing(self) -> QWidget:
        box = QGroupBox("زمان‌بندی و دقت تشخیص")
        form = QFormLayout(box)
        form.setSpacing(9)

        self.interval_spin = QSpinBox()
        self.interval_spin.setRange(50, 5000)
        self.interval_spin.setSingleStep(50)
        self.interval_spin.setSuffix(" میلی‌ثانیه")
        self.interval_spin.valueChanged.connect(
            lambda value: self._set("detection.interval_ms", int(value)))
        form.addRow("فاصلهٔ پایش (پیش‌فرض ۵۰۰):", self.interval_spin)

        self.turbo_check = QCheckBox("حالت پرسرعت (پاسخ زیر نیم‌ثانیه، مصرف پردازندهٔ بیشتر)")
        self.turbo_check.toggled.connect(self._on_turbo_toggled)
        form.addRow(self.turbo_check)

        self.turbo_interval_spin = QSpinBox()
        self.turbo_interval_spin.setRange(40, 1000)
        self.turbo_interval_spin.setSingleStep(20)
        self.turbo_interval_spin.setSuffix(" میلی‌ثانیه")
        self.turbo_interval_spin.valueChanged.connect(
            lambda value: self._set("detection.turbo_interval_ms", int(value)))
        form.addRow("فاصلهٔ پایش در حالت پرسرعت:", self.turbo_interval_spin)

        confidence_row = QHBoxLayout()
        self.confidence_slider = QSlider(Qt.Orientation.Horizontal)
        self.confidence_slider.setRange(30, 99)
        self.confidence_slider.valueChanged.connect(self._on_confidence_slider)
        self.confidence_spin = QDoubleSpinBox()
        self.confidence_spin.setRange(0.30, 0.99)
        self.confidence_spin.setSingleStep(0.01)
        self.confidence_spin.setDecimals(2)
        self.confidence_spin.valueChanged.connect(self._on_confidence_spin)
        confidence_row.addWidget(self.confidence_slider, 1)
        confidence_row.addWidget(self.confidence_spin)
        conf_widget = QWidget()
        conf_widget.setLayout(confidence_row)
        form.addRow("آستانهٔ اطمینان تطبیق تصویر:", conf_widget)

        self.scale_min_spin = QDoubleSpinBox()
        self.scale_min_spin.setRange(0.30, 1.0)
        self.scale_min_spin.setSingleStep(0.05)
        self.scale_min_spin.valueChanged.connect(lambda value: self._set("detection.scale_min", float(value)))
        self.scale_max_spin = QDoubleSpinBox()
        self.scale_max_spin.setRange(1.0, 2.5)
        self.scale_max_spin.setSingleStep(0.05)
        self.scale_max_spin.valueChanged.connect(lambda value: self._set("detection.scale_max", float(value)))
        self.scale_steps_spin = QSpinBox()
        self.scale_steps_spin.setRange(1, 21)
        self.scale_steps_spin.valueChanged.connect(lambda value: self._set("detection.scale_steps", int(value)))
        scale_row = QHBoxLayout()
        scale_row.addWidget(self.scale_min_spin)
        scale_row.addWidget(QLabel("تا"))
        scale_row.addWidget(self.scale_max_spin)
        scale_row.addWidget(QLabel("تعداد گام:"))
        scale_row.addWidget(self.scale_steps_spin)
        scale_row.addStretch(1)
        scale_widget = QWidget()
        scale_widget.setLayout(scale_row)
        form.addRow("محدودهٔ اندازهٔ دکمه (چندمقیاسی):", scale_widget)

        self.smart_idle_check = QCheckBox(
            "کاهش مصرف پردازنده: تا وقتی تصویر صفحه تغییر نکند، تشخیص سنگین اجرا نشود"
        )
        self.smart_idle_check.setToolTip(
            "با روشن‌بودن این گزینه، برنامه در حالت بی‌حرکت تقریباً هیچ پردازنده‌ای مصرف نمی‌کند "
            "و به‌محض تغییر صفحه (مثل ظاهرشدن تماس ورودی) تشخیص را فوراً اجرا می‌کند."
        )
        self.smart_idle_check.toggled.connect(lambda value: self._set("detection.smart_idle", bool(value)))
        form.addRow(self.smart_idle_check)
        return box

    def _build_region(self) -> QWidget:
        box = QGroupBox("ناحیهٔ پایش")
        layout = QVBoxLayout(box)
        layout.setSpacing(9)
        hint = QLabel("برای سرعت بیشتر و دقت بالاتر، فقط همان بخشی از صفحه را پایش کنید که دکمهٔ پاسخ در آن ظاهر می‌شود.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        self.region_label = QLabel("ناحیه: کل صفحه")
        self.region_label.setObjectName("MutedText")
        self.region_label.setWordWrap(True)
        layout.addWidget(self.region_label)

        row = QHBoxLayout()
        self.select_region_button = ActionButton("انتخاب ناحیه با ماوس", "primary", glyph="target")
        self.select_region_button.clicked.connect(lambda: self.context.selector.start("region"))
        self.fullscreen_button = ActionButton("پایش کل صفحه")
        self.fullscreen_button.clicked.connect(self._set_fullscreen)
        row.addWidget(self.select_region_button)
        row.addWidget(self.fullscreen_button)
        row.addStretch(1)
        layout.addLayout(row)
        self.refresh_region_label()
        return box

    def _build_click_safety(self) -> QWidget:
        box = QGroupBox("ایمنی کلیک")
        form = QFormLayout(box)
        form.setSpacing(9)

        self.cooldown_spin = QSpinBox()
        self.cooldown_spin.setRange(200, 60000)
        self.cooldown_spin.setSingleStep(500)
        self.cooldown_spin.setSuffix(" میلی‌ثانیه")
        self.cooldown_spin.valueChanged.connect(lambda value: self._set("click.cooldown_ms", int(value)))
        form.addRow("فاصلهٔ خنک‌سازی پس از هر کلیک (پیش‌فرض ۳۰۰۰):", self.cooldown_spin)

        self.verify_check = QCheckBox("پیش از کلیک، تشخیص دوباره تأیید شود")
        self.verify_check.toggled.connect(lambda value: self._set("click.verify_before_click", bool(value)))
        form.addRow(self.verify_check)

        self.restore_cursor_check = QCheckBox("پس از کلیک، نشانگر ماوس به جای اولیه برگردد")
        self.restore_cursor_check.toggled.connect(lambda value: self._set("click.restore_cursor", bool(value)))
        form.addRow(self.restore_cursor_check)

        self.double_click_check = QCheckBox("کلیک دوباره روی دکمهٔ پاسخ")
        self.double_click_check.toggled.connect(lambda value: self._set("click.double_click", bool(value)))
        form.addRow(self.double_click_check)

        self.max_clicks_spin = QSpinBox()
        self.max_clicks_spin.setRange(1, 240)
        self.max_clicks_spin.valueChanged.connect(
            lambda value: self._set("click.max_clicks_per_minute", int(value)))
        form.addRow("بیشینهٔ کلیک در یک دقیقه:", self.max_clicks_spin)

        self.release_frames_spin = QSpinBox()
        self.release_frames_spin.setRange(1, 30)
        self.release_frames_spin.valueChanged.connect(
            lambda value: self._set("click.release_frames", int(value)))
        form.addRow("فریم‌های لازم برای پایان‌یافتن تماس:", self.release_frames_spin)
        return box

    def _build_shortcuts(self) -> QWidget:
        box = QGroupBox("میان‌برهای کلیدی سراسری")
        form = QFormLayout(box)
        form.setSpacing(9)

        self.shortcut_enabled_check = QCheckBox("فعال‌بودن میان‌برهای سراسری")
        self.shortcut_enabled_check.toggled.connect(self._on_shortcuts_changed)
        form.addRow(self.shortcut_enabled_check)

        self.start_hotkey = HotkeyEdit()
        self.start_hotkey.hotkey_changed.connect(self._on_shortcuts_changed)
        form.addRow("شروع پایش:", self.start_hotkey)

        self.stop_hotkey = HotkeyEdit()
        self.stop_hotkey.hotkey_changed.connect(self._on_shortcuts_changed)
        form.addRow("توقف پایش:", self.stop_hotkey)

        self.toggle_hotkey = HotkeyEdit()
        self.toggle_hotkey.hotkey_changed.connect(self._on_shortcuts_changed)
        form.addRow("روشن/خاموش‌کردن کلیک خودکار:", self.toggle_hotkey)

        self.panic_hotkey = HotkeyEdit()
        self.panic_hotkey.hotkey_changed.connect(self._on_shortcuts_changed)
        form.addRow("توقف اضطراری کلیک:", self.panic_hotkey)

        self.shortcut_status = QLabel("وضعیت ثبت میان‌برها: در حال بررسی ...")
        self.shortcut_status.setObjectName("MutedText")
        self.shortcut_status.setWordWrap(True)
        form.addRow(self.shortcut_status)
        hint = QLabel("برای پاک‌کردن یک میان‌بر، روی کادر آن کلیک کنید و کلید Delete را بزنید. "
                      "میان‌برها حتی وقتی برنامهٔ دیگری فعال است کار می‌کنند.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        form.addRow(hint)
        return box

    def _build_advanced(self) -> QWidget:
        card = SectionCard("نگهداری و بازنشانی", "همهٔ تنظیمات به‌صورت خودکار در فایل config/settings.json ذخیره می‌شوند.")
        row = QHBoxLayout()
        self.preview_check = QCheckBox("نمایش پیش‌نمایش زندهٔ ناحیهٔ پایش در داشبورد")
        self.preview_check.toggled.connect(lambda value: self._set("ui.live_preview", bool(value)))
        row.addWidget(self.preview_check)
        row.addStretch(1)
        card.content().addLayout(row)

        buttons = QHBoxLayout()
        self.reset_button = ActionButton("بازگرداندن تنظیمات پیش‌فرض", "warning")
        self.reset_button.clicked.connect(self.reset_requested.emit)
        self.open_config_button = ActionButton("بازکردن پوشهٔ تنظیمات")
        self.open_config_button.clicked.connect(self._open_config_folder)
        buttons.addWidget(self.reset_button)
        buttons.addWidget(self.open_config_button)
        buttons.addStretch(1)
        card.content().addLayout(buttons)
        return card

    # ------------------------------------------------------------- مقادیر
    def _load_values(self) -> None:
        config = self.context.config
        self._loading = True
        self.autostart_monitor_check.setChecked(bool(config.get("general.start_monitoring_on_launch", False)))
        self.startup_check.setChecked(winutils.is_startup_enabled())
        self.close_to_tray_check.setChecked(bool(config.get("general.close_to_tray", True)))
        self.ask_close_check.setChecked(bool(config.get("general.ask_on_close", True)))
        self.notifications_check.setChecked(bool(config.get("general.notifications_enabled", True)))
        self.sound_check.setChecked(bool(config.get("general.sound_enabled", True)))
        self.boost_volume_check.setChecked(bool(config.get("general.boost_volume_on_call", True)))
        self.volume_percent_spin.setValue(int(config.get("general.call_volume_percent", 100)))
        self.volume_percent_spin.setEnabled(self.boost_volume_check.isChecked())

        self.interval_spin.setValue(int(config.get("detection.interval_ms", 500)))
        self.turbo_check.setChecked(bool(config.get("detection.turbo_mode", False)))
        self.turbo_interval_spin.setValue(int(config.get("detection.turbo_interval_ms", 120)))
        self.turbo_interval_spin.setEnabled(self.turbo_check.isChecked())
        confidence = float(config.get("detection.confidence", 0.86))
        self.confidence_slider.setValue(int(round(confidence * 100)))
        self.confidence_spin.setValue(confidence)
        self.scale_min_spin.setValue(float(config.get("detection.scale_min", 0.75)))
        self.scale_max_spin.setValue(float(config.get("detection.scale_max", 1.30)))
        self.scale_steps_spin.setValue(int(config.get("detection.scale_steps", 5)))
        self.smart_idle_check.setChecked(bool(config.get("detection.smart_idle", True)))

        self.cooldown_spin.setValue(int(config.get("click.cooldown_ms", 3000)))
        self.verify_check.setChecked(bool(config.get("click.verify_before_click", True)))
        self.restore_cursor_check.setChecked(bool(config.get("click.restore_cursor", True)))
        self.double_click_check.setChecked(bool(config.get("click.double_click", False)))
        self.max_clicks_spin.setValue(int(config.get("click.max_clicks_per_minute", 15)))
        self.release_frames_spin.setValue(int(config.get("click.release_frames", 3)))

        self.shortcut_enabled_check.setChecked(bool(config.get("shortcuts.enabled", True)))
        self.start_hotkey.set_hotkey(str(config.get("shortcuts.start", "F8")))
        self.stop_hotkey.set_hotkey(str(config.get("shortcuts.stop", "F9")))
        self.toggle_hotkey.set_hotkey(str(config.get("shortcuts.toggle_auto", "F10")))
        self.panic_hotkey.set_hotkey(str(config.get("shortcuts.panic", "F12")))
        self.preview_check.setChecked(bool(config.get("ui.live_preview", True)))
        self.refresh_region_label()
        self._loading = False

    def refresh_region_label(self) -> None:
        """نمایش ناحیهٔ فعلی پایش."""
        left, top, width, height = self.context.config.region()
        if width <= 0 or height <= 0:
            self.region_label.setText(
                f"ناحیه: کل صفحه (همهٔ نمایشگرها) — اندازهٔ نمایشگر: {self.context.mapper.describe()}"
            )
        else:
            self.region_label.setText(
                f"ناحیهٔ انتخابی: نقطهٔ ({left}, {top}) — اندازه {width} × {height} پیکسل"
            )
        self.region_label.setStyleSheet(f"color:{COLORS['muted']};")

    def show_shortcut_status(self, status: dict) -> None:
        """نمایش وضعیت ثبت میان‌برها."""
        labels = {
            "start": "شروع", "stop": "توقف", "toggle_auto": "کلیک خودکار", "panic": "اضطراری",
        }
        if not status:
            self.shortcut_status.setText("وضعیت ثبت میان‌برها: ثبت نشده")
            return
        parts = [f"{labels.get(key, key)}: {value}" for key, value in status.items()]
        self.shortcut_status.setText("وضعیت ثبت میان‌برها — " + " | ".join(parts))

    # ------------------------------------------------------------- رویدادها
    def _set(self, key: str, value) -> None:
        if self._loading:
            return
        self.context.config.set(key, value)
        if key.startswith("detection.") or key.startswith("click."):
            self._apply_safety()
        self.context.log("تغییر تنظیمات", "موفق", f"{key} = {value}")
        self.settings_applied.emit()

    def _apply_safety(self) -> None:
        config = self.context.config
        self.context.safety.configure(
            cooldown_ms=int(config.get("click.cooldown_ms", 3000)),
            max_clicks_per_minute=int(config.get("click.max_clicks_per_minute", 15)),
            release_frames=int(config.get("click.release_frames", 3)),
            min_confidence=float(config.get("detection.confidence", 0.86)),
        )
        self.context.detector.invalidate()

    def _on_confidence_slider(self, value: int) -> None:
        if self._loading:
            return
        self.confidence_spin.setValue(value / 100.0)

    def _on_confidence_spin(self, value: float) -> None:
        if self._loading:
            return
        self.confidence_slider.setValue(int(round(value * 100)))
        self._set("detection.confidence", round(float(value), 3))

    def _on_turbo_toggled(self, value: bool) -> None:
        self.turbo_interval_spin.setEnabled(bool(value))
        self._set("detection.turbo_mode", bool(value))

    def _on_startup_toggled(self, value: bool) -> None:
        if self._loading:
            return
        ok = winutils.set_startup_enabled(bool(value))
        if not ok:
            self.context.notifications.notify("خطا", "تنظیم اجرای خودکار با ویندوز ناموفق بود.", "error")
            self._loading = True
            self.startup_check.setChecked(winutils.is_startup_enabled())
            self._loading = False
            return
        self._set("general.launch_at_windows_startup", bool(value))

    def _on_notifications_toggled(self, value: bool) -> None:
        self.context.notifications.notifications_enabled = bool(value)
        self._set("general.notifications_enabled", bool(value))

    def _on_sound_toggled(self, value: bool) -> None:
        self.context.notifications.sound_enabled = bool(value)
        self._set("general.sound_enabled", bool(value))

    def _on_boost_volume_toggled(self, value: bool) -> None:
        self.volume_percent_spin.setEnabled(bool(value))
        self._set("general.boost_volume_on_call", bool(value))

    def _on_sound_test(self) -> None:
        """پخش زنگ نمونه برای اطمینان از کارکرد صدا."""
        # برای اینکه آزمون واقعاً شنیده شود، ابتدا صدای سیستم بلند می‌شود
        if bool(self.context.config.get("general.boost_volume_on_call", True)):
            winutils.boost_system_volume(int(self.context.config.get("general.call_volume_percent", 100)))
        notifications = self.context.notifications
        was_enabled = notifications.sound_enabled
        notifications.sound_enabled = True
        played = notifications.play_ring(force=True)
        notifications.sound_enabled = was_enabled
        if played:
            notifications.notify("آزمون صدا", "زنگ نمونه پخش شد. اگر آن را شنیدید، صدا درست کار می‌کند.", "success")
            self.context.log("آزمون صدا", "موفق", "زنگ نمونه با موفقیت پخش شد.")
            self._toast("زنگ نمونه پخش شد.", "success")
        else:
            notifications.notify("آزمون صدا", "پخش صدا در این سیستم در دسترس نیست.", "error")
            self.context.log("آزمون صدا", "ناموفق", "پخش صدا در دسترس نیست.", level="error")
            self._toast("پخش صدا در دسترس نیست.", "error")

    def _on_notification_test(self) -> None:
        """نمایش یک اعلان نمونهٔ رومیزی."""
        self.context.notifications.notify(
            "SMART AUTO ANSWER", "این یک اعلان نمونه است.", "info")
        self.context.log("آزمون اعلان", "موفق", "اعلان نمونهٔ رومیزی نمایش داده شد.")
        self._toast("اعلان نمونه نمایش داده شد.", "info")

    def _toast(self, message: str, level: str = "info") -> None:
        window = getattr(self.context.notifications, "_window", None)
        if window is not None:
            try:
                window.show_toast("آزمون", message, level, 3500)
            except (RuntimeError, AttributeError):
                pass

    def _on_shortcuts_changed(self) -> None:
        if self._loading:
            return
        mapping = {
            "start": self.start_hotkey.hotkey(),
            "stop": self.stop_hotkey.hotkey(),
            "toggle_auto": self.toggle_hotkey.hotkey(),
            "panic": self.panic_hotkey.hotkey(),
        }
        enabled = self.shortcut_enabled_check.isChecked()
        self.context.config.update({
            "shortcuts.enabled": enabled,
            "shortcuts.start": mapping["start"],
            "shortcuts.stop": mapping["stop"],
            "shortcuts.toggle_auto": mapping["toggle_auto"],
            "shortcuts.panic": mapping["panic"],
        })
        self.shortcuts_changed.emit(mapping)
        self.context.log("میان‌بر کلیدی", "موفق", f"میان‌برها به‌روزرسانی شد: {mapping}")

    def _set_fullscreen(self) -> None:
        self.context.config.set_region_off()
        self.refresh_region_label()
        self.region_changed.emit()
        self.context.log("تغییر تنظیمات", "موفق", "ناحیهٔ پایش به کل صفحه تغییر یافت.")

    def _open_config_folder(self) -> None:
        import os

        folder = self.context.config_path.parent if hasattr(self.context.config, "path") else None
        if folder is None:
            from ..core.paths import config_dir

            folder = config_dir()
        try:
            os.startfile(str(folder))  # noqa: S606
        except Exception:
            self.context.notifications.notify("خطا", "بازکردن پوشه ناموفق بود.", "error")

    def reload(self) -> None:
        self._load_values()
