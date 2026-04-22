# Opus - Script de mise a jour
# Telecharge le dernier index.html depuis GitHub et rebuild

$ProjectPath = "C:\Users\louis\opus-electron"
$GitHubRaw = "https://raw.githubusercontent.com/J0ELAMENACE/Opus/main/opus-electron/index.html"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   Opus - Mise a jour" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Telecharger le nouveau index.html
Write-Host "[ 1/3 ] Telechargement de la derniere version..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $GitHubRaw -OutFile "$ProjectPath\index.html" -UseBasicParsing
    Write-Host "        Telechargement OK." -ForegroundColor Green
} catch {
    Write-Host "        ERREUR : impossible de telecharger depuis GitHub." -ForegroundColor Red
    Write-Host "        Verifie ta connexion internet." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}

# 2. Rebuild
Write-Host ""
Write-Host "[ 2/3 ] Build de la nouvelle version..." -ForegroundColor Yellow
Set-Location $ProjectPath
$env:Path = "C:\Program Files\nodejs;" + $env:Path
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "        ERREUR : Le build a echoue." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour quitter"
    exit 1
}
Write-Host "        Build OK." -ForegroundColor Green

# 3. Lancer l installer
Write-Host ""
Write-Host "[ 3/3 ] Mise a jour prete !" -ForegroundColor Green
$exePath = Get-ChildItem "$ProjectPath\dist\*.exe" | Where-Object { $_.Name -like "*Setup*" } | Select-Object -First 1

if ($exePath) {
    Write-Host "   Fichier : $($exePath.FullName)" -ForegroundColor Cyan
    Write-Host ""
    $launch = Read-Host "Installer maintenant ? (O/N)"
    if ($launch -eq "O" -or $launch -eq "o") {
        Start-Process $exePath.FullName
    }
}

Write-Host ""
Read-Host "Appuie sur Entree pour fermer"
