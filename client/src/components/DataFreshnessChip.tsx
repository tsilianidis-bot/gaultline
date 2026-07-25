/**
 * DataFreshnessChip
 *
 * Inline chip that communicates data trust and freshness state.
 * Six states: LIVE · RECENT · STALE · CACHED · ESTIMATED · UNAVAILABLE
 *
 * Usage:
 *   <DataFreshnessChip freshness="live" />
 *   <DataFreshnessChip freshness="stale" tooltip="Last updated 4 hours ago" />
 *   <DataFreshnessChip freshness={marketState?.freshness ?? "stale"} />
 */

import { useState } from "react";
import type { MarketStateFreshness } from "@shared/marketState";

export type DataFreshnessLevel =
  | MarketStateFreshness   // "live" | "recent" | "stale"
  | "cached"
  | "estimated"
  | "unavailable";

interface DataFreshnessChipProps {
  freshness: DataFreshnessLevel;
  /** Optional tooltip text shown on hover */
  tooltip?: string;
  /** Size variant */
  size?: "xs" | "sm";
  /** Show pulsing dot for live state */
  showPulse?: boolean;
}

const FRESHNESS_CONFIG: Record<
  DataFreshnessLevel,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  live:        { label: "LIVE",        color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)",  dot: "#34d399" },
  recent:      { label: "RECENT",      color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)",  dot: "#60a5fa" },
  cached:      { label: "CACHED",      color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)", dot: "#a78bfa" },
  stale:       { label: "STALE",       color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)",  dot: "#fbbf24" },
  estimated:   { label: "ESTIMATED",   color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.25)",  dot: "#fb923c" },
  unavailable: { label: "UNAVAILABLE", color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.15)", dot: "#94a3b8" },
};

export default function DataFreshnessChip({
  freshness,
  tooltip,
  size = "xs",
  showPulse = true,
}: DataFreshnessChipProps) {
  const [hovered, setHovered] = useState(false);
  const cfg = FRESHNESS_CONFIG[freshness] ?? FRESHNESS_CONFIG.unavailable;
  const fontSize = size === "xs" ? "8px" : "9px";
  const px = size === "xs" ? "5px" : "7px";
  const py = size === "xs" ? "2px" : "3px";
  const dotSize = size === "xs" ? "5px" : "6px";

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "4px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: `${py} ${px}`,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: "3px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize,
          fontWeight: 600,
          color: cfg.color,
          letterSpacing: "0.1em",
          cursor: tooltip ? "help" : "default",
          userSelect: "none",
          transition: "opacity 0.15s ease",
        }}
      >
        {/* Pulsing dot for live state */}
        {showPulse && freshness === "live" ? (
          <span style={{ position: "relative", display: "inline-block", width: dotSize, height: dotSize, flexShrink: 0 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: cfg.dot,
                animation: "freshness-pulse 1.8s ease-in-out infinite",
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: "1px",
                borderRadius: "50%",
                background: cfg.dot,
              }}
            />
          </span>
        ) : (
          <span
            style={{
              display: "inline-block",
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: cfg.dot,
              flexShrink: 0,
            }}
          />
        )}
        {cfg.label}
      </span>

      {/* Tooltip */}
      {tooltip && hovered && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "4px",
            padding: "5px 8px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: "#94a3b8",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {tooltip}
        </span>
      )}

      <style>{`
        @keyframes freshness-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </span>
  );
}
