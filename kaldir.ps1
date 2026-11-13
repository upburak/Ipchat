# Ipchat kaldirma scripti (kurulum.bat ile kurulan surum icin)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Yonetici izni gerekiyor, onay penceresi acilacak..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "=== IPCHAT KALDIRMA ===" -ForegroundColor Cyan

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*src\index.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Sunucu durduruldu (PID $($_.ProcessId))" -ForegroundColor Green }

schtasks /Delete /F /TN "Ipchat Sunucu" 2>$null | Out-Null
Write-Host "Otomatik baslatma gorevi silindi (varsa)." -ForegroundColor Green

netsh advfirewall firewall delete rule name="Ipchat Sunucu" | Out-Null
Write-Host "Guvenlik duvari kurali silindi (varsa)." -ForegroundColor Green

$lnk = [IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Ipchat.lnk')
if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "Masaustu kisayolu silindi." -ForegroundColor Green }

$root = Split-Path -Parent $PSCommandPath
Write-Host ""
Write-Host "Kalanlar (istersen elle silebilirsin):" -ForegroundColor Cyan
Write-Host "  - Bu klasor ve icindeki mesaj veritabani: $root"
Write-Host "  - Node.js: Ayarlar > Uygulamalar > Node.js > Kaldir"
Write-Host "  - Masaustu uygulamasi kuruluysa: Ayarlar > Uygulamalar > Ipchat > Kaldir"
Write-Host "    (mesaj verisi: $env:APPDATA\ipchat-desktop)"
