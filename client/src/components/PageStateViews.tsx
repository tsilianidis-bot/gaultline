/**
 * PageStateViews
 *
 * Standardized loading, error, and empty state components for all FAULTLINE pages.
 * Ensures consistent UX across all five destinations and utility pages.
 *
 * Components:
 *   <PageLoadingState message="..." />          — Skeleton with animated pulse
 *   <PageErrorState message="..." onRetry={} /> — Error with retry action
 *   <PageEmptyState message="..." />            — Empty state with context
 *   <PageDegradedBanner message="..." />        — Non-blocking degraded data warning
 */

import { AlertTriangle, RefreshCw, Database, Wifi } from "lucide-react";

// ── Shared style constants ─────────────────────────────────────
const MONO: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
};
const RAJDHANI: React.CSSProperties = {
  fontFamily: "'Rajdhani', sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// PageLoadingState
// ─────────────────────────────────────────────────────────────────────────────
interface PageLoadingStateProps {
  /** Primary message shown below the eyebrow */
  message?: string;
  /** Eyebrow label above the message */
  eyebrow?: string;
  /** Whether to show the skeleton rows below the message */
  showSkeleton?: boolean;
}

export function PageLoadingState({
  message = "Loading canonical market state…",
  eyebrow = "FAULTLINE",
  showSkeleton = true,
}: PageLoadingStateProps) {
  return (
    <main className="min-h-[70vh] bg-[#05080d] px-5 py-16 text-white md:px-10">
      <div className="mx-auto max-w-6xl animate-pulse rounded-sm border border-cyan-300/15 bg-cyan-300/[0.025] p-8">
        <p style={{ ...MONO, fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#22d3ee" }}>
          {eyebrow}
        </p>
        <p style={{ ...MONO, fontSize: "11px", color: "#64748b", marginTop: "8px", letterSpacing: "0.06em" }}>
          {message}
        </p>
        {showSkeleton && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ height: "48px", width: "66%", borderRadius: "3px", background: "rgba(255,255,255,0.08)", marginBottom: "12px" }} />
            <div style={{ height: "16px", width: "100%", borderRadius: "3px", background: "rgba(255,255,255,0.05)", marginBottom: "8px" }} />
            <div style={{ height: "16px", width: "83%", borderRadius: "3px", background: "rgba(255,255,255,0.05)", marginBottom: "8px" }} />
            <div style={{ height: "16px", width: "91%", borderRadius: "3px", background: "rgba(255,255,255,0.05)" }} />
          </div>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageErrorState
// ─────────────────────────────────────────────────────────────────────────────
interface PageErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Technical detail (collapsed by default) */
  detail?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Retry button label */
  retryLabel?: string;
}

export function PageErrorState({
  message = "FAULTLINE could not load the requested data.",
  detail,
  onRetry,
  retryLabel = "Retry",
}: PageErrorStateProps) {
  return (
    <main className="min-h-[70vh] bg-[#05080d] px-5 py-16 text-white md:px-10">
      <div className="mx-auto max-w-3xl rounded-sm border border-rose-400/25 bg-rose-400/[0.04] p-8">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <AlertTriangle size={20} style={{ color: "#fb7185", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <p style={{ ...MONO, fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#fb7185", marginBottom: "8px" }}>
              Data unavailable
            </p>
            <p style={{ ...RAJDHANI, fontSize: "20px", fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
              {message}
            </p>
            {detail && (
              <p style={{ ...MONO, fontSize: "10px", color: "#64748b", marginTop: "10px", lineHeight: 1.6 }}>
                {detail}
              </p>
            )}
            <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "12px", lineHeight: 1.6 }}>
              FAULTLINE is preserving the last verified state. The deterministic fallback remains active.
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginTop: "20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  background: "rgba(251,113,133,0.1)",
                  border: "1px solid rgba(251,113,133,0.3)",
                  borderRadius: "3px",
                  ...MONO,
                  fontSize: "9px",
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  color: "#fb7185",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,113,133,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(251,113,133,0.1)")}
              >
                <RefreshCw size={12} />
                {retryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageEmptyState
// ─────────────────────────────────────────────────────────────────────────────
interface PageEmptyStateProps {
  /** Primary message */
  message?: string;
  /** Supporting context */
  detail?: string;
  /** Icon to show (defaults to Database) */
  icon?: "database" | "wifi";
}

export function PageEmptyState({
  message = "No data is available for this view.",
  detail,
  icon = "database",
}: PageEmptyStateProps) {
  const Icon = icon === "wifi" ? Wifi : Database;
  return (
    <main className="min-h-[70vh] bg-[#05080d] px-5 py-16 text-white md:px-10">
      <div className="mx-auto max-w-3xl rounded-sm border border-white/10 bg-white/[0.025] p-8 text-center">
        <Icon size={28} style={{ color: "#334155", margin: "0 auto 16px" }} />
        <p style={{ ...RAJDHANI, fontSize: "20px", fontWeight: 600, color: "#94a3b8" }}>
          {message}
        </p>
        {detail && (
          <p style={{ ...MONO, fontSize: "10px", color: "#475569", marginTop: "10px", lineHeight: 1.6 }}>
            {detail}
          </p>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageDegradedBanner
// Non-blocking amber banner for degraded-but-functional states
// ─────────────────────────────────────────────────────────────────────────────
interface PageDegradedBannerProps {
  /** Warning message */
  message: string;
  /** Optional detail */
  detail?: string;
}

export function PageDegradedBanner({ message, detail }: PageDegradedBannerProps) {
  return (
    <div
      style={{
        borderLeft: "2px solid #fbbf24",
        background: "rgba(251,191,36,0.06)",
        padding: "10px 16px",
        marginBottom: "16px",
        borderRadius: "0 3px 3px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0, marginTop: "1px" }} />
        <div>
          <p style={{ ...MONO, fontSize: "10px", color: "#fcd34d", letterSpacing: "0.06em" }}>{message}</p>
          {detail && (
            <p style={{ ...MONO, fontSize: "9px", color: "#78716c", marginTop: "4px" }}>{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
