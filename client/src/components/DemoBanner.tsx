/**
 * DemoBanner — shown at the top of every page in demo mode.
 * Informs auditors/visitors that they are in read-only demo mode.
 */
import { Eye } from "lucide-react";

export default function DemoBanner() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(90deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)",
        borderBottom: "1px solid rgba(0, 212, 255, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "6px 16px",
        fontSize: "11px",
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.08em",
        color: "#00d4ff",
        boxShadow: "0 2px 12px rgba(0, 212, 255, 0.15)",
      }}
    >
      <Eye size={12} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>DEMO MODE</span>
      <span style={{ color: "rgba(0, 212, 255, 0.6)", margin: "0 4px" }}>—</span>
      <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
        Read-only access · All intelligence features active · Account creation required for full access
      </span>
    </div>
  );
}
