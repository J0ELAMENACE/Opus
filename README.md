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

| Couche          | Technologie                                         |
|-----------------|-----------------------------------------------------|
| Frontend        | React 18 + Tailwind CSS (via CDN)                   |
| Recherche       | OMDb · TVmaze · AniList · Open Library · RAWG       |
| Backend         | Node.js + Express                                   |
| Base de données | PostgreSQL                                          |
| Proxy           | Nginx                                               |
| Process manager | PM2                                                 |

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
│   └── opus.conf       ← Configuration Nginx (exemple)
└── README.md
```

---

## APIs utilisées

| Catégorie  | API           | Inscription requise | Lien                        |
|------------|---------------|---------------------|-----------------------------|
| Films      | OMDb          | Oui (email seul)    | https://omdbapi.com         |
| Séries     | TVmaze        | Non                 | https://tvmaze.com/api      |
| Animés     | AniList       | Non                 | https://anilist.gitbook.io  |
| Livres     | Open Library  | Non                 | https://openlibrary.org/dev |
| Jeux vidéo | RAWG          | Oui (email seul)    | https://rawg.io/apidocs     |

---

## Configuration des clés API

Dans `index.html`, remplace les deux constantes en haut du script :

```js
const OMDB_KEY = 'VOTRE_CLE_OMDB';   // → https://omdbapi.com (Free Plan)
const RAWG_KEY = 'VOTRE_CLE_RAWG';   // → https://rawg.io/apidocs
```

TVmaze, AniList et Open Library ne nécessitent aucune clé.

---

## Mode 1 — Fichier HTML seul (local, sans serveur)

Ouvre simplement `index.html` dans ton navigateur.
Les données sont stockées dans le `localStorage` du navigateur.

> ⚠️ Les données sont perdues si tu vides le cache du navigateur.

---

## Mode 2 — Hébergement local sur VM ou NAS (persistant)

> ℹ️ **Cette section est un exemple d'hébergement en self-hosting local.**
> Elle décrit comment déployer Opus sur une machine dédiée sur ton réseau local
> (PC recyclé, Raspberry Pi, mini PC, NAS avec Docker, etc.).
> L'application reste accessible uniquement depuis ton réseau — aucun accès externe requis.

### Prérequis

- Ubuntu 22.04 ou 24.04 (ou équivalent)
- Node.js 20 LTS
- PostgreSQL 14+
- Nginx
- PM2

### Étape 1 — Installer les dépendances système

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git
sudo systemctl enable postgresql nginx
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
sudo mkdir -p /opt/opus-api
sudo chown -R $USER:$USER /opt/opus-api
cp server/* /opt/opus-api/
cd /opt/opus-api
npm install
cp .env.example .env
nano .env   # remplis DATABASE_URL et CORS_ORIGIN avec l'IP de ta machine
```

### Étape 4 — Lancer l'API avec PM2

```bash
cd /opt/opus-api
pm2 start index.js --name opus-api
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
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
const API = 'http://IP_DE_TA_MACHINE/api';
```

### Étape 6 — Configurer Nginx

```bash
sudo cp nginx/opus.conf /etc/nginx/sites-available/opus
sudo ln -s /etc/nginx/sites-available/opus /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Accès

Une fois déployé, Opus est accessible depuis n'importe quel appareil sur ton réseau local :
```
http://IP_DE_TA_MACHINE
```

---

## Variables d'environnement (.env)

| Variable       | Description                     | Exemple                                     |
|----------------|---------------------------------|---------------------------------------------|
| `PORT`         | Port de l'API                   | `3001`                                      |
| `DATABASE_URL` | URL de connexion PostgreSQL     | `postgresql://opus:mdp@localhost:5432/opus` |
| `CORS_ORIGIN`  | Origine autorisée pour le CORS  | `http://192.168.1.XX`                       |

---

## Endpoints API

| Méthode | Route             | Description       |
|---------|-------------------|-------------------|
| GET     | `/api/items`      | Tous les items    |
| GET     | `/api/items/:id`  | Un item           |
| POST    | `/api/items`      | Créer un item     |
| PUT     | `/api/items/:id`  | Modifier un item  |
| DELETE  | `/api/items/:id`  | Supprimer un item |
| GET     | `/api/health`     | Statut de l'API   |

---

## Architecture

```
Navigateur (réseau local)
    │
    ▼
Nginx :80
    ├── /        → /var/www/opus/index.html   (frontend)
    └── /api/*   → localhost:3001             (API Node.js)
                          │
                    PostgreSQL :5432
                      table: items
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
