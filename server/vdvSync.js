/**
 * VDV Auto-sync — logs into vdv.bgcengineering.ca with public BTSC credentials
 * and downloads fresh CSV exports weekly
 * Credentials are publicly listed on btsc.ca/webcam-%26-weather-data
 */
const axios = require('axios');
const { run, query } = require('./db');

const VDV_BASE = 'https://vdv.bgcengineering.ca/vdv';
const VDV_USER = 'btsc';
const VDV_PASS = 'Squamish!';
const DASHBOARD_ID = '1423';

// Known sensor export URLs based on VDV API pattern
// Dashboard 1423 has sensors: AirTemp+RH, BP_kPa, Rain_mm_Tot
const SENSOR_EXPORTS = [
  {
    name: 'AirTemp_RH',
    description: 'Air temperature and relative humidity',
    params: { dashboard: DASHBOARD_ID, sensors: 'AirTemp,RH' }
  },
  {
    name: 'Rain_mm',
    description: 'Precipitation totals',
    params: { dashboard: DASHBOARD_ID, sensors: 'Rain_mm_Tot' }
  },
  {
    name: 'BP_kPa',
    description: 'Barometric pressure',
    params: { dashboard: DASHBOARD_ID, sensors: 'BP_kPa' }
  }
];

/**
 * Detect what sensor type a VDV CSV contains from its header
 */
function detectSensorType(headerLine) {
  const h = headerLine.toLowerCase();
  if (h.includes('airtemp') || h.includes('rh[') || h.includes('rh[%')) return 'temp_rh';
  if (h.includes('rain_mm') || h.includes('rain[mm')) return 'rain';
  if (h.includes('bp_kpa') || h.includes('bp[kpa')) return 'pressure';
  return 'unknown';
}

/**
 * Parse any VDV CSV and route to correct table based on sensor type
 */
async function ingestVDVcsv(csvText, filename = '') {
  const lines = csvText.split('\n');

  // Find header line
  let headerLine = '';
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Time,')) {
      headerLine = lines[i];
      dataStart = i + 1;
      break;
    }
  }

  if (!headerLine) return { success: false, error: 'No header line found in CSV' };

  const sensorType = detectSensorType(headerLine);
  const columns = headerLine.split(',').map(c => c.trim());

  let inserted = 0, skipped = 0;
  let minDate = null, maxDate = null;

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const timestamp = parts[0].trim();
    const dt = new Date(timestamp);
    if (isNaN(dt.getTime())) continue;

    const ts = dt.toISOString();
    if (!minDate || ts < minDate) minDate = ts;
    if (!maxDate || ts > maxDate) maxDate = ts;

    try {
      if (sensorType === 'temp_rh') {
        const temp = parseFloat(parts[1]);
        const rh = parts[2] ? parseFloat(parts[2]) : null;
        if (isNaN(temp)) continue;

        const r = await run(`
          INSERT INTO btsc_readings (timestamp, temp_c, rh_pct)
          VALUES ($1, $2, $3)
          ON CONFLICT (timestamp) DO UPDATE SET
            temp_c = EXCLUDED.temp_c,
            rh_pct = COALESCE(EXCLUDED.rh_pct, btsc_readings.rh_pct)
        `, [ts, temp, isNaN(rh) ? null : rh]);
        if (r.rowCount > 0) inserted++; else skipped++;

      } else if (sensorType === 'rain') {
        const rain = parseFloat(parts[1]);
        if (isNaN(rain)) continue;

        const r = await run(`
          INSERT INTO btsc_readings (timestamp, rain_mm)
          VALUES ($1, $2)
          ON CONFLICT (timestamp) DO UPDATE SET
            rain_mm = EXCLUDED.rain_mm
        `, [ts, rain]);
        if (r.rowCount > 0) inserted++; else skipped++;

      } else if (sensorType === 'pressure') {
        const bp = parseFloat(parts[1]);
        if (isNaN(bp)) continue;

        const r = await run(`
          INSERT INTO btsc_readings (timestamp, pressure_kpa)
          VALUES ($1, $2)
          ON CONFLICT (timestamp) DO UPDATE SET
            pressure_kpa = EXCLUDED.pressure_kpa
        `, [ts, bp]);
        if (r.rowCount > 0) inserted++; else skipped++;

      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
    }
  }

  return {
    success: true,
    sensor_type: sensorType,
    total: lines.length - dataStart,
    inserted,
    skipped,
    date_range: { from: minDate, to: maxDate }
  };
}

/**
 * Ingest multiple CSV files at once (for multi-sensor upload)
 */
async function ingestMultipleCSVs(csvFiles) {
  const results = [];
  for (const { text, filename } of csvFiles) {
    const r = await ingestVDVcsv(text, filename);
    results.push({ filename, ...r });
  }
  return results;
}

module.exports = { ingestVDVcsv, ingestMultipleCSVs, detectSensorType };
