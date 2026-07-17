/* ============================================================
   ORACLE BRIEFING
   Full-screen classified intelligence report.
   Sections slide into place with precision — no chat bubbles,
   no typing animation, no chatbot feel.
   ============================================================ */
import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────
export interface OracleBriefingData {
  question: string;
  missionId: string;
  timestamp: string;

  // Core assessment
  executiveSummary: string;
  marketBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  marketRegime: string;
  threatLevel: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  pressureIndex: number;
  riskLevel: string;
  suggestedBias?: string;

  // Probability
  bullProbability: number;
  bearProbability: number;

  // Intelligence sections
  keyFindings: string[];
  supportingEvidence: string[];
  historicalAnalog?: string;
  riskFactors: string[];
  invalidationConditions: string[];

  // Verdict
  missionRecommendation: string;
  finalVerdictAction: string;
  expectedTimeframe: string;

  // Follow-ups
  followUpChips?: string[];
}

interface Props {
  data: OracleBriefingData;
  visible: boolean;
  onAskAnother: () => void;
}

// ── Helpers ────────────────────────────────────────────────
function biasColor(bias: string) {
  const b = bias.toUpperCase();
  if (b === "BULLISH") return "#00FF88";
  if (b === "BEARISH") return "#FF4444";
  return "#FFD700";
}

function threatColor(level: string) {
  switch (level) {
    case "LOW": return "#00FF88";
    case "ELEVATED": return "#FFD700";
    case "HIGH": return "#FF8C00";
    case "CRITICAL": return "#FF2222";
    default: return "#94A3B8";
  }
}

function verdictColor(action: string) {
  const a = action.toUpperCase();
  if (["BUY", "ACCUMULATE"].includes(a)) return "#00FF88";
  if (["SELL", "AVOID"].includes(a)) return "#FF4444";
  if (["REDUCE"].includes(a)) return "#FF8C00";
  if (["HOLD", "WATCH"].includes(a)) return "#FFD700";
  return "#00E5FF";
}

// ── Section wrapper with stagger-in animation ──────────────
function BriefingSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.4s cubic-bezier(0.23,1,0.32,1), transform 0.4s cubic-bezier(0.23,1,0.32,1)",
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginBottom: "12px",
    }}>
      <div style={{ height: "1px", width: "20px", background: "rgba(0,229,255,0.4)" }} />
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        letterSpacing: "0.22em",
        color: "rgba(0,229,255,0.6)",
        textTransform: "uppercase",
      }}>{label}</span>
      <div style={{ height: "1px", flex: 1, background: "rgba(0,229,255,0.15)" }} />
    </div>
  );
}

function BulletList({ items, color = "rgba(226,232,240,0.85)" }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span style={{ color: "rgba(0,229,255,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", marginTop: "2px", flexShrink: 0 }}>▸</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "14px", color, lineHeight: 1.55, fontWeight: 500 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Copy button ────────────────────────────────────────────
function CopyButton({ data }: { data: OracleBriefingData }) {
  const [copied, setCopied] = useState(false);
  const text = [
    `ORACLE BRIEFING — MISSION ${data.missionId}`,
    `QUESTION: ${data.question}`,
    ``,
    `EXECUTIVE SUMMARY`,
    data.executiveSummary,
    ``,
    `ASSESSMENT`,
    `Bias: ${data.marketBias} | Confidence: ${data.confidence}% | Regime: ${data.marketRegime}`,
    `Threat: ${data.threatLevel} | Pressure Index: ${data.pressureIndex}/100`,
    ``,
    `KEY FINDINGS`,
    ...data.keyFindings.map(f => `• ${f}`),
    ``,
    `RISK FACTORS`,
    ...data.riskFactors.map(r => `• ${r}`),
    ``,
    `INVALIDATION CONDITIONS`,
    ...data.invalidationConditions.map(c => `• ${c}`),
    ``,
    `MISSION RECOMMENDATION`,
    data.missionRecommendation,
    ``,
    `FINAL VERDICT: ${data.finalVerdictAction} | Time Horizon: ${data.expectedTimeframe}`,
  ].join("\n");

  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      style={{
        background: "transparent",
        border: "1px solid rgba(0,229,255,0.25)",
        borderRadius: "3px",
        padding: "5px 12px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        letterSpacing: "0.12em",
        color: copied ? "#00FF88" : "rgba(0,229,255,0.6)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        textTransform: "uppercase",
      }}
    >
      {copied ? "✓ COPIED" : "COPY BRIEFING"}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────
export default function OracleBriefing({ data, visible, onAskAnother }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [visible]);

  if (!visible) return null;

  const bColor = biasColor(data.marketBias);
  const tColor = threatColor(data.threatLevel);
  const vColor = verdictColor(data.finalVerdictAction);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1900,
      background: "rgba(2,5,12,0.98)",
      display: "flex",
      flexDirection: "column",
      animation: "oracle-enter 0.5s cubic-bezier(0.23,1,0.32,1) both",
      backdropFilter: "blur(24px)",
    }}>
      {/* ── Header bar ── */}
      <div style={{
        flexShrink: 0,
        borderBottom: "1px solid rgba(0,229,255,0.12)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,229,255,0.03)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "8px",
            letterSpacing: "0.28em",
            color: "rgba(0,229,255,0.4)",
            textTransform: "uppercase",
          }}>
            CLASSIFICATION: INTERNAL INTELLIGENCE
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "rgba(0,229,255,0.7)",
            textTransform: "uppercase",
          }}>
            ORACLE BRIEFING &nbsp;·&nbsp; MISSION {data.missionId} &nbsp;·&nbsp; {data.timestamp}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CopyButton data={data} />
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.12em",
            color: "#00FF88",
            textTransform: "uppercase",
          }}>
            ● STATUS: ANALYSIS COMPLETE
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        maxWidth: "900px",
        width: "100%",
        margin: "0 auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(0,229,255,0.15) transparent",
      }}>

        {/* ── Question ── */}
        <BriefingSection delay={0}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.2em",
            color: "rgba(0,229,255,0.45)",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}>INTELLIGENCE REQUEST</div>
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(18px, 3vw, 26px)",
            color: "#E2E8F0",
            lineHeight: 1.3,
          }}>
            {data.question}
          </div>
        </BriefingSection>

        {/* ── Executive Summary ── */}
        <BriefingSection delay={80}>
          <SectionHeader label="EXECUTIVE SUMMARY" />
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "clamp(14px, 1.8vw, 16px)",
            color: "rgba(226,232,240,0.9)",
            lineHeight: 1.7,
            fontWeight: 500,
            padding: "14px 16px",
            background: "rgba(0,229,255,0.04)",
            border: "1px solid rgba(0,229,255,0.12)",
            borderLeft: "3px solid rgba(0,229,255,0.4)",
            borderRadius: "0 4px 4px 0",
          }}>
            {data.executiveSummary}
          </div>
        </BriefingSection>

        {/* ── Assessment grid ── */}
        <BriefingSection delay={160}>
          <SectionHeader label="MARKET ASSESSMENT" />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "10px",
          }}>
            {[
              { label: "MARKET BIAS", value: data.marketBias, color: bColor },
              { label: "CONFIDENCE", value: `${data.confidence}%`, color: "#E2E8F0" },
              { label: "BULL PROBABILITY", value: `${data.bullProbability}%`, color: "#00FF88" },
              { label: "BEAR PROBABILITY", value: `${data.bearProbability}%`, color: "#FF4444" },
              { label: "MARKET REGIME", value: data.marketRegime, color: "#E2E8F0" },
              { label: "THREAT LEVEL", value: data.threatLevel, color: tColor },
              { label: "PRESSURE INDEX", value: `${data.pressureIndex}/100`, color: "#E2E8F0" },
              { label: "RISK LEVEL", value: data.riskLevel, color: "#E2E8F0" },
            ].map(item => (
              <div key={item.label} style={{
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.7)", textTransform: "uppercase" }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: item.color, letterSpacing: "0.04em" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {data.suggestedBias && (
            <div style={{
              marginTop: "10px",
              padding: "10px 14px",
              background: "rgba(0,229,255,0.04)",
              border: "1px solid rgba(0,229,255,0.15)",
              borderRadius: "4px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(0,229,255,0.5)", textTransform: "uppercase", flexShrink: 0 }}>RECOMMENDED BIAS</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#E2E8F0" }}>{data.suggestedBias}</span>
            </div>
          )}
        </BriefingSection>

        {/* ── Key Findings ── */}
        {data.keyFindings.length > 0 && (
          <BriefingSection delay={240}>
            <SectionHeader label="KEY INTELLIGENCE" />
            <BulletList items={data.keyFindings} />
          </BriefingSection>
        )}

        {/* ── Supporting Evidence ── */}
        {data.supportingEvidence.length > 0 && (
          <BriefingSection delay={320}>
            <SectionHeader label="SUPPORTING EVIDENCE" />
            <BulletList items={data.supportingEvidence} color="rgba(226,232,240,0.7)" />
          </BriefingSection>
        )}

        {/* ── Historical Analog ── */}
        {data.historicalAnalog && (
          <BriefingSection delay={400}>
            <SectionHeader label="HISTORICAL ANALOGS" />
            <div style={{
              padding: "14px 16px",
              background: "rgba(255,215,0,0.04)",
              border: "1px solid rgba(255,215,0,0.15)",
              borderLeft: "3px solid rgba(255,215,0,0.4)",
              borderRadius: "0 4px 4px 0",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "14px",
              color: "rgba(226,232,240,0.8)",
              lineHeight: 1.6,
              fontWeight: 500,
            }}>
              {data.historicalAnalog}
            </div>
          </BriefingSection>
        )}

        {/* ── Risk Factors ── */}
        {data.riskFactors.length > 0 && (
          <BriefingSection delay={480}>
            <SectionHeader label="RISK FACTORS" />
            <BulletList items={data.riskFactors} color="rgba(255,100,100,0.85)" />
          </BriefingSection>
        )}

        {/* ── Invalidation ── */}
        {data.invalidationConditions.length > 0 && (
          <BriefingSection delay={560}>
            <SectionHeader label="INVALIDATION CONDITIONS" />
            <BulletList items={data.invalidationConditions} color="rgba(255,170,0,0.85)" />
          </BriefingSection>
        )}

        {/* ── Mission Recommendation ── */}
        <BriefingSection delay={640}>
          <SectionHeader label="MISSION RECOMMENDATION" />
          <div style={{
            padding: "16px 18px",
            background: "rgba(0,229,255,0.05)",
            border: "1px solid rgba(0,229,255,0.2)",
            borderRadius: "4px",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "clamp(14px, 1.8vw, 16px)",
            color: "#E2E8F0",
            lineHeight: 1.65,
            fontWeight: 500,
          }}>
            {data.missionRecommendation}
          </div>
        </BriefingSection>

        {/* ── Final Verdict ── */}
        <BriefingSection delay={720}>
          <div style={{
            padding: "20px 22px",
            background: `rgba(${vColor === "#00FF88" ? "0,255,136" : vColor === "#FF4444" ? "255,68,68" : vColor === "#FFD700" ? "255,215,0" : "0,229,255"},0.06)`,
            border: `1px solid ${vColor}33`,
            borderTop: `3px solid ${vColor}`,
            borderRadius: "0 0 6px 6px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.22em", color: "rgba(100,116,139,0.6)", textTransform: "uppercase" }}>
              FINAL VERDICT
            </div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(28px, 5vw, 42px)",
              color: vColor,
              letterSpacing: "0.08em",
              lineHeight: 1,
            }}>
              {data.finalVerdictAction}
            </div>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", marginBottom: "3px" }}>CONFIDENCE</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#E2E8F0" }}>{data.confidence}%</div>
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", marginBottom: "3px" }}>TIME HORIZON</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#E2E8F0" }}>{data.expectedTimeframe}</div>
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", marginBottom: "3px" }}>RISK LEVEL</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#E2E8F0" }}>{data.riskLevel}</div>
              </div>
            </div>
          </div>
        </BriefingSection>

        {/* ── Follow-up chips ── */}
        {data.followUpChips && data.followUpChips.length > 0 && (
          <BriefingSection delay={800}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.18em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", marginBottom: "10px" }}>
              FOLLOW-UP INTELLIGENCE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.followUpChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => onAskAnother()}
                  style={{
                    background: "rgba(0,229,255,0.05)",
                    border: "1px solid rgba(0,229,255,0.2)",
                    borderRadius: "3px",
                    padding: "7px 12px",
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "rgba(226,232,240,0.75)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "rgba(0,229,255,0.5)"; (e.target as HTMLElement).style.color = "#E2E8F0"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "rgba(0,229,255,0.2)"; (e.target as HTMLElement).style.color = "rgba(226,232,240,0.75)"; }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Bottom padding */}
        <div style={{ height: "80px" }} />
      </div>

      {/* ── Floating Ask Another button ── */}
      <div style={{
        position: "absolute",
        bottom: "28px",
        left: "50%",
        transform: "translateX(-50%)",
        animation: "oracle-fab-enter 0.5s 0.9s cubic-bezier(0.23,1,0.32,1) both",
        zIndex: 10,
      }}>
        <button
          onClick={onAskAnother}
          style={{
            background: "rgba(2,5,12,0.95)",
            border: "1px solid rgba(0,229,255,0.4)",
            borderRadius: "4px",
            padding: "12px 28px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "#00E5FF",
            cursor: "pointer",
            textTransform: "uppercase",
            boxShadow: "0 0 24px rgba(0,229,255,0.12), 0 4px 24px rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.background = "rgba(0,229,255,0.08)";
            el.style.boxShadow = "0 0 32px rgba(0,229,255,0.2), 0 4px 24px rgba(0,0,0,0.6)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.background = "rgba(2,5,12,0.95)";
            el.style.boxShadow = "0 0 24px rgba(0,229,255,0.12), 0 4px 24px rgba(0,0,0,0.6)";
          }}
        >
          ← ASK ANOTHER QUESTION
        </button>
      </div>

      <style>{`
        @keyframes oracle-enter {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes oracle-fab-enter {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
