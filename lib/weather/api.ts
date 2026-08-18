/**
 * Live weather from Open-Meteo. Free, no API key, no rate limits for
 * non-commercial use. https://open-meteo.com/
 *
 * Two APIs in one module:
 *   1. Geocoding: takes a city/zip and returns lat/lng
 *   2. Forecast: takes lat/lng and returns current + 7-day forecast
 *
 * Results are cached in-memory for 30 minutes to avoid hammering the API
 * on every project page render. Cache is per-server-instance; Vercel
 * serverless will reset it per cold start which is fine.
 *
 * On any failure we return null so the UI can degrade gracefully
 * (show "weather unavailable" instead of crashing the project page).
 */

import { unstable_cache as nextCache } from 'next/cache';

const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

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
  weatherCode: number;
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

// WMO weather interpretation codes
// https://open-meteo.com/en/docs#weathervariables
const WEATHER_CODES: Record<number, { desc: string; icon: string; day?: string; night?: string }> = {
  0: { desc: 'Clear sky', icon: '☀️', day: '☀️', night: '🌙' },
  1: { desc: 'Mainly clear', icon: '🌤️', day: '🌤️', night: '🌙' },
  2: { desc: 'Partly cloudy', icon: '⛅', day: '⛅', night: '☁️' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Fog', icon: '🌫️' },
  48: { desc: 'Rime fog', icon: '🌫️' },
  51: { desc: 'Light drizzle', icon: '🌦️' },
  53: { desc: 'Drizzle', icon: '🌦️' },
  55: { desc: 'Heavy drizzle', icon: '🌦️' },
  56: { desc: 'Freezing drizzle', icon: '🌧️' },
  57: { desc: 'Freezing drizzle', icon: '🌧️' },
  61: { desc: 'Light rain', icon: '🌦️' },
  63: { desc: 'Rain', icon: '🌧️' },
  65: { desc: 'Heavy rain', icon: '🌧️' },
  66: { desc: 'Freezing rain', icon: '🌧️' },
  67: { desc: 'Freezing rain', icon: '🌧️' },
  71: { desc: 'Light snow', icon: '🌨️' },
  73: { desc: 'Snow', icon: '❄️' },
  75: { desc: 'Heavy snow', icon: '❄️' },
  77: { desc: 'Snow grains', icon: '❄️' },
  80: { desc: 'Rain showers', icon: '🌦️' },
  81: { desc: 'Rain showers', icon: '🌧️' },
  82: { desc: 'Violent rain showers', icon: '⛈️' },
  85: { desc: 'Snow showers', icon: '🌨️' },
  86: { desc: 'Heavy snow showers', icon: '❄️' },
  95: { desc: 'Thunderstorm', icon: '⛈️' },
  96: { desc: 'Thunderstorm w/ hail', icon: '⛈️' },
  99: { desc: 'Severe thunderstorm', icon: '⛈️' },
};

function describeCode(code: number, isDay: boolean): { desc: string; icon: string } {
  const entry = WEATHER_CODES[code] ?? { desc: 'Unknown', icon: '❓' };
  return {
    desc: entry.desc,
    icon: isDay && entry.day ? entry.day : !isDay && entry.night ? entry.night : entry.icon,
  };
}

/**
 * Geocode a free-form address string into a lat/lng + display name.
 * Returns null if not found.
 */
export async function geocode(query: string): Promise<WeatherLocation | null> {
  if (!query.trim()) return null;
  try {
    const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const r = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // cache 24h
    if (!r.ok) return null;
    const data = (await r.json()) as { results?: WeatherLocation[] };
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch current weather + 7-day forecast for a lat/lng.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<{ current: CurrentWeather; daily: DailyForecast[] } | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
      ].join(','),
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
      timezone: 'auto',
      forecast_days: '7',
    });
    const url = `${WEATHER_BASE}?${params.toString()}`;
    const r = await fetch(url, { next: { revalidate: 60 * 30 } }); // 30 min cache
    if (!r.ok) return null;
    const data = (await r.json()) as {
      current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        is_day: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        time: string;
      };
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
      };
    };

    const isDay = data.current.is_day === 1;
    const currentDesc = describeCode(data.current.weather_code, isDay);

    return {
      current: {
        temperature: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
        description: currentDesc.desc,
        icon: currentDesc.icon,
        isDay,
        time: data.current.time,
      },
      daily: data.daily.time.map((d, i) => {
        const desc = describeCode(data.daily.weather_code[i]!, true);
        return {
          date: d,
          high: data.daily.temperature_2m_max[i]!,
          low: data.daily.temperature_2m_min[i]!,
          precipitation: data.daily.precipitation_sum[i] ?? 0,
          precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
          weatherCode: data.daily.weather_code[i]!,
          description: desc.desc,
          icon: desc.icon,
        };
      }),
    };
  } catch {
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
