; ============================================================
;  SMART AUTO ANSWER — اسکریپت نصب (اختیاری)
;  برای ساخت بستهٔ نصب، برنامهٔ رایگان Inno Setup را نصب کنید
;  و این فایل را باز کرده و روی Compile بزنید.
;  خروجی: build\installer\SmartAutoAnswerSetup.exe
; ============================================================

#define MyAppName "SMART AUTO ANSWER"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SmartAutoAnswer"
#define MyAppExeName "SmartAutoAnswer.exe"

[Setup]
AppId={{8F2C1A64-7B31-4D2E-9C58-5A1B2C3D4E5F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\SmartAutoAnswer
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=SmartAutoAnswerSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\..\assets\icons\app.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "ساخت آیکون روی میزکار"; GroupDescription: "آیکون ها:"

[Files]
Source: "..\..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\assets\icons\app.ico"; DestDir: "{app}\assets\icons"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\icons\app.ico"
Name: "{group}\حذف {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\icons\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "اجرای {#MyAppName}"; Flags: nowait postinstall skipifsilent
