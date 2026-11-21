"""موتور تشخیص متن (OCR) با استفاده از Windows.Media.Ocr داخلی ویندوز.

این موتور نیازی به نصب برنامهٔ جانبی ندارد و برای تشخیص متن روی دکمهٔ پاسخ
(مثل «Answer»، «Accept»، «پاسخ») استفاده می‌شود.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

import numpy as np

_AVAILABILITY: bool | None = None
_ERROR_MESSAGE = ""


@dataclass
class OcrWord:
    text: str
    x: float
    y: float
    width: float
    height: float

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.width / 2.0, self.y + self.height / 2.0)


@dataclass
class OcrLine:
    text: str
    words: list[OcrWord] = field(default_factory=list)

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """مستطیل محیطی خط: (x, y, width, height)"""
        if not self.words:
            return (0.0, 0.0, 0.0, 0.0)
        left = min(w.x for w in self.words)
        top = min(w.y for w in self.words)
        right = max(w.x + w.width for w in self.words)
        bottom = max(w.y + w.height for w in self.words)
        return (left, top, right - left, bottom - top)


def availability() -> tuple[bool, str]:
    """آیا OCR ویندوز در دسترس است؟ (نتیجه یک‌بار محاسبه و ذخیره می‌شود)"""
    global _AVAILABILITY, _ERROR_MESSAGE
    if _AVAILABILITY is not None:
        return _AVAILABILITY, _ERROR_MESSAGE
    try:
        from winrt.windows.media.ocr import OcrEngine as _WinOcr

        _AVAILABILITY = _WinOcr.try_create_from_user_profile_languages() is not None
        if not _AVAILABILITY:
            _ERROR_MESSAGE = "موتور OCR ویندوز زبان قابل استفادهای پیدا نکرد."
    except Exception as exc:  # pragma: no cover - بستگی به سیستم دارد
        _AVAILABILITY = False
        _ERROR_MESSAGE = f"OCR ویندوز در دسترس نیست: {exc}"
    return _AVAILABILITY, _ERROR_MESSAGE


def available_languages() -> list[str]:
    try:
        from winrt.windows.media.ocr import OcrEngine as _WinOcr

        return [lang.language_tag for lang in _WinOcr.available_recognizer_languages]
    except Exception:
        return []


class WindowsOcr:
    """پوشش‌دهندهٔ سادهٔ OCR ویندوز با پشتیبانی از رشته‌های چندگانه."""

    def __init__(self) -> None:
        self._local = threading.local()

    def _engine(self):
        engine = getattr(self._local, "engine", None)
        if engine is None:
            from winrt.windows.media.ocr import OcrEngine as _WinOcr

            engine = _WinOcr.try_create_from_user_profile_languages()
            if engine is None:
                langs = _WinOcr.available_recognizer_languages
                if langs:
                    engine = _WinOcr.try_create_from_language(langs[0])
            self._local.engine = engine
        return engine

    def recognize(self, frame_bgr: np.ndarray) -> list[OcrLine]:
        """تشخیص متن در تصویر ورودی؛ مختصات نسبت به گوشهٔ بالا-چپ همان تصویر است."""
        ok, message = availability()
        if not ok:
            raise RuntimeError(message or "OCR در دسترس نیست.")
        engine = self._engine()
        if engine is None:
            raise RuntimeError("ساخت موتور OCR ناموفق بود.")

        from winrt.windows.graphics.imaging import BitmapPixelFormat, SoftwareBitmap
        from winrt.windows.security.cryptography import CryptographicBuffer

        frame = frame_bgr
        scale = 1.0
        # بزرگ‌نمایی تصاویر کوچک باعث دقت بیشتر OCR می‌شود
        height, width = frame.shape[:2]
        if min(height, width) < 160 and max(height, width) < 1400:
            scale = 2.0
            import cv2

            frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            height, width = frame.shape[:2]

        bgra = np.empty((height, width, 4), dtype=np.uint8)
        bgra[:, :, 0] = frame[:, :, 0]
        bgra[:, :, 1] = frame[:, :, 1]
        bgra[:, :, 2] = frame[:, :, 2]
        bgra[:, :, 3] = 255
        buffer = CryptographicBuffer.create_from_byte_array(bytes(bgra.tobytes()))
        bitmap = SoftwareBitmap.create_copy_from_buffer(
            buffer, BitmapPixelFormat.BGRA8, int(width), int(height)
        )
        result = engine.recognize_async(bitmap).get()

        lines: list[OcrLine] = []
        for line in result.lines:
            words: list[OcrWord] = []
            for word in line.words:
                rect = word.bounding_rect
                words.append(OcrWord(
                    text=str(word.text),
                    x=float(rect.x) / scale,
                    y=float(rect.y) / scale,
                    width=float(rect.width) / scale,
                    height=float(rect.height) / scale,
                ))
            if words:
                lines.append(OcrLine(text=str(line.text), words=words))
        return lines


def frame_to_bgra_bytes(frame_bgr: np.ndarray) -> Any:  # pragma: no cover - کمکی
    height, width = frame_bgr.shape[:2]
    bgra = np.dstack([frame_bgr, np.full((height, width), 255, np.uint8)])
    return bytes(np.ascontiguousarray(bgra).tobytes())
