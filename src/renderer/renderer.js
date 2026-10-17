'use strict';

// --- Element refs ---
const bodyEl = document.body;
const catWrap = document.getElementById('cat-wrap');
const collapseBtn = document.getElementById('collapse-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsBack = document.getElementById('settings-back');
const settingsSave = document.getElementById('settings-save');
const toggleBtn = document.getElementById('toggle-btn');
const statusLabel = document.getElementById('status-label');
const elapsedEl = document.getElementById('elapsed');
const periodTotalEl = document.getElementById('period-total');
const periodDatesEl = document.getElementById('period-dates');
const todayTotalEl = document.getElementById('today-total');
const payRow = document.getElementById('pay-row');
const periodPayEl = document.getElementById('period-pay');

// Settings inputs
const inRate = document.getElementById('set-rate');
const inCurrency = document.getElementById('set-currency');
const inPeriodStart = document.getElementById('set-period-start');
const inPeriodDays = document.getElementById('set-period-days');
const inAccent = document.getElementById('set-accent');

// --- Local view of state (source of truth lives in the main process) ---
let activeStart = null;
let sessions = [];
let settings = null;
let view = 'collapsed'; // 'collapsed' | 'expanded' | 'settings'
let tick = null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- Formatting helpers ---
function fmtClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function fmtDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Parse an ISO (YYYY-MM-DD) date string to a local-midnight timestamp.
function parseISODateLocal(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return startOfToday();
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Compute the current fixed invoicing period [start, end) that today falls in,
// anchored at settings.periodStart and repeating every settings.periodDays.
function currentPeriod() {
  const anchor = parseISODateLocal(settings.periodStart);
  const len = Math.max(1, Number(settings.periodDays) || 14);
  const now = Date.now();
  const spanMs = len * MS_PER_DAY;
  // How many whole periods have elapsed since the anchor (can be negative if
  // the anchor is in the future -> clamp to the first period).
  const elapsed = now - anchor;
  const idx = elapsed >= 0 ? Math.floor(elapsed / spanMs) : 0;
  const start = anchor + idx * spanMs;
  const end = start + spanMs;
  return { start, end, len };
}

// Sum completed-session durations overlapping [from, to], plus the running
// session's elapsed time within the window.
function sumBetween(from, to) {
  const now = Date.now();
  const cap = Math.min(to, now);
  let total = 0;
  for (const s of sessions) {
    const start = Math.max(s.start, from);
    const end = Math.min(s.end, cap);
    if (end > start) total += end - start;
  }
  if (activeStart != null) {
    const start = Math.max(activeStart, from);
    if (cap > start) total += cap - start;
  }
  return total;
}

// --- Rendering ---
function render() {
  const running = activeStart != null;
  bodyEl.classList.toggle('running', running);

  statusLabel.textContent = running ? 'Working' : 'Stopped';
  toggleBtn.textContent = running ? 'Stop work' : 'Start work';
  toggleBtn.classList.toggle('stop', running);
  toggleBtn.classList.toggle('start', !running);

  elapsedEl.textContent = fmtClock(running ? Date.now() - activeStart : 0);

  const period = currentPeriod();
  const periodMs = sumBetween(period.start, period.end);
  periodTotalEl.textContent = fmtDuration(periodMs);
  periodDatesEl.textContent = `${fmtDate(period.start)} – ${fmtDate(
    period.end - MS_PER_DAY
  )}`;
  todayTotalEl.textContent = fmtDuration(sumBetween(startOfToday(), Date.now()));

  // Period pay (only when an hourly rate is set).
  const rate = Number(settings.hourlyRate);
  if (settings.hourlyRate != null && !Number.isNaN(rate) && rate > 0) {
    payRow.classList.remove('hidden');
    const hours = periodMs / 3600000;
    const amount = hours * rate;
    periodPayEl.textContent = `${(settings.currency || '').trim()} ${amount.toFixed(
      2
    )}`.trim();
  } else {
    payRow.classList.add('hidden');
  }
}

// Apply theme (accent color) to the DOM.
function applyTheme() {
  if (settings.accentColor) {
    document.documentElement.style.setProperty('--accent', settings.accentColor);
  }
}

function startTicking() {
  if (!tick) tick = setInterval(render, 1000);
}
function stopTicking() {
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
}

// --- Sync local state from main process ---
async function refresh(data) {
  if (!window.catTimer) {
    console.error('catTimer bridge unavailable — preload failed to load.');
    return;
  }
  const state = data || (await window.catTimer.getState());
  activeStart = state.activeStart;
  sessions = state.sessions || [];
  settings = state.settings;
  applyTheme();
  if (activeStart != null) startTicking();
  else stopTicking();
  render();
}

// --- View switching ---
async function setView(next) {
  view = next;
  bodyEl.setAttribute('data-view', next);
  if (next === 'settings') populateSettingsForm();
  render();
  try {
    await window.catTimer.setView(next);
  } catch (err) {
    console.error('setView IPC failed:', err);
  }
}

// --- Settings form ---
function populateSettingsForm() {
  inRate.value = settings.hourlyRate == null ? '' : settings.hourlyRate;
  inCurrency.value = settings.currency || '';
  inPeriodStart.value = settings.periodStart || '';
  inPeriodDays.value = settings.periodDays || 14;
  inAccent.value = settings.accentColor || '#7bb661';
}

async function saveSettingsForm() {
  const rateRaw = inRate.value.trim();
  const partial = {
    hourlyRate: rateRaw === '' ? null : Number(rateRaw),
    currency: inCurrency.value.trim() || 'USD',
    periodStart: inPeriodStart.value || settings.periodStart,
    periodDays: Math.max(1, Number(inPeriodDays.value) || 14),
    accentColor: inAccent.value,
  };
  const data = await window.catTimer.saveSettings(partial);
  await refresh(data);
  setView('expanded');
}

// --- Event wiring ---
catWrap.addEventListener('click', () => setView('expanded'));
collapseBtn.addEventListener('click', () => setView('collapsed'));
settingsBtn.addEventListener('click', () => setView('settings'));
settingsBack.addEventListener('click', () => setView('expanded'));
settingsSave.addEventListener('click', saveSettingsForm);

toggleBtn.addEventListener('click', async () => {
  if (activeStart != null) {
    await refresh(await window.catTimer.stopSession());
  } else {
    await refresh(await window.catTimer.startSession());
  }
});

// Live-preview accent color as the user changes it in settings.
inAccent.addEventListener('input', () => {
  document.documentElement.style.setProperty('--accent', inAccent.value);
});

// --- Init ---
refresh();
