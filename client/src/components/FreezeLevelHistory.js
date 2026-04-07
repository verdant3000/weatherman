import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const YEAR_COLORS = {
  2022: '#c9b8a8',
  2023: '#a09890',
  2024: '#4a9eff',
  2025: '#52b788',
  2026: '#b7621a',
};

const SHOOT_DOY = 161;

function doyToLabel(doy) {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = parseInt(label) === SHOOT_DOY || parseInt(label) === SHOOT_DOY + 1;
  return (
    <div style={{
      background: 'white', border: `1px solid ${isShoot ? '#2d6a4f' : '#e8e4de'}`,
      borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontFamily: 'DM Mono, monospace', fontSize: 12
    }}>
      <div style={{ color: isShoot ? '#2d6a4f' : '#6b6560', marginBottom: 6, fontSize: 11, fontWeight: 600 }}>
        {doyToLabel(parseInt(label))}{isShoot ? ' ⭐ SHOOT' : ''}
      </div>
      {payload.map((p, i) => (
        p.value != null && (
          <div key={i} style={{ color: p.stroke, marginBottom: 2 }}>
            {p.name}: {Math.round(p.value).toLocaleString()}m
          </div>
        )
      ))}
    </div>
  );
};

export default function FreezeLevelHistory({ unitSystem = 'metric' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);

  const load = () => {
    fetch('/api/fzl/year-over-year')
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fetchHistory = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/fzl/fetch', { method: 'POST' });
      const result = await res.json();
      setFetchResult(result);
      load();
    } finally {
      setFetching(false);
    }
  };

  // Build chart data
  const years = data ? [...new Set(data.map(r => parseInt(r.year)))].sort() : [];

  const byYearDoy = {};
  if (data) {
    for (const row of data) {
      const yr = parseInt(row.year);
      const doy = parseInt(row.day_of_year);
      if (!byYearDoy[yr]) byYearDoy[yr] = {};
      byYearDoy[yr][doy] = row;
    }
  }

  const chartData = [];
  for (let doy = 91; doy <= 174; doy++) {
    const pt = { doy };
    for (const yr of years) {
      const row = byYearDoy[yr]?.[doy];
      if (row?.fzl_avg_m) {
        pt[`fzl_${yr}`] = unitSystem === 'imperial'
          ? Math.round(parseFloat(row.fzl_avg_m) * 3.28084)
          : Math.round(parseFloat(row.fzl_avg_m));
      }
    }
    chartData.push(pt);
  }

  const unitLabel = unitSystem === 'imperial' ? 'ft' : 'm';
  // Reference elevations
  const blackTusk = unitSystem === 'imperial' ? 7608 : 2319;
  const brohm = unitSystem === 'imperial' ? 5085 : 1550;
  const goat = unitSystem === 'imperial' ? 6234 : 1900;

  return (
    <div className="chart-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="chart-legend">
            {years.map(yr => (
              <div key={yr} className="legend-item">
                <div className="legend-line" style={{ background: YEAR_COLORS[yr] || '#888' }} />
                <span style={{ fontWeight: yr >= 2024 ? 600 : 400 }}>{yr}</span>
              </div>
            ))}
            {years.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No historical data yet</div>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Daily average freezing level · Brohm Ridge coords · Open-Meteo archive · Apr 1 – Jun 13
          </div>
        </div>
        <button className="ctrl-btn" onClick={fetchHistory} disabled={fetching} style={{ padding: '6px 14px', fontSize: 12 }}>
          {fetching ? '⏳ Fetching 2022–2026...' : '📡 Load historical FZL'}
        </button>
      </div>

      {fetchResult && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
          ✓ Loaded: {fetchResult.map ? fetchResult.map(r => `${r.year}: ${r.inserted || 0} days`).join(' · ') : 'Done'}
        </div>
      )}

      {years.length === 0 ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--surface2)', borderRadius: 8, flexDirection: 'column', gap: 8 }}>
          <div>Click "Load historical FZL" to fetch 2022–2026 data from Open-Meteo</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>Free API — no key required</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis
              dataKey="doy"
              type="number"
              domain={[91, 174]}
              tickFormatter={doyToLabel}
              tickCount={9}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${(v/1000).toFixed(1)}k${unitLabel}`}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false} tickLine={false} width={55}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Elevation references */}
            <ReferenceLine y={blackTusk} stroke="#1a1814" strokeDasharray="4 3" strokeOpacity={0.2} label={{ value: `Black Tusk ${blackTusk.toLocaleString()}${unitLabel}`, position: 'right', fontSize: 9, fill: '#a09890' }} />
            <ReferenceLine y={goat} stroke="#52b788" strokeDasharray="4 3" strokeOpacity={0.3} label={{ value: `Goat ${goat.toLocaleString()}${unitLabel}`, position: 'right', fontSize: 9, fill: '#52b788' }} />
            <ReferenceLine y={brohm} stroke="#4a9eff" strokeDasharray="4 3" strokeOpacity={0.3} label={{ value: `Brohm ${brohm.toLocaleString()}${unitLabel}`, position: 'right', fontSize: 9, fill: '#4a9eff' }} />

            {/* Shoot day */}
            <ReferenceLine x={SHOOT_DOY} stroke="#2d6a4f" strokeWidth={1.5} strokeDasharray="3 3" />
            <ReferenceLine x={SHOOT_DOY + 1} stroke="#2d6a4f" strokeWidth={1.5} strokeDasharray="3 3" />

            {years.map(yr => (
              <Line
                key={yr}
                type="monotone"
                dataKey={`fzl_${yr}`}
                stroke={YEAR_COLORS[yr] || '#888'}
                strokeWidth={yr >= 2024 ? 2 : 1.5}
                strokeOpacity={yr < 2024 ? 0.6 : 1}
                dot={false}
                connectNulls
                name={String(yr)}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Shoot day callout */}
      {years.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {years.filter(yr => byYearDoy[yr]?.[SHOOT_DOY]).map(yr => {
            const row = byYearDoy[yr][SHOOT_DOY];
            const fzl = unitSystem === 'imperial'
              ? Math.round(parseFloat(row.fzl_avg_m) * 3.28084)
              : Math.round(parseFloat(row.fzl_avg_m));
            const aboveBlackTusk = fzl > blackTusk;
            return (
              <div key={yr} style={{
                flex: 1, minWidth: 120, padding: '8px 12px',
                background: aboveBlackTusk ? 'var(--green-light)' : 'var(--amber-light)',
                borderRadius: 6, borderLeft: `3px solid ${YEAR_COLORS[yr]}`
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: YEAR_COLORS[yr], fontFamily: 'var(--font-mono)' }}>{yr} · Jun 10</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text)', marginTop: 2 }}>
                  {fzl.toLocaleString()}{unitLabel}
                </div>
                <div style={{ fontSize: 10, color: aboveBlackTusk ? 'var(--green)' : 'var(--amber)', marginTop: 2 }}>
                  {aboveBlackTusk ? '✓ above Black Tusk' : '⚠ below summit'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
