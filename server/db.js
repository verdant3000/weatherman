const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || path.join(__dirname, '../data/screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('[db] Running migrations...');

  await run(`
    CREATE TABLE IF NOT EXISTS wx_readings (
      id            SERIAL PRIMARY KEY,
      timestamp     TIMESTAMPTZ NOT NULL,
      source        TEXT NOT NULL,
      station_id    TEXT,
      elevation_m   INTEGER,
      temp_c        REAL,
      temp_min_c    REAL,
      temp_max_c    REAL,
      rh_pct        REAL,
      precip_mm     REAL,
      wind_speed_ms REAL,
      wind_dir_deg  REAL,
      pressure_hpa  REAL,
      freezing_level_m REAL,
      raw_json      JSONB,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS screenshots (
      id              SERIAL PRIMARY KEY,
      captured_at     TIMESTAMPTZ NOT NULL,
      camera_id       TEXT NOT NULL,
      camera_name     TEXT,
      file_path       TEXT NOT NULL,
      file_size_bytes INTEGER,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS open_meteo_forecasts (
      id                        SERIAL PRIMARY KEY,
      fetched_at                TIMESTAMPTZ NOT NULL,
      location_name             TEXT NOT NULL,
      lat                       REAL,
      lon                       REAL,
      elevation_m               INTEGER,
      forecast_date             DATE NOT NULL,
      temp_max_c                REAL,
      temp_min_c                REAL,
      precipitation_mm          REAL,
      precipitation_probability INTEGER,
      weathercode               INTEGER,
      freezing_level_m          REAL,
      snowfall_cm               REAL,
      wind_speed_ms             REAL,
      created_at                TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (location_name, forecast_date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS digest_log (
      id         SERIAL PRIMARY KEY,
      sent_at    TIMESTAMPTZ NOT NULL,
      recipient  TEXT,
      subject    TEXT,
      status     TEXT,
      error      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_wx_timestamp      ON wx_readings(timestamp)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_wx_source         ON wx_readings(source)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_wx_station        ON wx_readings(station_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_screenshots_cam   ON screenshots(camera_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_screenshots_date  ON screenshots(captured_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_forecast_date     ON open_meteo_forecasts(forecast_date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_forecast_loc      ON open_meteo_forecasts(location_name)`);

  console.log('[db] Migrations complete');
}

module.exports = { pool, query, queryOne, run, migrate, SCREENSHOTS_DIR };
