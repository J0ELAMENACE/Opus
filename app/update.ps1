# update.ps1 - Mise a jour des vendors + deploy vers l'app installee
$ErrorActionPreference = 'Stop'

$vendors = [ordered]@{
    'react.min.js'          = 'https://unpkg.com/react@18/umd/react.production.min.js'
    'react-dom.min.js'      = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
    # 'babel.min.js' n'est plus utilise (JSX pre-transpile)
    'tailwind.js'           = 'https://cdn.tailwindcss.com'
    'space-grotesk-400.ttf' = 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf'
    'space-grotesk-500.ttf' = 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf'
    'space-grotesk-600.ttf' = 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42Vksj.ttf'
    'space-grotesk-700.ttf' = 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf'
}

$src       = $PSScriptRoot
$vendorDir = Join-Path $src 'assets\vendor'
$asarDest  = "$env:LOCALAPPDATA\Programs\Opus\resources\app.asar"

# ── 1. Vendors ──────────────────────────────────────────────────────────────
if (-not (Test-Path $vendorDir)) {
    New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
}

Write-Host ''
Write-Host 'Opus - Mise a jour' -ForegroundColor Cyan
Write-Host '========================================'
Write-Host 'Etape 1/3 : Telechargement des vendors'
Write-Host ''

$ok    = 0
$fails = @()

foreach ($file in $vendors.Keys) {
    $url  = $vendors[$file]
    $dest = Join-Path $vendorDir $file
    Write-Host -NoNewline ('  ' + $file + ' ... ')
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 30
        $kb = [math]::Round((Get-Item $dest).Length / 1KB, 1)
        Write-Host ('OK (' + $kb + ' KB)') -ForegroundColor Green
        $ok++
    } catch {
        Write-Host 'ECHEC' -ForegroundColor Red
        $fails += $file
    }
}

if ($fails.Count -gt 0) {
    Write-Host ('  Echecs : ' + ($fails -join ', ')) -ForegroundColor Yellow
    Write-Host '  Vendors indisponibles mais on continue.' -ForegroundColor Yellow
}

# ── 2. Sauvegarde index.html ────────────────────────────────────────────────
Write-Host ''
Write-Host 'Etape 2/3 : Sauvegarde de index.html'
$stamp  = Get-Date -Format 'yyyyMMdd-HHmm'
$backup = Join-Path $src ('index.backup.' + $stamp + '.html')
$indexSrc = Join-Path $src 'index.html'
if (Test-Path $indexSrc) {
    Copy-Item $indexSrc $backup
    Write-Host ('  Sauvegarde : index.backup.' + $stamp + '.html') -ForegroundColor Green
}

# ── 3. Deploy vers l'app installee ─────────────────────────────────────────
Write-Host ''
Write-Host 'Etape 3/3 : Deploiement vers l app installee'

if (-not (Test-Path $asarDest)) {
    Write-Host '  App installee introuvable. Lance npm start pour tester en dev.' -ForegroundColor Yellow
    Write-Host ''
    Push-Location $src
    npm start
    Pop-Location
    exit 0
}

# Extraire le .asar dans un dossier temporaire
$tmp = Join-Path $env:TEMP ('opus-update-' + $stamp)
Write-Host ('  Extraction de app.asar vers ' + $tmp + ' ...') -ForegroundColor Gray
npx --yes asar extract $asarDest $tmp

# Copier index.html
Write-Host '  Copie de index.html ...' -ForegroundColor Gray
Copy-Item (Join-Path $src 'index.html') (Join-Path $tmp 'index.html') -Force

# Re-transpiler le JSX si assets/app.jsx est present
$appJsx = Join-Path $src 'assets\app.jsx'
if (Test-Path $appJsx) {
    Write-Host '  Transpilation JSX -> app.js ...' -ForegroundColor Gray
    $nodeScript = "const fs=require('fs'),babel=require('@babel/core');const r=babel.transformSync(fs.readFileSync('assets/app.jsx','utf8'),{presets:[['@babel/preset-react',{runtime:'classic'}]],sourceType:'script',filename:'app.jsx'});fs.writeFileSync('assets/app.js',r.code,'utf8');console.log('OK '+Math.round(r.code.length/1024)+'KB');"
    Push-Location $src
    node -e $nodeScript
    Pop-Location
}

# Copier assets/
Write-Host '  Copie de assets/ ...' -ForegroundColor Gray
$assetsSrc  = Join-Path $src 'assets'
$assetsDest = Join-Path $tmp 'assets'
if (Test-Path $assetsSrc) {
    if (-not (Test-Path $assetsDest)) {
        New-Item -ItemType Directory -Path $assetsDest -Force | Out-Null
    }
    Copy-Item (Join-Path $assetsSrc '*') $assetsDest -Recurse -Force
}

# Copier electron/ (main.js, preload.js)
Write-Host '  Copie de electron/ ...' -ForegroundColor Gray
$electronSrc  = Join-Path $src 'electron'
$electronDest = Join-Path $tmp 'electron'
if (Test-Path $electronSrc) {
    if (-not (Test-Path $electronDest)) {
        New-Item -ItemType Directory -Path $electronDest -Force | Out-Null
    }
    Copy-Item (Join-Path $electronSrc '*') $electronDest -Recurse -Force
}

# Repacker le .asar
Write-Host '  Repack de app.asar ...' -ForegroundColor Gray
$asarBackup = $asarDest + '.bak'
Copy-Item $asarDest $asarBackup -Force
npx --yes asar pack $tmp $asarDest

# Nettoyage du dossier temporaire
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '========================================'
Write-Host '  Mise a jour installee avec succes !' -ForegroundColor Green
Write-Host '  Lance Opus depuis le menu demarrer ou la barre de recherche.' -ForegroundColor Cyan
Write-Host ''
