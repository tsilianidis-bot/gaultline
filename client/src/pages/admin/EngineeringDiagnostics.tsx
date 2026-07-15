/**
 * Engineering Diagnostics Hub
 * Admin-only page consolidating all internal engineering, validation,
 * calibration, and monitoring tools.
 *
 * Access: role === "admin" only. Non-admins are redirected to /app/dashboard.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FlaskConical, Shield, Brain, Bookmark, Trophy,
  Activity, BarChart2, Cpu, TrendingUp, AlertTriangle,
  Database, Settings, Zap, Eye, Clock,
} from "lucide-react";

interface DiagTool {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
  category: "validation" | "calibration" | "monitoring" | "simulation" | "audit";
  badge?: string;
}

const DIAG_TOOLS: DiagTool[] = [
  // ── Validation ─────────────────────────────────────────────
  {
    id: "validation-lab",
    label: "Validation Lab",
    description: "Brier scores, ECE, reliability curves, confidence distribution charts, and calibration error metrics for all model outputs.",
    path: "/app/validation-lab",
    icon: FlaskConical,
    category: "validation",
    badge: "CALIBRATION",
  },
  {
    id: "intelligence-validation",
    label: "Intelligence Validation",
    description: "Validate ASHA and AI recommendation outputs against realized outcomes. Tracks accuracy, precision, and recall by regime.",
    path: "/app/intelligence-validation",
    icon: Brain,
    category: "validation",
    badge: "AI QA",
  },
  {
    id: "fmos-health",
    label: "FMOS Health Monitor",
    description: "Full system health dashboard: engine uptime, data freshness, API latency, cache hit rates, and error telemetry.",
    path: "/app/fmos-health",
    icon: Shield,
    category: "monitoring",
    badge: "SYSTEM",
  },
  // ── Audit & Ledger ─────────────────────────────────────────
  {
    id: "decision-ledger",
    label: "Decision Ledger",
    description: "Complete audit log of every AI recommendation with regime context, confidence scores, and outcome tracking.",
    path: "/app/decision-ledger",
    icon: Bookmark,
    category: "audit",
    badge: "AUDIT",
  },
  {
    id: "track-record",
    label: "Track Record",
    description: "Historical performance record of FAULTLINE signals and recommendations. Outcome resolution, win/loss rates, and regime-adjusted accuracy.",
    path: "/app/track-record",
    icon: Trophy,
    category: "audit",
    badge: "PERFORMANCE",
  },
  // ── Simulation & Diagnostics ────────────────────────────────
  {
    id: "diagnostic",
    label: "AI Diagnostic Engine",
    description: "Deep-dive AI diagnostic: 4-timeframe scoring, domain breakdown, position guidance engine, and model interpretation layer.",
    path: "/app/diagnostic",
    icon: Cpu,
    category: "simulation",
    badge: "ENGINE",
  },
  {
    id: "simulate",
    label: "Pressure Simulator",
    description: "Simulate custom FAULTLINE Pressure Index scenarios. Adjust individual domain scores and observe regime transitions in real time.",
    path: "/app/simulate",
    icon: Activity,
    category: "simulation",
    badge: "SIMULATOR",
  },
  {
    id: "aftershock",
    label: "Aftershock Engine",
    description: "Post-event analysis engine. Models secondary market effects following major macro shocks.",
    path: "/app/aftershock",
    icon: Zap,
    category: "simulation",
    badge: "ANALYSIS",
  },
  {
    id: "sim-portfolio",
    label: "Simulation Portfolio",
    description: "Simulated $10K → $1M portfolio tracking FAULTLINE signal performance over time.",
    path: "/app/sim-portfolio",
    icon: TrendingUp,
    category: "simulation",
    badge: "BACKTEST",
  },
  // ── Analytics & Monitoring ──────────────────────────────────
  {
    id: "analytics",
    label: "Site Analytics",
    description: "Visitor intelligence, traffic sources, conversion funnels, and engagement metrics.",
    path: "/app/analytics",
    icon: BarChart2,
    category: "monitoring",
    badge: "ANALYTICS",
  },
  {
    id: "reading-history",
    label: "Reading History",
    description: "Full archive of all daily briefings, AI readings, and intelligence reports consumed by the system.",
    path: "/app/reading-history",
    icon: Clock,
    category: "audit",
    badge: "ARCHIVE",
  },
];

const CATEGORY_LABELS: Record<DiagTool["category"], string> = {
  validation: "Model Validation & Calibration",
  calibration: "Calibration",
  monitoring: "System Monitoring & Telemetry",
  simulation: "Simulation & Diagnostics",
  audit: "Audit Logs & Track Record",
};

const CATEGORY_COLORS: Record<DiagTool["category"], string> = {
  validation: "#00D4FF",
  calibration: "#C084FC",
  monitoring: "#FF9500",
  simulation: "#00FF88",
  audit: "#FFD700",
};

const BADGE_COLORS: Record<string, string> = {
  CALIBRATION: "#C084FC",
  "AI QA": "#00D4FF",
  SYSTEM: "#FF9500",
  AUDIT: "#FFD700",
  PERFORMANCE: "#FFD700",
  ENGINE: "#00D4FF",
  SIMULATOR: "#00FF88",
  ANALYSIS: "#FF2D55",
  BACKTEST: "#00FF88",
  ANALYTICS: "#FF9500",
  ARCHIVE: "#888",
};

export default function EngineeringDiagnostics() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();

  // Guard: redirect non-admins immediately
  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      navigate("/app/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading || user?.role !== "admin") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "rgba(255,255,255,0.3)",
        fontSize: "12px",
        letterSpacing: "0.15em",
      }}>
        VERIFYING ACCESS...
      </div>
    );
  }

  // Group tools by category
  const grouped = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    category: cat as DiagTool["category"],
    label,
    color: CATEGORY_COLORS[cat as DiagTool["category"]],
    tools: DIAG_TOOLS.filter(t => t.category === cat),
  })).filter(g => g.tools.length > 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      fontFamily: "'Space Grotesk', sans-serif",
      padding: "32px 24px",
      maxWidth: "1200px",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}>
          <FlaskConical size={24} color="#00D4FF" />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.2em",
            color: "rgba(0,212,255,0.6)",
          }}>
            ADMIN — ENGINEERING DIAGNOSTICS
          </span>
        </div>
        <h1 style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "#fff",
        }}>
          Engineering & Diagnostics Suite
        </h1>
        <p style={{
          marginTop: "8px",
          color: "rgba(255,255,255,0.4)",
          fontSize: "14px",
          lineHeight: 1.6,
          maxWidth: "600px",
        }}>
          Internal tools for model validation, system monitoring, calibration, simulation, and audit.
          All systems run continuously in the background — this hub provides direct access for engineering review.
        </p>
        <div style={{
          marginTop: "16px",
          padding: "10px 16px",
          background: "rgba(255,150,0,0.08)",
          border: "1px solid rgba(255,150,0,0.2)",
          borderRadius: "6px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "11px",
          fontFamily: "'IBM Plex Mono', monospace",
          color: "rgba(255,150,0,0.8)",
          letterSpacing: "0.05em",
        }}>
          <AlertTriangle size={12} />
          RESTRICTED ACCESS — ADMINISTRATOR ONLY
        </div>
      </div>

      {/* Tool Groups */}
      {grouped.map(group => (
        <div key={group.category} style={{ marginBottom: "40px" }}>
          {/* Group header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
            paddingBottom: "10px",
            borderBottom: `1px solid ${group.color}22`,
          }}>
            <div style={{
              width: "3px",
              height: "16px",
              background: group.color,
              borderRadius: "2px",
            }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: group.color,
              textTransform: "uppercase",
            }}>
              {group.label}
            </span>
          </div>

          {/* Tool cards grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "12px",
          }}>
            {group.tools.map(tool => {
              const Icon = tool.icon;
              const badgeColor = tool.badge ? (BADGE_COLORS[tool.badge] ?? "#888") : "#888";
              return (
                <button
                  key={tool.id}
                  onClick={() => navigate(tool.path)}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    padding: "18px 20px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 160ms cubic-bezier(0.23, 1, 0.32, 1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = `${group.color}44`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Icon size={16} color={group.color} />
                      <span style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#fff",
                        letterSpacing: "-0.01em",
                      }}>
                        {tool.label}
                      </span>
                    </div>
                    {tool.badge && (
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "9px",
                        letterSpacing: "0.12em",
                        color: badgeColor,
                        background: `${badgeColor}18`,
                        border: `1px solid ${badgeColor}33`,
                        borderRadius: "3px",
                        padding: "2px 6px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}>
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.6,
                  }}>
                    {tool.description}
                  </p>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: group.color,
                    opacity: 0.6,
                    letterSpacing: "0.05em",
                  }}>
                    <Eye size={10} />
                    {tool.path}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{
        marginTop: "40px",
        paddingTop: "24px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        fontSize: "11px",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "rgba(255,255,255,0.2)",
        lineHeight: 1.8,
      }}>
        <div>All background services — validation, calibration, health checks, telemetry, drift detection, and scheduled jobs — run continuously regardless of whether this dashboard is open.</div>
        <div style={{ marginTop: "4px" }}>No customer-facing functionality depends on this page. Routes remain accessible for direct navigation.</div>
      </div>
    </div>
  );
}
