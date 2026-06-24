const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

/* ─── DONNÉES ── */
const dataPath = path.join(app.getPath('userData'), 'opus-data.json');

const VALID_CATS     = new Set(['game', 'movie', 'series', 'anime', 'book']);
const VALID_STATUSES = new Set(['todo', 'doing', 'done', 'dropped']);

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

function validateItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id    !== 'string' || !item.id.trim())    return false;
  if (typeof item.title !== 'string' || !item.title.trim()) return false;
  if (!VALID_CATS.has(item.cat))                            return false;
  if (item.status && !VALID_STATUSES.has(item.status))      return false;
  if (item.rating != null && (item.rating < 0 || item.rating > 5)) return false;
  return true;
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
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.loadFile(path.join(__dirname, '../index.html'));
  win.setMenuBarVisibility(false);
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

ipcMain.handle('items:load', () => readData());

ipcMain.handle('items:save-all', (_, items) => {
  if (!Array.isArray(items)) return false;
  return writeData(items);
});

ipcMain.handle('items:add', (_, item) => {
  if (!validateItem(item)) return null;
  const items = readData();
  items.unshift(item);
  writeData(items);
  return items;
});

ipcMain.handle('items:update', (_, item) => {
  if (!validateItem(item)) return null;
  const items = readData();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  writeData(items);
  return items;
});

ipcMain.handle('items:delete', (_, id) => {
  if (typeof id !== 'string' || !id.trim()) return null;
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
  try {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
    return { ok: true, count: items.length };
  } catch { return { ok: false, error: 'Erreur lors de l\'export.' }; }
});

ipcMain.handle('import:json', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title:      'Importer une bibliothèque Opus',
    filters:    [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false };
  try {
    const raw      = fs.readFileSync(filePaths[0], 'utf8');
    const imported = JSON.parse(raw);
    if (!Array.isArray(imported)) return { ok: false, error: 'Fichier invalide.' };
    const valid    = imported.filter(validateItem);
    const existing = readData();
    const existIds = new Set(existing.map(i => i.id));
    const toAdd    = valid.filter(i => !existIds.has(i.id));
    const merged   = [...toAdd, ...existing];
    writeData(merged);
    return { ok: true, count: toAdd.length, items: merged };
  } catch { return { ok: false, error: 'Fichier invalide ou corrompu.' }; }
});
