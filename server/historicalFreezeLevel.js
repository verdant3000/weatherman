/**
 * Historical freezing level from Open-Meteo archive API
 * Uses pressure level temperature data (850hPa and 700hPa) to calculate FZL
 * ERA5 reanalysis goes back to 1940 — free, no key required
 *
 * Method: interpolate between 850hPa (~1500m) and 700hPa (~3000m) temps
 * to find where temp crosses 0°C = freezing level
 */
const axios = require('axios');
const { run, query } = require('./db');

const LOCATION = { lat: 50.085, lon: -123.013, name: 'Brohm Ridge' };
const YEARS = [2022, 2023, 2024, 2025, 2026];

// Pressure level heights (approximate metres for BC coast)
const P850_HEIGHT = 1500; // 850hPa ≈ 1,500m
const P700_HEIGHT = 3000; // 700hPa ≈ 3,000m

async function fetchAndStoreHistoricalFZL(year) {
  const startDate = `${year}-04-01`;
  const endDate = year === 2026
    ? new Date().toISOString().split('T')[0]
    : `${year}-06-13`;

  const url = 'https://archive-api.open-meteo.com/v1/archive';

  // Fetch daily surface data + hourly pressure level temps
  const params = {
    latitude: LOCATION.lat,
    longitude: LOCATION.lon,
    start_date: startDate,
    end_date: endDate,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'temperature_2m_mean',
      'precipitation_sum',
      'rain_sum',
      'snowfall_sum'
    ].join(','),
    hourly: [
      'temperature_850hPa',
      'temperature_700hPa'
    ].join(','),
    timezone: 'America/Vancouver'
  };

  const response = await axios.get(url, { params, timeout: 20000 });
  const d = response.data;

  // Calculate daily avg FZL from hourly pressure level temps
  // Group hourly temps by date, then interpolate FZL
  const dailyFZL = {};

  if (d.hourly?.temperature_850hPa && d.hourly?.temperature_700hPa) {
    for (let i = 0; i < d.hourly.time.length; i++) {
      const dateKey = d.hourly.time[i].split('T')[0];
      const t850 = d.hourly.temperature_850hPa[i];
      const t700 = d.hourly.temperature_700hPa[i];

      if (t850 == null || t700 == null) continue;

      // Linear interpolation between pressure levels to find 0°C height
      // If both above 0: FZL is above 700hPa level (>3000m)
      // If both below 0: FZL is below 850hPa level (<1500m)
      // Otherwise: interpolate between the two levels
      let fzl;
      if (t850 <= 0) {
        fzl = P850_HEIGHT * (1 + t850 / 10); // Below 1500m, estimate
        fzl = Math.max(0, fzl);
      } else if (t700 >= 0) {
        fzl = P700_HEIGHT + (t700 / 5) * 200; // Above 3000m
      } else {
        // Interpolate: at what height does temp cross 0?
        // Linear from P850_HEIGHT (t850) to P700_HEIGHT (t700)
        const fraction = t850 / (t850 - t700);
        fzl = P850_HEIGHT + fraction * (P700_HEIGHT - P850_HEIGHT);
      }

      if (!dailyFZL[dateKey]) dailyFZL[dateKey] = [];
      dailyFZL[dateKey].push(Math.round(fzl));
    }
  }

  // Store daily records
  let stored = 0;
  for (let i = 0; i < d.daily.time.length; i++) {
    const date = d.daily.time[i];
    const fzlValues = dailyFZL[date] || [];
    const fzl_avg = fzlValues.length > 0
      ? Math.round(fzlValues.reduce((a, b) => a + b, 0) / fzlValues.length)
      : null;
    const fzl_max = fzlValues.length > 0 ? Math.max(...fzlValues) : null;
    const fzl_min = fzlValues.length > 0 ? Math.min(...fzlValues) : null;

    await run(`
      INSERT INTO historical_fzl
        (date, year, location_name, temp_max_c, temp_min_c, temp_avg_c,
         fzl_max_m, fzl_min_m, fzl_avg_m, precip_mm, rain_mm, snowfall_cm)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (date, location_name) DO UPDATE SET
        temp_max_c = EXCLUDED.temp_max_c,
        temp_min_c = EXCLUDED.temp_min_c,
        temp_avg_c = EXCLUDED.temp_avg_c,
        fzl_max_m = EXCLUDED.fzl_max_m,
        fzl_min_m = EXCLUDED.fzl_min_m,
        fzl_avg_m = EXCLUDED.fzl_avg_m,
        precip_mm = EXCLUDED.precip_mm,
        rain_mm = EXCLUDED.rain_mm,
        snowfall_cm = EXCLUDED.snowfall_cm
    `, [
      date, year, LOCATION.name,
      d.daily.temperature_2m_max[i], d.daily.temperature_2m_min[i], d.daily.temperature_2m_mean[i],
      fzl_max, fzl_min, fzl_avg,
      d.daily.precipitation_sum[i], d.daily.rain_sum[i], d.daily.snowfall_sum[i]
    ]);
    stored++;
  }

  console.log(`[fzl-history] Stored ${stored} days for ${year}`);
  return { year, days: stored };
}

async function fetchAllHistoricalFZL() {
  const results = [];
  for (const year of YEARS) {
    try {
      const r = await fetchAndStoreHistoricalFZL(year);
      results.push({ success: true, ...r });
    } catch (err) {
      console.error(`[fzl-history] Failed ${year}:`, err.message);
      results.push({ success: false, year, error: err.message });
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

async function getHistoricalFZLbyYear() {
  return query(`
    SELECT
      date,
      year,
      EXTRACT(DOY FROM date) as day_of_year,
      temp_max_c, temp_min_c, temp_avg_c,
      fzl_max_m, fzl_min_m, fzl_avg_m,
      precip_mm, rain_mm, snowfall_cm
    FROM historical_fzl
    WHERE date >= make_date(year::int, 4, 1)
      AND date <= make_date(year::int, 6, 13)
    ORDER BY year, date
  `);
}

async function getMeltData(year) {
  // Join historical FZL data with actual BTSC rain data where available
  return query(`
    SELECT
      h.date,
      EXTRACT(DOY FROM h.date) as day_of_year,
      h.temp_avg_c,
      h.temp_max_c,
      h.precip_mm,
      h.rain_mm as modelled_rain_mm,
      -- Use actual station rain if available, otherwise modelled
      COALESCE(
        (SELECT SUM(b.rain_mm) FROM btsc_readings b
         WHERE DATE(b.timestamp AT TIME ZONE 'America/Vancouver') = h.date
           AND b.rain_mm IS NOT NULL),
        h.rain_mm
      ) as rain_mm
    FROM historical_fzl h
    WHERE h.year = $1
      AND h.date >= make_date($1::int, 4, 1)
      AND h.date <= make_date($1::int, 6, 13)
    ORDER BY h.date
  `, [year]);
}

async function getHistoricalFZLcount() {
  return query(`SELECT COUNT(*) as n, MIN(year) as min_year, MAX(year) as max_year FROM historical_fzl`);
}

module.exports = {
  fetchAllHistoricalFZL,
  fetchAndStoreHistoricalFZL,
  getHistoricalFZLbyYear,
  getMeltData,
  YEARS
};
