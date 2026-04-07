import React, { useState, useEffect } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const YEAR_COLORS = {
  2024: { line: '#4a9eff', fill: 'rgba(74,158,255,0.08)', label: '2024' },
  2025: { line: '#3ecf8e', fill: 'rgba(62,207,142,0.08)', label: '2025' },
  2026: { line: '#f0a500', fill: 'rgba(240,165,0,0.08)', label: '2026 (live)' },
};

// Day of year to "Jun 10" label
function doyToLabel(doy, year) {
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const SHOOT_DOY = 161; // June 10

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = parseInt(label) === SHOOT_DOY || parseInt(label) === SHOOT_DOY + 1;
  return (
    <div style={{
      background: "white", border: `1px solid ${isShoot ? '#f0a500' : "#e5e2dd"}`,
      borderRadius: 6, padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12
    }}>
      <div style={{ color: isShoot ? '#f0a500' : '#8b9099', marginBottom: 8, fontSize: 11 }}>
        Day {label}{isShoot ? ' ⭐ SHOOT' : ''}
      </div>
      {payload.map((p, i) => (
        p.value != null && (
          <div key={i} style={{ color: p.color || p.stroke, marginBottom: 2 }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) + '°C' :
              (Array.isArray(p.value) ? `${p.value[0].toFixed(1)}° – ${p.value[1].toFixed(1)}°C` : p.value)}
          </div>
        )
      ))}
    </div>
  );
};

export default function YearOverYearChart() {
  const [data, setData] = useState(null);
  const convert = (c) => unitSystem === 'imperial' ? (c * 9/5 + 32) : c;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('full'); // 'full' | 'june' | 'spring'
  const [showBands, setShowBands] = useState(true);

  useEffect(() => {
    fetch('/api/btsc/year-over-year')
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 32, textAlign: 'center', fontFamily: 'DM Mono, monospace', color: 'var(--text-tertiary)' }}>
      Loading station data...
    </div>
  );

  if (error || !data || data.length === 0) return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 24 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        No BTSC station data yet — upload a CSV to see the year-over-year chart.
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
        Download from vdv.bgcengineering.ca dashboard 1423 → use the upload panel below
      </div>
    </div>
  );

  // Group by year and day_of_year
  const byYearDoy = {};
  for (const row of data) {
    const yr = parseInt(row.year);
    const doy = parseInt(row.day_of_year);
    if (!byYearDoy[yr]) byYearDoy[yr] = {};
    byYearDoy[yr][doy] = row;
  }

  const years = Object.keys(byYearDoy).map(Number).sort();

  // Build merged dataset by day_of_year
  let doyRange;
  if (view === 'june') doyRange = [152, 182]; // June
  else if (view === 'spring') doyRange = [91, 181]; // Apr-Jun
  else doyRange = [1, 365]; // full year

  const chartData = [];
  for (let doy = doyRange[0]; doy <= doyRange[1]; doy++) {
    const point = { doy };
    for (const yr of years) {
      const row = byYearDoy[yr]?.[doy];
      if (row) {
        point[`max_${yr}`] = parseFloat(row.temp_max);
        point[`min_${yr}`] = parseFloat(row.temp_min);
        point[`avg_${yr}`] = parseFloat(row.temp_avg);
        point[`band_${yr}`] = [parseFloat(row.temp_min), parseFloat(row.temp_max)];
      }
    }
    chartData.push(point);
  }

  // X axis tick formatter
  const refYear = years[0] || 2024;
  const tickFormatter = (doy) => doyToLabel(doy, refYear);
  const tickCount = view === 'june' ? 10 : view === 'spring' ? 8 : 12;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 20 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {years.map(yr => (
            <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 3, background: YEAR_COLORS[yr]?.line || '#888', borderRadius: 2 }} />
              {YEAR_COLORS[yr]?.label || yr}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 16, height: 8, background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: 2 }} />
            High/low band
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['full', 'spring', 'june'].map(v => (
            <button key={v} className={`forecast-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'full' ? 'Full year' : v === 'spring' ? 'Apr–Jun' : 'June only'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Cheekeye Brohm Ridge station · 1,550m asl · daily high/low bands + avg line
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1f22" vertical={false} />
          <XAxis
            dataKey="doy"
            type="number"
            domain={doyRange}
            tickFormatter={tickFormatter}
            tickCount={tickCount}
            tick={{ fill: '#9e9890', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${v.toFixed(0)}°`}
            tick={{ fill: '#9e9890', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false} width={35}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Shoot day markers */}
          <ReferenceLine x={SHOOT_DOY} stroke="#f0a500" strokeWidth={1} strokeDasharray="3 3" label="" />
          <ReferenceLine x={SHOOT_DOY + 1} stroke="#f0a500" strokeWidth={1} strokeDasharray="3 3" label="" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />

          {/* High/low bands and avg lines per year */}
          {years.map(yr => {
            const col = YEAR_COLORS[yr] || { line: '#888', fill: 'rgba(136,136,136,0.06)' };
            return [
              showBands && (
                <Area
                  key={`band_${yr}`}
                  type="monotone"
                  dataKey={`band_${yr}`}
                  stroke="none"
                  fill={col.fill}
                  connectNulls
                  name={`${yr} range`}
                />
              ),
              <Line
                key={`avg_${yr}`}
                type="monotone"
                dataKey={`avg_${yr}`}
                stroke={col.line}
                strokeWidth={yr === 2026 ? 2.5 : 1.5}
                dot={false}
                connectNulls
                name={`${yr} avg`}
              />
            ];
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {/* June 10-11 callout */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {years.map(yr => {
          const d10 = byYearDoy[yr]?.[SHOOT_DOY];
          const d11 = byYearDoy[yr]?.[SHOOT_DOY + 1];
          if (!d10 && !d11) return null;
          const col = YEAR_COLORS[yr]?.line || '#888';
          return (
            <div key={yr} style={{
              flex: 1, minWidth: 160,
              background: 'var(--surface2)', borderRadius: 4,
              padding: '8px 12px',
              borderLeft: `3px solid ${col}`
            }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: col, marginBottom: 4 }}>{yr}</div>
              {d10 && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text)' }}>
                Jun 10: {parseFloat(d10.temp_min).toFixed(1)}° – {parseFloat(d10.temp_max).toFixed(1)}°C
              </div>}
              {d11 && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text)' }}>
                Jun 11: {parseFloat(d11.temp_min).toFixed(1)}° – {parseFloat(d11.temp_max).toFixed(1)}°C
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
