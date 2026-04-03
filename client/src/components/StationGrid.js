import React from 'react';

const STATION_META = {
  'IBCSQUAM12': { name: 'Garibaldi Highlands', elevation_m: 380 },
  'ISQUAM29':   { name: 'S2S Gondola Summit',  elevation_m: 885 },
  'ISQUAM21':   { name: 'Squamish North',       elevation_m: 60  },
  'ISQUAM23':   { name: 'Squamish',             elevation_m: 40  },
  'IBRITISH490':{ name: 'Crumpit Woods',        elevation_m: 200 },
};

function tempColor(t) {
  if (t === null || t === undefined) return 'var(--text-tertiary)';
  if (t > 15) return '#ff8c42';
  if (t > 5)  return '#4a9eff';
  if (t > 0)  return '#8bc4ff';
  return '#a0c4ff';
}

function timeSince(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

export default function StationGrid({ readings, hobolink }) {
  const hasReadings = readings && readings.length > 0;

  return (
    <div className="station-grid">
      {/* Live PWS stations */}
      {hasReadings ? (
        readings.map(r => {
          const meta = STATION_META[r.station_id] || {};
          return (
            <div key={r.station_id} className="station-card">
              <div className="station-id">{r.station_id}</div>
              <div className="station-name">{meta.name || r.station_id}</div>
              <div className="station-temp" style={{ color: tempColor(r.temp_c) }}>
                {r.temp_c != null ? `${r.temp_c.toFixed(1)}°C` : '—'}
              </div>
              <div className="station-rh">
                {r.rh_pct != null ? `${Math.round(r.rh_pct)}% RH` : ''}
                {r.wind_speed_ms != null ? ` · ${r.wind_speed_ms.toFixed(1)} m/s` : ''}
              </div>
              <div className="station-elev">
                {meta.elevation_m || '?'}m · {timeSince(r.latest_time)}
              </div>
            </div>
          );
        })
      ) : (
        // Placeholder cards when WU not configured
        Object.entries(STATION_META).map(([id, meta]) => (
          <div key={id} className="station-card station-stub">
            <div className="station-id">{id}</div>
            <div className="station-name">{meta.name}</div>
            <div className="station-temp" style={{ color: 'var(--text-tertiary)' }}>—°C</div>
            <div className="station-elev">{meta.elevation_m}m</div>
            <div className="stub-label">needs WU_API_KEY</div>
          </div>
        ))
      )}

      {/* HOBOlink stub card — Habrich Ridge */}
      <div className="station-card station-stub">
        <div className="station-id">HOBOLINK</div>
        <div className="station-name">Habrich Ridge (S2S Gondola)</div>
        <div className="station-temp" style={{ color: 'var(--text-tertiary)' }}>—°C</div>
        <div className="station-elev">1,550m · south-facing</div>
        <div className="stub-label">⏳ pending credentials</div>
        {hobolink && (
          <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            <a
              href={hobolink.dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--blue)' }}
            >
              View public dashboard ↗
            </a>
          </div>
        )}
      </div>

      {/* Brohm Ridge (BTSC) — historical sensor */}
      <div className="station-card" style={{ borderColor: 'var(--border2)' }}>
        <div className="station-id">BTSC-VDV</div>
        <div className="station-name">Brohm Ridge Chalet</div>
        <div className="station-temp" style={{ color: 'var(--accent)' }}>historical</div>
        <div className="station-rh">2yr baseline loaded</div>
        <div className="station-elev">
          1,550m · Jan 2024 – Apr 2026
        </div>
        <div style={{ marginTop: 8 }}>
          <a
            href="http://btsc.ca/NetCamImg/WCSnow.jpg"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}
          >
            webcam ↗
          </a>
        </div>
      </div>
    </div>
  );
}
