import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FreezeLevel from './components/FreezeLevel';
import FreezeLevelHistory from './components/FreezeLevelHistory';
import StationGrid from './components/StationGrid';
import HistoricalChart from './components/HistoricalChart';
import CameraPanel from './components/CameraPanel';
import ForecastTable from './components/ForecastTable';
import ShootWindow from './components/ShootWindow';
import YearOverYearChart from './components/YearOverYearChart';
import MeltChart from './components/MeltChart';
import BTSCUpload from './components/BTSCUpload';

const API = '/api';

export default function App() {
  const [status, setStatus] = useState(null);
  const [forecasts, setForecasts] = useState({});
  const [normals, setNormals] = useState(null);
  const [readings, setReadings] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [yoyKey, setYoyKey] = useState(0);
  const [units, setUnits] = useState(() => localStorage.getItem('wx_units') || 'metric');

  const setUnitSystem = (u) => {
    setUnits(u);
    localStorage.setItem('wx_units', u);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, forecastRes, normalsRes, readingsRes, camerasRes] = await Promise.allSettled([
        fetch(`${API}/status`).then(r => r.json()),
        fetch(`${API}/forecasts`).then(r => r.json()),
        fetch(`${API}/normals`).then(r => r.json()),
        fetch(`${API}/readings/current`).then(r => r.json()),
        fetch(`${API}/cameras`).then(r => r.json()),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (forecastRes.status === 'fulfilled') setForecasts(forecastRes.value.forecasts || {});
      if (normalsRes.status === 'fulfilled') setNormals(normalsRes.value);
      if (readingsRes.status === 'fulfilled') setReadings(readingsRes.value.pws_readings || []);
      if (camerasRes.status === 'fulfilled') setCameras(camerasRes.value.cameras || []);
      setLastRefresh(new Date());
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const triggerFetch = async () => { setTriggering(true); try { await fetch(`${API}/trigger/fetch`, { method: 'POST' }); await fetchAll(); } finally { setTriggering(false); } };
  const triggerCapture = async () => { setTriggering(true); try { await fetch(`${API}/trigger/capture`, { method: 'POST' }); await fetchAll(); } finally { setTriggering(false); } };
  const triggerDigest = async () => {
    if (!window.confirm('Send digest email now?')) return;
    setTriggering(true);
    try { const res = await fetch(`${API}/trigger/digest`, { method: 'POST' }); const d = await res.json(); alert(d.success ? 'Sent!' : `Failed: ${d.error}`); }
    finally { setTriggering(false); }
  };

  const brohmForecast = forecasts['Brohm Ridge'] || [];
  const goatForecast = forecasts['Goat Ridge'] || [];

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-inner">
        <div className="loading-icon">🏔️</div>
        <div className="loading-text">Loading Weatherman...</div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-eyebrow">Field Trip Production</div>
          <h1 className="header-title">Weatherman</h1>
          <div className="header-sub">Black Tusk · Garibaldi · June 10–11, 2026</div>
        </div>
        <div className="header-actions">
          <div className="unit-toggle">
            <button className={`unit-btn ${units === 'metric' ? 'active' : ''}`} onClick={() => setUnitSystem('metric')}>°C / m</button>
            <button className={`unit-btn ${units === 'imperial' ? 'active' : ''}`} onClick={() => setUnitSystem('imperial')}>°F / ft</button>
          </div>
          <div className="days-count">
            <span className="days-number">{status?.days_out ?? '—'}</span>
            <span className="days-label">days out</span>
          </div>
        </div>
      </header>

      {status && (!status.wu_configured || !status.email_configured) && (
        <div className="config-banner">
          {!status.wu_configured && <span>⚠️ Add <code>WU_API_KEY</code> to Railway for live station data</span>}
          {!status.email_configured && <span>⚠️ Add <code>SMTP_USER</code> + <code>DIGEST_TO</code> for email digests</span>}
        </div>
      )}

      <div className="app-body">

        <ShootWindow brohmForecast={brohmForecast} goatForecast={goatForecast} normals={normals} unitSystem={units} />

        <section className="section">
          <div className="section-header">
            <h2>Freezing Level — Year Over Year</h2>
            <span className="section-sub">Apr 1 – Jun 13 · 2022–2026 · Brohm Ridge coords · reference elevations marked</span>
          </div>
          <FreezeLevelHistory unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Snow Melt Projection</h2>
            <span className="section-sub">Degree-day model · starts 90cm Apr 7 · year-over-year comparison</span>
          </div>
          <MeltChart unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Temperature — Year Over Year</h2>
            <span className="section-sub">Daily high/low at 1,550m · Brohm Ridge BTSC sensor · {status?.btsc_readings ? `${parseInt(status.btsc_readings).toLocaleString()} readings` : 'upload CSV below'}</span>
          </div>
          <YearOverYearChart key={yoyKey} unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>16-Day Forecast</h2>
            <span className="section-sub">Open-Meteo HRDPS · updated every 6h · Apr 1 – Jun 13 window</span>
          </div>
          <ForecastTable brohmForecast={brohmForecast} goatForecast={goatForecast} unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Freezing Level — 16-Day Outlook</h2>
            <span className="section-sub">All locations · reference lines at 1,550m / 1,900m / 2,319m</span>
          </div>
          <FreezeLevel forecasts={forecasts} unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Live Station Network</h2>
            <span className="section-sub">{readings.length > 0 ? `${readings.length} stations active` : 'Add WU_API_KEY for live readings'}</span>
          </div>
          <StationGrid readings={readings} hobolink={status?.hobolink} unitSystem={units} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Camera Archive</h2>
            <span className="section-sub">3× daily · 9am, 1pm, 7pm PT · {cameras.reduce((a, c) => a + (c.screenshot_count || 0), 0)} frames captured</span>
          </div>
          <CameraPanel cameras={cameras} />
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Brohm Ridge Station Data</h2>
            <span className="section-sub">Weekly CSV from VDV · drag and drop to update</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
            <BTSCUpload onUploadSuccess={() => setYoyKey(k => k + 1)} />
            <div className="card" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>How to export</div>
              <ol style={{ paddingLeft: 16, fontSize: 12 }}>
                <li>Log in at <strong>vdv.bgcengineering.ca</strong></li>
                <li>Open dashboard <strong>1423</strong> (Cheekeye Brohm Ridge)</li>
                <li>Set date range → Export as CSV</li>
                <li>Drag file onto the panel</li>
              </ol>
              {status?.btsc_range?.earliest && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>
                  ✓ {parseInt(status.btsc_readings).toLocaleString()} readings · {new Date(status.btsc_range.earliest).toLocaleDateString('en-CA')} → {new Date(status.btsc_range.latest).toLocaleDateString('en-CA')}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section controls-section">
          <div className="section-header">
            <h2>System</h2>
            <span className="section-sub">Last refresh: {lastRefresh ? lastRefresh.toLocaleTimeString('en-CA') : '—'}</span>
          </div>
          <div className="controls-grid">
            <button className="ctrl-btn" onClick={fetchAll} disabled={triggering}>🔄 Refresh</button>
            <button className="ctrl-btn" onClick={triggerFetch} disabled={triggering}>📡 Fetch Data</button>
            <button className="ctrl-btn" onClick={triggerCapture} disabled={triggering}>📸 Capture Cams</button>
            <button className="ctrl-btn" onClick={triggerDigest} disabled={triggering}>📧 Send Digest</button>
          </div>
          <div className="system-status">
            <div className={`status-pill ${status?.wu_configured ? 'ok' : 'warn'}`}>WU {status?.wu_configured ? '✓' : '✗'}</div>
            <div className={`status-pill ${status?.email_configured ? 'ok' : 'warn'}`}>Email {status?.email_configured ? '✓' : '✗'}</div>
            <div className={`status-pill ${status?.hobolink?.configured ? 'ok' : 'stub'}`}>HOBOlink {status?.hobolink?.configured ? '✓' : '⏳'}</div>
            <div className="status-pill ok">Open-Meteo ✓</div>
            <div className={`status-pill ${status?.btsc_readings > 0 ? 'ok' : 'warn'}`}>BTSC {status?.btsc_readings > 0 ? `✓ ${parseInt(status.btsc_readings).toLocaleString()}` : '✗ no data'}</div>
          </div>
        </section>
      </div>

      <footer className="app-footer">
        Weatherman · Field Trip Production · wx.gofieldtrip.ca
      </footer>
    </div>
  );
}
