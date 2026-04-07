require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { migrate } = require('./db');
const routes = require('./routes');
const { fetchAllLocations } = require('./openMeteo');
const { fetchAllPWSCurrent } = require('./weatherUnderground');
const { captureAllCameras } = require('./cameras');
const { sendDailyDigest } = require('./digest');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// ─── CRON JOBS ───────────────────────────────────────────────────────────────

// Forecast every 6h
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Fetching forecasts...');
  try { await fetchAllLocations(); } catch (e) { console.error('[cron] forecast:', e.message); }
}, { timezone: 'America/Vancouver' });

// PWS readings every hour
cron.schedule('5 * * * *', async () => {
  console.log('[cron] Fetching PWS...');
  try { await fetchAllPWSCurrent(); } catch (e) { console.error('[cron] pws:', e.message); }
}, { timezone: 'America/Vancouver' });

// Camera capture daily 9am PT (16:00 UTC)
cron.schedule(process.env.CAMERA_CRON || '0 16 * * *', async () => {
  console.log('[cron] Capturing cameras...');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cameras:', e.message); }
}, { timezone: 'America/Vancouver' });

// Email digest 7am PT
cron.schedule('0 14 * * *', async () => {
  console.log('[cron] Sending digest...');
  try { await sendDailyDigest(); } catch (e) { console.error('[cron] digest:', e.message); }
}, { timezone: 'America/Vancouver' });

// ─── STARTUP ─────────────────────────────────────────────────────────────────

async function startup() {
  console.log('\n🏔️  Brooks WX Monitor (Postgres edition)');
  console.log('   Shoot: June 10–11, 2026 · Black Tusk / Garibaldi');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL not set — add Railway Postgres to this service\n');
    process.exit(1);
  }

  await migrate();

  app.listen(PORT, () => { console.log(`\n✅ Running on port ${PORT}`); });

  setTimeout(async () => {

  // Initial fetch on startup
  try {
    await fetchAllLocations();
    console.log('[startup] Initial forecast loaded');
  } catch (e) {
    console.error('[startup] Forecast fetch failed:', e.message);
  }

  try {
    await fetchAllPWSCurrent();
  } catch (e) {
    console.log('[startup] PWS skipped (check WU_API_KEY)');
  }

  app.listen(PORT, () => {
    console.log(`\n✅ Running on port ${PORT}`);
    console.log(`   http://localhost:${PORT}\n`);
  });
}

startup().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
