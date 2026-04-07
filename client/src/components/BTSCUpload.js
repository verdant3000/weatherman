import React, { useState, useRef } from 'react';

const SENSOR_LABELS = {
  temp_rh: '🌡 Air Temp + RH',
  rain: '🌧 Precipitation',
  pressure: '📊 Barometric Pressure',
  unknown: '❓ Unknown sensor'
};

export default function BTSCUpload({ onUploadSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFiles = async (files) => {
    const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
    if (!csvFiles.length) { setError('Please select CSV files'); return; }

    setUploading(true);
    setResults(null);
    setError(null);

    const formData = new FormData();
    csvFiles.forEach(f => formData.append('csv', f));

    try {
      const res = await fetch('/api/btsc/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResults(data);
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
      >
        <input ref={inputRef} type="file" accept=".csv" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
        <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {uploading ? 'Uploading...' : 'Drop all 3 VDV CSVs here — or click to browse'}
        </div>
        <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)' }}>
          Accepts multiple files · auto-detects AirTemp, Rain, Pressure sensors
        </div>
        <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
          vdv.bgcengineering.ca → dashboard 1423 → export each sensor
        </div>
      </div>

      {results && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--green)', marginBottom: 4 }}>
            ✓ {results.files?.length} file{results.files?.length !== 1 ? 's' : ''} uploaded · {results.total_inserted?.toLocaleString()} new readings added
          </div>
          {results.files?.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px', borderLeft: `3px solid ${f.inserted > 0 ? 'var(--green)' : 'var(--border2)'}` }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>
                {SENSOR_LABELS[f.sensor_type] || f.filename}
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)' }}>
                {f.inserted} new · {f.skipped} existing
                {f.date_range?.from && ` · ${fmtDate(f.date_range.from)} → ${fmtDate(f.date_range.to)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, background: 'var(--red-dim)', border: '1px solid rgba(185,61,61,0.2)', borderRadius: 6, padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--red)' }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
}
