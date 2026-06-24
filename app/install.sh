#!/bin/bash
# ================================================================
#  Opus — Script d'installation Linux (Arch / Ubuntu / Debian / Fedora)
#  Usage : chmod +x install.sh && ./install.sh
# ================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; GRAY='\033[0;37m'; NC='\033[0m'

step() { echo -e "\n${YELLOW}[ $1/5 ] $2${NC}"; }
ok()   { echo -e "${GREEN}        OK : $1${NC}"; }
fail() { echo -e "${RED}        ERREUR : $1${NC}"; exit 1; }

echo ""
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}   Opus — Installation Linux${NC}"
echo -e "${CYAN}=======================================${NC}"

# ── 1. Node.js ──────────────────────────────────────────────────
step 1 "Vérification de Node.js..."
if command -v node &>/dev/null; then
    ok "Node.js $(node --version) détecté"
else
    echo -e "${RED}        Node.js non trouvé. Installation...${NC}"
    if   command -v pacman &>/dev/null; then sudo pacman -S --noconfirm nodejs npm
    elif command -v apt    &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    elif command -v dnf    &>/dev/null; then sudo dnf install -y nodejs npm
    else fail "Distro non reconnue. Installe Node.js manuellement : https://nodejs.org"; fi
    ok "Node.js installé"
fi

# ── 2. Dépendances vendorisées ───────────────────────────────────
step 2 "Téléchargement des dépendances JS (mode offline)..."
VENDOR_DIR="$SCRIPT_DIR/assets/vendor"
mkdir -p "$VENDOR_DIR"

download_if_missing() {
    local name="$1" url="$2" dest="$VENDOR_DIR/$1"
    if [ -f "$dest" ]; then
        echo -e "${GRAY}        $name (déjà présent)${NC}"
    else
        curl -fsSL "$url" -o "$dest" || fail "Impossible de télécharger $name"
        ok "$name téléchargé"
    fi
}

download_if_missing "react.min.js"     "https://unpkg.com/react@18.3.1/umd/react.production.min.js"
download_if_missing "react-dom.min.js" "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"
download_if_missing "babel.min.js"     "https://unpkg.com/@babel/standalone@7.23.10/babel.min.js"
download_if_missing "tailwind.js"      "https://cdn.tailwindcss.com"

# ── 3. npm install ──────────────────────────────────────────────
step 3 "Installation des dépendances (npm install)..."
echo -e "${GRAY}        (peut prendre 2-5 minutes la première fois)${NC}"
cd "$SCRIPT_DIR"
npm install
ok "Dépendances installées"

# ── 4. Build Linux ──────────────────────────────────────────────
step 4 "Compilation de l'application..."
npm run buildl
ok "Build terminé"

# ── 5. Installation ─────────────────────────────────────────────
step 5 "Finalisation..."
APPIMAGE=$(find "$SCRIPT_DIR/dist" -name "*.AppImage" 2>/dev/null | head -1)
DEB=$(find "$SCRIPT_DIR/dist" -name "*.deb" 2>/dev/null | head -1)

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}   Build terminé avec succès !${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
[ -n "$APPIMAGE" ] && { chmod +x "$APPIMAGE"; echo -e "   AppImage : ${CYAN}$APPIMAGE${NC}"; }
[ -n "$DEB"      ] && echo -e "   .deb     : ${CYAN}$DEB${NC}"
echo ""

if [ -n "$DEB" ] && command -v apt &>/dev/null; then
    read -rp "Installer le .deb maintenant ? (o/N) : " INSTALL
    [[ "$INSTALL" =~ ^[oO]$ ]] && { sudo dpkg -i "$DEB"; ok ".deb installé"; }
elif [ -n "$APPIMAGE" ]; then
    read -rp "Lancer l'AppImage maintenant ? (o/N) : " LAUNCH
    [[ "$LAUNCH" =~ ^[oO]$ ]] && "$APPIMAGE" &
fi

echo ""
echo "Terminé."
