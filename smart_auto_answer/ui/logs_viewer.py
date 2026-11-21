"""صفحهٔ رویدادها: نمایش، پالایش، پاک‌سازی و خروجی‌گیری گزارش فعالیت."""

from __future__ import annotations

import os
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView, QComboBox, QFileDialog, QHBoxLayout, QHeaderView, QLabel,
    QLineEdit, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from ..services import logging_service as log_events
from .context import AppContext
from .theme import COLORS
from .widgets import ActionButton, Card, SectionCard

_COLUMNS = [
    ("date", "تاریخ", 96),
    ("time", "زمان", 76),
    ("event", "رویداد", 150),
    ("status", "وضعیت", 88),
    ("description", "شرح", 620),
]

_EVENT_CHOICES = [
    log_events.EVENT_MONITOR_START,
    log_events.EVENT_MONITOR_STOP,
    log_events.EVENT_CALL_DETECTED,
    log_events.EVENT_BUTTON_RECOGNIZED,
    log_events.EVENT_AUTO_CLICK,
    log_events.EVENT_DETECTION_FAILED,
    log_events.EVENT_CONFIG_CHANGED,
    log_events.EVENT_APP_ERROR,
    log_events.EVENT_APP_START,
    log_events.EVENT_APP_EXIT,
    log_events.EVENT_TEMPLATE,
    log_events.EVENT_SHORTCUT,
    log_events.EVENT_TEST,
]

_LEVEL_COLORS = {
    "error": COLORS["red"],
    "warning": COLORS["orange"],
    "warn": COLORS["orange"],
    "info": COLORS["text"],
}


class LogsPage(QWidget):
    """نمایشگر رویدادهای ثبت‌شدهٔ برنامه."""

    def __init__(self, context: AppContext, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.context = context
        self._entries: list[dict] = []

        root = QVBoxLayout(self)
        root.setContentsMargins(16, 14, 16, 16)
        root.setSpacing(12)

        header = Card(padding=12)
        header_row = QHBoxLayout()
        header_row.setSpacing(8)
        title = QLabel("گزارش فعالیت‌ها")
        title.setObjectName("SectionTitle")
        header_row.addWidget(title)
        header_row.addStretch(1)
        self.refresh_button = ActionButton("تازه‌سازی", glyph="list")
        self.clear_button = ActionButton("پاک‌کردن رویدادها", variant="danger")
        self.export_csv_button = ActionButton("خروجی CSV")
        self.export_json_button = ActionButton("خروجی JSON")
        self.open_folder_button = ActionButton("بازکردن پوشهٔ رویدادها")
        for button in (self.refresh_button, self.clear_button, self.export_csv_button,
                       self.export_json_button, self.open_folder_button):
            header_row.addWidget(button)
        header.body().addLayout(header_row)

        hint = QLabel("همهٔ رویدادها به‌صورت محلی ذخیره می‌شوند. هیچ صدای تماس، تصویر یا محتوای گفتگو ثبت نمی‌شود.")
        hint.setObjectName("Hint")
        hint.setWordWrap(True)
        header.body().addWidget(hint)
        root.addWidget(header)

        filter_card = SectionCard("پالایش", "برای یافتن سریع یک رویداد، نوع یا متن آن را مشخص کنید.")
        filter_row = QHBoxLayout()
        filter_row.setSpacing(8)
        filter_row.addWidget(QLabel("نوع رویداد:"))
        self.event_combo = QComboBox()
        self.event_combo.addItem("همهٔ رویدادها", "")
        for event in _EVENT_CHOICES:
            self.event_combo.addItem(event, event)
        self.event_combo.currentIndexChanged.connect(self._apply_filter)
        filter_row.addWidget(self.event_combo)
        filter_row.addWidget(QLabel("جستجو:"))
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("بخشی از شرح یا رویداد را بنویسید ...")
        self.search_edit.textChanged.connect(self._apply_filter)
        filter_row.addWidget(self.search_edit, 1)
        self.count_label = QLabel("۰ رویداد")
        self.count_label.setObjectName("MutedText")
        filter_row.addWidget(self.count_label)
        filter_card.content().addLayout(filter_row)
        root.addWidget(filter_card)

        self.table = QTableWidget(0, len(_COLUMNS))
        self.table.setHorizontalHeaderLabels([title for _, title, _ in _COLUMNS])
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.setWordWrap(False)
        self.table.setHorizontalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.table.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        header_view = self.table.horizontalHeader()
        for index, (_, _, width) in enumerate(_COLUMNS):
            header_view.setSectionResizeMode(index, QHeaderView.ResizeMode.Interactive)
            self.table.setColumnWidth(index, width)
        header_view.setStretchLastSection(True)
        root.addWidget(self.table, 1)

        self.refresh_button.clicked.connect(self.reload)
        self.clear_button.clicked.connect(self._clear)
        self.export_csv_button.clicked.connect(lambda: self._export("csv"))
        self.export_json_button.clicked.connect(lambda: self._export("json"))
        self.open_folder_button.clicked.connect(self._open_folder)

        self._reload_timer = QTimer(self)
        self._reload_timer.setSingleShot(True)
        self._reload_timer.setInterval(350)
        self._reload_timer.timeout.connect(self.reload)
        try:
            context.logger.entry_added.connect(self._schedule_reload)
        except (RuntimeError, AttributeError):
            pass

        self.reload()

    # ------------------------------------------------------------- بارگذاری
    def _schedule_reload(self, _entry: dict) -> None:
        if self.isVisible():
            self._reload_timer.start()

    def reload(self) -> None:
        """خواندن دوبارهٔ رویدادها از فایل."""
        try:
            self._entries = self.context.logger.read(limit=5000, newest_first=True)
        except Exception:
            self._entries = []
        self._apply_filter()

    def _apply_filter(self) -> None:
        event_filter = str(self.event_combo.currentData() or "")
        needle = self.search_edit.text().strip().lower()
        rows: list[dict] = []
        for entry in self._entries:
            if event_filter and entry.get("event") != event_filter:
                continue
            if needle:
                haystack = f"{entry.get('event', '')} {entry.get('description', '')} " \
                           f"{entry.get('status', '')}".lower()
                if needle not in haystack:
                    continue
            rows.append(entry)
        self._fill_table(rows)

    def _fill_table(self, rows: list[dict]) -> None:
        self.table.setUpdatesEnabled(False)
        self.table.setRowCount(len(rows))
        for row_index, entry in enumerate(rows):
            for col_index, (key, _, _) in enumerate(_COLUMNS):
                item = QTableWidgetItem(str(entry.get(key, "")))
                item.setToolTip(str(entry.get(key, "")))
                if key in ("date", "time", "status"):
                    item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                if key == "status":
                    level = str(entry.get("level", "info"))
                    color = _LEVEL_COLORS.get(level, COLORS["text"])
                    item.setForeground(QColor(color))
                self.table.setItem(row_index, col_index, item)
        self.table.setUpdatesEnabled(True)
        self.count_label.setText(f"{len(rows):,} رویداد")

    # ------------------------------------------------------------- عملیات
    def _clear(self) -> None:
        try:
            self.context.logger.clear()
        except Exception:
            pass
        self.reload()

    def _export(self, fmt: str) -> None:
        from ..core.paths import exports_dir

        default_dir = exports_dir()
        default_dir.mkdir(parents=True, exist_ok=True)
        suffix = "csv" if fmt == "csv" else "json"
        suggested = str(default_dir / f"activity_report.{suffix}")
        path, _ = QFileDialog.getSaveFileName(
            self, "ذخیرهٔ گزارش رویدادها", suggested,
            "CSV (*.csv)" if fmt == "csv" else "JSON (*.json)",
        )
        if not path:
            return
        try:
            saved = self.context.logger.export(Path(path), fmt)
        except Exception as exc:
            self.context.notifications.notify("خطا در خروجی‌گیری", str(exc), "error")
            return
        self.context.log("خروجی گزارش", "موفق", f"گزارش رویدادها ذخیره شد: {saved}")
        self.context.notifications.notify("خروجی گزارش", f"گزارش ذخیره شد:\n{saved}", "success")

    def _open_folder(self) -> None:
        folder = self.context.logger.directory
        folder.mkdir(parents=True, exist_ok=True)
        try:
            os.startfile(str(folder))  # noqa: S606 - بازکردن پوشه در ویندوز
        except Exception:
            self.context.notifications.notify("خطا", "بازکردن پوشه ناموفق بود.", "error")
