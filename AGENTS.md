# Notes for AI agents (and humans) working on this plugin

## Never work on the live plugin

The copy installed at `~/.config/omarchy/plugins/gusthx.weather/` is the one the user's Omarchy
shell is running. Saving a file there hot-reloads the plugin in the user's bar, and
`omarchy restart shell` restarts the whole bar. Doing that over and over while developing
is disruptive.

- **Edit only this repository** (the working copy in `~/Work/`).
- **Do not** edit, copy into, or `git` anything under `~/.config/omarchy/plugins/`.
- **Do not** run `omarchy restart shell`, `omarchy refresh shell`, `omarchy theme set`,
  or IPC calls (`omarchy-shell gusthx.weather ...`) to test a change.
- **Do not** take screenshots of the user's desktop (`grim`) to check your work.

## Test and capture in isolation

`dev/run.sh` starts a **separate** Quickshell instance (config dir
`$XDG_RUNTIME_DIR/gusthx-weather-dev`) with Omarchy's `Commons`/`Ui` libraries, this repo
and `dev/MockWeather.qml`, which feeds `WeatherView.qml` the mock forecasts in `dev/mock/`
through the real `Model.js`. It never touches the running shell, the network, the user's
location file or `shell.json`. Captures render offscreen (Qt's offscreen platform), so
they also work with the screen off; `HEADLESS=0` draws on a background layer surface
instead.

```bash
dev/run.sh check     # compile every type, Panel.qml and BarWidget.qml included (deploy runs this too)
dev/run.sh test      # Model.js + i18n catalog tests (node --test, no npm packages)
dev/run.sh panel     # docs/panel.png         rain expected this afternoon
dev/run.sh dry       # docs/panel-dry.png     no rain today
dev/run.sh search    # docs/panel-search.png  location search with suggestions
dev/run.sh bar       # docs/bar.png           the pill with the imminent-rain dot
dev/run.sh docs      # all four captures
dev/run.sh preview   # the popup content in a window
LANGUAGE=pt-BR dev/run.sh panel   # any capture in another language (docs/<name>-pt-BR.png)
```

QML warnings from the harness are printed by `dev/run.sh`; fix them before going further.
Look at the images you render. Also run `omarchy plugin validate .` (it refuses symlinks,
so never leave a `node_modules/` in the repo).

What the harness cannot render (the real popup window, live data, the real bar) is checked
by the user after deploying, not by you on their live shell.

## Deploy once, at the end, and restart the bar

When ALL the requested work is finished, tested in the harness and committed:

```bash
dev/deploy.sh   # validates, compiles, installs HEAD into the live plugin, restarts the shell once
```

If the live plugin is a plain copy (no `.git`), deploy moves it to
`~/Work/backups/gusthx.weather.<timestamp>` and replaces it with a git checkout of this
repo; later deploys fast-forward it. The shell's hot reload is not reliable for plugins
(the old version can stay on screen), so the deploy always ends with one
`omarchy restart shell`. Do not tell the user something is done before this ran. Never use
`omarchy refresh shell` (it resets the bar layout). Never deploy or restart in the middle
of a task.

## Other conventions

- Repo root = plugin root (the layout `omarchy plugin add <url>` expects). Dev tooling
  lives in `dev/`, screenshots in `docs/`.
- Strings go through the plugin's own catalog in `i18n/` (`Commons.Translations`, reached
  through `Panel.tr()`; `Model.js` takes it as a `tr` argument), never through
  `Commons.I18n` keys, which Omarchy may rename. Add every new key to every catalog (a
  test checks this).
- `WeatherView.qml` reads everything from its `weather` object. A property or action added
  to `Panel.qml` for the view must be added to `dev/MockWeather.qml` too.
- Keep the bar widget cheap (the user's machine is an older laptop): no images or map
  tiles, no timers faster than the refresh, no new requests per refresh (today: Open-Meteo
  and wttr.in).
- Mock data only in the harness and tests: never the user's location, config or accounts.
