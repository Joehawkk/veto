@echo off
title VETO — остановка
cd /d "%~dp0"
echo Останавливаем VETO...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0host.ps1" stop
echo Готово.
pause
