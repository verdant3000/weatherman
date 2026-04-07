const axios = require('axios');
const { run, query } = require('./db');

const LOCATION = { lat: 50.085, lon: -123.013, name: 'Brohm Ridge' };
const YEARS = [2022, 2023, 2024, 2025, 2026];

async function fetchAndStoreHistoricalFZL(year) {
  const startDate = `${year}-04-01`;
  const endDate = year === 2026
    ? new Date().toISOString().split('T')[0]
    : `${year}-06-13`;

  const url = 'https://archive-api.open-meteo.com/v1/archive';
  const params = {
    latitude: LOCATION.lat,
    longitude: LOCATION.lon,
    start_date: startDate,
    end_date: endDate,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'temperature_2m_mean',
      'freezinglevel_height_max',
      'freezinglevel_height_min',
      'precipitation_sum',
      'rain_sum',
      'snowfall_sum'
    ].join(','),
    timezone: 'America/Vancouver'
  };

  const response = await axios.get(url, { params, timeout: 15000 });
  const d = response.data.daily;

  for (let i = 0; i < d.time.length; i++) {
    const fzl_avg = (d.freezinglevel_height_max[i] != null && d.freezinglevel_height_min[i] != null)
      ? (d.freezinglevel_height_max[i] + d.freezinglevel_height_min[i]) / 2
      : d.freezinglevel_height_max[i] || d.freezinglevel_height_min[i];

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
      d.time[i], year, LOCATION.name,
      d.temperature_2m_max[i], d.temperature_2m_min[i], d.temperature_2m_mean[i],
      d.freezinglevel_height_max[i], d.freezinglevel_height_min[i], fzl_avg,
      d.precipitation_sum[i], d.rain_sum[i], d.snowfall_sum[i]
    ]);
  }

  console.log(`[fzl-history] Stored ${d.time.length} days for ${year}`);
  return { year, days: d.time.length };
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
    await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

async function getHistoricalFZLbyYear() {
  return query(`
    SELECT
      date,
      year,
      TO_CHAR(date, 'MM-DD') as month_day,
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
  return query(`
    SELECT
      date,
      EXTRACT(DOY FROM date) as day_of_year,
      temp_avg_c,
      temp_max_c,
      precip_mm,
      rain_mm
    FROM historical_fzl
    WHERE year = $1
      AND date >= make_date($1::int, 4, 1)
      AND date <= make_date($1::int, 6, 13)
    ORDER BY date
  `, [year]);
}

module.exports = {
  fetchAllHistoricalFZL,
  fetchAndStoreHistoricalFZL,
  getHistoricalFZLbyYear,
  getMeltData,
  YEARS
};
