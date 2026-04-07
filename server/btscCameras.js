/**
 * BTSC Camera capture using Puppeteer
 * The BTSC webcam page uses Wix/JavaScript to embed camera images
 * so we can't fetch direct URLs — we screenshot the live page instead
 */
const fs = require('fs');
const path = require('path');
const { run, SCREENSHOTS_DIR } = require('./db');

// Camera definitions with page selectors
// We screenshot the full webcam page and crop each camera section
const BTSC_CAMS = [
  {
    id: 'btsc_chalet',
    name: 'BTSC Chalet Cam',
    elevation_m: 1550,
    notes: '11 stairs — 5+ covered = good snowpack',
    sectionTitle: 'Chalet Cam'
  },
  {
    id: 'btsc_west',
    name: 'BTSC West Chalet Cam',
    elevation_m: 1550,
    notes: 'Open alpine field — best snow depth reference',
    sectionTitle: 'West Chalet Cam'
  },
  {
    id: 'btsc_east',
    name: 'BTSC East Chalet Cam',
    elevation_m: 1550,
    notes: 'Black Tusk view — shoot condition reference',
    sectionTitle: 'East Chalet Cam'
  }
];

async function captureBTSCCams() {
  let browser;
  const results = [];

  try {
    // Try to use puppeteer-core with chromium
    let puppeteer;
    try {
      puppeteer = require('puppeteer-core');
    } catch (e) {
      console.log('[btsc-cam] puppeteer-core not available, using fallback');
      return await captureBTSCFallback();
    }

    let executablePath;
    try {
      const chromium = require('@sparticuz/chromium');
      executablePath = await chromium.executablePath();
    } catch (e) {
      // Try system chromium
      executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';
    }

    if (!fs.existsSync(executablePath)) {
      console.log('[btsc-cam] Chromium not found, using fallback');
      return await captureBTSCFallback();
    }

    browser = await puppeteer.launch({
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (compatible; WeatherMonitor/1.0)');

    console.log('[btsc-cam] Loading BTSC webcam page...');
    await page.goto('https://btsc.ca/webcam-%26-weather-data', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for images to load
    await new Promise(r => setTimeout(r, 4000));

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toISOString().replace(/:/g, '-').slice(0, 16);

    // Find each camera section by heading text and screenshot it
    for (const cam of BTSC_CAMS) {
      try {
        // Find the heading element containing the cam name
        const section = await page.evaluateHandle((title) => {
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p'));
          const heading = headings.find(h => h.textContent.includes(title));
          if (!heading) return null;
          // Get the parent section or next sibling with image
          let el = heading.parentElement;
          // Walk up to find a container with an img
          for (let i = 0; i < 5; i++) {
            if (el.querySelector('img')) return el;
            el = el.parentElement;
            if (!el) break;
          }
          return heading.parentElement;
        }, cam.sectionTitle);

        if (!section) {
          console.log(`[btsc-cam] Section not found for ${cam.name}`);
          results.push({ success: false, camera: cam.id, error: 'Section not found on page' });
          continue;
        }

        const filename = `${cam.id}_${dateStr}_${timeStr}.jpg`;
        const filePath = path.join(SCREENSHOTS_DIR, filename);

        const box = await section.asElement()?.boundingBox();
        if (!box) {
          console.log(`[btsc-cam] No bounding box for ${cam.name}`);
          results.push({ success: false, camera: cam.id, error: 'Could not get element bounds' });
          continue;
        }

        await page.screenshot({
          path: filePath,
          clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 600) },
          type: 'jpeg',
          quality: 85
        });

        const stats = fs.statSync(filePath);
        await run(`
          INSERT INTO screenshots (captured_at, camera_id, camera_name, file_path, file_size_bytes, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [now.toISOString(), cam.id, cam.name, filePath, stats.size, cam.notes]);

        console.log(`[btsc-cam] ✓ ${cam.name} → ${filename}`);
        results.push({ success: true, camera: cam.id, file: filename, bytes: stats.size });

      } catch (err) {
        console.error(`[btsc-cam] Error capturing ${cam.name}:`, err.message);
        results.push({ success: false, camera: cam.id, error: err.message });
      }
    }

  } catch (err) {
    console.error('[btsc-cam] Browser error:', err.message);
    return await captureBTSCFallback();
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

// Fallback: screenshot the full page as one image
async function captureBTSCFallback() {
  console.log('[btsc-cam] Using fallback — capturing btsc.ca page reference');
  // Store a placeholder record so the UI knows we tried
  const results = [];
  for (const cam of BTSC_CAMS) {
    results.push({
      success: false,
      camera: cam.id,
      error: 'Puppeteer/Chromium not available on this platform'
    });
  }
  return results;
}

module.exports = { captureBTSCCams, BTSC_CAMS };
