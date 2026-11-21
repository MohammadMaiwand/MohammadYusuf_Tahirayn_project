@echo off
chcp 65001 >nul
setlocal enableextensions

rem ============================================================
rem  SMART AUTO ANSWER - لانچر هوشمند
rem  این فایل برنامه را با یک کلیک اجرا می کند.
rem  ترتیب تلاش:
rem    1) فایل اجرایی ساخته شده  (dist\SmartAutoAnswer.exe)
rem    2) اجرای کد پایتون       (pythonw + main.py)
rem ============================================================

set "HERE=%~dp0"

rem --- 1) فایل اجرایی آماده ---
if exist "%HERE%dist\SmartAutoAnswer.exe" (
    start "" "%HERE%dist\SmartAutoAnswer.exe"
    exit /b 0
)
if exist "%HERE%SmartAutoAnswer.exe" (
    start "" "%HERE%SmartAutoAnswer.exe"
    exit /b 0
)

rem --- 2) اجرای کد پایتون ---
set "PYW="
where pythonw.exe >nul 2>nul && set "PYW=pythonw.exe"
if not defined PYW (
    where py.exe >nul 2>nul && set "PYW=py.exe -w"
)
if not defined PYW (
    where python.exe >nul 2>nul && set "PYW=python.exe"
)

if not defined PYW (
    echo.
    echo   پایتون روی این کمپیوتر پیدا نشد.
    echo   لطفا فایل اجرایی SmartAutoAnswer.exe را از پوشهٔ build بسازید
    echo   یا پایتون 3.12 یا بالاتر را نصب کنید.
    echo.
    pause
    exit /b 1
)

start "" %PYW% "%HERE%main.py"
exit /b 0
