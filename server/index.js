require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { migrate, query } = require('./db');
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

// ─── CRONS ────────────────────────────────────────────────────────────────────

cron.schedule('0 */6 * * *', async () => {
  try { await fetchAllLocations(); } catch (e) { console.error('[cron] forecast:', e.message); }
}, { timezone: 'America/Vancouver' });

cron.schedule('5 * * * *', async () => {
  try { await fetchAllPWSCurrent(); } catch (e) {}
}, { timezone: 'America/Vancouver' });

// Cameras 3x daily — 9am, 1pm, 7pm PT
cron.schedule('0 9 * * *', async () => {
  console.log('[cron] Cameras 9am');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cam 9am:', e.message); }
}, { timezone: 'America/Vancouver' });

cron.schedule('0 13 * * *', async () => {
  console.log('[cron] Cameras 1pm');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cam 1pm:', e.message); }
}, { timezone: 'America/Vancouver' });

cron.schedule('0 19 * * *', async () => {
  console.log('[cron] Cameras 7pm');
  try { await captureAllCameras(); } catch (e) { console.error('[cron] cam 7pm:', e.message); }
}, { timezone: 'America/Vancouver' });

// Digest 7am PT
cron.schedule('0 7 * * *', async () => {
  try { await sendDailyDigest(); } catch (e) { console.error('[cron] digest:', e.message); }
}, { timezone: 'America/Vancouver' });

// FZL history refresh — every Sunday 6am (keeps 2026 current)
cron.schedule('0 6 * * 0', async () => {
  console.log('[cron] Refreshing FZL history...');
  try { await fetchAllHistoricalFZL(); } catch (e) { console.error('[cron] fzl:', e.message); }
}, { timezone: 'America/Vancouver' });

// ─── STARTUP ──────────────────────────────────────────────────────────────────

async function startup() {
  console.log('\n🏔️  Weatherman — Field Trip Production');
  console.log('   Brooks shoot: June 10–11, 2026 · Black Tusk');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL not set\n');
    process.exit(1);
  }

  await migrate();

  app.listen(PORT, () => console.log(`\n✅ Running on port ${PORT}\n`));

  // Background fetches after boot
  setTimeout(async () => {
    try { await fetchAllLocations(); console.log('[startup] Forecasts loaded'); }
    catch (e) { console.error('[startup] Forecast:', e.message); }

    try { await fetchAllPWSCurrent(); }
    catch (e) { console.log('[startup] PWS skipped'); }

    // Auto-fetch FZL history on first run
    try {
      const count = await query('SELECT COUNT(*) as n FROM historical_fzl');
      if (parseInt(count[0].n) === 0) {
        console.log('[startup] First run — fetching historical FZL (2022–2026)...');
        const results = await fetchAllHistoricalFZL();
        const total = results.reduce((a, r) => a + (r.days || 0), 0);
        console.log(`[startup] FZL loaded: ${total} days across ${results.length} years`);
      } else {
        console.log(`[startup] FZL already loaded: ${count[0].n} records`);
      }
    } catch (e) { console.error('[startup] FZL history:', e.message); }
  }, 3000);
}

startup().catch(err => { console.error('Startup failed:', err); process.exit(1); });
