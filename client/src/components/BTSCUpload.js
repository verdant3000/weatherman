import React, { useState, useRef } from 'react';

export default function BTSCUpload({ onUploadSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    setUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('csv', file);

    try {
      const res = await fetch('/api/btsc/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResult(data);
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
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 6,
          padding: '24px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
          transition: 'all 0.15s',
          marginBottom: 12
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {uploading ? 'Uploading...' : 'Drop VDV CSV here or click to browse'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Download from vdv.bgcengineering.ca → dashboard 1423 → Export
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          background: 'var(--green-dim)', border: '1px solid rgba(62,207,142,0.2)',
          borderRadius: 6, padding: '12px 16px'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', marginBottom: 6 }}>
            ✓ Upload successful
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {result.inserted} new readings added · {result.skipped} already existed<br/>
            {formatDate(result.date_range?.from)} → {formatDate(result.date_range?.to)}<br/>
            {result.total} total rows processed
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(255,92,92,0.2)',
          borderRadius: 6, padding: '10px 14px'
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
            ✗ {error}
          </div>
        </div>
      )}
    </div>
  );
}
