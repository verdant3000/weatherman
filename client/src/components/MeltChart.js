import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── Melt model ────────────────────────────────────────────────────────────────

function calcMeltRate(avgTempC, rainMm = 0) {
  let melt = 0;
  if (avgTempC <= 0)       melt = 0;
  else if (avgTempC <= 2)  melt = 0.5;
  else if (avgTempC <= 5)  melt = avgTempC * 0.9;   // 1–4.5 cm/day
  else if (avgTempC <= 10) melt = avgTempC * 0.75;  // 3.75–7.5 cm/day
  else                     melt = avgTempC * 0.8;   // hot days

  // Rain event multiplier
  if (rainMm > 10) melt *= 1.8;
  else if (rainMm > 5) melt *= 1.3;

  return melt;
}

// Solar ramp — days lengthen Apr→Jun, accelerating surface melt
function solarMultiplier(doy) {
  const base = 91, peak = 172;
  const t = Math.max(0, Math.min(1, (doy - base) / (peak - base)));
  return 1.0 + t * 0.65;
}

// Lapse rate temperature adjustment for elevation
// ~6.5°C / 1000m environmental lapse rate
// But alpine snowpack is denser/colder so melt is slower even at same temp
function lapseTemp(tempC, fromElev, toElev) {
  const diff = (toElev - fromElev) / 1000;
  return tempC - diff * 6.5;
}

function buildMeltCurve(dailyData, startDepthCm, startDoy, elevationM = 1550) {
  let depth = startDepthCm;
  const curve = [];
  const stationElev = 1550;

  for (let i = 0; i < dailyData.length; i++) {
    const doy = startDoy + i;
    const stationTemp = dailyData[i]?.temp ?? 0;
    const rain = dailyData[i]?.rain ?? 0;

    // Adjust temperature for elevation
    const temp = lapseTemp(stationTemp, stationElev, elevationM);
    const melt = calcMeltRate(temp, rain) * solarMultiplier(doy);

    depth = Math.max(0, depth - melt);
    curve.push({ doy, depth: Math.round(depth * 10) / 10 });
    if (depth <= 0) break;
  }
  return curve;
}

function doyToLabel(doy) {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ── Config ────────────────────────────────────────────────────────────────────

const SHOOT_DOY = 161; // June 10
const START_DOY = 97;  // April 7
const STATION_ELEV = 1550;
const ALPINE_ELEV = 2200;

// Starting depths — cam observation April 7
// 11 stairs × ~19cm = ~209cm → call it 210cm
const START_DEPTH_STATION = 210; // cm at 1,550m (stairs fully buried)
// Alpine at 2,200m starts deeper — roughly 1.3× based on lapse accumulation
const START_DEPTH_ALPINE = 270;  // cm at 2,200m (estimated)

const YEAR_STYLES = {
  2024: { stationColor: '#93c4f4', alpineColor: '#1a5fa8', label: '2024' },
  2025: { stationColor: '#7ecba0', alpineColor: '#2e6f40', label: '2025' },
  2026: { stationColor: '#f0c060', alpineColor: '#c4941a', label: '2026 (live)' },
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const isShoot = parseInt(label) === SHOOT_DOY || parseInt(label) === SHOOT_DOY + 1;
  return (
    <div style={{ background: 'white', border: `1px solid ${isShoot ? '#2e6f40' : '#e5e2dd'}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: isShoot ? '#2e6f40' : '#9e9890', marginBottom: 6, fontSize: 11 }}>
        {doyToLabel(parseInt(label))}{isShoot ? ' ⭐ Shoot' : ''}
      </div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.stroke, marginBottom: 2 }}>
          {p.name}: {p.value.toFixed(0)}{unit}
        </div>
      ))}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeltChart({ unit = 'metric' }) {
  const [btscData, setBtscData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStation, setShowStation] = useState(true);

  useEffect(() => {
    fetch('/api/btsc/year-over-year')
      .then(r => r.json())
      .then(d => { setBtscData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const isImperial = unit === 'imperial';
  const unitLabel = isImperial ? 'in' : 'cm';
  const convert = cm => isImperial ? +(cm / 2.54).toFixed(1) : cm;

  // Build curves per year
  const curves = {};

  if (btscData?.length > 0) {
    const byYearDoy = {};
    for (const row of btscData) {
      const yr = parseInt(row.year);
      const doy = parseInt(row.day_of_year);
      if (!byYearDoy[yr]) byYearDoy[yr] = {};
      byYearDoy[yr][doy] = {
        temp: parseFloat(row.temp_avg),
        rain: parseFloat(row.rain_mm) || 0
      };
    }

    for (const yr of Object.keys(byYearDoy)) {
      const dailyData = [];
      for (let doy = START_DOY; doy <= 175; doy++) {
        dailyData.push(byYearDoy[yr][doy] || null);
      }
      const valid = dailyData.filter(Boolean);
      if (valid.length > 5) {
        const filled = dailyData.map((d, i) => {
          if (d) return d;
          let prev = null, next = null;
          for (let j = i - 1; j >= 0; j--) { if (dailyData[j]) { prev = dailyData[j]; break; } }
          for (let j = i + 1; j < dailyData.length; j++) { if (dailyData[j]) { next = dailyData[j]; break; } }
          return { temp: ((prev?.temp ?? 0) + (next?.temp ?? 0)) / 2, rain: 0 };
        });
        curves[yr] = {
          station: buildMeltCurve(filled, START_DEPTH_STATION, START_DOY, STATION_ELEV),
          alpine:  buildMeltCurve(filled, START_DEPTH_ALPINE, START_DOY, ALPINE_ELEV),
        };
      }
    }
  }

  const noData = Object.keys(curves).length === 0;

  // Merge into chart dataset
  const allDoys = new Set();
  for (const { station, alpine } of Object.values(curves)) {
    station.forEach(p => allDoys.add(p.doy));
    alpine.forEach(p => allDoys.add(p.doy));
  }

  const chartData = Array.from(allDoys).sort((a, b) => a - b).map(doy => {
    const pt = { doy };
    for (const [yr, { station, alpine }] of Object.entries(curves)) {
      const s = station.find(p => p.doy === doy);
      const a = alpine.find(p => p.doy === doy);
      if (showStation && s) pt[`s_${yr}`] = convert(s.depth);
      if (a) pt[`a_${yr}`] = convert(a.depth);
    }
    return pt;
  });

  // Shoot day summary
  const shootSummary = Object.entries(curves).map(([yr, { station, alpine }]) => {
    const s = station.find(p => p.doy === SHOOT_DOY);
    const a = alpine.find(p => p.doy === SHOOT_DOY);
    return { yr, station: s?.depth, alpine: a?.depth };
  });

  const depthStatus = (cm) => {
    if (!cm) return { label: 'Gone', color: '#b93d3d' };
    if (cm > 80) return { label: 'Deep snow', color: '#1a5fa8' };
    if (cm > 30) return { label: 'Good coverage', color: '#2e6f40' };
    if (cm > 10) return { label: 'Patchy', color: '#c4941a' };
    return { label: 'Thin/gone', color: '#b93d3d' };
  };

  const yMax = isImperial ? 120 : 300;

  return (
    <div className="chart-wrap">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="chart-legend">
            {Object.entries(YEAR_STYLES).map(([yr, s]) => curves[yr] && (
              <React.Fragment key={yr}>
                <div className="legend-item">
                  <div className="legend-line" style={{ background: s.alpineColor, height: 3 }} />
                  {s.label} · 2,200m
                </div>
                {showStation && (
                  <div className="legend-item">
                    <div className="legend-line" style={{ background: s.stationColor, height: 2, borderTop: '2px dashed ' + s.stationColor, background: 'none' }} />
                    {s.label} · 1,550m
                  </div>
                )}
              </React.Fragment>
            ))}
            {noData && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Upload BTSC CSV to see melt curves</div>}
          </div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Start: {convert(START_DEPTH_STATION)}{unitLabel} at 1,550m · {convert(START_DEPTH_ALPINE)}{unitLabel} at 2,200m (Apr 7 cam estimate) · lapse rate −6.5°C/1,000m
          </div>
        </div>
        <button
          onClick={() => setShowStation(s => !s)}
          className="forecast-tab"
          style={{ fontSize: 11, padding: '4px 12px' }}
        >
          {showStation ? 'Hide 1,550m' : 'Show 1,550m'}
        </button>
      </div>

      {noData ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--surface2)', borderRadius: 8, fontFamily: 'DM Mono' }}>
          Upload BTSC CSV to generate melt projections
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis dataKey="doy" type="number" domain={[START_DOY, 175]} tickFormatter={doyToLabel} tickCount={9}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${v.toFixed(0)}${unitLabel}`} domain={[0, yMax]}
              tick={{ fill: '#a09890', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip unit={unitLabel} />} />

            {/* Reference lines */}
            <ReferenceLine y={convert(30)} stroke="#2e6f40" strokeDasharray="4 3" strokeOpacity={0.4} />
            <ReferenceLine y={convert(10)} stroke="#c4941a" strokeDasharray="4 3" strokeOpacity={0.4} />
            <ReferenceLine x={SHOOT_DOY} stroke="#2e6f40" strokeWidth={1.5} strokeDasharray="3 3" />
            <ReferenceLine x={SHOOT_DOY + 1} stroke="#2e6f40" strokeWidth={1.5} strokeDasharray="3 3" />

            {/* Curves per year */}
            {Object.entries(YEAR_STYLES).map(([yr, s]) => curves[yr] && (
              <React.Fragment key={yr}>
                {/* Alpine — solid, primary */}
                <Line type="monotone" dataKey={`a_${yr}`} stroke={s.alpineColor}
                  strokeWidth={yr === '2026' ? 2.5 : 1.8} dot={false} connectNulls name={`${yr} · 2,200m`} />
                {/* Station — dashed, lighter */}
                {showStation && (
                  <Line type="monotone" dataKey={`s_${yr}`} stroke={s.stationColor}
                    strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls name={`${yr} · 1,550m`} />
                )}
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Shoot day callout cards */}
      {!noData && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {shootSummary.map(({ yr, station, alpine }) => {
            const alpineStatus = depthStatus(alpine);
            const s = YEAR_STYLES[yr];
            return (
              <div key={yr} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px', borderLeft: `3px solid ${s.alpineColor}` }}>
                <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: s.alpineColor, marginBottom: 6 }}>{yr} · June 10</div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)' }}>2,200m (alpine)</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 300, color: alpineStatus.color }}>
                    {alpine ? `${convert(alpine).toFixed(0)}${unitLabel}` : 'gone'}
                  </div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: alpineStatus.color }}>{alpineStatus.label}</div>
                </div>
                {station != null && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)' }}>1,550m (station)</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {convert(station).toFixed(0)}{unitLabel}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Model notes */}
          <div style={{ background: '#fef9ec', borderRadius: 6, padding: '10px 14px', border: '1px solid #f0d98a' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#8a6800', marginBottom: 6, fontWeight: 600 }}>Model notes</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#8a6800', lineHeight: 1.7 }}>
              Start: {convert(START_DEPTH_STATION)}{unitLabel} at 1,550m<br/>
              Start: {convert(START_DEPTH_ALPINE)}{unitLabel} at 2,200m<br/>
              Lapse rate −6.5°C/1,000m<br/>
              Rain events: 1.3–1.8× melt<br/>
              Solar ramp: Apr→Jun +65%
            </div>
          </div>
        </div>
      )}

      {/* Melt phase guide */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'April', rate: '1–3cm/day', note: 'Cold nights, moderate days', color: '#4a9eff' },
          { label: 'Early May', rate: '3–5cm/day', note: 'Longer days, warmer nights', color: '#52b788' },
          { label: 'Late May', rate: '5–8cm/day', note: 'Collapse phase, high sun', color: '#e67e22' },
          { label: 'June', rate: 'Rapid', note: 'Patches, north faces only', color: '#c0392b' },
        ].map(phase => (
          <div key={phase.label} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, borderLeft: `3px solid ${phase.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{phase.label}</div>
            <div style={{ fontSize: 12, fontFamily: 'DM Mono', color: phase.color, fontWeight: 500 }}>{phase.rate}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{phase.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
