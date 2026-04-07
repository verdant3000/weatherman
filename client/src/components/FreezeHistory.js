import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const YEAR_COLORS = {
  2022: '#c4a882',
  2023: '#8aa4c4',
  2024: '#1a5fa8',
  2025: '#2e6f40',
  2026: '#c4941a',
};

const SHOOT_DOY = 161;

function doyLabel(doy) {
  const d = new Date(2024, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = parseInt(label) === SHOOT_DOY || parseInt(label) === SHOOT_DOY + 1;
  return (
    <div style={{ background: 'white', border: `1px solid ${isShoot ? '#2e6f40' : '#e5e2dd'}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color: isShoot ? '#2e6f40' : '#9e9890', marginBottom: 8, fontSize: 11 }}>{doyLabel(parseInt(label))}{isShoot ? ' ⭐ Shoot' : ''}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.stroke, marginBottom: 2 }}>
          {p.name}: {Math.round(p.value).toLocaleString()}m
        </div>
      ))}
    </div>
  );
};

export default function FreezeHistory({ unit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/historical/fzl')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="chart-wrap" style={{ padding: 40, textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--text-tertiary)' }}>Loading freezing level history...</div>;
  if (!data?.data?.length) return <div className="chart-wrap" style={{ padding: 24, fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-secondary)' }}>No historical data yet — will populate on first deploy.</div>;

  // Group by day_of_year
  const byDoy = {};
  for (const row of data.data) {
    const doy = parseInt(row.day_of_year);
    if (!byDoy[doy]) byDoy[doy] = { doy };
    const yr = parseInt(row.year);
    byDoy[doy][yr] = row.fzl_avg_m ? Math.round(row.fzl_avg_m) : null;
  }

  const chartData = Object.values(byDoy).sort((a, b) => a.doy - b.doy);
  const years = data.years || [2022, 2023, 2024, 2025, 2026];

  // Convert elevation if imperial
  const fmt = (m) => m == null ? null : unit === 'imperial' ? Math.round(m * 3.28084) : m;
  const yLabel = unit === 'imperial' ? 'ft' : 'm';
  const refLines = unit === 'imperial'
    ? [{ y: 7602, label: 'Black Tusk 7,602ft' }, { y: 6234, label: 'Brohm Ridge 6,234ft' }]
    : [{ y: 2319, label: 'Black Tusk 2,319m' }, { y: 1550, label: 'Brohm Ridge 1,550m' }];

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        {years.map(yr => (
          <div key={yr} className="legend-item">
            <div className="legend-line" style={{ background: YEAR_COLORS[yr] || '#888', height: yr === 2026 ? 3 : 2 }} />
            {yr === 2026 ? `${yr} (live)` : yr}
          </div>
        ))}
      </div>
      <div className="chart-sub">Apr 1 – Jun 13 · Brohm Ridge 1,550m · daily avg freezing level</div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eeeb" vertical={false} />
          <XAxis dataKey="doy" type="number" domain={[91, 164]} tickFormatter={d => doyLabel(d)} tickCount={10} tick={{ fill: '#9e9890', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${unit === 'imperial' ? Math.round(v * 3.28084).toLocaleString() : v.toLocaleString()}${yLabel}`} tick={{ fill: '#9e9890', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={SHOOT_DOY} stroke="#2e6f40" strokeDasharray="3 3" strokeWidth={1.5} />
          <ReferenceLine x={SHOOT_DOY + 1} stroke="#2e6f40" strokeDasharray="3 3" strokeWidth={1.5} />
          {refLines.map(r => <ReferenceLine key={r.y} y={unit === 'imperial' ? r.y : r.y} stroke="#e5e2dd" strokeDasharray="4 3" />)}
          {years.map(yr => (
            <Line key={yr} type="monotone" dataKey={yr} stroke={YEAR_COLORS[yr] || '#888'} strokeWidth={yr === 2026 ? 2.5 : 1.5} dot={false} connectNulls name={String(yr)} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 8, fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)' }}>
        Green dashed lines = June 10–11 shoot window · Source: ERA5 reanalysis via Open-Meteo
      </div>
    </div>
  );
}
