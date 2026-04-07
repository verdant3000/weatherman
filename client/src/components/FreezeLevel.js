import React from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const COLORS = { 'Brohm Ridge': '#1a5fa8', 'Goat Ridge': '#2e6f40', 'Squamish Valley': '#9e9890' };
const SHOOT_DATES = ['2026-06-10', '2026-06-11'];

function fmtDate(d) {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = SHOOT_DATES.includes(label);
  return (
    <div style={{ background: 'white', border: `1px solid ${isShoot ? '#2e6f40' : '#e5e2dd'}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ color: isShoot ? '#2e6f40' : '#9e9890', marginBottom: 8, fontSize: 11 }}>{label}{isShoot ? ' ⭐ Shoot day' : ''}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: COLORS[p.name] || '#666', marginBottom: 2 }}>
          {p.name}: {Math.round(p.value).toLocaleString()}m FZL
        </div>
      ))}
    </div>
  );
};

export default function FreezeLevel({ forecasts, unit = 'metric' }) {
  const dateMap = {};
  for (const [loc, locForecasts] of Object.entries(forecasts)) {
    for (const f of locForecasts) {
      if (!dateMap[f.forecast_date]) dateMap[f.forecast_date] = { date: f.forecast_date };
      if (f.freezing_level_m) dateMap[f.forecast_date][loc] = Math.round(f.freezing_level_m);
    }
  }
  const data = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  if (!data.length) return (
    <div className="chart-wrap" style={{ textAlign: 'center', padding: 40, fontFamily: 'DM Mono', color: 'var(--text-tertiary)' }}>Fetching forecast data…</div>
  );

  const refElev = unit === 'imperial'
    ? [{ y: 7602, label: 'Black Tusk' }, { y: 6234, label: 'Brohm' }]
    : [{ y: 2319, label: 'Black Tusk 2,319m' }, { y: 1550, label: 'Brohm Ridge 1,550m' }];

  const yFmt = v => unit === 'imperial' ? `${Math.round(v * 3.28084 / 1000).toFixed(1)}k ft` : `${(v/1000).toFixed(1)}km`;

  return (
    <div className="chart-wrap">
      <div className="chart-legend" style={{ marginBottom: 14 }}>
        {Object.entries(COLORS).map(([loc, col]) => forecasts[loc]?.length > 0 && (
          <div key={loc} className="legend-item">
            <div className="legend-line" style={{ background: col }} />
            {loc}
          </div>
        ))}
        <div className="legend-item">
          <div style={{ width: 16, height: 8, background: 'rgba(46,111,64,0.1)', border: '1px dashed #2e6f40', borderRadius: 2 }} />
          Shoot window
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eeeb" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#9e9890', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
          <YAxis domain={[800, 3000]} tickFormatter={yFmt} tick={{ fill: '#9e9890', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} />
          {SHOOT_DATES.map(d => <ReferenceLine key={d} x={d} stroke="#2e6f40" strokeWidth={18} strokeOpacity={0.08} />)}
          {refElev.map(r => <ReferenceLine key={r.y} y={r.y} stroke="#e5e2dd" strokeDasharray="4 3" />)}
          {Object.entries(COLORS).map(([loc, col]) => forecasts[loc]?.length > 0 && (
            <Line key={loc} type="monotone" dataKey={loc} stroke={col} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls name={loc} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
