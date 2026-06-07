/* ============================================================
   PageHeader — shared page title / subtitle / breadcrumb
   Used on every app page for consistent clarity.
   ============================================================ */
import { useLocation } from "wouter";
import { LayoutDashboard, ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  /** Optional badge label (e.g. "LIVE", "AI-GENERATED", "DELAYED") */
  badge?: string;
  /** Badge colour: 'green' | 'amber' | 'blue' | 'gray' */
  badgeColor?: "green" | "amber" | "blue" | "gray";
  /** Show ← Dashboard breadcrumb (default true) */
  showBack?: boolean;
  /** Extra content rendered on the right side of the header */
  rightSlot?: React.ReactNode;
}

const BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.25)",  text: "#00FF88" },
  amber: { bg: "rgba(255,149,0,0.08)",  border: "rgba(255,149,0,0.25)",  text: "#FF9500" },
  blue:  { bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.25)",  text: "#00D4FF" },
  gray:  { bg: "rgba(107,114,128,0.12)",border: "rgba(107,114,128,0.25)",text: "#9CA3AF" },
};

export default function PageHeader({
  title,
  subtitle,
  badge,
  badgeColor = "blue",
  showBack = true,
  rightSlot,
}: PageHeaderProps) {
  const [, navigate] = useLocation();
  const bs = BADGE_STYLES[badgeColor];

  return (
    <div style={{
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      padding: "14px 20px 12px",
      background: "rgba(10,12,16,0.6)",
    }}>
      {/* Breadcrumb row */}
      {showBack && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <button
            onClick={() => navigate("/app")}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "transparent", border: "none", cursor: "pointer",
              color: "#4B5563", padding: 0,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
              letterSpacing: "0.1em", textTransform: "uppercase",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00D4FF")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4B5563")}
          >
            <LayoutDashboard size={10} />
            Dashboard
          </button>
          <ChevronRight size={10} style={{ color: "#374151" }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
            color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            {title}
          </span>
        </div>
      )}

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "22px",
              color: "#F0F4FF",
              letterSpacing: "0.06em",
              margin: 0,
              lineHeight: 1.1,
            }}>
              {title}
            </h1>
            {badge && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: "3px",
                background: bs.bg,
                border: `1px solid ${bs.border}`,
                color: bs.text,
                flexShrink: 0,
              }}>
                {badge}
              </span>
            )}
          </div>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "12px",
            color: "#6B7280",
            margin: "4px 0 0",
            lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        </div>
        {rightSlot && (
          <div style={{ flexShrink: 0 }}>
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}
