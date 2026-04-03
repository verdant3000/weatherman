const axios = require('axios');
const { query, run } = require('./db');

const WU_BASE = 'https://api.weather.com/v2/pws';

const STATIONS = [
  { id: 'IBCSQUAM12',  name: 'Garibaldi Highlands', elevation_m: 380  },
  { id: 'ISQUAM29',    name: 'S2S Gondola Summit',  elevation_m: 885  },
  { id: 'ISQUAM21',    name: 'Squamish North',       elevation_m: 60   },
  { id: 'ISQUAM23',    name: 'Squamish',             elevation_m: 40   },
  { id: 'IBRITISH490', name: 'Crumpit Woods',        elevation_m: 200  },
];

async function fetchAllPWSCurrent() {
  const apiKey = process.env.WU_API_KEY;
  if (!apiKey || apiKey === 'your_wu_api_key_here') {
    console.log('[wu] No API key — skipping');
    return { skipped: true };
  }

  const results = [];
  for (const station of STATIONS) {
    try {
      const response = await axios.get(`${WU_BASE}/observations/current`, {
        params: { stationId: station.id, format: 'json', units: 'm', apiKey },
        timeout: 8000
      });

      const obs = response.data?.observations?.[0];
      if (!obs) continue;

      const m = obs.metric || {};
      await run(`
        INSERT INTO wx_readings
          (timestamp, source, station_id, elevation_m,
           temp_c, rh_pct, precip_mm, wind_speed_ms, wind_dir_deg, pressure_hpa, raw_json)
        VALUES ($1, 'weather_underground', $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        obs.obsTimeUtc || new Date().toISOString(),
        station.id, station.elevation_m,
        m.temp ?? null, obs.humidity ?? null,
        m.precipTotal ?? null, m.windSpeed ?? null,
        obs.winddir ?? null, m.pressure ?? null,
        JSON.stringify(obs)
      ]);

      results.push({ station: station.id, name: station.name, temp_c: m.temp });
      console.log(`[wu] ${station.name}: ${m.temp}°C`);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[wu] Failed ${station.id}:`, err.message);
      results.push({ station: station.id, error: err.message });
    }
  }
  return results;
}

async function getLatestPWSReadings() {
  // One row per station — most recent reading
  return query(`
    SELECT DISTINCT ON (station_id)
      station_id, timestamp as latest_time,
      temp_c, rh_pct, wind_speed_ms, pressure_hpa, precip_mm, elevation_m
    FROM wx_readings
    WHERE source = 'weather_underground'
    ORDER BY station_id, timestamp DESC
  `);
}

async function getPWSHistory(stationId, days = 30) {
  return query(`
    SELECT
      DATE(timestamp AT TIME ZONE 'America/Vancouver') as date,
      MIN(temp_c) as temp_min,
      MAX(temp_c) as temp_max,
      AVG(temp_c) as temp_avg,
      SUM(precip_mm) as precip_total,
      COUNT(*) as reading_count
    FROM wx_readings
    WHERE source = 'weather_underground'
      AND station_id = $1
      AND timestamp >= NOW() - ($2 || ' days')::INTERVAL
    GROUP BY DATE(timestamp AT TIME ZONE 'America/Vancouver')
    ORDER BY date
  `, [stationId, days]);
}

// Long-term lookback query — good for historical analysis
async function getPWSLookback(stationId, startDate, endDate) {
  return query(`
    SELECT
      DATE(timestamp AT TIME ZONE 'America/Vancouver') as date,
      MIN(temp_c) as temp_min,
      MAX(temp_c) as temp_max,
      ROUND(AVG(temp_c)::numeric, 2) as temp_avg,
      SUM(precip_mm) as precip_total,
      COUNT(*) as reading_count
    FROM wx_readings
    WHERE source = 'weather_underground'
      AND station_id = $1
      AND timestamp BETWEEN $2 AND $3
    GROUP BY DATE(timestamp AT TIME ZONE 'America/Vancouver')
    ORDER BY date
  `, [stationId, startDate, endDate]);
}

module.exports = { fetchAllPWSCurrent, getLatestPWSReadings, getPWSHistory, getPWSLookback, STATIONS };
