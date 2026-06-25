/*
   FAULTLINE — DataFreshnessBadge (Trust Layer)
   Shows how fresh a data source is with a color-coded badge.
   ============================================================ */
import React from "react";
import { Clock, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

type FreshnessLevel = "live" | "fresh" | "stale" | "old" | "loading";

interface DataFreshnessBadgeProps {
  /** Timestamp of when data was last generated/fetched (ms since epoch) */
  generatedAt?: number | null;
  /** Override the freshness level directly */
  level?: FreshnessLevel;
  /** Label for the data source (e.g., "FRED", "Signals", "Day Trade") */
  source?: string;
  /** Whether data is currently being refreshed */
  isRefreshing?: boolean;
  /** Compact mode — just the dot + age, no label */
  compact?: boolean;
  /** Custom thresholds in minutes: [live, fresh, stale] — defaults: [5, 30, 120] */
  thresholds?: [number, number, number];
}

function getFreshnessLevel(
  generatedAt: number,
  thresholds: [number, number, number]
): FreshnessLevel {
  const ageMs = Date.now() - generatedAt;
  const ageMin = ageMs / 60_000;
  if (ageMin <= thresholds[0]) return "live";
  if (ageMin <= thresholds[1]) return "fresh";
  if (ageMin <= thresholds[2]) return "stale";
  return "old";
}

function formatAge(generatedAt: number): string {
  const ageMs = Date.now() - generatedAt;
  const ageMin = Math.floor(ageMs / 60_000);
  if (ageMin < 1) return "just now";
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h ago`;
  return `${Math.floor(ageHr / 24)}d ago`;
}

const LEVEL_CONFIG: Record<FreshnessLevel, {
  color: string;
  bg: string;
  border: string;
  label: string;
  icon: React.ReactNode;
}> = {
  live: {
    color: "#00FF88",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.25)",
    label: "LIVE",
    icon: <CheckCircle size={9} />,
  },
  fresh: {
    color: "#00D4FF",
    bg: "rgba(0,212,255,0.06)",
    border: "rgba(0,212,255,0.2)",
    label: "FRESH",
    icon: <Clock size={9} />,
  },
  stale: {
    color: "#FFD700",
    bg: "rgba(255,215,0,0.06)",
    border: "rgba(255,215,0,0.2)",
    label: "STALE",
    icon: <Clock size={9} />,
  },
  old: {
    color: "#FF9500",
    bg: "rgba(255,149,0,0.06)",
    border: "rgba(255,149,0,0.2)",
    label: "OLD",
    icon: <AlertTriangle size={9} />,
  },
  loading: {
    color: "#6B7280",
    bg: "rgba(107,114,128,0.06)",
    border: "rgba(107,114,128,0.15)",
    label: "LOADING",
    icon: <RefreshCw size={9} />,
  },
};

export default function DataFreshnessBadge({
  generatedAt,
  level: levelOverride,
  source,
  isRefreshing,
  compact = false,
  thresholds = [5, 30, 120],
}: DataFreshnessBadgeProps) {
  const level: FreshnessLevel = isRefreshing
    ? "loading"
    : levelOverride
    ?? (generatedAt != null ? getFreshnessLevel(generatedAt, thresholds) : "loading");

  const cfg = LEVEL_CONFIG[level];
  const age = generatedAt != null ? formatAge(generatedAt) : null;

  if (compact) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        color: cfg.color,
        letterSpacing: "0.08em",
      }}>
        <span style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: cfg.color,
          boxShadow: level === "live" ? `0 0 5px ${cfg.color}` : "none",
          animation: level === "live" ? "pulse 2s infinite" : level === "loading" ? "spin 1s linear infinite" : "none",
          flexShrink: 0,
        }} />
        {age ?? cfg.label}
      </span>
    );
  }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "2px 7px",
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: "3px",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "9px",
      color: cfg.color,
      letterSpacing: "0.08em",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        animation: level === "loading" ? "spin 1s linear infinite" : "none",
        display: "flex",
        alignItems: "center",
      }}>
        {cfg.icon}
      </span>
      {source && <span style={{ color: "rgba(255,255,255,0.4)" }}>{source}</span>}
      {source && <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>}
      <span>{age ?? cfg.label}</span>
    </span>
  );
}

/** Convenience: a row of freshness badges for multiple data sources */
export function FreshnessRow({
  items,
}: {
  items: Array<{
    source: string;
    generatedAt?: number | null;
    isRefreshing?: boolean;
    thresholds?: [number, number, number];
  }>;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
      {items.map(item => (
        <DataFreshnessBadge
          key={item.source}
          source={item.source}
          generatedAt={item.generatedAt}
          isRefreshing={item.isRefreshing}
          thresholds={item.thresholds}
        />
      ))}
    </div>
  );
}
