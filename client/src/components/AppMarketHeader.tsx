import React from "react";

export type MarketTickerDirection = "up" | "down" | "flat";

export interface MarketTickerItem {
  label: string;
  value: string;
  direction: MarketTickerDirection;
}

interface RegimeSummary {
  regime?: string | null;
  confidence?: number | null;
}

export interface MarketIntelligenceHeaderData {
  stockRegime?: RegimeSummary | null;
  cryptoRegime?: RegimeSummary | null;
  alignmentStatus?: string | null;
  alignmentScore?: number | null;
}

interface AppMarketHeaderProps {
  items: MarketTickerItem[];
  intelligence?: MarketIntelligenceHeaderData | null;
  isMobile: boolean;
}

function directionColor(direction: MarketTickerDirection) {
  if (direction === "up") return "#FF9500";
  if (direction === "down") return "#00FF88";
  return "#B0C4D8";
}

function directionGlyph(direction: MarketTickerDirection) {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  return "—";
}

export default function AppMarketHeader({ items, intelligence, isMobile }: AppMarketHeaderProps) {
  return (
    <>
      <div style={{
        background: "rgba(0, 212, 255, 0.04)",
        borderBottom: "1px solid rgba(0, 212, 255, 0.06)",
        overflow: "hidden",
        height: "24px",
        display: "flex",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 0, animation: "ticker-scroll 55s linear infinite", whiteSpace: "nowrap", willChange: "transform" }}>
          {[...items, ...items].map((item, index) => {
            const color = directionColor(item.direction);
            return (
              <span key={`${item.label}-${index}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", paddingRight: "48px" }}>
                <span style={{ color: "#8A9AB0" }}>{item.label} </span>
                <span style={{ color }}>{item.value}</span>
                <span style={{ color, marginLeft: "2px" }}>{directionGlyph(item.direction)}</span>
              </span>
            );
          })}
        </div>
      </div>

      {intelligence && !isMobile && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 16px",
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.14)",
          overflowX: "auto",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>REGIME</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "1px 7px", borderRadius: "3px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", flexShrink: 0 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#8A9AB0", letterSpacing: "0.08em" }}>EQ</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#93C5FD", letterSpacing: "0.06em" }}>{intelligence.stockRegime?.regime ?? "—"}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>{intelligence.stockRegime?.confidence ? `${intelligence.stockRegime.confidence}%` : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "1px 7px", borderRadius: "3px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", flexShrink: 0 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#8A9AB0", letterSpacing: "0.08em" }}>BTC</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FCD34D", letterSpacing: "0.06em" }}>{intelligence.cryptoRegime?.regime ?? "—"}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>{intelligence.cryptoRegime?.confidence ? `${intelligence.cryptoRegime.confidence}%` : ""}</span>
          </div>
          {intelligence.alignmentStatus && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "1px 7px",
              borderRadius: "3px",
              background: intelligence.alignmentScore != null && intelligence.alignmentScore > 65 ? "rgba(16,185,129,0.08)" : intelligence.alignmentScore != null && intelligence.alignmentScore < 35 ? "rgba(239,68,68,0.08)" : "rgba(107,114,128,0.08)",
              border: intelligence.alignmentScore != null && intelligence.alignmentScore > 65 ? "1px solid rgba(16,185,129,0.2)" : intelligence.alignmentScore != null && intelligence.alignmentScore < 35 ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(107,114,128,0.2)",
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#8A9AB0", letterSpacing: "0.08em" }}>ALIGN</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: intelligence.alignmentScore != null && intelligence.alignmentScore > 65 ? "#6EE7B7" : intelligence.alignmentScore != null && intelligence.alignmentScore < 35 ? "#FCA5A5" : "#9CA3AF", letterSpacing: "0.06em" }}>{intelligence.alignmentStatus}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
