"""مسیرهای پروژه و مدیریت پوشه‌ها.

این ماژول مسیرهای اپلیکیشن را در دو حالت «کد اجرایی» و «فایل اجرایی بسته‌بندی‌شده»
به‌صورت یکسان برمی‌گرداند تا برنامه در هر کمپیوتری به‌سادگی کار کند.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

APP_NAME = "SmartAutoAnswer"
APP_TITLE_EN = "SMART AUTO ANSWER"
APP_TITLE_FA = "پاسخ‌دهندهٔ هوشمند تماس"


def is_frozen() -> bool:
    """آیا برنامه به‌صورت فایل اجرایی بسته‌بندی‌شده در حال اجراست؟"""
    return bool(getattr(sys, "frozen", False))


def bundle_dir() -> Path:
    """پوشهٔ منابع همراه (داخل بستهٔ اجرایی یا ریشهٔ پروژه)."""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent.parent


def app_dir() -> Path:
    """پوشهٔ کاری برنامه: کنار فایل اجرایی یا ریشهٔ پروژه."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def config_dir() -> Path:
    return app_dir() / "config"


def logs_dir() -> Path:
    return app_dir() / "logs"


def assets_dir() -> Path:
    return app_dir() / "assets"


def icons_dir() -> Path:
    return assets_dir() / "icons"


def templates_dir() -> Path:
    return assets_dir() / "answer_templates"


def exports_dir() -> Path:
    return app_dir() / "exports"


def settings_file() -> Path:
    return config_dir() / "settings.json"


def app_icon_file() -> Path:
    return icons_dir() / "app.ico"


def ensure_directories() -> None:
    """ساخت تمام پوشه‌های لازم در اولین اجرا."""
    for folder in (config_dir(), logs_dir(), icons_dir(), templates_dir(), exports_dir()):
        folder.mkdir(parents=True, exist_ok=True)


def ensure_default_assets() -> None:
    """کپی منابع پیش‌فرض از بستهٔ اجرایی به پوشهٔ کاربر (فقط اگر وجود نداشته باشد)."""
    ensure_directories()
    src_assets = bundle_dir() / "assets"
    if src_assets.resolve() == assets_dir().resolve() or not src_assets.exists():
        return
    for item in src_assets.rglob("*"):
        if item.is_dir():
            continue
        target = assets_dir() / item.relative_to(src_assets)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            try:
                shutil.copy2(item, target)
            except OSError:
                pass
