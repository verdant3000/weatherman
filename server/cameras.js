const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { query, queryOne, run, SCREENSHOTS_DIR } = require('./db');

// Non-BTSC cameras (direct image URLs)
const EXTERNAL_CAMERAS = [
  {
    id: 's2s_gondola',
    name: 'S2S Gondola Summit',
    url: 'https://www.seatoskygondola.com/webcam/current.jpg',
    elevation_m: 885,
    notes: 'Summit lodge webcam'
  },
  {
    id: 'wb_7th_heaven',
    name: 'WB 7th Heaven',
    elevation_m: 2284,
    notes: 'Blackcomb alpine — best snow coverage reference',
    urls: ['https://cache.snow.com/Mtncams/7thheaven.jpg']
  },
  {
    id: 'wb_roundhouse',
    name: 'WB Roundhouse Lodge',
    elevation_m: 1850,
    notes: 'Whistler mid-mountain',
    urls: ['https://cache.snow.com/Mtncams/roundhouse.jpg']
  },
  {
    id: 'wb_whistler_peak',
    name: 'WB Whistler Peak',
    elevation_m: 2182,
    notes: 'Whistler summit',
    urls: ['https://cache.snow.com/Mtncams/whistlerpeak.jpg']
  }
];

// BTSC cameras (Puppeteer page screenshot)
const BTSC_CAMERA_IDS = ['btsc_chalet', 'btsc_west', 'btsc_east'];
const BTSC_CAMERA_META = {
  btsc_chalet: { name: 'BTSC Chalet Cam', elevation_m: 1550, notes: '11 stairs — 5+ covered = good snowpack' },
  btsc_west:   { name: 'BTSC West Chalet Cam', elevation_m: 1550, notes: 'Open alpine field — best snow depth reference' },
  btsc_east:   { name: 'BTSC East Chalet Cam', elevation_m: 1550, notes: 'Black Tusk view — shoot condition reference' },
};

// All camera IDs for the dashboard
const ALL_CAMERA_IDS = [...BTSC_CAMERA_IDS, ...EXTERNAL_CAMERAS.map(c => c.id)];

async function tryFetchImage(urls) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  for (const url of urlList) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WeatherMonitor/1.0)',
          'Referer': 'https://www.whistlerblackcomb.com/'
        }
      });
      if (response.data && response.data.byteLength > 5000) {
        return { buffer: Buffer.from(response.data), url };
      }
    } catch (err) {
      console.log(`[camera] URL failed ${url}: ${err.message}`);
    }
  }
  return null;
}

async function captureExternalCamera(camera) {
  const now = new Date();
  const timeStr = now.toISOString().replace(/:/g, '-').slice(0, 16);
  const filename = `${camera.id}_${timeStr}.jpg`;
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  const urls = camera.urls || [camera.url];

  try {
    const result = await tryFetchImage(urls);
    if (!result) throw new Error('All URLs failed or returned empty images');

    fs.writeFileSync(filePath, result.buffer);
    await run(`
      INSERT INTO screenshots (captured_at, camera_id, camera_name, file_path, file_size_bytes, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [now.toISOString(), camera.id, camera.name, filePath, result.buffer.length, camera.notes]);

    console.log(`[camera] ✓ ${camera.name} (${result.buffer.length} bytes)`);
    return { success: true, camera: camera.id, bytes: result.buffer.length };
  } catch (err) {
    console.error(`[camera] ✗ ${camera.name}: ${err.message}`);
    return { success: false, camera: camera.id, error: err.message };
  }
}

async function captureAllCameras() {
  console.log(`[camera] Capture session at ${new Date().toISOString()}`);
  const results = [];

  // Capture BTSC cams via Puppeteer
  try {
    const { captureBTSCCams } = require('./btscCameras');
    const btscResults = await captureBTSCCams();
    results.push(...btscResults);
  } catch (err) {
    console.error('[camera] BTSC capture error:', err.message);
    for (const id of BTSC_CAMERA_IDS) {
      results.push({ success: false, camera: id, error: err.message });
    }
  }

  // Capture external cams
  for (const camera of EXTERNAL_CAMERAS) {
    results.push(await captureExternalCamera(camera));
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

async function getAllLatestScreenshots() {
  return query(`
    SELECT DISTINCT ON (camera_id)
      id, captured_at, camera_id, camera_name, file_path, file_size_bytes, notes
    FROM screenshots
    ORDER BY camera_id, captured_at DESC
  `);
}

async function getScreenshotHistory(cameraId, limit = 90) {
  return query(`
    SELECT * FROM screenshots WHERE camera_id = $1
    ORDER BY captured_at DESC LIMIT $2
  `, [cameraId, limit]);
}

async function getScreenshotCount(cameraId) {
  const row = await queryOne(`SELECT COUNT(*) as n FROM screenshots WHERE camera_id = $1`, [cameraId]);
  return parseInt(row?.n || 0);
}

async function getCamerasWithMeta() {
  const latest = await getAllLatestScreenshots();
  const latestByCamera = Object.fromEntries(latest.map(s => [s.camera_id, s]));

  const allCams = [
    ...Object.entries(BTSC_CAMERA_META).map(([id, meta]) => ({ id, ...meta })),
    ...EXTERNAL_CAMERAS
  ];

  return Promise.all(allCams.map(async cam => ({
    ...cam,
    latest_screenshot: latestByCamera[cam.id] || null,
    screenshot_count: await getScreenshotCount(cam.id)
  })));
}

const CAMERAS = [
  ...Object.entries(BTSC_CAMERA_META).map(([id, meta]) => ({ id, ...meta })),
  ...EXTERNAL_CAMERAS
];

module.exports = {
  captureAllCameras, captureExternalCamera,
  getAllLatestScreenshots, getScreenshotHistory,
  getScreenshotCount, getCamerasWithMeta,
  CAMERAS, SCREENSHOTS_DIR
};
