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
    id: 'drivebc_garibaldi',
    name: 'Hwy 99 at Garibaldi (Rubble Creek)',
    url: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/4.html',
    elevation_m: 450,
    notes: 'Valley reference, Garibaldi trailhead'
  },
  {
    id: 's2s_gondola',
    name: 'S2S Gondola Summit',
    url: 'https://www.seatoskygondola.com/webcam/current.jpg',
    elevation_m: 885,
    notes: 'Summit lodge webcam'
  }
];

async function captureCamera(camera) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `${camera.id}_${dateStr}.jpg`;
  const filePath = path.join(SCREENSHOTS_DIR, filename);

  try {
    const response = await axios.get(camera.url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'BrooksWX/1.0 weather monitor' }
    });

    const buffer = Buffer.from(response.data);
    fs.writeFileSync(filePath, buffer);

    await run(`
      INSERT INTO screenshots (captured_at, camera_id, camera_name, file_path, file_size_bytes, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [now.toISOString(), camera.id, camera.name, filePath, buffer.length, camera.notes]);

    console.log(`[camera] Captured ${camera.name} → ${filename} (${buffer.length} bytes)`);
    return { success: true, camera: camera.id, file: filename, bytes: buffer.length };
  } catch (err) {
    console.error(`[camera] Failed ${camera.name}:`, err.message);
    return { success: false, camera: camera.id, error: err.message };
  }
}

async function captureAllCameras() {
  console.log(`[camera] Daily capture at ${new Date().toISOString()}`);
  const results = [];
  for (const camera of CAMERAS) {
    results.push(await captureCamera(camera));
    await new Promise(r => setTimeout(r, 1000));
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
