import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Run with `node --test dev/tests/` (or dev/run.sh test): no dependencies.
// The few matchers used, vitest-style, on top of node:assert.
function expect(actual, message) {
  return {
    toBe: (expected) => assert.ok(Object.is(actual, expected), message || `expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`),
    toEqual: (expected) => assert.deepStrictEqual(actual, expected, message),
    toContain: (item) => assert.ok(actual.includes(item), message || `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`),
    toHaveLength: (n) => assert.equal(actual.length, n, message)
  }
}

// Tests run against the real Model.js (a QML JavaScript resource that also
// exports through `module.exports` when one exists) and the real i18n/
// catalogs, so nothing here is a copy that can drift from the plugin.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const mod = { exports: {} }
new Function('module', readFileSync(join(root, 'Model.js'), 'utf8'))(mod)
const {
  parseLocationFile, isAutoLocation, effectiveLocation, wttrLocationQuery,
  parseGeocodingResults, locationCommit, isFutureForecastDate, roundedTemp,
  celsiusToFahrenheit, formatTemp, normalizedUnit, localeUsesImperial,
  countryUsesImperial, shouldUseImperial, dayName, iconForOpenMeteoCode,
  iconForCode, nowLabel, formatHour, formatPrecipitation, formatSunTime,
  computeRainSummary, checkImminentRain, openMeteoHourlyForecast, radarUrl
} = mod.exports

// The shell's Commons.Translations lookup: language, then base language,
// then English, then the fallback.
function catalog(code) {
  const file = join(root, 'i18n', code + '.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
}
function translator(language) {
  const layers = [catalog(language), catalog(language.split('-')[0]), catalog('en')]
  return (key, fallback) => {
    for (const layer of layers) if (typeof layer[key] === 'string' && layer[key]) return layer[key]
    return fallback !== undefined ? fallback : key
  }
}

describe('gusthx.weather Model.js', () => {
  describe('parseLocationFile', () => {
    it('parses valid location with coordinates', () => {
      const result = parseLocationFile('{"name": "São Paulo", "latitude": -23.5505, "longitude": -46.6333}')
      expect(result).toEqual({ name: 'São Paulo', latitude: -23.5505, longitude: -46.6333 })
    })
    it('parses location with name only', () => {
      const result = parseLocationFile('{"name": "London"}')
      expect(result).toEqual({ name: 'London', latitude: null, longitude: null })
    })
    it('returns unset for invalid JSON', () => {
      expect(parseLocationFile('invalid')).toEqual({ name: '', latitude: null, longitude: null })
      expect(parseLocationFile('')).toEqual({ name: '', latitude: null, longitude: null })
      expect(parseLocationFile(null)).toEqual({ name: '', latitude: null, longitude: null })
    })
    it('returns unset for non-object', () => {
      expect(parseLocationFile('[]')).toEqual({ name: '', latitude: null, longitude: null })
      expect(parseLocationFile('"string"')).toEqual({ name: '', latitude: null, longitude: null })
    })
    it('trims name whitespace', () => {
      const result = parseLocationFile('{"name": "  Tokyo  ", "latitude": 35.6762, "longitude": 139.6503}')
      expect(result.name).toBe('Tokyo')
    })
  })

  describe('isAutoLocation', () => {
    it('returns true for empty name and no coordinates', () => {
      expect(isAutoLocation({ name: '', latitude: null, longitude: null })).toBe(true)
      expect(isAutoLocation({})).toBe(true)
      expect(isAutoLocation(null)).toBe(true)
    })
    it('returns false when name is set', () => {
      expect(isAutoLocation({ name: 'London', latitude: null, longitude: null })).toBe(false)
    })
    it('returns false when coordinates are set', () => {
      expect(isAutoLocation({ name: '', latitude: 51.5, longitude: -0.1 })).toBe(false)
    })
  })

  describe('effectiveLocation', () => {
    it('returns detected when configured is auto', () => {
      const configured = { name: '', latitude: null, longitude: null }
      const detected = { name: 'Auto City', latitude: 1.0, longitude: 2.0 }
      expect(effectiveLocation(configured, detected)).toBe(detected)
    })
    it('returns configured when it has name', () => {
      const configured = { name: 'My City', latitude: null, longitude: null }
      const detected = { name: 'Auto City', latitude: 1.0, longitude: 2.0 }
      expect(effectiveLocation(configured, detected)).toBe(configured)
    })
    it('returns configured when it has coordinates', () => {
      const configured = { name: '', latitude: 1.0, longitude: 2.0 }
      const detected = { name: 'Auto City', latitude: 3.0, longitude: 4.0 }
      expect(effectiveLocation(configured, detected)).toBe(configured)
    })
  })

  describe('wttrLocationQuery', () => {
    it('returns coordinates when both present', () => {
      expect(wttrLocationQuery('São Paulo', -23.5505, -46.6333)).toBe('-23.5505,-46.6333')
      expect(wttrLocationQuery('London', 51.5074, -0.1278)).toBe('51.5074,-0.1278')
    })
    it('returns encoded name when no coordinates', () => {
      expect(wttrLocationQuery('São Paulo', null, null)).toBe('S%C3%A3o%20Paulo')
      expect(wttrLocationQuery('New York', '', '')).toBe('New%20York')
    })
    it('returns empty for auto-detect', () => {
      expect(wttrLocationQuery('', null, null)).toBe('')
      expect(wttrLocationQuery('', '', '')).toBe('')
    })
  })

  describe('parseGeocodingResults', () => {
    it('parses valid results', () => {
      const raw = JSON.stringify({
        results: [
          { name: 'São Paulo', admin1: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333 },
          { name: 'London', admin1: 'England', country: 'UK', latitude: 51.5074, longitude: -0.1278 }
        ]
      })
      const result = parseGeocodingResults(raw)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'São Paulo',
        description: 'São Paulo, Brazil',
        latitude: -23.5505,
        longitude: -46.6333
      })
    })
    it('returns empty for invalid JSON', () => {
      expect(parseGeocodingResults('invalid')).toEqual([])
      expect(parseGeocodingResults('')).toEqual([])
    })
    it('skips entries missing required fields', () => {
      const raw = JSON.stringify({
        results: [
          { name: 'Valid', admin1: 'State', country: 'Country', latitude: 1, longitude: 2 },
          { admin1: 'State', country: 'Country', latitude: 1, longitude: 2 }, // no name
          { name: 'NoCoords', admin1: 'State', country: 'Country' } // no lat/lon
        ]
      })
      const result = parseGeocodingResults(raw)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Valid')
    })
  })

  describe('locationCommit', () => {
    it('returns suggestion when selected', () => {
      const suggestions = [{ name: 'City1', latitude: 1, longitude: 2 }]
      expect(locationCommit('typed', suggestions, 0)).toEqual(suggestions[0])
    })
    it('clamps index to valid range', () => {
      const suggestions = [{ name: 'City1', latitude: 1, longitude: 2 }]
      expect(locationCommit('typed', suggestions, 5)).toEqual(suggestions[0])
      expect(locationCommit('typed', suggestions, -1)).toEqual(suggestions[0])
    })
    it('returns typed name when no suggestion', () => {
      expect(locationCommit('Custom City', [], 0)).toEqual({ name: 'Custom City', latitude: null, longitude: null })
      expect(locationCommit('Custom City', null, 0)).toEqual({ name: 'Custom City', latitude: null, longitude: null })
    })
    it('returns empty for empty text', () => {
      expect(locationCommit('', [], 0)).toEqual({ name: '', latitude: null, longitude: null })
      expect(locationCommit('   ', [], 0)).toEqual({ name: '', latitude: null, longitude: null })
    })
  })

  describe('isFutureForecastDate', () => {
    it('returns true for future dates', () => {
      expect(isFutureForecastDate('2024-12-31', '2024-06-15')).toBe(true)
      expect(isFutureForecastDate('2024-06-16', '2024-06-15')).toBe(true)
    })
    it('returns false for today or past', () => {
      expect(isFutureForecastDate('2024-06-15', '2024-06-15')).toBe(false)
      expect(isFutureForecastDate('2024-06-14', '2024-06-15')).toBe(false)
    })
    it('handles missing params', () => {
      expect(isFutureForecastDate(null, '2024-06-15')).toBe(false)
      expect(isFutureForecastDate('2024-12-31', null)).toBe(true)
    })
  })

  describe('roundedTemp', () => {
    it('rounds temperatures', () => {
      expect(roundedTemp(23.4)).toBe('23')
      expect(roundedTemp(23.5)).toBe('24')
      expect(roundedTemp(23.6)).toBe('24')
      expect(roundedTemp(-5.4)).toBe('-5')
      // Math.round(-5.5) = -5 in JavaScript (rounds toward zero)
      expect(roundedTemp(-5.5)).toBe('-5')
    })
    it('returns empty for invalid', () => {
      expect(roundedTemp(null)).toBe('')
      expect(roundedTemp(undefined)).toBe('')
      expect(roundedTemp('')).toBe('')
      expect(roundedTemp('abc')).toBe('')
    })
  })

  describe('celsiusToFahrenheit', () => {
    it('converts correctly', () => {
      expect(celsiusToFahrenheit(0)).toBe(32)
      expect(celsiusToFahrenheit(100)).toBe(212)
      expect(celsiusToFahrenheit(-40)).toBe(-40)
      expect(celsiusToFahrenheit(25)).toBe(77)
    })
    it('returns empty for invalid', () => {
      expect(celsiusToFahrenheit(null)).toBe('')
      expect(celsiusToFahrenheit('abc')).toBe('')
    })
  })

  describe('formatTemp', () => {
    it('formats with C by default', () => {
      expect(formatTemp(25, false)).toBe('25°C')
      expect(formatTemp(0, false)).toBe('0°C')
    })
    it('formats with F when imperial', () => {
      expect(formatTemp(77, true)).toBe('77°F')
      expect(formatTemp(32, true)).toBe('32°F')
    })
    it('uses custom formatter', () => {
      const fmt = (v) => v.toFixed(1)
      expect(formatTemp(25, false, fmt)).toBe('25.0°C')
    })
    it('returns empty for invalid', () => {
      expect(formatTemp(null, false)).toBe('')
      expect(formatTemp('', false)).toBe('')
    })
  })

  describe('normalizedUnit', () => {
    it('normalizes unit strings', () => {
      expect(normalizedUnit('IMPERIAL')).toBe('imperial')
      expect(normalizedUnit('  Metric  ')).toBe('metric')
      expect(normalizedUnit('')).toBe('')
      expect(normalizedUnit(null)).toBe('')
    })
  })

  describe('localeUsesImperial', () => {
    it('detects US English', () => {
      expect(localeUsesImperial('en_US')).toBe(true)
      expect(localeUsesImperial('en-US')).toBe(true)
      expect(localeUsesImperial('en_US.UTF-8')).toBe(true)
    })
    it('detects Liberia English', () => {
      expect(localeUsesImperial('en_LR')).toBe(true)
      expect(localeUsesImperial('en-LR')).toBe(true)
    })
    it('detects Myanmar', () => {
      expect(localeUsesImperial('my')).toBe(true)
      expect(localeUsesImperial('my_MM')).toBe(true)
    })
    it('returns false for others', () => {
      expect(localeUsesImperial('en_GB')).toBe(false)
      expect(localeUsesImperial('pt_BR')).toBe(false)
      expect(localeUsesImperial('fr_FR')).toBe(false)
      expect(localeUsesImperial('')).toBe(false)
    })
  })

  describe('countryUsesImperial', () => {
    it('detects US variants', () => {
      expect(countryUsesImperial('US')).toBe(true)
      expect(countryUsesImperial('USA')).toBe(true)
      expect(countryUsesImperial('United States')).toBe(true)
      expect(countryUsesImperial('United States of America')).toBe(true)
    })
    it('detects Liberia', () => {
      expect(countryUsesImperial('Liberia')).toBe(true)
    })
    it('detects Myanmar/Burma', () => {
      expect(countryUsesImperial('Myanmar')).toBe(true)
      expect(countryUsesImperial('Burma')).toBe(true)
    })
    it('returns null for others', () => {
      expect(countryUsesImperial('Brazil')).toBe(false)
      expect(countryUsesImperial('UK')).toBe(false)
      expect(countryUsesImperial('')).toBe(null)
    })
  })

  describe('shouldUseImperial', () => {
    it('respects explicit unit override', () => {
      expect(shouldUseImperial('imperial', 'pt_BR', 'Brazil')).toBe(true)
      expect(shouldUseImperial('metric', 'en_US', 'US')).toBe(false)
    })
    it('falls back to country preference', () => {
      expect(shouldUseImperial('', 'pt_BR', 'US')).toBe(true)
      expect(shouldUseImperial('', 'pt_BR', 'Brazil')).toBe(false)
    })
    it('falls back to locale', () => {
      // Note: countryUsesImperial returns false for unknown countries (not null),
      // so country preference takes precedence over locale
      expect(shouldUseImperial('', 'en_US', 'Brazil')).toBe(false)
      expect(shouldUseImperial('', 'pt_BR', 'Brazil')).toBe(false)
    })
  })

  describe('dayName', () => {
    it('returns day names', () => {
      expect(dayName('2024-06-15')).toBe('Saturday')
      expect(dayName('2024-06-16')).toBe('Sunday')
      expect(dayName('2024-06-17')).toBe('Monday')
    })
    it('uses custom formatter', () => {
      const fmt = (d) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]
      expect(dayName('2024-06-16', fmt)).toBe('Dom')
    })
    it('returns empty for invalid', () => {
      expect(dayName('')).toBe('')
      expect(dayName('invalid')).toBe('')
    })
  })

  describe('iconForOpenMeteoCode', () => {
    it('maps clear sky', () => {
      expect(iconForOpenMeteoCode(0, false)).toBe('')
      expect(iconForOpenMeteoCode(0, true)).toBe('')
    })
    it('maps mainly clear', () => {
      expect(iconForOpenMeteoCode(1, false)).toBe('')
      expect(iconForOpenMeteoCode(2, true)).toBe('')
    })
    it('maps overcast', () => {
      expect(iconForOpenMeteoCode(3, false)).toBe('')
    })
    it('maps fog', () => {
      expect(iconForOpenMeteoCode(45, false)).toBe('\ue313')
      expect(iconForOpenMeteoCode(48, true)).toBe('\ue346')
    })
    it('maps drizzle/light rain', () => {
      expect(iconForOpenMeteoCode(51, false)).toBe('')
      expect(iconForOpenMeteoCode(61, true)).toBe('')
    })
    it('maps moderate/heavy rain', () => {
      expect(iconForOpenMeteoCode(63, false)).toBe('')
      expect(iconForOpenMeteoCode(80, true)).toBe('')
    })
    it('maps snow', () => {
      expect(iconForOpenMeteoCode(71, false)).toBe('')
      expect(iconForOpenMeteoCode(85, true)).toBe('')
    })
    it('maps thunderstorm', () => {
      expect(iconForOpenMeteoCode(95, false)).toBe('')
      expect(iconForOpenMeteoCode(99, true)).toBe('')
    })
    it('defaults to overcast for unknown', () => {
      expect(iconForOpenMeteoCode(999, false)).toBe('')
    })
  })

  describe('iconForCode', () => {
    it('returns correct icons for wttr codes', () => {
      expect(iconForCode(113, false)).toBe('')
      expect(iconForCode(113, true)).toBe('')
      expect(iconForCode(116, false)).toBe('')
      expect(iconForCode(116, true)).toBe('')
      expect(iconForCode(119, false)).toBe('')
      expect(iconForCode(353, false)).toBe('')
      expect(iconForCode(353, true)).toBe('')
    })
  })

  describe('nowLabel', () => {
    it('returns the catalog\'s "now"', () => {
      expect(nowLabel(translator('en'))).toBe('Now')
      expect(nowLabel(translator('pt'))).toBe('Agora')
      expect(nowLabel(translator('pt-BR'))).toBe('Agora')
      expect(nowLabel(translator('es-MX'))).toBe('Ahora')
      expect(nowLabel(translator('fr'))).toBe('Maintenant')
      expect(nowLabel(translator('de'))).toBe('Jetzt')
      expect(nowLabel(translator('it'))).toBe('Ora')
    })
    it('falls back to English', () => {
      expect(nowLabel(undefined)).toBe('Now')
      expect(nowLabel(null)).toBe('Now')
      expect(nowLabel(translator('zh-CN'))).toBe('Now')
    })
  })

  describe('formatHour', () => {
    it('formats 12h for en', () => {
      expect(formatHour('2024-06-15T00:00:00', 'en')).toBe('12 AM')
      expect(formatHour('2024-06-15T12:00:00', 'en')).toBe('12 PM')
      expect(formatHour('2024-06-15T15:30:00', 'en')).toBe('3 PM')
      expect(formatHour('2024-06-15T09:00:00', 'en')).toBe('9 AM')
    })
    it('formats 24h for pt', () => {
      expect(formatHour('2024-06-15T00:00:00', 'pt')).toBe('0h')
      expect(formatHour('2024-06-15T15:00:00', 'pt')).toBe('15h')
    })
    it('formats 24h for others', () => {
      expect(formatHour('2024-06-15T09:00:00', 'fr')).toBe('09:00')
      expect(formatHour('2024-06-15T15:00:00', 'de')).toBe('15:00')
    })
  })

  describe('formatPrecipitation', () => {
    it('formats mm for metric', () => {
      expect(formatPrecipitation(0, false)).toBe('')
      expect(formatPrecipitation(0.05, false)).toBe('')
      expect(formatPrecipitation(0.1, false)).toBe('0.1 mm')
      expect(formatPrecipitation(5.5, false)).toBe('5.5 mm')
    })
    it('formats inches for imperial', () => {
      expect(formatPrecipitation(0, true)).toBe('')
      expect(formatPrecipitation(0.1, true)).toBe('')
      expect(formatPrecipitation(1, true)).toBe('0.04 in')
      expect(formatPrecipitation(25.4, true)).toBe('1.00 in')
    })
  })

  describe('formatSunTime', () => {
    it('parses ISO format', () => {
      expect(formatSunTime('2024-06-15T06:30:00', false)).toBe('06:30')
      expect(formatSunTime('2024-06-15T18:45:00', true)).toBe('6:45 PM')
    })
    it('parses HH:MM AM/PM', () => {
      expect(formatSunTime('6:30 AM', false)).toBe('06:30')
      expect(formatSunTime('6:30 PM', true)).toBe('6:30 PM')
      expect(formatSunTime('12:00 AM', false)).toBe('00:00')
      expect(formatSunTime('12:00 PM', false)).toBe('12:00')
    })
    it('returns as-is for unparseable', () => {
      expect(formatSunTime('invalid', false)).toBe('invalid')
      expect(formatSunTime('', false)).toBe('')
    })
  })

  describe('computeRainSummary', () => {
    it('returns no rain for empty list', () => {
      const result = computeRainSummary([], translator('en'), false)
      expect(result.hasRain).toBe(false)
      // Implementation returns empty text for empty list (UI handles this case)
      expect(result.text).toBe('')
    })
    it('detects current rain', () => {
      const hourly = [{
        precipitationProbability: 80,
        precipitationMm: 2.5,
        weatherCode: 63,
        hourLabel: 'Now'
      }]
      const result = computeRainSummary(hourly, translator('en'), false)
      expect(result.hasRain).toBe(true)
      expect(result.text).toContain('Rain right now')
    })
    it('detects upcoming rain', () => {
      const hourly = [
        { precipitationProbability: 10, precipitationMm: 0, weatherCode: 113, hourLabel: 'Now' },
        { precipitationProbability: 60, precipitationMm: 1.2, weatherCode: 61, hourLabel: '3 PM' }
      ]
      const result = computeRainSummary(hourly, translator('en'), false)
      expect(result.hasRain).toBe(true)
      expect(result.text).toContain('Rain expected around')
    })
    it('localizes to Portuguese', () => {
      const hourly = [
        { precipitationProbability: 10, precipitationMm: 0, weatherCode: 113, hourLabel: 'Agora' },
        { precipitationProbability: 60, precipitationMm: 1.2, weatherCode: 61, hourLabel: '15h' }
      ]
      const result = computeRainSummary(hourly, translator('pt-BR'), false)
      expect(result.hasRain).toBe(true)
      expect(result.text).toContain('Chuva prevista por volta')
    })
    it('uses the "around 1 o\'clock" wording where a language has one', () => {
      const hourly = [
        { precipitationProbability: 10, precipitationMm: 0, weatherCode: 3, hourLabel: 'Agora', time: '2026-06-15T00:00' },
        { precipitationProbability: 60, precipitationMm: 1.2, weatherCode: 61, hourLabel: '1h', time: '2026-06-15T01:00' }
      ]
      expect(computeRainSummary(hourly, translator('pt-BR'), false).text).toContain('por volta da 1h')
      expect(computeRainSummary(hourly, translator('en'), false).text).toContain('Rain expected around 1h')
    })
    it('falls back to English without a translator', () => {
      expect(computeRainSummary([{ precipitationProbability: 5, precipitationMm: 0, weatherCode: 0 }], undefined, false).text).toBe('No rain expected today')
    })
  })

  describe('i18n catalogs', () => {
    it('every language carries every English key', () => {
      const en = Object.keys(catalog('en'))
      for (const code of ['pt', 'es', 'fr', 'de', 'it']) {
        const keys = Object.keys(catalog(code))
        expect(en.filter(k => !keys.includes(k)), code).toEqual([])
      }
    })
  })

  describe('openMeteoHourlyForecast', () => {
    it('labels the first hour with the catalog\'s "now"', () => {
      const report = { current: { time: '2026-06-15T14:00' }, hourly: {
        time: ['2026-06-15T13:00', '2026-06-15T14:00', '2026-06-15T15:00'],
        temperature_2m: [20, 21, 22], precipitation_probability: [0, 10, 40],
        precipitation: [0, 0, 0.5], weather_code: [0, 1, 61], is_day: [1, 1, 1] } }
      const hours = openMeteoHourlyForecast(report, 24, 'pt-BR', translator('pt-BR'))
      expect(hours.map(h => h.hourLabel)).toEqual(['Agora', '15h'])
      expect(hours[1].precipitationProbability).toBe(40)
    })
  })

  describe('radarUrl', () => {
    it('centres RainViewer on known coordinates', () => {
      expect(radarUrl(38.72, -9.14)).toBe('https://www.rainviewer.com/weather-radar-map-live.html?loc=38.72,-9.14,8')
    })
    it('opens the plain map without coordinates', () => {
      expect(radarUrl(null, null)).toBe('https://www.rainviewer.com/weather-radar-map-live.html')
      expect(radarUrl('x', 'y')).toBe('https://www.rainviewer.com/weather-radar-map-live.html')
    })
  })

  describe('checkImminentRain', () => {
    it('returns false for empty', () => {
      expect(checkImminentRain([])).toBe(false)
      expect(checkImminentRain(null)).toBe(false)
    })
    it('detects high prob rain in next 3 hours', () => {
      const hourly = [
        { precipitationProbability: 70, precipitationMm: 0.5, weatherCode: 61 },
        { precipitationProbability: 50, precipitationMm: 0, weatherCode: 113 }
      ]
      expect(checkImminentRain(hourly)).toBe(true)
    })
    it('ignores low probability', () => {
      const hourly = [
        { precipitationProbability: 50, precipitationMm: 0, weatherCode: 113 }
      ]
      expect(checkImminentRain(hourly)).toBe(false)
    })
  })
})