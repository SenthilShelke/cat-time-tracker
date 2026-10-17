'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Window sizes for the three UI states.
const COLLAPSED = { width: 120, height: 120 };
const EXPANDED = { width: 260, height: 360 };
const SETTINGS = { width: 300, height: 440 };

let win = null;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Default settings. `periodStart` is an ISO date string (YYYY-MM-DD) marking
// the first day of the user's first invoicing period; periods repeat every
// `periodDays` days from there.
function defaultSettings() {
  return {
    hourlyRate: null, // number or null (optional)
    currency: 'USD',
    periodStart: todayISO(), // anchor date for fixed pay periods
    periodDays: 14,
    accentColor: '#7bb661',
  };
}

// Path to the sessions data file, stored in Electron's per-user data dir
// (outside the repo, so it persists across restarts and is never committed).
function dataFilePath() {
  return path.join(app.getPath('userData'), 'sessions.json');
}

// Read the data file. Returns a default shape if missing or corrupt.
function readData() {
  const file = dataFilePath();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad shape');
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeStart:
        typeof parsed.activeStart === 'number' ? parsed.activeStart : null,
      // Merge persisted settings over defaults so new fields get sane values.
      settings: Object.assign(
        defaultSettings(),
        parsed.settings && typeof parsed.settings === 'object'
          ? parsed.settings
          : {}
      ),
    };
  } catch (err) {
    // Missing file or invalid JSON -> start fresh.
    return { sessions: [], activeStart: null, settings: defaultSettings() };
  }
}

// Write the data file atomically (write to temp, then rename).
function writeData(data) {
  const file = dataFilePath();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function createWindow() {
  win = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep it above fullscreen apps / other spaces where possible.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ---- IPC handlers (all data mutation happens here, in the main process) ----

// Return current state: whether a session is active, its start time, and
// all recorded sessions.
ipcMain.handle('get-state', () => {
  return readData();
});

// Start a session. Records the start timestamp if none is active.
ipcMain.handle('start-session', () => {
  const data = readData();
  if (data.activeStart == null) {
    data.activeStart = Date.now();
    writeData(data);
  }
  return data;
});

// Stop the active session. Appends a completed session record.
ipcMain.handle('stop-session', () => {
  const data = readData();
  if (data.activeStart != null) {
    const start = data.activeStart;
    const end = Date.now();
    if (end > start) {
      data.sessions.push({ start, end });
    }
    data.activeStart = null;
    writeData(data);
  }
  return data;
});

// Persist settings. Accepts a partial object and merges it over existing.
ipcMain.handle('save-settings', (_event, partial) => {
  const data = readData();
  data.settings = Object.assign(
    data.settings,
    partial && typeof partial === 'object' ? partial : {}
  );
  writeData(data);
  return data;
});

// Resize the window for a given view: 'collapsed' | 'expanded' | 'settings'.
ipcMain.handle('set-view', (_event, view) => {
  if (!win) return;
  const size =
    view === 'settings' ? SETTINGS : view === 'expanded' ? EXPANDED : COLLAPSED;
  win.setSize(size.width, size.height, false);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Keep running when all windows close only on non-macOS; on macOS the widget
// window IS the app, so quit when it closes.
app.on('window-all-closed', () => {
  app.quit();
});
