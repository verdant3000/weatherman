const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query, queryOne, SCREENSHOTS_DIR } = require('./db');
const { fetchAllLocations, getLatestForecasts, getShootWindowForecast, LOCATIONS } = require('./openMeteo');
const { fetchAllPWSCurrent, getLatestPWSReadings, getPWSHistory, getPWSLookback, STATIONS } = require('./weatherUnderground');
const { captureAllCameras, getCamerasWithMeta, getScreenshotHistory, CAMERAS } = require('./cameras');
const { getHOBOlinkStatus } = require('./hobolink');
const { sendDailyDigest } = require('./digest');

const normals = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'historical_normals.json'), 'utf8')
);

// GET /api/status
router.get('/status', async (req, res) => {
  try {
    const shootDate = new Date('2026-06-10');
    const daysOut = Math.ceil((shootDate - new Date()) / 86400000);
    const totalScreenshots = await queryOne(`SELECT COUNT(*) as n FROM screenshots`);
    const totalReadings = await queryOne(`SELECT COUNT(*) as n FROM wx_readings`);

    res.json({
      app: 'Brooks WX Monitor',
      shoot_date: '2026-06-10',
      days_out: daysOut,
      uptime_s: Math.floor(process.uptime()),
      hobolink: getHOBOlinkStatus(),
      wu_configured: !!(process.env.WU_API_KEY && process.env.WU_API_KEY !== 'your_wu_api_key_here'),
      email_configured: !!(process.env.SMTP_USER && process.env.DIGEST_TO),
      total_screenshots: parseInt(totalScreenshots?.n || 0),
      total_readings: parseInt(totalReadings?.n || 0),
      station_count: STATIONS.length,
      camera_count: CAMERAS.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/forecasts
router.get('/forecasts', async (req, res) => {
  try {
    const forecasts = await getLatestForecasts();
    const grouped = {};
    for (const f of forecasts) {
      if (!grouped[f.location_name]) grouped[f.location_name] = [];
      grouped[f.location_name].push(f);
    }
    res.json({ forecasts: grouped, locations: LOCATIONS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/forecasts/shoot
router.get('/forecasts/shoot', async (req, res) => {
  try {
    res.json({ shoot_window: await getShootWindowForecast() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/readings/current
router.get('/readings/current', async (req, res) => {
  try {
    const pws = await getLatestPWSReadings();
    res.json({ pws_readings: pws, stations: STATIONS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/readings/history/:stationId
router.get('/readings/history/:stationId', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30');
    const history = await getPWSHistory(req.params.stationId, days);
    res.json({ station_id: req.params.stationId, days, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/readings/lookback/:stationId?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/readings/lookback/:stationId', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });
    const history = await getPWSLookback(req.params.stationId, start, end);
    res.json({ station_id: req.params.stationId, start, end, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/normals
router.get('/normals', (req, res) => res.json(normals));

// GET /api/normals/june
router.get('/normals/june', (req, res) => {
  res.json({
    station: normals.station,
    elevation_m: normals.elevation_m,
    years: normals.years_in_june,
    by_day: normals.june_normals
  });
});

// GET /api/cameras
router.get('/cameras', async (req, res) => {
  try {
    res.json({ cameras: await getCamerasWithMeta() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cameras/:cameraId/screenshots
router.get('/cameras/:cameraId/screenshots', async (req, res) => {
  try {
    const history = await getScreenshotHistory(req.params.cameraId, 90);
    res.json({ camera_id: req.params.cameraId, screenshots: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cameras/:cameraId/image/latest
router.get('/cameras/:cameraId/image/latest', async (req, res) => {
  try {
    const latest = await queryOne(`
      SELECT file_path FROM screenshots
      WHERE camera_id = $1
      ORDER BY captured_at DESC LIMIT 1
    `, [req.params.cameraId]);

    if (!latest || !fs.existsSync(latest.file_path)) {
      return res.status(404).json({ error: 'No screenshot available' });
    }
    res.sendFile(latest.file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cameras/:cameraId/image/:date
router.get('/cameras/:cameraId/image/:date', async (req, res) => {
  try {
    const screenshot = await queryOne(`
      SELECT file_path FROM screenshots
      WHERE camera_id = $1 AND DATE(captured_at AT TIME ZONE 'America/Vancouver') = $2
      ORDER BY captured_at DESC LIMIT 1
    `, [req.params.cameraId, req.params.date]);

    if (!screenshot || !fs.existsSync(screenshot.file_path)) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }
    res.sendFile(screenshot.file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — aggregate stats for lookbacks
router.get('/stats/freezelevel', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30');
    const rows = await query(`
      SELECT
        forecast_date,
        location_name,
        freezing_level_m,
        temp_max_c,
        temp_min_c,
        precipitation_mm,
        snowfall_cm,
        weathercode
      FROM open_meteo_forecasts
      WHERE forecast_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        AND forecast_date <= CURRENT_DATE + INTERVAL '16 days'
      ORDER BY location_name, forecast_date
    `, [days]);
    res.json({ rows, days_back: days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trigger/fetch
router.post('/trigger/fetch', async (req, res) => {
  try {
    const [meteo, pws] = await Promise.allSettled([fetchAllLocations(), fetchAllPWSCurrent()]);
    res.json({
      open_meteo: meteo.status === 'fulfilled' ? meteo.value : { error: meteo.reason?.message },
      weather_underground: pws.status === 'fulfilled' ? pws.value : { error: pws.reason?.message }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trigger/capture
router.post('/trigger/capture', async (req, res) => {
  try {
    res.json({ results: await captureAllCameras() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trigger/digest
router.post('/trigger/digest', async (req, res) => {
  try {
    res.json(await sendDailyDigest());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digest/log
router.get('/digest/log', async (req, res) => {
  try {
    const logs = await query(`SELECT * FROM digest_log ORDER BY sent_at DESC LIMIT 20`);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
