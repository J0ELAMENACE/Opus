# Opus - Script d installation
$ProjectPath = "C:\Users\louis\opus-electron"
$AppName = "Opus"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   $AppName - Installation" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifier Node.js
Write-Host "[ 1/4 ] Verification de Node.js..." -ForegroundColor Yellow

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    # Chercher Node dans les emplacements courants
    $nodePaths = @(
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe"
    )
    foreach ($p in $nodePaths) {
        if (Test-Path $p) {
            $env:Path = $env:Path + ";" + (Split-Path $p)
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            break
        }
    }
}

if ($nodeCmd) {
    $nodeVersion = & node --version
    Write-Host "        Node.js detecte : $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "        Node.js non trouve. Telechargement..." -ForegroundColor Red
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $nodeMsi = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
    Write-Host "        Installation de Node.js 20 LTS..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn" -Wait
    Remove-Item $nodeMsi -Force
    $env:Path = "C:\Program Files\nodejs;" + $env:Path
    Write-Host "        Node.js installe." -ForegroundColor Green
}

# 2. Verifier le dossier projet
Write-Host ""
Write-Host "[ 2/4 ] Verification du projet..." -ForegroundColor Yellow

if (-not (Test-Path $ProjectPath)) {
    Write-Host "        ERREUR : Dossier introuvable : $ProjectPath" -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}

if (-not (Test-Path "$ProjectPath\package.json")) {
    Write-Host "        ERREUR : package.json introuvable" -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}

Write-Host "        Projet trouve." -ForegroundColor Green
Set-Location $ProjectPath

# 3. npm install
Write-Host ""
Write-Host "[ 3/4 ] Installation des dependances (npm install)..." -ForegroundColor Yellow
Write-Host "        Cela peut prendre 2-5 minutes la premiere fois..." -ForegroundColor Gray

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $env:Path = "C:\Program Files\nodejs;" + $env:Path
}

& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "        ERREUR : npm install a echoue." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}
Write-Host "        Dependances installees." -ForegroundColor Green

# 4. Build Windows
Write-Host ""
Write-Host "[ 4/4 ] Build de l application Windows..." -ForegroundColor Yellow
Write-Host "        Generation du fichier .exe en cours..." -ForegroundColor Gray

& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "        ERREUR : Le build a echoue." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}

# Resultat
$exePath = Get-ChildItem "$ProjectPath\dist\*.exe" | Where-Object { $_.Name -like "*Setup*" } | Select-Object -First 1

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "   Build termine avec succes !" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

if ($exePath) {
    Write-Host "   Fichier genere :" -ForegroundColor White
    Write-Host "   $($exePath.FullName)" -ForegroundColor Cyan
    Write-Host ""
    $launch = Read-Host "Lancer l installation maintenant ? (O/N)"
    if ($launch -eq "O" -or $launch -eq "o") {
        Start-Process $exePath.FullName
    }
} else {
    Write-Host "   Le .exe se trouve dans : $ProjectPath\dist\" -ForegroundColor Cyan
}

Write-Host ""
Read-Host "Appuie sur Entree pour fermer"