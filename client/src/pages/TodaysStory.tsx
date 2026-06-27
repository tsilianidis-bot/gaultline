/* ============================================================
   FAULTLINE — Today's Story™
   AI-written market narrative: what happened, what changed,
   what institutions are doing, what matters next, and the
   invalidation thesis.
   ============================================================ */
import { useState } from "react";
import {
  BookOpen, RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  Eye, Zap, Shield, Clock, Radio, ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";

// ── Helpers ───────────────────────────────────────────────────
function PressureBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#FF2D55" : score >= 50 ? "#FF9500" : score >= 30 ? "#FFD700" : "#22C55E";
  const label = score >= 70 ? "CRITICAL" : score >= 50 ? "ELEVATED" : score >= 30 ? "MODERATE" : "LOW";
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700,
      color, background: `${color}15`, border: `1px solid ${color}30`,
      padding: "2px 7px", borderRadius: "2px", letterSpacing: "0.12em",
    }}>
      {label} {score}
    </span>
  );
}

function SectionCard({
  icon, label, content, accentColor = "#00D4FF",
}: {
  icon: React.ReactNode;
  label: string;
  content: string;
  accentColor?: string;
}) {
  return (
    <div style={{
      padding: "16px 18px",
      background: "rgba(6,8,12,0.95)",
      border: `1px solid ${accentColor}18`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: "0 6px 6px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
        <span style={{ color: accentColor }}>{icon}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: accentColor, letterSpacing: "0.16em", fontWeight: 700 }}>{label}</span>
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.85)", lineHeight: 1.7, margin: 0 }}>
        {content}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      padding: "16px 18px",
      background: "rgba(6,8,12,0.95)",
      border: "1px solid rgba(255,255,255,0.04)",
      borderLeft: "3px solid rgba(255,255,255,0.06)",
      borderRadius: "0 6px 6px 0",
    }}>
      <div style={{ height: "8px", width: "120px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", marginBottom: "10px" }} />
      <div style={{ height: "10px", width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: "2px", marginBottom: "6px" }} />
      <div style={{ height: "10px", width: "85%", background: "rgba(255,255,255,0.04)", borderRadius: "2px", marginBottom: "6px" }} />
      <div style={{ height: "10px", width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TodaysStory() {
  useSEO({
    title: "Today's Story — FAULTLINE",
    description: "AI-written daily market narrative: what happened, what changed, what institutions are doing, and what matters next.",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = trpc.outlook.getTodaysStory.useQuery(undefined, {
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050608" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: "20px 16px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(6,8,12,0.98)",
      }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <BookOpen size={14} style={{ color: "#00D4FF" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em" }}>TODAY'S STORY</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: "2px" }}>LIVE INTELLIGENCE</span>
              </div>
              <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "clamp(18px, 4vw, 26px)", color: "#E2E8F0", letterSpacing: "0.04em", margin: 0, lineHeight: 1.1 }}>
                {isLoading ? "GENERATING NARRATIVE…" : (data?.headline ?? "MARKET INTELLIGENCE BRIEF")}
              </h1>
              {data && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  <PressureBadge score={data.pressureIndex} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{data.regime}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.3)" }}>
                    {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 12px", borderRadius: "4px",
                background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(100,116,139,0.6)", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em",
                transition: "all 0.15s ease", flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#00D4FF"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.6)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <RefreshCw size={10} style={{ animation: isFetching ? "fl-spin 1s linear infinite" : "none" }} />
              REGENERATE
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px", maxWidth: "760px", margin: "0 auto" }}>

        {/* Error state */}
        {error && (
          <div style={{ padding: "16px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: "6px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertTriangle size={14} style={{ color: "#FF2D55", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", marginBottom: "4px" }}>NARRATIVE GENERATION FAILED</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(255,45,85,0.6)" }}>{error.message}</div>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Story sections */}
        {data && !isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Top callout strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {/* Top opportunity */}
              <div style={{ padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                  <TrendingUp size={10} style={{ color: "#22C55E" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(34,197,94,0.6)", letterSpacing: "0.14em" }}>TOP OPPORTUNITY</span>
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "18px", color: "#22C55E", letterSpacing: "0.06em" }}>{data.topOpportunity}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)", lineHeight: 1.5, marginTop: "3px" }}>{data.topOpportunityReason}</div>
              </div>

              {/* Risk warning */}
              <div style={{ padding: "12px 14px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                  <AlertTriangle size={10} style={{ color: "#FF2D55" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,45,85,0.6)", letterSpacing: "0.14em" }}>RISK WARNING</span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5, marginTop: "3px" }}>{data.riskWarning}</div>
              </div>
            </div>

            {/* Narrative sections */}
            <SectionCard
              icon={<Radio size={12} />}
              label="WHAT HAPPENED"
              content={data.whatHappened}
              accentColor="#00D4FF"
            />
            <SectionCard
              icon={<Zap size={12} />}
              label="WHAT CHANGED"
              content={data.whatChanged}
              accentColor="#FFD700"
            />
            <SectionCard
              icon={<Eye size={12} />}
              label="WHAT INSTITUTIONS ARE DOING"
              content={data.whatInstitutionsAreDoing}
              accentColor="#A78BFA"
            />
            <SectionCard
              icon={<TrendingUp size={12} />}
              label="WHAT MATTERS NEXT"
              content={data.whatMattersNext}
              accentColor="#22C55E"
            />
            <SectionCard
              icon={<Shield size={12} />}
              label="INVALIDATION THESIS"
              content={data.invalidationThesis}
              accentColor="#FF2D55"
            />

            {/* Historical analog */}
            {data.topAnalog && (
              <div style={{ padding: "12px 14px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                  <Clock size={10} style={{ color: "#A78BFA" }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(167,139,250,0.6)", letterSpacing: "0.14em" }}>HISTORICAL ANALOG</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(167,139,250,0.4)", marginLeft: "auto" }}>{data.topAnalog.similarity}% SIMILARITY</span>
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#A78BFA", letterSpacing: "0.06em", marginBottom: "3px" }}>{data.topAnalog.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", lineHeight: 1.5 }}>{data.topAnalog.description}</div>
              </div>
            )}

            {/* CTA strip */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
              <Link href="/app/command" style={{ textDecoration: "none" }}>
                <button style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "4px",
                  background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                  color: "#00D4FF", cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em",
                  transition: "all 0.15s ease",
                }}>
                  COMMAND CENTER <ChevronRight size={10} />
                </button>
              </Link>
              <Link href="/app/opportunities" style={{ textDecoration: "none" }}>
                <button style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "8px 14px", borderRadius: "4px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  color: "#22C55E", cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em",
                  transition: "all 0.15s ease",
                }}>
                  OPPORTUNITY RADAR <ChevronRight size={10} />
                </button>
              </Link>
            </div>

            {/* Footer */}
            <div style={{ marginTop: "8px", padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                <AlertTriangle size={9} style={{ color: "#374151", flexShrink: 0, marginTop: "1px" }} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.06em", lineHeight: 1.6, margin: 0 }}>
                  TODAY'S STORY IS AI-GENERATED FROM LIVE FAULTLINE PRESSURE DATA. IT IS NOT PERSONALIZED FINANCIAL ADVICE. DATA SOURCE: {data.dataSource?.toUpperCase() ?? "LIVE"}. GENERATED AT {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "—"}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
