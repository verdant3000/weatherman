const axios = require('axios');
const { query, run } = require('./db');

const LOCATIONS = [
  { name: 'Brohm Ridge',     lat: 50.085, lon: -123.013, elevation_m: 1550 },
  { name: 'Goat Ridge',      lat: 49.694, lon: -123.175, elevation_m: 1900 },
  { name: 'Squamish Valley', lat: 49.702, lon: -123.147, elevation_m: 10   },
];

async function fetchOpenMeteoForecast(location) {
  const params = {
    latitude: location.lat,
    longitude: location.lon,
    daily: [
      'temperature_2m_max', 'temperature_2m_min',
      'precipitation_sum', 'precipitation_probability_max',
      'weathercode', 'freezinglevel_height_max', 'freezinglevel_height_min',
      'snowfall_sum', 'windspeed_10m_max'
    ].join(','),
    timezone: 'America/Vancouver',
    forecast_days: 16
  };

  const response = await axios.get('https://api.open-meteo.com/v1/forecast', { params, timeout: 10000 });
  const d = response.data;
  const fetchedAt = new Date().toISOString();

  for (let i = 0; i < d.daily.time.length; i++) {
    const fzl = d.daily.freezinglevel_height_max[i] != null && d.daily.freezinglevel_height_min[i] != null
      ? (d.daily.freezinglevel_height_max[i] + d.daily.freezinglevel_height_min[i]) / 2
      : null;

    await run(`
      INSERT INTO open_meteo_forecasts
        (fetched_at, location_name, lat, lon, elevation_m, forecast_date,
         temp_max_c, temp_min_c, precipitation_mm, precipitation_probability,
         weathercode, freezing_level_m, snowfall_cm, wind_speed_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (location_name, forecast_date)
      DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        temp_max_c = EXCLUDED.temp_max_c,
        temp_min_c = EXCLUDED.temp_min_c,
        precipitation_mm = EXCLUDED.precipitation_mm,
        precipitation_probability = EXCLUDED.precipitation_probability,
        weathercode = EXCLUDED.weathercode,
        freezing_level_m = EXCLUDED.freezing_level_m,
        snowfall_cm = EXCLUDED.snowfall_cm,
        wind_speed_ms = EXCLUDED.wind_speed_ms
    `, [
      fetchedAt, location.name, location.lat, location.lon, location.elevation_m,
      d.daily.time[i],
      d.daily.temperature_2m_max[i], d.daily.temperature_2m_min[i],
      d.daily.precipitation_sum[i], d.daily.precipitation_probability_max[i],
      d.daily.weathercode[i], fzl,
      d.daily.snowfall_sum[i], d.daily.windspeed_10m_max[i]
    ]);
  }

  console.log(`[open-meteo] Upserted ${d.daily.time.length} days for ${location.name}`);
  return { location: location.name, days: d.daily.time.length };
}

async function fetchAllLocations() {
  const results = [];
  for (const loc of LOCATIONS) {
    try {
      results.push({ success: true, ...(await fetchOpenMeteoForecast(loc)) });
    } catch (err) {
      console.error(`[open-meteo] Failed for ${loc.name}:`, err.message);
      results.push({ success: false, location: loc.name, error: err.message });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

async function getLatestForecasts() {
  return query(`
    SELECT * FROM open_meteo_forecasts
    WHERE forecast_date >= CURRENT_DATE
    ORDER BY location_name, forecast_date
  `);
}

async function getShootWindowForecast() {
  return query(`
    SELECT * FROM open_meteo_forecasts
    WHERE forecast_date IN ('2026-06-10', '2026-06-11')
    ORDER BY location_name, forecast_date
  `);
}

module.exports = { fetchAllLocations, getLatestForecasts, getShootWindowForecast, LOCATIONS };
