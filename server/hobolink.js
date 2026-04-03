/**
 * HOBOlink / LI-COR Cloud integration
 * Sea to Sky Gondola — Habrich Ridge Exit Gully (1550m)
 *
 * STATUS: Stubbed — awaiting credentials from Sea to Sky Gondola
 *
 * TO ACTIVATE:
 * 1. Email Sea to Sky Gondola (info@seatoskygondola.com) requesting
 *    HOBOlink API token for production weather monitoring partnership
 * 2. Set HOBOLINK_TOKEN and HOBOLINK_LOGGER_ID in .env
 * 3. Uncomment the live fetch below
 *
 * Dashboard (public): https://www.licor.cloud/dashboards/public/1cbe7853-62cd-4bf0-b844-11c12d633446/true
 */

const axios = require('axios');
const { db } = require('./db');

const HOBOLINK_API = 'https://webservice.hobolink.com/ws';
const STATION_INFO = {
  name: 'Habrich Ridge Exit Gully',
  elevation_m: 1550,
  lat: 49.6423,
  lon: -123.1497,
  description: 'Sea to Sky Gondola backcountry station'
};

async function fetchHOBOlinkData() {
  const token = process.env.HOBOLINK_TOKEN;
  const loggerId = process.env.HOBOLINK_LOGGER_ID;

  if (!token || token === 'stub_pending_credentials') {
    console.log('[hobolink] Credentials not configured — returning stub data');
    return {
      status: 'stub',
      message: 'HOBOlink credentials pending — contact Sea to Sky Gondola',
      station: STATION_INFO,
      data: null
    };
  }

  // LIVE IMPLEMENTATION (activate once credentials obtained):
  /*
  try {
    const authResponse = await axios.post(`${HOBOLINK_API}/auth/token`, {
      grant_type: 'password',
      username: process.env.HOBOLINK_USER,
      password: process.env.HOBOLINK_PASS,
      client_id: process.env.HOBOLINK_CLIENT_ID,
      client_secret: process.env.HOBOLINK_CLIENT_SECRET
    });
    const accessToken = authResponse.data.access_token;

    const dataResponse = await axios.get(`${HOBOLINK_API}/data/custom/json`, {
      params: {
        query: loggerId,
        authentication: accessToken,
        start_date_time: new Date(Date.now() - 86400000).toISOString()
      }
    });

    const obs = dataResponse.data?.observation_list || [];
    // Store in wx_readings
    const insert = db.prepare(`...`);
    // ... parse and store

    return { status: 'live', station: STATION_INFO, readings: obs.length };
  } catch (err) {
    console.error('[hobolink] API error:', err.message);
    throw err;
  }
  */

  return { status: 'stub', station: STATION_INFO };
}

function getHOBOlinkStatus() {
  const token = process.env.HOBOLINK_TOKEN;
  return {
    configured: token && token !== 'stub_pending_credentials',
    station: STATION_INFO,
    dashboard_url: 'https://www.licor.cloud/dashboards/public/1cbe7853-62cd-4bf0-b844-11c12d633446/true',
    activation_steps: [
      'Email Sea to Sky Gondola requesting HOBOlink API token',
      'Set HOBOLINK_TOKEN and HOBOLINK_LOGGER_ID in Railway env vars',
      'Redeploy — live data will activate automatically'
    ]
  };
}

module.exports = { fetchHOBOlinkData, getHOBOlinkStatus, STATION_INFO };
