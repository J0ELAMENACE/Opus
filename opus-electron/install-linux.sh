#!/bin/bash
# ============================================================
#  Opus — Script d'installation Linux (Arch / Ubuntu / Debian)
# ============================================================

PROJECT_DIR="$HOME/opus-electron"
APP_NAME="Opus"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}   $APP_NAME — Installation Linux${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""

# ── 1. Détecter la distro et installer Node.js ──────────────
echo -e "${YELLOW}[ 1/4 ] Vérification de Node.js...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "        Node.js détecté : $NODE_VERSION"
else
    echo -e "${RED}        Node.js non trouvé. Installation...${NC}"

    if command -v pacman &> /dev/null; then
        # Arch Linux
        echo -e "${YELLOW}        Distro détectée : Arch Linux${NC}"
        sudo pacman -S --noconfirm nodejs npm
    elif command -v apt &> /dev/null; then
        # Ubuntu / Debian
        echo -e "${YELLOW}        Distro détectée : Ubuntu/Debian${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    elif command -v dnf &> /dev/null; then
        # Fedora
        echo -e "${YELLOW}        Distro détectée : Fedora${NC}"
        sudo dnf install -y nodejs npm
    else
        echo -e "${RED}        Distro non reconnue. Installe Node.js manuellement : https://nodejs.org${NC}"
        exit 1
    fi

    echo -e "${GREEN}        Node.js installé.${NC}"
fi

# ── 2. Vérifier le dossier projet ───────────────────────────
echo ""
echo -e "${YELLOW}[ 2/4 ] Vérification du projet...${NC}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}        ERREUR : Dossier introuvable : $PROJECT_DIR${NC}"
    echo -e "${RED}        Copie le dossier opus-electron dans $HOME/${NC}"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${RED}        ERREUR : package.json introuvable${NC}"
    exit 1
fi

echo -e "${GREEN}        Projet trouvé.${NC}"
cd "$PROJECT_DIR"

# ── 3. npm install ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}[ 3/4 ] Installation des dépendances (npm install)...${NC}"
echo -e "${GRAY}        Cela peut prendre 2-5 minutes la première fois...${NC}"

npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}        ERREUR : npm install a échoué.${NC}"
    exit 1
fi
echo -e "${GREEN}        Dépendances installées.${NC}"

# ── 4. Build Linux ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}[ 4/4 ] Build de l'application Linux...${NC}"
echo -e "${GRAY}        Génération des fichiers AppImage et .deb...${NC}"

npm run buildl
if [ $? -ne 0 ]; then
    echo -e "${RED}        ERREUR : Le build a échoué.${NC}"
    exit 1
fi

# ── Résultat ─────────────────────────────────────────────────
APPIMAGE=$(find "$PROJECT_DIR/dist" -name "*.AppImage" | head -1)
DEB=$(find "$PROJECT_DIR/dist" -name "*.deb" | head -1)

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}   Build terminé avec succès !${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

if [ -n "$APPIMAGE" ]; then
    echo -e "   AppImage : $APPIMAGE"
    chmod +x "$APPIMAGE"
    echo -e "${GREEN}   (chmod +x appliqué)${NC}"
fi

if [ -n "$DEB" ]; then
    echo -e "   .deb     : $DEB"
fi

echo ""
echo -e "   Pour lancer directement :"
echo -e "${CYAN}   $APPIMAGE${NC}"
echo ""

# Proposer d'installer le .deb
if [ -n "$DEB" ]; then
    read -p "Installer le .deb maintenant ? (o/n) : " INSTALL
    if [ "$INSTALL" = "o" ] || [ "$INSTALL" = "O" ]; then
        if command -v apt &> /dev/null; then
            sudo dpkg -i "$DEB"
        else
            echo -e "${YELLOW}   Installation .deb non supportée sur cette distro. Utilise l'AppImage.${NC}"
        fi
    fi
fi

echo ""
echo "Terminé."
