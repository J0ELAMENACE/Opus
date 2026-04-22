const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs   = require('fs');

/* ─── CHEMIN DES DONNÉES ── */
const dataPath = path.join(app.getPath('userData'), 'opus-data.json');

function readData() {
  try {
    if (!fs.existsSync(dataPath)) return [];
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch { return []; }
}

function writeData(items) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(items, null, 2), 'utf8');
    return true;
  } catch { return false; }
}

/* ─── FENÊTRE ── */
let win;

function createWindow() {
  win = new BrowserWindow({
    width:          1400,
    height:         900,
    minWidth:       800,
    minHeight:      600,
    title:          'Opus',
    icon:           path.join(__dirname, '../assets/icon.ico'),
    backgroundColor: '#111009',
    webPreferences: {
      preload:            path.join(__dirname, 'preload.js'),
      contextIsolation:   true,
      nodeIntegration:    false,
    },
  });

  win.loadFile(path.join(__dirname, '../index.html'));
  win.setMenuBarVisibility(false);

  // Désactiver le menu natif
  win.removeMenu();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ─── IPC — STOCKAGE ── */

ipcMain.handle('items:load', () => {
  return readData();
});

ipcMain.handle('items:save-all', (_, items) => {
  return writeData(items);
});

ipcMain.handle('items:add', (_, item) => {
  const items = readData();
  items.unshift(item);
  writeData(items);
  return items;
});

ipcMain.handle('items:update', (_, item) => {
  const items = readData();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  writeData(items);
  return items;
});

ipcMain.handle('items:delete', (_, id) => {
  const items = readData().filter(i => i.id !== id);
  writeData(items);
  return items;
});

/* ─── IPC — EXPORT / IMPORT ── */

ipcMain.handle('export:json', async () => {
  const items = readData();
  const date  = new Date().toISOString().slice(0, 10);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title:       'Exporter la bibliothèque Opus',
    defaultPath: `opus-backup-${date}.json`,
    filters:     [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
  return { ok: true, count: items.length };
});

ipcMain.handle('import:json', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title:       'Importer une bibliothèque Opus',
    filters:     [{ name: 'JSON', extensions: ['json'] }],
    properties:  ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false };
  try {
    const imported  = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    if (!Array.isArray(imported)) return { ok: false, error: 'Fichier invalide.' };
    const existing  = readData();
    const existIds  = new Set(existing.map(i => i.id));
    const toAdd     = imported.filter(i => i.id && i.title && !existIds.has(i.id));
    const merged    = [...toAdd, ...existing];
    writeData(merged);
    return { ok: true, count: toAdd.length, items: merged };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
