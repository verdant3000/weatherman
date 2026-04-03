import React, { useState } from 'react';

const WX_CODES = {
  0: '☀️ Clear', 1: '🌤 Mostly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
  45: '🌫 Fog', 48: '🌫 Icy fog',
  51: '🌦 Light drizzle', 53: '🌦 Drizzle', 55: '🌧 Heavy drizzle',
  61: '🌧 Light rain', 63: '🌧 Rain', 65: '🌧 Heavy rain',
  71: '❄️ Light snow', 73: '❄️ Snow', 75: '❄️ Heavy snow', 77: '🌨 Snow grains',
  80: '🌦 Light showers', 81: '🌦 Showers', 82: '🌧 Heavy showers',
  85: '🌨 Snow showers', 86: '🌨 Heavy snow showers',
  95: '⛈ Thunderstorm',
};

function wxDesc(code) {
  return WX_CODES[code] || `Code ${code}`;
}

function fzlClass(fzl) {
  if (!fzl) return '';
  if (fzl > 2000) return 'td-fzl-good';
  if (fzl > 1600) return 'td-fzl-warn';
  return 'td-fzl-bad';
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

const SHOOT_DATES = new Set(['2026-06-10', '2026-06-11']);

export default function ForecastTable({ brohmForecast, goatForecast }) {
  const [location, setLocation] = useState('brohm');

  const data = location === 'brohm' ? brohmForecast : goatForecast;

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: 32, textAlign: 'center',
        fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: 13
      }}>
        No forecast data yet — trigger a fetch or wait for the next auto-refresh
      </div>
    );
  }

  return (
    <div>
      <div className="forecast-tabs" style={{ marginBottom: 12 }}>
        <button className={`forecast-tab ${location === 'brohm' ? 'active' : ''}`} onClick={() => setLocation('brohm')}>
          Brohm Ridge 1,550m
        </button>
        <button className={`forecast-tab ${location === 'goat' ? 'active' : ''}`} onClick={() => setLocation('goat')}>
          Goat Ridge ~1,900m
        </button>
      </div>

      <div className="forecast-table-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Conditions</th>
              <th>High</th>
              <th>Low</th>
              <th>Precip</th>
              <th>Rain %</th>
              <th>Snow</th>
              <th>FZL</th>
              <th>Wind</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, i) => {
              const isShoot = SHOOT_DATES.has(f.forecast_date);
              return (
                <tr key={i} className={isShoot ? 'td-shoot' : ''}>
                  <td className="td-date" style={{ color: isShoot ? '#f0a500' : 'var(--text)' }}>
                    {isShoot ? '⭐ ' : ''}{formatDate(f.forecast_date)}
                  </td>
                  <td style={{ fontSize: 11 }}>{wxDesc(f.weathercode)}</td>
                  <td style={{ color: f.temp_max_c > 10 ? '#ff8c42' : 'var(--text)' }}>
                    {f.temp_max_c?.toFixed(1)}°
                  </td>
                  <td style={{ color: f.temp_min_c < 0 ? '#a0c4ff' : 'var(--text)' }}>
                    {f.temp_min_c?.toFixed(1)}°
                  </td>
                  <td>{f.precipitation_mm?.toFixed(1) ?? '—'}mm</td>
                  <td style={{ color: f.precipitation_probability > 60 ? '#ff5c5c' : 'var(--text-secondary)' }}>
                    {f.precipitation_probability ?? '—'}%
                  </td>
                  <td style={{ color: f.snowfall_cm > 0 ? '#a0c4ff' : 'var(--text-tertiary)' }}>
                    {f.snowfall_cm > 0 ? `${f.snowfall_cm?.toFixed(1)}cm` : '—'}
                  </td>
                  <td className={fzlClass(f.freezing_level_m)}>
                    {f.freezing_level_m ? `${Math.round(f.freezing_level_m).toLocaleString()}m` : '—'}
                  </td>
                  <td>{f.wind_speed_ms?.toFixed(1) ?? '—'} m/s</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        FZL colour: <span style={{ color: 'var(--green)' }}>■ &gt;2,000m excellent</span>{' '}
        <span style={{ color: 'var(--accent)' }}>■ 1,600–2,000m good</span>{' '}
        <span style={{ color: 'var(--red)' }}>■ &lt;1,600m marginal</span>
      </div>
    </div>
  );
}
