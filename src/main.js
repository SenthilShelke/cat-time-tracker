'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');

// Window sizes for the panel's two UI states. (The old "collapsed" cat-only
// state is gone: the menu-bar/tray icon is now the collapsed state.)
const EXPANDED = { width: 260, height: 360 };
const SETTINGS = { width: 300, height: 440 };

let win = null;
let tray = null;

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
    openAtLogin: false, // start the app automatically on login
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

// The panel window: a frameless popover that drops down under the tray icon.
// It starts hidden; clicking the tray icon shows/positions it.
function createWindow() {
  win = new BrowserWindow({
    width: EXPANDED.width,
    height: EXPANDED.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Hide the panel when it loses focus (native menu-bar popover behavior),
  // unless we're mid-toggle from a tray click (avoids a blur/click race that
  // could leave the panel stuck).
  win.on('blur', () => {
    if (Date.now() < suppressBlurUntil) return;
    if (win && !win.webContents.isDevToolsOpened()) win.hide();
  });
}

// When the tray icon is clicked, macOS fires the window's 'blur' first (which
// would hide it) and then the tray 'click'. We briefly suppress blur-hide so
// the click's toggle logic sees the true visibility and behaves predictably.
let suppressBlurUntil = 0;

// Position the panel just under the tray icon and show it.
function showPanel() {
  if (!win || !tray) return;
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  // Center the panel horizontally under the icon, clamped to the screen.
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const workArea = display.workArea;
  const minX = workArea.x + 4;
  const maxX = workArea.x + workArea.width - winBounds.width - 4;
  x = Math.max(minX, Math.min(x, maxX));

  // Just below the menu bar / tray icon.
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  win.setPosition(x, y, false);
  // Ignore the transient blur that can fire as the window appears/takes focus.
  suppressBlurUntil = Date.now() + 250;
  win.show();
  win.focus();
}

function togglePanel() {
  if (!win) return;
  // The tray click always SHOWS the panel. Closing is handled by the ✕ button
  // and by clicking outside the panel (the window's blur handler). This avoids
  // the macOS blur-vs-click race that previously left the panel unable to
  // reopen. Showing an already-visible panel just re-focuses it (harmless).
  showPanel();
}

// Build the tray icon's right-click context menu. `panelOpen` is passed by
// the caller (captured before any blur-hide race); falls back to a live check.
function buildTrayMenu(panelOpen) {
  const data = readData();
  const running = data.activeStart != null;
  if (typeof panelOpen !== 'boolean') {
    panelOpen = !!(win && !win.isDestroyed() && win.isVisible());
  }

  const template = [
    {
      label: running ? 'Stop work' : 'Start work',
      click: () => {
        toggleSessionFromTray();
      },
    },
  ];

  // Only offer "Open panel" when the panel isn't already showing.
  if (!panelOpen) {
    template.push({ label: 'Open panel', click: () => showPanel() });
  }

  template.push(
    { type: 'separator' },
    { label: 'Quit Cat Time Tracker', click: () => app.quit() }
  );

  return Menu.buildFromTemplate(template);
}

// Create the menu-bar / system-tray icon.
function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'assets', 'catTemplate.png')
  );
  // Template image => macOS auto-adapts it to light/dark menu bars.
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Cat Time Tracker');

  // Left click toggles the panel; right click shows the menu.
  tray.on('click', () => togglePanel());
  tray.on('right-click', () => {
    // Capture visibility now, before any blur-hide can race in, so the menu
    // reflects whether the panel is actually open to the user.
    const panelOpen = !!(win && !win.isDestroyed() && win.isVisible());
    suppressBlurUntil = Date.now() + 250;
    tray.popUpContextMenu(buildTrayMenu(panelOpen));
  });

  updateTrayTitle();
}

// Reflect running state in the menu-bar text (e.g. "1:23") and refresh menu.
function updateTrayTitle() {
  if (!tray) return;
  const data = readData();
  if (data.activeStart != null) {
    const totalSec = Math.floor((Date.now() - data.activeStart) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const label = h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`;
    tray.setTitle(` ${label}`);
  } else {
    tray.setTitle('');
  }
}

let trayTick = null;
function startTrayTick() {
  if (!trayTick) trayTick = setInterval(updateTrayTitle, 1000);
}
function stopTrayTick() {
  if (trayTick) {
    clearInterval(trayTick);
    trayTick = null;
  }
  updateTrayTitle();
}

// Start/stop the session from the tray menu, keeping UI + tray in sync.
function toggleSessionFromTray() {
  const data = readData();
  if (data.activeStart != null) {
    const start = data.activeStart;
    const end = Date.now();
    if (end > start) data.sessions.push({ start, end });
    data.activeStart = null;
    writeData(data);
    stopTrayTick();
  } else {
    data.activeStart = Date.now();
    writeData(data);
    startTrayTick();
  }
  // Push fresh state to the renderer if it's open.
  if (win && !win.isDestroyed()) win.webContents.send('state-changed', data);
}

// Apply the launch-at-login OS setting from persisted settings.
// On macOS a raw `electron .` dev run (unsigned, not a bundled .app) may be
// denied by the OS; that's expected and harmless — it works in the packaged
// app. We swallow the error so it never breaks startup or saving settings.
function applyLoginItem() {
  const data = readData();
  const open = !!(data.settings && data.settings.openAtLogin);
  try {
    app.setLoginItemSettings({ openAtLogin: open });
  } catch (err) {
    console.warn('setLoginItemSettings failed (ok in dev):', err.message);
  }
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
    startTrayTick();
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
    stopTrayTick();
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
  // Apply any OS-level settings that changed (launch at login).
  applyLoginItem();
  return data;
});

// Resize the window for a given view: 'expanded' | 'settings'.
// (There is no 'collapsed' window anymore — collapsing hides the panel back
// into the menu-bar/tray icon.)
ipcMain.handle('set-view', (_event, view) => {
  if (!win) return;
  if (view === 'collapsed') {
    win.hide();
    return;
  }
  const size = view === 'settings' ? SETTINGS : EXPANDED;
  win.setSize(size.width, size.height, false);
});

app.whenReady().then(() => {
  // Hide from the macOS Dock — this is a menu-bar app, not a Dock app.
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createWindow();
  createTray();
  applyLoginItem();

  // If a session was already running (e.g. after a restart), resume the
  // live menu-bar clock.
  const data = readData();
  if (data.activeStart != null) startTrayTick();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// This is a menu-bar app: closing/hiding the panel window must NOT quit it.
// The app stays alive in the tray until the user chooses Quit.
app.on('window-all-closed', () => {
  // Intentionally do nothing (stay running in the menu bar).
});
