"""ساخت فایل اجرایی ویندوز (SmartAutoAnswer.exe) با PyInstaller.

اجرا:  python build/build_exe.py
خروجی: smart_auto_answer/dist/SmartAutoAnswer.exe
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
ENTRY = PROJECT / "main.py"
ICON = PROJECT / "assets" / "icons" / "app.ico"
SPLASH = PROJECT / "assets" / "icons" / "splash.png"
ASSETS = PROJECT / "assets"
DIST = PROJECT / "dist"
WORK = PROJECT / "build" / "work"
SPEC = PROJECT / "build" / "spec"

# ماژول‌های سنگین و بی‌استفاده که برای کوچک‌شدن حجم و سریع‌ترشدن اجرا کنار گذاشته می‌شوند
EXCLUDED_MODULES = [
    "matplotlib", "scipy", "pandas", "PIL", "IPython", "jupyter", "notebook",
    "pytest", "setuptools", "pip", "wheel",
    "PySide6.QtQml", "PySide6.QtQuick", "PySide6.QtQuickWidgets",
    "PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets", "PySide6.QtWebChannel",
    "PySide6.Qt3DCore", "PySide6.Qt3DRender",
    "PySide6.QtMultimedia", "PySide6.QtMultimediaWidgets",
    "PySide6.QtCharts", "PySide6.QtDataVisualization",
    "PySide6.QtBluetooth", "PySide6.QtDesigner", "PySide6.QtHelp",
    "PySide6.QtOpenGL", "PySide6.QtSql", "PySide6.QtTest", "PySide6.QtNetworkAuth",
    "PySide6.QtPositioning", "PySide6.QtSerialPort", "PySide6.QtSensors",
    "PySide6.QtRemoteObjects", "PySide6.QtScxml", "PySide6.QtSpatialAudio",
    "PySide6.QtStateMachine", "PySide6.QtTextToSpeech", "PySide6.QtUiTools",
]

HIDDEN_IMPORTS = [
    "winrt",
    "winrt.system",
    "winrt.windows.foundation",
    "winrt.windows.foundation.collections",
    "winrt.windows.globalization",
    "winrt.windows.graphics.imaging",
    "winrt.windows.media.ocr",
    "winrt.windows.security.cryptography",
    "winrt.windows.storage.streams",
    "mss",
    "cv2",
    "numpy",
    "PySide6.QtCore",
    "PySide6.QtGui",
    "PySide6.QtWidgets",
]


def main() -> int:
    if not ENTRY.exists():
        print("فایل main.py پیدا نشد:", ENTRY)
        return 1

    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("PyInstaller نصب نیست. اجرا کنید: python -m pip install pyinstaller")
        return 1

    for folder in (DIST, WORK, SPEC):
        shutil.rmtree(folder, ignore_errors=True)

    command = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean",
        "--onefile",
        "--windowed",
        "--name", "SmartAutoAnswer",
        "--distpath", str(DIST),
        "--workpath", str(WORK),
        "--specpath", str(SPEC),
        "--paths", str(PROJECT.parent),
        "--collect-all", "winrt",
        "--add-data", f"{ASSETS}{';' if sys.platform == 'win32' else ':'}assets",
    ]
    if SPLASH.exists():
        # نمایش تصویر خوش‌آمدگویی هنگام باز‌شدن (باز‌کردن فایل تک‌فایلی چند ثانیه طول می‌کشد)
        command += ["--splash", str(SPLASH)]
    if ICON.exists():
        command += ["--icon", str(ICON)]
    for name in EXCLUDED_MODULES:
        command += ["--exclude-module", name]
    for name in HIDDEN_IMPORTS:
        command += ["--hidden-import", name]
    command.append(str(ENTRY))

    print("در حال ساخت فایل اجرایی ...")
    print(" ".join(command))
    result = subprocess.run(command, cwd=str(PROJECT))
    if result.returncode != 0:
        print("ساخت با خطا مواجه شد.")
        return result.returncode

    output = DIST / ("SmartAutoAnswer.exe" if sys.platform == "win32" else "SmartAutoAnswer")
    if output.exists():
        size_mb = output.stat().st_size / (1024 * 1024)
        print(f"ساخته شد: {output}  ({size_mb:.1f} مگابایت)")
        return 0
    print("فایل خروجی پیدا نشد.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
