@echo off
:: Ipchat sunucusunu durdurur (arka planda calisan node surecini kapatir).
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*src\index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Durduruldu: PID ' + $_.ProcessId) }"
echo Tamam.
pause
