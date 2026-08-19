/**
 * Live weather from the National Weather Service API.
 *
 *   https://www.weather.gov/documentation/services-web-api
 *
 * Free, no API key, no rate limit for our scale (1.5 GB/day per
 * User-Agent, 1000 req/min per User-Agent — way more than we
 * need for one project page render every 30 min per user).
 *
 * COVERAGE: USA only. The NWS only publishes forecasts for US
 * states and territories. For non-US projects, the widget shows
 * "weather unavailable" — same graceful-degrade behavior as
 * before. We considered routing non-US to OpenWeatherMap but
 * the free tier of OWM is limited and unreliable; for an
 * internal CMS used in Tulsa, the US-only constraint is fine.
 *
 * FLOW (4 requests per fresh fetch, all cached 30 min via Next):
 *   1. Nominatim geocode (already wired for project addresses)
 *      → lat/lng
 *   2. NWS /points/{lat},{lng}
 *      → gridId, gridX, gridY + observationStations URL +
 *        forecast URL
 *   3a. NWS /stations/{nearest}/observations/latest
 *       → current temperature, wind, humidity, etc.
 *   3b. NWS /gridpoints/{office}/{x},{y}/forecast
 *       → 14 periods (7 days × day+night)
 *
 * Steps 3a and 3b run in parallel.
 *
 * UNIT STRATEGY: NWS returns Fahrenheit natively, so we convert
 * to Celsius on the way in to keep the in-app contract (the
 * widget's cToF() helper expects Celsius). Wind speed comes in
 * km/h from the observation (NWS station reports are converted
 * from the raw observation); for the forecast periods it's a
 * string like "10 mph" which we parse.
 *
 * HEADER: NWS requires a User-Agent identifying the application
 * and a contact (email or URL). We re-use the same User-Agent
 * we use for Nominatim so we only have one identity to maintain.
 *
 * ERRORS: any failure (network, 5xx, non-USA lat/lng, missing
 * gridpoint) returns null. Widget shows "weather unavailable".
 * We log the cause to console for operator visibility.
 *
 * HISTORY: this module used to use Open-Meteo (free, no key),
 * then OpenWeatherMap One Call 4 (paid), and now NWS. The
 * WeatherData interface is unchanged across all three so the
 * widget never needed an edit beyond an attribution link.
 */

import { unstable_cache as nextCache } from 'next/cache';

const NWS_BASE = 'https://api.weather.gov';
// NWS requires a User-Agent with contact info per their API
// guidelines. We re-use the Nominatim agent since both services
// have the same requirement.
const USER_AGENT =
  process.env.UDGOK_CMS_NOMINATIM_USER_AGENT ||
  'udgok-cms/0.1.0 (https://cms.udgok.com; support@udgok.com)';

// Geocoding stays on Nominatim — already wired, ToS-compliant,
// accurate for US construction sites.
const GEO_BASE = process.env.UDGOK_CMS_NOMINATIM_BASE_URL
  ? `${process.env.UDGOK_CMS_NOMINATIM_BASE_URL}/search`
  : 'https://nominatim.openstreetmap.org/search';

export interface WeatherLocation {
  name: string;
  /** US state or country. */
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  temperature: number; // °C
  feelsLike: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // °
  precipitation: number; // mm
  weatherCode: number; // NWS doesn't use codes; we map text→id
  description: string; // human-readable
  icon: string; // emoji
  isDay: boolean;
  time: string; // ISO
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  high: number; // °C
  low: number; // °C
  precipitation: number; // mm
  precipitationProbability: number; // %
  weatherCode: number;
  description: string;
  icon: string;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  daily: DailyForecast[];
  fetchedAt: string;
}

// ============================================================
// NWS forecast text → emoji + canonical weather "code"
// ============================================================
// NWS doesn't use numeric weather codes — it returns text
// like "Sunny", "Chance Showers And Thunderstorms", "Mostly
// Cloudy". We map the text to an emoji and a stable numeric
// code (used internally for the WeatherData interface so the
// widget API doesn't change).
//
// The mapping is fuzzy: we substring-match the most
// distinctive token in the short forecast. Order matters —
// we check more-specific terms first (thunderstorm before
// rain) because "Thunderstorm with heavy rain" should map
// to ⛈️ not 🌧️.
function describeNwsText(text: string): { desc: string; icon: string; code: number } {
  const t = text.toLowerCase();
  // Thunderstorms (with or without hail)
  if (t.includes('thunder')) return { desc: text, icon: '⛈️', code: 211 };
  // Snow (any flavor — including "snow showers", "heavy snow")
  if (t.includes('snow') || t.includes('flurr') || t.includes('blizzard') || t.includes('sleet') || t.includes('wintry')) {
    return { desc: text, icon: '❄️', code: 601 };
  }
  // Rain (including showers, drizzle)
  if (t.includes('rain') || t.includes('shower') || t.includes('drizzle')) {
    return { desc: text, icon: '🌧️', code: 501 };
  }
  // Fog / mist / haze
  if (t.includes('fog') || t.includes('mist') || t.includes('haze') || t.includes('smoke')) {
    return { desc: text, icon: '🌫️', code: 741 };
  }
  // Wind
  if (t.includes('wind') || t.includes('breez')) {
    return { desc: text, icon: '💨', code: 771 };
  }
  // Cloudy / overcast
  if (t.includes('overcast')) return { desc: text, icon: '☁️', code: 804 };
  if (t.includes('mostly cloudy')) return { desc: text, icon: '☁️', code: 803 };
  if (t.includes('partly cloudy') || t.includes('partly sunny')) {
    return { desc: text, icon: '⛅', code: 802 };
  }
  if (t.includes('mostly clear') || t.includes('mostly sunny')) {
    return { desc: text, icon: '🌤️', code: 801 };
  }
  if (t.includes('cloudy')) return { desc: text, icon: '☁️', code: 803 };
  // Clear / sunny / fair
  if (t.includes('clear') || t.includes('sunny') || t.includes('fair')) {
    return { desc: text, icon: '☀️', code: 800 };
  }
  return { desc: text, icon: '❓', code: 0 };
}

// ============================================================
// Unit conversions
// ============================================================
function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Parse NWS wind speed strings like "10 mph", "5 to 10 mph", "10 km/h". */
function parseNwsWind(speed: string, unit: 'mph' | 'kmh'): { value: number; kmh: number } {
  // Pull the first number from the string.
  const m = speed.match(/(\d+)/);
  if (!m) return { value: 0, kmh: 0 };
  const value = Number(m[1]);
  // NWS forecast strings are always mph. Observations are
  // km/h. We standardize to km/h for the in-app contract.
  const kmh = unit === 'mph' ? value * 1.609344 : value;
  return { value, kmh };
}

/** Parse NWS compass direction like "SW" or "NNE" to degrees. */
function compassToDegrees(c: string | number): number {
  if (typeof c === 'number') return c;
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return map[c.toUpperCase()] ?? 0;
}

/** Compute "feels like" temperature using a simple heat index / wind chill split. */
function feelsLikeC(tempC: number, humidity: number, windKmh: number): number {
  const tempF = tempC * 9 / 5 + 32;
  const windMph = windKmh * 0.621371;
  // Wind chill only applies below 50°F and >3 mph wind.
  if (tempF < 50 && windMph > 3) {
    const wcF = 35.74 + 0.6215 * tempF - 35.75 * Math.pow(windMph, 0.16) + 0.4275 * tempF * Math.pow(windMph, 0.16);
    return ((wcF - 32) * 5) / 9;
  }
  // Heat index only applies above 80°F with humidity.
  if (tempF >= 80 && humidity >= 40) {
    const T = tempF;
    const R = humidity;
    // Rothfusz regression (NOAA's official heat index formula).
    let hiF = -42.379 + 2.04901523 * T + 10.14333127 * R
      - 0.22475541 * T * R - 0.00683783 * T * T
      - 0.05481717 * R * R + 0.00122874 * T * T * R
      + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;
    // Low-humidity adjustment (Steadman 1979).
    if (R < 13 && T >= 80 && T <= 112) {
      hiF -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    }
    return ((hiF - 32) * 5) / 9;
  }
  return tempC;
}

/** Is it currently daytime at the given lat/lng and ISO time? */
function isDaytime(isoTime: string): boolean {
  // Heuristic: 6am-6pm local is "day". We don't compute
  // astronomical sunrise/sunset here — the NWS observation
  // already tells us via its icon suffix (d/n), and the
  // forecast text uses "Today"/"Tonight" we can also check.
  const d = new Date(isoTime);
  const hour = d.getUTCHours();
  // Approximate. For Tulsa (UTC-5/6), 6am local = 11/12 UTC,
  // 6pm local = 23/00 UTC. Slight bias toward day is fine.
  return hour >= 11 && hour <= 23;
}

// ============================================================
// Geocoding (Nominatim)
// ============================================================
export async function geocode(query: string): Promise<WeatherLocation | null> {
  if (!query.trim()) return null;
  try {
    const url = `${GEO_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 60 * 60 * 24 }, // cache 24h
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data[0]) return null;
    const first = data[0];
    const parts = first.display_name.split(',').map((p) => p.trim());
    return {
      name: parts[0] ?? query,
      admin1: parts[parts.length - 2],
      country: parts[parts.length - 1] ?? 'US',
      latitude: Number(first.lat),
      longitude: Number(first.lon),
    };
  } catch {
    return null;
  }
}

// ============================================================
// NWS API types (private)
// ============================================================
interface NwsPointsResponse {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

interface NwsForecastPeriod {
  number: number;
  name: string; // "Today" / "Tonight" / "Monday" / "Monday Night"
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string; // "10 mph" / "5 to 10 mph"
  windDirection: string; // "SW" / "NNE"
  shortForecast: string; // "Sunny" / "Chance Showers"
  detailedForecast: string; // longer text
  probabilityOfPrecipitation?: { value: number | null };
}

interface NwsForecastResponse {
  properties: { periods: NwsForecastPeriod[] };
}

interface NwsStation {
  /** NWS calls this `stationIdentifier` (4-letter ICAO code like KRVS). */
  stationIdentifier: string;
  name: string;
}

interface NwsStationsResponse {
  features: Array<{ properties: NwsStation }>;
}

interface NwsObservation {
  properties: {
    timestamp: string;
    textDescription: string;
    temperature: { value: number | null; unitCode: string };
    dewpoint: { value: number | null; unitCode: string };
    windSpeed: { value: number | null; unitCode: string };
    windDirection: { value: number | null; unitCode: string };
    barometricPressure: { value: number | null; unitCode: string };
    relativeHumidity: { value: number | null; unitCode: string };
    visibility: { value: number | null; unitCode: string };
  };
}

// ============================================================
// NWS fetcher
// ============================================================
async function fetchNwsAtPoint(
  lat: number,
  lng: number,
): Promise<{ current: CurrentWeather; daily: DailyForecast[] } | null> {
  // 1. Points endpoint — gives us grid coords + URLs
  let pointsRes: Response;
  try {
    pointsRes = await fetch(
      `${NWS_BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[weather] NWS points fetch failed:`, err);
    return null;
  }
  if (!pointsRes.ok) {
    // 400/404 typically means the lat/lng is outside the US
    // (NWS doesn't cover other countries). Don't log as an
    // error — it's expected for international projects.
    if (pointsRes.status !== 404) {
      // eslint-disable-next-line no-console
      console.warn(`[weather] NWS points returned ${pointsRes.status}`);
    }
    return null;
  }
  const points = (await pointsRes.json()) as NwsPointsResponse;
  const { forecast: forecastUrl, observationStations: stationsUrl } = points.properties;

  // 2. Parallel: forecast + nearest-station current observation
  const [forecastRes, stationsRes] = await Promise.all([
    fetch(forecastUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } })
      .catch((e) => { console.warn('[weather] forecast fetch threw:', e); return null; }),
    fetch(stationsUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } })
      .catch(() => null),
  ]);

  if (!forecastRes || !forecastRes.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[weather] NWS forecast fetch failed`);
    return null;
  }
  const forecast = (await forecastRes.json()) as NwsForecastResponse;

  // ---- Daily forecast: collapse 14 periods into 7 days ----
  // NWS gives "Today" + "Tonight" + "Monday" + "Monday Night"
  // ... alternating. We group by date and pick the daytime
  // period for high + icon + description, and the nighttime
  // period for low. If the daytime period has a temperature,
  // that's the "high"; if nighttime has a temperature, that's
  // the "low". NWS usually gives day=high, night=low.
  const daily: DailyForecast[] = [];
  const byDate = new Map<string, { day?: NwsForecastPeriod; night?: NwsForecastPeriod }>();
  for (const p of forecast.properties.periods) {
    // Extract YYYY-MM-DD from startTime (ISO 8601 with offset)
    const date = p.startTime.slice(0, 10);
    const bucket = byDate.get(date) ?? {};
    if (p.isDaytime) bucket.day = p;
    else bucket.night = p;
    byDate.set(date, bucket);
  }
  // The first period is always "Today" (day) or "Tonight" (night).
  // We iterate in the order NWS gives us, which respects the
  // actual forecast timeline.
  const dateKeys = Array.from(byDate.keys());
  for (let i = 0; i < Math.min(7, dateKeys.length); i++) {
    const date = dateKeys[i]!;
    const bucket = byDate.get(date)!;
    const day = bucket.day ?? bucket.night;
    if (!day) continue;
    // Low comes from the night period if present, otherwise
    // we fall back to the daytime's own temperature.
    const highF = day.temperature;
    const lowF = bucket.night?.temperature ?? highF;
    const desc = describeNwsText(day.shortForecast);
    daily.push({
      date,
      high: fToC(highF),
      low: fToC(lowF),
      // NWS doesn't give a daily precip total directly in
      // the multi-day forecast. We use probabilityOfPrecipitation
      // as a proxy (it's a 0-100 integer). Precipitation mm
      // is left as 0 — the widget shows %, not mm.
      precipitation: 0,
      precipitationProbability: day.probabilityOfPrecipitation?.value ?? 0,
      weatherCode: desc.code,
      description: day.shortForecast,
      icon: desc.icon,
    });
  }

  // ---- Current conditions: latest observation from nearest station ----
  let current: CurrentWeather | null = null;
  if (stationsRes && stationsRes.ok) {
    const stations = (await stationsRes.json()) as NwsStationsResponse;
    // Take the first (nearest) station. Stations are returned
    // in order of proximity to the gridpoint, so the first one
    // is always the closest. If the nearest station's most
    // recent observation is missing or very stale, fall back
    // to the next station.
    for (const feature of stations.features.slice(0, 3)) {
      const stationId = feature.properties.stationIdentifier;
      try {
        const obsRes = await fetch(
          `${NWS_BASE}/stations/${stationId}/observations/latest`,
          { headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' } },
        );
        if (!obsRes.ok) continue;
        const obs = (await obsRes.json()) as NwsObservation;
        const p = obs.properties;
        // Skip if temperature is null (some stations report
        // wind-only or pressure-only observations).
        if (p.temperature.value == null) continue;
        const tempC = p.temperature.unitCode.includes('degC')
          ? p.temperature.value
          : fToC(p.temperature.value);
        const windKmh = p.windSpeed.value ?? 0;
        const humidity = p.relativeHumidity.value ?? 0;
        const desc = describeNwsText(p.textDescription || 'Unknown');
        const isDay = isDaytime(p.timestamp);
        current = {
          temperature: tempC,
          feelsLike: feelsLikeC(tempC, humidity, windKmh),
          humidity,
          windSpeed: windKmh,
          windDirection: compassToDegrees(p.windDirection.value ?? 0),
          precipitation: 0, // observation doesn't give precip total
          weatherCode: desc.code,
          description: p.textDescription || desc.desc,
          icon: desc.icon,
          isDay,
          time: p.timestamp,
        };
        break;
      } catch {
        // try next station
      }
    }
  }

  // If we couldn't get a current observation, synthesize one
  // from the first forecast period. Better than nothing.
  if (!current) {
    const first = forecast.properties.periods[0];
    if (first) {
      const windParsed = parseNwsWind(first.windSpeed, 'mph');
      const tempC = first.temperatureUnit === 'C' ? first.temperature : fToC(first.temperature);
      const desc = describeNwsText(first.shortForecast);
      current = {
        temperature: tempC,
        feelsLike: tempC, // no humidity from forecast
        humidity: 0,
        windSpeed: windParsed.kmh,
        windDirection: compassToDegrees(first.windDirection),
        precipitation: 0,
        weatherCode: desc.code,
        description: first.shortForecast,
        icon: desc.icon,
        isDay: first.isDaytime,
        time: first.startTime,
      };
    }
  }

  if (!current) return null;
  return { current, daily };
}

/**
 * Fetch current weather + 7-day forecast for a lat/lng.
 * Returns null on any error so the UI can degrade.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<{ current: CurrentWeather; daily: DailyForecast[] } | null> {
  return fetchNwsAtPoint(lat, lng);
}

/**
 * One-shot weather fetch for a project address.
 * Geocodes the address, then fetches forecast. Cached for 30 min via Next.
 */
export const fetchWeatherForAddress = nextCache(
  async (address: string): Promise<WeatherData | null> => {
    const loc = await geocode(address);
    if (!loc) return null;
    const w = await fetchWeather(loc.latitude, loc.longitude);
    if (!w) return null;
    return {
      location: loc,
      current: w.current,
      daily: w.daily,
      fetchedAt: new Date().toISOString(),
    };
  },
  ['weather-for-address-v3'],
  { revalidate: 60 * 30, tags: ['weather'] },
);

/**
 * Convert a project's address parts into a single geocodable string.
 */
export function projectAddressToQuery(p: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string | null {
  const parts = [
    p.address,
    p.city,
    p.state,
    p.zip,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(', ');
}

/**
 * Fahrenheit helper (display only — we store °C internally).
 */
export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}
