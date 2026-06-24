#!/bin/bash
# ================================================================
#  Opus Web — Script d'installation serveur Linux
#  Installe Node.js, PostgreSQL, Nginx, PM2 et configure tout
#  Usage : chmod +x install.sh && sudo ./install.sh
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="/var/www/opus"
SERVICE_USER="opus"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; GRAY='\033[0;37m'; NC='\033[0m'

step() { echo -e "\n${YELLOW}[ $1/$7 ] $2${NC}"; }
ok()   { echo -e "${GREEN}        OK : $1${NC}"; }
fail() { echo -e "${RED}        ERREUR : $1${NC}"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Lance ce script avec sudo."

echo ""
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}   Opus Web — Installation Serveur${NC}"
echo -e "${CYAN}=======================================${NC}"

# Détecter la distro
if   command -v apt    &>/dev/null; then PKG="apt"
elif command -v pacman &>/dev/null; then PKG="pacman"
elif command -v dnf    &>/dev/null; then PKG="dnf"
else fail "Distro non reconnue (apt/pacman/dnf requis)"; fi

# ── 1. Node.js ──────────────────────────────────────────────────
step 1 7 "Installation de Node.js..."
if command -v node &>/dev/null; then
    ok "Node.js $(node --version) déjà installé"
else
    if [ "$PKG" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    elif [ "$PKG" = "pacman" ]; then pacman -S --noconfirm nodejs npm
    elif [ "$PKG" = "dnf" ];    then dnf install -y nodejs npm
    fi
    ok "Node.js $(node --version) installé"
fi

# ── 2. PostgreSQL ────────────────────────────────────────────────
step 2 7 "Installation de PostgreSQL..."
if command -v psql &>/dev/null; then
    ok "PostgreSQL déjà installé"
else
    if [ "$PKG" = "apt" ];    then apt install -y postgresql postgresql-contrib
    elif [ "$PKG" = "pacman" ]; then pacman -S --noconfirm postgresql; postgresql-setup --initdb 2>/dev/null || true
    elif [ "$PKG" = "dnf" ];    then dnf install -y postgresql-server postgresql-contrib; postgresql-setup --initdb
    fi
    systemctl enable --now postgresql
    ok "PostgreSQL installé"
fi

# ── 3. Nginx ────────────────────────────────────────────────────
step 3 7 "Installation de Nginx..."
if command -v nginx &>/dev/null; then
    ok "Nginx déjà installé"
else
    if [ "$PKG" = "apt" ];    then apt install -y nginx
    elif [ "$PKG" = "pacman" ]; then pacman -S --noconfirm nginx
    elif [ "$PKG" = "dnf" ];    then dnf install -y nginx
    fi
    ok "Nginx installé"
fi

# ── 4. PM2 ──────────────────────────────────────────────────────
step 4 7 "Installation de PM2..."
npm install -g pm2 --quiet
ok "PM2 $(pm2 --version) installé"

# ── 5. Base de données ──────────────────────────────────────────
step 5 7 "Configuration PostgreSQL..."
echo -e "${GRAY}        Création de l'utilisateur et de la base 'opus'${NC}"

# Demander le mot de passe DB
read -rsp "        Mot de passe pour l'utilisateur PostgreSQL 'opus' : " DB_PASS
echo ""

sudo -u postgres psql -c "CREATE USER opus WITH PASSWORD '$DB_PASS';" 2>/dev/null || ok "Utilisateur opus existe déjà"
sudo -u postgres psql -c "CREATE DATABASE opus OWNER opus;"             2>/dev/null || ok "Base opus existe déjà"
ok "Base de données configurée"

# ── 6. Déploiement de l'application ─────────────────────────────
step 6 7 "Déploiement..."

# Client web
mkdir -p "$WEB_ROOT"
cp "$SCRIPT_DIR/client/index.html" "$WEB_ROOT/index.html"
ok "Client copié dans $WEB_ROOT"

# Dépendances serveur
cd "$SCRIPT_DIR/server"
npm install --omit=dev
ok "Dépendances serveur installées"

# Créer le .env si absent
if [ ! -f "$SCRIPT_DIR/server/.env" ]; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
    cat > "$SCRIPT_DIR/server/.env" <<EOF
PORT=3001
DATABASE_URL=postgresql://opus:${DB_PASS}@localhost:5432/opus
CORS_ORIGIN=http://${SERVER_IP}
EOF
    ok ".env créé (CORS_ORIGIN=http://$SERVER_IP)"
else
    ok ".env existant conservé"
fi

# Nginx
cp "$SCRIPT_DIR/nginx/opus.conf" /etc/nginx/sites-available/opus 2>/dev/null \
    || cp "$SCRIPT_DIR/nginx/opus.conf" /etc/nginx/conf.d/opus.conf
ln -sf /etc/nginx/sites-available/opus /etc/nginx/sites-enabled/opus 2>/dev/null || true
nginx -t && systemctl reload nginx
ok "Nginx configuré"

# PM2
pm2 start "$SCRIPT_DIR/server/index.js" --name opus-api 2>/dev/null \
    || pm2 restart opus-api
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true
ok "API démarrée avec PM2"

# ── 7. Résumé ───────────────────────────────────────────────────
step 7 7 "Vérification..."
sleep 2
curl -sf http://localhost:3001/api/health >/dev/null && ok "API répond" || echo -e "${YELLOW}        API pas encore prête, vérifie : pm2 logs opus-api${NC}"

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}   Installation terminée !${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "   Interface web : ${CYAN}http://$SERVER_IP${NC}"
echo -e "   API health    : ${CYAN}http://$SERVER_IP/api/health${NC}"
echo -e "   Logs API      : ${CYAN}pm2 logs opus-api${NC}"
echo ""
