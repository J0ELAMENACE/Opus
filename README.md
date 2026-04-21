<div align="center">
  <img src="assets/logo.svg" alt="Opus" width="100" />
  <h1>Opus</h1>
  <p><strong>Carnet culturel personnel</strong></p>
  <p>Suivez vos films, séries, animés, livres et jeux vidéo — avec recherche automatique, gestion des états et notation par étoiles.</p>
</div>

---

![Aperçu de l'application](assets/screenshot.png)

---

## Fonctionnalités

- Recherche automatique via APIs gratuites (affiches, genres, dates, créateurs)
- 5 catégories : Films · Séries · Animés · Livres · Jeux vidéo
- 4 états : À faire · En cours · Terminé · Abandonné
- Notation ★ sur 5 pour les œuvres terminées
- Sélection multiple lors de l'ajout (pratique pour les sagas)
- Filtres par catégorie, état, lettre A→Z, année de sortie
- Recherche texte en temps réel + tri
- Export / Import JSON pour synchroniser plusieurs installations
- Mode clair / Mode sombre (préférence sauvegardée)
- Deux modes de stockage : `localStorage` (local) ou API REST + PostgreSQL (VM/NAS)

---

## Stack technique

| Couche          | Technologie                                   |
|-----------------|-----------------------------------------------|
| Frontend        | React 18 + Tailwind CSS (via CDN)             |
| Recherche       | OMDb · TVmaze · AniList · Google Books · RAWG |
| Backend         | Node.js + Express                             |
| Base de données | PostgreSQL                                    |
| Proxy           | Nginx                                         |
| Process manager | PM2                                           |

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
├── assets/
│   ├── logo.svg        ← Logo
│   └── screenshot.png  ← Aperçu de l'application
├── .gitignore
└── README.md
```

---

## APIs utilisées

| Catégorie  | API          | Inscription | Lien                                |
|------------|--------------|-------------|-------------------------------------|
| Films      | OMDb         | Email seul  | https://omdbapi.com                 |
| Séries     | TVmaze       | ❌ aucune   | https://tvmaze.com/api              |
| Animés     | AniList      | ❌ aucune   | https://anilist.gitbook.io          |
| Livres     | Google Books | ❌ aucune   | https://developers.google.com/books |
| Jeux vidéo | RAWG         | Email seul  | https://rawg.io/apidocs             |

---

## Configuration des clés API

Dans `index.html`, remplace les constantes en haut du script :

```js
const API      = null;               // null = localStorage | 'http://IP/api' = backend
const OMDB_KEY = 'VOTRE_CLE_OMDB';  // → https://omdbapi.com
const RAWG_KEY = 'VOTRE_CLE_RAWG';  // → https://rawg.io/apidocs
```

TVmaze, AniList et Google Books ne nécessitent aucune clé.

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

- Ubuntu 22.04 ou 24.04
- Node.js 20 LTS
- PostgreSQL 14+
- Nginx
- PM2

### Installation complète en une commande

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git
sudo systemctl enable postgresql nginx
sudo npm install -g pm2
```

### Créer la base de données

```bash
sudo -u postgres psql << 'SQL'
CREATE USER opus WITH PASSWORD 'CHANGE_MOI';
CREATE DATABASE opus OWNER opus;
\q
SQL
```

### Déployer le backend

```bash
sudo mkdir -p /opt/opus-api
sudo chown -R $USER:$USER /opt/opus-api
cp server/* /opt/opus-api/
cd /opt/opus-api
npm install
cp .env.example .env
nano .env   # remplis DATABASE_URL et CORS_ORIGIN
```

### Lancer avec PM2

```bash
pm2 start /opt/opus-api/index.js --name opus-api
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

### Déployer le frontend

```bash
sudo mkdir -p /var/www/opus
sudo cp index.html /var/www/opus/index.html
```

Dans `index.html`, remplace :
```js
const API = null;
```
par :
```js
const API = 'http://IP_DE_TA_MACHINE/api';
```

### Configurer Nginx

```bash
sudo cp nginx/opus.conf /etc/nginx/sites-available/opus
sudo ln -s /etc/nginx/sites-available/opus /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Mise à jour du frontend

```bash
sudo cp ~/index.html /var/www/opus/index.html
```

Puis `Ctrl+F5` dans le navigateur. Aucun redémarrage nécessaire.

---

## Export / Import

- **Export** (bouton ⬆ dans le header) → télécharge `opus-backup-DATE.json`
- **Import** (bouton ⬇ dans le header) → lit un fichier JSON et ajoute uniquement les œuvres absentes (comparaison par ID, zéro doublon)

Utile pour synchroniser deux installations sur des machines différentes.

---

## Variables d'environnement (.env)

| Variable       | Description                    | Exemple                                     |
|----------------|--------------------------------|---------------------------------------------|
| `PORT`         | Port de l'API                  | `3001`                                      |
| `DATABASE_URL` | URL de connexion PostgreSQL    | `postgresql://opus:mdp@localhost:5432/opus` |
| `CORS_ORIGIN`  | Origine autorisée pour le CORS | `http://192.168.1.XX`                       |

---

## Endpoints API

| Méthode | Route            | Description       |
|---------|------------------|-------------------|
| GET     | `/api/items`     | Tous les items    |
| GET     | `/api/items/:id` | Un item           |
| POST    | `/api/items`     | Créer un item     |
| PUT     | `/api/items/:id` | Modifier un item  |
| DELETE  | `/api/items/:id` | Supprimer un item |
| GET     | `/api/health`    | Statut de l'API   |

---

## Architecture

```
Navigateur (réseau local)
    │
    ▼
Nginx :80
    ├── /        → /var/www/opus/index.html
    └── /api/*   → localhost:3001
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

# Santé de l'API
curl http://localhost:3001/api/health

# Sauvegarde base de données
sudo -u postgres pg_dump opus > ~/opus-backup-$(date +%F).sql

# Nginx
sudo nginx -t
sudo systemctl reload nginx
```
