# Opus — Application desktop

Application desktop (Windows / Linux) basée sur Electron.
Interface identique au site web, données stockées localement.

---

## Installation

### Windows
Lance `Opus-Setup.exe` et suis l'assistant d'installation.

### Linux
```bash
chmod +x Opus.AppImage
./Opus.AppImage
```

---

## Données

Les données sont stockées dans :
- **Windows** : `%AppData%\opus\opus-data.json`
- **Linux** : `~/.config/opus/opus-data.json`

---

## Build depuis les sources

### Prérequis
- Node.js 20 LTS
- npm

### Installation
```bash
npm install
```

### Lancer en développement
```bash
npm start
```

### Builder pour Windows
```bash
npm run build
```

Le fichier `.exe` sera dans `dist/`.

### Builder pour Linux
```bash
npm run buildl
```

---

## Import / Export

- **⬆ Export** → dialog natif pour sauvegarder un fichier `.json`
- **⬇ Import** → dialog natif pour importer un fichier `.json` (fusionne sans doublons)

Utile pour synchroniser avec une autre installation (autre PC, site web, etc.)
