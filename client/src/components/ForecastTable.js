import React, { useState } from 'react';

const WX_CODES = {
  0: '☀️ Clear', 1: '🌤 Mostly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
  45: '🌫 Fog', 51: '🌦 Drizzle', 61: '🌧 Rain', 63: '🌧 Rain', 65: '🌧 Heavy rain',
  71: '❄️ Snow', 73: '❄️ Snow', 75: '❄️ Heavy snow', 77: '🌨 Grains',
  80: '🌦 Showers', 81: '🌦 Showers', 82: '🌧 Heavy showers',
  85: '🌨 Snow showers', 95: '⛈ Thunderstorm',
};

function wxDesc(code) { return WX_CODES[code] || `Code ${code}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTemp(c, unit) {
  if (c == null) return '—';
  return unit === 'imperial' ? `${(c * 9/5 + 32).toFixed(0)}°F` : `${c.toFixed(1)}°C`;
}
function fmtFZL(m, unit) {
  if (!m) return '—';
  return unit === 'imperial' ? `${Math.round(m * 3.28084).toLocaleString()}ft` : `${Math.round(m).toLocaleString()}m`;
}
function fzlClass(fzl) {
  if (!fzl) return '';
  if (fzl > 2000) return 'td-fzl-good';
  if (fzl > 1600) return 'td-fzl-warn';
  return 'td-fzl-bad';
}

const SHOOT = new Set(['2026-06-10', '2026-06-11']);

export default function ForecastTable({ brohmForecast, goatForecast, unit = 'metric' }) {
  const [loc, setLoc] = useState('brohm');
  const data = loc === 'brohm' ? brohmForecast : goatForecast;

  if (!data?.length) return (
    <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'DM Mono', fontSize: 13, padding: 32 }}>
      No forecast data yet — trigger a fetch or wait for auto-refresh
    </div>
  );

  return (
    <div>
      <div className="forecast-tabs" style={{ marginBottom: 12 }}>
        <button className={`forecast-tab ${loc === 'brohm' ? 'active' : ''}`} onClick={() => setLoc('brohm')}>
          Brohm Ridge {unit === 'imperial' ? '5,085ft' : '1,550m'}
        </button>
        <button className={`forecast-tab ${loc === 'goat' ? 'active' : ''}`} onClick={() => setLoc('goat')}>
          Goat Ridge {unit === 'imperial' ? '6,234ft' : '~1,900m'}
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="forecast-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Conditions</th><th>High</th><th>Low</th>
                <th>Precip</th><th>Rain %</th><th>Snow</th><th>FZL</th><th>Wind</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f, i) => {
                const isShoot = SHOOT.has(f.forecast_date);
                return (
                  <tr key={i} className={isShoot ? 'td-shoot' : ''}>
                    <td className="td-date" style={{ color: isShoot ? 'var(--accent)' : 'var(--text)' }}>
                      {isShoot ? '⭐ ' : ''}{fmtDate(f.forecast_date)}
                    </td>
                    <td style={{ fontSize: 11 }}>{wxDesc(f.weathercode)}</td>
                    <td>{fmtTemp(f.temp_max_c, unit)}</td>
                    <td>{fmtTemp(f.temp_min_c, unit)}</td>
                    <td>{f.precipitation_mm?.toFixed(1) ?? '—'}mm</td>
                    <td style={{ color: f.precipitation_probability > 60 ? 'var(--red)' : 'var(--text-secondary)' }}>
                      {f.precipitation_probability ?? '—'}%
                    </td>
                    <td style={{ color: f.snowfall_cm > 0 ? 'var(--blue)' : 'var(--text-tertiary)' }}>
                      {f.snowfall_cm > 0 ? `${f.snowfall_cm?.toFixed(1)}cm` : '—'}
                    </td>
                    <td className={fzlClass(f.freezing_level_m)}>{fmtFZL(f.freezing_level_m, unit)}</td>
                    <td>{f.wind_speed_ms?.toFixed(1) ?? '—'} m/s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)' }}>
        FZL: <span style={{ color: 'var(--green)' }}>■ &gt;2,000m excellent</span>{' '}
        <span style={{ color: 'var(--amber)' }}>■ 1,600–2,000m good</span>{' '}
        <span style={{ color: 'var(--red)' }}>■ &lt;1,600m marginal</span>
      </div>
    </div>
  );
}
