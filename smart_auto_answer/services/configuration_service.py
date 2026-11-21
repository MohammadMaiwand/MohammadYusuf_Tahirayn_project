"""سرویس تنظیمات: بارگذاری، اعتبارسنجی و ذخیرهٔ خودکار در config/settings.json."""

from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from PySide6.QtCore import QObject, Signal

SETTINGS_VERSION = 2

# مقادیر پیش‌فرض نسخهٔ ۱ (برای مهاجرت خودکار و سبک‌سازی مصرف پردازنده)
_LEGACY_V1_SCALE = {"scale_min": 0.70, "scale_max": 1.35, "scale_steps": 9}

DEFAULT_SETTINGS: dict[str, Any] = {
    "version": SETTINGS_VERSION,
    "general": {
        "start_monitoring_on_launch": True,
        "auto_click_enabled": True,
        "minimize_to_tray": True,
        "close_to_tray": True,
        "ask_on_close": True,
        "launch_at_windows_startup": False,
        "sound_enabled": True,
        "notifications_enabled": True,
        # هنگام زنگ تماس، صدای سیستم خودکار تا این درصد بلند شود
        "boost_volume_on_call": True,
        "call_volume_percent": 100,
        "ui_language": "fa",
    },
    "detection": {
        # پایش سریع و پاسخ فوری به‌محض زنگ‌خوردن تماس
        "interval_ms": 150,
        "turbo_mode": True,
        "turbo_interval_ms": 60,
        # آستانهٔ پایین تا دکمهٔ پاسخ بدون شرط سخت‌گیرانه شناسایی شود
        "confidence": 0.55,
        "grayscale": True,
        "scale_min": 0.75,
        "scale_max": 1.30,
        "scale_steps": 5,
        "smart_idle": True,
        "idle_interval_ms": 400,
        "static_diff_threshold": 1.2,
        "force_scan_ms": 1200,
        "region": {"left": 0, "top": 0, "width": 0, "height": 0},
        "modes": {"template": True, "color": True, "text": True},
        # تشخیص رنگ سخاوتمندانه: هر دکمهٔ سبز گرد (قبول/پاسخ) کافی است؛
        # اندازه و رنگ دقیق دکمه شرط سخت نیست.
        "color": {
            "hex": "#25D366",
            "tolerance": 55,
            "min_area": 400,
            "max_area": 400000,
            "min_aspect": 0.5,
            "max_aspect": 3.0,
            # حداقل ضلع ناحیهٔ رنگی: آیکون‌های ریز نوار وظیفه/ابزار (۲۴ پیکسل)
            # نباید به‌عنوان دکمهٔ پاسخ شناسایی شوند.
            "min_side": 32,
        },
        "text": {
            "keywords": ["answer", "accept", "accept call", "answer call", "join", "pick up",
                         "پاسخ", "قبول", "جواب"],
            "similarity": 0.50,
            # متن پنهان در متن عادی صفحه (کد/سند) نباید کلیک ایجاد کند؛ پس تشخیص
            # متنی فقط با تأیید یک دکمهٔ رنگی یا قالب ثبت‌شده پذیرفته می‌شود.
            "require_button_confirmation": True,
            "min_word_height": 8,
            "min_interval_ms": 150,
        },
    },
    "click": {
        "cooldown_ms": 3000,
        "restore_cursor": True,
        "double_click": False,
        "max_clicks_per_minute": 15,
        "release_frames": 3,
        "verify_before_click": True,
    },
    "shortcuts": {
        "enabled": True,
        "start": "F8",
        "stop": "F9",
        "toggle_auto": "F10",
        "panic": "F12",
    },
    "ui": {
        "mode": "dark",
        "window_width": 1180,
        "window_height": 780,
        "live_preview": True,
    },
}

# محدوده‌های مجاز برای اعتبارسنجی
_CLAMPS: dict[str, tuple[float, float]] = {
    "general.call_volume_percent": (1, 100),
    "detection.interval_ms": (50, 5000),
    "detection.turbo_interval_ms": (40, 1000),
    "detection.confidence": (0.30, 0.99),
    "detection.scale_min": (0.30, 1.0),
    "detection.scale_max": (1.0, 2.5),
    "detection.scale_steps": (1, 21),
    "detection.idle_interval_ms": (100, 5000),
    "detection.static_diff_threshold": (0.1, 20.0),
    "detection.force_scan_ms": (500, 60000),
    "detection.color.tolerance": (1, 120),
    "detection.color.min_area": (50, 5000000),
    "detection.color.max_area": (100, 5000000),
    "detection.color.min_aspect": (0.1, 50.0),
    "detection.color.max_aspect": (0.1, 50.0),
    "detection.text.similarity": (0.30, 1.0),
    "detection.text.min_word_height": (4, 200),
    "detection.text.min_interval_ms": (60, 5000),
    "click.cooldown_ms": (200, 60000),
    "click.max_clicks_per_minute": (1, 240),
    "click.release_frames": (1, 30),
    "ui.window_width": (900, 4000),
    "ui.window_height": (600, 3000),
}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """ادغام عمیق: مقادیر پیش‌فرض را حفظ می‌کند و تنظیمات کاربر را روی آن می‌گذارد."""
    result = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


class ConfigurationService(QObject):
    """مدیریت تنظیمات با ذخیرهٔ خودکار و امن."""

    setting_changed = Signal(str, object)   # کلید نقطه‌ای، مقدار جدید
    settings_reloaded = Signal()

    def __init__(self, settings_path: Path) -> None:
        super().__init__()
        self._path = Path(settings_path)
        self._lock = threading.RLock()
        self._data: dict[str, Any] = copy.deepcopy(DEFAULT_SETTINGS)
        self.load()

    # -------------------------------------------------------------- بارگذاری
    def load(self) -> None:
        """بارگذاری تنظیمات از فایل؛ در صورت خرابی، پیش‌فرض‌ها استفاده می‌شوند."""
        loaded: dict[str, Any] = {}
        if self._path.exists():
            try:
                raw = self._path.read_text(encoding="utf-8")
                parsed = json.loads(raw) if raw.strip() else {}
                if isinstance(parsed, dict):
                    loaded = parsed
            except (OSError, json.JSONDecodeError):
                loaded = {}
        merged = _deep_merge(DEFAULT_SETTINGS, loaded)
        self._data = self._sanitize(self._migrate(merged))
        self.save()
        self.settings_reloaded.emit()

    @staticmethod
    def _migrate(data: dict[str, Any]) -> dict[str, Any]:
        """مهاجرت تنظیمات نسخه‌های قدیمی به ساختار جدید."""
        try:
            version = int(data.get("version", 0) or 0)
        except (TypeError, ValueError):
            version = 0
        if version < 2:
            detection = data.get("detection")
            # اگر بازهٔ مقیاس دست‌نخورده (پیش‌فرض نسخهٔ ۱) ماند، به پیش‌فرض سبک‌تر منتقل می‌شود
            if isinstance(detection, dict):
                for key, legacy in _LEGACY_V1_SCALE.items():
                    if detection.get(key) == legacy:
                        detection[key] = DEFAULT_SETTINGS["detection"][key]
            data["version"] = SETTINGS_VERSION
        return data

    def _sanitize(self, data: dict[str, Any]) -> dict[str, Any]:
        for key, (low, high) in _CLAMPS.items():
            value = self.get_in(data, key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                clamped = max(low, min(high, value))
                if isinstance(low, int) and isinstance(high, int) and key != "detection.confidence":
                    clamped = int(round(clamped))
                elif key not in ("detection.confidence",):
                    clamped = float(clamped)
                self.set_in(data, key, clamped)
        # اطمینان از معتبربودن کد رنگ
        color = str(self.get_in(data, "detection.color.hex") or "#22C55E").strip()
        if not (color.startswith("#") and len(color) in (4, 7)):
            color = "#22C55E"
        self.set_in(data, "detection.color.hex", color.upper())
        # اطمینان از اینکه بازهٔ بزرگ‌نمایی معتبر بماند
        smin = float(self.get_in(data, "detection.scale_min") or 0.7)
        smax = float(self.get_in(data, "detection.scale_max") or 1.35)
        if smax < smin:
            self.set_in(data, "detection.scale_max", smin)
        # اطمینان از اینکه لیست کلیدواژه‌ها یک لیست رشته‌ای باشد
        keywords = self.get_in(data, "detection.text.keywords")
        if not isinstance(keywords, list):
            self.set_in(data, "detection.text.keywords", list(DEFAULT_SETTINGS["detection"]["text"]["keywords"]))
        return data

    # ------------------------------------------------------------------ ذخیره
    def save(self) -> bool:
        """ذخیرهٔ اتمیک تنظیمات (نوشتن در فایل موقت و سپس جایگزینی)."""
        with self._lock:
            try:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                payload = json.dumps(self._data, ensure_ascii=False, indent=2)
                handle = tempfile.NamedTemporaryFile(
                    "w", encoding="utf-8", dir=str(self._path.parent),
                    prefix="settings-", suffix=".tmp", delete=False,
                )
                try:
                    handle.write(payload)
                    handle.flush()
                    os.fsync(handle.fileno())
                finally:
                    handle.close()
                os.replace(handle.name, self._path)
                return True
            except OSError:
                return False

    def reset_to_defaults(self) -> None:
        self._data = self._sanitize(copy.deepcopy(DEFAULT_SETTINGS))
        self.save()
        self.settings_reloaded.emit()

    # --------------------------------------------------------------- دسترسی
    @property
    def data(self) -> dict[str, Any]:
        return self._data

    def get(self, key: str = "", default: Any = None) -> Any:
        """خواندن مقدار با کلید نقطه‌ای، مثال: detection.interval_ms"""
        if not key:
            return self._data
        value = self.get_in(self._data, key)
        return default if value is None else value

    def set(self, key: str, value: Any, *, autosave: bool = True, notify: bool = True) -> None:
        """نوشتن مقدار با کلید نقطه‌ای و ذخیرهٔ خودکار."""
        value = self._clamp_value(key, value)
        self.set_in(self._data, key, value)
        if notify:
            self.setting_changed.emit(key, value)
        if autosave:
            self.save()

    def update(self, values: dict[str, Any], *, autosave: bool = True) -> None:
        """به‌روزرسانی چند کلید نقطه‌ای به‌صورت یکجا."""
        for key, value in values.items():
            self.set(key, value, autosave=False)
        if autosave:
            self.save()

    def apply_sanitized(self) -> None:
        self._data = self._sanitize(self._data)
        self.save()

    # ------------------------------------------------------- کمکی‌های نقطه‌ای
    @staticmethod
    def _clamp_value(key: str, value: Any) -> Any:
        """کران‌گذاری مقدار عددی بر اساس محدوده‌های مجاز (در لحظهٔ نوشتن)."""
        bounds = _CLAMPS.get(key)
        if bounds is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            return value
        low, high = bounds
        clamped = max(low, min(high, value))
        if key == "detection.confidence":
            return float(clamped)
        if isinstance(low, int) and isinstance(high, int):
            return int(round(clamped))
        return float(clamped)

    @staticmethod
    def get_in(data: dict[str, Any], dotted: str, default: Any = None) -> Any:
        node: Any = data
        for part in dotted.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                return default
        return node

    @staticmethod
    def set_in(data: dict[str, Any], dotted: str, value: Any) -> None:
        parts = dotted.split(".")
        node = data
        for part in parts[:-1]:
            if not isinstance(node.get(part), dict):
                node[part] = {}
            node = node[part]
        node[parts[-1]] = value

    # --------------------------------------------------------- میان‌برهای خوانا
    def interval_ms(self) -> int:
        if self.get("detection.turbo_mode", False):
            return int(self.get("detection.turbo_interval_ms", 120))
        return int(self.get("detection.interval_ms", 500))

    def region(self) -> tuple[int, int, int, int]:
        reg = self.get("detection.region", {}) or {}
        left = int(reg.get("left", 0) or 0)
        top = int(reg.get("top", 0) or 0)
        width = int(reg.get("width", 0) or 0)
        height = int(reg.get("height", 0) or 0)
        return left, top, width, height

    def set_region(self, left: int, top: int, width: int, height: int) -> None:
        self.update({
            "detection.region.left": int(left),
            "detection.region.top": int(top),
            "detection.region.width": int(width),
            "detection.region.height": int(height),
        })

    def set_region_off(self) -> None:
        self.set_region(0, 0, 0, 0)

    def region_is_fullscreen(self) -> bool:
        _, _, width, height = self.region()
        return width <= 0 or height <= 0
