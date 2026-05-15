// ============================================================
// FAULTLINE — FRED Debug Console (Temporary Diagnostic Tool)
//
// Shows per-series fetch status, live values, success/fail counts.
// Toggle with the [DEBUG] button in the bottom-right corner.
// Remove this component once live data is verified stable.
// ============================================================
import { useState } from 'react';
import { useEngine } from '@/contexts/EngineContext';

const SERIES_LABELS: Record<string, { label: string; unit: string; apiSource: string }> = {
  DGS10:        { label: '10Y Treasury',     unit: '%',   apiSource: 'FRED/DGS10' },
  DGS30:        { label: '30Y Treasury',     unit: '%',   apiSource: 'FRED/DGS30' },
  T10Y2Y:       { label: 'Yield Curve',      unit: 'raw', apiSource: 'FRED/T10Y2Y' },
  CPIAUCSL:     { label: 'CPI Index',        unit: 'idx', apiSource: 'FRED/CPIAUCSL' },
  PPIACO:       { label: 'PPI Index',        unit: 'idx', apiSource: 'FRED/PPIACO' },
  UNRATE:       { label: 'Unemployment',     unit: '%',   apiSource: 'FRED/UNRATE' },
  M2SL:         { label: 'M2 Money Supply',  unit: '$B',  apiSource: 'FRED/M2SL' },
  BAMLH0A0HYM2: { label: 'HY Credit Spread', unit: '%',  apiSource: 'FRED/BAMLH0A0HYM2' },
  NFCI:         { label: 'NFCI Liquidity',   unit: 'idx', apiSource: 'FRED/NFCI' },
  SOFR:         { label: 'SOFR Rate',        unit: '%',   apiSource: 'FRED/SOFR' },
};

export default function FREDDebugConsole() {
  const [open, setOpen] = useState(false);
  const {
    fetchStatuses,
    successCount,
    failCount,
    isLoading,
    isLive,
    lastUpdated,
    dataError,
    rawFred,
    forceRefresh,
  } = useEngine();

  const totalSeries = Object.keys(SERIES_LABELS).length;

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
          background: isLive ? 'rgba(0,255,136,0.15)' : 'rgba(255,45,85,0.15)',
          border: `1px solid ${isLive ? 'rgba(0,255,136,0.4)' : 'rgba(255,45,85,0.4)'}`,
          borderRadius: '4px',
          padding: '4px 8px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          color: isLive ? '#00FF88' : '#FF2D55',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: isLoading ? '#FF9500' : isLive ? '#00FF88' : '#FF2D55',
          animation: isLoading ? 'pulse-gold 1s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        {isLoading ? 'LOADING' : isLive ? `LIVE ${successCount}/${totalSeries}` : `SIM ${successCount}/${totalSeries}`}
      </button>

      {/* Console panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '110px',
          right: '12px',
          width: '340px',
          maxHeight: '480px',
          overflowY: 'auto',
          zIndex: 9998,
          background: 'rgba(5, 6, 8, 0.97)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '6px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.1)',
            background: 'rgba(0,212,255,0.04)',
          }}>
            <span style={{ color: '#00D4FF', letterSpacing: '0.1em', fontWeight: 700 }}>
              FRED DEBUG CONSOLE
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={forceRefresh}
                style={{ background: 'transparent', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '3px', padding: '2px 6px', color: '#00D4FF', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.08em' }}
              >
                REFRESH
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Summary row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '1px',
            background: 'rgba(0,212,255,0.05)',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.08)',
          }}>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>STATUS</div>
              <div style={{ color: isLoading ? '#FF9500' : isLive ? '#00FF88' : '#FF2D55', fontWeight: 700 }}>
                {isLoading ? 'LOADING' : isLive ? 'LIVE' : 'FALLBACK'}
              </div>
            </div>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>SUCCESS</div>
              <div style={{ color: '#00FF88', fontWeight: 700 }}>{successCount}/{totalSeries}</div>
            </div>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>FAILED</div>
              <div style={{ color: failCount > 0 ? '#FF2D55' : '#4B5563', fontWeight: 700 }}>{failCount}</div>
            </div>
            <div>
              <div style={{ color: '#4B5563', fontSize: '8px', letterSpacing: '0.1em', marginBottom: '2px' }}>UPDATED</div>
              <div style={{ color: '#94A3B8' }}>
                {lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </div>
            </div>
          </div>

          {/* Error banner */}
          {dataError && (
            <div style={{ padding: '6px 12px', background: 'rgba(255,45,85,0.08)', borderBottom: '1px solid rgba(255,45,85,0.15)', color: '#FF2D55', fontSize: '9px' }}>
              ⚠ {dataError}
            </div>
          )}

          {/* Per-series rows */}
          <div style={{ padding: '4px 0' }}>
            {fetchStatuses.length === 0 ? (
              <div style={{ padding: '12px', color: '#4B5563', textAlign: 'center' }}>
                {isLoading ? 'Fetching FRED data...' : 'No fetch data yet'}
              </div>
            ) : (
              fetchStatuses.map(s => {
                const meta = SERIES_LABELS[s.seriesId];
                const rawVal = rawFred[s.seriesId];
                const isOk = s.status === 'ok' && s.latestValue !== null;
                return (
                  <div
                    key={s.seriesId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '6px 1fr auto auto',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '5px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: isOk ? '#00FF88' : s.status === 'error' ? '#FF2D55' : '#FF9500',
                      boxShadow: isOk ? '0 0 4px rgba(0,255,136,0.5)' : 'none',
                    }} />

                    {/* Label */}
                    <div>
                      <div style={{ color: '#E2E8F0', fontSize: '9px', letterSpacing: '0.06em' }}>
                        {meta?.label ?? s.seriesId}
                      </div>
                      <div style={{ color: '#374151', fontSize: '8px' }}>
                        {meta?.apiSource ?? s.seriesId}
                        {s.cached && <span style={{ color: '#4B5563', marginLeft: '4px' }}>[cached]</span>}
                      </div>
                    </div>

                    {/* Date */}
                    <div style={{ color: '#4B5563', fontSize: '8px', textAlign: 'right' }}>
                      {s.latestDate ?? '—'}
                    </div>

                    {/* Value */}
                    <div style={{
                      color: isOk ? '#00D4FF' : '#FF2D55',
                      fontWeight: 700,
                      fontSize: '10px',
                      minWidth: '60px',
                      textAlign: 'right',
                    }}>
                      {rawVal != null
                        ? `${rawVal.toFixed(rawVal > 100 ? 1 : 3)} ${meta?.unit ?? ''}`
                        : s.error ?? '—'}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '6px 12px',
            borderTop: '1px solid rgba(0,212,255,0.08)',
            color: '#374151',
            fontSize: '8px',
            letterSpacing: '0.08em',
          }}>
            PROXY: /api/fred/bulk · TTL: 15min · TEMP DIAGNOSTIC TOOL
          </div>
        </div>
      )}
    </>
  );
}
