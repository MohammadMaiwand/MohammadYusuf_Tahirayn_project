# Smart Auto Answer — حذف میزبان Native Messaging
# با اجرای این اسکریپت، ارتباط افزونهٔ مرورگر با برنامهٔ دسکتاپ قطع می‌شود.

$ErrorActionPreference = "SilentlyContinue"
$HostName = "com.smartautoanswer.host"
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$keys = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
)
foreach ($key in $keys) {
    if (Test-Path $key) {
        Remove-Item -Path $key -Recurse -Force
        Write-Host "حذف شد: $key"
    }
}

foreach ($file in @("com.smartautoanswer.host.json", "host_launcher.bat")) {
    $target = Join-Path $BaseDir $file
    if (Test-Path $target) {
        Remove-Item -Path $target -Force
        Write-Host "حذف شد: $target"
    }
}

Write-Host "حذف میزبان بومی انجام شد." -ForegroundColor Green
