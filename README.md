# Opus — Carnet culturel personnel

Opus est une application web pour suivre tous les films, séries, animés, livres et jeux vidéo que tu veux voir, lire ou jouer — avec recherche automatique des métadonnées, gestion des états et notation par étoiles.

---

## Aperçu

- Recherche automatique via des APIs gratuites (affiches, genres, dates, créateurs)
- 5 catégories : Films, Séries, Animés, Livres, Jeux vidéo
- 4 états : À faire · En cours · Terminé · Abandonné
- Notation ★ sur 5 pour les œuvres terminées
- Filtres par catégorie, état, tri et recherche textuelle
- Deux modes de stockage : `localStorage` (local) ou API REST + PostgreSQL (VM/NAS)

---

## Stack technique

| Couche        | Technologie                          |
|---------------|--------------------------------------|
| Frontend      | React 18 + Tailwind CSS (via CDN)    |
| Recherche     | OMDb · TVmaze · AniList · Open Library · RAWG |
| Backend       | Node.js + Express                    |
| Base de données | PostgreSQL                         |
| Proxy         | Nginx                                |
| Process manager | PM2                               |

---

## Structure du projet

```
opus/
├── index.html          ← Frontend (React + Tailwind, standalone)
├── server/
│   ├── index.js        ← API REST (Node.js + Express + PostgreSQL)
│   ├── package.json
│   └── .env.example    ← Variables d'environnement (à copier en .env)
├── nginx/
│   └── opus.conf       ← Configuration Nginx
└── README.md
```

---

## APIs utilisées

| Catégorie  | API            | Inscription requise | Lien                        |
|------------|----------------|---------------------|-----------------------------|
| Films      | OMDb           | Oui (email seul)    | https://omdbapi.com         |
| Séries     | TVmaze         | Non                 | https://tvmaze.com/api      |
| Animés     | AniList        | Non                 | https://anilist.gitbook.io  |
| Livres     | Open Library   | Non                 | https://openlibrary.org/dev |
| Jeux vidéo | RAWG           | Oui (email seul)    | https://rawg.io/apidocs     |

---

## Configuration des clés API

Dans `index.html`, remplace les deux constantes en haut du script :

```js
const OMDB_KEY = 'VOTRE_CLE_OMDB';   // → https://omdbapi.com (Free Plan)
const RAWG_KEY = 'VOTRE_CLE_RAWG';   // → https://rawg.io/apidocs
```

TVmaze, AniList et Open Library ne nécessitent aucune clé.

---

## Mode 1 — Fichier HTML seul (local)

Ouvre simplement `index.html` dans ton navigateur.  
Les données sont stockées dans le `localStorage` du navigateur.

> ⚠️ Les données sont perdues si tu vides le cache du navigateur.

---

## Mode 2 — Hébergement sur VM / NAS (persistant)

### Prérequis

- Ubuntu 22.04 ou 24.04
- Node.js 20 LTS
- PostgreSQL 14+
- Nginx
- PM2

### Étape 1 — Installer les dépendances système

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql && sudo systemctl start postgresql

# Nginx
sudo apt install -y nginx

# PM2
sudo npm install -g pm2
```

### Étape 2 — Créer la base de données

```bash
sudo -u postgres psql << 'SQL'
CREATE USER opus WITH PASSWORD 'CHANGE_MOI';
CREATE DATABASE opus OWNER opus;
\q
SQL
```

> La table `items` est créée automatiquement au premier démarrage de l'API.

### Étape 3 — Configurer l'API

```bash
mkdir -p /opt/opus-api
cp server/* /opt/opus-api/
cd /opt/opus-api
npm install
cp .env.example .env
nano .env   # remplis DATABASE_URL et CORS_ORIGIN
```

### Étape 4 — Lancer l'API avec PM2

```bash
cd /opt/opus-api
pm2 start index.js --name opus-api
pm2 startup
pm2 save
```

### Étape 5 — Déployer le frontend

```bash
sudo mkdir -p /var/www/opus
sudo cp index.html /var/www/opus/
```

Dans `index.html`, remplace :
```js
const API = null;
```
par :
```js
const API = 'http://TON_IP_OU_DOMAINE/api';
```

### Étape 6 — Configurer Nginx

```bash
sudo cp nginx/opus.conf /etc/nginx/sites-available/opus
sudo nano /etc/nginx/sites-available/opus   # remplace TON_IP_OU_DOMAINE
sudo ln -s /etc/nginx/sites-available/opus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 7 — (Optionnel) HTTPS avec Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ton-domaine.com
```

---

## Variables d'environnement (.env)

| Variable       | Description                    | Exemple                                  |
|----------------|--------------------------------|------------------------------------------|
| `PORT`         | Port de l'API                  | `3001`                                   |
| `DATABASE_URL` | URL de connexion PostgreSQL    | `postgresql://opus:mdp@localhost:5432/opus` |
| `CORS_ORIGIN`  | Origine autorisée pour le CORS | `http://192.168.1.10`                    |

---

## Endpoints API

| Méthode | Route            | Description      |
|---------|------------------|------------------|
| GET     | `/api/items`     | Tous les items   |
| GET     | `/api/items/:id` | Un item          |
| POST    | `/api/items`     | Créer un item    |
| PUT     | `/api/items/:id` | Modifier un item |
| DELETE  | `/api/items/:id` | Supprimer un item|
| GET     | `/api/health`    | Statut de l'API  |

---

## Architecture

```
Navigateur
    │
    ▼
Nginx :80 / :443
    ├── /        → /var/www/opus/index.html   (frontend)
    └── /api/*   → localhost:3001             (API Node.js)
                          │
                    PostgreSQL :5432
                      table: items
                  (id, cat, title, creator,
                   year, cover, genre, status,
                   rating, note, added)
```

---

## Commandes utiles

```bash
# API
pm2 status
pm2 logs opus-api
pm2 restart opus-api

# Base de données
sudo -u postgres psql -d opus
SELECT * FROM items ORDER BY added DESC LIMIT 10;
\q

# Nginx
sudo nginx -t
sudo systemctl reload nginx
```
