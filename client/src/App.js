import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FreezeLevel from './components/FreezeLevel';
import StationGrid from './components/StationGrid';
import HistoricalChart from './components/HistoricalChart';
import CameraPanel from './components/CameraPanel';
import ForecastTable from './components/ForecastTable';
import ShootWindow from './components/ShootWindow';

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
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchAll]);

  const triggerFetch = async () => {
    setTriggering(true);
    try {
      await fetch(`${API}/trigger/fetch`, { method: 'POST' });
      await fetchAll();
    } finally {
      setTriggering(false);
    }
  };

  const triggerCapture = async () => {
    setTriggering(true);
    try {
      await fetch(`${API}/trigger/capture`, { method: 'POST' });
      await fetchAll();
    } finally {
      setTriggering(false);
    }
  };

  const triggerDigest = async () => {
    if (!window.confirm('Send daily digest email now?')) return;
    setTriggering(true);
    try {
      const res = await fetch(`${API}/trigger/digest`, { method: 'POST' });
      const data = await res.json();
      alert(data.success ? 'Digest sent!' : `Failed: ${data.error}`);
    } finally {
      setTriggering(false);
    }
  };

  const daysOut = status?.days_out ?? '—';
  const brohmForecast = forecasts['Brohm Ridge'] || [];
  const goatForecast = forecasts['Goat Ridge'] || [];

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-inner">
          <div className="loading-icon">🏔️</div>
          <div className="loading-text">Loading weather data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-eyebrow">FIELD TRIP PRODUCTION</div>
          <h1 className="header-title">Brooks Shoot Monitor</h1>
          <div className="header-sub">Black Tusk · Garibaldi · June 10–11, 2026</div>
        </div>
        <div className="header-right">
          <div className="days-count">
            <span className="days-number">{daysOut}</span>
            <span className="days-label">days out</span>
          </div>
        </div>
      </header>

      {/* Config warnings */}
      {status && (!status.wu_configured || !status.email_configured) && (
        <div className="config-banner">
          {!status.wu_configured && (
            <span>⚠️ Add <code>WU_API_KEY</code> to Railway env vars for live PWS data</span>
          )}
          {!status.email_configured && (
            <span>⚠️ Add <code>SMTP_USER</code> + <code>DIGEST_TO</code> for daily email digests</span>
          )}
        </div>
      )}

      <div className="app-body">

        {/* Shoot window callout */}
        <ShootWindow
          brohmForecast={brohmForecast}
          goatForecast={goatForecast}
          normals={normals}
        />

        {/* Freezing level chart */}
        <section className="section">
          <div className="section-header">
            <h2>Freezing Level Forecast</h2>
            <span className="section-sub">16-day outlook — all locations</span>
          </div>
          <FreezeLevel forecasts={forecasts} />
        </section>

        {/* Station grid */}
        <section className="section">
          <div className="section-header">
            <h2>Live Station Network</h2>
            <span className="section-sub">
              {readings.length > 0
                ? `${readings.length} stations active`
                : 'Configure WU_API_KEY for live readings'}
            </span>
          </div>
          <StationGrid readings={readings} hobolink={status?.hobolink} />
        </section>

        {/* Historical chart */}
        <section className="section">
          <div className="section-header">
            <h2>Brohm Ridge Historical — June Baseline</h2>
            <span className="section-sub">2024 + 2025 actuals at 1,550m · BTSC sensor data</span>
          </div>
          <HistoricalChart normals={normals} />
        </section>

        {/* 16-day forecast table */}
        <section className="section">
          <div className="section-header">
            <h2>16-Day Forecast Detail</h2>
            <span className="section-sub">Open-Meteo HRDPS model · Updated every 6h</span>
          </div>
          <ForecastTable brohmForecast={brohmForecast} goatForecast={goatForecast} />
        </section>

        {/* Camera panel */}
        <section className="section">
          <div className="section-header">
            <h2>Camera Archive</h2>
            <span className="section-sub">Daily 9am PT snapshot · building timelapse to June 11</span>
          </div>
          <CameraPanel cameras={cameras} />
        </section>

        {/* Controls */}
        <section className="section controls-section">
          <div className="section-header">
            <h2>Controls</h2>
            <span className="section-sub">
              Last refresh: {lastRefresh ? lastRefresh.toLocaleTimeString('en-CA') : '—'}
            </span>
          </div>
          <div className="controls-grid">
            <button className="ctrl-btn" onClick={fetchAll} disabled={triggering}>
              🔄 Refresh Dashboard
            </button>
            <button className="ctrl-btn" onClick={triggerFetch} disabled={triggering}>
              📡 {triggering ? 'Fetching…' : 'Fetch New Data'}
            </button>
            <button className="ctrl-btn" onClick={triggerCapture} disabled={triggering}>
              📸 Capture Cameras Now
            </button>
            <button className="ctrl-btn" onClick={triggerDigest} disabled={triggering}>
              📧 Send Email Digest
            </button>
          </div>
          {status && (
            <div className="system-status">
              <div className={`status-pill ${status.wu_configured ? 'ok' : 'warn'}`}>
                WU API {status.wu_configured ? '✓' : '✗ not configured'}
              </div>
              <div className={`status-pill ${status.email_configured ? 'ok' : 'warn'}`}>
                Email {status.email_configured ? '✓' : '✗ not configured'}
              </div>
              <div className={`status-pill ${status.hobolink?.configured ? 'ok' : 'stub'}`}>
                HOBOlink {status.hobolink?.configured ? '✓ live' : '⏳ stub (pending credentials)'}
              </div>
              <div className="status-pill ok">
                Open-Meteo ✓ free
              </div>
            </div>
          )}
        </section>

      </div>

      <footer className="app-footer">
        Brooks WX Monitor · Field Trip Production · {cameras.reduce((a, c) => a + (c.screenshot_count || 0), 0)} screenshots captured
      </footer>
    </div>
  );
}
