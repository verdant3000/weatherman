const axios = require('axios');
const { run, query } = require('./db');

// Brohm Ridge coords
const LAT = 50.085;
const LON = -123.013;

async function ensureFreezeLevelTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS freeze_level_history (
      id            SERIAL PRIMARY KEY,
      date          DATE NOT NULL,
      year          INTEGER NOT NULL,
      day_of_year   INTEGER NOT NULL,
      fzl_max_m     REAL,
      fzl_min_m     REAL,
      fzl_avg_m     REAL,
      temp_max_c    REAL,
      temp_min_c    REAL,
      precip_mm     REAL,
      fetched_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (date)
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_fzl_date ON freeze_level_history(date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_fzl_year ON freeze_level_history(year)`);
}

async function fetchHistoricalFreezeLevel(year) {
  // Open-Meteo historical API — free, no key
  const startDate = `${year}-04-01`;
  const endDate = year === new Date().getFullYear()
    ? new Date().toISOString().split('T')[0]
    : `${year}-06-13`;

  const url = 'https://archive-api.open-meteo.com/v1/archive';
  const params = {
    latitude: LAT,
    longitude: LON,
    start_date: startDate,
    end_date: endDate,
    daily: 'freezinglevel_height_max,freezinglevel_height_min,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'America/Vancouver'
  };

  console.log(`[fzl-history] Fetching ${year} (${startDate} → ${endDate})...`);
  const response = await axios.get(url, { params, timeout: 15000 });
  const d = response.data.daily;

  let inserted = 0, skipped = 0;
  for (let i = 0; i < d.time.length; i++) {
    const date = d.time[i];
    const dt = new Date(date + 'T12:00:00');
    const doy = Math.floor((dt - new Date(dt.getFullYear(), 0, 0)) / 86400000);

    const fzlMax = d.freezinglevel_height_max[i];
    const fzlMin = d.freezinglevel_height_min[i];
    const fzlAvg = fzlMax != null && fzlMin != null ? (fzlMax + fzlMin) / 2 : null;

    try {
      const result = await run(`
        INSERT INTO freeze_level_history (date, year, day_of_year, fzl_max_m, fzl_min_m, fzl_avg_m, temp_max_c, temp_min_c, precip_mm)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (date) DO UPDATE SET
          fzl_max_m = EXCLUDED.fzl_max_m,
          fzl_min_m = EXCLUDED.fzl_min_m,
          fzl_avg_m = EXCLUDED.fzl_avg_m,
          temp_max_c = EXCLUDED.temp_max_c,
          temp_min_c = EXCLUDED.temp_min_c,
          precip_mm = EXCLUDED.precip_mm,
          fetched_at = NOW()
      `, [date, dt.getFullYear(), doy, fzlMax, fzlMin, fzlAvg,
          d.temperature_2m_max[i], d.temperature_2m_min[i], d.precipitation_sum[i]]);

      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`[fzl-history] Insert error ${date}:`, err.message);
    }
  }

  console.log(`[fzl-history] ${year}: ${inserted} upserted, ${skipped} skipped`);
  return { year, inserted, skipped, rows: d.time.length };
}

async function fetchAllHistoricalYears() {
  await ensureFreezeLevelTable();
  const years = [2022, 2023, 2024, 2025, new Date().getFullYear()];
  const results = [];
  for (const yr of years) {
    try {
      results.push(await fetchHistoricalFreezeLevel(yr));
      await new Promise(r => setTimeout(r, 1000)); // rate limit
    } catch (err) {
      console.error(`[fzl-history] Failed for ${yr}:`, err.message);
      results.push({ year: yr, error: err.message });
    }
  }
  return results;
}

async function getFreezeLevelYearOverYear() {
  await ensureFreezeLevelTable();
  return query(`
    SELECT
      date,
      year,
      day_of_year,
      fzl_max_m,
      fzl_min_m,
      fzl_avg_m,
      temp_max_c,
      temp_min_c,
      precip_mm
    FROM freeze_level_history
    WHERE day_of_year BETWEEN 91 AND 174
    ORDER BY year, day_of_year
  `);
}

async function getFreezeLevelRange() {
  await ensureFreezeLevelTable();
  return query(`
    SELECT year, MIN(date) as from_date, MAX(date) as to_date, COUNT(*) as days
    FROM freeze_level_history
    GROUP BY year ORDER BY year
  `);
}

module.exports = { fetchAllHistoricalYears, getFreezeLevelYearOverYear, getFreezeLevelRange, ensureFreezeLevelTable };
