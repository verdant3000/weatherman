import React from 'react';

const STATION_META = {
  'IBCSQUAM12':  { name: 'Garibaldi Highlands', elevation_m: 380 },
  'ISQUAM29':    { name: 'S2S Gondola Summit',  elevation_m: 885 },
  'ISQUAM21':    { name: 'Squamish North',       elevation_m: 60  },
  'ISQUAM23':    { name: 'Squamish',             elevation_m: 40  },
  'IBRITISH490': { name: 'Crumpit Woods',        elevation_m: 200 },
};

function fmtTemp(c, unit) {
  if (c == null) return '—';
  const val = unit === 'imperial' ? (c * 9/5 + 32).toFixed(1) : c.toFixed(1);
  return `${val}${unit === 'imperial' ? '°F' : '°C'}`;
}

function fmtElev(m, unit) {
  if (!m) return '?';
  return unit === 'imperial' ? `${Math.round(m * 3.28084).toLocaleString()}ft` : `${m}m`;
}

function timeSince(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function tempColor(c) {
  if (c == null) return 'var(--text-tertiary)';
  if (c > 15) return 'var(--orange)';
  if (c > 5) return 'var(--blue)';
  return '#6b99c4';
}

export default function StationGrid({ readings, hobolink, unit = 'metric' }) {
  const hasReadings = readings?.length > 0;

  return (
    <div className="station-grid">
      {hasReadings ? readings.map(r => {
        const meta = STATION_META[r.station_id] || {};
        return (
          <div key={r.station_id} className="station-card">
            <div className="station-id">{r.station_id}</div>
            <div className="station-name">{meta.name || r.station_id}</div>
            <div className="station-temp" style={{ color: tempColor(r.temp_c) }}>
              {fmtTemp(r.temp_c, unit)}
            </div>
            <div className="station-rh">
              {r.rh_pct != null ? `${Math.round(r.rh_pct)}% RH` : ''}
              {r.wind_speed_ms != null ? ` · ${r.wind_speed_ms.toFixed(1)} m/s` : ''}
            </div>
            <div className="station-elev">{fmtElev(meta.elevation_m, unit)} · {timeSince(r.latest_time)}</div>
          </div>
        );
      }) : Object.entries(STATION_META).map(([id, meta]) => (
        <div key={id} className="station-card station-stub">
          <div className="station-id">{id}</div>
          <div className="station-name">{meta.name}</div>
          <div className="station-temp" style={{ color: 'var(--text-tertiary)' }}>—</div>
          <div className="station-elev">{fmtElev(meta.elevation_m, unit)}</div>
          <div className="stub-label">needs WU_API_KEY</div>
        </div>
      ))}

      {/* HOBOlink stub */}
      <div className="station-card station-stub">
        <div className="station-id">HOBOLINK</div>
        <div className="station-name">Habrich Ridge (S2S Gondola)</div>
        <div className="station-temp" style={{ color: 'var(--text-tertiary)' }}>—</div>
        <div className="station-elev">{fmtElev(1550, unit)} · south-facing</div>
        <div className="stub-label">⏳ pending credentials</div>
        {hobolink && (
          <a href={hobolink.dashboard_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 6, fontFamily: 'DM Mono', fontSize: 10, color: 'var(--blue)' }}>
            Public dashboard ↗
          </a>
        )}
      </div>

      {/* BTSC historical */}
      <div className="station-card" style={{ borderColor: 'var(--border2)' }}>
        <div className="station-id">BTSC-VDV</div>
        <div className="station-name">Brohm Ridge Chalet</div>
        <div className="station-temp" style={{ color: 'var(--amber)', fontSize: 16, paddingTop: 4 }}>2yr baseline</div>
        <div className="station-elev">{fmtElev(1550, unit)} · Jan 2024–present</div>
        <a href="http://btsc.ca/NetCamImg/WCSnow.jpg" target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', marginTop: 6, fontFamily: 'DM Mono', fontSize: 10, color: 'var(--blue)' }}>
          Live webcam ↗
        </a>
      </div>
    </div>
  );
}
