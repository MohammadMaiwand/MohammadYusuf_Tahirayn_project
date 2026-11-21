"""ابزارهای ویندوز: DPI، تک‌نسخه‌ای، اجرای خودکار با ویندوز و اطلاعات نمایشگر."""

from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from pathlib import Path

user32 = ctypes.windll.user32 if sys.platform == "win32" else None
kernel32 = ctypes.windll.kernel32 if sys.platform == "win32" else None

# --- ثابت‌های ویندوز ---
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79
SM_CMONITORS = 80

DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = ctypes.c_void_p(-4)

_MUTEX_HANDLE = None


class RECT(ctypes.Structure):
    _fields_ = [("left", wintypes.LONG), ("top", wintypes.LONG),
                ("right", wintypes.LONG), ("bottom", wintypes.LONG)]


class RECT_64(ctypes.Structure):
    """ساختار RECT برای DwmGetWindowAttribute (LONG در حالت ۶۴بیتی ۳۲بیت است)."""

    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                ("right", ctypes.c_long), ("bottom", ctypes.c_long)]


def enable_dpi_awareness() -> bool:
    """فعال‌سازی آگاهی از DPI تا مختصات صفحه با پیکسل‌های واقعی یکی باشند."""
    if sys.platform != "win32":
        return False
    try:
        # ویندوز ۱۰ نسخهٔ ۱۷۰۳ و بالاتر
        if user32.SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2):
            return True
    except Exception:
        pass
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
        return True
    except Exception:
        pass
    try:
        user32.SetProcessDPIAware()
        return True
    except Exception:
        return False


def acquire_single_instance(name: str = "Local\\SmartAutoAnswer_SingleInstance") -> bool:
    """تلاش برای گرفتن قفل تک‌نسخه‌ای. اگر برنامهٔ دیگری اجراست False برمی‌گرداند."""
    global _MUTEX_HANDLE
    if sys.platform != "win32":
        return True
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    handle = kernel32.CreateMutexW(None, True, name)
    if not handle:
        return True
    already_exists = kernel32.GetLastError() == 183  # ERROR_ALREADY_EXISTS
    if already_exists:
        kernel32.CloseHandle(handle)
        return False
    _MUTEX_HANDLE = handle
    return True


def focus_existing_instance(title_part: str = "SMART AUTO ANSWER") -> bool:
    """تلاش برای آوردن پنجرهٔ نسخهٔ در حال اجرای برنامه به جلو (حتی اگر در نوار وظیفه باشد)."""
    if sys.platform != "win32":
        return False
    found: list[int] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def _enum(hwnd, _lparam):  # type: ignore[no-untyped-def]
        # پنجره‌های پنهان (نوار وظیفه) هم بررسی می‌شوند تا برنامه واقعاً به جلو بیاید
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        if title_part.lower() in buf.value.lower():
            found.append(hwnd)
            return False
        return True

    user32.EnumWindows(_enum, 0)
    if not found:
        return False
    hwnd = found[0]
    user32.ShowWindow(hwnd, 9)   # SW_RESTORE
    user32.ShowWindow(hwnd, 5)   # SW_SHOW
    # ترفند استاندارد ویندوز برای آوردن پنجره به جلو از یک پروسهٔ دیگر
    HWND_TOPMOST, HWND_NOTOPMOST = -1, -2
    flags = 0x0001 | 0x0002      # SWP_NOSIZE | SWP_NOMOVE
    user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, flags)
    user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, flags)
    user32.SetForegroundWindow(hwnd)
    return True


# --- رویداد نام‌دار «نمایش پنجره» برای اطلاع‌رسانی به نسخهٔ در حال اجرا ---
_SHOW_EVENT_NAME = r"Local\SmartAutoAnswer_ShowEvent"
_SHOW_EVENT_HANDLE = None
_EVENT_MODIFY_STATE = 0x0002
_WAIT_OBJECT_0 = 0


def create_show_signal() -> bool:
    """ساخت رویداد نام‌دار (توسط نسخهٔ اول برنامه در زمان راه‌اندازی)."""
    global _SHOW_EVENT_HANDLE
    if sys.platform != "win32":
        return False
    try:
        kernel32.CreateEventW.restype = wintypes.HANDLE
        kernel32.CreateEventW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR]
        handle = kernel32.CreateEventW(None, True, False, _SHOW_EVENT_NAME)
    except Exception:
        return False
    if not handle:
        return False
    _SHOW_EVENT_HANDLE = handle
    return True


def signal_show_existing() -> bool:
    """روشن‌کردن رویداد «نمایش پنجره» (توسط نسخهٔ دوم برنامه و سپس خروج)."""
    if sys.platform != "win32":
        return False
    try:
        kernel32.OpenEventW.restype = wintypes.HANDLE
        kernel32.OpenEventW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
        handle = kernel32.OpenEventW(_EVENT_MODIFY_STATE, False, _SHOW_EVENT_NAME)
        if not handle:
            return False
        kernel32.SetEvent(handle)
        kernel32.CloseHandle(handle)
        return True
    except Exception:
        return False


def consume_show_signal() -> bool:
    """بررسی و پاک‌کردن رویداد نمایش (در نسخهٔ در حال اجرا)."""
    handle = _SHOW_EVENT_HANDLE
    if handle is None or sys.platform != "win32":
        return False
    try:
        if kernel32.WaitForSingleObject(handle, 0) == _WAIT_OBJECT_0:
            kernel32.ResetEvent(handle)
            return True
    except Exception:
        return False
    return False


def virtual_screen_rect() -> tuple[int, int, int, int]:
    """مستطیل کل صفحهٔ مجازی چندصفحه‌ای: (left, top, width, height)."""
    if sys.platform != "win32":
        return (0, 0, 1920, 1080)
    left = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
    top = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
    width = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
    height = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
    if width <= 0 or height <= 0:
        return (0, 0, 1920, 1080)
    return (left, top, width, height)


def primary_screen_size() -> tuple[int, int]:
    if sys.platform != "win32":
        return (1920, 1080)
    return (user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))


def monitor_count() -> int:
    if sys.platform != "win32":
        return 1
    return max(1, int(user32.GetSystemMetrics(SM_CMONITORS)))


def window_rect(hwnd: int) -> tuple[int, int, int, int] | None:
    """مستطیل پنجره بر اساس دستگیرهٔ آن، در مختصات پیکسلی واقعی صفحه.

    از این ناحیه برای کنارگذاشتن پنجرهٔ خود برنامه از تشخیص استفاده می‌شود.
    """
    if sys.platform != "win32" or not hwnd:
        return None
    rect = RECT()
    try:
        if not user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect)):
            return None
    except Exception:
        return None
    width = int(rect.right - rect.left)
    height = int(rect.bottom - rect.top)
    if width <= 0 or height <= 0:
        return None
    return (int(rect.left), int(rect.top), width, height)


# --- کنارگذاشتن پنجره از تصویربرداری صفحه (تا پنجرهٔ خود برنامه دکمهٔ پاسخ شمرده نشود) ---
WDA_NONE = 0x00000000
WDA_MONITOR = 0x00000001
WDA_EXCLUDEFROMCAPTURE = 0x00000011


def exclude_from_capture(hwnd: int, enable: bool = True) -> bool:
    """پنهان‌کردن پنجره از تصویربرداری صفحه.

    اگر پشتیبانی شود True برمی‌گرداند؛ در این حالت پنجرهٔ برنامه در تصویر گرفته‌شده
    (حتی وقتی روی سایر پنجره‌ها قرار دارد) دیده نمی‌شود.
    """
    if sys.platform != "win32" or not hwnd:
        return False
    try:
        handle = wintypes.HWND(hwnd)
        if not enable:
            return bool(user32.SetWindowDisplayAffinity(handle, WDA_NONE))
        # ویندوز ۱۰ نسخهٔ ۲۰۰۴ و بالاتر: پنجره کاملاً از تصویر حذف می‌شود
        if user32.SetWindowDisplayAffinity(handle, WDA_EXCLUDEFROMCAPTURE):
            return True
        # نسخه‌های قدیمی‌تر: محتوای پنجره در تصویر سیاه دیده می‌شود
        return bool(user32.SetWindowDisplayAffinity(handle, WDA_MONITOR))
    except Exception:
        return False


def foreground_window_title() -> str:
    if sys.platform != "win32":
        return ""
    hwnd = user32.GetForegroundWindow()
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value


def cursor_position() -> tuple[int, int]:
    if sys.platform != "win32":
        return (0, 0)
    point = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(point))
    return (int(point.x), int(point.y))


def set_cursor_position(x: int, y: int) -> None:
    if sys.platform != "win32":
        return
    user32.SetCursorPos(int(x), int(y))


# --- کنترل صدای سیستم (بلندکردن خودکار هنگام زنگ تماس) ---
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
KEYEVENTF_KEYUP = 0x0002


def _tap_key(vk: int) -> None:
    """شبیه‌سازی یک بار فشردن و رهاشدن کلید."""
    user32.keybd_event(int(vk), 0, 0, 0)
    user32.keybd_event(int(vk), 0, KEYEVENTF_KEYUP, 0)


def boost_system_volume(percent: int = 100) -> bool:
    """بلندکردن صدای سیستم تا درصد دلخواه.

    روی ویندوز هر فشار کلید «افزایش صدا» حدود ۲ درصد صدا را بالا می‌برد و
    اگر سیستم بی‌صدا (Mute) باشد آن را نیز باز می‌کند. پس برای رسیدن به درصد
    هدف همان تعداد فشار فرستاده می‌شود. این روش به هیچ کتابخانهٔ بیرونی نیاز
    ندارد و روی همهٔ نسخه‌های ویندوز کار می‌کند.
    """
    if sys.platform != "win32":
        return False
    percent = max(1, min(100, int(percent)))
    presses = max(1, int(round(percent / 2.0)))
    try:
        for _ in range(presses):
            _tap_key(VK_VOLUME_UP)
        return True
    except Exception:
        return False


def lower_system_volume(percent: int = 20) -> bool:
    """کم‌کردن صدای سیستم تا درصد دلخواه (برای بازگرداندن سطح صدا)."""
    if sys.platform != "win32":
        return False
    percent = max(1, min(100, int(percent)))
    steps = max(1, int(round((100 - percent) / 2.0)))
    try:
        for _ in range(steps):
            _tap_key(VK_VOLUME_DOWN)
        return True
    except Exception:
        return False


# --- اجرای خودکار همراه ویندوز (کلید Run در رجیستری کاربر) ---
_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def _startup_command() -> str:
    if getattr(sys, "frozen", False):
        return f'"{Path(sys.executable).resolve()}" --tray'
    script = Path(__file__).resolve().parent.parent / "main.py"
    return f'"{sys.executable}" "{script}" --tray'


def set_startup_enabled(enabled: bool) -> bool:
    """ثبت/حذف اجرای خودکار برنامه در زمان روشن‌شدن ویندوز."""
    if sys.platform != "win32":
        return False
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enabled:
                winreg.SetValueEx(key, "SmartAutoAnswer", 0, winreg.REG_SZ, _startup_command())
            else:
                try:
                    winreg.DeleteValue(key, "SmartAutoAnswer")
                except FileNotFoundError:
                    pass
        return True
    except OSError:
        return False


def is_startup_enabled() -> bool:
    if sys.platform != "win32":
        return False
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, "SmartAutoAnswer")
            return True
    except OSError:
        return False
