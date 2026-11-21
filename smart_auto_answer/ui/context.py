"""زمینهٔ مشترک برنامه: سرویس‌ها و ابزارهایی که همهٔ صفحه‌ها به آن نیاز دارند."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class AppContext:
    """نگه‌دارندهٔ سرویس‌های اصلی برای استفاده در صفحه‌های رابط کاربری."""

    config: Any
    store: Any
    detector: Any
    logger: Any
    notifications: Any
    mapper: Any
    selector: Any
    click_engine: Any
    safety: Any
    config_path: Path | None = None

    def log(self, event: str, status: str, description: str = "", level: str = "info") -> None:
        try:
            self.logger.log(event, status, description, level=level)
        except Exception:
            pass
