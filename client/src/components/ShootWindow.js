import React from 'react';

const FZL_TARGETS = [
  { label: 'Black Tusk summit', elevation_m: 2319 },
  { label: 'Alpine / treeline', elevation_m: 1800 },
  { label: 'Brohm Ridge station', elevation_m: 1550 },
];

function fzlGrade(fzl) {
  if (!fzl) return 'pending';
  if (fzl > 2200) return 'good';
  if (fzl > 1600) return 'warn';
  return 'bad';
}

function fmtTemp(c, unit) {
  if (c == null) return '—';
  const val = unit === 'imperial' ? (c * 9/5 + 32).toFixed(0) : c.toFixed(1);
  return `${val}${unit === 'imperial' ? '°F' : '°C'}`;
}

function fmtFZL(m, unit) {
  if (!m) return '—';
  return unit === 'imperial'
    ? `${Math.round(m * 3.28084).toLocaleString()}ft`
    : `${Math.round(m).toLocaleString()}m`;
}

export default function ShootWindow({ brohmForecast, normals, unit = 'metric' }) {
  const shoot10 = brohmForecast.find(f => f.forecast_date === '2026-06-10');
  const shoot11 = brohmForecast.find(f => f.forecast_date === '2026-06-11');
  const norm10 = normals?.june_normals?.['10'];
  const norm11 = normals?.june_normals?.['11'];
  const daysOut = Math.ceil((new Date('2026-06-10') - new Date()) / 86400000);
  const inWindow = daysOut <= 16;
  const fzl10 = shoot10?.freezing_level_m;
  const grade = fzlGrade(fzl10);
  const badgeClass = { good: 'badge-good', warn: 'badge-warn', pending: 'badge-pending', bad: 'badge-warn' }[grade];
  const badgeText = { good: '✓ Conditions look good', warn: '⚠ Monitor closely', pending: '⏳ Outside forecast range', bad: '⚠ Check conditions' }[grade];

  return (
    <div className="shoot-window">
      <div>
        <div className="shoot-label">Target shoot window</div>
        <div className="shoot-title">June 10–11, 2026</div>
        <div className="shoot-meta">Black Tusk · Garibaldi · Brohm Ridge</div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ day: 10, norm: norm10 }, { day: 11, norm: norm11 }].map(({ day, norm }) => (
            <div key={day} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                JUNE {day} HISTORICAL · 1,550m
              </div>
              {norm ? (
                <>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>
                    avg {fmtTemp(norm.avg, unit)}
                  </div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {fmtTemp(norm.min, unit)} – {fmtTemp(norm.max, unit)} · 100% hrs above 0°
                  </div>
                </>
              ) : <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="shoot-metrics">
        {inWindow && shoot10 ? (
          <>
            <div className="shoot-metric">
              <span className="shoot-metric-val">{fmtTemp(shoot10.temp_max_c, unit)}</span>
              <span className="shoot-metric-label">Jun 10 high</span>
            </div>
            <div className="shoot-metric">
              <span className="shoot-metric-val" style={{ color: grade === 'good' ? 'var(--green)' : 'var(--orange)' }}>
                {fmtFZL(fzl10, unit)}
              </span>
              <span className="shoot-metric-label">FZL Jun 10</span>
            </div>
            {shoot11 && (
              <div className="shoot-metric">
                <span className="shoot-metric-val" style={{ color: fzlGrade(shoot11.freezing_level_m) === 'good' ? 'var(--green)' : 'var(--orange)' }}>
                  {fmtFZL(shoot11.freezing_level_m, unit)}
                </span>
                <span className="shoot-metric-label">FZL Jun 11</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>NOT IN 16-DAY WINDOW YET</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 32, color: 'var(--accent)', fontWeight: 300 }}>{Math.max(0, daysOut - 16)}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)' }}>days until available</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)', marginTop: 10 }}>FZL tracking activates<br/>around May 25</div>
          </div>
        )}
      </div>

      <div>
        <div className={`shoot-status-badge ${badgeClass}`}>{badgeText}</div>
        <div style={{ marginTop: 14 }}>
          {FZL_TARGETS.map(t => {
            const covered = fzl10 ? fzl10 > t.elevation_m : null;
            return (
              <div key={t.elevation_m} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: covered === null ? '#ccc' : covered ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>
                  {t.label}
                </span>
                <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: covered === null ? 'var(--text-tertiary)' : covered ? 'var(--green)' : 'var(--red)' }}>
                  {covered === null ? '?' : covered ? 'snow' : 'no snow'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
