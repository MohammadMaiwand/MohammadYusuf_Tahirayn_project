"""صفحهٔ «پیکربندی دکمهٔ پاسخ»: تصویر، رنگ و متن دکمه."""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QIcon, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView, QCheckBox, QDialog, QDoubleSpinBox, QFileDialog, QFormLayout,
    QGridLayout, QGroupBox, QHBoxLayout, QLabel, QLineEdit, QListWidget, QListWidgetItem,
    QPushButton, QScrollArea, QSizePolicy, QSpinBox, QSplitter, QTabWidget, QVBoxLayout,
    QWidget,
)

from ..core.detector import MODE_COLOR, MODE_TEMPLATE, MODE_TEXT
from ..core.screen_capture import bgr_to_qimage
from .context import AppContext
from .theme import COLORS, app_font
from .widgets import ActionButton, Card, FramePreview, SectionCard


def image_to_pixmap(image: np.ndarray, max_width: int = 260, max_height: int = 90) -> QPixmap:
    """ساخت تصویر کوچک (thumbnail) از آرایهٔ BGR."""
    qimage = bgr_to_qimage(image)
    pixmap = QPixmap.fromImage(qimage)
    if pixmap.width() > max_width or pixmap.height() > max_height:
        pixmap = pixmap.scaled(max_width, max_height, Qt.AspectRatioMode.KeepAspectRatio,
                               Qt.TransformationMode.SmoothTransformation)
    return pixmap


class ImagePreviewDialog(QDialog):
    """پنجرهٔ پیش‌نمایش بزرگ یک تصویر مرجع."""

    def __init__(self, image: np.ndarray, title: str, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle(title)
        self.resize(640, 420)
        layout = QVBoxLayout(self)
        label = QLabel()
        qimage = bgr_to_qimage(image)
        pixmap = QPixmap.fromImage(qimage)
        if pixmap.width() > 600 or pixmap.height() > 340:
            pixmap = pixmap.scaled(600, 340, Qt.AspectRatioMode.KeepAspectRatio,
                                   Qt.TransformationMode.SmoothTransformation)
        label.setPixmap(pixmap)
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(label, 1)
        info = QLabel(f"اندازهٔ اصلی: {image.shape[1]} × {image.shape[0]} پیکسل")
        info.setObjectName("MutedText")
        info.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(info)
        close = QPushButton("بستن")
        close.clicked.connect(self.accept)
        layout.addWidget(close, 0, Qt.AlignmentFlag.AlignCenter)


class ImageManagerPage(QWidget):
    """مدیریت سه شیوهٔ تشخیص دکمهٔ پاسخ."""

    test_requested = Signal()
    modes_changed = Signal(dict)

    def __init__(self, context: AppContext, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.context = context
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)

        # صفحه را اسکرول‌پذیر می‌کنیم تا در پنجره‌های کم‌ارتفاع هیچ تنظیماتی
        # بریده نشود و همهٔ بخش‌ها به‌طور کامل دیده و ویرایش شوند.
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        container = QWidget()
        scroll.setWidget(container)
        root.addWidget(scroll)

        layout = QVBoxLayout(container)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(12)

        header = Card(padding=12)
        header_row = QHBoxLayout()
        title = QLabel("پیکربندی دکمهٔ پاسخ")
        title.setObjectName("SectionTitle")
        header_row.addWidget(title)
        header_row.addStretch(1)
        self.test_button = ActionButton("آزمون تشخیص", variant="primary", glyph="target")
        self.test_button.clicked.connect(self.test_requested.emit)
        header_row.addWidget(self.test_button)
        header.body().addLayout(header_row)
        hint = QLabel("برای پاسخ خودکار، دست‌کم یکی از سه شیوهٔ زیر را تنظیم کنید: تصویر دکمه، رنگ دکمه یا متن دکمه.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        header.body().addWidget(hint)
        layout.addWidget(header)

        self.tabs = QTabWidget()
        self.tabs.setMinimumHeight(460)
        self.tabs.addTab(self._build_image_tab(), "تصویر دکمه")
        self.tabs.addTab(self._build_color_tab(), "رنگ دکمه")
        self.tabs.addTab(self._build_text_tab(), "متن دکمه")
        layout.addWidget(self.tabs)

        self.result_card = SectionCard("نتیجهٔ آزمون تشخیص", "نتیجه‌ها بدون هیچ کلیکی نمایش داده می‌شوند.")
        self.result_label = QLabel("آزمونی انجام نشده است.")
        self.result_label.setObjectName("MutedText")
        self.result_label.setWordWrap(True)
        self.result_card.content().addWidget(self.result_label)
        self.result_preview = FramePreview()
        self.result_preview.setMinimumHeight(150)
        self.result_card.content().addWidget(self.result_preview)
        layout.addWidget(self.result_card)

        context.store.changed.connect(self.refresh_templates)
        self.refresh_templates()
        self._load_config_into_widgets()

    # ------------------------------------------------------------ برگهٔ تصویر
    def _build_image_tab(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        self.mode_template_check = QCheckBox("فعال‌بودن تشخیص با تصویر دکمه")
        self.mode_template_check.toggled.connect(self._on_modes_changed)
        layout.addWidget(self.mode_template_check)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        left = QWidget()
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(8)
        self.template_list = QListWidget()
        self.template_list.setIconSize(QPixmap(120, 40).size())
        self.template_list.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.template_list.itemSelectionChanged.connect(self._on_template_selected)
        self.template_list.itemChanged.connect(self._on_item_changed)
        left_layout.addWidget(QLabel("تصاویر مرجع ذخیره‌شده:"))
        left_layout.addWidget(self.template_list, 1)
        splitter.addWidget(left)

        right = QWidget()
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(8)
        self.template_preview = QLabel("تصویری انتخاب نشده است.")
        self.template_preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.template_preview.setMinimumHeight(110)
        self.template_preview.setStyleSheet(
            f"background:{COLORS['bg_alt']}; border:1px dashed {COLORS['border']}; border-radius:10px;"
            f"color:{COLORS['muted']};"
        )
        right_layout.addWidget(self.template_preview)

        form = QFormLayout()
        form.setSpacing(8)
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("نام نمایشی تصویر مرجع")
        self.name_edit.editingFinished.connect(self._rename_selected)
        form.addRow("نام:", self.name_edit)

        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(0.0, 0.99)
        self.threshold_spin.setSingleStep(0.01)
        self.threshold_spin.setDecimals(2)
        self.threshold_spin.setSpecialValueText("خودکار (از تنظیمات)")
        self.threshold_spin.valueChanged.connect(self._on_threshold_changed)
        form.addRow("آستانهٔ اختصاصی:", self.threshold_spin)
        right_layout.addLayout(form)

        buttons = QGridLayout()
        buttons.setSpacing(8)
        self.capture_button = ActionButton("گرفتن دکمه از صفحه", "primary", glyph="target")
        self.load_button = ActionButton("بارگذاری فایل تصویر")
        self.preview_button = ActionButton("پیش‌نمایش بزرگ")
        self.replace_button = ActionButton("جایگزینی تصویر")
        self.delete_button = ActionButton("حذف تصویر", "danger")
        self.open_folder_button = ActionButton("بازکردن پوشهٔ تصاویر")
        buttons.addWidget(self.capture_button, 0, 0)
        buttons.addWidget(self.load_button, 0, 1)
        buttons.addWidget(self.preview_button, 1, 0)
        buttons.addWidget(self.replace_button, 1, 1)
        buttons.addWidget(self.delete_button, 2, 0)
        buttons.addWidget(self.open_folder_button, 2, 1)
        right_layout.addLayout(buttons)
        right_layout.addStretch(1)
        splitter.addWidget(right)
        splitter.setSizes([440, 520])
        layout.addWidget(splitter, 1)

        note = QLabel("نکته: می‌توانید چند تصویر مرجع برای اندازه‌ها و ظاهرهای مختلف دکمه ذخیره کنید. "
                      "برنامه همهٔ تصاویر فعال را هم‌زمان بررسی می‌کند.")
        note.setObjectName("Hint")
        note.setWordWrap(True)
        layout.addWidget(note)

        self.capture_button.clicked.connect(self.capture_template)
        self.load_button.clicked.connect(self.load_template_file)
        self.preview_button.clicked.connect(self.preview_selected)
        self.replace_button.clicked.connect(self.replace_selected)
        self.delete_button.clicked.connect(self.delete_selected)
        self.open_folder_button.clicked.connect(self.open_templates_folder)
        return page

    # ------------------------------------------------------------- برگهٔ رنگ
    def _build_color_tab(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        self.mode_color_check = QCheckBox("فعال‌بودن تشخیص با رنگ دکمه")
        self.mode_color_check.toggled.connect(self._on_modes_changed)
        layout.addWidget(self.mode_color_check)

        hint = QLabel("این شیوه برای دکمه‌هایی مناسب است که رنگ ثابت و مشخصی دارند "
                      "(مثلاً دکمهٔ سبز «پاسخ»). روی دکمهٔ سبز «برداشتن رنگ» بزنید و رنگ آن را از صفحه انتخاب کنید.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        row = QHBoxLayout()
        row.setSpacing(10)
        self.color_swatch = QLabel()
        self.color_swatch.setFixedSize(46, 34)
        self.color_swatch.setStyleSheet(
            f"background:{COLORS['green']}; border:1px solid {COLORS['border']}; border-radius:8px;"
        )
        row.addWidget(QLabel("رنگ انتخاب‌شده:"))
        row.addWidget(self.color_swatch)
        self.color_hex_edit = QLineEdit()
        self.color_hex_edit.setMaxLength(7)
        self.color_hex_edit.setFixedWidth(110)
        self.color_hex_edit.editingFinished.connect(self._on_color_hex_changed)
        row.addWidget(self.color_hex_edit)
        self.pick_color_button = ActionButton("برداشتن رنگ از صفحه", "primary", glyph="palette")
        self.pick_color_button.clicked.connect(self.pick_color)
        row.addWidget(self.pick_color_button)
        row.addStretch(1)
        layout.addLayout(row)

        form_box = QGroupBox("تنظیمات دقت رنگ")
        form = QFormLayout(form_box)
        form.setSpacing(9)
        self.tolerance_spin = QSpinBox()
        self.tolerance_spin.setRange(1, 120)
        self.tolerance_spin.setToolTip("مقدار بیشتر = پذیرش رنگ‌های نزدیک‌تر به رنگ انتخابی")
        self.tolerance_spin.valueChanged.connect(self._save_color_settings)
        form.addRow("رواداری رنگ:", self.tolerance_spin)

        self.min_area_spin = QSpinBox()
        self.min_area_spin.setRange(50, 5000000)
        self.min_area_spin.setSingleStep(100)
        self.min_area_spin.valueChanged.connect(self._save_color_settings)
        form.addRow("کمینهٔ مساحت دکمه (پیکسل):", self.min_area_spin)

        self.max_area_spin = QSpinBox()
        self.max_area_spin.setRange(100, 5000000)
        self.max_area_spin.setSingleStep(1000)
        self.max_area_spin.valueChanged.connect(self._save_color_settings)
        form.addRow("بیشینهٔ مساحت دکمه (پیکسل):", self.max_area_spin)

        aspect_row = QHBoxLayout()
        self.min_aspect_spin = QDoubleSpinBox()
        self.min_aspect_spin.setRange(0.1, 50.0)
        self.min_aspect_spin.setSingleStep(0.1)
        self.min_aspect_spin.valueChanged.connect(self._save_color_settings)
        self.max_aspect_spin = QDoubleSpinBox()
        self.max_aspect_spin.setRange(0.1, 50.0)
        self.max_aspect_spin.setSingleStep(0.1)
        self.max_aspect_spin.valueChanged.connect(self._save_color_settings)
        aspect_row.addWidget(self.min_aspect_spin)
        aspect_row.addWidget(QLabel("تا"))
        aspect_row.addWidget(self.max_aspect_spin)
        aspect_row.addStretch(1)
        wrapper = QWidget()
        wrapper.setLayout(aspect_row)
        form.addRow("نسبت پهنا به بلندی:", wrapper)

        self.pick_from_result_button = ActionButton("برداشتن رنگ از نتیجهٔ آزمون")
        self.pick_from_result_button.clicked.connect(self._pick_color_from_preview)
        form.addRow("", self.pick_from_result_button)
        layout.addWidget(form_box)
        layout.addStretch(1)
        return page

    # ------------------------------------------------------------- برگهٔ متن
    def _build_text_tab(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        self.mode_text_check = QCheckBox("فعال‌بودن تشخیص با متن دکمه")
        self.mode_text_check.toggled.connect(self._on_modes_changed)
        layout.addWidget(self.mode_text_check)

        self.ocr_status_label = QLabel("در حال بررسی موتور OCR ویندوز ...")
        self.ocr_status_label.setObjectName("Hint")
        self.ocr_status_label.setWordWrap(True)
        layout.addWidget(self.ocr_status_label)

        hint = QLabel("متن دکمهٔ پاسخ را بنویسید (با ویرگول جدا کنید). برنامه با استفاده از موتور متن‌خوان داخلی "
                      "ویندوز، متن روی صفحه را می‌خواند و اگر با یکی از این واژه‌ها هم‌خوانی داشته باشد، "
                      "همان نقطه را کلیک می‌کند. این شیوه برای دکمه‌هایی مثل «Answer»، «Accept» و «پاسخ» عالی است.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        box = QGroupBox("واژه‌های دکمهٔ پاسخ")
        form = QFormLayout(box)
        form.setSpacing(9)
        self.keywords_edit = QLineEdit()
        self.keywords_edit.setPlaceholderText("Answer, Accept, Join, پاسخ")
        self.keywords_edit.editingFinished.connect(self._save_text_settings)
        form.addRow("واژه‌ها:", self.keywords_edit)

        self.similarity_spin = QDoubleSpinBox()
        self.similarity_spin.setRange(0.30, 1.0)
        self.similarity_spin.setSingleStep(0.02)
        self.similarity_spin.setDecimals(2)
        self.similarity_spin.valueChanged.connect(self._save_text_settings)
        form.addRow("کمینهٔ هم‌خوانی:", self.similarity_spin)

        self.word_height_spin = QSpinBox()
        self.word_height_spin.setRange(4, 200)
        self.word_height_spin.valueChanged.connect(self._save_text_settings)
        form.addRow("کمینهٔ بلندی متن (پیکسل):", self.word_height_spin)
        layout.addWidget(box)

        tools = QGroupBox("ابزار آزمون متن")
        tool_layout = QVBoxLayout(tools)
        self.read_text_button = ActionButton("خواندن متن ناحیهٔ پایش", "primary", glyph="text")
        self.read_text_button.clicked.connect(self.read_text_now)
        tool_layout.addWidget(self.read_text_button)
        self.ocr_output = QLabel("برای دیدن متنی که برنامه می‌بیند، روی دکمهٔ بالا بزنید.")
        self.ocr_output.setObjectName("MutedText")
        self.ocr_output.setWordWrap(True)
        tool_layout.addWidget(self.ocr_output)
        layout.addWidget(tools)
        layout.addStretch(1)
        return page

    # ------------------------------------------------------------- بارگذاری
    def _load_config_into_widgets(self) -> None:
        config = self.context.config
        self._loading = True
        self.mode_template_check.setChecked(bool(config.get("detection.modes.template", True)))
        self.mode_color_check.setChecked(bool(config.get("detection.modes.color", False)))
        self.mode_text_check.setChecked(bool(config.get("detection.modes.text", False)))
        hex_color = str(config.get("detection.color.hex", "#22C55E"))
        self.color_hex_edit.setText(hex_color)
        self._apply_swatch(hex_color)
        self.tolerance_spin.setValue(int(config.get("detection.color.tolerance", 26)))
        self.min_area_spin.setValue(int(config.get("detection.color.min_area", 900)))
        self.max_area_spin.setValue(int(config.get("detection.color.max_area", 400000)))
        self.min_aspect_spin.setValue(float(config.get("detection.color.min_aspect", 1.2)))
        self.max_aspect_spin.setValue(float(config.get("detection.color.max_aspect", 12.0)))
        self.keywords_edit.setText("، ".join(config.get("detection.text.keywords", []) or []))
        self.similarity_spin.setValue(float(config.get("detection.text.similarity", 0.70)))
        self.word_height_spin.setValue(int(config.get("detection.text.min_word_height", 8)))
        self._loading = False
        self._refresh_ocr_status()

    def reload_config(self) -> None:
        """بازخوانی مقادیر تنظیمات در ابزارها (هنگام نمایش صفحه) تا نمایش کامل و درست باشد."""
        self._load_config_into_widgets()

    def _refresh_ocr_status(self) -> None:
        from ..core.ocr_engine import available_languages, availability

        ok, message = availability()
        if ok:
            langs = "، ".join(available_languages()) or "نامشخص"
            self.ocr_status_label.setText(f"وضعیت موتور متن‌خوان ویندوز: <b>در دسترس</b> (زبان‌های نصب‌شده: {langs})")
        else:
            self.ocr_status_label.setText(f"وضعیت موتور متن‌خوان ویندوز: <b>در دسترس نیست</b> — {message}")

    def refresh_templates(self) -> None:
        """بازخوانی فهرست تصاویر مرجع."""
        self.template_list.blockSignals(True)
        self.template_list.clear()
        for info in self.context.store.list_templates():
            image = self.context.store.load_image(info)
            item = QListWidgetItem(info.name)
            item.setData(Qt.ItemDataRole.UserRole, info.name)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(Qt.CheckState.Checked if info.enabled else Qt.CheckState.Unchecked)
            if image is not None:
                item.setIcon(QIcon(image_to_pixmap(image)))
                item.setToolTip(f"{info.name} — {image.shape[1]}×{image.shape[0]} پیکسل")
            else:
                item.setToolTip("فایل تصویر یافت نشد")
            self.template_list.addItem(item)
        self.template_list.blockSignals(False)
        if self.template_list.count() and not self.template_list.currentItem():
            self.template_list.setCurrentRow(0)
        self._on_template_selected()

    def _selected_name(self) -> str:
        item = self.template_list.currentItem()
        return str(item.data(Qt.ItemDataRole.UserRole)) if item else ""

    def _on_template_selected(self) -> None:
        name = self._selected_name()
        info = self.context.store.get(name) if name else None
        self._loading = True
        if info is None:
            self.template_preview.setPixmap(QPixmap())
            self.template_preview.setText("تصویری انتخاب نشده است.")
            self.name_edit.setText("")
            self.threshold_spin.setValue(0.0)
            self.replace_button.setEnabled(False)
            self.delete_button.setEnabled(False)
            self.preview_button.setEnabled(False)
        else:
            image = self.context.store.load_image(info)
            if image is not None:
                self.template_preview.setPixmap(image_to_pixmap(image, 470, 110))
            self.name_edit.setText(info.name)
            self.threshold_spin.setValue(float(info.confidence) if info.confidence else 0.0)
            self.replace_button.setEnabled(True)
            self.delete_button.setEnabled(True)
            self.preview_button.setEnabled(True)
        self._loading = False

    def _on_item_changed(self, item: QListWidgetItem) -> None:
        name = str(item.data(Qt.ItemDataRole.UserRole))
        enabled = item.checkState() == Qt.CheckState.Checked
        info = self.context.store.get(name)
        if info is None or info.enabled == enabled:
            return
        self.context.store.update(name, enabled=enabled)
        self.context.log("مدیریت تصویر دکمه", "موفق",
                         f"تصویر «{name}» {'فعال' if enabled else 'غیرفعال'} شد.")

    def _on_threshold_changed(self, value: float) -> None:
        if getattr(self, "_loading", False):
            return
        name = self._selected_name()
        if not name:
            return
        self.context.store.update(name, confidence=(float(value) if value > 0 else None))

    def _rename_selected(self) -> None:
        if getattr(self, "_loading", False):
            return
        name = self._selected_name()
        new_name = self.name_edit.text().strip()
        if not name or not new_name or new_name == name:
            return
        info = self.context.store.rename(name, new_name)
        if info is not None:
            self.context.log("مدیریت تصویر دکمه", "موفق", f"«{name}» به «{info.name}» تغییر نام یافت.")

    # ------------------------------------------------------------- عملیات
    def capture_template(self) -> None:
        """گرفتن تصویر دکمه از صفحه (پوشش انتخاب)."""
        self.context.selector.start("template")

    def on_template_captured(self, frame: np.ndarray) -> None:
        try:
            info = self.context.store.add_from_array(frame, name=self._auto_template_name())
        except Exception as exc:
            self.context.notifications.notify("خطا در ذخیرهٔ تصویر", str(exc), "error")
            return
        self.refresh_templates()
        self._select_by_name(info.name)
        self.context.log("مدیریت تصویر دکمه", "موفق",
                         f"تصویر مرجع «{info.name}» از صفحه گرفته و ذخیره شد.")
        self.context.notifications.notify("تصویر دکمه ذخیره شد",
                                          f"«{info.name}» به فهرست تصاویر مرجع افزوده شد.", "success")
        self._ensure_template_mode()

    def _auto_template_name(self) -> str:
        base = time.strftime("answer_%Y%m%d_%H%M%S")
        return base

    def _ensure_template_mode(self) -> None:
        if not self.context.config.get("detection.modes.template", True):
            self.mode_template_check.setChecked(True)
            self._on_modes_changed()

    def _select_by_name(self, name: str) -> None:
        for index in range(self.template_list.count()):
            item = self.template_list.item(index)
            if str(item.data(Qt.ItemDataRole.UserRole)) == name:
                self.template_list.setCurrentRow(index)
                return

    def load_template_file(self) -> None:
        paths, _ = QFileDialog.getOpenFileNames(
            self, "انتخاب فایل تصویر دکمه", str(Path.home()),
            "تصاویر (*.png *.jpg *.jpeg *.bmp *.webp)",
        )
        if not paths:
            return
        added = 0
        for path in paths:
            try:
                self.context.store.import_file(Path(path))
                added += 1
            except Exception as exc:
                self.context.notifications.notify("خطا در بارگذاری تصویر", f"{Path(path).name}: {exc}", "error")
        if added:
            self.refresh_templates()
            self.context.log("مدیریت تصویر دکمه", "موفق", f"{added} فایل تصویر بارگذاری شد.")
            self._ensure_template_mode()

    def preview_selected(self) -> None:
        name = self._selected_name()
        info = self.context.store.get(name) if name else None
        if info is None:
            return
        image = self.context.store.load_image(info)
        if image is None:
            self.context.notifications.notify("خطا", "فایل تصویر یافت نشد.", "error")
            return
        ImagePreviewDialog(image, f"پیش‌نمایش «{info.name}»", self).exec()

    def replace_selected(self) -> None:
        name = self._selected_name()
        if not name:
            return
        self._replace_target = name
        self.context.selector.start("template")

    def on_replace_captured(self, frame: np.ndarray) -> None:
        name = getattr(self, "_replace_target", "")
        if not name:
            return
        try:
            self.context.store.replace_image(name, frame)
        except Exception as exc:
            self.context.notifications.notify("خطا در جایگزینی", str(exc), "error")
            return
        self.refresh_templates()
        self._select_by_name(name)
        self.context.log("مدیریت تصویر دکمه", "موفق", f"تصویر «{name}» جایگزین شد.")
        self._replace_target = ""

    def delete_selected(self) -> None:
        name = self._selected_name()
        if not name:
            return
        if self.context.store.delete(name):
            self.refresh_templates()
            self.context.log("مدیریت تصویر دکمه", "موفق", f"تصویر «{name}» حذف شد.")

    def open_templates_folder(self) -> None:
        import os

        folder = self.context.store.directory
        folder.mkdir(parents=True, exist_ok=True)
        try:
            os.startfile(str(folder))  # noqa: S606 - بازکردن پوشه در ویندوز
        except Exception:
            self.context.notifications.notify("خطا", "بازکردن پوشه ناموفق بود.", "error")

    # ---------------------------------------------------------------- رنگ
    def pick_color(self) -> None:
        self.context.selector.start("color")

    def on_color_picked(self, color_hex: str) -> None:
        self.color_hex_edit.setText(color_hex.upper())
        self._apply_swatch(color_hex)
        self.context.config.set("detection.color.hex", color_hex.upper())
        if not self.mode_color_check.isChecked():
            self.mode_color_check.setChecked(True)
            self._on_modes_changed()
        self.context.log("تغییر تنظیمات", "موفق", f"رنگ دکمهٔ پاسخ به {color_hex.upper()} تغییر یافت.")
        self.context.notifications.notify("رنگ انتخاب شد", f"رنگ دکمهٔ پاسخ: {color_hex.upper()}", "success")

    def _apply_swatch(self, color_hex: str) -> None:
        self.color_swatch.setStyleSheet(
            f"background:{color_hex}; border:1px solid {COLORS['border']}; border-radius:8px;"
        )

    def _on_color_hex_changed(self) -> None:
        text = self.color_hex_edit.text().strip()
        if not text.startswith("#"):
            text = "#" + text
        if len(text) not in (4, 7):
            self.color_hex_edit.setText(str(self.context.config.get("detection.color.hex", "#22C55E")))
            return
        self.color_hex_edit.setText(text.upper())
        self._apply_swatch(text)
        self.context.config.set("detection.color.hex", text.upper())

    def _save_color_settings(self) -> None:
        if getattr(self, "_loading", False):
            return
        self.context.config.update({
            "detection.color.tolerance": int(self.tolerance_spin.value()),
            "detection.color.min_area": int(self.min_area_spin.value()),
            "detection.color.max_area": int(self.max_area_spin.value()),
            "detection.color.min_aspect": float(self.min_aspect_spin.value()),
            "detection.color.max_aspect": float(self.max_aspect_spin.value()),
        })
        self.context.log("تغییر تنظیمات", "موفق", "تنظیمات دقت رنگ به‌روزرسانی شد.")

    def _pick_color_from_preview(self) -> None:
        """برداشتن رنگ از تصویر آخرین نتیجهٔ آزمون."""
        image = getattr(self, "_last_frame", None)
        if image is None:
            self.context.notifications.notify("رنگ", "ابتدا یک آزمون تشخیص اجرا کنید.", "warn")
            return
        height, width = image.shape[:2]
        center = image[height // 2, width // 2]
        hex_color = f"#{int(center[2]):02X}{int(center[1]):02X}{int(center[0]):02X}"
        self.on_color_picked(hex_color)

    # ---------------------------------------------------------------- متن
    def _save_text_settings(self) -> None:
        if getattr(self, "_loading", False):
            return
        raw = self.keywords_edit.text()
        keywords = [part.strip() for part in raw.replace("،", ",").split(",") if part.strip()]
        self.context.config.update({
            "detection.text.keywords": keywords,
            "detection.text.similarity": round(float(self.similarity_spin.value()), 2),
            "detection.text.min_word_height": int(self.word_height_spin.value()),
        })
        self.context.log("تغییر تنظیمات", "موفق", f"واژه‌های دکمهٔ پاسخ: {', '.join(keywords) or '—'}")

    def read_text_now(self) -> None:
        """خواندن متن ناحیهٔ پایش و نمایش آن به کاربر."""
        from ..core.monitor import DetectionTester

        self.ocr_output.setText("در حال خواندن متن ...")
        tester = DetectionTester(self.context.config, self.context.detector)
        tester.finished_result.connect(self._on_text_read)
        tester.failed.connect(lambda message: self.ocr_output.setText(f"خطا: {message}"))
        tester.start()
        self._text_tester = tester

    def _on_text_read(self, result, frame, origin) -> None:
        matcher = self.context.detector.text_matcher
        lines = getattr(matcher, "_last_lines", [])
        if not lines:
            self.ocr_output.setText("هیچ متنی در ناحیهٔ پایش خوانده نشد. مطمئن شوید دکمهٔ پاسخ در ناحیهٔ پایش دیده می‌شود.")
            return
        pieces = []
        for line in lines[:12]:
            pieces.append(f"«{line.text.strip()}»")
        text = "، ".join(pieces)
        if result is not None and result.found:
            extra = f"\n<b>نتیجه: واژهٔ «{result.label}» با اطمینان {result.confidence * 100:.0f}% یافت شد.</b>"
        else:
            extra = "\nنتیجه: هیچ‌یک از واژه‌های تعیین‌شده در متن بالا پیدا نشد."
        self.ocr_output.setText(f"متن خوانده‌شده: {text}{extra}")

    # ---------------------------------------------------------------- عمومی
    def _on_modes_changed(self) -> None:
        if getattr(self, "_loading", False):
            return
        modes = {
            "template": self.mode_template_check.isChecked(),
            "color": self.mode_color_check.isChecked(),
            "text": self.mode_text_check.isChecked(),
        }
        if not any(modes.values()):
            sender = self.sender()
            if sender is self.mode_template_check:
                self.mode_template_check.setChecked(True)
            elif sender is self.mode_color_check:
                self.mode_color_check.setChecked(True)
            else:
                self.mode_text_check.setChecked(True)
            modes = {
                "template": self.mode_template_check.isChecked(),
                "color": self.mode_color_check.isChecked(),
                "text": self.mode_text_check.isChecked(),
            }
            self.context.notifications.notify("توجه", "دست‌کم یک شیوهٔ تشخیص باید فعال باشد.", "warn")
        self.context.config.update({
            "detection.modes.template": modes["template"],
            "detection.modes.color": modes["color"],
            "detection.modes.text": modes["text"],
        })
        self.modes_changed.emit(modes)

    def apply_detection_config(self) -> None:
        """اعمال تغییرات برگهٔ جاری روی تنظیمات (هنگام خروج از صفحه)."""
        self._save_color_settings()
        self._save_text_settings()

    def show_test_result(self, result, frame, origin=(0, 0)) -> None:
        """نمایش نتیجهٔ آزمون تشخیص."""
        self._last_frame = frame
        if frame is not None:
            if result is not None and result.found:
                left, top, width, height = result.box
                local_box = (left - origin[0], top - origin[1], width, height)
                self.result_preview.set_frame(frame, local_box, (0, 0))
            else:
                self.result_preview.set_frame(frame, None, (0, 0))
        if result is None:
            self.result_label.setText("نتیجه‌ای به‌دست نیامد.")
            return
        if result.found:
            self.result_label.setText(
                f"<b style='color:{COLORS['green']}'>دکمهٔ پاسخ شناسایی شد.</b><br>"
                f"شیوه: {result.title} | برچسب: {result.label}<br>"
                f"اطمینان: {result.confidence * 100:.1f}% (آستانه {result.threshold * 100:.1f}%)<br>"
                f"نقطهٔ کلیک در صفحه: ({result.center_x}, {result.center_y})<br>"
                f"زمان تشخیص: {result.elapsed_ms:.0f} میلی‌ثانیه"
            )
        else:
            reasons = []
            for item in (result.candidates or [])[:4]:
                if "confidence" in item:
                    reasons.append(f"{item.get('template', '')} @ {item.get('scale')} ⇒ "
                                   f"{float(item.get('confidence', 0)) * 100:.1f}%")
                elif "score" in item and "aspect" in item:
                    reasons.append(f"رنگ: مساحت {item.get('area')} نسبت {item.get('aspect')} ⇒ "
                                   f"{float(item.get('score', 0)) * 100:.1f}%")
                elif "word" in item:
                    reasons.append(f"متن «{item.get('word')}» ⇒ {float(item.get('score', 0)) * 100:.1f}%")
            details = "<br>".join(reasons) or "نامزد معتبری یافت نشد."
            self.result_label.setText(
                f"<b style='color:{COLORS['orange']}'>دکمهٔ پاسخ شناسایی نشد.</b><br>"
                f"بالاترین اطمینان: {result.confidence * 100:.1f}% — آستانهٔ لازم: "
                f"{result.threshold * 100:.1f}%<br>جزئیات نامزدها:<br>{details}"
            )
