import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import "weather/Model.js" as Model

// Stand-in for Panel.qml in the dev harness: the same properties and actions
// WeatherView reads, computed with the real Model.js from MOCK Open-Meteo data
// (dev/mock/*.json). No network, no location file, no shell.json.
Item {
  id: root

  // Which mock forecast to load: dev/mock/open-meteo-<scenario>.json.
  property string scenario: "rain"
  // The mock's "today", so captures do not depend on the real date.
  readonly property string today: "2026-06-15"

  property QtObject bar: QtObject {
    property color foreground: Commons.Color.foreground
    property color barForeground: Commons.Color.foreground
    property color urgent: Commons.Color.urgent
    property bool foregroundAnimationEnabled: false
    property string fontFamily: Style.font.family
    property bool vertical: false
    property int barSize: Style.bar.sizeHorizontal
    function showTooltip(item, text) {}
    function hideTooltip(item) {}
    function run(cmd) {}
  }

  Commons.Translations {
    id: strings
    directory: Qt.resolvedUrl("weather/i18n")
  }
  function tr(key, fallback) { return strings.t(key, fallback) }

  FileView {
    id: forecastFile
    path: Qt.resolvedUrl("weather/dev/mock/open-meteo-" + root.scenario + ".json")
    blockLoading: true
    printErrors: true
  }
  FileView {
    id: geocodingFile
    path: Qt.resolvedUrl("weather/dev/mock/geocoding.json")
    blockLoading: true
  }

  readonly property var report: null
  readonly property var dailyForecastReport: {
    try { return JSON.parse(forecastFile.text()) } catch (e) { return null }
  }

  property var locationState: ({ name: "Lisbon", latitude: 38.72, longitude: -9.14 })
  readonly property string reportLocation: locationState.name
  readonly property var areaInfo: null

  property bool editingLocation: false
  property bool savingLocation: false
  property var locationSuggestions: editingLocation ? Model.parseGeocodingResults(geocodingFile.text()) : []
  property int suggestionIndex: 0

  readonly property bool useImperial: false
  readonly property var current: Model.openMeteoCurrentCondition(dailyForecastReport)
  readonly property string label: Model.currentIcon(current, "")
  readonly property var forecastDays: Model.buildForecastDays(report, dailyForecastReport, today)
  readonly property var hourlyForecast: Model.openMeteoHourlyForecast(dailyForecastReport, 24, Commons.I18n.language, root.tr)

  function displayNumber(value) {
    if (value === undefined || value === null || value === "") return ""
    return Commons.I18n.formatNumber(value)
  }
  function formatTemp(value) { return Model.formatTemp(value, useImperial, Commons.I18n.formatNumber) }

  readonly property string reportTempNum: current ? displayNumber(current.temp_C) : ""
  readonly property string tempUnit: "°C"
  readonly property string reportFeels: current ? formatTemp(current.FeelsLikeC) : ""
  readonly property string reportWind: current ? displayNumber(current.windspeedKmph) + " km/h" : ""
  readonly property string reportHumidity: current ? displayNumber(current.humidity) + "%" : ""
  readonly property var todayHiLo: Model.extractTodayHighLow(report, dailyForecastReport, useImperial)
  readonly property string todayMax: todayHiLo.max
  readonly property string todayMin: todayHiLo.min
  readonly property var sunTimes: Model.extractSunTimes(report, dailyForecastReport, useImperial)
  readonly property string reportSunrise: sunTimes.sunrise
  readonly property string reportSunset: sunTimes.sunset
  readonly property string reportUv: Model.extractUvIndex(report, dailyForecastReport)
  readonly property var rainSummary: Model.computeRainSummary(hourlyForecast, root.tr, useImperial)
  readonly property bool hasImminentRain: Model.checkImminentRain(hourlyForecast)

  function dayName(dateString) {
    var locale = Qt.locale(Commons.I18n.formatLocale)
    return Model.dayName(dateString, function(date) { return locale.standaloneDayName(date.getDay(), Locale.LongFormat) })
  }
  function bareTempForDay(day, kind) { return Model.bareTempForDay(day, kind, useImperial, Commons.I18n.formatNumber) }
  function dayIcon(day) { return Model.dayIcon(day) }

  // Actions are no-ops (or local state only) in the harness.
  function startEditingLocation() { editingLocation = true }
  function cancelEditingLocation() { editingLocation = false }
  function commitLocation() { editingLocation = false }
  function clearLocation() { editingLocation = false }
  function pickSuggestion(s) { locationState = s; editingLocation = false }
  function locationTextEdited() {}
  function openRadar() { console.log("radar:", Model.radarUrl(locationState.latitude, locationState.longitude)) }
}
