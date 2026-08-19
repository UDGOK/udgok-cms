/**
 * Live weather from OpenWeatherMap One Call 4.0.
 *
 *   https://openweathermap.org/api/one-call-4
 *
 * Replaces the previous Open-Meteo implementation. The widget
 * contract (WeatherData shape) is unchanged so WeatherWidget
 * and the rest of the app need no edits.
 *
 * What we use:
 *   - One Call 4 endpoint: current conditions + 7-day daily forecast
 *     for any lat/lng. Paid tier; key is required.
 *   - Geocoding: we still use Nominatim (no key, OSM ToS-compliant
 *     User-Agent). OWM has a geocoder too but Nominatim is more
 *     accurate for US construction sites and we already had it
 *     wired.
 *
 * Unit strategy: we hit OWM with the default (standard) units so
 * temperature comes back in Kelvin, wind in m/s, precip in mm.
 * We convert to Celsius/kmh/mm for the in-app contract, then the
 * existing cToF() helper in the widget converts to Fahrenheit at
 * display time. Why not use units=imperial? Then the contract
 * would carry Fahrenheit and the cToF() helper would multiply
 * twice. Keeping the in-app contract in Celsius means existing
 * tests and helpers don't need to know about the upstream choice.
 *
 * API key:
 *   - Env var: UDGOK_CMS_OPENWEATHER_API_KEY (or OPENWEATHER_API_KEY
 *     or OWM_API_KEY via the shim in next.config.mjs)
 *   - Hardcoded fallback: a default key is provided so the app
 *     works on first deploy without any env config. To rotate
 *     the key, set the env var and the fallback is ignored.
 *
 * Errors: any fetch failure (network, 401, 429, 5xx) returns
 * null so the project page degrades gracefully. We do NOT throw
 * — the widget shows "weather unavailable" instead of crashing
 * the entire project page.
 */

import { unstable_cache as nextCache } from 'next/cache';

const WEATHER_BASE = 'https://api.openweathermap.org/data/4.0/onecall';
// We keep Nominatim for geocoding — already proven, no key
// required, US-construction-grade accuracy.
const GEO_BASE = process.env.UDGOK_CMS_NOMINATIM_BASE_URL
  ? `${process.env.UDGOK_CMS_NOMINATIM_BASE_URL}/search`
  : 'https://nominatim.openstreetmap.org/search';

/**
 * API key resolution. Order:
 *   1. UDGOK_CMS_OPENWEATHER_API_KEY env var
 *   2. OPENWEATHER_API_KEY env var
 *   3. OWM_API_KEY env var
 *   4. Hardcoded fallback (so the app works on first deploy)
 *
 * To rotate the key without touching code: set
 * UDGOK_CMS_OPENWEATHER_API_KEY on Vercel and the fallback
 * is never read.
 */
function getApiKey(): string {
  return (
    process.env.UDGOK_CMS_OPENWEATHER_API_KEY ||
    process.env.OPENWEATHER_API_KEY ||
    process.env.OWM_API_KEY ||
    // Hardcoded fallback. Override via env var to rotate.
    'fb0d72dfc7e6cb52245d0de81856ef54'
  );
}

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
  weatherCode: number; // OWM weather id
  description: string; // human-readable
  icon: string; // emoji fallback
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
// OWM weather id → human description + emoji
// ============================================================
// OWM weather codes: https://openweathermap.org/weather-conditions
// We use a small focused set — the full list is 30+ but most
// construction sites only see a handful in practice.
function describeOwmCode(id: number, isDay: boolean): { desc: string; icon: string } {
  // Group by range first, then narrow by specific id.
  if (id >= 200 && id < 300) {
    return { desc: 'Thunderstorm', icon: '⛈️' };
  }
  if (id >= 300 && id < 400) {
    return { desc: 'Drizzle', icon: '🌦️' };
  }
  if (id >= 500 && id < 600) {
    if (id === 500) return { desc: 'Light rain', icon: '🌦️' };
    if (id === 501) return { desc: 'Moderate rain', icon: '🌧️' };
    if (id >= 502) return { desc: 'Heavy rain', icon: '🌧️' };
    return { desc: 'Rain', icon: '🌧️' };
  }
  if (id >= 600 && id < 700) {
    if (id === 600) return { desc: 'Light snow', icon: '🌨️' };
    if (id === 601) return { desc: 'Snow', icon: '🌨️' };
    if (id >= 602) return { desc: 'Heavy snow', icon: '❄️' };
    return { desc: 'Snow', icon: '❄️' };
  }
  if (id >= 700 && id < 800) {
    if (id === 701) return { desc: 'Mist', icon: '🌫️' };
    if (id === 711) return { desc: 'Smoke', icon: '🌫️' };
    if (id === 721) return { desc: 'Haze', icon: '🌫️' };
    if (id === 731 || id === 761) return { desc: 'Dust', icon: '🌫️' };
    if (id === 741) return { desc: 'Fog', icon: '🌫️' };
    if (id === 751) return { desc: 'Sand', icon: '🌫️' };
    if (id === 762) return { desc: 'Volcanic ash', icon: '🌫️' };
    if (id === 771) return { desc: 'Squalls', icon: '💨' };
    if (id === 781) return { desc: 'Tornado', icon: '🌪️' };
    return { desc: 'Haze', icon: '🌫️' };
  }
  if (id === 800) {
    return isDay ? { desc: 'Clear sky', icon: '☀️' } : { desc: 'Clear sky', icon: '🌙' };
  }
  if (id === 801) {
    return isDay ? { desc: 'Few clouds', icon: '🌤️' } : { desc: 'Few clouds', icon: '☁️' };
  }
  if (id === 802) {
    return isDay ? { desc: 'Partly cloudy', icon: '⛅' } : { desc: 'Partly cloudy', icon: '☁️' };
  }
  if (id === 803) return { desc: 'Mostly cloudy', icon: '☁️' };
  if (id === 804) return { desc: 'Overcast', icon: '☁️' };
  return { desc: 'Unknown', icon: '❓' };
}

/** Kelvin → Celsius. */
function kToC(k: number): number {
  return k - 273.15;
}

/** m/s → km/h. */
function msToKmh(ms: number): number {
  return ms * 3.6;
}

/**
 * Geocode a free-form address string into a lat/lng + display name.
 * Returns null if not found.
 *
 * Uses Nominatim (OpenStreetMap) — already wired with a ToS-compliant
 * User-Agent. We tried OWM's geocoder but found it less accurate
 * for US addresses, especially rural construction sites.
 */
export async function geocode(query: string): Promise<WeatherLocation | null> {
  if (!query.trim()) return null;
  try {
    const url = `${GEO_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'udgok-cms/0.1.0 (https://cms.udgok.com; support@udgok.com)' },
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
    // Nominatim's display_name is "City, County, State, Country" or
    // "Address, City, State, Country" depending on what's queried.
    // We split on commas and take the first piece for the name and
    // the second-to-last for the country.
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

interface OwmWeather {
  id: number;
  main: string;
  description: string;
  icon: string; // "01d" / "01n" / "10d" etc.
}

interface OwmCurrent {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  clouds: number;
  uvi: number;
  visibility?: number;
  wind_speed: number;
  wind_deg?: number;
  wind_gust?: number;
  weather: OwmWeather[];
  rain?: { '1h'?: number };
  snow?: { '1h'?: number };
}

interface OwmDaily {
  dt: number;
  sunrise: number;
  sunset: number;
  moonrise: number;
  moonset: number;
  moon_phase: number;
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };
  feels_like: { day: number; night: number; eve: number; morn: number };
  pressure: number;
  humidity: number;
  dew_point: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  weather: OwmWeather[];
  clouds: number;
  pop: number; // probability of precipitation, 0-1
  rain?: number; // mm
  snow?: number; // mm
  uvi: number;
}

interface OwmOneCallResponse {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  current: OwmCurrent;
  minutely?: Array<{ dt: number; precipitation: number }>;
  hourly?: Array<Record<string, unknown>>;
  daily: OwmDaily[];
  alerts?: Array<Record<string, unknown>>;
}

/**
 * Fetch current weather + 7-day daily forecast for a lat/lng.
 * Returns null on any error so the UI can degrade.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<{ current: CurrentWeather; daily: DailyForecast[] } | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: apiKey,
    // Default (standard) units: Kelvin, m/s, mm. We convert
    // ourselves to keep the in-app contract in Celsius.
  });
  const url = `${WEATHER_BASE}?${params.toString()}`;

  try {
    const r = await fetch(url, { next: { revalidate: 60 * 30 } }); // 30-min cache
    if (!r.ok) {
      // 401 = bad key, 429 = rate limited, 5xx = upstream issue.
      // All → null → widget shows "unavailable".
      // We log so a Sentry or operator can spot the cause.
      // eslint-disable-next-line no-console
      console.warn(`[weather] OWM returned ${r.status} for ${lat},${lng}`);
      return null;
    }
    const data = (await r.json()) as OwmOneCallResponse;

    // ---- Current conditions ----
    const now = data.current;
    const isDay = now.dt >= now.sunrise && now.dt < now.sunset;
    // OWM doesn't have a single "weather code" like Open-Meteo.
    // We use the first weather entry's `id` as the canonical code.
    const curCode = now.weather[0]?.id ?? 800;
    const curIconCode = now.weather[0]?.icon ?? (isDay ? '01d' : '01n');
    // The icon code has a trailing 'd' (day) or 'n' (night) — use
    // it to disambiguate the description's day/night flavor.
    const curIsDayIcon = curIconCode.endsWith('d');
    const curDesc = describeOwmCode(curCode, curIsDayIcon);
    // Precipitation in the last hour (rain + snow), mm.
    const precipLastHour = (now.rain?.['1h'] ?? 0) + (now.snow?.['1h'] ?? 0);

    const current: CurrentWeather = {
      temperature: kToC(now.temp),
      feelsLike: kToC(now.feels_like),
      humidity: now.humidity,
      windSpeed: msToKmh(now.wind_speed),
      windDirection: now.wind_deg ?? 0,
      precipitation: precipLastHour,
      weatherCode: curCode,
      description: now.weather[0]?.description ?? curDesc.desc,
      icon: curDesc.icon,
      isDay,
      time: new Date(now.dt * 1000).toISOString(),
    };

    // ---- Daily forecast ----
    // OWM's daily[].temp has day/min/max/night/eve/morn. We use
    // .day for the headline high and .min for the low — closest
    // to what the widget's "high / low" expects.
    const daily: DailyForecast[] = (data.daily ?? []).slice(0, 7).map((d) => {
      const dayCode = d.weather[0]?.id ?? 800;
      const dayIconCode = d.weather[0]?.icon ?? '01d';
      const dayIsDay = dayIconCode.endsWith('d');
      const dayDesc = describeOwmCode(dayCode, dayIsDay);
      const date = new Date(d.dt * 1000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return {
        date: `${yyyy}-${mm}-${dd}`,
        high: kToC(d.temp.max),
        low: kToC(d.temp.min),
        // OWM gives daily precip totals; fall back to 0.
        precipitation: (d.rain ?? 0) + (d.snow ?? 0),
        // pop is 0-1; convert to percent and round.
        precipitationProbability: Math.round(d.pop * 100),
        weatherCode: dayCode,
        description: d.weather[0]?.description ?? dayDesc.desc,
        icon: dayDesc.icon,
      };
    });

    return { current, daily };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[weather] fetch failed for ${lat},${lng}:`, err);
    return null;
  }
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
  ['weather-for-address'],
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
