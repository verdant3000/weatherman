const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query, queryOne, SCREENSHOTS_DIR } = require('./db');
const { fetchAllLocations, getLatestForecasts, getShootWindowForecast, LOCATIONS } = require('./openMeteo');
const { fetchAllPWSCurrent, getLatestPWSReadings, STATIONS } = require('./weatherUnderground');
const { captureAllCameras, getCamerasWithMeta, getScreenshotHistory, CAMERAS } = require('./cameras');
const { getHOBOlinkStatus } = require('./hobolink');
const { sendDailyDigest } = require('./digest');
const { ingestVDVcsv, ingestMultipleCSVs } = require('./vdvSync');
const { getBTSCyearOverYear, getBTSCdataRange } = require('./btscUpload');
const { fetchAllHistoricalFZL, getHistoricalFZLbyYear, getMeltData, YEARS } = require('./historicalFreezeLevel');

const normals = JSON.parse(fs.readFileSync(path.join(__dirname, 'historical_normals.json'), 'utf8'));

// Multer — memory, 50MB, accept multiple files
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Status ────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const shootDate = new Date('2026-06-10');
    const daysOut = Math.ceil((shootDate - new Date()) / 86400000);
    const totalScreenshots = await queryOne(`SELECT COUNT(*) as n FROM screenshots`);
    const btscRange = await queryOne(`SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest, COUNT(*) as n FROM btsc_readings`);
    const fzlCount = await queryOne(`SELECT COUNT(*) as n FROM historical_fzl`);

    res.json({
      app: 'Weatherman',
      shoot_date: '2026-06-10',
      days_out: daysOut,
      uptime_s: Math.floor(process.uptime()),
      hobolink: getHOBOlinkStatus(),
      wu_configured: !!(process.env.WU_API_KEY),
      email_configured: !!(process.env.SMTP_USER && process.env.DIGEST_TO),
      total_screenshots: parseInt(totalScreenshots?.n || 0),
      btsc_readings: parseInt(btscRange?.n || 0),
      btsc_range: btscRange,
      fzl_records: parseInt(fzlCount?.n || 0),
      station_count: STATIONS.length,
      camera_count: CAMERAS.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Forecasts ─────────────────────────────────────────────────────────────────
router.get('/forecasts', async (req, res) => {
  try {
    const forecasts = await getLatestForecasts();
    const grouped = {};
    for (const f of forecasts) {
      if (!grouped[f.location_name]) grouped[f.location_name] = [];
      grouped[f.location_name].push(f);
    }
    res.json({ forecasts: grouped, locations: LOCATIONS });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Normals ───────────────────────────────────────────────────────────────────
router.get('/normals', (req, res) => res.json(normals));

// ── Readings ──────────────────────────────────────────────────────────────────
router.get('/readings/current', async (req, res) => {
  try {
    const pws = await getLatestPWSReadings();
    res.json({ pws_readings: pws, stations: STATIONS });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BTSC ──────────────────────────────────────────────────────────────────────
router.get('/btsc/year-over-year', async (req, res) => {
  try { res.json({ data: await getBTSCyearOverYear() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/btsc/range', async (req, res) => {
  try { res.json((await getBTSCdataRange())[0] || {}); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/btsc/upload — accepts multiple CSV files
router.post('/btsc/upload', upload.array('csv', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
    const csvFiles = req.files.map(f => ({ text: f.buffer.toString('utf8'), filename: f.originalname }));
    const results = await ingestMultipleCSVs(csvFiles);
    const totalInserted = results.reduce((a, r) => a + (r.inserted || 0), 0);
    const totalSkipped = results.reduce((a, r) => a + (r.skipped || 0), 0);
    res.json({ success: true, files: results, total_inserted: totalInserted, total_skipped: totalSkipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Historical FZL ────────────────────────────────────────────────────────────
router.get('/historical/fzl', async (req, res) => {
  try { res.json({ data: await getHistoricalFZLbyYear(), years: YEARS }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/historical/melt/:year', async (req, res) => {
  try { res.json({ data: await getMeltData(req.params.year), year: req.params.year }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Cameras ───────────────────────────────────────────────────────────────────
router.get('/cameras', async (req, res) => {
  try { res.json({ cameras: await getCamerasWithMeta() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/cameras/:cameraId/image/latest', async (req, res) => {
  try {
    const latest = await queryOne(`
      SELECT file_path FROM screenshots
      WHERE camera_id = $1 ORDER BY captured_at DESC LIMIT 1
    `, [req.params.cameraId]);
    if (!latest || !fs.existsSync(latest.file_path)) {
      return res.status(404).json({ error: 'No screenshot available' });
    }
    res.sendFile(latest.file_path);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Triggers ──────────────────────────────────────────────────────────────────
router.post('/trigger/fetch', async (req, res) => {
  try {
    await fetchAllLocations();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/trigger/capture', async (req, res) => {
  try { res.json({ results: await captureAllCameras() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/trigger/fzl-history', async (req, res) => {
  try { res.json({ results: await fetchAllHistoricalFZL() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/trigger/digest', async (req, res) => {
  try { res.json(await sendDailyDigest()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
