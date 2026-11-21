"""نقطهٔ ورود برنامهٔ SMART AUTO ANSWER.

این فایل سرویس‌ها را می‌سازد، پنجرهٔ اصلی را باز می‌کند و برنامه را اجرا می‌کند.
هم در حالت «اجرای کد» و هم در حالت «فایل اجرایی بسته‌بندی‌شده» کار می‌کند.
"""

from __future__ import annotations

import argparse
import sys
import traceback
from datetime import datetime
from pathlib import Path

# اطمینان از اینکه بستهٔ smart_auto_answer هنگام اجرای مستقیم فایل پیدا می‌شود
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def _write_startup_error(text: str) -> None:
    """نوشتن خطاهای راه‌اندازی در فایل تا در حالت بدون کنسول قابل بررسی باشد."""
    try:
        from smart_auto_answer.core import paths

        paths.logs_dir().mkdir(parents=True, exist_ok=True)
        target = paths.logs_dir() / "startup_error.log"
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(f"[{datetime.now().isoformat(timespec='seconds')}]\n{text}\n{'-' * 70}\n")
    except Exception:
        pass


def _install_excepthook() -> None:
    """ثبت قلاب خطا تا هر خطای پیش‌بینی‌نشده در فایل ثبت شود."""

    def _hook(exc_type, exc, tb) -> None:
        text = "".join(traceback.format_exception(exc_type, exc, tb))
        _write_startup_error(text)
        try:
            sys.__excepthook__(exc_type, exc, tb)
        except Exception:
            pass

    sys.excepthook = _hook


def _close_splash() -> None:
    """بستن صفحهٔ خوش‌آمدگویی PyInstaller (اگر وجود داشته باشد)."""
    try:
        import pyi_splash  # type: ignore[import-not-found]
    except Exception:
        return
    try:
        if pyi_splash.is_alive():
            pyi_splash.close()
    except Exception:
        pass


def _place_window_on_screen(window) -> None:
    """اطمینان از دیده‌شدن پنجره روی یکی از نمایشگرهای فعال."""
    try:
        from PySide6.QtGui import QGuiApplication

        frame = window.frameGeometry()
        for screen in QGuiApplication.screens():
            if screen.availableGeometry().intersects(frame):
                return
        screen = QGuiApplication.primaryScreen()
        if screen is None:
            return
        available = screen.availableGeometry()
        window.move(
            available.x() + max(0, (available.width() - window.width()) // 2),
            available.y() + max(0, (available.height() - window.height()) // 2),
        )
    except Exception:
        pass


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SMART AUTO ANSWER")
    parser.add_argument("--tray", action="store_true",
                        help="اجرا در نوار وظیفه بدون نمایش پنجره")
    parser.add_argument("--autostart", action="store_true",
                        help="اجرای خودکار همراه ویندوز (همراه با پایش خودکار)")
    return parser.parse_args()


def _build_fallback_icon():
    """ساخت آیکون برنامه در صورت نبود فایل آیکون."""
    from PySide6.QtCore import QPointF, QRectF, Qt
    from PySide6.QtGui import QBrush, QColor, QIcon, QPainter, QPen, QPixmap, QPolygonF

    pixmap = QPixmap(256, 256)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    painter.setBrush(QBrush(QColor("#0F1729")))
    painter.setPen(Qt.PenStyle.NoPen)
    painter.drawRoundedRect(QRectF(8, 8, 240, 240), 52, 52)

    # گوشی سبز
    painter.setBrush(QBrush(QColor("#22C55E")))
    painter.drawRoundedRect(QRectF(84, 78, 88, 104), 22, 22)
    painter.setBrush(QBrush(QColor("#0F1729")))
    painter.drawRoundedRect(QRectF(102, 96, 52, 60), 12, 12)

    # علامت تأیید
    pen = QPen(QColor("#FFFFFF"))
    pen.setWidthF(16)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    painter.setPen(pen)
    painter.drawPolyline(QPolygonF([QPointF(150, 168), QPointF(178, 196), QPointF(224, 132)]))
    painter.end()
    return QIcon(pixmap)


def load_app_icon():
    """بارگذاری آیکون برنامه از فایل؛ در صورت نبود، آیکون جایگزین ساخته می‌شود."""
    from PySide6.QtGui import QIcon

    from smart_auto_answer.core import paths

    icon_path = paths.app_icon_file()
    if icon_path.exists():
        icon = QIcon(str(icon_path))
        if not icon.isNull():
            return icon
    return _build_fallback_icon()


def main() -> int:
    args = _parse_args()
    _install_excepthook()

    # ۱) آگاهی از DPI باید پیش از ساخت QApplication انجام شود
    from smart_auto_answer.core import paths, winutils

    winutils.enable_dpi_awareness()

    # ۲) تک‌نسخه‌ای: اگر برنامه از قبل اجراست، همان پنجره به جلو می‌آید
    if not winutils.acquire_single_instance():
        # به نسخهٔ در حال اجرا اطلاع می‌دهیم پنجرهٔ خود را نشان دهد (حتی از نوار وظیفه)
        if not winutils.signal_show_existing():
            winutils.focus_existing_instance()
        return 0
    winutils.create_show_signal()

    paths.ensure_directories()
    paths.ensure_default_assets()

    from PySide6.QtCore import Qt
    from PySide6.QtWidgets import QApplication

    from smart_auto_answer.core.click_engine import ClickEngine
    from smart_auto_answer.core.detector import Detector
    from smart_auto_answer.core.safety_manager import SafetyManager
    from smart_auto_answer.core.template_store import TemplateStore
    from smart_auto_answer.services.configuration_service import ConfigurationService
    from smart_auto_answer.services.logging_service import LoggingService
    from smart_auto_answer.services.notification_service import NotificationService
    from smart_auto_answer.ui.context import AppContext
    from smart_auto_answer.ui.region_selector import ScreenSelector
    from smart_auto_answer.ui.screen_mapper import ScreenMapper
    from smart_auto_answer.ui.theme import app_font, build_stylesheet

    app = QApplication(sys.argv)
    app.setApplicationName("SmartAutoAnswer")
    app.setApplicationDisplayName("SMART AUTO ANSWER")
    app.setOrganizationName("SmartAutoAnswer")
    app.setQuitOnLastWindowClosed(False)
    app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
    app.setFont(app_font(12))
    try:
        app.setStyle("Fusion")
    except Exception:
        pass
    app.setStyleSheet(build_stylesheet())

    icon = load_app_icon()
    app.setWindowIcon(icon)

    # ۳) ساخت سرویس‌ها
    config = ConfigurationService(paths.settings_file())
    logger = LoggingService(paths.logs_dir())
    store = TemplateStore(paths.templates_dir())
    detector = Detector(store)
    notifications = NotificationService()
    mapper = ScreenMapper()
    selector = ScreenSelector()
    click_engine = ClickEngine()
    safety = SafetyManager()
    safety.auto_click_enabled = bool(config.get("general.auto_click_enabled", True))
    safety.configure(
        cooldown_ms=int(config.get("click.cooldown_ms", 3000)),
        max_clicks_per_minute=int(config.get("click.max_clicks_per_minute", 15)),
        release_frames=int(config.get("click.release_frames", 3)),
        min_confidence=float(config.get("detection.confidence", 0.86)),
    )

    context = AppContext(
        config=config, store=store, detector=detector, logger=logger,
        notifications=notifications, mapper=mapper, selector=selector,
        click_engine=click_engine, safety=safety, config_path=paths.settings_file(),
    )

    from smart_auto_answer.ui.main_window import MainWindow

    window = MainWindow(context, icon=icon, start_hidden=args.tray)
    window.show()
    _close_splash()
    if not args.tray:
        _place_window_on_screen(window)
        window.raise_()
        window.activateWindow()

    # ۴) اجرای خودکار همراه ویندوز: پرچم پایش خودکار را روشن می‌کند
    if args.autostart and config.get("general.start_monitoring_on_launch", False):
        window.start_monitoring()

    return app.exec()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # نمایش خطای خوانا در بدترین حالت
        try:
            from PySide6.QtWidgets import QApplication, QMessageBox

            app = QApplication.instance() or QApplication(sys.argv)
            QMessageBox.critical(
                None, "خطای اجرای برنامه",
                f"برنامه نتوانست به‌درستی اجرا شود:\n\n{exc}\n\n"
                f"لطفاً فایل technical.log را در پوشهٔ logs بررسی کنید.",
            )
        except Exception:
            print(f"خطای اجرای برنامه: {exc}")
        sys.exit(1)
