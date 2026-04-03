import React from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

const SHOOT_DATES = ['2026-06-10', '2026-06-11'];
const COLORS = {
  'Brohm Ridge': '#4a9eff',
  'Goat Ridge': '#3ecf8e',
  'Squamish Valley': '#8b9099',
};

const REF_LINES = [
  { y: 2319, label: 'Black Tusk 2,319m', color: '#ffffff', dash: '4 3' },
  { y: 1900, label: 'Goat Ridge ~1,900m', color: '#3ecf8e', dash: '4 3' },
  { y: 1550, label: 'Brohm Ridge 1,550m', color: '#4a9eff', dash: '4 3' },
];

function formatDate(d) {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}

function weatherCodeDesc(code) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = SHOOT_DATES.includes(label);
  return (
    <div style={{
      background: '#1c1f22', border: `1px solid ${isShoot ? '#f0a500' : '#2a2d30'}`,
      borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12
    }}>
      <div style={{ color: isShoot ? '#f0a500' : '#8b9099', marginBottom: 8, fontSize: 11 }}>
        {label}{isShoot ? ' ⭐ SHOOT DAY' : ''}
      </div>
      {payload.map((p, i) => (
        p.value != null && (
          <div key={i} style={{ color: COLORS[p.name] || '#e8eaed', marginBottom: 3 }}>
            {p.name}: {Math.round(p.value).toLocaleString()}m FZL
          </div>
        )
      ))}
    </div>
  );
};

export default function FreezeLevel({ forecasts }) {
  // Build merged dataset by date
  const dateMap = {};

  for (const [locName, locForecasts] of Object.entries(forecasts)) {
    for (const f of locForecasts) {
      if (!dateMap[f.forecast_date]) dateMap[f.forecast_date] = { date: f.forecast_date };
      if (f.freezing_level_m) {
        dateMap[f.forecast_date][locName] = Math.round(f.freezing_level_m);
      }
    }
  }

  const data = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <div className="fzl-chart-wrap" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Fetching forecast data…
        </div>
      </div>
    );
  }

  return (
    <div className="fzl-chart-wrap">
      <div className="fzl-reference-lines">
        {REF_LINES.map(r => (
          <div key={r.y} className="ref-line">
            <div className="ref-dot" style={{ background: r.color, height: 1, borderTop: `1px dashed ${r.color}` }} />
            <span style={{ color: r.color, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {r.label}
            </span>
          </div>
        ))}
        <div className="ref-line">
          <div style={{ width: 12, height: 12, background: 'rgba(240,165,0,0.15)', borderRadius: 2, border: '1px solid rgba(240,165,0,0.3)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f0a500' }}>Shoot window</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1f22" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#55595f', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[800, 3000]}
            tickFormatter={v => `${(v/1000).toFixed(1)}km`}
            tick={{ fill: '#55595f', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false} width={50}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Shoot window background */}
          {SHOOT_DATES.map(d => (
            <ReferenceLine key={d} x={d} stroke="#f0a500" strokeWidth={20} strokeOpacity={0.08} />
          ))}

          {/* Elevation reference lines */}
          <ReferenceLine y={2319} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />
          <ReferenceLine y={1900} stroke="rgba(62,207,142,0.2)" strokeDasharray="4 3" />
          <ReferenceLine y={1550} stroke="rgba(74,158,255,0.2)" strokeDasharray="4 3" />

          {Object.keys(COLORS).map(loc => (
            forecasts[loc]?.length > 0 && (
              <Line
                key={loc}
                type="monotone"
                dataKey={loc}
                stroke={COLORS[loc]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLORS[loc] }}
                connectNulls
                name={loc}
              />
            )
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
