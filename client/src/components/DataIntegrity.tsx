/* ============================================================
   FAULTLINE — DataIntegrity Panel (display only)
   Per-input freshness comes from the canonical snapshot the client
   already loads (marketState.canonicalCurrent): engines[].sourceInputIds
   plus staleInputs / delayedInputs / unavailableInputs / fallbackInputs,
   and the FRED source entry in marketState.sourceHealth (status, asOf).
   No new fetch, no engine or server logic. The legacy client `rawFred`
   map is always empty, so it is no longer used to count feeds (that
   produced a false "0/10").
   Explicit states: LIVE / DELAYED / STALE / UNAVAILABLE (etc).
   Never presents stale as current.
   ============================================================ */
import { useMemo, useState } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { formatEt } from "@shared/credibilityLabels";
import { customerIntegrityColor, type CustomerIntegrityLabel } from "@shared/customerIntegrityLabels";

export type CanonicalInputState = "CURRENT" | "DELAYED" | "STALE" | "FALLBACK" | "UNAVAILABLE" | "STATIC";

export interface CanonicalInputRow {
  id: string;
  label: string;
  state: CanonicalInputState;
}

const INPUT_LABELS: Record<string, string> = {
  ten_year_treasury_yield: "10Y Treasury",
  two_year_treasury_yield: "2Y Treasury",
  consumer_price_index_yoy: "CPI YoY",
  producer_price_index_yoy: "PPI YoY",
  federal_funds_rate: "Fed Funds",
  unemployment_rate: "Unemployment",
  hy_credit_spread: "HY Spread",
  secured_overnight_financing_rate: "SOFR",
  ai_concentration_static_baseline: "AI Concentration (static baseline)",
};

export function inputLabel(id: string): string {
  if (INPUT_LABELS[id]) return INPUT_LABELS[id];
  const words = id.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

type CanonicalInputsLike = {
  engines?: ReadonlyArray<{ sourceInputIds?: readonly string[] | null }> | null;
  staleInputs?: readonly string[] | null;
  delayedInputs?: readonly string[] | null;
  unavailableInputs?: readonly string[] | null;
  fallbackInputs?: readonly string[] | null;
} | null | undefined;

/**
 * Per-input status from fields already present in the canonical payload.
 * Returns null when the snapshot reports no inputs (status not reported to this view).
 * Precedence: UNAVAILABLE > STALE > FALLBACK > DELAYED > STATIC > CURRENT.
 */
export function canonicalInputRows(state: CanonicalInputsLike): CanonicalInputRow[] | null {
  if (!state) return null;
  const listed = (xs: readonly string[] | null | undefined) => new Set(Array.isArray(xs) ? xs : []);
  const stale = listed(state.staleInputs);
  const delayed = listed(state.delayedInputs);
  const unavailable = listed(state.unavailableInputs);
  const fallback = listed(state.fallbackInputs);
  const ids = new Set<string>();
  for (const e of state.engines ?? []) for (const id of e?.sourceInputIds ?? []) if (id) ids.add(id);
  for (const s of [stale, delayed, unavailable, fallback]) s.forEach((id) => ids.add(id));
  if (ids.size === 0) return null;
  return Array.from(ids).sort().map((id) => {
    const state: CanonicalInputState = unavailable.has(id) ? "UNAVAILABLE"
      : stale.has(id) ? "STALE"
      : fallback.has(id) ? "FALLBACK"
      : delayed.has(id) ? "DELAYED"
      : /static/i.test(id) ? "STATIC"
      : "CURRENT";
    return { id, label: inputLabel(id), state };
  });
}

const STATE_COLOR: Record<CanonicalInputState, string> = {
  CURRENT: "#00FF88",
  DELAYED: "#7DD3FC",
  STALE: "#FBBF24",
  FALLBACK: "#FF9500",
  UNAVAILABLE: "#94A3B8",
  STATIC: "#94A3B8",
};

function formatAgeMinutes(mins: number | null): string {
  if (mins === null) return "age unknown";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function listPreview(items: string[], empty: string): string {
  if (items.length === 0) return empty;
  if (items.length <= 4) return items.join(", ");
  return `${items.slice(0, 4).join(", ")} +${items.length - 4} more`;
}

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}99`, animation: pulse ? 'feed-pulse 2s ease-in-out infinite' : undefined,
    }} />
  );
}

export default function DataIntegrity({ variant = "default" }: { variant?: "default" | "signals" }) {
  const {
    isLoading, isLive, integrityLabel, lastUpdated, dataError, forceRefresh, canonicalState, sourceHealth,
  } = useEngine();
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => canonicalInputRows(canonicalState as CanonicalInputsLike), [canonicalState]);
  const fredSource = (sourceHealth ?? []).find((s) => s.id === "fred") ?? null;
  const reported = rows !== null;

  const count = (s: CanonicalInputState) => (rows ?? []).filter((r) => r.state === s).length;
  const nDelayed = count("DELAYED");
  const nStale = count("STALE");
  const nUnavailable = count("UNAVAILABLE");
  const nFallback = count("FALLBACK");
  const total = rows?.length ?? 0;
  const countParts = [
    `${total} INPUTS`,
    nDelayed ? `${nDelayed} DELAYED` : null,
    nStale ? `${nStale} STALE` : null,
    nFallback ? `${nFallback} FALLBACK` : null,
    nUnavailable ? `${nUnavailable} UNAVAILABLE` : null,
  ].filter(Boolean).join(" · ");

  // Last successful observation: the FRED source's own asOf when reported, else the market-state update time.
  const fredAsOfMs = fredSource?.asOf ? new Date(fredSource.asOf).getTime() : NaN;
  const lastObsMs = Number.isFinite(fredAsOfMs) ? fredAsOfMs : lastUpdated ? lastUpdated.getTime() : null;
  const lastObsEt = lastObsMs !== null ? formatEt(lastObsMs) : null;
  const ageMins = lastObsMs !== null ? Math.max(0, Math.round((Date.now() - lastObsMs) / 60000)) : null;

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
        ? "Signals remain usable at reduced confidence (publication lag / delayed inputs)."
        : integrityLabel === "STALE"
          ? "Signal confidence reduced — stale observations are not shown as current."
          : integrityLabel === "UNAVAILABLE"
            ? "Signals withheld or non-authoritative until feeds recover."
            : "Signal confidence reduced — do not treat readings as live current.";

  const affected = (rows ?? []).filter((r) => r.state !== "CURRENT" && r.state !== "STATIC").map((r) => `${r.label}·${r.state.toLowerCase()}`);
  const withheld = (rows ?? []).filter((r) => r.state === "STALE" || r.state === "UNAVAILABLE").map((r) => `${r.label} (${r.state.toLowerCase()})`);

  const pad = variant === "signals" ? "8px 12px" : "12px 14px";

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
      data-integrity-feeds-reported={reported ? "canonical" : "not-reported"}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: pad, background: 'transparent', border: 'none', cursor: 'pointer', minHeight: '44px', flexWrap: 'wrap' }}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', background: `${statusColor}12`, border: `1px solid ${statusColor}30`, borderRadius: '3px' }} data-integrity-badge={statusLabel}>
          <StatusDot color={statusColor} pulse={isLive} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: statusColor, letterSpacing: '0.1em' }}>
            {statusLabel}
          </span>
        </div>

        {!isLoading && (
          reported ? (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#94A3B8', letterSpacing: '0.06em' }} data-integrity-feed-count={countParts}>
              {countParts}
            </span>
          ) : (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#94A3B8', letterSpacing: '0.06em' }} data-integrity-feed-count="not-reported">
              FEED STATUS UNAVAILABLE · not reported to this view
            </span>
          )
        )}

        {ageMins !== null && !isLoading && (
          <span
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: ageMins < 5 && isLive ? '#00FF88' : ageMins < 30 ? '#FFD700' : '#FF9500' }}
            data-integrity-age={formatAgeMinutes(ageMins)}
          >
            {formatAgeMinutes(ageMins)}
          </span>
        )}

        {expanded
          ? <ChevronUp size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ color: '#4B5563', flexShrink: 0 }} />
        }
      </button>

      {degraded && (
        <div style={{ padding: '8px 12px 10px', borderTop: '1px solid rgba(255,149,0,0.12)', background: 'rgba(255,149,0,0.04)' }} data-integrity-detail="degraded">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: statusColor, letterSpacing: '0.08em', marginBottom: 4 }}>
            {statusLabel} · CONFIDENCE REDUCED
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }} data-integrity-usability={usable ? "usable-reduced" : "withheld"}>
            {usabilityText}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(148,163,184,0.75)', letterSpacing: '0.04em' }}>
            <span data-integrity-last-obs>
              Last successful observation: {lastObsEt ?? "unavailable"}{ageMins !== null ? ` · age ${formatAgeMinutes(ageMins)}` : ""}
            </span>
            <span data-integrity-affected-feeds>
              Affected inputs: {reported ? listPreview(affected, "none listed on canonical snapshot") : "feed status not reported to this view"}
            </span>
            <span data-integrity-withheld>
              Metrics withheld / not current: {reported
                ? listPreview(withheld, integrityLabel === "STALE" || integrityLabel === "UNAVAILABLE" ? "treat panel readings as non-current" : "none explicitly withheld")
                : "feed status not reported to this view"}
            </span>
          </div>
        </div>
      )}

      {dataError && !isLive && !isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(255,149,0,0.06)', borderTop: '1px solid rgba(255,149,0,0.1)' }}>
          <AlertCircle size={12} style={{ color: '#FF9500', flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
            {dataError} — Last available observation only. Not presented as live current.
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: 8 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }} data-integrity-fred-source={fredSource?.status ?? "not-reported"}>
              Canonical snapshot inputs · FRED source {fredSource ? `${fredSource.status.toUpperCase()}${lastObsEt ? ` · as of ${lastObsEt}` : ""}` : "not reported to this view"}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); forceRefresh(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '3px', color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.08em', cursor: 'pointer', minHeight: '28px' }}
            >
              <RefreshCw size={9} />
              REFRESH
            </button>
          </div>

          {reported ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {rows!.map((row) => (
                <div
                  key={row.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.05)' }}
                  data-integrity-feed={row.id}
                  data-integrity-feed-state={row.state}
                >
                  <StatusDot color={STATE_COLOR[row.state]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#D1D5DB', letterSpacing: '0.06em' }}>{row.label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginLeft: 6 }}>{row.id}</span>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: STATE_COLOR[row.state], letterSpacing: '0.08em' }}>{row.state}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#94A3B8' }}>
              UNAVAILABLE · feed status not reported to this view.
            </div>
          )}

          <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#4B5563', lineHeight: 1.5, margin: 0 }}>
              Per-input status is read from the current canonical snapshot (delayed / stale / fallback / unavailable lists).
              Explicit states: LIVE / DELAYED / STALE / UNAVAILABLE. Delayed or unavailable inputs reduce confidence.
              Stale values are never shown as current. <strong style={{ color: '#6B7280' }}>Not financial advice.</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
