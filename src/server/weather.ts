import type { Weather } from "../lib/types"

// Hard-coded to Berlin for now. Open-Meteo is free for non-commercial use, with no API key.
const LOCATION = { latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin" }

interface RawForecast {
  daily: { weather_code: Array<number>; temperature_2m_max: Array<number>; temperature_2m_min: Array<number> }
}

export async function fetchWeather(): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    timezone: LOCATION.timezone,
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    forecast_days: "1",
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`)
  const { daily } = (await res.json()) as RawForecast
  return {
    code: daily.weather_code[0],
    max: Math.round(daily.temperature_2m_max[0]),
    min: Math.round(daily.temperature_2m_min[0]),
  }
}
