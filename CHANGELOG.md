# Changelog

## 1.2.0 (2026-11-09)

### Changed

- The plugin answers IPC only on its own target, `gusthx.weather`
  (`omarchy-shell gusthx.weather toggle|open|close|edit`). It no longer claims the stock
  `omarchy.weather` target: if a keybinding of yours calls `omarchy-shell omarchy.weather ...`,
  point it at `gusthx.weather`.
- Strings come from the plugin's own catalog in `i18n/` (read through
  `Commons.Translations`) instead of hardcoded English/Portuguese branches. English,
  Portuguese (pt and pt-BR), Spanish, French, German and Italian are complete; the other
  languages Omarchy ships get the stock widget's labels (feels, wind, humidity, fetching,
  search city), with the newer rain/UV/sun lines in English.
- The location search asks Open-Meteo for results in the shell language.
- The popup content is split into `WeatherView.qml`, the imminent-rain dot into
  `RainDot.qml`, and the radar link is built by `Model.radarUrl()`.
- Manifest: license field, search aliases (weather, rain, forecast), clearer descriptions.

### Development

- `dev/run.sh`: an isolated Quickshell harness that compiles every type (`check`), runs the
  Model.js and catalog tests (`test`), and renders the README screenshots and the demo GIF
  (`panel`, `dry`, `search`, `bar`, `gif`, `docs`) offscreen from mock data. It never
  touches the running shell, the network or your location.
- `dev/tests/`: Model.js and i18n catalog tests (`node --test`, no npm packages), including
  a check that every catalog holds only known keys.
- `dev/deploy.sh`: installs `HEAD` into the live plugin as a git checkout and restarts the
  shell once. It backs up a plain copy first, refuses a detached `HEAD`, and clones into a
  staging folder so a failed clone never leaves the bar without the widget.
- README rewritten (install, use, configuration, privacy, development), with screenshots and
  a demo GIF rendered from mock data; `README.pt-BR.md` added. `AGENTS.md` describes how to
  work on the plugin without touching the live install.

## 1.1.0 (2026-11-07)

First public release, built on Omarchy's stock weather widget (`omarchy.weather`).

- Rain summary banner with chance and amount.
- Today's high and low under the current temperature.
- Stats grid: feels-like, wind, humidity, UV index, sunrise and sunset.
- Hourly strip for the next 24 hours with rain-chance bars, scrollable sideways.
- Imminent-rain dot on the bar icon.
- *Open live radar* button that opens RainViewer at the current coordinates.
- English and Portuguese strings.
- No map tiles: forecasts from Open-Meteo and wttr.in, no API key.
