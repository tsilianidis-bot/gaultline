/**
 * FAULTLINE — Smart Discovery™
 * The primary interface. One question in. One institutional answer out.
 *
 * The FAULTLINE Constitution:
 *   Verdict before data. Explain WHY. Show opportunity. Show risk.
 *   Offer deeper analysis only after the answer has already been delivered.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTickerStore } from "@/contexts/TickerStore";
import { useSEO } from "@/hooks/useSEO";
import {
  ArrowRight, ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, TrendingDown, AlertTriangle,
  Zap, RefreshCw, Send, Activity, BarChart2,
  GitBranch, Shield, Clock, Target,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────
const BG = "#050608";
const SURFACE = "rgba(10,12,18,0.98)";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#00D4FF";
const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const SANS: React.CSSProperties = { fontFamily: "'Rajdhani', sans-serif" };
const MONO_SM: React.CSSProperties = { ...MONO, fontSize: "11px", letterSpacing: "0.06em" };

// ── Types ─────────────────────────────────────────────────────

interface FaultlineAnswer {
  verdict: string;
  verdictColor: "green" | "yellow" | "red" | "blue";
  opportunityScore: number;
  confidence: number;
  confidenceLabel: string;
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  queryType: string;
  currentRegime: string;
  regimeColor: "green" | "yellow" | "red";
  dataFreshness: string;
  executiveSummary: string;
  whyThisVerdict: string;
  bullCase: string;
  bearCase: string;
  catalysts: string[];
  threats: string[];
  support: string | null;
  resistance: string | null;
  entryZone: string | null;
  profitTargets: string[];
  stopLevel: string | null;
  invalidation: string;
  expectedTimeframe: string;
  suggestedAction: string;
  positionSizeGuidance: string | null;
  whatChangesThesis: string;
  deepDiveLinks: Array<{ label: string; path: string; description: string }>;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  ticker?: string | null;
  timestamp: number;
  answer?: FaultlineAnswer;
}

// ── Execution sequence steps ──────────────────────────────────

const EXECUTION_STEPS = [
  "Checking live market data...",
  "Reading macro regime...",
  "Scanning institutional positioning...",
  "Comparing historical analogs...",
  "Evaluating liquidity conditions...",
  "Calculating opportunity score...",
  "Assessing risk vectors...",
  "Generating institutional recommendation...",
];

// ── Verdict color helpers ─────────────────────────────────────

function verdictStyle(color: string): { color: string; borderColor: string; background: string } {
  if (color === "green") return { color: "#00FF88", borderColor: "rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.08)" };
  if (color === "red") return { color: "#FF4444", borderColor: "rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.08)" };
  if (color === "blue") return { color: "#00D4FF", borderColor: "rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)" };
  return { color: "#FFD700", borderColor: "rgba(255,215,0,0.3)", background: "rgba(255,215,0,0.08)" };
}

function scoreBar(value: number, color: string): React.CSSProperties {
  const c = color === "green" ? "#00FF88" : color === "red" ? "#FF4444" : color === "blue" ? "#00D4FF" : "#FFD700";
  return {
    height: "4px",
    background: `linear-gradient(90deg, ${c} ${value}%, rgba(255,255,255,0.08) ${value}%)`,
    borderRadius: "2px",
  };
}

// ── Execution Sequence ────────────────────────────────────────

function ExecutionSequence({ currentStep }: { currentStep: number }) {
  return (
    <div style={{
      padding: "24px",
      background: "rgba(0,212,255,0.04)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "8px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>
      <div style={{ ...MONO_SM, color: ACCENT, marginBottom: "4px", letterSpacing: "0.12em" }}>
        FAULTLINE INTELLIGENCE SEQUENCE
      </div>
      {EXECUTION_STEPS.map((step, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          opacity: i <= currentStep ? 1 : 0.25,
          transition: "opacity 0.3s ease",
        }}>
          <div style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: i < currentStep ? "#00FF88" : i === currentStep ? ACCENT : "rgba(255,255,255,0.2)",
            flexShrink: 0,
            transition: "background 0.3s ease",
            boxShadow: i === currentStep ? `0 0 8px ${ACCENT}` : "none",
          }} />
          <span style={{
            ...MONO_SM,
            color: i < currentStep ? "#00FF88" : i === currentStep ? "#F0F4FF" : "rgba(255,255,255,0.3)",
            transition: "color 0.3s ease",
          }}>
            {step}
          </span>
          {i < currentStep && (
            <span style={{ ...MONO_SM, color: "#00FF88", marginLeft: "auto" }}>✓</span>
          )}
          {i === currentStep && (
            <span style={{ ...MONO_SM, color: ACCENT, marginLeft: "auto", animation: "fl-pulse 1s infinite" }}>●</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── FMOS Engine Status Mini-Card ──────────────────────────────

function EngineCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{icon}</span>
        <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </div>
      <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

// ── Full Institutional Answer ─────────────────────────────────

function InstitutionalAnswer({ answer, onDeepDive }: { answer: FaultlineAnswer; onDeepDive: (path: string) => void }) {
  const [showExpanded, setShowExpanded] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const vs = verdictStyle(answer.verdictColor);

  // Derive FMOS engine status values from answer fields
  const regimeStatus = answer.regimeColor === "green" ? "STABLE" : answer.regimeColor === "red" ? "STRESSED" : "TRANSITIONING";
  const regimeColor = answer.regimeColor === "green" ? "#00FF88" : answer.regimeColor === "red" ? "#FF4444" : "#FFD700";
  const confidenceColor = answer.confidence >= 70 ? "#00FF88" : answer.confidence >= 45 ? "#FFD700" : "#FF4444";
  const opportunityColor = answer.opportunityScore >= 65 ? "#00FF88" : answer.opportunityScore >= 40 ? "#FFD700" : "#FF4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── BOTTOM LINE card ── */}
      <div style={{
        padding: "16px 18px",
        background: vs.background,
        border: `1px solid ${vs.borderColor}`,
        borderRadius: "8px",
      }}>
        {/* Row 1: ticker + verdict + timeframe badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          {answer.ticker && (
            <div style={{
              ...MONO, fontSize: "11px", fontWeight: 700,
              color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em",
              padding: "2px 8px", background: "rgba(255,255,255,0.06)", borderRadius: "3px",
            }}>
              {answer.ticker}
            </div>
          )}
          <div style={{ ...SANS, fontSize: "24px", fontWeight: 800, color: vs.color, letterSpacing: "0.08em" }}>
            {answer.verdict}
          </div>
          {answer.expectedTimeframe && (
            <div style={{
              ...MONO_SM, fontSize: "10px",
              padding: "2px 7px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "3px",
              color: "rgba(255,255,255,0.45)",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              <Clock size={9} />
              {answer.expectedTimeframe}
            </div>
          )}
        </div>

        {/* Row 2: opportunity + confidence bars */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          {[
            { label: "OPPORTUNITY", value: answer.opportunityScore, color: answer.verdictColor },
            { label: "CONFIDENCE", value: answer.confidence, color: answer.verdictColor },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.4)" }}>{label}</span>
                <span style={{ ...MONO_SM, color: verdictStyle(color).color, fontWeight: 700 }}>{value}</span>
              </div>
              <div style={scoreBar(value, color)} />
            </div>
          ))}
        </div>

        {/* Row 3: suggested action */}
        <div style={{
          padding: "9px 12px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "5px",
          borderLeft: `3px solid ${vs.color}`,
        }}>
          <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "3px", fontSize: "9px" }}>SUGGESTED ACTION</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#E8EDF5", lineHeight: 1.5 }}>
            {answer.suggestedAction}
          </div>
          {answer.positionSizeGuidance && (
            <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginTop: "4px", fontSize: "10px" }}>
              Position size: {answer.positionSizeGuidance}
            </div>
          )}
        </div>
      </div>

      {/* ── FMOS Engine Cards row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        <EngineCard
          icon={<Activity size={9} />}
          label="Regime"
          value={regimeStatus}
          color={regimeColor}
          sub={answer.currentRegime.slice(0, 22)}
        />
        <EngineCard
          icon={<BarChart2 size={9} />}
          label="Confidence"
          value={`${answer.confidence}%`}
          color={confidenceColor}
          sub={answer.confidenceLabel}
        />
        <EngineCard
          icon={<Target size={9} />}
          label="Opportunity"
          value={`${answer.opportunityScore}/100`}
          color={opportunityColor}
        />
        <EngineCard
          icon={<GitBranch size={9} />}
          label="Asset"
          value={(answer.assetType ?? answer.queryType ?? "MACRO").toUpperCase()}
          color="rgba(255,255,255,0.55)"
        />
        <EngineCard
          icon={<Shield size={9} />}
          label="Data"
          value="LIVE"
          color="#00FF88"
          sub={answer.dataFreshness.slice(0, 18)}
        />
      </div>

      {/* ── Executive Summary ── */}
      <div style={{ padding: "16px 18px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
        <div style={{ ...MONO_SM, color: ACCENT, marginBottom: "8px", letterSpacing: "0.12em" }}>FAULTLINE ASSESSMENT</div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#E8EDF5", lineHeight: 1.7, margin: 0 }}>
          {answer.executiveSummary}
        </p>
      </div>

      {/* ── Bull / Bear ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
        <div style={{ padding: "14px 16px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "7px" }}>
            <TrendingUp size={11} style={{ color: "#00FF88" }} />
            <span style={{ ...MONO_SM, color: "#00FF88", letterSpacing: "0.1em" }}>BULL CASE</span>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.6, margin: 0 }}>
            {answer.bullCase}
          </p>
        </div>
        <div style={{ padding: "14px 16px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.12)", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "7px" }}>
            <TrendingDown size={11} style={{ color: "#FF4444" }} />
            <span style={{ ...MONO_SM, color: "#FF4444", letterSpacing: "0.1em" }}>BEAR CASE</span>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.6, margin: 0 }}>
            {answer.bearCase}
          </p>
        </div>
      </div>

      {/* ── Invalidation (always visible) ── */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(255,165,0,0.04)",
        border: "1px solid rgba(255,165,0,0.12)",
        borderRadius: "8px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}>
        <AlertTriangle size={12} style={{ color: "#FFA500", marginTop: "2px", flexShrink: 0 }} />
        <div>
          <div style={{ ...MONO_SM, color: "#FFA500", marginBottom: "3px", fontSize: "9px" }}>INVALIDATION CONDITIONS</div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC" }}>{answer.invalidation}</span>
        </div>
      </div>

      {/* ── Collapsible: full analysis ── */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <button
          onClick={() => setShowExpanded(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em" }}>
            {showExpanded ? "HIDE FULL ANALYSIS" : "SHOW FULL ANALYSIS"}
          </span>
          {showExpanded
            ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </button>

        {showExpanded && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Why this verdict */}
            <div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", marginBottom: "6px", letterSpacing: "0.1em" }}>WHY THIS VERDICT</div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.7, margin: 0 }}>
                {answer.whyThisVerdict}
              </p>
            </div>

            {/* Catalysts + Threats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
              {[
                { label: "CATALYSTS", items: answer.catalysts, color: "#00FF88", icon: <Zap size={10} /> },
                { label: "THREATS", items: answer.threats, color: "#FF4444", icon: <AlertTriangle size={10} /> },
              ].map(({ label, items, color, icon }) => (
                <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                    <span style={{ color }}>{icon}</span>
                    <span style={{ ...MONO_SM, color, letterSpacing: "0.1em", fontSize: "10px" }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "7px", alignItems: "flex-start" }}>
                        <span style={{ ...MONO_SM, color, marginTop: "1px", flexShrink: 0, fontSize: "10px" }}>›</span>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A8B4", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Key Levels */}
            {(answer.support || answer.resistance || answer.entryZone || answer.stopLevel) && (
              <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px" }}>
                <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", marginBottom: "10px", letterSpacing: "0.1em", fontSize: "10px" }}>KEY LEVELS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
                  {answer.entryZone && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>ENTRY ZONE</div>
                      <div style={{ ...MONO, fontSize: "12px", color: "#00FF88", fontWeight: 600 }}>{answer.entryZone}</div>
                    </div>
                  )}
                  {answer.support && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>SUPPORT</div>
                      <div style={{ ...MONO, fontSize: "12px", color: "#00FF88", fontWeight: 600 }}>{answer.support}</div>
                    </div>
                  )}
                  {answer.resistance && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>RESISTANCE</div>
                      <div style={{ ...MONO, fontSize: "12px", color: "#FF4444", fontWeight: 600 }}>{answer.resistance}</div>
                    </div>
                  )}
                  {answer.stopLevel && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>STOP</div>
                      <div style={{ ...MONO, fontSize: "12px", color: "#FF4444", fontWeight: 600 }}>{answer.stopLevel}</div>
                    </div>
                  )}
                  {answer.profitTargets.length > 0 && (
                    <div>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>TARGETS</div>
                      <div style={{ ...MONO, fontSize: "11px", color: "#00D4FF", fontWeight: 600 }}>{answer.profitTargets.join(" / ")}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "2px", fontSize: "9px" }}>TIMEFRAME</div>
                    <div style={{ ...MONO, fontSize: "11px", color: "#F0F4FF" }}>{answer.expectedTimeframe}</div>
                  </div>
                </div>
              </div>
            )}

            {/* What changes thesis */}
            <div style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "6px",
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
            }}>
              <RefreshCw size={11} style={{ color: "rgba(255,255,255,0.25)", marginTop: "2px", flexShrink: 0 }} />
              <div>
                <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginRight: "8px", fontSize: "9px" }}>WHAT CHANGES THE THESIS:</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A8B4" }}>{answer.whatChangesThesis}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Deep Dive Actions ── */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <button
          onClick={() => setShowDeepDive(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>DEEPER ANALYSIS</span>
          {showDeepDive
            ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </button>
        {showDeepDive && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {answer.deepDiveLinks.map((link, i) => (
              <button
                key={i}
                onClick={() => onDeepDive(link.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "5px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              >
                <div>
                  <div style={{ ...MONO_SM, color: "#F0F4FF", fontWeight: 600, fontSize: "11px" }}>{link.label}</div>
                  <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "9px", marginTop: "2px" }}>{link.description}</div>
                </div>
                <ExternalLink size={11} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Bubble ───────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
      <div style={{
        maxWidth: "70%",
        padding: "11px 15px",
        background: "rgba(0,212,255,0.08)",
        border: "1px solid rgba(0,212,255,0.18)",
        borderRadius: "12px 12px 2px 12px",
        fontFamily: "'Inter', sans-serif",
        fontSize: "14px",
        color: "#E8EDF5",
        lineHeight: 1.6,
      }}>
        {content}
      </div>
    </div>
  );
}

// ── Suggested Questions ───────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Should I buy NVDA right now?",
  "How dangerous is the market today?",
  "What are the best swing trades this week?",
  "Is Bitcoin in a bull or bear cycle?",
  "What changed overnight in the market?",
  "What would cause the market to crash?",
  "Compare NVDA vs AMD",
  "What are institutions buying right now?",
];

// ── Main Component ────────────────────────────────────────────

export default function SmartDiscovery() {
  useSEO({
    title: "FAULTLINE — Ask Anything",
    description: "Ask any market question. FAULTLINE synthesizes live data, macro regime analysis, and institutional signal scoring into one clear recommendation.",
  });

  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { current: contextTicker, setTicker } = useTickerStore();

  const [query, setQuery] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askMutation = trpc.smartDiscovery.ask.useMutation();

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isExecuting]);

  const startExecutionSequence = useCallback(() => {
    setExecutionStep(0);
    stepIntervalRef.current = setInterval(() => {
      setExecutionStep(prev => {
        if (prev >= EXECUTION_STEPS.length - 1) {
          if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
  }, []);

  const stopExecutionSequence = useCallback(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
    setExecutionStep(EXECUTION_STEPS.length - 1);
  }, []);

  const handleSubmit = useCallback(async (q?: string) => {
    const question = (q ?? query).trim();
    if (!question || isExecuting) return;

    setQuery("");
    setError(null);
    setIsExecuting(true);
    startExecutionSequence();

    const userMsg: ConversationMessage = {
      role: "user",
      content: question,
      timestamp: Date.now(),
    };
    setConversation(prev => [...prev, userMsg]);

    // Build history for context (last 6 messages)
    const historyForApi = conversation.slice(-6).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      ticker: m.ticker ?? null,
      timestamp: m.timestamp,
    }));

    try {
      const answer = await askMutation.mutateAsync({
        query: question,
        conversationHistory: historyForApi,
        contextTicker: contextTicker?.ticker ?? null,
        contextAssetType: contextTicker?.assetType ?? null,
      });

      stopExecutionSequence();

      // Update global ticker if answer identified a security
      if (answer.ticker && answer.assetType) {
        setTicker(answer.ticker, answer.ticker, answer.assetType as "stock" | "crypto");
      }

      const assistantMsg: ConversationMessage = {
        role: "assistant",
        content: answer.executiveSummary,
        ticker: answer.ticker,
        timestamp: Date.now(),
        answer: answer as FaultlineAnswer,
      };
      setConversation(prev => [...prev, assistantMsg]);
    } catch {
      stopExecutionSequence();
      setError("FAULTLINE encountered an error retrieving live market data. Please try again.");
      setConversation(prev => prev.slice(0, -1));
    } finally {
      setIsExecuting(false);
    }
  }, [query, isExecuting, conversation, contextTicker, askMutation, startExecutionSequence, stopExecutionSequence, setTicker]);

  const handleDeepDive = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }, [handleSubmit]);

  if (authLoading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ ...MONO_SM, color: ACCENT }}>LOADING...</div>
        </div>
      </AppLayout>
    );
  }

  const isEmpty = conversation.length === 0 && !isExecuting;

  return (
    <AppLayout>
      <style>{`
        @keyframes fl-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes fl-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fl-answer { animation: fl-fade-in 0.4s ease; }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 56px)",
        maxWidth: "860px",
        margin: "0 auto",
        padding: "0 16px",
      }}>

        {/* ── Empty / Welcome State ── */}
        {isEmpty && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
            padding: "40px 0",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                ...SANS,
                fontSize: "36px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#F0F4FF",
                marginBottom: "8px",
              }}>
                FAULT<span style={{ color: ACCENT }}>LINE</span>
              </div>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em" }}>
                INSTITUTIONAL INTELLIGENCE
              </div>
            </div>

            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "16px",
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
              maxWidth: "480px",
              lineHeight: 1.7,
            }}>
              {user
                ? "Ask anything. FAULTLINE synthesizes live market data, macro regime analysis, and institutional signal scoring into one clear recommendation."
                : "Sign in to access FAULTLINE's institutional intelligence. One question. One answer."
              }
            </div>

            {user && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "8px",
                width: "100%",
                maxWidth: "700px",
              }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => void handleSubmit(q)}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.55)",
                      transition: "all 0.15s ease",
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(0,212,255,0.06)";
                      e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)";
                      e.currentTarget.style.color = "#E8EDF5";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Conversation ── */}
        {!isEmpty && (
          <div style={{ flex: 1, paddingTop: "24px", paddingBottom: "120px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {conversation.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <UserBubble content={msg.content} />
                ) : msg.answer ? (
                  <div className="fl-answer">
                    <InstitutionalAnswer answer={msg.answer} onDeepDive={handleDeepDive} />
                  </div>
                ) : null}
              </div>
            ))}

            {isExecuting && (
              <div className="fl-answer">
                <ExecutionSequence currentStep={executionStep} />
              </div>
            )}

            {error && (
              <div style={{
                padding: "14px 18px",
                background: "rgba(255,68,68,0.06)",
                border: "1px solid rgba(255,68,68,0.2)",
                borderRadius: "8px",
                ...MONO_SM,
                color: "#FF6B6B",
              }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* ── Sticky Input Bar ── */}
        <div style={{
          position: "sticky",
          bottom: 0,
          padding: "16px 0 24px",
          background: `linear-gradient(to top, ${BG} 80%, transparent)`,
        }}>
          {!user ? (
            <div style={{ textAlign: "center" }}>
              <a
                href={getLoginUrl()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 28px",
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: "6px",
                  color: ACCENT,
                  ...MONO,
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                SIGN IN TO ACCESS FAULTLINE
                <ArrowRight size={14} />
              </a>
            </div>
          ) : (
            <div style={{
              display: "flex",
              gap: "10px",
              padding: "12px 16px",
              background: "rgba(12,15,22,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
            }}>
              {contextTicker && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  borderRadius: "5px",
                  flexShrink: 0,
                }}>
                  <span style={{ ...MONO_SM, color: ACCENT, fontWeight: 700 }}>{contextTicker.ticker}</span>
                </div>
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  contextTicker
                    ? `Ask about ${contextTicker.ticker}, or type any question...`
                    : "Ask anything — Should I buy NVDA? How dangerous is the market? Best swing trades..."
                }
                disabled={isExecuting}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  color: "#F0F4FF",
                  caretColor: ACCENT,
                }}
              />
              <button
                onClick={() => void handleSubmit()}
                disabled={!query.trim() || isExecuting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  background: query.trim() && !isExecuting ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${query.trim() && !isExecuting ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "6px",
                  cursor: query.trim() && !isExecuting ? "pointer" : "not-allowed",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <Send size={14} style={{ color: query.trim() && !isExecuting ? ACCENT : "rgba(255,255,255,0.25)" }} />
              </button>
            </div>
          )}

          {conversation.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "8px", gap: "16px" }}>
              <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
                {conversation.filter(m => m.role === "user").length} question{conversation.filter(m => m.role === "user").length !== 1 ? "s" : ""} in session
              </span>
              {contextTicker && (
                <span style={{ ...MONO_SM, color: "rgba(0,212,255,0.5)", fontSize: "10px" }}>
                  Context: {contextTicker.ticker}
                </span>
              )}
              <button
                onClick={() => { setConversation([]); setError(null); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  ...MONO_SM,
                  color: "rgba(255,255,255,0.2)",
                  fontSize: "10px",
                  padding: 0,
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
