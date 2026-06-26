/**
 * SOBPanel — S.O.B.™ Signals of Breakdown
 *
 * Displays the current S.O.B. level, trend, active pillars,
 * explanation, what changed, and what to watch next.
 *
 * Props:
 *   regime        — current regime label from EngineContext
 *   pressureIndex — current pressure index (0–100)
 *   compact       — if true, shows a condensed single-row summary
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";
import FaultlineTerm from "./FaultlineTerm";

interface SOBPanelProps {
  regime?: string;
  pressureIndex?: number;
  yieldSpread?: number | null;
  fedFundsRate?: number | null;
  vix?: number | null;
  creditSpread?: number | null;
  compact?: boolean;
}

const TREND_ICONS = {
  rising:  <TrendingUp  size={12} style={{ color: "#FF2D55" }} />,
  stable:  <Minus       size={12} style={{ color: "#F59E0B" }} />,
  falling: <TrendingDown size={12} style={{ color: "#00FF88" }} />,
};

const SEVERITY_COLORS = { low: "#4B5563", medium: "#F59E0B", high: "#FF2D55" };

export default function SOBPanel({
  regime,
  pressureIndex = 30,
  yieldSpread,
  fedFundsRate,
  vix,
  creditSpread,
  compact = false,
}: SOBPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: sob, isLoading } = trpc.sob.getSOB.useQuery(
    { regime, pressureIndex, yieldSpread, fedFundsRate, vix, creditSpread },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "8px",
        padding: compact ? "10px 14px" : "16px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        color: "#4B5563",
      }}>
        Computing S.O.B.™…
      </div>
    );
  }

  if (!sob) return null;

  const activePillars = sob.pillars.filter(p => p.active);
  const inactivePillars = sob.pillars.filter(p => !p.active);

  // ── Compact mode: single row ──────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        background: `${sob.color}0A`,
        border: `1px solid ${sob.color}30`,
        borderRadius: "6px",
        cursor: "pointer",
      }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>
          S.O.B.™
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: sob.color }}>
          {sob.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {TREND_ICONS[sob.trend]}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280" }}>
          {sob.level}/6 pillars active
        </div>
        <div style={{ marginLeft: "auto" }}>
          {expanded ? <ChevronUp size={12} style={{ color: "#4B5563" }} /> : <ChevronDown size={12} style={{ color: "#4B5563" }} />}
        </div>
      </div>
    );
  }

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${sob.color}25`,
      borderLeft: `3px solid ${sob.color}`,
      borderRadius: "8px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          cursor: "pointer",
          background: `${sob.color}08`,
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* S.O.B. badge */}
        <div style={{ flexShrink: 0 }}>
          <FaultlineTerm id="sob" variant="badge" />
        </div>

        {/* Level indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "18px",
            fontWeight: 700,
            color: sob.color,
            lineHeight: 1,
          }}>
            {sob.label.toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {TREND_ICONS[sob.trend]}
          </div>
        </div>

        {/* Pillar dots */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {sob.pillars.map((p, i) => (
            <div
              key={i}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: p.active ? sob.color : "rgba(255,255,255,0.08)",
                border: `1px solid ${p.active ? sob.color : "rgba(255,255,255,0.12)"}`,
                transition: "all 0.2s",
              }}
              title={p.name}
            />
          ))}
        </div>

        {/* Confidence */}
        <div style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563" }}>
          {sob.confidence}% confidence
        </div>

        {expanded
          ? <ChevronUp size={14} style={{ color: "#4B5563", flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: "#4B5563", flexShrink: 0 }} />}
      </div>

      {/* Summary bar */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.6 }}>
          {sob.explanation}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "14px 16px" }}>
          {/* Pillar grid */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
              Pillars ({activePillars.length} active / {inactivePillars.length} clear)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "6px" }}>
              {sob.pillars.map(pillar => (
                <div
                  key={pillar.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "8px 10px",
                    background: pillar.active ? `${SEVERITY_COLORS[pillar.severity]}0A` : "rgba(255,255,255,0.01)",
                    border: `1px solid ${pillar.active ? SEVERITY_COLORS[pillar.severity] + "30" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: "4px",
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: "2px" }}>
                    {pillar.active
                      ? <AlertTriangle size={12} style={{ color: SEVERITY_COLORS[pillar.severity] }} />
                      : <CheckCircle size={12} style={{ color: "#1F2937" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 600, color: pillar.active ? SEVERITY_COLORS[pillar.severity] : "#4B5563" }}>
                        {pillar.name}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", flexShrink: 0 }}>
                        {pillar.value}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.5, marginTop: "2px" }}>
                      {pillar.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What changed + Watch next */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", padding: "10px 12px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                What Changed
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.6 }}>
                {sob.whatChanged}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", padding: "10px 12px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                What To Watch Next
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.6 }}>
                {sob.whatToWatchNext}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", lineHeight: 1.5 }}>
            S.O.B.™ is not a crash prediction system. It measures the accumulation of market stress across independent pillars. One signal means awareness. Multiple signals indicate conditions are evolving.
          </div>
        </div>
      )}
    </div>
  );
}
