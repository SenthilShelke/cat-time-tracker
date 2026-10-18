# cat-time-tracker

A tiny cat that lives in your **menu bar** (next to wifi/battery on macOS, or
the system tray on Windows/Linux) and tracks your working hours. Click the cat
icon to drop down a little control panel, hit **Start work**, and the menu-bar
clock starts ticking. Click **Stop work** and it stops. Perfect for part-time
or freelance work where you need to tally hours each pay period.

Built with [Electron](https://www.electronjs.org/) and plain HTML/CSS/JS — no
build step for development, no framework. Clone it and run it, or package it
into a double-click app so you never touch the terminal again.

## Features

- 🐱 Lives in your **menu bar / system tray** — out of the way, always running
- ⏱️ Live session clock shown right in the menu bar while you work
- ▶️ One-click start/stop — from the dropdown panel *or* the tray's right-click menu
- 🙀 Click the icon and a little control panel drops down below it
- 📅 Totals for **today** and the current **invoicing period** (fixed periods
  anchored to a start date you choose, default 2 weeks)
- 💵 Optional hourly rate → shows estimated pay for the period
- 🎨 Settings screen: hourly rate, period start/length, accent color, and
  **start-at-login**
- 🚀 Optional **launch at login** so the cat is always there after a reboot
- 📦 Package into a double-click app — no terminal needed
- 💾 Your data stays local in a plain JSON file — nothing leaves your machine

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (includes `npm`)

## Download (easiest — no terminal, no cloning)

Most people don't need the code at all. Just grab the app:

1. Go to the **[Releases page](https://github.com/SenthilShelke/cat-time-tracker/releases/latest)**.
2. Download the latest installer for your platform:
   - **macOS (Apple Silicon):** `Cat Time Tracker-<version>-arm64.dmg`
   - **Windows / Linux:** see the assets on the release (if published).
3. Open the `.dmg` and drag **Cat Time Tracker** into your Applications folder.
4. Launch it. The cat appears in your menu bar.

> First launch on macOS: the app is unsigned, so right-click it →
> **Open** once to get past the "unidentified developer" prompt. Free, and
> only needed the first time.

Then open **Settings → Start automatically at login** so the cat comes back on
its own after every reboot — fully terminal-free from here on.

New versions show up on that same Releases page; download the new `.dmg` and
drag-to-replace. Your logged hours carry over automatically (your data lives
outside the app — see [Where your data lives](#where-your-data-lives)).

## Build it yourself (optional)

Prefer to build the installer from source instead of downloading it?

```bash
git clone https://github.com/SenthilShelke/cat-time-tracker.git
cd cat-time-tracker
npm install
npm run dist
```

This produces an installer in `dist/`:

- **macOS:** `dist/Cat Time Tracker-<version>-arm64.dmg`
- **Windows:** an `.exe` installer (build on a Windows machine).
- **Linux:** an `.AppImage`.

Install it the same way as a downloaded build.

## For developers

To run from source with live reloading of your edits (no packaging):

```bash
git clone https://github.com/SenthilShelke/cat-time-tracker.git
cd cat-time-tracker
npm install
npm start
```

The cat icon appears in your **menu bar** (macOS, top-right) or **system
tray** (Windows/Linux). Click it to drop down the control panel; click the ✕
to tuck it back into the menu bar. While a session is running, the elapsed
time shows next to the icon. Right-click the icon for a quick Start/Stop menu
and Quit.

### Cutting a release

Releases are built and published automatically by GitHub Actions
(`.github/workflows/release.yml`). To ship a new version:

```bash
# 1. Bump the version in package.json (e.g. 0.1.0 -> 0.1.1), commit it.
# 2. Tag and push:
git tag v0.1.1
git push --tags
```

Pushing a `v*` tag triggers the workflow, which builds the macOS DMG and
attaches it to a new GitHub Release named after the tag. Users then download
it from the Releases page — no action needed from them beyond re-downloading.

## Where your data lives

Sessions are stored in a `sessions.json` file in Electron's per-user data
directory (so it survives restarts and is never committed to the repo):

- **macOS:** `~/Library/Application Support/cat-time-tracker/sessions.json`
- **Windows:** `%APPDATA%\cat-time-tracker\sessions.json`
- **Linux:** `~/.config/cat-time-tracker/sessions.json`

The file looks like this:

```json
{
  "activeStart": null,
  "sessions": [
    { "start": 1760000000000, "end": 1760003600000 }
  ],
  "settings": {
    "hourlyRate": 25,
    "currency": "USD",
    "periodStart": "2026-10-01",
    "periodDays": 14,
    "accentColor": "#7bb661"
  }
}
```

`start`/`end` are millisecond timestamps. You can open this file to inspect or
hand-edit your logged time.

## Settings

Click the gear icon in the panel to open settings:

- **Hourly rate** (optional) + currency — when set, the panel shows estimated
  pay for the current period.
- **Period start date** — anchors your invoicing periods. The widget figures
  out which fixed period today falls into and shows its start/end dates.
- **Period length (days)** — defaults to 14 (two weeks).
- **Widget accent color** — the color of buttons and highlights.
- **Start automatically at login** — when on, the app launches itself every
  time you log in, so the cat is always waiting in the menu bar.

> "This period" is a **fixed** window, not a rolling one: periods repeat every
> _period length_ days starting from your _period start date_, so the totals
> line up with the invoices you actually send.

## Customizing

- **Swap the panel cat art:** replace `src/assets/cat-peek.webp` (the cat
  peeking over the panel). Any image format a browser supports works
  (webp/png/gif/svg); keep the same filename or update the `src` path in
  `src/renderer/index.html`.
- **Swap the menu-bar icon:** replace `src/assets/catTemplate.png` (16×16) and
  `src/assets/catTemplate@2x.png` (32×32). On macOS these are *template*
  images — a black shape on transparency — so the system can tint them for
  light/dark menu bars.
- **Widget accent color** is set in-app via Settings; it drives the buttons
  and highlights.

## Roadmap

Ideas for future versions (contributions welcome):

- CSV / printable invoice export for a pay period
- Idle auto-pause (stop counting when you step away)
- Project / client tagging

## Project structure

```
cat-time-tracker/
├── package.json
├── src/
│   ├── main.js            # Electron main process: window + JSON data/settings I/O
│   ├── preload.js         # Secure IPC bridge (contextIsolation)
│   ├── assets/            # Cat images (swap to use your own art)
│   └── renderer/          # The widget UI (HTML/CSS/JS)
└── LICENSE
```

## License

[MIT](./LICENSE)
