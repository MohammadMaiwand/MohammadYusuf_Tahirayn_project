"""موتور کلیک ایمن روی ویندوز با استفاده از Windows API (SendInput).

از این موتور برای فشردن دکمهٔ پاسخ استفاده می‌شود. کلیک دقیقاً در مرکز دکمهٔ
شناسایی‌شده انجام می‌شود و در پایان (به‌صورت اختیاری) نشانگر ماوس به جای
اولیهٔ کاربر برمی‌گردد تا کار روزمرهٔ او مختل نشود.
"""

from __future__ import annotations

import ctypes
import sys
import threading
import time
from ctypes import wintypes

from .winutils import cursor_position, set_cursor_position, virtual_screen_rect

user32 = ctypes.windll.user32 if sys.platform == "win32" else None

INPUT_MOUSE = 0
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000

_BUTTON_FLAGS = {
    "left": (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
    "right": (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
    "middle": (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
}


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_void_p),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_void_p),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD), ("wParamH", wintypes.WORD)]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("union", _INPUTUNION)]


class ClickError(RuntimeError):
    """خطا در انجام کلیک."""


class ClickEngine:
    """انجام کلیک‌های ایمن و کنترل‌شده."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._stop_flag = threading.Event()
        self.last_click_time: float = 0.0
        self.last_click_point: tuple[int, int] = (0, 0)
        self.click_count = 0
        self.fail_count = 0
        self._press_delay = 0.015
        self._move_settle = 0.008

    # ------------------------------------------------------------------ کنترل
    def request_stop(self) -> None:
        """توقف اضطراری: هیچ کلیک دیگری انجام نمی‌شود."""
        self._stop_flag.set()

    def reset_stop(self) -> None:
        self._stop_flag.clear()

    @property
    def stopped(self) -> bool:
        return self._stop_flag.is_set()

    # ------------------------------------------------------------------- کلیک
    def click(
        self,
        x: int,
        y: int,
        button: str = "left",
        double: bool = False,
        restore_cursor: bool = True,
    ) -> bool:
        """کلیک در مختصات مطلق صفحه. خروجی True در صورت موفقیت."""
        if user32 is None:
            raise ClickError("این قابلیت فقط روی ویندوز در دسترس است.")
        if self._stop_flag.is_set():
            raise ClickError("کلیک اضطراری متوقف شده است.")
        with self._lock:
            original = cursor_position() if restore_cursor else None
            down_flag, up_flag = _BUTTON_FLAGS.get(button, _BUTTON_FLAGS["left"])
            try:
                set_cursor_position(int(x), int(y))
                time.sleep(self._move_settle)
                rounds = 2 if double else 1
                for _ in range(rounds):
                    if self._send_flags(down_flag) != 1:
                        raise ClickError("ارسال رویداد فشردن ماوس ناموفق بود.")
                    time.sleep(self._press_delay)
                    if self._send_flags(up_flag) != 1:
                        raise ClickError("ارسال رویداد رهاشدن ماوس ناموفق بود.")
                    time.sleep(self._press_delay)
            except ClickError:
                self.fail_count += 1
                raise
            finally:
                if original is not None:
                    time.sleep(0.012)
                    set_cursor_position(original[0], original[1])
            self.click_count += 1
            self.last_click_time = time.time()
            self.last_click_point = (int(x), int(y))
            return True

    def click_absolute_normalized(self, x: int, y: int, button: str = "left") -> bool:
        """کلیک با روش نرمال‌شدهٔ SendInput (برای محیط‌هایی که SetCursorPos کافی نیست)."""
        if user32 is None:
            raise ClickError("این قابلیت فقط روی ویندوز در دسترس است.")
        left, top, width, height = virtual_screen_rect()
        norm_x = int((int(x) - left) * 65535 / max(1, width - 1))
        norm_y = int((int(y) - top) * 65535 / max(1, height - 1))
        down_flag, up_flag = _BUTTON_FLAGS.get(button, _BUTTON_FLAGS["left"])
        inputs = (INPUT * 3)(
            self._mouse_input(norm_x, norm_y, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
            self._mouse_input(norm_x, norm_y, down_flag | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
            self._mouse_input(norm_x, norm_y, up_flag | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
        )
        sent = user32.SendInput(3, inputs, ctypes.sizeof(INPUT))
        if sent != 3:
            raise ClickError("SendInput ناموفق بود.")
        self.click_count += 1
        self.last_click_time = time.time()
        return True

    # ------------------------------------------------------------------ کمکی
    def move_to(self, x: int, y: int) -> None:
        """جابه‌جایی نشانگر بدون کلیک (برای نمایش نقطهٔ تشخیص در آزمون)."""
        if user32 is None:
            return
        set_cursor_position(int(x), int(y))

    def hover_test(self, x: int, y: int, restore: bool = True) -> None:
        """نمایش سریع نقطهٔ تشخیص به کاربر بدون فشردن دکمه."""
        if user32 is None:
            return
        original = cursor_position() if restore else None
        set_cursor_position(int(x), int(y))
        time.sleep(0.25)
        if original is not None:
            set_cursor_position(original[0], original[1])

    @staticmethod
    def _mouse_input(dx: int, dy: int, flags: int) -> INPUT:
        return INPUT(type=INPUT_MOUSE, union=_INPUTUNION(mi=MOUSEINPUT(dx, dy, 0, flags, 0, None)))

    def _send_flags(self, flags: int) -> int:
        inputs = (INPUT * 1)(self._mouse_input(0, 0, flags))
        return int(user32.SendInput(1, inputs, ctypes.sizeof(INPUT)))

    # -------------------------------------------------------------- اطلاعات
    def statistics(self) -> dict:
        return {
            "clicks": self.click_count,
            "failures": self.fail_count,
            "last_click_time": self.last_click_time,
            "last_click_point": self.last_click_point,
        }
