"""مدیر میان‌برهای کلیدی سراسری ویندوز (RegisterHotKey).

میان‌برها حتی زمانی که برنامهٔ دیگری فعال است نیز کار می‌کنند.
"""

from __future__ import annotations

import ctypes
import sys
import threading
from ctypes import wintypes

from PySide6.QtCore import QThread, Signal

user32 = ctypes.windll.user32 if sys.platform == "win32" else None
kernel32 = ctypes.windll.kernel32 if sys.platform == "win32" else None

WM_HOTKEY = 0x0312
WM_APP_RELOAD = 0x8000 + 11   # پیام اختصاصی برای بازخوانی میان‌برها
WM_APP_QUIT = 0x8000 + 12

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

_MODIFIER_ALIASES = {
    "ctrl": MOD_CONTROL, "control": MOD_CONTROL, "کنترل": MOD_CONTROL,
    "alt": MOD_ALT, "آلت": MOD_ALT,
    "shift": MOD_SHIFT, "شیفت": MOD_SHIFT,
    "win": MOD_WIN, "windows": MOD_WIN, "سوپر": MOD_WIN,
    "super": MOD_WIN, "meta": MOD_WIN,
}

_NAMED_KEYS = {
    "ENTER": 0x0D, "RETURN": 0x0D, "TAB": 0x09, "SPACE": 0x20, "ESC": 0x1B,
    "ESCAPE": 0x1B, "BACKSPACE": 0x08, "INSERT": 0x2D, "DELETE": 0x2E, "DEL": 0x2E,
    "HOME": 0x24, "END": 0x23, "PAGEUP": 0x21, "PAGEDOWN": 0x22, "PGUP": 0x21, "PGDN": 0x22,
    "LEFT": 0x25, "UP": 0x26, "RIGHT": 0x27, "DOWN": 0x28, "PRINTSCREEN": 0x2C,
    "NUMLOCK": 0x90, "SCROLLLOCK": 0x91, "PAUSE": 0x13, "CAPSLOCK": 0x14,
}


def parse_hotkey(text: str) -> tuple[int, int] | None:
    """تبدیل رشتهٔ میان‌بر به (modifiers, virtual_key). مثال: 'Ctrl+Shift+F8'"""
    if not text or not str(text).strip():
        return None
    modifiers = 0
    virtual_key = 0
    parts = [part.strip() for part in str(text).replace("-", "+").split("+") if part.strip()]
    if not parts:
        return None
    for part in parts:
        lowered = part.lower()
        if lowered in _MODIFIER_ALIASES:
            modifiers |= _MODIFIER_ALIASES[lowered]
            continue
        upper = part.upper()
        if upper.startswith("F") and upper[1:].isdigit():
            number = int(upper[1:])
            if 1 <= number <= 24:
                virtual_key = 0x70 + number - 1
                continue
        if upper in _NAMED_KEYS:
            virtual_key = _NAMED_KEYS[upper]
            continue
        if len(part) == 1 and part.isalpha():
            virtual_key = ord(part.upper())
            continue
        if len(part) == 1 and part.isdigit():
            virtual_key = ord(part)
            continue
        return None
    if virtual_key == 0:
        return None
    return modifiers, virtual_key


def format_hotkey(text: str) -> str:
    """نمایش یکسان‌شدهٔ میان‌بر برای رابط کاربری."""
    parsed = parse_hotkey(text)
    if parsed is None:
        return str(text)
    modifiers, virtual_key = parsed
    names = []
    if modifiers & MOD_CONTROL:
        names.append("Ctrl")
    if modifiers & MOD_ALT:
        names.append("Alt")
    if modifiers & MOD_SHIFT:
        names.append("Shift")
    if modifiers & MOD_WIN:
        names.append("Win")
    if 0x70 <= virtual_key <= 0x87:
        names.append(f"F{virtual_key - 0x70 + 1}")
    elif 0x41 <= virtual_key <= 0x5A:
        names.append(chr(virtual_key))
    elif 0x30 <= virtual_key <= 0x39:
        names.append(chr(virtual_key))
    else:
        reverse = {value: key.title() for key, value in _NAMED_KEYS.items()}
        names.append(reverse.get(virtual_key, f"0x{virtual_key:02X}"))
    return "+".join(names)


class ShortcutManager(QThread):
    """ثبت و پیگیری میان‌برهای سراسری در یک رشتهٔ اختصاصی."""

    triggered = Signal(str)                 # نام عملیات
    registration_failed = Signal(str, str)  # عملیات، کلید
    registration_done = Signal(dict)        # وضعیت نهایی ثبت

    def __init__(self, mapping: dict[str, str], enabled: bool = True) -> None:
        super().__init__()
        self._mapping = dict(mapping or {})
        self._lock = threading.RLock()
        self._enabled = enabled
        self._thread_id = 0
        self._running = False
        self._reload_requested = False

    # ------------------------------------------------------------------ عمومی
    def set_mapping(self, mapping: dict[str, str], enabled: bool | None = None) -> None:
        with self._lock:
            self._mapping = dict(mapping or {})
            if enabled is not None:
                self._enabled = enabled
            self._reload_requested = True
            thread_id = self._thread_id
        if thread_id and user32 is not None:
            user32.PostThreadMessageW(thread_id, WM_APP_RELOAD, 0, 0)

    def stop(self) -> None:
        """توقف رشته و آزادکردن میان‌برها."""
        self._running = False
        thread_id = self._thread_id
        if thread_id and user32 is not None:
            user32.PostThreadMessageW(thread_id, WM_APP_QUIT, 0, 0)

    # ------------------------------------------------------------------ رشته
    def run(self) -> None:  # noqa: C901
        if user32 is None:
            self.registration_done.emit({})
            return
        self._running = True
        self._thread_id = int(kernel32.GetCurrentThreadId())
        status: dict[str, str] = {}
        try:
            self._unregister_all()
            status = self._register_all()
        finally:
            if status:
                self.registration_done.emit(status)

        message = wintypes.MSG()
        while self._running:
            result = user32.GetMessageW(ctypes.byref(message), None, 0, 0)
            if result in (0, -1):
                break
            if message.message == WM_HOTKEY:
                action = self._action_for_id(int(message.wParam))
                if action:
                    self.triggered.emit(action)
            elif message.message == WM_APP_RELOAD:
                self._unregister_all()
                updated = self._register_all()
                if updated:
                    self.registration_done.emit(updated)
            elif message.message == WM_APP_QUIT:
                break
        self._unregister_all()
        self.registration_done.emit({})
        self._thread_id = 0

    # ------------------------------------------------------------------ داخلی
    def _action_for_id(self, hotkey_id: int) -> str:
        with self._lock:
            for index, action in enumerate(self._current_actions(), start=1):
                if index == hotkey_id:
                    return action
        return ""

    def _current_actions(self) -> list[str]:
        return sorted(self._mapping.keys())

    def _register_all(self) -> dict[str, str]:
        """ثبت همهٔ میان‌برها و برگرداندن وضعیت آن‌ها."""
        status: dict[str, str] = {}
        with self._lock:
            mapping = dict(self._mapping)
            enabled = self._enabled
        for index, action in enumerate(sorted(mapping.keys()), start=1):
            key_text = mapping.get(action, "")
            if not enabled or not key_text:
                status[action] = "غیرفعال"
                continue
            parsed = parse_hotkey(key_text)
            if parsed is None:
                status[action] = "نامعتبر"
                self.registration_failed.emit(action, key_text)
                continue
            modifiers, virtual_key = parsed
            ok = bool(user32.RegisterHotKey(None, index, modifiers | MOD_NOREPEAT, virtual_key))
            if ok:
                status[action] = format_hotkey(key_text)
            else:
                status[action] = "در تضاد با برنامهٔ دیگر"
                self.registration_failed.emit(action, key_text)
        return status

    def _unregister_all(self) -> None:
        if user32 is None:
            return
        with self._lock:
            count = max(len(self._mapping), 1)
        for index in range(1, count + 4):
            try:
                user32.UnregisterHotKey(None, index)
            except Exception:
                pass
