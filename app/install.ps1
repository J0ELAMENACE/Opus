# ================================================================
#  Opus - Script d'installation Windows
#  Usage : clic droit > "Executer avec PowerShell"
# ================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

function Write-Step($n, $total, $msg) {
    Write-Host ""
    Write-Host "[ $n/$total ] $msg" -ForegroundColor Yellow
}
function Write-OK($msg)   { Write-Host "        OK : $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "        ERREUR : $msg" -ForegroundColor Red; Read-Host 'Appuyer sur Entree pour quitter'; exit 1 }

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   Opus - Installation Windows"         -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# -- 1. Node.js --
Write-Step 1 5 "Verification de Node.js..."
try {
    $nodeVer = node --version 2>&1
    Write-OK "Node.js $nodeVer detecte"
} catch {
    Write-Host "        Node.js non trouve." -ForegroundColor Red
    Write-Fail 'Telecharge-le sur https://nodejs.org (v20 LTS recommande)'
}

# -- 2. Dependances vendorisees --
Write-Step 2 5 "Telechargement des dependances JS (mode offline)..."
$vendorDir = Join-Path $ScriptDir "assets\vendor"
New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null

$files = [ordered]@{
    'react.min.js'     = 'https://unpkg.com/react@18.3.1/umd/react.production.min.js'
    'react-dom.min.js' = 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
    'babel.min.js'     = 'https://unpkg.com/@babel/standalone@7.23.10/babel.min.js'
    'tailwind.js'      = 'https://cdn.tailwindcss.com'
}

foreach ($name in $files.Keys) {
    $dest = Join-Path $vendorDir $name
    if (Test-Path $dest) {
        Write-Host "        $name (deja present)" -ForegroundColor Gray
        continue
    }
    try {
        Invoke-WebRequest -Uri $files[$name] -OutFile $dest -UseBasicParsing
        Write-OK "$name telecharge"
    } catch {
        Write-Fail "Impossible de telecharger $name - verifie ta connexion."
    }
}

# -- 3. npm install --
Write-Step 3 5 "Installation des dependances npm..."
Write-Host "        (peut prendre 2-5 minutes)" -ForegroundColor Gray
Set-Location $ScriptDir
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail 'npm install a echoue.' }
Write-OK "Dependances installees"

# -- 4. Build --
Write-Step 4 5 "Compilation de l application..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail 'Le build a echoue.' }
Write-OK "Build termine"

# -- 5. Lancer le setup --
Write-Step 5 5 "Recherche du fichier d installation..."
$setup = Get-ChildItem "$ScriptDir\dist" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "   Build termine avec succes !"         -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

if ($setup) {
    Write-Host "   Installateur : $($setup.FullName)" -ForegroundColor Cyan
    Write-Host ""
    $launch = Read-Host 'Lancer l installation maintenant ? (O/N)'
    if ($launch -eq 'O' -or $launch -eq 'o') {
        Start-Process $setup.FullName
    }
} else {
    Write-Host "   Installateur introuvable dans dist\" -ForegroundColor Yellow
}

Write-Host ""
Read-Host 'Appuyer sur Entree pour fermer'
