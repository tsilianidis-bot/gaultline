/* ============================================================
   FAULTLINE — DataIntegrity Panel
   Live feed health indicators, freshness labels, and fallback
   status for all 10 FRED series. Builds trust with users.
   ============================================================ */
import { useState } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff, AlertCircle } from "lucide-react";

interface FeedRow {
  series: string;
  label: string;
  description: string;
  apiSource: string;
}

const FRED_FEEDS: FeedRow[] = [
  { series: "DGS10",         label: "10Y Treasury",       description: "10-Year Constant Maturity Rate",       apiSource: "FRED/DGS10" },
  { series: "DGS30",         label: "30Y Treasury",       description: "30-Year Constant Maturity Rate",       apiSource: "FRED/DGS30" },
  { series: "T10Y2Y",        label: "Yield Curve",        description: "10Y-2Y Spread (Inversion Signal)",     apiSource: "FRED/T10Y2Y" },
  { series: "CPIAUCSL",      label: "CPI Inflation",      description: "Consumer Price Index YoY%",            apiSource: "FRED/CPIAUCSL" },
  { series: "PPIACO",        label: "PPI",                description: "Producer Price Index YoY%",            apiSource: "FRED/PPIACO" },
  { series: "UNRATE",        label: "Unemployment",       description: "Civilian Unemployment Rate",           apiSource: "FRED/UNRATE" },
  { series: "M2SL",          label: "M2 Money Supply",    description: "M2 Monetary Aggregate ($T)",           apiSource: "FRED/M2SL" },
  { series: "BAMLH0A0HYM2",  label: "HY Spread",          description: "ICE BofA US HY Option-Adj Spread",     apiSource: "FRED/BAMLH0A0HYM2" },
  { series: "NFCI",          label: "NFCI",               description: "Chicago Fed National Financial Cond.", apiSource: "FRED/NFCI" },
  { series: "SOFR",          label: "SOFR Rate",          description: "Secured Overnight Financing Rate",     apiSource: "FRED/SOFR" },
];

function FeedStatusDot({ live, loading }: { live: boolean; loading: boolean }) {
  if (loading) return (
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4B5563', flexShrink: 0 }} />
  );
  if (live) return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: '#00FF88',
      boxShadow: '0 0 6px rgba(0,255,136,0.8)',
      animation: 'feed-pulse 2s ease-in-out infinite',
      flexShrink: 0,
    }} />
  );
  return (
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9500', boxShadow: '0 0 6px rgba(255,149,0,0.6)', flexShrink: 0 }} />
  );
}

export default function DataIntegrity() {
  const { rawFred, isLoading, isLive, lastUpdated, dataError, forceRefresh } = useEngine();
  const [expanded, setExpanded] = useState(false);

  const liveCount = FRED_FEEDS.filter(f => rawFred[f.series] != null).length;
  const totalCount = FRED_FEEDS.length;
  const freshness = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 60000)
    : null;

  const statusColor = isLoading ? '#4B5563' : isLive ? '#00FF88' : '#FF9500';
  const statusLabel = isLoading ? 'LOADING' : isLive ? 'LIVE' : 'SIMULATED';

  return (
    <div style={{
      background: 'rgba(10,12,16,0.9)',
      border: `1px solid ${isLive ? 'rgba(0,255,136,0.15)' : 'rgba(255,149,0,0.15)'}`,
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '10px',
      animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) both',
    }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        {/* Status icon */}
        {isLive ? (
          <Wifi size={14} style={{ color: '#00FF88', flexShrink: 0 }} />
        ) : isLoading ? (
          <RefreshCw size={14} style={{ color: '#4B5563', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        ) : (
          <WifiOff size={14} style={{ color: '#FF9500', flexShrink: 0 }} />
        )}

        {/* Label */}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', flex: 1, textAlign: 'left' }}>
          Data Integrity
        </span>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '2px 8px',
          background: `${statusColor}12`,
          border: `1px solid ${statusColor}30`,
          borderRadius: '3px',
        }}>
          <FeedStatusDot live={isLive} loading={isLoading} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: statusColor, letterSpacing: '0.1em' }}>
            {statusLabel}
          </span>
        </div>

        {/* Live count */}
        {!isLoading && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }}>
            {liveCount}/{totalCount}
          </span>
        )}

        {/* Freshness */}
        {freshness !== null && isLive && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: freshness < 5 ? '#00FF88' : freshness < 30 ? '#FFD700' : '#FF9500' }}>
            {freshness < 1 ? 'just now' : `${freshness}m ago`}
          </span>
        )}

        {/* Expand chevron */}
        {expanded
          ? <ChevronUp size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
        }
      </button>

      {/* Error banner */}
      {dataError && !isLive && !isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px',
          background: 'rgba(255,149,0,0.06)',
          borderTop: '1px solid rgba(255,149,0,0.1)',
        }}>
          <AlertCircle size={12} style={{ color: '#FF9500', flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
            {dataError} — Using simulated baseline. All scores and probabilities remain fully functional.
          </span>
        </div>
      )}

      {/* Expanded feed list */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px 14px' }}>
          {/* Refresh button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              St. Louis Federal Reserve · FRED API
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); forceRefresh(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px',
                background: 'rgba(0,212,255,0.06)',
                border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: '3px',
                color: '#00D4FF',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                minHeight: '28px',
              }}
            >
              <RefreshCw size={9} />
              REFRESH
            </button>
          </div>

          {/* Feed rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {FRED_FEEDS.map((feed) => {
              const value = rawFred[feed.series];
              const hasData = value != null;
              return (
                <div
                  key={feed.series}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    background: hasData ? 'rgba(0,255,136,0.03)' : 'rgba(255,255,255,0.02)',
                    borderRadius: '3px',
                    border: `1px solid ${hasData ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  <FeedStatusDot live={hasData} loading={isLoading} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#D1D5DB', letterSpacing: '0.06em' }}>
                        {feed.label}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>
                        {feed.apiSource}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#4B5563', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {feed.description}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: hasData ? '#00FF88' : '#4B5563', flexShrink: 0 }}>
                    {isLoading ? '—' : hasData ? value!.toFixed(2) : 'SIM'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#374151', lineHeight: 1.5, margin: 0 }}>
              Data sourced from the St. Louis Federal Reserve (FRED). Refreshes every 15 minutes.
              When live data is unavailable, FAULTLINE uses calibrated baseline values that preserve
              the full analytical engine. <strong style={{ color: '#4B5563' }}>Not financial advice.</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
