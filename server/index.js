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
const { fetchAllHistoricalFZL } = require('./historicalFreezeLevel');

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

// ─── CRON JOBS ────────────────────────────────────────────────────────────────

// Forecast every 6h
cron.schedule('0 */6 * * *', async () => {
  try { await fetchAllLocations(); } catch (e) { console.error('[cron] forecast:', e.message); }
}, { timezone: 'America/Vancouver' });

// PWS hourly
cron.schedule('5 * * * *', async () => {
  try { await fetchAllPWSCurrent(); } catch (e) { console.error('[cron] pws:', e.message); }
}, { timezone: 'America/Vancouver' });

// Camera 3x daily — 9am, 1pm, 7pm PT
cron.schedule('0 9 * * *', async () => {
  console.log('[cron] Cameras 9am PT');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cameras 9am:', e.message); }
}, { timezone: 'America/Vancouver' });

cron.schedule('0 13 * * *', async () => {
  console.log('[cron] Cameras 1pm PT');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cameras 1pm:', e.message); }
}, { timezone: 'America/Vancouver' });

cron.schedule('0 19 * * *', async () => {
  console.log('[cron] Cameras 7pm PT');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cameras 7pm:', e.message); }
}, { timezone: 'America/Vancouver' });

// Email digest 7am PT
cron.schedule('0 7 * * *', async () => {
  try { await sendDailyDigest(); } catch (e) { console.error('[cron] digest:', e.message); }
}, { timezone: 'America/Vancouver' });

// Historical FZL refresh — every Sunday 6am PT (keeps 2026 current)
cron.schedule('0 6 * * 0', async () => {
  console.log('[cron] Refreshing historical FZL data...');
  try { await fetchAllHistoricalFZL(); } catch (e) { console.error('[cron] fzl:', e.message); }
}, { timezone: 'America/Vancouver' });

// ─── STARTUP ──────────────────────────────────────────────────────────────────

async function startup() {
  console.log('\n🏔️  Weatherman — Field Trip Production');
  console.log('   Brooks shoot: June 10–11, 2026 · Black Tusk / Garibaldi');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL not set\n');
    process.exit(1);
  }

  await migrate();

  // Listen first — healthcheck needs to pass
  app.listen(PORT, () => {
    console.log(`\n✅ Running on port ${PORT}\n`);
  });

  // Background data fetches
  setTimeout(async () => {
    try { await fetchAllLocations(); console.log('[startup] Forecasts loaded'); }
    catch (e) { console.error('[startup] Forecast failed:', e.message); }

    try { await fetchAllPWSCurrent(); }
    catch (e) { console.log('[startup] PWS skipped'); }

    // Fetch historical FZL if table is empty
    try {
      const { query } = require('./db');
      const count = await query('SELECT COUNT(*) as n FROM historical_fzl');
      if (parseInt(count[0].n) === 0) {
        console.log('[startup] Fetching historical FZL data (first run)...');
        await fetchAllHistoricalFZL();
        console.log('[startup] Historical FZL loaded');
      }
    } catch (e) { console.error('[startup] Historical FZL failed:', e.message); }
  }, 4000);
}

startup().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
