'use strict';

// Secure bridge between the renderer (UI) and the main process.
// With contextIsolation on and nodeIntegration off, the renderer cannot touch
// Node APIs directly. We expose only a small, explicit API surface here.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('catTimer', {
  getState: () => ipcRenderer.invoke('get-state'),
  startSession: () => ipcRenderer.invoke('start-session'),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  saveSettings: (partial) => ipcRenderer.invoke('save-settings', partial),
  // view: 'collapsed' | 'expanded' | 'settings'
  setView: (view) => ipcRenderer.invoke('set-view', view),
  // Subscribe to state pushed from the main process (e.g. when the user
  // starts/stops from the tray menu). Returns an unsubscribe function.
  onStateChanged: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('state-changed', handler);
    return () => ipcRenderer.removeListener('state-changed', handler);
  },
});
