"""سرویس ثبت رویدادها (لاگ).

رویدادها به‌صورت JSON Lines در پوشهٔ logs ذخیره می‌شوند تا نمایش، پاک‌سازی و
خروجی‌گیری ساده و سریع باشد. هیچ صدای تماس یا محتوای گفتگو ذخیره نمی‌شود.
"""

from __future__ import annotations

import csv
import json
import logging
import threading
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Iterable

from PySide6.QtCore import QObject, Signal

# --- انواع رویداد ---
EVENT_MONITOR_START = "شروع پایش"
EVENT_MONITOR_STOP = "توقف پایش"
EVENT_CALL_DETECTED = "شناسایی تماس"
EVENT_BUTTON_RECOGNIZED = "تشخیص دکمهٔ پاسخ"
EVENT_AUTO_CLICK = "کلیک خودکار"
EVENT_DETECTION_FAILED = "ناموفق در شناسایی"
EVENT_CONFIG_CHANGED = "تغییر تنظیمات"
EVENT_APP_ERROR = "خطای برنامه"
EVENT_APP_START = "اجرای برنامه"
EVENT_APP_EXIT = "بستن برنامه"
EVENT_TEMPLATE = "مدیریت تصویر دکمه"
EVENT_SHORTCUT = "میان‌بر کلیدی"
EVENT_TEST = "آزمون تشخیص"

STATUS_OK = "موفق"
STATUS_FAIL = "ناموفق"
STATUS_WARN = "هشدار"
STATUS_INFO = "اطلاع"


class LoggingService(QObject):
    """ثبت و مدیریت رویدادهای برنامه."""

    entry_added = Signal(dict)

    def __init__(self, log_dir: Path, max_bytes: int = 3 * 1024 * 1024) -> None:
        super().__init__()
        self._dir = Path(log_dir)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._jsonl_path = self._dir / "activity.jsonl"
        # رویدادهای افزونهٔ مرورگر که میزبان Native Messaging ثبت می‌کند
        self._extension_path = self._dir / "extension_activity.jsonl"
        self._max_bytes = max_bytes
        self._lock = threading.RLock()
        self._install_technical_logger()

    # ------------------------------------------------------------------ عمومی
    @property
    def directory(self) -> Path:
        return self._dir

    def log(
        self,
        event: str,
        status: str,
        description: str = "",
        level: str = "info",
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """ثبت یک رویداد. خروجی: دیکشنری رویداد ثبت‌شده."""
        now = datetime.now()
        entry: dict[str, Any] = {
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timestamp": now.isoformat(timespec="milliseconds"),
            "event": event,
            "status": status,
            "description": description,
            "level": level,
        }
        if extra:
            entry["extra"] = {k: v for k, v in extra.items() if v is not None}
        with self._lock:
            self._rotate_if_needed()
            try:
                with self._jsonl_path.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
            except OSError:
                pass
        try:
            self.entry_added.emit(entry)
        except RuntimeError:
            pass
        return entry

    def read(self, limit: int = 1000, newest_first: bool = True) -> list[dict[str, Any]]:
        """خواندن آخرین رویدادها (شامل رویدادهای افزونهٔ مرورگر)."""
        entries: list[dict[str, Any]] = []
        with self._lock:
            entries.extend(self._read_jsonl(self._jsonl_path))
            entries.extend(self._read_jsonl(self._extension_path))
        entries.sort(key=lambda item: str(item.get("timestamp", "")))
        if newest_first:
            entries.reverse()
        if limit > 0:
            entries = entries[:limit]
        return entries

    def _read_jsonl(self, path: Path) -> list[dict[str, Any]]:
        """خواندن یک فایل JSON Lines و برگرداندن رکوردهای معتبر."""
        if not path.exists():
            return []
        entries: list[dict[str, Any]] = []
        try:
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except OSError:
            return []
        return entries

    def count(self) -> int:
        return len(self.read(limit=0))

    def clear(self) -> None:
        with self._lock:
            for pattern in ("activity*.jsonl", "extension_activity*.jsonl"):
                for path in self._dir.glob(pattern):
                    try:
                        path.unlink()
                    except OSError:
                        pass
        self.log(EVENT_APP_START, STATUS_INFO, "فایل رویدادها پاک‌سازی شد.")

    def export(self, destination: Path, fmt: str = "csv") -> Path:
        """خروجی‌گیری رویدادها در قالب csv یا json یا txt."""
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        entries = self.read(limit=0, newest_first=False)
        cols = ["date", "time", "event", "status", "description", "level"]
        if fmt.lower() == "csv":
            with destination.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=cols, extrasaction="ignore")
                writer.writeheader()
                for row in entries:
                    writer.writerow({c: row.get(c, "") for c in cols})
        elif fmt.lower() == "json":
            destination.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
        else:
            lines = [f"{r.get('date','')} {r.get('time','')} | {r.get('event','')} | "
                     f"{r.get('status','')} | {r.get('description','')}" for r in entries]
            destination.write_text("\n".join(lines), encoding="utf-8")
        return destination

    def technical_error(self, message: str, exc: BaseException | None = None) -> None:
        """ثبت خطای فنی در فایل متنی برای عیب‌یابی."""
        logging.getLogger("smart_auto_answer").error(message, exc_info=exc)

    # ----------------------------------------------------------------- داخلی
    def _rotate_if_needed(self) -> None:
        try:
            if self._jsonl_path.exists() and self._jsonl_path.stat().st_size > self._max_bytes:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                self._jsonl_path.rename(self._dir / f"activity-{stamp}.jsonl")
        except OSError:
            pass

    def _install_technical_logger(self) -> None:
        logger = logging.getLogger("smart_auto_answer")
        if logger.handlers:
            return
        logger.setLevel(logging.INFO)
        handler = RotatingFileHandler(
            self._dir / "technical.log", maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(handler)
        logger.propagate = False


def summarize(entries: Iterable[dict[str, Any]]) -> dict[str, int]:
    """شمارش رویدادها بر اساس نوع (برای گزارش‌های خلاصه)."""
    result: dict[str, int] = {}
    for item in entries:
        key = str(item.get("event", ""))
        result[key] = result.get(key, 0) + 1
    return result
