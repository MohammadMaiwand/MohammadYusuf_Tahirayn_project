"""سرویس اعلان: پیام رومیزی (Tray) و صدای هشدار."""

from __future__ import annotations

import sys
import threading
import time

from PySide6.QtCore import QObject

try:
    import winsound
except ImportError:  # سیستم‌های غیر ویندوز
    winsound = None  # type: ignore[assignment]

SOUND_DEFAULT = "default"
SOUND_DETECT = "detect"
SOUND_ANSWER = "answer"
SOUND_ERROR = "error"
SOUND_START = "start"
SOUND_STOP = "stop"
SOUND_RING = "ring"


class NotificationService(QObject):
    """نمایش اعلان و پخش صدا با امکان خاموش‌کردن کامل."""

    def __init__(self, tray=None) -> None:
        super().__init__()
        self._tray = tray
        self.notifications_enabled = True
        self.sound_enabled = True
        self._window = None

    def attach_tray(self, tray) -> None:
        self._tray = tray

    def attach_window(self, window) -> None:
        """پنجرهٔ اصلی برای نمایش نوار وضعیت (در صورت نبود Tray)."""
        self._window = window

    # ------------------------------------------------------------------ اعلان
    def notify(self, title: str, message: str, level: str = "info", msec: int = 4000) -> None:
        """نمایش یک اعلان (نه چند نسخهٔ هم‌زمان و تکراری).

        اگر پنجرهٔ برنامه دیده می‌شود، پیام شناور داخل برنامه نشان داده می‌شود؛
        در غیر این صورت اعلان نوار وظیفهٔ ویندوز. این‌گونه پیام تکراری پخش نمی‌شود.
        """
        if not self.notifications_enabled:
            return
        window = self._window
        window_visible = False
        if window is not None:
            try:
                window_visible = window.isVisible() and not window.isMinimized()
            except (RuntimeError, AttributeError):
                window_visible = False
        if window_visible:
            try:
                window.show_toast(title, message, level, msec)
                return
            except (RuntimeError, AttributeError):
                pass
        try:
            if self._tray is not None and self._tray.isVisible():
                from PySide6.QtWidgets import QSystemTrayIcon

                icon_map = {
                    "info": QSystemTrayIcon.MessageIcon.Information,
                    "warn": QSystemTrayIcon.MessageIcon.Warning,
                    "error": QSystemTrayIcon.MessageIcon.Critical,
                    "success": QSystemTrayIcon.MessageIcon.Information,
                }
                self._tray.showMessage(
                    title, message, icon_map.get(level, QSystemTrayIcon.MessageIcon.Information), msec
                )
        except (RuntimeError, AttributeError):
            pass

    def monitoring_started(self) -> None:
        self.notify("SMART AUTO ANSWER", "پایش تماس‌ها آغاز شد.", "success")
        self.play(SOUND_START)

    def monitoring_stopped(self) -> None:
        self.notify("SMART AUTO ANSWER", "پایش تماس‌ها متوقف شد.", "warn")
        self.play(SOUND_STOP)

    def call_detected(self, confidence_text: str = "") -> None:
        message = "یک تماس ورودی شناسایی شد."
        if confidence_text:
            message += f" ({confidence_text})"
        self.notify("تماس ورودی", message, "info")
        self.play(SOUND_DETECT)

    def call_answered(self) -> None:
        self.notify("تماس پاسخ داده شد", "دکمهٔ پاسخ با کلیک خودکار فشرده شد.", "success")
        self.play(SOUND_ANSWER)

    def detection_error(self, message: str) -> None:
        self.notify("خطای تشخیص", message, "error")
        self.play(SOUND_ERROR)

    def auto_click_toggled(self, enabled: bool) -> None:
        self.notify("کلیک خودکار", "فعال شد." if enabled else "غیرفعال شد.",
                    "success" if enabled else "warn")

    # -------------------------------------------------------------------- صدا
    def play(self, kind: str = SOUND_DEFAULT) -> None:
        if not self.sound_enabled or winsound is None:
            return
        self._play_kind(kind)

    def play_ring(self, force: bool = True) -> bool:
        """پخش زنگ تماس برای آزمون صدا. در صورت نبود پشتیبانی False برمی‌گرداند."""
        if winsound is None:
            return False
        if not force and not self.sound_enabled:
            return False
        self._play_kind(SOUND_RING)
        return True

    def _play_kind(self, kind: str) -> None:
        def _beep() -> None:
            try:
                if kind == SOUND_DETECT:
                    winsound.MessageBeep(winsound.MB_ICONASTERISK)
                elif kind == SOUND_ANSWER:
                    winsound.MessageBeep(winsound.MB_OK)
                elif kind == SOUND_ERROR:
                    winsound.MessageBeep(winsound.MB_ICONHAND)
                elif kind == SOUND_START:
                    winsound.Beep(880, 90)
                    winsound.Beep(1180, 110)
                elif kind == SOUND_STOP:
                    winsound.Beep(700, 90)
                    winsound.Beep(480, 130)
                elif kind == SOUND_RING:
                    # زنگ تماس: دو دستهٔ سه‌زنگی متناوب (مثل زنگ تلفن)
                    for _ in range(2):
                        for frequency in (1046, 1318, 1046):
                            winsound.Beep(frequency, 160)
                        time.sleep(0.14)
                else:
                    winsound.MessageBeep(winsound.MB_OK)
            except Exception:
                pass

        threading.Thread(target=_beep, daemon=True).start()
