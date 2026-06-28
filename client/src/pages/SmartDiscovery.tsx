/**
 * FAULTLINE — Ask Intelligence V2.0
 * The primary interface. One question in. One institutional answer out.
 *
 * V2.0 Upgrades:
 *   - Primary Driver sentence (Section 5)
 *   - Evidence Engine grid — 14 categories with signal bars (Section 6)
 *   - Bull/Bear with probabilities and key drivers (Sections 7-8)
 *   - Why Not Buy/Sell for WAIT/HOLD verdicts (Section 10)
 *   - What Changes Our View — 4-5 specific catalysts (Section 11)
 *   - Confidence breakdown with reasons
 *   - 13-stage loading sequence
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTickerStore } from "@/contexts/TickerStore";
import { useSEO } from "@/hooks/useSEO";
import { useEngine } from "@/contexts/EngineContext";
import {
  ArrowRight, ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, TrendingDown, AlertTriangle,
  Zap, RefreshCw, Send, Activity, BarChart2,
  GitBranch, Shield, Clock, Target, BookOpen,
  CheckCircle, XCircle, Eye, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import OnboardingFlow from "@/components/OnboardingFlow";

// ── Design tokens ─────────────────────────────────────────────
const BG = "#050608";
const SURFACE = "rgba(10,12,18,0.98)";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#00D4FF";
const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const SANS: React.CSSProperties = { fontFamily: "'Rajdhani', sans-serif" };
const MONO_SM: React.CSSProperties = { ...MONO, fontSize: "11px", letterSpacing: "0.06em" };

// ── Types ─────────────────────────────────────────────────────

interface EvidenceScore {
  category: string;
  score: number;
  signal: "bullish" | "bearish" | "neutral";
  explanation: string;
}

interface FaultlineAnswer {
  verdict: string;
  verdictColor: "green" | "yellow" | "red" | "blue";
  opportunityScore: number;
  confidence: number;
  confidenceLabel: string;
  confidenceReasons: string[];
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  queryType: string;
  currentRegime: string;
  regimeColor: "green" | "yellow" | "red";
  dataFreshness: string;
  // V2.0 fields
  primaryDriver: string;
  evidenceScores: EvidenceScore[];
  bullProbability: number;
  bullKeyDrivers: string[];
  bearProbability: number;
  bearKeyDrivers: string[];
  whyNotBuy: string[] | null;
  whyNotSell: string[] | null;
  watchCatalysts: string[];
  // Existing fields
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

// V3.0 Daily Brief answer type
interface BriefAnswer {
  todaysMarket: {
    regime: string;
    pressureIndex: number;
    marketHealth: string;
    institutionalBias: string;
    confidence: number;
    marketStatus: string;
  };
  topOpportunities: Array<{
    ticker: string;
    opportunityScore: number;
    confidence: number;
    risk: string;
    timeHorizon: string;
    suggestedAction: string;
    primaryDriver: string;
  }>;
  topRisks: string[];
  watchlistIntelligence: Array<{ ticker: string; signal: string; direction: "positive" | "negative" | "neutral" }>;
  todaysEvents: Array<{ event: string; category: string; importance: string; whyItMatters: string }>;
  institutionalInsight: string;
  engineStatus: {
    fmosVersion: string;
    engineHealth: number;
    dataFreshness: string;
    liveDataSources: number;
    averageLatency: string;
    lastUpdated: string;
  };
  generatedAt: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  ticker?: string | null;
  timestamp: number;
  answer?: FaultlineAnswer;
  briefAnswer?: BriefAnswer;
}

// ── V2.0 Loading sequence (13 stages) ────────────────────────

const EXECUTION_STEPS = [
  "Initializing FAULTLINE intelligence engine...",
  "Fetching live market data...",
  "Reading macro regime conditions...",
  "Scanning institutional positioning...",
  "Evaluating liquidity environment...",
  "Comparing historical analogs...",
  "Running Evidence Engine (14 categories)...",
  "Calculating bull/bear probability distribution...",
  "Assessing invalidation conditions...",
  "Scoring opportunity and conviction...",
  "Stress-testing the thesis...",
  "Generating primary driver analysis...",
  "Compiling institutional recommendation...",
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

function signalColor(signal: string): string {
  if (signal === "bullish") return "#00FF88";
  if (signal === "bearish") return "#FF4444";
  return "#FFD700";
}

function signalBg(signal: string): string {
  if (signal === "bullish") return "rgba(0,255,136,0.08)";
  if (signal === "bearish") return "rgba(255,68,68,0.08)";
  return "rgba(255,215,0,0.08)";
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

// ── Evidence Engine Grid (V2.0) ───────────────────────────────

function EvidenceEngineGrid({ scores }: { scores: EvidenceScore[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!scores || scores.length === 0) return null;

  const bullish = scores.filter(s => s.signal === "bullish").length;
  const bearish = scores.filter(s => s.signal === "bearish").length;
  const neutral = scores.filter(s => s.signal === "neutral").length;

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ ...MONO_SM, color: ACCENT, letterSpacing: "0.12em" }}>EVIDENCE ENGINE</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{ ...MONO_SM, color: "#00FF88", fontSize: "10px" }}>{bullish}↑</span>
            <span style={{ ...MONO_SM, color: "#FF4444", fontSize: "10px" }}>{bearish}↓</span>
            <span style={{ ...MONO_SM, color: "#FFD700", fontSize: "10px" }}>{neutral}—</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
            {scores.length} categories
          </span>
          {expanded
            ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </div>
      </button>

      {/* Compact summary bar — always visible */}
      <div style={{ padding: "0 16px 12px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {scores.map((s, i) => (
          <div
            key={i}
            title={`${s.category}: ${s.signal} (${s.score}/100) — ${s.explanation}`}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "3px",
              background: signalBg(s.signal),
              border: `1px solid ${signalColor(s.signal)}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
            }}
          >
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: signalColor(s.signal),
              opacity: 0.7 + (s.score / 333),
            }} />
          </div>
        ))}
      </div>

      {/* Expanded grid */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {scores.map((s, i) => (
            <div key={i} style={{
              padding: "8px 10px",
              background: signalBg(s.signal),
              border: `1px solid ${signalColor(s.signal)}20`,
              borderRadius: "5px",
              display: "grid",
              gridTemplateColumns: "140px 1fr 60px",
              alignItems: "center",
              gap: "10px",
            }}>
              <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.7)", fontSize: "10px", fontWeight: 600 }}>
                {s.category}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                {s.explanation}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", justifyContent: "flex-end" }}>
                <div style={{
                  width: "32px",
                  height: "3px",
                  background: `linear-gradient(90deg, ${signalColor(s.signal)} ${s.score}%, rgba(255,255,255,0.08) ${s.score}%)`,
                  borderRadius: "2px",
                }} />
                <span style={{ ...MONO_SM, color: signalColor(s.signal), fontSize: "10px", fontWeight: 700 }}>{s.score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confidence Breakdown (V2.0) ───────────────────────────────

function ConfidenceBreakdown({ confidence, label, reasons }: {
  confidence: number;
  label: string;
  reasons: string[];
}) {
  const color = confidence >= 70 ? "#00FF88" : confidence >= 45 ? "#FFD700" : "#FF4444";

  return (
    <div style={{
      padding: "12px 14px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", fontSize: "10px" }}>CONFIDENCE BREAKDOWN</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ ...MONO, fontSize: "13px", fontWeight: 700, color }}>{confidence}%</span>
          <span style={{ ...MONO_SM, color, fontSize: "9px", padding: "1px 5px", background: `${color}15`, borderRadius: "3px" }}>{label}</span>
        </div>
      </div>
      <div style={{ ...scoreBar(confidence, confidence >= 70 ? "green" : confidence >= 45 ? "yellow" : "red"), marginBottom: "8px" }} />
      {reasons && reasons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", marginTop: "1px", flexShrink: 0, fontSize: "10px" }}>›</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bull/Bear with Probabilities (V2.0) ──────────────────────

function BullBearSection({ answer }: { answer: FaultlineAnswer }) {
  const bullPct = answer.bullProbability ?? 50;
  const bearPct = answer.bearProbability ?? 50;
  const neutralPct = Math.max(0, 100 - bullPct - bearPct);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Probability bar */}
      <div style={{
        padding: "10px 14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "6px",
      }}>
        <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "8px", fontSize: "9px", letterSpacing: "0.1em" }}>PROBABILITY DISTRIBUTION</div>
        <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", gap: "1px" }}>
          <div style={{ width: `${bullPct}%`, background: "#00FF88", transition: "width 0.5s ease" }} />
          {neutralPct > 0 && <div style={{ width: `${neutralPct}%`, background: "#FFD700", transition: "width 0.5s ease" }} />}
          <div style={{ width: `${bearPct}%`, background: "#FF4444", transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
          <span style={{ ...MONO_SM, color: "#00FF88", fontSize: "10px" }}>BULL {bullPct}%</span>
          {neutralPct > 0 && <span style={{ ...MONO_SM, color: "#FFD700", fontSize: "10px" }}>NEUTRAL {neutralPct}%</span>}
          <span style={{ ...MONO_SM, color: "#FF4444", fontSize: "10px" }}>BEAR {bearPct}%</span>
        </div>
      </div>

      {/* Bull / Bear cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px" }}>
        {/* Bull */}
        <div style={{ padding: "14px 16px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={11} style={{ color: "#00FF88" }} />
              <span style={{ ...MONO_SM, color: "#00FF88", letterSpacing: "0.1em" }}>BULL CASE</span>
            </div>
            <span style={{ ...MONO, fontSize: "12px", fontWeight: 700, color: "#00FF88" }}>{bullPct}%</span>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.6, margin: "0 0 8px" }}>
            {answer.bullCase}
          </p>
          {answer.bullKeyDrivers && answer.bullKeyDrivers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {answer.bullKeyDrivers.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: "5px", alignItems: "flex-start" }}>
                  <span style={{ color: "#00FF88", fontSize: "10px", marginTop: "1px", flexShrink: 0 }}>+</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(0,255,136,0.7)", lineHeight: 1.4 }}>{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bear */}
        <div style={{ padding: "14px 16px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.12)", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingDown size={11} style={{ color: "#FF4444" }} />
              <span style={{ ...MONO_SM, color: "#FF4444", letterSpacing: "0.1em" }}>BEAR CASE</span>
            </div>
            <span style={{ ...MONO, fontSize: "12px", fontWeight: 700, color: "#FF4444" }}>{bearPct}%</span>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D0DC", lineHeight: 1.6, margin: "0 0 8px" }}>
            {answer.bearCase}
          </p>
          {answer.bearKeyDrivers && answer.bearKeyDrivers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {answer.bearKeyDrivers.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: "5px", alignItems: "flex-start" }}>
                  <span style={{ color: "#FF4444", fontSize: "10px", marginTop: "1px", flexShrink: 0 }}>−</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,68,68,0.7)", lineHeight: 1.4 }}>{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Why Not Buy/Sell (V2.0 — Section 10) ─────────────────────

function WhyNotSection({ whyNotBuy, whyNotSell }: {
  whyNotBuy: string[] | null;
  whyNotSell: string[] | null;
}) {
  if (!whyNotBuy && !whyNotSell) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
      {whyNotBuy && whyNotBuy.length > 0 && (
        <div style={{ padding: "12px 14px", background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.08)", borderRadius: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
            <XCircle size={10} style={{ color: "#00FF88" }} />
            <span style={{ ...MONO_SM, color: "#00FF88", fontSize: "9px", letterSpacing: "0.1em" }}>WHY NOT BUY (YET)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {whyNotBuy.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                <span style={{ ...MONO_SM, color: "rgba(0,255,136,0.4)", marginTop: "1px", flexShrink: 0, fontSize: "10px" }}>›</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A8B4", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {whyNotSell && whyNotSell.length > 0 && (
        <div style={{ padding: "12px 14px", background: "rgba(255,68,68,0.03)", border: "1px solid rgba(255,68,68,0.08)", borderRadius: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
            <XCircle size={10} style={{ color: "#FF4444" }} />
            <span style={{ ...MONO_SM, color: "#FF4444", fontSize: "9px", letterSpacing: "0.1em" }}>WHY NOT SELL (YET)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {whyNotSell.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                <span style={{ ...MONO_SM, color: "rgba(255,68,68,0.4)", marginTop: "1px", flexShrink: 0, fontSize: "10px" }}>›</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A8B4", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Institutional Insight (V2.1 — Section 7) ────────────────

function InstitutionalInsightCard({ answer }: { answer: FaultlineAnswer }) {
  const insight = answer.executiveSummary
    ? answer.executiveSummary.split('. ').slice(0, 2).join('. ') + (answer.executiveSummary.endsWith('.') ? '' : '.')
    : null;
  if (!insight) return null;
  return (
    <div style={{
      padding: "12px 16px",
      background: "rgba(0,212,255,0.03)",
      border: "1px solid rgba(0,212,255,0.12)",
      borderRadius: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <Shield size={10} style={{ color: ACCENT }} />
        <span style={{ ...MONO_SM, color: ACCENT, fontSize: "9px", letterSpacing: "0.14em" }}>INSTITUTIONAL INSIGHT</span>
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D4E0", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
        &ldquo;{insight}&rdquo;
      </p>
    </div>
  );
}

// ── Evidence Transparency (V2.1 — Section 8) ─────────────────

function EvidenceTransparency({ scores }: { scores: EvidenceScore[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!scores || scores.length === 0) return null;
  const usedEvidence = scores
    .filter(s => !(s.signal === 'neutral' && s.score === 50))
    .map(s => ({ label: s.category, signal: s.signal, score: s.score }))
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <CheckCircle size={10} style={{ color: "rgba(0,255,136,0.6)" }} />
          <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", fontSize: "10px" }}>EVIDENCE USED ({usedEvidence.length} sources)</span>
        </div>
        {expanded
          ? <ChevronUp size={11} style={{ color: "rgba(255,255,255,0.25)" }} />
          : <ChevronDown size={11} style={{ color: "rgba(255,255,255,0.25)" }} />
        }
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {usedEvidence.map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
              <span style={{ fontSize: "9px", color: ev.signal === 'bullish' ? '#00FF88' : ev.signal === 'bearish' ? '#FF4444' : '#888', flexShrink: 0 }}>✓</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#B0B8C4" }}>{ev.label}</span>
              <span style={{ ...MONO_SM, fontSize: "9px", color: ev.signal === 'bullish' ? '#00FF88' : ev.signal === 'bearish' ? '#FF4444' : '#888', marginLeft: "auto", textTransform: "uppercase" }}>{ev.signal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── What Changes Our View (V2.0 — Section 11) ────────────────

function WatchCatalysts({ catalysts }: { catalysts: string[] }) {
  if (!catalysts || catalysts.length === 0) return null;

  return (
    <div style={{
      padding: "12px 16px",
      background: "rgba(0,212,255,0.03)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <Eye size={11} style={{ color: ACCENT }} />
        <span style={{ ...MONO_SM, color: ACCENT, fontSize: "9px", letterSpacing: "0.12em" }}>WHAT CHANGES OUR VIEW</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {catalysts.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span style={{ ...MONO_SM, color: ACCENT, marginTop: "1px", flexShrink: 0, fontSize: "10px", fontWeight: 700 }}>{i + 1}.</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#B0B8C4", lineHeight: 1.5 }}>{c}</span>
          </div>
        ))}
      </div>
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

  // Determine if this is a WAIT/HOLD verdict
  const isWaitHold = ["WAIT", "HOLD", "LOW CONVICTION"].includes(answer.verdict);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── PRIMARY DRIVER (V2.0 — Section 5) ── */}
      {answer.primaryDriver && (
        <div style={{
          padding: "10px 14px",
          background: `${vs.background}`,
          border: `1px solid ${vs.borderColor}`,
          borderRadius: "6px",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}>
          <Zap size={12} style={{ color: vs.color, marginTop: "2px", flexShrink: 0 }} />
          <div>
            <div style={{ ...MONO_SM, color: vs.color, marginBottom: "2px", fontSize: "9px", letterSpacing: "0.12em" }}>PRIMARY DRIVER</div>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#E8EDF5", fontWeight: 500, lineHeight: 1.5 }}>
              {answer.primaryDriver}
            </span>
          </div>
        </div>
      )}

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

      {/* ── Evidence Engine (V2.0 — Section 6) ── */}
      {answer.evidenceScores && answer.evidenceScores.length > 0 && (
        <EvidenceEngineGrid scores={answer.evidenceScores} />
      )}

      {/* ── Bull / Bear with Probabilities (V2.0 — Sections 7-8) ── */}
      <BullBearSection answer={answer} />

      {/* ── Confidence Breakdown (V2.0) ── */}
      {answer.confidenceReasons && answer.confidenceReasons.length > 0 && (
        <ConfidenceBreakdown
          confidence={answer.confidence}
          label={answer.confidenceLabel}
          reasons={answer.confidenceReasons}
        />
      )}

      {/* ── Why Not Buy/Sell (V2.0 — Section 10, only for WAIT/HOLD) ── */}
      {isWaitHold && (
        <WhyNotSection whyNotBuy={answer.whyNotBuy} whyNotSell={answer.whyNotSell} />
      )}

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

      {/* ── Institutional Insight (V2.1 — Section 7) ── */}
      <InstitutionalInsightCard answer={answer} />

      {/* ── Evidence Transparency (V2.1 — Section 8) ── */}
      {answer.evidenceScores && answer.evidenceScores.length > 0 && (
        <EvidenceTransparency scores={answer.evidenceScores} />
      )}

      {/* ── What Changes Our View (V2.0 — Section 11) ── */}
      {answer.watchCatalysts && answer.watchCatalysts.length > 0 && (
        <WatchCatalysts catalysts={answer.watchCatalysts} />
      )}

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

// ── V3.0 Full Market Briefing Renderer ──────────────────────
function FullMarketBriefingCard({ brief, onAskFollowUp }: { brief: BriefAnswer; onAskFollowUp: (prompt: string) => void }) {
  const followUps = [
    "What are the best trades for this regime?",
    "How should I position my portfolio today?",
    "What is the biggest risk I should hedge against?",
    "Which sectors are institutions rotating into?",
    "What would cause this regime to change?",
  ];

  const pressureColor = brief.todaysMarket.pressureIndex < 30 ? '#00FF88' : brief.todaysMarket.pressureIndex < 55 ? '#FFD700' : brief.todaysMarket.pressureIndex < 75 ? '#FF9500' : '#FF4444';
  const biasColor = brief.todaysMarket.institutionalBias.includes('Bull') ? '#00FF88' : brief.todaysMarket.institutionalBias === 'Neutral to Cautious' ? '#FFD700' : brief.todaysMarket.institutionalBias === 'Cautious' ? '#FF9500' : '#FF4444';
  const statusColor = brief.todaysMarket.marketStatus === 'RISK-ON' ? '#00FF88' : brief.todaysMarket.marketStatus === 'NEUTRAL' ? '#FFD700' : '#FF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fl-fade-in 0.4s ease' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ ...MONO_SM, color: ACCENT, letterSpacing: '0.15em', fontSize: '11px' }}>INSTITUTIONAL DAILY BRIEF</span>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>{new Date(brief.generatedAt).toLocaleTimeString()}</span>
        </div>
        {brief.institutionalInsight && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            {brief.institutionalInsight}
          </p>
        )}
      </div>

      {/* Today's Market Grid */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>TODAY'S MARKET</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>REGIME</div><div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: '#F0F4FF' }}>{brief.todaysMarket.regime}</div></div>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>PRESSURE</div><div style={{ ...MONO, fontSize: '13px', fontWeight: 700, color: pressureColor }}>{brief.todaysMarket.pressureIndex}<span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>/100</span></div></div>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>BIAS</div><div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: biasColor }}>{brief.todaysMarket.institutionalBias}</div></div>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>HEALTH</div><div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: '#F0F4FF' }}>{brief.todaysMarket.marketHealth}</div></div>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>STATUS</div><div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: statusColor }}>{brief.todaysMarket.marketStatus}</div></div>
          <div><div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '3px' }}>CONFIDENCE</div><div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: brief.todaysMarket.confidence > 65 ? '#00FF88' : '#FFD700' }}>{brief.todaysMarket.confidence}%</div></div>
        </div>
      </div>

      {/* Top Risks */}
      {brief.topRisks.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>TOP RISKS</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {brief.topRisks.map((risk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: '#FF4444', flexShrink: 0, marginTop: '2px' }}><AlertTriangle size={10} /></span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Opportunities */}
      {brief.topOpportunities.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>TOP OPPORTUNITIES</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {brief.topOpportunities.map((opp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '5px' }}>
                <span style={{ ...MONO, fontSize: '12px', fontWeight: 700, color: '#00FF88', minWidth: '60px' }}>{opp.ticker}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{opp.primaryDriver}</div>
                  <div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '2px' }}>{opp.suggestedAction} · {opp.timeHorizon}</div>
                </div>
                <div style={{ ...MONO, fontSize: '13px', fontWeight: 700, color: '#00FF88' }}>{opp.opportunityScore}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Intelligence */}
      {brief.watchlistIntelligence.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>WATCHLIST INTELLIGENCE</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {brief.watchlistIntelligence.map((w, i) => (
              <div key={i} style={{ padding: '6px 10px', background: w.direction === 'positive' ? 'rgba(0,255,136,0.06)' : w.direction === 'negative' ? 'rgba(255,68,68,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${w.direction === 'positive' ? 'rgba(0,255,136,0.15)' : w.direction === 'negative' ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '5px' }}>
                <div style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: w.direction === 'positive' ? '#00FF88' : w.direction === 'negative' ? '#FF4444' : '#FFD700' }}>{w.ticker}</div>
                <div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.4)', fontSize: '9px', marginTop: '2px' }}>{w.signal}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Events */}
      {brief.todaysEvents.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>TODAY'S KEY EVENTS</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {brief.todaysEvents.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ ...MONO_SM, fontSize: '9px', padding: '2px 5px', background: ev.importance === 'high' ? 'rgba(255,68,68,0.1)' : 'rgba(255,215,0,0.1)', color: ev.importance === 'high' ? '#FF4444' : '#FFD700', borderRadius: '3px', flexShrink: 0, marginTop: '1px', letterSpacing: '0.05em' }}>{ev.importance.toUpperCase()}</span>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#F0F4FF', fontWeight: 600 }}>{ev.event}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px', lineHeight: 1.4 }}>{ev.whyItMatters}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engine Status */}
      <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>{brief.engineStatus.fmosVersion}</span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>Health: <span style={{ color: '#00FF88' }}>{brief.engineStatus.engineHealth}%</span></span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>Sources: {brief.engineStatus.liveDataSources}</span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>Latency: {brief.engineStatus.averageLatency}</span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>Data: {brief.engineStatus.dataFreshness}</span>
      </div>

      {/* Follow-up chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {followUps.map((fu, i) => (
          <button
            key={i}
            onClick={() => onAskFollowUp(fu)}
            style={{
              padding: '6px 12px',
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '16px',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              fontSize: '11px',
              color: 'rgba(255,255,255,0.55)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; e.currentTarget.style.color = '#E8EDF5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >
            {fu}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── V3.0 Quick Action Chips ─────────────────────────────────
const QUICK_ACTIONS: Array<{ emoji: string; label: string; prompt: string }> = [
  { emoji: "📊", label: "Full Market Briefing", prompt: "Full Market Briefing" },
  { emoji: "🌍", label: "Macro Overview", prompt: "Give me a macro overview of the current market environment" },
  { emoji: "📈", label: "Market Regime", prompt: "What is the current market regime and what does it mean for investors?" },
  { emoji: "⚠️", label: "Top Risks Today", prompt: "What are the top risks in the market today?" },
  { emoji: "🚀", label: "Top Opportunities", prompt: "What are the top investment opportunities right now?" },
  { emoji: "₿", label: "Crypto Intelligence", prompt: "Give me a comprehensive crypto market intelligence report" },
  { emoji: "📅", label: "Economic Calendar", prompt: "What are today's most important economic events and catalysts?" },
  { emoji: "💼", label: "Portfolio Risk Review", prompt: "Review current portfolio risk conditions and what I should watch" },
  { emoji: "📰", label: "What Changed?", prompt: "What changed in the market since yesterday?" },
  { emoji: "🔄", label: "Sector Rotation", prompt: "Analyze current sector rotation and where institutional money is flowing" },
];

// ── V3.0 Market Snapshot Component ───────────────────────────
function MarketSnapshot({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  const { output, lastUpdated, isLoading } = useEngine();
  const { overall, regime, domains, probability } = output;

  const pressureScore = Math.round(overall.score * 10); // 0-100
  const liquidityDomain = domains.find(d => d.id === 'liquidity');
  const creditDomain = domains.find(d => d.id === 'credit-stress');

  // Derive institutional bias
  const bias = useMemo(() => {
    const p = pressureScore;
    const r = regime.label.toLowerCase();
    if (p < 25) return r.includes('expansion') || r.includes('bull') ? 'Strongly Bullish' : 'Moderately Bullish';
    if (p < 45) return r.includes('expansion') ? 'Moderately Bullish' : 'Neutral to Cautious';
    if (p < 65) return 'Cautious';
    if (p < 80) return 'Defensive';
    return 'Risk-Off';
  }, [pressureScore, regime.label]);

  const biasColor = bias.includes('Bull') ? '#00FF88' : bias === 'Neutral to Cautious' ? '#FFD700' : bias === 'Cautious' ? '#FF9500' : '#FF4444';

  // Market health
  const breadth = Math.max(0, Math.min(100, Math.round(100 - overall.score * 10)));
  const liquidity = liquidityDomain ? Math.max(0, Math.min(100, Math.round((10 - liquidityDomain.score) * 10))) : 50;
  const health = useMemo(() => {
    const composite = (100 - pressureScore) * 0.4 + breadth * 0.3 + liquidity * 0.3;
    if (composite >= 75) return { label: 'HEALTHY', color: '#00FF88' };
    if (composite >= 55) return { label: 'MODERATE', color: '#FFD700' };
    if (composite >= 35) return { label: 'STRESSED', color: '#FF9500' };
    return { label: 'CRITICAL', color: '#FF4444' };
  }, [pressureScore, breadth, liquidity]);

  const pressureColor = pressureScore < 30 ? '#00FF88' : pressureScore < 55 ? '#FFD700' : pressureScore < 75 ? '#FF9500' : '#FF4444';
  const freshness = lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime()) / 60000)}m ago` : 'Loading...';

  if (isLoading) {
    return (
      <div style={{ padding: '14px 16px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)', borderRadius: '8px', ...MONO_SM, color: 'rgba(255,255,255,0.3)' }}>
        Loading market data...
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,212,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...MONO_SM, color: ACCENT, letterSpacing: '0.12em', fontSize: '10px' }}>TODAY'S MARKET SNAPSHOT</span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>Updated {freshness}</span>
      </div>
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {/* Regime */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '0.1em' }}>REGIME</span>
          <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: '#F0F4FF', lineHeight: 1.3 }}>{regime.label}</span>
        </div>
        {/* Pressure Index */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '0.1em' }}>PRESSURE INDEX</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ ...MONO, fontSize: '13px', fontWeight: 700, color: pressureColor }}>{pressureScore}</span>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>/100</span>
          </div>
        </div>
        {/* Institutional Bias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '0.1em' }}>INSTITUTIONAL BIAS</span>
          <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: biasColor }}>{bias}</span>
        </div>
        {/* Market Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '0.1em' }}>MARKET HEALTH</span>
          <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: health.color }}>{health.label}</span>
        </div>
        {/* Bull Probability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '0.1em' }}>BULL PROBABILITY</span>
          <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, color: probability.bullProbability > 55 ? '#00FF88' : probability.bullProbability > 40 ? '#FFD700' : '#FF4444' }}>{probability.bullProbability}%</span>
        </div>
      </div>
    </div>
  );
}

// ── V3.0 Since Last Visit Component ──────────────────────────
function SinceLastVisit({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  const { output } = useEngine();
  const { overall, regime, domains } = output;
  const pressureScore = Math.round(overall.score * 10);
  const liquidityDomain = domains.find(d => d.id === 'liquidity');
  const creditDomain = domains.find(d => d.id === 'credit-stress');

  const getPreferences = trpc.dailyBrief.getPreferences.useQuery(undefined, { retry: false });
  const getChanges = trpc.dailyBrief.getChanges.useQuery(
    {
      currentSnapshot: {
        overallPressure: pressureScore,
        regime: regime.label,
        liquidity: liquidityDomain ? Math.round((10 - liquidityDomain.score) * 10) : 50,
        credit: creditDomain ? Math.round(creditDomain.score * 10) : 30,
        breadth: Math.max(0, Math.min(100, Math.round(100 - overall.score * 10))),
        aiConcentration: 32,
        volatility: 40,
        bullProbability: output.probability.bullProbability,
        timestamp: Date.now(),
      },
    },
    { enabled: !!getPreferences.data?.lastVisitAt, retry: false }
  );

  if (!getPreferences.data?.lastVisitAt) return null;
  if (getChanges.isLoading) return null;

  const { changes, hasChanges } = getChanges.data ?? { changes: [], hasChanges: false };
  const lastVisitAt = getPreferences.data.lastVisitAt;
  const timeAgo = lastVisitAt ? (() => {
    const diff = Date.now() - lastVisitAt;
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return 'recently';
  })() : '';

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', fontSize: '10px' }}>SINCE YOUR LAST VISIT</span>
        <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>{timeAgo}</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {!hasChanges ? (
          <div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontStyle: 'italic' }}>
            No material market changes since your last visit.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {changes.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: c.direction === 'up' ? '#FF4444' : c.direction === 'down' ? '#00FF88' : '#FFD700', flexShrink: 0 }}>
                  {c.direction === 'up' ? <ArrowUp size={10} /> : c.direction === 'down' ? <ArrowDown size={10} /> : <Minus size={10} />}
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: c.significance === 'high' ? '#F0F4FF' : 'rgba(255,255,255,0.55)' }}>
                  {c.label}{c.delta ? ` ${c.delta}` : ''}
                </span>
                {c.significance === 'high' && (
                  <span style={{ ...MONO_SM, fontSize: '9px', color: '#FF9500', padding: '1px 4px', background: 'rgba(255,149,0,0.1)', borderRadius: '3px', flexShrink: 0 }}>HIGH</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Check if onboarding is needed (first-time user)
  const preferencesQuery = trpc.dailyBrief.getPreferences.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  useEffect(() => {
    if (!user || preferencesQuery.isLoading) return;
    const data = preferencesQuery.data;
    if (!data || !data.onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [user, preferencesQuery.isLoading, preferencesQuery.data]);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askMutation = trpc.smartDiscovery.ask.useMutation();
  const logMutation = trpc.smartDiscovery.logRecommendation.useMutation();
  const recordVisitMutation = trpc.dailyBrief.recordVisit.useMutation();
  const generateBriefMutation = trpc.dailyBrief.generateBrief.useMutation();
  const { output: engineOutput } = useEngine();
  // Record visit on mount (for Since Your Last Visit tracking)
  useEffect(() => {
    if (!user) return;
    const { overall, regime, domains, probability } = engineOutput;
    const pressureScore = Math.round(overall.score * 10);
    const liquidityDomain = domains.find(d => d.id === 'liquidity');
    const creditDomain = domains.find(d => d.id === 'credit-stress');
    recordVisitMutation.mutate({
      snapshot: {
        overallPressure: pressureScore,
        regime: regime.label,
        liquidity: liquidityDomain ? Math.round((10 - liquidityDomain.score) * 10) : 50,
        credit: creditDomain ? Math.round(creditDomain.score * 10) : 30,
        breadth: Math.max(0, Math.min(100, Math.round(100 - overall.score * 10))),
        aiConcentration: 32,
        volatility: 40,
        bullProbability: probability.bullProbability,
        timestamp: Date.now(),
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
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
    }, 500);
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
      // V3.0: Intercept Full Market Briefing requests
      const isBriefRequest = question.toLowerCase().includes('full market briefing') || question.toLowerCase() === 'daily brief' || question.toLowerCase() === 'market brief';
      if (isBriefRequest) {
        const { overall, regime, domains, probability } = engineOutput;
        const pressureScore = Math.round(overall.score * 10);
        const liquidityDomain = domains.find(d => d.id === 'liquidity');
        const creditDomain = domains.find(d => d.id === 'credit-stress');
        const briefResult = await generateBriefMutation.mutateAsync({
          engineSnapshot: {
            overallPressure: pressureScore,
            regime: regime.label,
            liquidity: liquidityDomain ? Math.round((10 - liquidityDomain.score) * 10) : 50,
            credit: creditDomain ? Math.round(creditDomain.score * 10) : 30,
            breadth: Math.max(0, Math.min(100, Math.round(100 - overall.score * 10))),
            aiConcentration: 32,
            volatility: 40,
            bullProbability: probability.bullProbability,
            timestamp: Date.now(),
          },
        });
        stopExecutionSequence();
        const briefMsg: ConversationMessage = {
          role: 'assistant',
          content: 'Institutional Daily Brief generated.',
          timestamp: Date.now(),
          briefAnswer: briefResult as BriefAnswer,
        };
        setConversation(prev => [...prev, briefMsg]);
        setIsExecuting(false);
        return;
      }
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

      // Log to Decision Ledger (fire-and-forget, only for logged-in users)
      if (user && answer.ticker) {
        logMutation.mutate({
          ticker: answer.ticker,
          assetType: answer.assetType as "stock" | "crypto" | null,
          verdict: answer.verdict,
          opportunityScore: answer.opportunityScore,
          confidence: answer.confidence,
          primaryDriver: answer.primaryDriver ?? "",
          expectedTimeframe: answer.expectedTimeframe ?? "",
          queryType: answer.queryType ?? "general",
        });
      }
    } catch (err: unknown) {
      stopExecutionSequence();
      let errorMsg = "FAULTLINE encountered an error. Please try again.";
      if (err && typeof err === "object") {
        const e = err as { message?: string; data?: { code?: string; httpStatus?: number } };
        const code = e.data?.code;
        const httpStatus = e.data?.httpStatus;
        const msg = e.message ?? "";
        if (code === "TOO_MANY_REQUESTS" || httpStatus === 429) {
          errorMsg = "Rate limit reached. Please wait a moment before trying again.";
        } else if (code === "UNAUTHORIZED" || httpStatus === 401) {
          errorMsg = "Session expired. Please refresh the page and log in again.";
        } else if (code === "TIMEOUT" || httpStatus === 504 || httpStatus === 408) {
          errorMsg = "Analysis timed out. Market data services may be slow — please try again.";
        } else if (msg.includes("invalid response") || msg.includes("parse")) {
          errorMsg = "FAULTLINE analysis engine returned an unexpected response. Please try again.";
        } else if (msg && msg !== "Unable to transform response from server") {
          errorMsg = msg;
        }
      }
      setError(errorMsg);
      setConversation(prev => prev.slice(0, -1));
    } finally {
      setIsExecuting(false);
    }
  }, [query, isExecuting, conversation, contextTicker, askMutation, logMutation, startExecutionSequence, stopExecutionSequence, setTicker, user]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ ...MONO_SM, color: ACCENT }}>LOADING...</div>
      </div>
    );
  }

  const isEmpty = conversation.length === 0 && !isExecuting;

  return (
    <>
      {/* V3.0 First-time onboarding overlay */}
      {showOnboarding && user && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}
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
                INSTITUTIONAL INTELLIGENCE V3.0
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
              <div style={{ width: "100%", maxWidth: "700px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* V3.0 Market Snapshot */}
                <MarketSnapshot onQuickAction={(prompt) => void handleSubmit(prompt)} />
                {/* V3.0 Since Your Last Visit */}
                <SinceLastVisit onQuickAction={(prompt) => void handleSubmit(prompt)} />
                {/* V3.0 Quick Action Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => void handleSubmit(action.prompt)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "7px 12px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "20px",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.55)",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(0,212,255,0.07)";
                        e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)";
                        e.currentTarget.style.color = "#E8EDF5";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                      }}
                    >
                      <span style={{ fontSize: "13px" }}>{action.emoji}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

            {/* Decision Ledger shortcut */}
            {user && (
              <button
                onClick={() => navigate("/app/decision-ledger")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "5px",
                  cursor: "pointer",
                  ...MONO_SM,
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)"; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                <BookOpen size={10} />
                DECISION LEDGER
              </button>
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
                ) : msg.briefAnswer ? (
                  <div className="fl-answer">
                    <FullMarketBriefingCard brief={msg.briefAnswer} onAskFollowUp={(prompt) => void handleSubmit(prompt)} />
                  </div>
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
              <button
                onClick={() => navigate("/app/decision-ledger")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  ...MONO_SM,
                  color: "rgba(0,212,255,0.4)",
                  fontSize: "10px",
                  padding: 0,
                }}
              >
                Ledger
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
