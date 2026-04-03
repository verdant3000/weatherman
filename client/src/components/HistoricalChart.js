import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const MONTHS = { 4: 'Apr', 5: 'May', 6: 'Jun' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = label === 'Jun 10' || label === 'Jun 11';
  return (
    <div style={{
      background: '#1c1f22', border: `1px solid ${isShoot ? '#f0a500' : '#2a2d30'}`,
      borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12
    }}>
      <div style={{ color: isShoot ? '#f0a500' : '#8b9099', marginBottom: 8, fontSize: 11 }}>
        {label}{isShoot ? ' ⭐ SHOOT' : ''}
      </div>
      {payload.map((p, i) => (
        p.value != null && (
          <div key={i} style={{ color: p.color, marginBottom: 3 }}>
            {p.name}: {p.value.toFixed(1)}°C
          </div>
        )
      ))}
    </div>
  );
};

export default function HistoricalChart({ normals }) {
  const [view, setView] = useState('june'); // 'june' | 'spring'

  if (!normals) {
    return (
      <div className="hist-chart-wrap" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Loading historical data…
        </div>
      </div>
    );
  }

  let data = [];

  if (view === 'june') {
    // June day-of-month averages
    for (let day = 1; day <= 30; day++) {
      const n = normals.june_normals?.[String(day)];
      if (n) {
        data.push({
          label: `Jun ${day}`,
          avg: n.avg,
          min: n.min,
          max: n.max,
          isShoot: day === 10 || day === 11
        });
      }
    }
  } else {
    // Spring trend — Apr and May normals
    const springKeys = Object.entries(normals.spring_normals || {})
      .map(([k, v]) => {
        const [m, d] = k.split('-').map(Number);
        return { m, d, label: `${MONTHS[m] || m} ${d}`, ...v };
      })
      .sort((a, b) => a.m !== b.m ? a.m - b.m : a.d - b.d);

    data = springKeys.map(s => ({
      label: s.label,
      avg: s.avg,
      min: s.min,
      max: s.max
    }));
  }

  return (
    <div className="hist-chart-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-line" style={{ background: '#4a9eff' }} />
            <span>Daily avg</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ background: '#3ecf8e', opacity: 0.5 }} />
            <span>Min</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" style={{ background: '#ff8c42', opacity: 0.5 }} />
            <span>Max</span>
          </div>
          {view === 'june' && (
            <div className="legend-item">
              <div style={{ width: 12, height: 12, background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.3)', borderRadius: 2 }} />
              <span>Shoot days</span>
            </div>
          )}
        </div>
        <div className="forecast-tabs">
          <button className={`forecast-tab ${view === 'june' ? 'active' : ''}`} onClick={() => setView('june')}>June baseline</button>
          <button className={`forecast-tab ${view === 'spring' ? 'active' : ''}`} onClick={() => setView('spring')}>Apr–May trend</button>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        2024 + 2025 actuals · Cheekeye Brohm Ridge station · 1,550m asl · {normals.data_range}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1f22" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#55595f', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false}
            interval={view === 'june' ? 1 : 4}
            angle={view === 'june' ? -45 : 0}
            textAnchor={view === 'june' ? 'end' : 'middle'}
            height={view === 'june' ? 40 : 20}
          />
          <YAxis
            tickFormatter={v => `${v.toFixed(0)}°`}
            tick={{ fill: '#55595f', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            axisLine={false} tickLine={false} width={35}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Shoot day highlights */}
          {view === 'june' && data.filter(d => d.isShoot).map(d => (
            <ReferenceLine key={d.label} x={d.label} stroke="#f0a500" strokeWidth={24} strokeOpacity={0.08} />
          ))}

          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />

          <Line type="monotone" dataKey="max" stroke="#ff8c42" strokeWidth={1} strokeOpacity={0.5} dot={false} name="Max" connectNulls />
          <Line type="monotone" dataKey="avg" stroke="#4a9eff" strokeWidth={2} dot={false} name="Avg" connectNulls />
          <Line type="monotone" dataKey="min" stroke="#3ecf8e" strokeWidth={1} strokeOpacity={0.5} dot={false} name="Min" connectNulls />
        </LineChart>
      </ResponsiveContainer>

      {view === 'june' && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[10, 11].map(day => {
            const n = normals.june_normals?.[String(day)];
            if (!n) return null;
            return (
              <div key={day} style={{
                background: 'rgba(240,165,0,0.05)', border: '1px solid rgba(240,165,0,0.15)',
                borderRadius: 4, padding: '8px 12px'
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f0a500', marginBottom: 4 }}>
                  ⭐ JUNE {day} NORMALS (2024+2025)
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>
                  avg {n.avg.toFixed(1)}°C · min {n.min.toFixed(1)}°C · max {n.max.toFixed(1)}°C
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', marginTop: 3 }}>
                  100% of hours above 0°C in both years
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
