# 🌦️ Omarchy Weather Plus

<p align="center">
  <b>A richer, still featherweight, weather widget for the Omarchy shell: rain forecast, hourly strip, UV, sunrise/sunset and a live radar link.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Omarchy-Shell%20Plugin-blue?style=flat-square" alt="Omarchy Plugin" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/API%20key-none%20needed-brightgreen?style=flat-square" alt="No API key" />
  <img src="https://img.shields.io/badge/Map%20tiles-zero-orange?style=flat-square" alt="Zero map tiles" />
</p>

Weather Plus is built on top of Omarchy's stock weather plugin (`omarchy.weather`), keeping its look and feel, and adds the things you actually want to know at a glance: *will it rain, when, and how much?*

---

## 📸 Screenshots

<p align="center">
  <b>The popup</b><br>
  <img src="assets/panel.png" alt="Weather Plus popup" width="80%" />
</p>

<p align="center">
  <b>Current conditions &amp; stats grid</b><br>
  <i>Temperature, today's high/low, feels-like, wind, humidity, UV index, sunrise and sunset</i><br>
  <img src="assets/stats.png" alt="Stats grid" width="80%" />
</p>

<p align="center">
  <b>Hourly strip with rain probability bars</b><br>
  <i>Scroll horizontally with the mouse wheel / touchpad, or click and drag</i><br>
  <img src="assets/hourly.png" alt="Hourly forecast" width="80%" />
</p>

<p align="center">
  <b>Bar pill</b><br>
  <img src="assets/bar.png" alt="Bar widget" width="40%" />
</p>

---

## ✨ Features

- 💧 **Rain summary banner:** one line that says it all — *"Rain right now (72%)"*, *"Rain expected around 3 PM (80% · ~2.1 mm)"* or *"No rain expected today"*.
- 🌡️ **Today's high & low** right under the current temperature.
- ☀️ **UV index, sunrise and sunset** in a clean 3×2 stats grid, each with its own icon.
- 📊 **Hourly strip with rain-probability mini bars:** an equalizer-style view of the next hours, scrollable horizontally (wheel, touchpad or drag).
- 🔵 **Imminent rain dot:** a small blue dot on the bar pill when rain is likely (≥ 60 %) in the next couple of hours — no need to open the popup.
- 🗺️ **"Open live radar" button:** opens RainViewer for your exact coordinates in your default browser.
- 🌍 **Follows the system language:** English by default, Portuguese when Omarchy is set to `pt` / `pt-BR`. 12h/24h hours and °C/°F, mph/km/h follow your locale.
- 📍 **Click the location** (top left) to search and change the city, exactly like the stock widget.

## 🪶 Lightweight by design

Weather widgets that embed map tiles can freeze a desktop shell: loading dozens of remote images on the UI thread blocks the compositor. Weather Plus **never downloads map tiles or images**. Everything comes from a **single small JSON request** to [Open-Meteo](https://open-meteo.com/) (free, no API key), and the radar opens in your browser instead of inside the shell.

---

## 🚀 Installation

```bash
omarchy plugin add https://github.com/gusthanks/omarchy-weather --enable
omarchy restart shell
```

Then, if you were using the stock weather widget, replace it in `~/.config/omarchy/shell.json`:

```diff
-        { "id": "omarchy.weather" },
+        { "id": "gusthx.weather" },
```

> [!NOTE]
> Weather Plus is a drop-in replacement for the stock `omarchy.weather` widget. Use **one or the other**, not both at the same time.

### Updating

```bash
omarchy plugin update gusthx.weather --yes
omarchy restart shell
```

### Toggle from a keybinding

```bash
quickshell -p /usr/share/omarchy/shell ipc call gusthx.weather toggle
```

Other IPC calls: `open`, `close`, `edit` (jump straight into the location search).

---

## 🖱️ Bar interactions

| Action | Result |
|---|---|
| Left click | Open / close the popup |
| Middle click | Refresh now |
| Right click | Send the current weather as a desktop notification |

## 📁 Files

| File | Purpose |
|---|---|
| `BarWidget.qml` | Bar pill and imminent-rain dot |
| `Panel.qml` | Popup UI and data fetching |
| `Model.js` | Pure helpers: parsing, units, rain summary, sunrise/sunset formatting |
| `manifest.json` | Omarchy plugin manifest |

## 🙏 Credits

Based on the stock Omarchy weather plugin. Weather data by [Open-Meteo](https://open-meteo.com/), radar by [RainViewer](https://www.rainviewer.com/).

## 📄 License

[MIT](LICENSE) © Gustavo Costa
