const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { query, queryOne, run, SCREENSHOTS_DIR } = require('./db');

const CAMERAS = [
  {
    id: 'btsc_brohm',
    name: 'Brohm Ridge — BTSC Chalet',
    url: 'http://btsc.ca/NetCamImg/WCSnow.jpg',
    elevation_m: 1550,
    notes: '11 stairs visible — 5+ covered = good snowpack'
  },
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
    url: 'https://www.whistlerblackcomb.com/weather/cams/7thheaven.jpg',
    elevation_m: 2284,
    notes: 'Blackcomb alpine — best snow coverage reference',
    burst: true  // needs burst capture to catch rotating cam cycle
  },
  {
    id: 'wb_roundhouse',
    name: 'WB Roundhouse Lodge',
    url: 'https://www.whistlerblackcomb.com/weather/cams/roundhouse.jpg',
    elevation_m: 1850,
    notes: 'Whistler mid-mountain'
  },
  {
    id: 'wb_whistler_peak',
    name: 'WB Whistler Peak',
    url: 'https://www.whistlerblackcomb.com/weather/cams/peak.jpg',
    elevation_m: 2182,
    notes: 'Whistler summit'
  }
];

// Known WB cam URLs from cache.snow.com (more reliable direct images)
const WB_CAM_URLS = [
  { id: 'wb_7th_heaven',    urls: ['https://cache.snow.com/Mtncams/7thheaven.jpg', 'https://www.whistlerblackcomb.com/weather/cams/7thheaven.jpg'] },
  { id: 'wb_roundhouse',    urls: ['https://cache.snow.com/Mtncams/roundhouse.jpg', 'https://www.whistlerblackcomb.com/weather/cams/roundhouse.jpg'] },
  { id: 'wb_whistler_peak', urls: ['https://cache.snow.com/Mtncams/whistlerpeak.jpg', 'https://www.whistlerblackcomb.com/weather/cams/peak.jpg'] },
];

async function tryFetchImage(urls) {
  for (const url of urls) {
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

async function captureCamera(camera, suffix = '') {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toISOString().replace(/:/g, '-').slice(0, 16);
  const filename = suffix
    ? `${camera.id}_${dateStr}_${suffix}.jpg`
    : `${camera.id}_${dateStr}_${timeStr}.jpg`;
  const filePath = path.join(SCREENSHOTS_DIR, filename);

  // Find alternate URLs for WB cams
  const wbCam = WB_CAM_URLS.find(w => w.id === camera.id);
  const urls = wbCam ? wbCam.urls : [camera.url];

  try {
    const result = await tryFetchImage(urls);
    if (!result) throw new Error('All URLs failed or returned empty images');

    fs.writeFileSync(filePath, result.buffer);

    await run(`
      INSERT INTO screenshots (captured_at, camera_id, camera_name, file_path, file_size_bytes, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [now.toISOString(), camera.id, camera.name, filePath, result.buffer.length, camera.notes]);

    console.log(`[camera] ✓ ${camera.name} → ${filename} (${result.buffer.length} bytes)`);
    return { success: true, camera: camera.id, file: filename, bytes: result.buffer.length };
  } catch (err) {
    console.error(`[camera] ✗ ${camera.name}: ${err.message}`);
    return { success: false, camera: camera.id, error: err.message };
  }
}

// Burst capture for cams on a rotation cycle (5 shots × 23s apart)
async function burstCapture(camera) {
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(await captureCamera(camera, `burst${i + 1}`));
    if (i < 4) await new Promise(r => setTimeout(r, 23000));
  }
  return results;
}

async function captureAllCameras() {
  console.log(`[camera] Capture session at ${new Date().toISOString()}`);
  const results = [];
  for (const camera of CAMERAS) {
    if (camera.burst) {
      const burst = await burstCapture(camera);
      results.push(...burst);
    } else {
      results.push(await captureCamera(camera));
      await new Promise(r => setTimeout(r, 2000));
    }
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
    SELECT * FROM screenshots
    WHERE camera_id = $1
    ORDER BY captured_at DESC
    LIMIT $2
  `, [cameraId, limit]);
}

async function getScreenshotCount(cameraId) {
  const row = await queryOne(`SELECT COUNT(*) as n FROM screenshots WHERE camera_id = $1`, [cameraId]);
  return parseInt(row?.n || 0);
}

async function getCamerasWithMeta() {
  const latest = await getAllLatestScreenshots();
  const latestByCamera = Object.fromEntries(latest.map(s => [s.camera_id, s]));
  return Promise.all(CAMERAS.map(async cam => ({
    ...cam,
    latest_screenshot: latestByCamera[cam.id] || null,
    screenshot_count: await getScreenshotCount(cam.id)
  })));
}

module.exports = {
  captureAllCameras, captureCamera,
  getAllLatestScreenshots, getScreenshotHistory,
  getScreenshotCount, getCamerasWithMeta,
  CAMERAS, SCREENSHOTS_DIR
};
