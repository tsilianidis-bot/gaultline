import type { ForecastMetadata } from "@shared/forecastMetadata";

export function ForecastHorizonDisclosure({ metadata, compact = false }: { metadata: ForecastMetadata; compact?: boolean }) {
  const supported = metadata.expectedHorizonStatus === "SUPPORTED";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: compact ? "5px" : "8px", marginTop: compact ? "2px" : "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: compact ? "8px" : "9px", letterSpacing: "0.08em" }}>
      <span style={{ color: "rgba(148,163,184,0.55)" }}>TIME HORIZON</span>
      <span style={{ color: supported ? "#00D4FF" : "#94A3B8" }}>{supported ? metadata.expectedHorizon : metadata.horizonDisclosure.toUpperCase()}</span>
    </div>
  );
}
