import React, { useState } from 'react';

function timeSince(ts) {
  if (!ts) return 'never';
  const diff = Math.floor((Date.now() - new Date(ts)) / 3600000);
  if (diff < 1) return 'less than 1h ago';
  if (diff < 24) return `${diff}h ago`;
  return `${Math.floor(diff / 24)}d ago`;
}

function CameraCard({ camera }) {
  const [imgError, setImgError] = useState(false);
  const hasScreenshot = camera.latest_screenshot && !imgError;
  const count = camera.screenshot_count || 0;

  return (
    <div className="camera-card">
      <div className="camera-img-wrap">
        {hasScreenshot ? (
          <img
            src={`/api/cameras/${camera.id}/image/latest?t=${Date.now()}`}
            alt={camera.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="camera-no-img">
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div>{count === 0 ? 'No captures yet' : 'Image unavailable'}</div>
            {count === 0 && (
              <div style={{ marginTop: 6, fontSize: 10, opacity: 0.7 }}>
                First capture at 9am PT
              </div>
            )}
          </div>
        )}

        {/* Elevation badge */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.7)', borderRadius: 3,
          padding: '2px 7px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'white'
        }}>
          {camera.elevation_m?.toLocaleString()}m
        </div>
      </div>

      <div className="camera-info">
        <div className="camera-name">{camera.name}</div>
        <div className="camera-elev">
          {camera.latest_screenshot
            ? `Last captured ${timeSince(camera.latest_screenshot.captured_at)}`
            : 'No captures yet'
          }
        </div>
        <div className="camera-count">
          {count} screenshot{count !== 1 ? 's' : ''} archived
          {count > 0 && ` · ${Math.round(count * 0.066)}% of 69-day target`}
        </div>
        {camera.notes && <div className="camera-notes">{camera.notes}</div>}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <a
            href={camera.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', textDecoration: 'none' }}
          >
            live source ↗
          </a>
          {count > 1 && (
            <a
              href={`/api/cameras/${camera.id}/screenshots`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              archive ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CameraPanel({ cameras }) {
  const totalScreenshots = cameras.reduce((a, c) => a + (c.screenshot_count || 0), 0);

  return (
    <div>
      {/* Timelapse progress */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '14px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            TIMELAPSE PROGRESS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--accent)' }}>
            {totalScreenshots} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>frames captured</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>Apr 2</span>
            <span>Jun 11 (target: ~69 frames)</span>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (totalScreenshots / 69) * 100).toFixed(1)}%`,
              height: '100%', background: 'var(--accent)', borderRadius: 3,
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          Daily 9am PT · BTSC primary · {cameras.length} cameras
        </div>
      </div>

      <div className="camera-grid">
        {cameras.map(cam => (
          <CameraCard key={cam.id} camera={cam} />
        ))}
      </div>

      <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        Timelapse GIF auto-assembles on demand via POST /api/trigger/capture — or manually from the controls above.
        BTSC stair coverage guide: 5+ stairs covered = good alpine snowpack.
      </div>
    </div>
  );
}
