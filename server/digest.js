const nodemailer = require('nodemailer');
const { run, query } = require('./db');
const { getLatestForecasts, getShootWindowForecast } = require('./openMeteo');
const { getLatestPWSReadings } = require('./weatherUnderground');

function wxEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code <= 3) return '☁️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  return '🌦️';
}

function fzlStatus(fzl) {
  if (!fzl) return '?';
  if (fzl > 2200) return `✅ ${Math.round(fzl)}m — excellent`;
  if (fzl > 1800) return `🟡 ${Math.round(fzl)}m — good above 2000m`;
  if (fzl > 1400) return `🟠 ${Math.round(fzl)}m — marginal`;
  return `🔴 ${Math.round(fzl)}m — low snow line`;
}

async function sendDailyDigest() {
  const to = process.env.DIGEST_TO;
  const smtpUser = process.env.SMTP_USER;
  if (!to || !smtpUser) {
    console.log('[digest] Email not configured — skipping');
    return { skipped: true };
  }

  const daysOut = Math.ceil((new Date('2026-06-10') - new Date()) / 86400000);
  const [pwsReadings, allForecasts, shootForecast] = await Promise.all([
    getLatestPWSReadings(),
    getLatestForecasts(),
    getShootWindowForecast()
  ]);

  const brohmForecast = allForecasts.filter(f => f.location_name === 'Brohm Ridge').slice(0, 7);

  const subject = `Brooks WX | ${daysOut}d out | ${new Date().toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,sans-serif;color:#1a1a1a;max-width:620px;margin:0 auto;padding:20px;background:#f5f5f5}
  .card{background:white;border-radius:8px;padding:20px 24px;margin-bottom:16px;border:1px solid #e0e0e0}
  .header{background:#0d0f11;color:white;border-radius:8px;padding:20px 24px;margin-bottom:16px}
  .days{font-size:52px;font-weight:300;color:#f0a500;font-family:monospace;line-height:1}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td,th{padding:7px 10px;text-align:left;border-bottom:1px solid #f0f0f0}
  th{font-size:11px;font-weight:600;color:#999;text-transform:uppercase}
  .good{color:#16a34a}.warn{color:#d97706}.bad{color:#dc2626}
  .shoot-row{background:#fffbeb}
  .footer{text-align:center;font-size:11px;color:#999;padding:10px}
</style></head><body>
<div class="header">
  <div class="days">${daysOut}</div>
  <div style="font-size:18px;margin:4px 0">days until Brooks shoot</div>
  <div style="font-size:13px;opacity:.6">June 10–11, 2026 · Black Tusk / Garibaldi · ${new Date().toLocaleDateString('en-CA', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
</div>

${pwsReadings.length > 0 ? `
<div class="card">
  <h2>📡 Current conditions</h2>
  <table>
    <tr><th>Station</th><th>Temp</th><th>RH</th><th>Elev</th></tr>
    ${pwsReadings.map(r => `<tr><td>${r.station_id}</td><td>${r.temp_c?.toFixed(1) ?? '--'}°C</td><td>${r.rh_pct?.toFixed(0) ?? '--'}%</td><td>${r.elevation_m}m</td></tr>`).join('')}
  </table>
</div>` : ''}

<div class="card">
  <h2>🏔️ 7-day forecast — Brohm Ridge 1,550m</h2>
  <table>
    <tr><th>Date</th><th>Wx</th><th>High</th><th>Low</th><th>Precip</th><th>FZL</th></tr>
    ${brohmForecast.map(f => {
      const isShoot = f.forecast_date === '2026-06-10' || f.forecast_date === '2026-06-11';
      const fzlClass = f.freezing_level_m > 2000 ? 'good' : f.freezing_level_m > 1600 ? 'warn' : 'bad';
      return `<tr class="${isShoot ? 'shoot-row' : ''}">
        <td>${isShoot ? '⭐ ' : ''}${new Date(f.forecast_date + 'T12:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'})}</td>
        <td>${wxEmoji(f.weathercode)}</td>
        <td>${f.temp_max_c?.toFixed(1)}°C</td>
        <td>${f.temp_min_c?.toFixed(1)}°C</td>
        <td>${f.precipitation_mm?.toFixed(1)}mm</td>
        <td class="${fzlClass}">${f.freezing_level_m ? Math.round(f.freezing_level_m)+'m' : '?'}</td>
      </tr>`;
    }).join('')}
  </table>
</div>

${shootForecast.length > 0 ? `
<div class="card">
  <h2>🎯 Shoot window — June 10–11</h2>
  <table>
    <tr><th>Location</th><th>Date</th><th>High/Low</th><th>FZL</th></tr>
    ${shootForecast.map(f => `
      <tr>
        <td>${f.location_name}</td>
        <td>${f.forecast_date}</td>
        <td>${f.temp_max_c?.toFixed(1)}° / ${f.temp_min_c?.toFixed(1)}°C</td>
        <td>${fzlStatus(f.freezing_level_m)}</td>
      </tr>`).join('')}
  </table>
</div>` : `<div class="card"><h2>🎯 Shoot window</h2><p style="color:#888;font-size:13px">June 10–11 not yet in 16-day window — activates around May 25</p></div>`}

<div class="footer">Brooks WX Monitor · Field Trip Production · <a href="${process.env.APP_URL || '#'}">Open dashboard</a></div>
</body></html>`;

  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587, secure: false,
      auth: { user: smtpUser, pass: process.env.SMTP_PASS }
    });

    const info = await transporter.sendMail({ from: `"Brooks WX" <${smtpUser}>`, to, subject, html });

    await run(`INSERT INTO digest_log (sent_at, recipient, subject, status) VALUES ($1,$2,$3,'sent')`,
      [new Date().toISOString(), to, subject]);

    console.log(`[digest] Sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    await run(`INSERT INTO digest_log (sent_at, recipient, subject, status, error) VALUES ($1,$2,$3,'failed',$4)`,
      [new Date().toISOString(), to, subject, err.message]);
    return { success: false, error: err.message };
  }
}

module.exports = { sendDailyDigest };
