# Smart Auto Answer — نصب‌کنندهٔ میزبان Native Messaging
# این اسکریپت ارتباط افزونهٔ مرورگر (کروم/اِج) با برنامهٔ دسکتاپ را فعال می‌کند.
#
# نمونهٔ اجرا (PowerShell، بدون نیاز به دسترسی مدیر):
#   .\install_host.ps1 -ExtensionId "abcdefghijklmnopabcdefghijklmnop"
#
# شناسهٔ افزونه را از صفحهٔ chrome://extensions (حالت Developer mode) بردارید.

param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId,

    [string]$PythonPath = ""
)

$ErrorActionPreference = "Stop"

$HostName = "com.smartautoanswer.host"
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $BaseDir

if ($ExtensionId -notmatch '^[a-p]{32}$') {
    Write-Warning "شناسهٔ افزونه معمولاً ۳۲ حرف کوچک a-p است. مقدار داده‌شده: $ExtensionId"
}

# --- یافتن مسیر پایتون ---
if (-not $PythonPath) {
    $candidates = @()
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }
    $candidates += @(
        "C:\Python315\python.exe",
        "C:\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python315\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { $PythonPath = $candidate; break }
    }
}
if (-not $PythonPath -or -not (Test-Path $PythonPath)) {
    throw "پایتون پیدا نشد. لطفاً با پارامتر -PythonPath مسیر python.exe را مشخص کنید."
}
Write-Host "پایتون: $PythonPath"

# --- ساخت فایل اجرایی میزبان (bat) ---
$LauncherPath = Join-Path $BaseDir "host_launcher.bat"
$HostScript = Join-Path $BaseDir "saa_native_host.py"
@"
@echo off
"$PythonPath" "$HostScript"
"@ | Set-Content -Path $LauncherPath -Encoding ASCII
Write-Host "راه‌انداز میزبان ساخته شد: $LauncherPath"

# --- ساخت فایل مانیفست میزبان ---
$ManifestPath = Join-Path $BaseDir "com.smartautoanswer.host.json"
$manifest = [ordered]@{
    name            = $HostName
    description     = "Smart Auto Answer native messaging host"
    path            = $LauncherPath
    type            = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $ManifestPath -Encoding UTF8
Write-Host "مانیفست میزبان ساخته شد: $ManifestPath"

# --- ثبت در رجیستری برای کروم و اِج ---
$browsers = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
)
foreach ($key in $browsers) {
    New-Item -Path $key -Force | Out-Null
    Set-Item -Path $key -Value $ManifestPath
    Write-Host "ثبت شد: $key"
}

# --- آماده‌سازی فایل دستورها ---
$LogsDir = Join-Path $ProjectDir "logs"
if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir | Out-Null }

Write-Host ""
Write-Host "نصب میزبان بومی با موفقیت انجام شد." -ForegroundColor Green
Write-Host "افزونه را در مرورگر یک‌بار غیرفعال و دوباره فعال کنید تا اتصال برقرار شود."
