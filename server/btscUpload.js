const { run, query } = require('./db');

/**
 * Parse VDV CSV export from btsc.ca / BGC Engineering
 * Format: header rows, then Time,HourlyTemp,RH,15minTemp
 */
function parseVDVcsv(csvText) {
  const lines = csvText.split('\n');

  // Find the header line (contains 'Time,')
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Time,')) {
      dataStart = i + 1;
      break;
    }
  }

  const readings = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 2) continue;

    const timestamp = parts[0].trim();
    const tempStr = parts[1].trim();
    const rhStr = parts[2]?.trim() || '';

    if (!timestamp || !tempStr) continue;

    // Parse timestamp: "2024-01-01 00:00:00"
    const dt = new Date(timestamp);
    if (isNaN(dt.getTime())) continue;

    const temp = parseFloat(tempStr);
    if (isNaN(temp)) continue;

    const rh = rhStr ? parseFloat(rhStr) : null;

    readings.push({
      timestamp: dt.toISOString(),
      temp_c: temp,
      rh_pct: isNaN(rh) ? null : rh
    });
  }

  return readings;
}

async function ingestBTSCcsv(csvText) {
  const readings = parseVDVcsv(csvText);
  if (readings.length === 0) {
    return { success: false, error: 'No valid readings found in CSV' };
  }

  let inserted = 0;
  let skipped = 0;
  let minDate = readings[0].timestamp;
  let maxDate = readings[0].timestamp;

  for (const r of readings) {
    if (r.timestamp < minDate) minDate = r.timestamp;
    if (r.timestamp > maxDate) maxDate = r.timestamp;

    try {
      const result = await run(`
        INSERT INTO btsc_readings (timestamp, temp_c, rh_pct)
        VALUES ($1, $2, $3)
        ON CONFLICT (timestamp) DO NOTHING
      `, [r.timestamp, r.temp_c, r.rh_pct]);

      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      // Table might not exist yet — will be created in migration
      skipped++;
    }
  }

  return {
    success: true,
    total: readings.length,
    inserted,
    skipped,
    date_range: { from: minDate, to: maxDate }
  };
}

async function getBTSCdailyStats(year) {
  return query(`
    SELECT
      DATE(timestamp AT TIME ZONE 'America/Vancouver') as date,
      EXTRACT(YEAR FROM timestamp AT TIME ZONE 'America/Vancouver') as year,
      EXTRACT(DOY FROM timestamp AT TIME ZONE 'America/Vancouver') as day_of_year,
      ROUND(MIN(temp_c)::numeric, 2) as temp_min,
      ROUND(MAX(temp_c)::numeric, 2) as temp_max,
      ROUND(AVG(temp_c)::numeric, 2) as temp_avg,
      COUNT(*) as reading_count
    FROM btsc_readings
    WHERE EXTRACT(YEAR FROM timestamp AT TIME ZONE 'America/Vancouver') = $1
    GROUP BY
      DATE(timestamp AT TIME ZONE 'America/Vancouver'),
      EXTRACT(YEAR FROM timestamp AT TIME ZONE 'America/Vancouver'),
      EXTRACT(DOY FROM timestamp AT TIME ZONE 'America/Vancouver')
    ORDER BY date
  `, [year]);
}

async function getBTSCyearOverYear() {
  // Get daily stats for all years combined — client groups by year
  return query(`
    SELECT
      DATE(timestamp AT TIME ZONE 'America/Vancouver') as date,
      EXTRACT(YEAR FROM timestamp AT TIME ZONE 'America/Vancouver') as year,
      EXTRACT(DOY FROM timestamp AT TIME ZONE 'America/Vancouver') as day_of_year,
      ROUND(MIN(temp_c)::numeric, 2) as temp_min,
      ROUND(MAX(temp_c)::numeric, 2) as temp_max,
      ROUND(AVG(temp_c)::numeric, 2) as temp_avg
    FROM btsc_readings
    GROUP BY
      DATE(timestamp AT TIME ZONE 'America/Vancouver'),
      EXTRACT(YEAR FROM timestamp AT TIME ZONE 'America/Vancouver'),
      EXTRACT(DOY FROM timestamp AT TIME ZONE 'America/Vancouver')
    ORDER BY year, day_of_year
  `);
}

async function getBTSCdataRange() {
  return query(`
    SELECT
      MIN(timestamp) as earliest,
      MAX(timestamp) as latest,
      COUNT(*) as total_readings,
      COUNT(DISTINCT DATE(timestamp AT TIME ZONE 'America/Vancouver')) as total_days
    FROM btsc_readings
  `);
}

module.exports = { ingestBTSCcsv, getBTSCdailyStats, getBTSCyearOverYear, getBTSCdataRange, parseVDVcsv };
