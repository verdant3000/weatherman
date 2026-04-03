import React from 'react';

const FZL_TARGETS = [
  { label: 'Black Tusk summit (2,319m)', elevation: 2319 },
  { label: 'Alpine / above treeline (1,800m+)', elevation: 1800 },
  { label: 'Brohm Ridge station (1,550m)', elevation: 1550 },
];

function fzlGrade(fzl) {
  if (!fzl) return 'pending';
  if (fzl > 2200) return 'good';
  if (fzl > 1600) return 'warn';
  return 'bad';
}

function fzlLabel(fzl) {
  if (!fzl) return '—';
  return `${Math.round(fzl).toLocaleString()}m`;
}

export default function ShootWindow({ brohmForecast, goatForecast, normals }) {
  const shoot10 = brohmForecast.find(f => f.forecast_date === '2026-06-10');
  const shoot11 = brohmForecast.find(f => f.forecast_date === '2026-06-11');

  const norm10 = normals?.june_normals?.['10'];
  const norm11 = normals?.june_normals?.['11'];

  const daysOut = Math.ceil((new Date('2026-06-10') - new Date()) / 86400000);
  const inWindow = daysOut <= 16;

  const fzl10 = shoot10?.freezing_level_m;
  const grade = fzlGrade(fzl10);
  const badgeClass = { good: 'badge-good', warn: 'badge-warn', pending: 'badge-pending', bad: 'badge-warn' }[grade];
  const badgeText = { good: '✓ CONDITIONS LOOK GOOD', warn: '⚠ MONITOR CLOSELY', pending: '⏳ FORECAST PENDING', bad: '⚠ CHECK CONDITIONS' }[grade];

  return (
    <div className="shoot-window">
      <div>
        <div className="shoot-label">Target shoot</div>
        <div className="shoot-title">June 10–11, 2026</div>
        <div className="shoot-meta">Black Tusk · Garibaldi · Brohm Ridge</div>

        {/* Historical baseline always shown */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[{ day: 10, norm: norm10 }, { day: 11, norm: norm11 }].map(({ day, norm }) => (
            <div key={day} style={{ background: 'var(--surface2)', borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                JUNE {day} HISTORICAL (1,550m)
              </div>
              {norm ? (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)' }}>
                    avg {norm.avg.toFixed(1)}°C
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {norm.min.toFixed(1)}° – {norm.max.toFixed(1)}°C · 100% hrs above 0
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="shoot-metrics">
        {inWindow && shoot10 ? (
          <>
            <div className="shoot-metric">
              <span className="shoot-metric-val" style={{ color: 'var(--blue)' }}>
                {shoot10.temp_max_c?.toFixed(0)}°
              </span>
              <span className="shoot-metric-label">Jun 10 high</span>
            </div>
            <div className="shoot-metric">
              <span className="shoot-metric-val" style={{ color: 'var(--green)' }}>
                {fzlLabel(fzl10)}
              </span>
              <span className="shoot-metric-label">FZL Jun 10</span>
            </div>
            {shoot11 && (
              <div className="shoot-metric">
                <span className="shoot-metric-val" style={{ color: fzlGrade(shoot11.freezing_level_m) === 'good' ? 'var(--green)' : 'var(--accent)' }}>
                  {fzlLabel(shoot11.freezing_level_m)}
                </span>
                <span className="shoot-metric-label">FZL Jun 11</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '0 8px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              NOT YET IN 16-DAY WINDOW
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--accent)', fontWeight: 300 }}>
              {daysOut - 16}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
              days until forecast available
            </div>
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              FZL tracking will activate<br />
              around May 25
            </div>
          </div>
        )}
      </div>

      <div>
        <div className={`shoot-status-badge ${badgeClass}`}>{badgeText}</div>
        <div style={{ marginTop: 12 }}>
          {FZL_TARGETS.map(t => (
            <div key={t.elevation} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: fzl10
                  ? (fzl10 > t.elevation ? 'var(--green)' : 'var(--red)')
                  : 'var(--text-tertiary)'
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                {t.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: fzl10 ? (fzl10 > t.elevation ? 'var(--green)' : 'var(--red)') : 'var(--text-tertiary)'
              }}>
                {fzl10 ? (fzl10 > t.elevation ? 'snow' : 'no snow') : '?'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
