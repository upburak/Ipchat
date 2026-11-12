@echo off
:: Ipchat tek-tik kurulum baslatici.
:: PowerShell scriptini yonetici olarak calistirir.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kurulum.ps1"
pause
