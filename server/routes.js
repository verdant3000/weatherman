const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query, queryOne, SCREENSHOTS_DIR } = require('./db');
const { fetchAllLocations, getLatestForecasts, getShootWindowForecast, LOCATIONS } = require('./openMeteo');
const { fetchAllPWSCurrent, getLatestPWSReadings, getPWSHistory, STATIONS } = require('./weatherUnderground');
const { captureAllCameras, getCamerasWithMeta, getScreenshotHistory, CAMERAS } = require('./cameras');
const { getHOBOlinkStatus } = require('./hobolink');
const { sendDailyDigest } = require('./digest');
const { ingestBTSCcsv, getBTSCyearOverYear, getBTSCdataRange } = require('./btscUpload');

const normals = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'historical_normals.json'), 'utf8')
);

// Multer for CSV uploads — memory storage, 50MB max
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/status
router.get('/status', async (req, res) => {
  try {
    const shootDate = new Date('2026-06-10');
    const daysOut = Math.ceil((shootDate - new Date()) / 86400000);
    const totalScreenshots = await queryOne(`SELECT COUNT(*) as n FROM screenshots`);
    const totalReadings = await queryOne(`SELECT COUNT(*) as n FROM wx_readings`);
    const btscRange = await queryOne(`SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest, COUNT(*) as n FROM btsc_readings`);

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
      btsc_readings: parseInt(btscRange?.n || 0),
      btsc_range: btscRange,
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

// ── BTSC Station Data ─────────────────────────────────────────────────────────

// GET /api/btsc/year-over-year — daily highs/lows grouped by year
router.get('/btsc/year-over-year', async (req, res) => {
  try {
    const data = await getBTSCyearOverYear();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/btsc/range — data coverage info
router.get('/btsc/range', async (req, res) => {
  try {
    const range = await getBTSCdataRange();
    res.json(range[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/btsc/upload — drag-and-drop CSV ingestion
router.post('/btsc/upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const csvText = req.file.buffer.toString('utf8');
    const result = await ingestBTSCcsv(csvText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cameras ───────────────────────────────────────────────────────────────────

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

// ── Triggers ──────────────────────────────────────────────────────────────────

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

router.post('/trigger/capture', async (req, res) => {
  try {
    res.json({ results: await captureAllCameras() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger/digest', async (req, res) => {
  try {
    res.json(await sendDailyDigest());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/digest/log', async (req, res) => {
  try {
    const logs = await query(`SELECT * FROM digest_log ORDER BY sent_at DESC LIMIT 20`);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// ── Historical FZL ────────────────────────────────────────────────────────────
const { fetchAllHistoricalFZL, getHistoricalFZLbyYear, getMeltData, YEARS } = require('./historicalFreezeLevel');

router.get('/historical/fzl', async (req, res) => {
  try {
    res.json({ data: await getHistoricalFZLbyYear(), years: YEARS });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/historical/melt/:year', async (req, res) => {
  try {
    res.json({ data: await getMeltData(req.params.year), year: req.params.year });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/trigger/fzl-history', async (req, res) => {
  try {
    const results = await fetchAllHistoricalFZL();
    res.json({ results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Freeze Level History ───────────────────────────────────────────────────────
const { fetchAllHistoricalYears, getFreezeLevelYearOverYear, getFreezeLevelRange, ensureFreezeLevelTable } = require('./freezeLevelHistory');

router.get('/fzl/year-over-year', async (req, res) => {
  try {
    await ensureFreezeLevelTable();
    const data = await getFreezeLevelYearOverYear();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fzl/range', async (req, res) => {
  try {
    await ensureFreezeLevelTable();
    res.json({ range: await getFreezeLevelRange() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fzl/fetch', async (req, res) => {
  try {
    const results = await fetchAllHistoricalYears();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
