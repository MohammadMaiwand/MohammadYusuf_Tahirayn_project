"""موتور تشخیص تماس: تطبیق تصویر (Template)، تشخیص رنگ و تشخیص متن (OCR)."""

from __future__ import annotations

import difflib
import re
import time
from dataclasses import dataclass, field

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]

from . import paths as app_paths
from .ocr_engine import OcrLine, WindowsOcr, availability as ocr_availability
from .template_store import TemplateInfo, TemplateStore

MODE_TEMPLATE = "template"
MODE_COLOR = "color"
MODE_TEXT = "text"

MODE_TITLES = {
    MODE_TEMPLATE: "تطبیق تصویر دکمه",
    MODE_COLOR: "تشخیص با رنگ دکمه",
    MODE_TEXT: "تشخیص با متن دکمه",
}

# واژه‌های نفی که اگر در مجاورت کلمهٔ کلیدی بیایند آن را رد می‌کنند
# تا مواردی مثل «No answer» یا «پاسخ ندهید» به‌جای دکمهٔ پاسخ کلیک نشوند.
_NEGATION_WORDS = {
    "no", "not", "dont", "don", "cant", "cannot", "wont", "never", "without", "none",
    "نه", "نخیر", "نخنر", "بدون", "هرگز", "هیچ",
    "ندهید", "نکنید", "نزنید", "نمیدهید", "نپذیرید", "نگیرید", "نپاسخ",
}


def _levenshtein(a: str, b: str) -> int:
    """فاصلهٔ ویرایشی (تعداد جا‌به‌جایی/افزودن/حذف حرف) بین دو رشته."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))
        previous = current
    return previous[-1]


@dataclass
class MatchResult:
    """نتیجهٔ یک تشخیص."""

    found: bool = False
    mode: str = ""
    label: str = ""
    confidence: float = 0.0
    center_x: int = 0
    center_y: int = 0
    box: tuple[int, int, int, int] = (0, 0, 0, 0)          # مختصات مطلق: left, top, width, height
    threshold: float = 0.0
    elapsed_ms: float = 0.0
    candidates: list[dict] = field(default_factory=list)

    @property
    def title(self) -> str:
        return MODE_TITLES.get(self.mode, self.mode)

    def describe(self) -> str:
        if not self.found:
            return "چیزی شناسایی نشد"
        return (f"{self.title} | {self.label} | اطمینان {self.confidence * 100:.1f}%"
                f" | نقطه ({self.center_x}, {self.center_y})")


# ------------------------------------------------------------------ تطبیق تصویر
class TemplateMatcher:
    """تطبیق چندمقیاسی تصویر دکمه با OpenCV."""

    def __init__(self, grayscale: bool = True) -> None:
        self.grayscale = grayscale
        self._cache: dict[tuple[str, float], np.ndarray] = {}
        self._alpha_cache: dict[str, np.ndarray] = {}

    def clear_cache(self) -> None:
        self._cache.clear()
        self._alpha_cache.clear()

    def _base(self, template: TemplateInfo, image: np.ndarray) -> tuple[np.ndarray, np.ndarray | None]:
        """تبدیل تصویر مرجع به خاکستری/RGB و ماسک آلفا (با کش)."""
        key_rgb = f"{template.name}:rgb"
        cached = self._cache.get((key_rgb, 1.0))
        if cached is not None:
            alpha = self._alpha_cache.get(template.name)
            return cached, alpha
        color = image[:, :, :3] if image.ndim == 3 and image.shape[2] == 4 else image
        if self.grayscale and color.ndim == 3:
            base = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
        else:
            base = color
        alpha = None
        if image.ndim == 3 and image.shape[2] == 4:
            alpha = image[:, :, 3]
            if int(alpha.min()) > 250:      # تصویر کاملاً مات ⇒ ماسک لازم نیست
                alpha = None
        self._cache[(key_rgb, 1.0)] = base
        if alpha is not None:
            self._alpha_cache[template.name] = alpha
        return base, alpha

    def _scaled(self, template: TemplateInfo, base: np.ndarray, scale: float) -> np.ndarray:
        if abs(scale - 1.0) < 1e-3:
            return base
        key = (template.name, round(scale, 4))
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        interpolation = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR
        scaled = cv2.resize(base, None, fx=scale, fy=scale, interpolation=interpolation)
        if scaled.size == 0:
            scaled = base
        self._cache[key] = scaled
        return scaled

    def match(
        self,
        frame_bgr: np.ndarray,
        templates: list[tuple[TemplateInfo, np.ndarray]],
        threshold: float,
        scale_min: float,
        scale_max: float,
        scale_steps: int,
    ) -> tuple[MatchResult | None, list[dict]]:
        """بهترین تطبیق بین همهٔ تصاویر مرجع."""
        if cv2 is None or not templates:
            return None, []
        gray_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY) if self.grayscale else frame_bgr
        frame_h, frame_w = gray_frame.shape[:2]
        best: MatchResult | None = None
        candidates: list[dict] = []
        started = time.perf_counter()

        for template, image in templates:
            if image is None or image.size == 0:
                continue
            base, alpha = self._base(template, image)
            base_h, base_w = base.shape[:2]
            if base_h < 3 or base_w < 3:
                continue
            local_threshold = float(template.confidence) if template.confidence else float(threshold)

            # مقیاس ۱ اول آزمایش می‌شود تا در حالت عادی سریع پاسخ بگیریم
            scales = [1.0]
            if scale_steps > 1 and (scale_max - scale_min) > 0.01:
                for index in range(scale_steps):
                    value = scale_min + (scale_max - scale_min) * index / max(1, scale_steps - 1)
                    if abs(value - 1.0) > 1e-3:
                        scales.append(round(value, 4))

            for scale in scales:
                template_img = self._scaled(template, base, scale)
                t_h, t_w = template_img.shape[:2]
                if t_h > frame_h or t_w > frame_w or t_h < 3 or t_w < 3:
                    continue
                mask = None
                if alpha is not None:
                    mask = cv2.resize(alpha, (t_w, t_h), interpolation=cv2.INTER_NEAREST)
                method = cv2.TM_CCOEFF_NORMED
                if mask is not None:
                    method = cv2.TM_CCORR_NORMED
                elif float(template_img.std()) < 1.2:      # الگوی کم‌تضاد (مثل بلوک تک‌رنگ)
                    method = cv2.TM_CCORR_NORMED
                try:
                    if method == cv2.TM_CCORR_NORMED and mask is not None:
                        result = cv2.matchTemplate(gray_frame, template_img, method, mask=mask)
                    else:
                        result = cv2.matchTemplate(gray_frame, template_img, method)
                except cv2.error:
                    continue
                result = np.nan_to_num(result, nan=0.0, posinf=0.0, neginf=0.0)
                _, max_val, _, max_loc = cv2.minMaxLoc(result)
                if mask is not None:
                    max_val = min(1.0, max(0.0, max_val))
                candidate = {
                    "template": template.name,
                    "scale": round(scale, 3),
                    "confidence": float(max_val),
                    "threshold": local_threshold,
                    "point": (int(max_loc[0]), int(max_loc[1])),
                    "size": (int(t_w), int(t_h)),
                }
                candidates.append(candidate)
                if max_val >= local_threshold:
                    elapsed = (time.perf_counter() - started) * 1000.0
                    match = MatchResult(
                        found=True, mode=MODE_TEMPLATE, label=template.name,
                        confidence=float(max_val),
                        center_x=int(max_loc[0] + t_w // 2), center_y=int(max_loc[1] + t_h // 2),
                        box=(int(max_loc[0]), int(max_loc[1]), int(t_w), int(t_h)),
                        threshold=local_threshold, elapsed_ms=elapsed, candidates=candidates,
                    )
                    return match, candidates
                if best is None or max_val > best.confidence:
                    best = MatchResult(
                        found=False, mode=MODE_TEMPLATE, label=template.name,
                        confidence=float(max_val),
                        center_x=int(max_loc[0] + t_w // 2), center_y=int(max_loc[1] + t_h // 2),
                        box=(int(max_loc[0]), int(max_loc[1]), int(t_w), int(t_h)),
                        threshold=local_threshold,
                    )
        if best is not None:
            best.elapsed_ms = (time.perf_counter() - started) * 1000.0
            best.candidates = candidates
        return best, candidates


# ------------------------------------------------------------------ تشخیص رنگ
class ColorMatcher:
    """یافتن نواحی هم‌رنگ با رنگ دکمهٔ پاسخ."""

    @staticmethod
    def hex_to_bgr(color_hex: str) -> tuple[int, int, int]:
        value = color_hex.strip().lstrip("#")
        if len(value) == 3:
            value = "".join(ch * 2 for ch in value)
        try:
            red = int(value[0:2], 16)
            green = int(value[2:4], 16)
            blue = int(value[4:6], 16)
        except (ValueError, IndexError):
            red = green = blue = 34
        return (blue, green, red)

    def match(
        self,
        frame_bgr: np.ndarray,
        color_hex: str,
        tolerance: int,
        min_area: int,
        max_area: int,
        min_aspect: float,
        max_aspect: float,
        required: bool = True,
        min_side: int = 0,
    ) -> tuple[MatchResult | None, list[dict]]:
        if cv2 is None or frame_bgr.size == 0:
            return None, []
        started = time.perf_counter()
        bgr = np.uint8([[list(self.hex_to_bgr(color_hex))]])
        target_hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0, 0]
        hue, sat, val = int(target_hsv[0]), int(target_hsv[1]), int(target_hsv[2])

        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        hue_tol = max(1, int(tolerance))
        sat_tol = max(30, int(tolerance * 2.2))
        val_tol = max(40, int(tolerance * 2.2))
        lower = np.array([max(0, hue - hue_tol), max(0, sat - sat_tol), max(0, val - val_tol)], dtype=np.uint8)
        upper = np.array([min(179, hue + hue_tol), 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower, upper)
        if hue - hue_tol < 0:                      # رنگ‌های قرمز در دو سر طیف قرار می‌گیرند
            extra_lower = np.array([180 + (hue - hue_tol), lower[1], lower[2]], dtype=np.uint8)
            extra_upper = np.array([179, 255, 255], dtype=np.uint8)
            mask = cv2.bitwise_or(mask, cv2.inRange(hsv, extra_lower, extra_upper))
        elif hue + hue_tol > 179:
            extra_lower = np.array([0, lower[1], lower[2]], dtype=np.uint8)
            extra_upper = np.array([(hue + hue_tol) - 180, 255, 255], dtype=np.uint8)
            mask = cv2.bitwise_or(mask, cv2.inRange(hsv, extra_lower, extra_upper))

        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        count, _, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
        frame_h, frame_w = frame_bgr.shape[:2]
        best_blob: dict | None = None
        candidates: list[dict] = []
        for index in range(1, count):
            left, top, width, height, area = (int(stats[index, 0]), int(stats[index, 1]),
                                              int(stats[index, 2]), int(stats[index, 3]),
                                              int(stats[index, 4]))
            if area < min_area or area > max_area or height < 4:
                continue
            # دکمهٔ واقعی پاسخ اندازهٔ محسوسی دارد؛ آیکون‌های ریز نوار وظیفه/نوار
            # ابزار (حدود ۲۴ پیکسل) باید رد شوند تا کلیک اشتباه رخ ندهد.
            if min_side and (width < min_side or height < min_side):
                continue
            aspect = width / max(1, height)
            if aspect < min_aspect or aspect > max_aspect:
                continue
            fill = area / float(max(1, width * height))
            cx = left + width / 2.0
            cy = top + height / 2.0

            # --- امتیازدهی هوشمند بر اساس شکل دکمه (نه فقط مساحت) ---
            # دکمهٔ پاسخ معمولاً پهن و کشیده است (نسبت پهنا به بلندی ۲ تا ۵)
            # و در نیمهٔ پایین صفحه قرار دارد (نه در گوشه‌ها که آیکون‌ها هستند)
            shape_bonus = 0.0
            if 2.0 <= aspect <= 5.0:
                shape_bonus = 0.30          # شکل دکمهٔ استاندارد
            elif 1.5 <= aspect < 2.0:
                shape_bonus = 0.15
            elif aspect > 5.0:
                shape_bonus = 0.10          # خیلی کشیده (مثلاً نوار)

            # پنالتی برای نواحی در گوشه‌ها و لبهٔ بالای صفحه (آیکون‌ها)
            edge_penalty = 0.0
            margin_x = frame_w * 0.08
            margin_y = frame_h * 0.08
            if left < margin_x or (left + width) > (frame_w - margin_x):
                edge_penalty += 0.15
            if top < margin_y:
                edge_penalty += 0.20          # بالای صفحه = عنوان/آیکون
            if (top + height) > (frame_h - margin_y):
                edge_penalty += 0.20          # پایین صفحه = نوار وظیفه
            # جایزه برای ناحیه در نیمهٔ پایین صفحه (دکمه‌های تماس معمولاً پایین‌اند)
            position_bonus = 0.15 if cy > frame_h * 0.4 else 0.0

            area_factor = min(1.0, area / float(max(min_area * 6, 1)))
            score = min(1.0, 0.30 + 0.25 * area_factor + 0.20 * fill
                        + shape_bonus + position_bonus - edge_penalty)
            score = max(0.0, score)

            item = {
                "left": left, "top": top, "width": width, "height": height,
                "area": area, "aspect": round(aspect, 2), "score": round(score, 3),
            }
            candidates.append(item)
            # انتخاب بر اساس امتیاز (شکل + موقعیت)، نه فقط مساحت
            if best_blob is None or score > best_blob["score"]:
                best_blob = item
        if best_blob is None:
            return None, candidates

        cx = int(best_blob["left"] + best_blob["width"] / 2)
        cy = int(best_blob["top"] + best_blob["height"] / 2)
        threshold = 0.55
        found = best_blob["score"] >= threshold
        match = MatchResult(
            found=found, mode=MODE_COLOR, label=color_hex.upper(),
            confidence=float(best_blob["score"]),
            center_x=cx, center_y=cy,
            box=(best_blob["left"], best_blob["top"], best_blob["width"], best_blob["height"]),
            threshold=threshold,
            elapsed_ms=(time.perf_counter() - started) * 1000.0,
            candidates=candidates,
        )
        return match, candidates


# ------------------------------------------------------------------ تشخیص متن
def normalize_text(text: str) -> str:
    """یکسان‌سازی متن برای مقایسهٔ مقاوم (حذف نویز OCR)."""
    lowered = str(text).lower()
    # نگه‌داشتن حروف لاتین، ارقام و حروف دری/عربی
    cleaned = re.sub(rf"[^0-9a-z\u0600-\u06FF]+", "", lowered)
    replacements = {
        "ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "أ": "ا", "إ": "ا", "آ": "ا",
        "ؤ": "و", "ئ": "ی", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
        "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    }
    for source, target in replacements.items():
        cleaned = cleaned.replace(source, target)
    return cleaned


def preprocess_for_ocr(frame_bgr: np.ndarray) -> np.ndarray:
    """پیش‌پردازش تصویر برای OCR بهتر (متن سفید روی سبز و دکمه‌ها).

    روش: کاهش نویز + افزایش کنتراست + تبدیل به سیاه‌وسفید با آستانهٔ تطبیقی تا
    متن روی دکمهٔ رنگی به‌خوبی جدا شود. روی تصویر اصلی برمی‌گردد اگر نتیجهٔ
    سیاه‌وسفید کوچک‌تر از یک‌سوم سطح باشد.
    """
    if cv2 is None or frame_bgr.size == 0:
        return frame_bgr
    try:
        lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        # آستانهٔ تطبیقی برای جداکردن متن (سفید/روشن) از پس‌زمینهٔ رنگی
        binary = cv2.adaptiveThreshold(
            l_channel, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 15,
        )
        # اگر بیش از ۸۵٪ تصویر سفید یا بیش از ۹۵٪ سیاه شد، پیش‌پردازش فایده‌ای ندارد
        white_ratio = float(np.count_nonzero(binary)) / float(binary.size)
        if 0.05 < white_ratio < 0.85:
            # برگرداندن به BGR برای ورود یکنواخت به موتور OCR
            return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    except Exception:
        pass
    return frame_bgr


class TextMatcher:
    """یافتن متن دکمهٔ پاسخ روی صفحه با OCR ویندوز."""

    def __init__(self, min_interval_ms: int = 150) -> None:
        self._ocr = WindowsOcr()
        self._last_run = 0.0
        self._last_lines: list[OcrLine] = []
        self._last_signature = ""
        self.min_interval_ms = min_interval_ms
        self.available = False
        self.error = ""
        # نام خود برنامه: هر خطی که این نام را داشته باشد نادیده گرفته می‌شود
        # تا عنوان پنجره/نوار وظیفه/نام فایل خودمان به‌عنوان «دکمهٔ پاسخ» تشخیص نشود.
        self._self_signatures = tuple(
            signature for signature in {
                normalize_text(app_paths.APP_TITLE_EN),
                normalize_text(app_paths.APP_NAME),
                normalize_text(f"{app_paths.APP_NAME}.exe"),
            } if signature
        )

    def refresh_availability(self) -> bool:
        self.available, self.error = ocr_availability()
        return self.available

    def _is_self_text(self, text: str) -> bool:
        """آیا متن مربوط به خودِ این برنامه است (عنوان، نام فایل، نوار وظیفه)؟"""
        if not text:
            return False
        for signature in self._self_signatures:
            if signature in text:
                return True
            # تحمل خطای OCR در خواندن نام برنامه (مثلاً «smatautoanswer»)
            if difflib.SequenceMatcher(None, signature, text).ratio() >= 0.80:
                return True
        return False

    @staticmethod
    def _is_negated(words: list[str], index: int) -> bool:
        """آیا کلمهٔ کلیدی مجاور یک واژهٔ نفی است؟ (مثل «No answer»)"""
        for position in (index - 1, index + 1):
            if 0 <= position < len(words) and words[position] in _NEGATION_WORDS:
                return True
        return False

    def _score(self, keyword: str, text: str) -> float:
        """امتیاز تطبیق کلیدواژه با یک واژه/خط متن.

        تطبیق فازی فقط برای تحمل خطای OCR است: حداکثر چند اشتباه کوچک حرفی
        پذیرفته می‌شود. بنابراین به‌جای «نسبت شباهت آزاد» (difflib) از فاصلهٔ
        ویرایشی (Levenshtein) با تلورانس متناسب با طول استفاده می‌کنیم تا
        واژه‌های بی‌ربط صفحه هرگز با کلیدواژه اشتباه گرفته نشوند
        (مثلاً «user» ↔ «answer» یا «in» ↔ «join»).
        """
        if not keyword or not text:
            return 0.0
        if keyword == text:
            return 1.0
        longest = max(len(keyword), len(text))
        # تلورانس کوچک: اجازهٔ ۱ اشتباه برای واژه‌های کوتاه، ۲ برای متوسط و
        # ۳ برای عبارت‌های بلند؛ بیشتر از این یعنی واژهٔ دیگری است.
        tolerance = 1 if longest <= 6 else (2 if longest <= 12 else 3)
        if abs(len(keyword) - len(text)) > tolerance:
            return 0.0
        distance = _levenshtein(keyword, text)
        if distance > tolerance:
            return 0.0
        return 1.0 - distance / longest

    def match(
        self,
        frame_bgr: np.ndarray,
        keywords: list[str],
        similarity: float,
        min_word_height: int,
        force: bool = False,
    ) -> tuple[MatchResult | None, list[dict]]:
        """تشخیص بر اساس کلیدواژه‌های متن دکمه.

        برای دقت بیشتر، هم تصویر اصلی و هم نسخهٔ پیش‌پردازش‌شده (سیاه‌وسفید)
        با OCR بررسی می‌شود تا متن روی دکمهٔ رنگی (مثل Accept روی سبز) بهتر خوانده شود.
        """
        started = time.perf_counter()
        if not self.refresh_availability():
            return None, []
        now = time.perf_counter()
        if not force and (now - self._last_run) * 1000.0 < self.min_interval_ms:
            return None, []
        self._last_run = now

        normalized_keywords = [normalize_text(k) for k in keywords if normalize_text(k)]
        if not normalized_keywords:
            return None, []

        # امتحان OCR روی تصویر اصلی و نسخهٔ پیش‌پردازش‌شده؛ بهترین نتیجه انتخاب می‌شود
        frames_to_try: list[np.ndarray] = [frame_bgr]
        preprocessed = preprocess_for_ocr(frame_bgr)
        if preprocessed is not frame_bgr:
            frames_to_try.append(preprocessed)

        best: MatchResult | None = None
        all_candidates: list[dict] = []
        for frame_variant in frames_to_try:
            try:
                lines = self._ocr.recognize(frame_variant)
            except Exception as exc:
                self.error = str(exc)
                continue
            self._last_lines = lines
            variant_best, variant_candidates = self._match_lines(
                lines, normalized_keywords, similarity, min_word_height, started,
            )
            all_candidates.extend(variant_candidates)
            if variant_best is not None and (best is None or variant_best.confidence > best.confidence):
                best = variant_best
            if best is not None and best.confidence >= 0.95:
                break  # نتیجهٔ عالی پیدا شد؛ نیازی به امتحان نسخهٔ دیگر نیست
        if best is not None:
            best.candidates = all_candidates
        return best, all_candidates

    def _match_lines(
        self,
        lines: list,
        normalized_keywords: list[str],
        similarity: float,
        min_word_height: int,
        started: float,
    ) -> tuple[MatchResult | None, list[dict]]:
        """یافتن بهترین تطبیق متن در میان خطوط OCR."""
        best: MatchResult | None = None
        candidates: list[dict] = []
        for line in lines:
            line_text = normalize_text(line.text)
            if self._is_self_text(line_text):
                continue
            line_words = [normalize_text(word.text) for word in line.words]
            # اگر خط شامل واژهٔ نفی باشد (مثل «No answer» یا «پاسخ ندهید») کل خط
            # رد می‌شود تا هرگز روی دکمهٔ رد/لغو کلیک نشود و فقط «پاسخ/قبول» زده شود.
            if any(word and word in _NEGATION_WORDS for word in line_words):
                continue
            for word_index, word in enumerate(line.words):
                if word.height < min_word_height:
                    continue
                word_text = normalize_text(word.text)
                if not word_text:
                    continue
                if self._is_negated(line_words, word_index):
                    continue
                score = max((self._score(keyword, word_text) for keyword in normalized_keywords), default=0.0)
                line_score = max((self._score(keyword, line_text) for keyword in normalized_keywords), default=0.0)
                # اگر کل خط با کلیدواژه هم‌خوان باشد، جعبهٔ کل خط دقیق‌تر است
                use_line = line_score > score + 0.05
                box = line.bounds if use_line else (word.x, word.y, word.width, word.height)
                final_score = max(score, line_score) if use_line else score
                candidates.append({
                    "text": line.text.strip(),
                    "word": word.text,
                    "score": round(final_score, 3),
                    "box": [round(v, 1) for v in box],
                })
                if final_score >= similarity and (best is None or final_score > best.confidence):
                    center_x = int(box[0] + box[2] / 2)
                    center_y = int(box[1] + box[3] / 2)
                    best = MatchResult(
                        found=True, mode=MODE_TEXT, label=f"«{line.text.strip()}»",
                        confidence=float(final_score),
                        center_x=center_x, center_y=center_y,
                        box=(int(box[0]), int(box[1]), int(box[2]), int(box[3])),
                        threshold=similarity,
                        elapsed_ms=(time.perf_counter() - started) * 1000.0,
                    )
        return best, candidates


def _box_contains(outer: tuple[int, int, int, int], inner: tuple[int, int, int, int]) -> bool:
    """آیا مستطیل داخلی (center_x, center_y, w, h) داخل مستطیل بیرونی است؟"""
    ox, oy, ow, oh = outer
    ix, iy, iw, ih = inner
    # بررسی هم‌پوشانی مرکز مستطیل داخلی با بیرونی (با کمی هوشمند)
    return (ox <= ix + iw / 2 <= ox + ow) and (oy <= iy + ih / 2 <= oy + oh)


def _boxes_overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int], margin: int = 20) -> bool:
    """آیا دو مستطیل با حاشیهٔ معینی هم‌پوشانی دارند؟"""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw + margin < bx or bx + bw + margin < ax or
                ay + ah + margin < by or by + bh + margin < ay)


# ------------------------------------------------------------------ هماهنگ‌کننده
class Detector:
    """اجرای حالت‌های تشخیص روی یک تصویر و انتخاب بهترین نتیجه."""

    def __init__(self, store: TemplateStore) -> None:
        self.store = store
        self.template_matcher = TemplateMatcher(grayscale=True)
        self.color_matcher = ColorMatcher()
        self.text_matcher = TextMatcher()
        self._last_diag: dict = {}

    # -------------------------------------------------------------- پیکربندی
    def invalidate(self) -> None:
        self.template_matcher.clear_cache()
        self._last_diag = {}

    @property
    def diagnostics(self) -> dict:
        return self._last_diag

    def enabled_modes(self, detection_config: dict) -> list[str]:
        modes = detection_config.get("modes", {}) or {}
        active = [mode for mode in (MODE_TEMPLATE, MODE_COLOR, MODE_TEXT) if modes.get(mode)]
        return active or [MODE_TEMPLATE]

    # ---------------------------------------------------------------- اجرا
    def detect(
        self,
        frame_bgr: np.ndarray,
        origin: tuple[int, int] = (0, 0),
        config: dict | None = None,
        force_ocr: bool = False,
    ) -> MatchResult | None:
        """تشخیص روی تصویر ورودی. مختصات خروجی مطلق (نسبت به کل صفحه) است."""
        if cv2 is None or frame_bgr is None or frame_bgr.size == 0:
            return None
        conf = config or {}
        detection = conf.get("detection", {}) if conf else {}
        modes = self.enabled_modes(detection)
        threshold = float(detection.get("confidence", 0.86))
        scale_min = float(detection.get("scale_min", 0.7))
        scale_max = float(detection.get("scale_max", 1.35))
        scale_steps = int(detection.get("scale_steps", 9))
        diagnostics: dict = {"modes": modes, "results": [], "timings": {}}

        results: list[MatchResult] = []

        if MODE_COLOR in modes:
            color_conf = detection.get("color", {}) or {}
            started = time.perf_counter()
            match, _ = self.color_matcher.match(
                frame_bgr,
                str(color_conf.get("hex", "#22C55E")),
                int(color_conf.get("tolerance", 26)),
                int(color_conf.get("min_area", 900)),
                int(color_conf.get("max_area", 400000)),
                float(color_conf.get("min_aspect", 1.2)),
                float(color_conf.get("max_aspect", 12.0)),
                min_side=int(color_conf.get("min_side", 32)),
            )
            diagnostics["timings"]["color_ms"] = (time.perf_counter() - started) * 1000.0
            if match is not None:
                results.append(match)

        if MODE_TEMPLATE in modes:
            prepared: list[tuple[TemplateInfo, np.ndarray]] = []
            for template in self.store.enabled_templates():
                image = self.store.load_image(template)
                if image is not None:
                    prepared.append((template, image))
            started = time.perf_counter()
            match, _ = self.template_matcher.match(
                frame_bgr, prepared, threshold, scale_min, scale_max, scale_steps
            )
            diagnostics["timings"]["template_ms"] = (time.perf_counter() - started) * 1000.0
            diagnostics["templates"] = len(prepared)
            if match is not None:
                results.append(match)

        if MODE_TEXT in modes:
            text_conf = detection.get("text", {}) or {}
            self.text_matcher.min_interval_ms = int(text_conf.get("min_interval_ms", 150))
            # OCR همیشه اجرا می‌شود (متن «Accept» مطمئن‌ترین نشانهٔ دکمهٔ پاسخ است)
            force_text = True
            started = time.perf_counter()
            match, _ = self.text_matcher.match(
                frame_bgr,
                list(text_conf.get("keywords", [])),
                float(text_conf.get("similarity", 0.70)),
                int(text_conf.get("min_word_height", 8)),
                force=force_text,
            )
            diagnostics["timings"]["text_ms"] = (time.perf_counter() - started) * 1000.0
            if not self.text_matcher.available:
                diagnostics["ocr_error"] = self.text_matcher.error
            if match is not None:
                results.append(match)

        # جدا کردن نتایج هر حالت برای ترکیب هوشمند رنگ+متن
        color_result = next((r for r in results if r.mode == MODE_COLOR), None)
        text_result = next((r for r in results if r.mode == MODE_TEXT), None)
        template_result = next((r for r in results if r.mode == MODE_TEMPLATE), None)

        # --- منطق اولویت: رنگ+متن تأییدشده > رنگ > تصویر ---
        # تشخیص متنی تنها (بدون تأیید رنگ/قالب) خطرناک است: ممکن است واژهٔ
        # «answer/پاسخ» در متن عادی صفحه (کد، سند، چت) باشد نه روی دکمه.
        # بنابراین به‌صورت پیش‌فرض متن فقط در صورتی پذیرفته می‌شود که با یک ناحیهٔ
        # رنگی (دکمهٔ پاسخ) یا با یک قالب ثبت‌شده هم‌پوشانی داشته باشد.
        text_conf = detection.get("text", {}) or {}
        require_confirmation = bool(text_conf.get("require_button_confirmation", True))
        best: MatchResult | None = None

        has_text = text_result is not None and text_result.found
        color_overlaps_text = (
            has_text and color_result is not None and color_result.found
            and _boxes_overlap(color_result.box, text_result.box, margin=60)
        )
        template_overlaps_text = (
            has_text and template_result is not None and template_result.found
            and _boxes_overlap(template_result.box, text_result.box, margin=60)
        )

        if has_text and color_overlaps_text:
            # رنگ + متن در یک ناحیه: کلیک روی مرکز دکمه (رنگ دقیق‌تر است)
            best = MatchResult(
                found=True, mode=MODE_COLOR,
                label=f"{color_result.label} + متن {text_result.label}",
                confidence=min(1.0, max(color_result.confidence, text_result.confidence) + 0.15),
                center_x=color_result.center_x, center_y=color_result.center_y,
                box=color_result.box,
                threshold=color_result.threshold,
                elapsed_ms=color_result.elapsed_ms,
                candidates=color_result.candidates + text_result.candidates,
            )
            diagnostics["combined"] = "color+text"
        elif has_text and template_overlaps_text:
            best = text_result
            diagnostics["combined"] = "text+template"
        elif has_text and not require_confirmation:
            best = text_result
            diagnostics["combined"] = "text_only"
        elif has_text:
            diagnostics["combined"] = "text_only (unconfirmed, skipped)"

        if best is None and color_result is not None and color_result.found:
            # فقط رنگ پیدا شد؛ به‌خاطر فیلتر اندازه/لبه نسبتاً ایمن است.
            best = color_result
            diagnostics["combined"] = diagnostics.get("combined") or "color_only"
        if best is None and template_result is not None and template_result.found:
            best = template_result
            diagnostics["combined"] = diagnostics.get("combined") or "template"

        for item in results:
            diagnostics["results"].append({
                "mode": item.mode, "label": item.label,
                "confidence": round(item.confidence, 4), "found": item.found,
            })
        if best is not None:
            # تبدیل مختصات نسبی ناحیه به مختصات مطلق صفحه
            dx, dy = int(origin[0]), int(origin[1])
            best.center_x += dx
            best.center_y += dy
            best.box = (best.box[0] + dx, best.box[1] + dy, best.box[2], best.box[3])
        self._last_diag = diagnostics
        return best
