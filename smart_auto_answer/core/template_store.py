"""مدیریت تصاویر مرجع دکمهٔ پاسخ (پوشهٔ assets/answer_templates)."""

from __future__ import annotations

import json
import re
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]

from PySide6.QtCore import QObject, Signal

INDEX_FILE = "_index.json"
SUPPORTED_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


@dataclass
class TemplateInfo:
    """اطلاعات یک تصویر مرجع."""

    name: str
    file: str
    enabled: bool = True
    confidence: float | None = None      # None ⇒ استفاده از مقدار عمومی تنظیمات
    region_left: int | None = None       # ناحیهٔ اختصاصی اختیاری
    region_top: int | None = None
    region_width: int | None = None
    region_height: int | None = None
    notes: str = ""
    created: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def has_region(self) -> bool:
        return bool(self.region_width and self.region_height and self.region_width > 0)

    def region(self) -> tuple[int, int, int, int] | None:
        if not self.has_region:
            return None
        return (int(self.region_left or 0), int(self.region_top or 0),
                int(self.region_width or 0), int(self.region_height or 0))


class TemplateStore(QObject):
    """ذخیره، بارگذاری و کش تصاویر مرجع."""

    changed = Signal()

    def __init__(self, directory: Path) -> None:
        super().__init__()
        self._dir = Path(directory)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._index_path = self._dir / INDEX_FILE
        self._lock = threading.RLock()
        self._templates: dict[str, TemplateInfo] = {}
        self._image_cache: dict[str, tuple[float, np.ndarray]] = {}
        self._load()

    # ------------------------------------------------------------------ عمومی
    @property
    def directory(self) -> Path:
        return self._dir

    def list_templates(self) -> list[TemplateInfo]:
        with self._lock:
            return sorted(self._templates.values(), key=lambda t: t.created or t.name)

    def get(self, name: str) -> TemplateInfo | None:
        with self._lock:
            return self._templates.get(name)

    def enabled_templates(self) -> list[TemplateInfo]:
        return [t for t in self.list_templates() if t.enabled and self.image_path(t.file).exists()]

    def image_path(self, file_name: str) -> Path:
        return self._dir / file_name

    def load_image(self, template: TemplateInfo, use_cache: bool = True) -> np.ndarray | None:
        """بارگذاری تصویر مرجع (با کش برای سرعت بالا)."""
        path = self.image_path(template.file)
        if not path.exists():
            return None
        key = str(path)
        try:
            mtime = path.stat().st_mtime
        except OSError:
            return None
        with self._lock:
            cached = self._image_cache.get(key)
            if use_cache and cached and cached[0] == mtime:
                return cached[1]
        if cv2 is None:
            return None
        data = np.fromfile(str(path), dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_UNCHANGED)
        if image is None:
            return None
        with self._lock:
            self._image_cache[key] = (mtime, image)
        return image

    # ------------------------------------------------------------------ افزودن
    def add_from_array(self, image_bgr: np.ndarray, name: str = "", notes: str = "") -> TemplateInfo:
        """ذخیرهٔ تصویر گرفته‌شده از صفحه به‌عنوان تصویر مرجع."""
        if image_bgr is None or image_bgr.size == 0:
            raise ValueError("تصویر خالی است.")
        safe = self._unique_name(name or self._auto_name("answer"))
        file_name = f"{safe}.png"
        self._write_png(self._dir / file_name, image_bgr)
        info = TemplateInfo(
            name=safe, file=file_name, enabled=True,
            created=datetime.now().isoformat(timespec="seconds"), notes=notes,
        )
        with self._lock:
            self._templates[safe] = info
        self._save()
        self.changed.emit()
        return info

    def import_file(self, source: Path, name: str = "") -> TemplateInfo:
        """واردکردن یک فایل تصویری موجود."""
        source = Path(source)
        if source.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError("فرمت فایل پشتیبانی نمی‌شود. (png، jpg، bmp، webp)")
        data = np.fromfile(str(source), dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_UNCHANGED) if cv2 is not None else None
        if image is None:
            raise ValueError("فایل تصویری معتبر نیست.")
        return self.add_from_array(image, name=name or source.stem)

    def create_from_bytes(self, payload: bytes, name: str = "") -> TemplateInfo:
        image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_UNCHANGED) if cv2 else None
        if image is None:
            raise ValueError("دادهٔ تصویری معتبر نیست.")
        return self.add_from_array(image, name=name)

    # ------------------------------------------------------------------ تغییر
    def replace_image(self, name: str, image_bgr: np.ndarray) -> TemplateInfo:
        """جایگزینی تصویر یک مرجع موجود بدون تغییر تنظیمات آن."""
        info = self.get(name)
        if info is None:
            raise KeyError("تصویر مرجع پیدا نشد.")
        self._write_png(self.image_path(info.file), image_bgr)
        with self._lock:
            self._image_cache.pop(str(self.image_path(info.file)), None)
        self._save()
        self.changed.emit()
        return info

    def update(self, name: str, **fields) -> TemplateInfo | None:
        with self._lock:
            info = self._templates.get(name)
            if info is None:
                return None
            for key, value in fields.items():
                if hasattr(info, key):
                    setattr(info, key, value)
        self._save()
        self.changed.emit()
        return info

    def rename(self, old_name: str, new_name: str) -> TemplateInfo | None:
        """تغییر نام نمایشی یک تصویر مرجع (نام فایل دست‌نخورده می‌ماند)."""
        with self._lock:
            info = self._templates.pop(old_name, None)
            if info is None:
                return None
            clean = self._unique_name(new_name, existing=set(self._templates.keys()))
            info.name = clean
            self._templates[clean] = info
        self._save()
        self.changed.emit()
        return info

    def delete(self, name: str) -> bool:
        with self._lock:
            info = self._templates.pop(name, None)
        if info is None:
            return False
        for path in (self.image_path(info.file),):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        with self._lock:
            self._image_cache.pop(str(self.image_path(info.file)), None)
        self._save()
        self.changed.emit()
        return True

    def delete_all(self) -> int:
        count = 0
        for info in self.list_templates():
            if self.delete(info.name):
                count += 1
        return count

    # ------------------------------------------------------------ ذخیره‌سازی
    def _write_png(self, path: Path, image: np.ndarray) -> None:
        if cv2 is None:
            raise RuntimeError("کتابخانهٔ OpenCV در دسترس نیست.")
        suffix = path.suffix or ".png"
        ok, buffer = cv2.imencode(suffix, image)
        if not ok:
            raise ValueError("ذخیرهٔ تصویر ناموفق بود.")
        buffer.tofile(str(path))

    def _save(self) -> None:
        with self._lock:
            payload = {
                "version": 1,
                "templates": [info.to_dict() for info in self._templates.values()],
            }
        try:
            self._index_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            pass

    def _load(self) -> None:
        raw: dict = {}
        if self._index_path.exists():
            try:
                raw = json.loads(self._index_path.read_text(encoding="utf-8") or "{}")
            except (OSError, json.JSONDecodeError):
                raw = {}
        templates: dict[str, TemplateInfo] = {}
        for item in raw.get("templates", []) if isinstance(raw, dict) else []:
            try:
                info = TemplateInfo(**{k: v for k, v in item.items() if k in TemplateInfo.__dataclass_fields__})
                templates[info.name] = info
            except (TypeError, ValueError):
                continue
        # تعمیر خودکار: حذف مدخل‌های بدون فایل و افزودن فایل‌های بدون مدخل
        for name in list(templates):
            if not self.image_path(templates[name].file).exists():
                templates.pop(name, None)
        known_files = {t.file for t in templates.values()}
        for path in sorted(self._dir.iterdir()):
            if path.suffix.lower() not in SUPPORTED_SUFFIXES or path.name in known_files:
                continue
            stem = self._unique_name(path.stem, existing={*templates.keys()})
            templates[stem] = TemplateInfo(
                name=stem, file=path.name, enabled=True,
                created=datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
                notes="به‌صورت خودکار شناسایی شد",
            )
        with self._lock:
            self._templates = templates
        self._save()

    # ------------------------------------------------------------------ کمکی
    def _auto_name(self, prefix: str) -> str:
        stamp = time.strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{stamp}"

    def _unique_name(self, base: str, existing: set[str] | None = None) -> str:
        clean = re.sub(r"[^\w\u0600-\u06FF\- ]+", "", str(base)).strip() or "template"
        with self._lock:
            names = existing if existing is not None else set(self._templates.keys())
        candidate = clean
        index = 2
        while candidate in names:
            candidate = f"{clean}_{index}"
            index += 1
        return candidate
