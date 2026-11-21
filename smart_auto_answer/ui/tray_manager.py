"""مدیر نوار وظیفه (System Tray): پایش در پس‌زمینه، منوی راست‌کلیک و اعلان‌ها."""

from __future__ import annotations

from PySide6.QtCore import QObject, Signal
from PySide6.QtGui import QAction, QIcon
from PySide6.QtWidgets import QMenu, QSystemTrayIcon

from .theme import STATUS_LABELS


class TrayManager(QObject):
    """آیکون و منوی ناحیهٔ اعلان ویندوز."""

    show_requested = Signal()
    start_requested = Signal()
    stop_requested = Signal()
    toggle_auto_requested = Signal()
    test_requested = Signal()
    open_logs_requested = Signal()
    open_settings_requested = Signal()
    emergency_stop_requested = Signal()
    quit_requested = Signal()

    def __init__(self, icon: QIcon, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.tray = QSystemTrayIcon(icon, parent)
        self.tray.setToolTip("SMART AUTO ANSWER — پایش متوقف است")

        menu = QMenu()
        self.show_action = QAction("نمایش پنجرهٔ اصلی", menu)
        self.show_action.triggered.connect(self.show_requested.emit)
        menu.addAction(self.show_action)
        menu.addSeparator()

        self.start_action = QAction("شروع پایش (F8)", menu)
        self.start_action.triggered.connect(self.start_requested.emit)
        menu.addAction(self.start_action)

        self.stop_action = QAction("توقف پایش (F9)", menu)
        self.stop_action.triggered.connect(self.stop_requested.emit)
        menu.addAction(self.stop_action)

        self.toggle_auto_action = QAction("کلیک خودکار: روشن (F10)", menu)
        self.toggle_auto_action.triggered.connect(self.toggle_auto_requested.emit)
        menu.addAction(self.toggle_auto_action)

        self.emergency_action = QAction("توقف اضطراری کلیک", menu)
        self.emergency_action.triggered.connect(self.emergency_stop_requested.emit)
        menu.addAction(self.emergency_action)

        self.test_action = QAction("آزمون تشخیص", menu)
        self.test_action.triggered.connect(self.test_requested.emit)
        menu.addAction(self.test_action)
        menu.addSeparator()

        self.settings_action = QAction("تنظیمات", menu)
        self.settings_action.triggered.connect(self.open_settings_requested.emit)
        menu.addAction(self.settings_action)

        self.logs_action = QAction("مشاهدهٔ رویدادها", menu)
        self.logs_action.triggered.connect(self.open_logs_requested.emit)
        menu.addAction(self.logs_action)
        menu.addSeparator()

        self.quit_action = QAction("خروج کامل از برنامه", menu)
        self.quit_action.triggered.connect(self.quit_requested.emit)
        menu.addAction(self.quit_action)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_activated)

    # ------------------------------------------------------------------ نمایش
    def show(self) -> None:
        self.tray.show()

    def hide(self) -> None:
        self.tray.hide()

    @property
    def available(self) -> bool:
        return QSystemTrayIcon.isSystemTrayAvailable()

    # ------------------------------------------------------------------ وضعیت
    def set_status(self, status: str) -> None:
        label = STATUS_LABELS.get(status, status)
        self.tray.setToolTip(f"SMART AUTO ANSWER — {label}")

    def set_monitoring(self, active: bool) -> None:
        self.start_action.setEnabled(not active)
        self.stop_action.setEnabled(active)

    def set_auto_click(self, enabled: bool) -> None:
        self.toggle_auto_action.setText(
            f"کلیک خودکار: {'روشن' if enabled else 'خاموش'} (F10)"
        )

    def set_emergency(self, active: bool) -> None:
        self.emergency_action.setText(
            "بازگرداندن کلیک خودکار" if active else "توقف اضطراری کلیک"
        )

    def notify(self, title: str, message: str, msec: int = 4000) -> None:
        try:
            self.tray.showMessage(title, message, QSystemTrayIcon.MessageIcon.Information, msec)
        except (RuntimeError, AttributeError):
            pass

    # ------------------------------------------------------------------ رویداد
    def _on_activated(self, reason) -> None:
        if reason in (QSystemTrayIcon.ActivationReason.Trigger,
                      QSystemTrayIcon.ActivationReason.DoubleClick):
            self.show_requested.emit()
