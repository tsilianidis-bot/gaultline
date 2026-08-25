// ============================================================
// FAULTLINE — FRED Debug Console v2
//
// Shows canonical source health and per-vector FRED status.
// Data sourced from marketState.sourceHealth + pressure vectors.
// Admin-only diagnostic tool.
// ============================================================
import { useState } from 'react';
import { useEngine } from '@/contexts/EngineContext';

const STATUS_COLOR: Record<string, string> = {
  healthy:     '#00FF88',
  degraded:    '#FF9500',
  unavailable: '#FF2D55',
  live:        '#00FF88',
  fallback:    '#FF9500',
  cached:      '#00D4FF',
  delayed:     '#FF9500',
  static:      '#A78BFA',
};

const STATUS_LABEL: Record<string, string> = {
  healthy:     'LIVE',
  degraded:    'DEGRADED',
  unavailable: 'UNAVAILABLE',
  live:        'LIVE',
  fallback:    'FALLBACK',
  cached:      'CACHED',
  delayed:     'DELAYED',
  static:      'STATIC',
};

export default function FREDDebugConsole() {
  const [open, setOpen] = useState(false);
  const { sourceHealth, isLoading, lastUpdated, canonicalState, refresh } = useEngine();
  const canonicalEngines = canonicalState?.engines ?? [];

  const fredSource = sourceHealth.find(s => s.id === 'fred');
  const requiredSources = sourceHealth.filter(s => s.required);
  const allHealthy = requiredSources.every(s => s.status === 'healthy');
  const overallStatus = isLoading ? 'LOADING' : allHealthy ? 'LIVE' : 'DEGRADED';
  const overallColor = isLoading ? '#FF9500' : allHealthy ? '#00FF88' : '#FF2D55';

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '12px',
          zIndex: 9999,
          background: allHealthy ? 'rgba(0,255,136,0.15)' : 'rgba(255,45,85,0.15)',
          border: `1px solid ${allHealthy ? 'rgba(0,255,136,0.4)' : 'rgba(255,45,85,0.4)'}`,
          borderRadius: '4px',
          padding: '4px 8px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          color: overallColor,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: overallColor,
          animation: isLoading ? 'pulse-gold 1s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        {overallStatus}
      </button>

      {/* Console panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '110px',
          right: '8px',
          width: 'min(360px, calc(100vw - 16px))',
          maxHeight: '70vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 9998,
          background: 'rgba(5, 6, 8, 0.97)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '6px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
          boxSizing: 'border-box',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.1)',
            background: 'rgba(0,212,255,0.04)',
            gap: '8px',
          }}>
            <span style={{ color: '#00D4FF', letterSpacing: '0.1em', fontWeight: 700, fontSize: '9px', whiteSpace: 'nowrap' }}>
              FRED DEBUG CONSOLE
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => { refresh(); }}
                style={{ background: 'transparent', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '3px', padding: '2px 6px', color: '#00D4FF', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}
              >
                REFRESH
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Summary row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1px',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.08)',
          }}>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>STATUS</div>
              <div style={{ color: overallColor, fontWeight: 700, fontSize: '10px' }}>{overallStatus}</div>
            </div>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>FRED</div>
              <div style={{ color: STATUS_COLOR[fredSource?.status ?? 'unavailable'] ?? '#FF2D55', fontWeight: 700, fontSize: '10px' }}>
                {STATUS_LABEL[fredSource?.status ?? 'unavailable'] ?? 'UNKNOWN'}
              </div>
            </div>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>UPDATED</div>
              <div style={{ color: '#94A3B8', fontSize: '9px' }}>
                {lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
          </div>

          {/* FRED detail */}
          {fredSource && (
            <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,212,255,0.06)', background: 'rgba(0,212,255,0.02)' }}>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '3px' }}>FRED MACRO &amp; CREDIT</div>
              <div style={{ color: '#94A3B8', fontSize: '9px', lineHeight: '1.5', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {fredSource.detail}
              </div>
              {fredSource.asOf && (
                <div style={{ color: '#4B5563', fontSize: '8px', marginTop: '3px' }}>
                  as of {new Date(fredSource.asOf).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )}

          {/* Canonical engines — per-engine source and quality evidence */}
          {canonicalEngines.length > 0 && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ padding: '4px 12px 2px', color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em' }}>
                CANONICAL ENGINES · {canonicalState?.stateId ?? 'UNAVAILABLE'}
              </div>
              {canonicalEngines.map(engine => {
                const ds = engine.freshnessStatus?.toLowerCase() ?? 'unknown';
                const dotColor = STATUS_COLOR[ds] ?? '#6B7280';
                return (
                  <div
                    key={engine.engineId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '6px 1fr auto',
                      gap: '8px',
                      alignItems: 'start',
                      padding: '5px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, marginTop: '3px', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#E2E8F0', fontSize: '9px', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {engine.engineName ?? engine.engineId}
                      </div>
                      <div style={{ color: '#374151', fontSize: '8px', wordBreak: 'break-word', lineHeight: '1.4', marginTop: '1px' }}>
                        {engine.engineId}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#00D4FF', fontWeight: 700, fontSize: '10px' }}>{engine.value ?? '—'}</div>
                      <div style={{ color: dotColor, fontSize: '8px', letterSpacing: '0.06em' }}>
                        {STATUS_LABEL[ds] ?? ds.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Provider health — all sources */}
          <div style={{ padding: '4px 0', borderTop: '1px solid rgba(0,212,255,0.06)' }}>
            <div style={{ padding: '4px 12px 2px', color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em' }}>
              PROVIDER HEALTH
            </div>
            {sourceHealth.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '6px 1fr auto',
                  gap: '8px',
                  alignItems: 'start',
                  padding: '4px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: STATUS_COLOR[s.status] ?? '#6B7280', marginTop: '3px', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#CBD5E1', fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.label ?? s.id}
                  </div>
                  {s.status !== 'healthy' && s.detail && (
                    <div style={{ color: '#4B5563', fontSize: '8px', wordBreak: 'break-word', lineHeight: '1.4', marginTop: '1px' }}>
                      {s.detail}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ color: STATUS_COLOR[s.status] ?? '#6B7280', fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em' }}>
                    {STATUS_LABEL[s.status] ?? s.status.toUpperCase()}
                  </div>
                  {!s.required && (
                    <div style={{ color: '#374151', fontSize: '7px', letterSpacing: '0.06em' }}>OPTIONAL</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '6px 12px',
            borderTop: '1px solid rgba(0,212,255,0.08)',
            color: '#374151',
            fontSize: '8px',
            letterSpacing: '0.08em',
            wordBreak: 'break-word',
          }}>
            REQUIRED: seismograph · historical-memory · fred · OPTIONAL: coingecko
          </div>
        </div>
      )}
    </>
  );
}
