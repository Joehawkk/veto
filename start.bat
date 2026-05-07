@echo off
title VETO — запуск
cd /d "%~dp0"

echo Запускаем VETO...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0host.ps1" start

echo.
echo Ждём публичную ссылку...
:wait_url
if exist ".codex-run\public-url.txt" (
  set /p PUBLIC_URL=<".codex-run\public-url.txt"
  echo.
  echo ============================================
  echo  Сайт доступен по ссылке:
  echo  %PUBLIC_URL%
  echo ============================================
  echo.
  echo Чтобы остановить — закрой это окно или запусти stop.bat
  pause
) else (
  timeout /t 2 /nobreak >nul
  goto wait_url
)
