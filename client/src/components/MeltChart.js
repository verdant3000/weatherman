import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

// Degree-day melt model
function calcMeltRate(avgTempC) {
  if (avgTempC <= 0) return 0;
  if (avgTempC <= 2) return 0.5;
  if (avgTempC <= 5) return avgTempC * 0.8;   // 1-4 cm/day
  if (avgTempC <= 10) return avgTempC * 0.7;  // 3.5-7 cm/day
  return avgTempC * 0.8;                       // hot days
}

// Solar multiplier — increases through spring as days lengthen
function solarMultiplier(doy) {
  // DOY 91=Apr1, 152=Jun1 — ramps from 1.0 to 1.6
  const base = 91, peak = 172;
  const t = Math.max(0, Math.min(1, (doy - base) / (peak - base)));
  return 1.0 + t * 0.6;
}

function buildMeltCurve(dailyTemps, startDepthCm, startDoy) {
  let depth = startDepthCm;
  const curve = [];

  for (let i = 0; i < dailyTemps.length; i++) {
    const doy = startDoy + i;
    const temp = dailyTemps[i];
    const melt = calcMeltRate(temp) * solarMultiplier(doy);
    depth = Math.max(0, depth - melt);

    curve.push({
      doy,
      depth: Math.round(depth * 10) / 10,
      melt_rate: Math.round(melt * 10) / 10,
      temp_c: temp
    });

    if (depth <= 0) break;
  }

  return curve;
}

function doyToLabel(doy) {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const SHOOT_DOY = 161; // June 10
const START_DOY = 97;  // April 7
const START_DEPTH = 90; // cm — from webcam visual

const YEAR_STYLES = {
  2024: { color: '#4a9eff', label: '2024 modelled' },
  2025: { color: '#52b788', label: '2025 modelled' },
  2026: { color: '#b7621a', label: '2026 live' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isShoot = parseInt(label) === SHOOT_DOY;
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
          <div key={i} style={{ color: p.stroke || p.color, marginBottom: 2 }}>
            {p.name}: {p.value.toFixed(1)} cm
          </div>
        )
      ))}
    </div>
  );
};

export default function MeltChart({ unitSystem = 'metric' }) {
  const [btscData, setBtscData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/btsc/year-over-year')
      .then(r => r.json())
      .then(d => { setBtscData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build melt curves from BTSC data
  const curves = {};

  if (btscData && btscData.length > 0) {
    // Group by year and doy
    const byYearDoy = {};
    for (const row of btscData) {
      const yr = parseInt(row.year);
      const doy = parseInt(row.day_of_year);
      if (!byYearDoy[yr]) byYearDoy[yr] = {};
      byYearDoy[yr][doy] = parseFloat(row.temp_avg);
    }

    for (const yr of Object.keys(byYearDoy)) {
      const temps = [];
      for (let doy = START_DOY; doy <= 175; doy++) {
        temps.push(byYearDoy[yr][doy] ?? null);
      }
      // Only build curve if we have enough data
      const validTemps = temps.filter(t => t !== null);
      if (validTemps.length > 5) {
        // Fill gaps with interpolation
        const filled = temps.map((t, i) => {
          if (t !== null) return t;
          // Find nearest valid values
          let prev = null, next = null;
          for (let j = i - 1; j >= 0; j--) { if (temps[j] !== null) { prev = temps[j]; break; } }
          for (let j = i + 1; j < temps.length; j++) { if (temps[j] !== null) { next = temps[j]; break; } }
          return ((prev ?? 0) + (next ?? 0)) / 2;
        });
        curves[yr] = buildMeltCurve(filled, START_DEPTH, START_DOY);
      }
    }
  }

  // Merge all curves into chart data by doy
  const allDoys = new Set();
  for (const curve of Object.values(curves)) {
    curve.forEach(pt => allDoys.add(pt.doy));
  }

  const chartData = Array.from(allDoys).sort((a, b) => a - b).map(doy => {
    const pt = { doy };
    for (const [yr, curve] of Object.entries(curves)) {
      const match = curve.find(c => c.doy === doy);
      if (match) pt[`depth_${yr}`] = unitSystem === 'imperial' ? match.depth / 2.54 : match.depth;
    }
    return pt;
  });

  const unit = unitSystem === 'imperial' ? 'in' : 'cm';
  const startLabel = unitSystem === 'imperial' ? '35"' : '90cm';
  const shootTarget = unitSystem === 'imperial' ? '8–12"' : '20–30cm';

  const noData = Object.keys(curves).length === 0;

  return (
    <div className="chart-wrap">
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="chart-legend">
            {Object.entries(YEAR_STYLES).map(([yr, s]) => (
              curves[yr] && (
                <div key={yr} className="legend-item">
                  <div className="legend-line" style={{ background: s.color }} />
                  {s.label}
                </div>
              )
            ))}
            {noData && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Upload BTSC CSV to see melt curves</div>}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Start: {startLabel} Apr 7 · Target on Jun 10: {shootTarget} consolidated alpine snow · Degree-day melt model + solar ramp
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <div style={{ textAlign: 'center', padding: '6px 12px', background: 'var(--green-light)', borderRadius: 6 }}>
            <div style={{ color: 'var(--green)', fontWeight: 600 }}>&gt;30{unit}</div>
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Good snow</div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px 12px', background: 'var(--amber-light)', borderRadius: 6 }}>
            <div style={{ color: 'var(--amber)', fontWeight: 600 }}>10–30{unit}</div>
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Patchy</div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px 12px', background: 'var(--red-light)', borderRadius: 6 }}>
            <div style={{ color: 'var(--red)', fontWeight: 600 }}>&lt;10{unit}</div>
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Thin</div>
          </div>
        </div>
      </div>

      {noData ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--surface2)', borderRadius: 8 }}>
          Upload weekly BTSC CSV to generate melt projections
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis
              dataKey="doy"
              type="number"
              domain={[START_DOY, 175]}
              tickFormatter={doyToLabel}
              tickCount={9}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${v.toFixed(0)}${unit}`}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false} tickLine={false} width={45}
              domain={[0, unitSystem === 'imperial' ? 40 : 100]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Good snow zone */}
            <ReferenceLine y={unitSystem === 'imperial' ? 12 : 30} stroke="#52b788" strokeDasharray="4 3" strokeOpacity={0.5} />
            <ReferenceLine y={unitSystem === 'imperial' ? 4 : 10} stroke="#e67e22" strokeDasharray="4 3" strokeOpacity={0.5} />

            {/* Shoot day */}
            <ReferenceLine x={SHOOT_DOY} stroke="#2d6a4f" strokeWidth={1.5} strokeDasharray="3 3" />
            <ReferenceLine x={SHOOT_DOY + 1} stroke="#2d6a4f" strokeWidth={1.5} strokeDasharray="3 3" />

            {Object.entries(YEAR_STYLES).map(([yr, s]) => (
              curves[yr] && (
                <Line
                  key={yr}
                  type="monotone"
                  dataKey={`depth_${yr}`}
                  stroke={s.color}
                  strokeWidth={yr === '2026' ? 2.5 : 2}
                  dot={false}
                  connectNulls
                  name={s.label}
                />
              )
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Phase annotations */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'April', rate: '1–3cm/day', note: 'Cold nights, moderate days', color: '#4a9eff' },
          { label: 'Early May', rate: '3–5cm/day', note: 'Longer days, warmer nights', color: '#52b788' },
          { label: 'Late May', rate: '5–8cm/day', note: 'Collapse phase, high sun', color: '#e67e22' },
          { label: 'June', rate: 'Rapid', note: 'Patches only, north faces', color: '#c0392b' },
        ].map(phase => (
          <div key={phase.label} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, borderLeft: `3px solid ${phase.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{phase.label}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: phase.color, fontWeight: 500 }}>{phase.rate}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{phase.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
