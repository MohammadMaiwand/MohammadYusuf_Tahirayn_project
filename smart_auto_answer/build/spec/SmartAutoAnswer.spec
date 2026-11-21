# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('D:/Project_working/Auto_Clicker/smart_auto_answer/assets', 'assets')]
binaries = []
hiddenimports = ['winrt', 'winrt.system', 'winrt.windows.foundation', 'winrt.windows.foundation.collections', 'winrt.windows.globalization', 'winrt.windows.graphics.imaging', 'winrt.windows.media.ocr', 'winrt.windows.security.cryptography', 'winrt.windows.storage.streams', 'mss', 'cv2', 'numpy', 'PySide6.QtCore', 'PySide6.QtGui', 'PySide6.QtWidgets']
tmp_ret = collect_all('winrt')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['D:/Project_working/Auto_Clicker/smart_auto_answer/main.py'],
    pathex=['D:/Project_working/Auto_Clicker'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'scipy', 'pandas', 'PIL', 'IPython', 'jupyter', 'notebook', 'pytest', 'setuptools', 'pip', 'wheel', 'PySide6.QtQml', 'PySide6.QtQuick', 'PySide6.QtQuickWidgets', 'PySide6.QtWebEngineCore', 'PySide6.QtWebEngineWidgets', 'PySide6.QtWebChannel', 'PySide6.Qt3DCore', 'PySide6.Qt3DRender', 'PySide6.QtMultimedia', 'PySide6.QtMultimediaWidgets', 'PySide6.QtCharts', 'PySide6.QtDataVisualization', 'PySide6.QtBluetooth', 'PySide6.QtDesigner', 'PySide6.QtHelp', 'PySide6.QtOpenGL', 'PySide6.QtSql', 'PySide6.QtTest', 'PySide6.QtNetworkAuth', 'PySide6.QtPositioning', 'PySide6.QtSerialPort', 'PySide6.QtSensors', 'PySide6.QtRemoteObjects', 'PySide6.QtScxml', 'PySide6.QtSpatialAudio', 'PySide6.QtStateMachine', 'PySide6.QtTextToSpeech', 'PySide6.QtUiTools'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
splash = Splash(
    'D:/Project_working/Auto_Clicker/smart_auto_answer/assets/icons/splash.png',
    binaries=a.binaries,
    datas=a.datas,
    text_pos=None,
    text_size=12,
    minify_script=True,
    always_on_top=True,
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    splash,
    splash.binaries,
    [],
    name='SmartAutoAnswer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['D:/Project_working/Auto_Clicker/smart_auto_answer/assets/icons/app.ico'],
)
