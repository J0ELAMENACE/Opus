const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Stockage
  loadItems:   ()       => ipcRenderer.invoke('items:load'),
  saveAll:     (items)  => ipcRenderer.invoke('items:save-all', items),
  addItem:     (item)   => ipcRenderer.invoke('items:add', item),
  updateItem:  (item)   => ipcRenderer.invoke('items:update', item),
  deleteItem:  (id)     => ipcRenderer.invoke('items:delete', id),

  // Export / Import natifs (dialog fichier)
  exportJSON:  ()       => ipcRenderer.invoke('export:json'),
  importJSON:  ()       => ipcRenderer.invoke('import:json'),
});
