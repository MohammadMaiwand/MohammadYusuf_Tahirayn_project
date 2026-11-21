"""پنجرهٔ اصلی برنامه: ناوبری صفحه‌ها، چرخهٔ پایش، میان‌برها و ناحیهٔ اعلان."""

from __future__ import annotations

import time

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QCloseEvent, QIcon
from PySide6.QtWidgets import (
    QApplication, QButtonGroup, QFrame, QHBoxLayout, QLabel, QMainWindow, QMessageBox,
    QPushButton, QStackedWidget, QVBoxLayout, QWidget,
)

from ..core import winutils
from ..core.monitor import (
    STATUS_DETECTED, STATUS_ERROR, STATUS_IDLE, STATUS_MONITORING, STATUS_WAITING,
    DetectionTester, MonitorWorker,
)
from ..core.shortcut_manager import ShortcutManager
from ..services import logging_service as events
from .context import AppContext
from .dashboard import DashboardPage
from .image_manager import ImageManagerPage
from .logs_viewer import LogsPage
from .settings_view import SettingsPage
from .tray_manager import TrayManager
from .widgets import StatusPill, Toast

_PAGE_INFO = [
    ("داشبورد", "وضعیت زنده، آمار و کنترل‌های اصلی"),
    ("پیکربندی دکمهٔ پاسخ", "دکمهٔ پاسخ را با تصویر، رنگ یا متن دکمه تنظیم کنید"),
    ("تنظیمات", "زمان‌بندی، ناحیهٔ پایش، ایمنی کلیک و میان‌برهای کلیدی"),
    ("رویدادها", "گزارش کامل فعالیت‌های برنامه"),
]


class MainWindow(QMainWindow):
    """پنجرهٔ اصلی همراه با سایدبار، صفحه‌ها، پایش پس‌زمینه و نوار وظیفه."""

    def __init__(self, context: AppContext, icon: QIcon | None = None,
                 start_hidden: bool = False) -> None:
        super().__init__()
        self.context = context
        self.worker: MonitorWorker | None = None
        self.shortcuts: ShortcutManager | None = None
        self._tester: DetectionTester | None = None
        self._monitoring = False
        self._force_quit = False
        self._capture_excluded = False
        self._last_error_text = ""
        self._last_error_notice = 0.0

        self.setWindowTitle("SMART AUTO ANSWER — پاسخ‌دهندهٔ هوشمند تماس")
        self.setMinimumSize(980, 660)
        self.resize(int(context.config.get("ui.window_width", 1180)),
                    int(context.config.get("ui.window_height", 780)))
        if icon is not None:
            self.setWindowIcon(icon)

        self._build_ui()
        self._build_tray(icon)
        self._connect_pages()
        self._sync_from_config()
        self._setup_shortcuts()

        context.notifications.attach_tray(self.tray.tray)
        context.notifications.attach_window(self)
        context.notifications.notifications_enabled = bool(
            context.config.get("general.notifications_enabled", True))
        context.notifications.sound_enabled = bool(
            context.config.get("general.sound_enabled", True))

        self.context.config.setting_changed.connect(self._on_setting_changed)

        self.toast = Toast(self.centralWidget())
        self._heartbeat_timer = QTimer(self)
        self._heartbeat_timer.setInterval(700)
        self._heartbeat_timer.timeout.connect(self._refresh_sidebar_stats)
        self._heartbeat_timer.start()

        # بررسی دوره‌ای سیگنال «نمایش پنجره» از نسخهٔ دوم برنامه (زمانی که کاربر دوباره فایل را باز می‌کند)
        self._show_signal_timer = QTimer(self)
        self._show_signal_timer.setInterval(600)
        self._show_signal_timer.timeout.connect(self._poll_show_signal)
        self._show_signal_timer.start()

        if start_hidden:
            QTimer.singleShot(60, self.hide_to_tray)
        if bool(context.config.get("general.start_monitoring_on_launch", False)):
            QTimer.singleShot(400, self.start_monitoring)

        self.context.log(events.EVENT_APP_START, events.STATUS_INFO,
                         "برنامه اجرا شد و آمادهٔ پایش است.")

    # ------------------------------------------------------------- ساخت رابط
    def _build_ui(self) -> None:
        root = QWidget()
        root.setObjectName("Root")
        self.setCentralWidget(root)
        outer = QHBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        outer.addWidget(self._build_sidebar())
        outer.addWidget(self._build_content(), 1)

    def _build_sidebar(self) -> QWidget:
        sidebar = QFrame()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(236)
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(12, 8, 12, 12)
        layout.setSpacing(6)

        title = QLabel("SMART AUTO ANSWER")
        title.setObjectName("SidebarTitle")
        layout.addWidget(title)
        subtitle = QLabel("پاسخ خودکار تماس‌های وب")
        subtitle.setObjectName("SidebarSubtitle")
        layout.addWidget(subtitle)

        self.nav_group = QButtonGroup(self)
        self.nav_group.setExclusive(True)
        self.nav_buttons: list[QPushButton] = []
        labels = ["داشبورد", "پیکربندی دکمهٔ پاسخ", "تنظیمات", "رویدادها"]
        for index, text in enumerate(labels):
            button = QPushButton(text)
            button.setCheckable(True)
            button.setProperty("nav", "true")
            button.setCursor(Qt.CursorShape.PointingHandCursor)
            button.setMinimumHeight(38)
            button.clicked.connect(lambda _checked=False, i=index: self.switch_page(i))
            self.nav_group.addButton(button, index)
            self.nav_buttons.append(button)
            layout.addWidget(button)
        layout.addSpacing(6)

        quick = QFrame()
        quick.setObjectName("Card")
        quick_layout = QVBoxLayout(quick)
        quick_layout.setContentsMargins(10, 9, 10, 9)
        quick_layout.setSpacing(6)
        quick_title = QLabel("کنترل سریع")
        quick_title.setObjectName("StatTitle")
        quick_layout.addWidget(quick_title)
        self.sidebar_start = QPushButton("شروع پایش (F8)")
        self.sidebar_start.setProperty("variant", "success")
        self.sidebar_start.clicked.connect(self.start_monitoring)
        self.sidebar_stop = QPushButton("توقف پایش (F9)")
        self.sidebar_stop.setProperty("variant", "danger")
        self.sidebar_stop.clicked.connect(self.stop_monitoring)
        self.sidebar_auto = QPushButton("کلیک خودکار: روشن (F10)")
        self.sidebar_auto.clicked.connect(self.toggle_auto_click)
        quick_layout.addWidget(self.sidebar_start)
        quick_layout.addWidget(self.sidebar_stop)
        quick_layout.addWidget(self.sidebar_auto)
        layout.addWidget(quick)

        layout.addStretch(1)

        self.sidebar_status = StatusPill(compact=True)
        layout.addWidget(self.sidebar_status)
        self.sidebar_stats = QLabel("شناسایی: ۰ | پاسخ: ۰")
        self.sidebar_stats.setObjectName("MutedText")
        self.sidebar_stats.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.sidebar_stats.setWordWrap(True)
        layout.addWidget(self.sidebar_stats)
        return sidebar

    def _build_content(self) -> QWidget:
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        header = QFrame()
        header.setObjectName("AppHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(18, 12, 18, 12)
        header_layout.setSpacing(12)
        texts = QVBoxLayout()
        texts.setSpacing(1)
        self.header_title = QLabel(_PAGE_INFO[0][0])
        self.header_title.setObjectName("AppTitle")
        self.header_subtitle = QLabel(_PAGE_INFO[0][1])
        self.header_subtitle.setObjectName("AppSubtitle")
        texts.addWidget(self.header_title)
        texts.addWidget(self.header_subtitle)
        header_layout.addLayout(texts)
        header_layout.addStretch(1)
        self.header_status = StatusPill()
        self.header_status.setMinimumWidth(260)
        header_layout.addWidget(self.header_status)
        layout.addWidget(header)

        self.stack = QStackedWidget()
        self.stack.setObjectName("PageArea")

        self.dashboard = DashboardPage()
        self.image_manager = ImageManagerPage(self.context)
        self.settings_page = SettingsPage(self.context)
        self.logs_page = LogsPage(self.context)
        for page in (self.dashboard, self.image_manager, self.settings_page, self.logs_page):
            self.stack.addWidget(page)
        layout.addWidget(self.stack, 1)

        self.nav_buttons[0].setChecked(True)
        return container

    def _build_tray(self, icon: QIcon | None) -> None:
        self.tray = TrayManager(icon or QIcon(), self)
        self.tray.show_requested.connect(self.show_window)
        self.tray.start_requested.connect(self.start_monitoring)
        self.tray.stop_requested.connect(self.stop_monitoring)
        self.tray.toggle_auto_requested.connect(self.toggle_auto_click)
        self.tray.test_requested.connect(self.test_detection)
        self.tray.emergency_stop_requested.connect(self.toggle_emergency)
        self.tray.open_settings_requested.connect(lambda: self.switch_page(2))
        self.tray.open_logs_requested.connect(lambda: self.switch_page(3))
        self.tray.quit_requested.connect(self.quit_app)
        if self.tray.available:
            self.tray.show()
        self.tray.set_monitoring(False)

    # ---------------------------------------------------------------- اتصالات
    def _connect_pages(self) -> None:
        self.dashboard.start_requested.connect(self.start_monitoring)
        self.dashboard.stop_requested.connect(self.stop_monitoring)
        self.dashboard.test_requested.connect(self.test_detection)
        self.dashboard.settings_requested.connect(lambda: self.switch_page(2))
        self.dashboard.logs_requested.connect(lambda: self.switch_page(3))
        self.dashboard.emergency_stop_requested.connect(self.toggle_emergency)
        self.dashboard.preview_toggled.connect(self._on_preview_toggled)
        self.dashboard.bind_auto_toggle(self.toggle_auto_click)

        self.image_manager.test_requested.connect(self.test_detection)

        self.settings_page.region_changed.connect(self._on_region_changed)
        self.settings_page.settings_applied.connect(self._apply_runtime_settings)
        self.settings_page.shortcuts_changed.connect(self._on_shortcuts_changed)
        self.settings_page.reset_requested.connect(self._on_reset_requested)

        selector = self.context.selector
        selector.region_selected.connect(self._on_region_selected)
        selector.template_captured.connect(self._on_template_captured)
        selector.color_picked.connect(self._on_color_picked)
        selector.cancelled.connect(self._on_selection_cancelled)

    def _sync_from_config(self) -> None:
        """هم‌سازی وضعیت اولیهٔ رابط با تنظیمات ذخیره‌شده."""
        auto_click = bool(self.context.config.get("general.auto_click_enabled", True))
        self.context.safety.auto_click_enabled = auto_click
        self.dashboard.set_auto_click(auto_click)
        self.sidebar_auto.setText(f"کلیک خودکار: {'روشن' if auto_click else 'خاموش'} (F10)")
        self.tray.set_auto_click(auto_click)
        self.dashboard.set_monitoring(False)
        self.dashboard.set_status(STATUS_IDLE)
        self.header_status.set_status(STATUS_IDLE)
        self.sidebar_status.set_status(STATUS_IDLE)
        self.dashboard.set_preview_enabled(bool(self.context.config.get("ui.live_preview", True)))
        self.dashboard.set_hint("برای شروع، روی «شروع پایش» بزنید یا کلید F8 را فشار دهید.")
        self._apply_runtime_settings(quiet=True)
        self._refresh_sidebar_stats()

    # ------------------------------------------------------------- ناوبری
    def switch_page(self, index: int) -> None:
        if not 0 <= index < self.stack.count():
            return
        self.stack.setCurrentIndex(index)
        self.nav_buttons[index].setChecked(True)
        self.header_title.setText(_PAGE_INFO[index][0])
        self.header_subtitle.setText(_PAGE_INFO[index][1])
        if index == 0:
            self.dashboard.set_preview_enabled(bool(self.context.config.get("ui.live_preview", True)))
        elif index == 1:
            self.image_manager.reload_config()
            self.image_manager.refresh_templates()
        elif index == 2:
            self.settings_page.reload()
            self.settings_page.refresh_region_label()
        elif index == 3:
            self.logs_page.reload()

    # ------------------------------------------------------- چرخهٔ پایش
    def start_monitoring(self) -> None:
        """آغاز پایش در رشتهٔ پس‌زمینه."""
        if self.worker is not None and self.worker.isRunning():
            self._toast("پایش در حال اجراست.", "info")
            return
        if not self._has_detection_source():
            self._toast("پیش از شروع، دکمهٔ پاسخ را تنظیم کنید (تصویر، رنگ یا متن).", "warn")
            self.switch_page(1)
            return

        self._apply_runtime_settings(quiet=True)
        self.context.click_engine.reset_stop()
        self.context.safety.reset_session()
        self.context.safety.auto_click_enabled = bool(
            self.context.config.get("general.auto_click_enabled", True))

        worker = MonitorWorker(
            self.context.config, self.context.store, self.context.detector,
            self.context.click_engine, self.context.safety, self.context.logger,
        )
        worker.status_changed.connect(self._on_status)
        worker.heartbeat.connect(self._on_heartbeat)
        worker.call_detected.connect(self._on_call_detected)
        worker.clicked.connect(self._on_clicked)
        worker.error_occurred.connect(self._on_worker_error)
        worker.cycle_finished.connect(self._on_cycle_finished)
        worker.preview_ready.connect(self._on_preview_ready)
        worker.finished.connect(lambda w=worker: self._on_worker_finished(w))
        self.worker = worker
        self._monitoring = True
        worker.start()
        self._push_exclusion_rect()

        self.dashboard.set_monitoring(True)
        self.tray.set_monitoring(True)
        self.sidebar_start.setEnabled(False)
        self.sidebar_stop.setEnabled(True)
        self.dashboard.set_hint("پایش فعال است. برنامه تماس‌های ورودی را زیر نظر دارد. برای توقف F9 را بزنید.")
        self.dashboard.set_detail("پایش فعال — در انتظار تماس ورودی ...")
        self.dashboard.set_status(STATUS_MONITORING)
        self.context.notifications.monitoring_started()
        self.context.log(events.EVENT_MONITOR_START, events.STATUS_OK,
                         f"پایش با فاصلهٔ {self.context.config.interval_ms()} میلی‌ثانیه آغاز شد.")

    def stop_monitoring(self) -> None:
        """توقف ایمن پایش."""
        worker = self.worker
        self.worker = None
        self._monitoring = False
        if worker is not None:
            worker.stop_monitoring()
            if not worker.wait(3000):
                self.context.logger.technical_error("رشتهٔ پایش در زمان مقرر متوقف نشد.")
        self.context.safety.reset_session()
        self.dashboard.set_monitoring(False)
        self.tray.set_monitoring(False)
        self.sidebar_start.setEnabled(True)
        self.sidebar_stop.setEnabled(False)
        self.dashboard.set_status(STATUS_IDLE)
        self.header_status.set_status(STATUS_IDLE)
        self.sidebar_status.set_status(STATUS_IDLE)
        self.dashboard.set_detail("پایش متوقف است.")
        self.dashboard.set_hint("برای شروع دوباره، «شروع پایش» را بزنید یا F8 را فشار دهید.")
        self.dashboard.preview.clear_frame()
        self.context.notifications.monitoring_stopped()
        self.context.log(events.EVENT_MONITOR_STOP, events.STATUS_INFO, "پایش تماس‌ها متوقف شد.")

    def _on_worker_finished(self, worker: MonitorWorker) -> None:
        if self.worker is worker:
            self.worker = None

    def toggle_auto_click(self) -> None:
        """روشن/خاموش‌کردن کلیک خودکار."""
        self.set_auto_click(not bool(self.context.config.get("general.auto_click_enabled", True)))

    def set_auto_click(self, enabled: bool) -> None:
        enabled = bool(enabled)
        self.context.config.set("general.auto_click_enabled", enabled)
        self.context.safety.auto_click_enabled = enabled
        self.dashboard.set_auto_click(enabled)
        self.tray.set_auto_click(enabled)
        self.sidebar_auto.setText(f"کلیک خودکار: {'روشن' if enabled else 'خاموش'} (F10)")
        self.context.notifications.auto_click_toggled(enabled)
        self.context.log(events.EVENT_CONFIG_CHANGED, events.STATUS_OK,
                         f"کلیک خودکار {'روشن' if enabled else 'خاموش'} شد.")

    def toggle_emergency(self) -> None:
        """فعال/غیرفعال‌کردن توقف اضطراری کلیک."""
        active = not bool(self.context.safety.emergency_stop)
        self.context.safety.set_emergency_stop(active)
        if active:
            self.context.click_engine.request_stop()
        else:
            self.context.click_engine.reset_stop()
        self.dashboard.set_emergency(active)
        self.tray.set_emergency(active)
        message = "توقف اضطراری فعال شد؛ هیچ کلیکی انجام نمی‌شود." if active else "توقف اضطراری لغو شد."
        self.context.notifications.notify("توقف اضطراری", message, "warn" if active else "success")
        self._toast(message, "warn" if active else "success")
        self.context.log(events.EVENT_CONFIG_CHANGED, events.STATUS_WARN if active else events.STATUS_OK,
                         message)

    # ---------------------------------------------------------------- آزمون
    def test_detection(self) -> None:
        """اجرای یک‌بارهٔ تشخیص بدون هیچ کلیکی."""
        if self._tester is not None and self._tester.isRunning():
            return
        if not self._has_detection_source():
            self._toast("ابتدا دکمهٔ پاسخ را تنظیم کنید (تصویر، رنگ یا متن).", "warn")
            self.switch_page(1)
            return
        self._toast("در حال آزمون تشخیص ...", "info")
        tester = DetectionTester(self.context.config, self.context.detector,
                                 exclude_rect=self._window_exclusion_rect())
        tester.finished_result.connect(self._on_test_result)
        tester.failed.connect(self._on_test_failed)
        tester.finished.connect(self._cleanup_tester)
        self._tester = tester
        tester.start()

    def _cleanup_tester(self) -> None:
        self._tester = None

    def _on_test_result(self, result, frame, origin) -> None:
        self.dashboard.set_preview(frame, None, origin)
        if result is not None and result.found:
            left, top, width, height = result.box
            self.dashboard.set_preview(frame, (max(0, left - origin[0]), max(0, top - origin[1]),
                                               width, height), (0, 0))
        self.dashboard.set_detection_info(result)
        self.image_manager.show_test_result(result, frame, origin)
        if result is not None and result.found:
            self.context.log(events.EVENT_TEST, events.STATUS_OK,
                             f"آزمون تشخیص موفق: {result.describe()}")
            self.context.notifications.notify(
                "آزمون تشخیص", f"دکمهٔ پاسخ شناسایی شد.\nاطمینان: {result.confidence * 100:.1f}%", "success")
            self._toast(f"دکمهٔ پاسخ شناسایی شد ({result.confidence * 100:.0f}%)", "success")
        else:
            confidence = result.confidence if result is not None else 0.0
            self.context.log(events.EVENT_TEST, events.STATUS_WARN,
                             f"آزمون تشخیص: دکمهٔ پاسخ یافت نشد (بالاترین اطمینان {confidence * 100:.1f}%).")
            self.context.notifications.notify(
                "آزمون تشخیص", f"دکمهٔ پاسخ یافت نشد (بالاترین اطمینان {confidence * 100:.1f}%).", "warn")
            self._toast("دکمهٔ پاسخ یافت نشد؛ تنظیمات را بررسی کنید.", "warn")

    def _on_test_failed(self, message: str) -> None:
        self.context.log(events.EVENT_TEST, events.STATUS_FAIL, message, level="error")
        self.context.notifications.detection_error(message)
        self._toast(message, "error")

    # -------------------------------------------------------- سیگنال‌های پایش
    def _on_status(self, status: str) -> None:
        self.dashboard.set_status(status)
        self.header_status.set_status(status)
        self.sidebar_status.set_status(status)
        self.tray.set_status(status)
        if status == STATUS_IDLE and self._monitoring:
            self._monitoring = False
            self.dashboard.set_monitoring(False)
            self.tray.set_monitoring(False)
            self.sidebar_start.setEnabled(True)
            self.sidebar_stop.setEnabled(False)
        elif status == STATUS_MONITORING:
            self.dashboard.set_detail("پایش فعال — در انتظار تماس ورودی ...")
        elif status == STATUS_WAITING:
            remaining = self.context.safety.seconds_until_cooldown_end()
            if remaining > 0:
                self.dashboard.set_detail(f"خنک‌سازی پس از کلیک — {remaining:.1f} ثانیه باقی مانده")
            else:
                self.dashboard.set_detail("پایش فعال — کلیک خودکار خاموش است.")
        elif status == STATUS_DETECTED:
            self.dashboard.set_detail("تماس ورودی شناسایی شد — آمادهٔ پاسخ‌دهی")
        elif status == STATUS_ERROR:
            self.dashboard.set_detail("خطا در پایش؛ برنامه در حال تلاش دوباره است.")

    def _on_heartbeat(self, snapshot: dict) -> None:
        self.dashboard.update_stats(snapshot)
        self.sidebar_stats.setText(
            f"شناسایی: {int(snapshot.get('detected_count', 0)):,} | "
            f"پاسخ: {int(snapshot.get('answered_count', 0)):,}"
        )

    def _on_cycle_finished(self, cycle_ms: float) -> None:
        return

    def _on_preview_ready(self, frame, local_box, origin) -> None:
        # وقتی پنجره پنهان یا کوچک‌شده است، پردازش پیش‌نمایش لازم نیست (صرفه‌جویی پردازنده)
        if self.worker is not None and self.isVisible() and not self.isMinimized():
            self.dashboard.set_preview(frame, local_box, origin)

    def _on_call_detected(self, payload: dict) -> None:
        # اعلان و صدا فقط یک‌بار برای هر تماس پخش می‌شود (نه در هر چرخهٔ پایش)
        if not payload.get("new_call", True):
            return
        # به‌محض زنگ‌خوردن تماس، صدای سیستم خودکار بلند می‌شود تا زنگ و صدای
        # طرف مقابل به‌خوبی شنیده شود (چون پاسخ‌دهی توسط خود برنامه انجام می‌شود).
        self._boost_system_volume()
        confidence = float(payload.get("confidence", 0.0))
        if payload.get("click_allowed", True):
            # پاسخ‌دهی خودکار انجام می‌شود؛ اعلان «پاسخ داده شد» پس از کلیک می‌آید
            return
        reason = payload.get("reason", "")
        if reason:
            self.dashboard.set_detail(f"تماس شناسایی شد ولی کلیک انجام نشد — {reason}")
        self.context.notifications.call_detected(f"اطمینان {confidence * 100:.0f}%")

    def _boost_system_volume(self) -> None:
        """بلندکردن صدای سیستم هنگام تماس بر اساس تنظیمات."""
        config = self.context.config
        if not bool(config.get("general.boost_volume_on_call", True)):
            return
        percent = int(config.get("general.call_volume_percent", 100))
        winutils.boost_system_volume(percent)

    def _on_clicked(self, payload: dict) -> None:
        self.context.notifications.call_answered()
        self._refresh_sidebar_stats()

    def _on_worker_error(self, message: str) -> None:
        self.dashboard.set_detail(f"خطا: {message}")
        # جلوگیری از تکرار پیام/صدای خطای یکسان در فواصل کوتاه
        now = time.time()
        if message == self._last_error_text and (now - self._last_error_notice) < 15.0:
            return
        self._last_error_text = message
        self._last_error_notice = now
        self.context.notifications.detection_error(message)

    # ------------------------------------------------------- منطقه و انتخاب
    def _on_region_selected(self, left: int, top: int, width: int, height: int) -> None:
        self.context.config.set_region(left, top, width, height)
        self.settings_page.refresh_region_label()
        if self.worker is not None:
            self.worker.invalidate_region()
        self.context.log(events.EVENT_CONFIG_CHANGED, events.STATUS_OK,
                         f"ناحیهٔ پایش تعیین شد: ({left}, {top}) اندازه {width}×{height}")
        self._toast(f"ناحیهٔ پایش تعیین شد: {width}×{height}", "success")

    def _on_region_changed(self) -> None:
        if self.worker is not None:
            self.worker.invalidate_region()

    def _on_template_captured(self, frame) -> None:
        if getattr(self.image_manager, "_replace_target", ""):
            self.image_manager.on_replace_captured(frame)
        else:
            self.image_manager.on_template_captured(frame)
        self.switch_page(1)

    def _on_color_picked(self, color_hex: str) -> None:
        self.image_manager.on_color_picked(color_hex)
        self.switch_page(1)

    def _on_selection_cancelled(self) -> None:
        self.image_manager._replace_target = ""

    # ----------------------------------------------------------- تنظیمات
    def _apply_runtime_settings(self, quiet: bool = False) -> None:
        config = self.context.config
        self.context.safety.configure(
            cooldown_ms=int(config.get("click.cooldown_ms", 3000)),
            max_clicks_per_minute=int(config.get("click.max_clicks_per_minute", 15)),
            release_frames=int(config.get("click.release_frames", 3)),
            min_confidence=float(config.get("detection.confidence", 0.86)),
        )
        self.context.detector.invalidate()
        if self.worker is not None:
            self.worker.invalidate_region()
        if not quiet:
            self._toast("تنظیمات اعمال و ذخیره شد.", "success")

    def _on_setting_changed(self, key: str, value) -> None:
        config = self.context.config
        if key.startswith("detection.") or key.startswith("click."):
            self.context.safety.configure(
                cooldown_ms=int(config.get("click.cooldown_ms", 3000)),
                max_clicks_per_minute=int(config.get("click.max_clicks_per_minute", 15)),
                release_frames=int(config.get("click.release_frames", 3)),
                min_confidence=float(config.get("detection.confidence", 0.86)),
            )
            self.context.detector.invalidate()

    def _on_shortcuts_changed(self, mapping: dict) -> None:
        if self.shortcuts is not None:
            enabled = bool(self.context.config.get("shortcuts.enabled", True))
            self.shortcuts.set_mapping(mapping, enabled=enabled)

    def _on_reset_requested(self) -> None:
        answer = QMessageBox.question(
            self, "بازگرداندن تنظیمات",
            "همهٔ تنظیمات به حالت پیش‌فرض بازگردانده شود؟\n"
            "(تصاویر مرجع دکمهٔ پاسخ حذف نمی‌شوند.)",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        self.context.config.reset_to_defaults()
        self.settings_page.reload()
        self.image_manager._load_config_into_widgets()
        self._sync_from_config()
        self._setup_shortcuts()
        self.context.log(events.EVENT_CONFIG_CHANGED, events.STATUS_OK,
                         "تنظیمات به حالت پیش‌فرض بازگردانده شد.")
        self._toast("تنظیمات پیش‌فرض بازگردانده شد.", "success")

    def _on_preview_toggled(self, enabled: bool) -> None:
        self.context.config.set("ui.live_preview", bool(enabled))

    # ------------------------------------------------------ میان‌برهای سراسری
    def _setup_shortcuts(self) -> None:
        if self.shortcuts is not None:
            self.shortcuts.stop()
            self.shortcuts.wait(1200)
        mapping = {
            "start": str(self.context.config.get("shortcuts.start", "F8")),
            "stop": str(self.context.config.get("shortcuts.stop", "F9")),
            "toggle_auto": str(self.context.config.get("shortcuts.toggle_auto", "F10")),
            "panic": str(self.context.config.get("shortcuts.panic", "F12")),
        }
        enabled = bool(self.context.config.get("shortcuts.enabled", True))
        self.shortcuts = ShortcutManager(mapping, enabled)
        self.shortcuts.triggered.connect(self._on_shortcut)
        self.shortcuts.registration_failed.connect(self._on_shortcut_failed)
        self.shortcuts.registration_done.connect(self.settings_page.show_shortcut_status)
        self.shortcuts.start()

    def _on_shortcut(self, action: str) -> None:
        if action == "start":
            self.start_monitoring()
        elif action == "stop":
            self.stop_monitoring()
        elif action == "toggle_auto":
            self.toggle_auto_click()
        elif action == "panic":
            self.toggle_emergency()

    def _on_shortcut_failed(self, action: str, key: str) -> None:
        labels = {"start": "شروع پایش", "stop": "توقف پایش",
                  "toggle_auto": "کلیک خودکار", "panic": "توقف اضطراری"}
        message = (f"ثبت میان‌بر «{key}» برای «{labels.get(action, action)}» ناموفق بود "
                   f"(احتمالاً برنامهٔ دیگری آن را گرفته است). در تنظیمات میان‌بر دیگری انتخاب کنید.")
        self.context.log(events.EVENT_SHORTCUT, events.STATUS_WARN, message, level="warning")
        self._toast(message, "warn", 6000)

    # ------------------------------------------------------------- کمکی‌ها
    def _has_detection_source(self) -> bool:
        config = self.context.config
        modes = config.get("detection.modes", {}) or {}
        if modes.get("template") and self.context.store.enabled_templates():
            return True
        if modes.get("color"):
            return True
        if modes.get("text"):
            return True
        return False

    def _window_exclusion_rect(self) -> tuple[int, int, int, int] | None:
        """مستطیل پنجرهٔ خود برنامه تا از تشخیص کنار گذاشته شود (وقتی دیده می‌شود).

        اگر ویندوز پشتیبانی کند، پنجره در سطح سیستم از تصویربرداری کنار گذاشته می‌شود
        و نیازی به سیاه‌کردن ناحیه نیست.
        """
        if self._capture_excluded:
            return None
        if not self.isVisible() or self.isMinimized():
            return None
        try:
            hwnd = int(self.winId())
        except (TypeError, ValueError):
            return None
        from ..core import winutils

        return winutils.window_rect(hwnd)

    def _push_exclusion_rect(self) -> None:
        """به‌روزرسانی ناحیهٔ کنارگذاشته‌شده در رشتهٔ پایش (بدون قفل‌کردن رابط کاربری)."""
        if self.worker is not None:
            self.worker.set_exclusion_rect(self._window_exclusion_rect())

    def _refresh_sidebar_stats(self) -> None:
        self._push_exclusion_rect()
        snapshot = self.context.safety.snapshot()
        self.sidebar_stats.setText(
            f"شناسایی: {int(snapshot.get('detected_count', 0)):,} | "
            f"پاسخ: {int(snapshot.get('answered_count', 0)):,}"
        )

    def show_toast(self, title: str, message: str, level: str = "info", msec: int = 4000) -> None:
        """نمایش پیام شناور (از سرویس اعلان فراخوانی می‌شود)."""
        if self.isMinimized() or not self.isVisible():
            return
        self.toast.show_message(f"{title} — {message}", level, msec)

    def _toast(self, message: str, level: str = "info", msec: int = 3500) -> None:
        if self.toast is None:
            return
        self.toast.show_message(message, level, msec)

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        if getattr(self, "toast", None) is not None:
            self.toast.reposition()
        self._push_exclusion_rect()

    def moveEvent(self, event) -> None:  # noqa: N802
        super().moveEvent(event)
        self._push_exclusion_rect()

    def showEvent(self, event) -> None:  # noqa: N802
        super().showEvent(event)
        if not self._capture_excluded:
            try:
                hwnd = int(self.winId())
            except (TypeError, ValueError):
                hwnd = 0
            from ..core import winutils

            self._capture_excluded = winutils.exclude_from_capture(hwnd)
        self._push_exclusion_rect()

    # -------------------------------------------------------- نوار وظیفه/خروج
    def hide_to_tray(self) -> None:
        """پنهان‌کردن پنجره و ادامهٔ پایش در نوار وظیفه."""
        if self.tray.available:
            self.tray.show()
        self.hide()
        self._push_exclusion_rect()
        self.context.notifications.notify(
            "SMART AUTO ANSWER",
            "برنامه به نوار وظیفه رفت و پایش ادامه دارد. برای نمایش، روی آیکون کلیک کنید.", "info")

    def show_window(self) -> None:
        """نمایش پنجرهٔ اصلی از نوار وظیفه."""
        self.showNormal()
        self.raise_()
        self.activateWindow()
        self._push_exclusion_rect()
        self.switch_page(self.stack.currentIndex())

    def _poll_show_signal(self) -> None:
        """اگر نسخهٔ دومی از برنامه اجرا شود، پنجرهٔ همین نسخه را به جلو می‌آوریم."""
        from ..core import winutils

        if winutils.consume_show_signal():
            self.show_window()

    def quit_app(self) -> None:
        """خروج کامل و ایمن از برنامه."""
        self._force_quit = True
        self.stop_monitoring()
        if self.shortcuts is not None:
            self.shortcuts.stop()
            self.shortcuts.wait(1200)
            self.shortcuts = None
        self.context.config.set("ui.window_width", int(self.width()))
        self.context.config.set("ui.window_height", int(self.height()))
        if self.tray is not None:
            self.tray.hide()
        self.context.log(events.EVENT_APP_EXIT, events.STATUS_INFO, "برنامه به‌صورت ایمن بسته شد.")
        QApplication.instance().quit()

    def closeEvent(self, event: QCloseEvent) -> None:  # noqa: N802
        if self._force_quit:
            event.accept()
            return
        close_to_tray = bool(self.context.config.get("general.close_to_tray", True))
        ask = bool(self.context.config.get("general.ask_on_close", True))
        if close_to_tray and self.tray.available and ask:
            box = QMessageBox(self)
            box.setWindowTitle("بستن برنامه")
            box.setIcon(QMessageBox.Icon.Question)
            box.setText("پنجرهٔ برنامه بسته شود یا در نوار وظیفه بماند؟")
            box.setInformativeText("اگر در نوار وظیفه بماند، پایش تماس‌ها ادامه پیدا می‌کند.")
            tray_button = box.addButton("رفتن به نوار وظیفه و ادامهٔ پایش", QMessageBox.ButtonRole.AcceptRole)
            exit_button = box.addButton("خروج کامل", QMessageBox.ButtonRole.DestructiveRole)
            box.addButton("لغو", QMessageBox.ButtonRole.RejectRole)
            box.exec()
            clicked = box.clickedButton()
            if clicked is exit_button:
                self.quit_app()
                event.accept()
                return
            if clicked is tray_button:
                self.hide_to_tray()
                event.ignore()
                return
            event.ignore()
            return
        if close_to_tray and self.tray.available:
            self.hide_to_tray()
            event.ignore()
            return
        self.quit_app()
        event.accept()
