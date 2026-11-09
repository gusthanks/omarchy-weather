// weather.json holds {"name": ..., "latitude": ..., "longitude": ...} (see
// omarchy-weather-location, which owns the format). Missing, blank, or
// unparseable means the location is auto-detected (see isAutoLocation).
function parseLocationFile(raw) {
  var unset = { name: "", latitude: null, longitude: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return unset

    var latitude = parseFloat(data.latitude)
    var longitude = parseFloat(data.longitude)
    var hasCoordinates = !isNaN(latitude) && !isNaN(longitude)
    return {
      name: typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null
    }
  } catch (e) {
    return unset
  }
}

// True when weather.json names no place: the panel then reports for wherever
// geo.omarchy.org places this network.
function isAutoLocation(state) {
  var s = state || {}
  return String(s.name || "") === "" && (s.latitude === null || s.latitude === undefined)
}

// The location to report for: the stored one, or with none stored, the one
// geo.omarchy.org detected. geo.omarchy.org answers in weather.json's shape, so
// both come from parseLocationFile.
function effectiveLocation(configured, detected) {
  return isAutoLocation(configured) && detected ? detected : configured
}

// wttr.in path segment for a configured location: exact coordinates when
// both are present, the URL-encoded name as a fallback (hand-edited
// weather.loc files may only carry a name), empty for IP auto-detect.
function wttrLocationQuery(location, latitude, longitude) {
  var lat = parseFloat(String(latitude))
  var lon = parseFloat(String(longitude))
  if (!isNaN(lat) && !isNaN(lon)) return lat + "," + lon

  var name = String(location || "").replace(/^\s+|\s+$/g, "")
  return name === "" ? "" : encodeURIComponent(name)
}

// Open-Meteo geocoding response → suggestion rows for the location picker.
function parseGeocodingResults(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    var results = data.results
    if (!results || !results.length) return []

    var out = []
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      if (!r || !r.name || r.latitude === undefined || r.longitude === undefined) continue
      var region = [r.admin1, r.country].filter(function(part) { return !!part }).join(", ")
      out.push({
        name: String(r.name),
        description: region,
        latitude: r.latitude,
        longitude: r.longitude
      })
    }
    return out
  } catch (e) {
    return []
  }
}

function locationCommit(text, suggestions, selectedIndex) {
  var name = String(text || "").replace(/^\s+|\s+$/g, "")
  if (name === "") return { name: "", latitude: null, longitude: null }

  var choices = suggestions || []
  var index = Math.max(0, Math.min(parseInt(selectedIndex, 10) || 0, choices.length - 1))
  var suggestion = choices[index]
  if (suggestion) return suggestion

  return { name: name, latitude: null, longitude: null }
}

function isFutureForecastDate(dateString, todayString) {
  if (!dateString) return false
  return String(dateString).slice(0, 10) > String(todayString || "")
}

function roundedTemp(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : String(Math.round(n))
}

function celsiusToFahrenheit(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : (n * 9 / 5) + 32
}

// fmt writes the number for display (QML passes I18n.formatNumber, so a
// Persian reading gets Persian digits); left out, it is written as it is.
function displayNumber(fmt) {
  return typeof fmt === "function" ? fmt : function(v, d) { return d === undefined ? String(v) : Number(v).toFixed(d) }
}

function formatTemp(value, useImperial, fmt) {
  if (value === undefined || value === null || value === "") return ""
  return displayNumber(fmt)(value) + "°" + (useImperial ? "F" : "C")
}

function normalizedUnit(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
}

function localeUsesImperial(localeName) {
  var name = String(localeName || "").replace(".", "_")
  return /^en[_-]US($|[_.-])/.test(name) || /^en[_-]LR($|[_.-])/.test(name) || /^my($|[_.-])/.test(name)
}

function countryUsesImperial(countryName) {
  var country = String(countryName || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/[._-]+/g, " ")
    .toLowerCase()
  if (!country) return null
  if (country === "us" || country === "usa" || country === "united states" || country === "united states of america") return true
  if (country === "liberia" || country === "myanmar" || country === "burma") return true
  return false
}

function shouldUseImperial(unitOverride, localeName, countryName) {
  var unit = normalizedUnit(unitOverride)
  if (unit === "imperial") return true
  if (unit === "metric") return false

  var countryPreference = countryUsesImperial(countryName)
  if (countryPreference !== null) return countryPreference

  return localeUsesImperial(localeName)
}

function dayName(dateString, formatter) {
  if (!dateString) return ""
  var d = new Date(dateString + "T12:00:00")
  if (isNaN(d.getTime())) return ""
  if (formatter) return formatter(d)
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]
}

function openMeteoForecastDays(dailyForecastReport, todayString) {
  var daily = dailyForecastReport && dailyForecastReport.daily ? dailyForecastReport.daily : null
  if (!daily || !daily.time) return []

  var result = []
  for (var i = 0; i < daily.time.length && result.length < 3; ++i) {
    var date = daily.time[i]
    if (!isFutureForecastDate(date, todayString)) continue

    var maxC = daily.temperature_2m_max ? daily.temperature_2m_max[i] : ""
    var minC = daily.temperature_2m_min ? daily.temperature_2m_min[i] : ""
    result.push({
      date: date,
      maxtempC: roundedTemp(maxC),
      mintempC: roundedTemp(minC),
      maxtempF: roundedTemp(celsiusToFahrenheit(maxC)),
      mintempF: roundedTemp(celsiusToFahrenheit(minC)),
      openMeteoWeatherCode: daily.weather_code ? daily.weather_code[i] : null
    })
  }
  return result
}

// Open-Meteo bundles current conditions with the daily forecast request and
// answers far faster than wttr.in. Normalize them to wttr's
// current_condition shape so the panel can use either source
// interchangeably. Open-Meteo reports metric (°C, km/h).
function openMeteoCurrentCondition(dailyForecastReport) {
  var current = dailyForecastReport && dailyForecastReport.current ? dailyForecastReport.current : null
  if (!current || current.temperature_2m === undefined || current.temperature_2m === null) return null
  return {
    temp_C: roundedTemp(current.temperature_2m),
    temp_F: roundedTemp(celsiusToFahrenheit(current.temperature_2m)),
    FeelsLikeC: roundedTemp(current.apparent_temperature),
    FeelsLikeF: roundedTemp(celsiusToFahrenheit(current.apparent_temperature)),
    windspeedKmph: roundedTemp(current.wind_speed_10m),
    windspeedMiles: roundedTemp(current.wind_speed_10m * 0.621371),
    humidity: roundedTemp(current.relative_humidity_2m),
    openMeteoWeatherCode: current.weather_code,
    isDay: current.is_day,
    uvIndex: current.uv_index !== undefined ? current.uv_index : null
  }
}

function currentIcon(current, fallback) {
  if (!current) return fallback || ""
  if (current.openMeteoWeatherCode !== undefined && current.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(current.openMeteoWeatherCode, Number(current.isDay) === 0)
  if (current.weatherCode !== undefined && current.weatherCode !== null)
    return iconForCode(current.weatherCode, false)
  return fallback || ""
}

// wttr.in has no day/night flag. Use its icon only to fill an empty initial
// state, never to replace a day/night-aware icon resolved by Open-Meteo.
function provisionalCurrentIcon(current, resolvedIcon) {
  return resolvedIcon || currentIcon(current, "")
}

function weatherResponseCompletesSave(hasConfiguredCoordinates, source) {
  return hasConfiguredCoordinates ? source === "open-meteo" : source === "wttr"
}

function wttrNextForecastDays(report, todayString) {
  var days = report && report.weather ? report.weather : []
  var result = []
  for (var i = 0; i < days.length && result.length < 3; ++i) {
    if (isFutureForecastDate(days[i].date, todayString)) result.push(days[i])
  }
  return result
}

function buildForecastDays(report, dailyForecastReport, todayString) {
  var days = openMeteoForecastDays(dailyForecastReport, todayString)
  return days.length > 0 ? days : wttrNextForecastDays(report, todayString)
}

function bareTempForDay(day, kind, useImperial, fmt) {
  if (!day) return ""
  var v = useImperial
    ? (kind === "max" ? day.maxtempF : day.mintempF)
    : (kind === "max" ? day.maxtempC : day.mintempC)
  if (v === undefined || v === null || v === "") return ""
  return displayNumber(fmt)(v) + "°"
}

function dayIcon(day) {
  if (!day) return ""
  if (day.openMeteoWeatherCode !== undefined && day.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(day.openMeteoWeatherCode)
  if (!day.hourly || day.hourly.length === 0) return ""

  var best = day.hourly[0]
  var bestDist = 9999
  for (var i = 0; i < day.hourly.length; ++i) {
    var t = parseInt(String(day.hourly[i].time || "0"), 10)
    var dist = Math.abs(t - 1200)
    if (dist < bestDist) {
      bestDist = dist
      best = day.hourly[i]
    }
  }
  return iconForCode(best.weatherCode, false)
}

function iconForOpenMeteoCode(code, night) {
  var c = parseInt(String(code || "0"), 10)
  if (c === 0) return iconForCode(113, night)
  if (c === 1 || c === 2) return iconForCode(116, night)
  if (c === 3) return iconForCode(119, night)
  if (c === 45 || c === 48) return iconForCode(143, night)
  if (c === 51 || c === 53 || c === 55 || c === 56 || c === 57 || c === 61) return iconForCode(266, night)
  if (c === 63 || c === 65 || c === 66 || c === 67 || c === 80 || c === 81 || c === 82) return iconForCode(308, night)
  if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return iconForCode(338, night)
  if (c === 95 || c === 96 || c === 99) return iconForCode(389, night)
  return iconForCode(119, night)
}

function iconForCode(code, night) {
  var c = parseInt(String(code || "0"), 10)
  switch (c) {
    case 113: return night ? "" : ""
    case 116: return night ? "" : ""
    case 119: case 122: return ""
    case 143: case 248: case 260: return night ? "\ue346" : "\ue313"
    case 176: case 263: case 353: return night ? "" : ""
    case 179: case 227: case 230: case 323: case 326: case 368: return night ? "" : ""
    case 182: case 185: case 281: case 284: case 311: case 314:
    case 317: case 320: case 350: case 362: case 365: case 374: case 377: return ""
    case 200: case 386: case 389: case 392: case 395: return ""
    case 266: case 293: case 296: case 299: case 302: case 305: case 308: case 356: case 359: return ""
    case 329: case 332: case 335: case 338: case 371: return ""
    default: return ""
  }
}

// Strings come from the plugin catalog (i18n/*.json) through the panel's
// tr(key, fallback), passed in as `tr`. Without one the English fallback is
// used.
function translate(tr, key, fallback) {
  var value = typeof tr === "function" ? tr(key, fallback) : fallback;
  return (typeof value === "string" && value !== "" && value !== key) ? value : fallback;
}

function nowLabel(tr) {
  return translate(tr, "weather.now", "Now");
}

function formatHour(timeStr, lang) {
  var hourNum = parseInt(String(timeStr || "").slice(11, 13), 10);
  if (isNaN(hourNum)) return String(timeStr || "").slice(11, 16);

  var l = String(lang || "en").toLowerCase();
  if (l.indexOf("en") === 0) {
    var ampm = hourNum >= 12 ? "PM" : "AM";
    var h = hourNum % 12 || 12;
    return h + " " + ampm;
  }
  if (l.indexOf("pt") === 0) {
    return hourNum + "h";
  }
  return (hourNum < 10 ? "0" + hourNum : hourNum) + ":00";
}

function openMeteoHourlyForecast(dailyForecastReport, maxCount, language, tr) {
  var hourly = dailyForecastReport && dailyForecastReport.hourly ? dailyForecastReport.hourly : null;
  if (!hourly || !hourly.time || hourly.time.length === 0) return [];

  var countLimit = maxCount || 24;
  var currentHour = (dailyForecastReport.current && dailyForecastReport.current.time ? String(dailyForecastReport.current.time).slice(0, 13) : "") || new Date().toISOString().slice(0, 13);
  var result = [];
  var foundCurrent = false;
  var lang = language || "en";
  var labelNow = nowLabel(tr);

  for (var i = 0; i < hourly.time.length && result.length < countLimit; ++i) {
    var t = String(hourly.time[i] || "");
    var hourPrefix = t.slice(0, 13);
    if (!foundCurrent && hourPrefix < currentHour) continue;

    var isNow = !foundCurrent;
    foundCurrent = true;

    var tempC = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
    var prob = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    var precip = hourly.precipitation ? hourly.precipitation[i] : 0;
    var code = hourly.weather_code ? hourly.weather_code[i] : null;
    var isDay = hourly.is_day ? (hourly.is_day[i] === 1 || hourly.is_day[i] === true) : true;

    var hourLabel = isNow ? labelNow : formatHour(t, lang);

    result.push({
      time: t,
      hourLabel: hourLabel,
      isNow: isNow,
      tempC: roundedTemp(tempC),
      tempF: roundedTemp(celsiusToFahrenheit(tempC)),
      precipitationProbability: Math.round(Number(prob) || 0),
      precipitationMm: (Number(precip) || 0).toFixed(1),
      weatherCode: code,
      isDay: isDay,
      icon: iconForOpenMeteoCode(code, !isDay)
    });
  }

  if (result.length === 0) {
    for (var j = 0; j < hourly.time.length && j < countLimit; ++j) {
      var tFallback = String(hourly.time[j] || "");
      var tempCF = hourly.temperature_2m ? hourly.temperature_2m[j] : null;
      var probF = hourly.precipitation_probability ? hourly.precipitation_probability[j] : 0;
      var precipF = hourly.precipitation ? hourly.precipitation[j] : 0;
      var codeF = hourly.weather_code ? hourly.weather_code[j] : null;
      var isDayF = hourly.is_day ? (hourly.is_day[j] === 1 || hourly.is_day[j] === true) : true;

      result.push({
        time: tFallback,
        hourLabel: j === 0 ? labelNow : formatHour(tFallback, lang),
        isNow: j === 0,
        tempC: roundedTemp(tempCF),
        tempF: roundedTemp(celsiusToFahrenheit(tempCF)),
        precipitationProbability: Math.round(Number(probF) || 0),
        precipitationMm: (Number(precipF) || 0).toFixed(1),
        weatherCode: codeF,
        isDay: isDayF,
        icon: iconForOpenMeteoCode(codeF, !isDayF)
      });
    }
  }

  return result;
}

function formatPrecipitation(mm, useImperial) {
  var v = parseFloat(String(mm || "0"));
  if (isNaN(v) || v <= 0) return "";
  if (useImperial) {
    var inches = v * 0.0393701;
    return inches >= 0.01 ? inches.toFixed(2) + " in" : "";
  }
  return v >= 0.1 ? v.toFixed(1) + " mm" : "";
}

function extractTodayHighLow(report, dailyForecastReport, useImperial) {
  var maxVal = null;
  var minVal = null;

  if (dailyForecastReport && dailyForecastReport.daily) {
    var daily = dailyForecastReport.daily;
    if (daily.temperature_2m_max && daily.temperature_2m_max.length > 0 && daily.temperature_2m_max[0] !== null && daily.temperature_2m_max[0] !== undefined) {
      var rawMax = daily.temperature_2m_max[0];
      maxVal = useImperial ? roundedTemp(celsiusToFahrenheit(rawMax)) : roundedTemp(rawMax);
    }
    if (daily.temperature_2m_min && daily.temperature_2m_min.length > 0 && daily.temperature_2m_min[0] !== null && daily.temperature_2m_min[0] !== undefined) {
      var rawMin = daily.temperature_2m_min[0];
      minVal = useImperial ? roundedTemp(celsiusToFahrenheit(rawMin)) : roundedTemp(rawMin);
    }
  }

  if ((maxVal === null || minVal === null) && report && report.weather && report.weather.length > 0) {
    var todayWeather = report.weather[0];
    if (maxVal === null && todayWeather.maxtempC !== undefined) {
      maxVal = roundedTemp(useImperial ? todayWeather.maxtempF : todayWeather.maxtempC);
    }
    if (minVal === null && todayWeather.mintempC !== undefined) {
      minVal = roundedTemp(useImperial ? todayWeather.mintempF : todayWeather.mintempC);
    }
  }

  return {
    max: maxVal !== null ? maxVal : "",
    min: minVal !== null ? minVal : ""
  };
}

function formatSunTime(rawStr, useImperial) {
  if (!rawStr) return "";
  var s = String(rawStr).trim();
  if (s.indexOf("T") !== -1) {
    var timePart = s.slice(11, 16);
    var parts = timePart.split(":");
    var hour = parseInt(parts[0], 10);
    var min = parts[1] || "00";
    if (isNaN(hour)) return timePart;
    if (useImperial) {
      var ampm = hour >= 12 ? "PM" : "AM";
      var h = hour % 12 || 12;
      return h + ":" + min + " " + ampm;
    }
    return (hour < 10 ? "0" + hour : String(hour)) + ":" + min;
  }
  var match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    var rawHour = parseInt(match[1], 10);
    var rawMin = match[2];
    var ampmPart = match[3] ? match[3].toUpperCase() : "";
    if (useImperial) {
      var hImp = rawHour % 12 || 12;
      var ampmImp = ampmPart || (rawHour >= 12 ? "PM" : "AM");
      return hImp + ":" + rawMin + " " + ampmImp;
    } else {
      var h24 = rawHour;
      if (ampmPart === "PM" && rawHour < 12) h24 += 12;
      if (ampmPart === "AM" && rawHour === 12) h24 = 0;
      return (h24 < 10 ? "0" + h24 : String(h24)) + ":" + rawMin;
    }
  }
  return s;
}

function extractSunTimes(report, dailyForecastReport, useImperial) {
  var sunrise = "";
  var sunset = "";

  if (dailyForecastReport && dailyForecastReport.daily) {
    var daily = dailyForecastReport.daily;
    if (daily.sunrise && daily.sunrise.length > 0 && daily.sunrise[0]) {
      sunrise = formatSunTime(daily.sunrise[0], useImperial);
    }
    if (daily.sunset && daily.sunset.length > 0 && daily.sunset[0]) {
      sunset = formatSunTime(daily.sunset[0], useImperial);
    }
  }

  if ((!sunrise || !sunset) && report && report.weather && report.weather.length > 0) {
    var w = report.weather[0];
    if (w.astronomy && w.astronomy.length > 0) {
      var astro = w.astronomy[0];
      if (!sunrise && astro.sunrise) sunrise = formatSunTime(astro.sunrise, useImperial);
      if (!sunset && astro.sunset) sunset = formatSunTime(astro.sunset, useImperial);
    }
  }

  return { sunrise: sunrise, sunset: sunset };
}

function extractUvIndex(report, dailyForecastReport) {
  var uv = null;
  if (dailyForecastReport && dailyForecastReport.current && dailyForecastReport.current.uv_index !== undefined && dailyForecastReport.current.uv_index !== null) {
    uv = dailyForecastReport.current.uv_index;
  } else if (dailyForecastReport && dailyForecastReport.daily && dailyForecastReport.daily.uv_index_max && dailyForecastReport.daily.uv_index_max.length > 0 && dailyForecastReport.daily.uv_index_max[0] !== null && dailyForecastReport.daily.uv_index_max[0] !== undefined) {
    uv = dailyForecastReport.daily.uv_index_max[0];
  } else if (report && report.current_condition && report.current_condition[0] && report.current_condition[0].uvIndex !== undefined) {
    uv = report.current_condition[0].uvIndex;
  }

  if (uv === null || uv === undefined || uv === "") return "";
  var n = parseFloat(String(uv));
  if (isNaN(n)) return "";
  return (n % 1 === 0) ? String(Math.round(n)) : n.toFixed(1);
}

function computeRainSummary(hourlyList, tr, useImperial) {
  if (!hourlyList || !hourlyList.length) {
    return { text: "", hasRain: false, icon: "󰖌" };
  }

  var current = hourlyList[0];
  var currentProb = Number(current.precipitationProbability) || 0;
  var currentMm = parseFloat(String(current.precipitationMm || "0"));
  var currentCode = current.weatherCode !== null && current.weatherCode !== undefined ? Number(current.weatherCode) : 0;
  var isCurrentRaining = currentProb >= 50 || currentMm >= 0.2 || (currentCode >= 51 && currentCode <= 67) || (currentCode >= 80 && currentCode <= 82) || (currentCode >= 95 && currentCode <= 99);

  if (isCurrentRaining) {
    var precipStr = formatPrecipitation(currentMm, useImperial);
    var detail = currentProb > 0 ? (precipStr ? "(" + currentProb + "% · ~" + precipStr + ")" : "(" + currentProb + "%)") : "";
    var title = translate(tr, "weather.rainNow", "Rain right now");
    return {
      text: detail ? title + " " + detail : title,
      hasRain: true,
      icon: "󰖌"
    };
  }

  for (var i = 1; i < hourlyList.length; i++) {
    var h = hourlyList[i];
    var prob = Number(h.precipitationProbability) || 0;
    var mm = parseFloat(String(h.precipitationMm || "0"));
    var code = h.weatherCode !== null && h.weatherCode !== undefined ? Number(h.weatherCode) : 0;
    var isRain = prob >= 35 || mm >= 0.2 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);

    if (isRain) {
      var pStr = formatPrecipitation(mm, useImperial);
      var pDetail = prob > 0 ? (pStr ? "(" + prob + "% · ~" + pStr + ")" : "(" + prob + "%)") : "";
      // Some languages word "around 1 o'clock" differently ("por volta da 1h").
      var around = translate(tr, "weather.rainAround", "Rain expected around %1");
      if (parseInt(String(h.time || "").slice(11, 13), 10) === 1)
        around = translate(tr, "weather.rainAroundOne", around);
      var prefix = around.replace("%1", String(h.hourLabel || ""));
      return {
        text: pDetail ? prefix + " " + pDetail : prefix,
        hasRain: true,
        icon: "󰖌"
      };
    }
  }

  return {
    text: translate(tr, "weather.noRainToday", "No rain expected today"),
    hasRain: false,
    icon: "󰖙"
  };
}

function checkImminentRain(hourlyList) {
  if (!hourlyList || !hourlyList.length) return false;
  var limit = Math.min(3, hourlyList.length);
  for (var i = 0; i < limit; i++) {
    var h = hourlyList[i];
    if (!h) continue;
    var prob = Number(h.precipitationProbability) || 0;
    var mm = parseFloat(String(h.precipitationMm || "0"));
    var code = h.weatherCode !== null && h.weatherCode !== undefined ? Number(h.weatherCode) : 0;
    var isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
    if (prob >= 60 && (mm > 0 || isRainCode)) {
      return true;
    }
  }
  return false;
}

// RainViewer's live map, centred on the place when its coordinates are known.
function radarUrl(latitude, longitude) {
  var base = "https://www.rainviewer.com/weather-radar-map-live.html";
  var lat = parseFloat(String(latitude));
  var lon = parseFloat(String(longitude));
  if (latitude === null || longitude === null || isNaN(lat) || isNaN(lon)) return base;
  return base + "?loc=" + encodeURIComponent(String(latitude)) + "," + encodeURIComponent(String(longitude)) + ",8";
}

if (typeof module !== "undefined") {
  module.exports = {
    parseLocationFile: parseLocationFile,
    isAutoLocation: isAutoLocation,
    effectiveLocation: effectiveLocation,
    wttrLocationQuery: wttrLocationQuery,
    parseGeocodingResults: parseGeocodingResults,
    locationCommit: locationCommit,
    isFutureForecastDate: isFutureForecastDate,
    roundedTemp: roundedTemp,
    celsiusToFahrenheit: celsiusToFahrenheit,
    formatTemp: formatTemp,
    normalizedUnit: normalizedUnit,
    localeUsesImperial: localeUsesImperial,
    countryUsesImperial: countryUsesImperial,
    shouldUseImperial: shouldUseImperial,
    dayName: dayName,
    openMeteoForecastDays: openMeteoForecastDays,
    openMeteoCurrentCondition: openMeteoCurrentCondition,
    currentIcon: currentIcon,
    provisionalCurrentIcon: provisionalCurrentIcon,
    weatherResponseCompletesSave: weatherResponseCompletesSave,
    wttrNextForecastDays: wttrNextForecastDays,
    buildForecastDays: buildForecastDays,
    bareTempForDay: bareTempForDay,
    dayIcon: dayIcon,
    iconForOpenMeteoCode: iconForOpenMeteoCode,
    iconForCode: iconForCode,
    openMeteoHourlyForecast: openMeteoHourlyForecast,
    nowLabel: nowLabel,
    formatHour: formatHour,
    translate: translate,
    formatPrecipitation: formatPrecipitation,
    extractTodayHighLow: extractTodayHighLow,
    formatSunTime: formatSunTime,
    extractSunTimes: extractSunTimes,
    extractUvIndex: extractUvIndex,
    computeRainSummary: computeRainSummary,
    checkImminentRain: checkImminentRain,
    radarUrl: radarUrl
  }
}
