@echo off
:: Ipchat kurulumunu temizler: sunucuyu durdurur, otomatik baslatmayi, guvenlik duvari kuralini
:: ve masaustu kisayolunu siler. Klasorun kendisini ve Node.js'i silmez.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kaldir.ps1"
pause
