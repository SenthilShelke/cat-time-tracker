# cat-time-tracker

A tiny floating cat that lives on your screen and tracks your working hours.
Click the cat to open a little control panel, hit **Start work**, and the cat
wakes up. Click **Stop work** and it curls back up to sleep. Perfect for
part-time or freelance work where you need to tally hours each pay period.

Built with [Electron](https://www.electronjs.org/) and plain HTML/CSS/JS — no
build step, no framework. Clone it and run it.

## Features

- 🐱 Always-on-top, draggable cat widget that stays out of your way
- ▶️ One-click start/stop timer (awake cat = working, sleeping cat = stopped)
- 🙀 Click the cat and it pops up to "grab" the control panel, head and paws
  draped over the top
- ⏱️ Live current-session clock
- 📅 Totals for **today** and the current **invoicing period** (fixed periods
  anchored to a start date you choose, default 2 weeks)
- 💵 Optional hourly rate → shows estimated pay for the period
- 🎨 Settings screen: hourly rate, period start/length, widget accent color
- 💾 Your data stays local in a plain JSON file — nothing leaves your machine

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (includes `npm`)

## Getting started

```bash
git clone https://github.com/SenthilShelke/cat-time-tracker.git
cd cat-time-tracker
npm install
npm start
```

The cat appears as a small floating window. Drag it anywhere by its body.
Click it to expand the panel; click the ✕ to collapse back to just the cat.

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

> "This period" is a **fixed** window, not a rolling one: periods repeat every
> _period length_ days starting from your _period start date_, so the totals
> line up with the invoices you actually send.

## Customizing

- **Swap the cat art:** replace the images in `src/assets/` —
  `cat-default.webp` (collapsed/sitting cat) and `cat-peek.webp` (the cat
  peeking over the panel). Any image format a browser supports works
  (webp/png/gif/svg); keep the same filenames or update the `src` paths in
  `src/renderer/index.html`.
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
