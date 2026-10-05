/* ============================================================
   FAULTLINE — DataIntegrity Panel
   Live feed health indicators, freshness labels, and fallback
   status for FRED / canonical inputs. Display only.
   Explicit states: LIVE / DELAYED / STALE / UNAVAILABLE (etc).
   Never presents stale as current.
   ============================================================ */
import { useMemo, useState } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { formatEt } from "@shared/credibilityLabels";
import { customerIntegrityColor, type CustomerIntegrityLabel } from "@shared/customerIntegrityLabels";

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

function formatAgeMinutes(mins: number | null): string {
  if (mins === null) return "age unknown";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function listPreview(items: string[] | null | undefined, empty: string): string {
  if (!items || items.length === 0) return empty;
  if (items.length <= 4) return items.join(", ");
  return `${items.slice(0, 4).join(", ")} +${items.length - 4} more`;
}

export default function DataIntegrity({ variant = "default" }: { variant?: "default" | "signals" }) {
  const {
    rawFred, isLoading, isLive, integrityLabel, lastUpdated, dataError, forceRefresh, canonicalState, sourceHealth,
  } = useEngine();
  const [expanded, setExpanded] = useState(false);

  const liveCount = FRED_FEEDS.filter(f => rawFred[f.series] != null).length;
  const totalCount = FRED_FEEDS.length;
  const freshnessMins = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 60000)
    : null;
  const lastObsEt = lastUpdated ? formatEt(lastUpdated.getTime()) : null;

  const delayedInputs = (canonicalState?.delayedInputs ?? []) as string[];
  const staleInputs = (canonicalState?.staleInputs ?? []) as string[];
  const unavailableInputs = (canonicalState?.unavailableInputs ?? []) as string[];
  const fallbackInputs = (canonicalState?.fallbackInputs ?? []) as string[];

  const unhealthySources = useMemo(
    () => (sourceHealth ?? []).filter((s) => s.status !== "healthy").map((s) => s.id || "unknown"),
    [sourceHealth],
  );

  const statusColor = isLoading
    ? "#4B5563"
    : customerIntegrityColor(integrityLabel as CustomerIntegrityLabel);
  const statusLabel = isLoading ? "LOADING" : integrityLabel;

  const degraded = !isLoading && integrityLabel !== "LIVE";
  const usable = integrityLabel === "LIVE" || integrityLabel === "DELAYED" || integrityLabel === "CACHED";
  const usabilityText = isLoading
    ? "Checking feed usability…"
    : integrityLabel === "LIVE"
      ? "Signals remain fully usable with live evidence."
      : integrityLabel === "DELAYED"
        ? "Signals remain usable at reduced confidence (publication lag / delayed feeds)."
        : integrityLabel === "STALE"
          ? "Signal confidence reduced — stale observations are not shown as current."
          : integrityLabel === "UNAVAILABLE"
            ? "Signals withheld or non-authoritative until feeds recover."
            : "Signal confidence reduced — do not treat readings as live current.";

  const withheld = [
    ...staleInputs.map((i) => `${i} (stale)`),
    ...unavailableInputs.map((i) => `${i} (unavailable)`),
  ];

  const compactPad = variant === "signals" ? "8px 12px" : "12px 14px";

  return (
    <div
      style={{
        background: 'rgba(10,12,16,0.9)',
        border: `1px solid ${isLive ? 'rgba(0,255,136,0.15)' : 'rgba(255,149,0,0.22)'}`,
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '10px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) both',
      }}
      data-integrity-panel={variant}
      data-integrity-state={statusLabel}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: compactPad,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        {isLive ? (
          <Wifi size={14} style={{ color: '#00FF88', flexShrink: 0 }} />
        ) : isLoading ? (
          <RefreshCw size={14} style={{ color: '#4B5563', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        ) : (
          <WifiOff size={14} style={{ color: '#FF9500', flexShrink: 0 }} />
        )}

        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', flex: 1, textAlign: 'left' }}>
          Data Integrity
        </span>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '2px 8px',
          background: `${statusColor}12`,
          border: `1px solid ${statusColor}30`,
          borderRadius: '3px',
        }} data-integrity-badge={statusLabel}>
          <FeedStatusDot live={isLive} loading={isLoading} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: statusColor, letterSpacing: '0.1em' }}>
            {statusLabel}
          </span>
        </div>

        {!isLoading && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }} data-integrity-feed-count={`${liveCount}/${totalCount}`}>
            {liveCount}/{totalCount}
          </span>
        )}

        {/* Age always shown when known — including DELAYED / STALE / UNAVAILABLE */}
        {freshnessMins !== null && !isLoading && (
          <span
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: freshnessMins < 5 && isLive ? '#00FF88' : freshnessMins < 30 ? '#FFD700' : '#FF9500' }}
            data-integrity-age={formatAgeMinutes(freshnessMins)}
          >
            {formatAgeMinutes(freshnessMins)}
          </span>
        )}

        {expanded
          ? <ChevronUp size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
        }
      </button>

      {/* Degraded integrity detail — answer: feeds, age, usability, withheld */}
      {degraded && (
        <div
          style={{
            padding: '8px 12px 10px',
            borderTop: '1px solid rgba(255,149,0,0.12)',
            background: 'rgba(255,149,0,0.04)',
          }}
          data-integrity-detail="degraded"
        >
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: statusColor, letterSpacing: '0.08em', marginBottom: 4 }}>
            {statusLabel} · CONFIDENCE REDUCED
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }} data-integrity-usability={usable ? "usable-reduced" : "withheld"}>
            {usabilityText}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(148,163,184,0.75)', letterSpacing: '0.04em' }}>
            <span data-integrity-last-obs>
              Last successful observation: {lastObsEt ?? "unavailable"}{freshnessMins !== null ? ` · age ${formatAgeMinutes(freshnessMins)}` : ""}
            </span>
            <span data-integrity-affected-feeds>
              Affected feeds: {listPreview(
                delayedInputs.length || staleInputs.length || unavailableInputs.length || fallbackInputs.length || unhealthySources.length
                  ? [
                      ...delayedInputs.map((i) => `${i}·delayed`),
                      ...staleInputs.map((i) => `${i}·stale`),
                      ...unavailableInputs.map((i) => `${i}·unavailable`),
                      ...fallbackInputs.map((i) => `${i}·fallback`),
                      ...unhealthySources.filter((id) => !delayedInputs.includes(id) && !staleInputs.includes(id) && !unavailableInputs.includes(id)),
                    ]
                  : [],
                liveCount < totalCount ? `${totalCount - liveCount} FRED series missing in panel` : "none listed on canonical snapshot",
              )}
            </span>
            <span data-integrity-withheld>
              Metrics withheld / not current: {listPreview(withheld, integrityLabel === "STALE" || integrityLabel === "UNAVAILABLE" ? "treat panel readings as non-current" : "none explicitly withheld")}
            </span>
          </div>
        </div>
      )}

      {dataError && !isLive && !isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px',
          background: 'rgba(255,149,0,0.06)',
          borderTop: '1px solid rgba(255,149,0,0.1)',
        }}>
          <AlertCircle size={12} style={{ color: '#FF9500', flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
            {dataError} — Last available observation only. Not presented as live current.
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px 14px' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {FRED_FEEDS.map((feed) => {
              const value = rawFred[feed.series];
              const hasData = value != null;
              const feedState = !hasData ? "UNAVAILABLE" : integrityLabel === "LIVE" ? "LIVE" : integrityLabel;
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
                  data-integrity-feed={feed.series}
                  data-integrity-feed-state={feedState}
                >
                  <FeedStatusDot live={hasData && integrityLabel === "LIVE"} loading={isLoading} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#D1D5DB', letterSpacing: '0.06em' }}>
                        {feed.label}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>
                        {feed.apiSource}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: statusColor }}>
                        {feedState}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#4B5563', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {feed.description}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: hasData ? (integrityLabel === "LIVE" ? '#00FF88' : '#FFD700') : '#4B5563', flexShrink: 0 }}>
                    {isLoading ? '—' : hasData ? value!.toFixed(2) : 'N/A'}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#374151', lineHeight: 1.5, margin: 0 }}>
              Data sourced from the St. Louis Federal Reserve (FRED). Explicit states: LIVE / DELAYED / STALE / UNAVAILABLE.
              Delayed or unavailable feeds reduce confidence. Stale values are never shown as current.
              <strong style={{ color: '#4B5563' }}> Not financial advice.</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
