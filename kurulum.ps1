# Ipchat otomatik kurulum scripti (Windows)
#
# SUNUCU kurulumu:
#   - Node.js LTS yoksa indirip sessizce kurar
#   - Bagimliliklari kurar ve web arayuzunu derler
#   - Guvenlik duvarinda 3000 portunu acar
#   - Istege bagli: bilgisayar acilisinda otomatik baslatma
#   - Sunucuyu baslatir ve baglanti adresini gosterir
#
# ISTEMCI kurulumu (Node.js GEREKMEZ):
#   - Sunucu adresini sorar
#   - Masaustune, uygulamayi Messenger boyutunda ayri pencerede acan
#     bir "Ipchat" kisayolu olusturur

param([string]$Secim = '')

$ErrorActionPreference = 'Stop'
$Port = 3000

Write-Host ""
Write-Host "=== IPCHAT KURULUM ===" -ForegroundColor Cyan
Write-Host ""

# ---- Kurulum turu secimi ----
if (-not $Secim) {
    Write-Host "Bu bilgisayar ne olacak?"
    Write-Host "  [1] SUNUCU  (mesajlarin toplandigi ana bilgisayar - agda 1 tane olmali)"
    Write-Host "  [2] ISTEMCI (sadece mesajlasacak bilgisayar - masaustu kisayolu kurulur)"
    $Secim = Read-Host "Seciminiz (1/2)"
}

# =====================================================================
# ISTEMCI KURULUMU (yonetici izni ve Node.js gerekmez)
# =====================================================================
if ($Secim -eq '2') {
    Write-Host ""
    Write-Host "--- Istemci kurulumu ---" -ForegroundColor Cyan
    $addr = Read-Host "Sunucunun adresi (ornek: 192.168.1.10 veya 192.168.1.10:3000)"
    $addr = $addr.Trim()
    if ($addr -notmatch ':\d+$') { $addr = "${addr}:$Port" }
    $url = "http://$addr"

    # Baglanti testi
    try {
        $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 5
        if ($health.app -ne 'ipchat') { throw 'beklenmeyen cevap' }
        Write-Host "Sunucuya ulasildi." -ForegroundColor Green
    } catch {
        Write-Host "UYARI: Sunucuya su an ulasilamadi ($url)." -ForegroundColor Yellow
        Write-Host "Sunucu kapali olabilir; kisayol yine de olusturulacak."
    }

    # Tarayici bul (once Chrome, yoksa Edge - Edge her Windows'ta vardir)
    $browsers = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )
    $browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $browser) {
        Write-Host "HATA: Chrome veya Edge bulunamadi." -ForegroundColor Red
        exit 1
    }

    # Masaustu kisayolu: --app modu adres cubuksuz ayri pencere acar,
    # --window-size ile Messenger boyutunda baslar
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Ipchat.lnk'))
    $lnk.TargetPath = $browser
    $lnk.Arguments = "--app=$url --window-size=800,620"
    $lnk.Description = 'Ipchat - Yerel Ag Mesajlasma'
    $lnk.Save()

    Write-Host ""
    Write-Host "=== ISTEMCI KURULUMU TAMAMLANDI ===" -ForegroundColor Green
    Write-Host "Masaustundeki 'Ipchat' kisayoluna cift tiklayarak baslatabilirsiniz."
    Write-Host "Uygulama kucuk, sabit boyutlu bir pencerede acilir (adres cubugu yok)."
    exit 0
}

if ($Secim -ne '1') {
    Write-Host "Gecersiz secim. 1 veya 2 girin." -ForegroundColor Red
    exit 1
}

# =====================================================================
# SUNUCU KURULUMU
# =====================================================================

# ---- Yonetici olarak yeniden baslat (Node kurulumu ve guvenlik duvari icin gerekli) ----
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Yonetici izni gerekiyor, onay penceresi acilacak..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Secim 1"
    exit
}

$root = Split-Path -Parent $PSCommandPath
Set-Location $root

# ---- 1. Node.js kontrolu / otomatik kurulum ----
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

Refresh-Path
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCmd) {
    Write-Host "[1/5] Node.js zaten kurulu: $(node -v)" -ForegroundColor Green
} else {
    Write-Host "[1/5] Node.js bulunamadi. LTS surumu indiriliyor..." -ForegroundColor Yellow

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
    $version = $lts.version
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
    $msiName = "node-$version-$arch.msi"
    $msiUrl = "https://nodejs.org/dist/$version/$msiName"
    $msiPath = Join-Path $env:TEMP $msiName

    Write-Host "      Indiriliyor: $msiUrl"
    Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing

    Write-Host "      Kuruluyor (sessiz kurulum)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait

    Refresh-Path
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Host "HATA: Node.js kurulumu tamamlanamadi. Lutfen https://nodejs.org adresinden elle kurun." -ForegroundColor Red
        exit 1
    }
    Write-Host "      Node.js kuruldu: $(node -v)" -ForegroundColor Green
}

# ---- 2. Bagimliliklar ----
Write-Host "[2/5] Bagimliliklar kuruluyor (npm install)..." -ForegroundColor Cyan
npm install -w server -w web --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: npm install basarisiz." -ForegroundColor Red; exit 1 }

# ---- 3. Web arayuzu derleme ----
Write-Host "[3/5] Web arayuzu derleniyor (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: build basarisiz." -ForegroundColor Red; exit 1 }

# ---- 4. Guvenlik duvari kurali ----
Write-Host "[4/5] Guvenlik duvarinda $Port portu aciliyor..." -ForegroundColor Cyan
netsh advfirewall firewall delete rule name="Ipchat Sunucu" | Out-Null
netsh advfirewall firewall add rule name="Ipchat Sunucu" dir=in action=allow protocol=TCP localport=$Port | Out-Null
Write-Host "      Kural eklendi." -ForegroundColor Green

# ---- 5. Otomatik baslatma (istege bagli) ----
Write-Host "[5/5] Bilgisayar her acildiginda sunucu otomatik baslasin mi?" -ForegroundColor Cyan
$answer = Read-Host "      (E/H)"
if ($answer -match '^[Ee]') {
    $batPath = Join-Path $root 'baslat.bat'
    schtasks /Create /F /SC ONLOGON /TN "Ipchat Sunucu" /TR "`"$batPath`"" /RL LIMITED | Out-Null
    Write-Host "      Otomatik baslatma ayarlandi (Gorev Zamanlayici: 'Ipchat Sunucu')." -ForegroundColor Green
} else {
    Write-Host "      Atlandi. Sunucuyu elle baslatmak icin: baslat.bat" -ForegroundColor Yellow
}

# ---- Baglanti bilgisi ----
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } |
       Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "=== SUNUCU KURULUMU TAMAMLANDI ===" -ForegroundColor Green
Write-Host ""
Write-Host "Diger bilgisayarlarda istemci kurmak icin: kurulum.bat > secim [2]" -ForegroundColor Cyan
Write-Host "veya tarayicidan su adrese girin:" -ForegroundColor Cyan
foreach ($ip in $ips) {
    Write-Host "    http://${ip}:$Port" -ForegroundColor White
}
Write-Host ""
Write-Host "Sunucu simdi baslatiliyor... (Bu pencereyi kapatabilirsiniz, sunucu ayri pencerede calisir)"
Start-Process cmd.exe -ArgumentList "/k `"cd /d `"$root`" && npm start`""
