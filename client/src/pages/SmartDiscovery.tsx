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
  Star, TrendingUp as TrendUp, AlertCircle, Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import OnboardingFlow from "@/components/OnboardingFlow";
import DisclaimerBanner from "@/components/DisclaimerBanner";

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
  // Question intent
  questionIntent?: string;
  // Direct answer fields — downside
  downsideBaseZone?: string | null;
  downsideBearTarget?: string | null;
  downsideExtremeTarget?: string | null;
  downsideMostLikely?: string | null;
  downsideTriggers?: string[];
  downsideInvalidation?: string | null;
  // Direct answer fields — upside / target
  upsideBaseTarget?: string | null;
  upsideBullTarget?: string | null;
  upsideExtremeTarget?: string | null;
  upsideMostLikely?: string | null;
  upsideCatalysts?: string[];
  upsideInvalidation?: string | null;
  // Direct answer fields — buy/sell/wait verdict
  actionVerdict?: string | null;
  actionVerdictReason?: string | null;
  actionVerdictConditions?: string[];
  // Direct answer fields — entry zone
  entryZoneIdeal?: string | null;
  entryZoneAggressive?: string | null;
  entryZoneConservative?: string | null;
  entryZoneStop?: string | null;
  entryZoneTarget?: string | null;
  entryZoneRR?: string | null;
  // Direct answer fields — exit zone
  exitZonePrimary?: string | null;
  exitZoneSecondary?: string | null;
  exitZoneFull?: string | null;
  exitZoneReason?: string | null;
  // Direct answer fields — invalidation
  invalidationPrice?: string | null;
  invalidationConditions?: string[];
  invalidationWhatHappens?: string | null;
  // Direct answer fields — risk assessment
  riskRating?: "LOW" | "MODERATE" | "HIGH" | "EXTREME" | null;
  riskSummary?: string | null;
  riskFactors?: string[];
  riskRewardRatio?: string | null;
  maxDrawdownEstimate?: string | null;
}

// ── Opportunity Ranking Types (mirrors server OpportunityRankingAnswer) ──
interface RankedOpportunityItem {
  rank: number;
  ticker: string;
  name: string;
  sector: string;
  assetType: "stock" | "crypto";
  action: "BUY" | "ACCUMULATE" | "WATCH" | "AVOID";
  convictionScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Extreme";
  primaryDriver: string;
  nearTermCatalyst: string;
  keyRisk: string;
  thesisSummary: string;
  entryZone: string | null;
  stopLevel: string | null;
  targetOne: string | null;
  riskRewardRatio: string | null;
  dataFreshness: string;
}

interface SectorRating {
  sector: string;
  rating: 1 | 2 | 3 | 4 | 5;
  bias: "bullish" | "bearish" | "neutral";
  reason: string;
}

interface OpportunityRankingAnswer {
  queryType: "opportunity";
  macroContext: string;
  regimeLabel: string;
  regimeColor: "green" | "yellow" | "red";
  topOpportunities: RankedOpportunityItem[];
  avoidList: Array<{ ticker: string; name: string; reason: string }>;
  sectorLeaderboard: SectorRating[];
  whyTheseRankHighest: string;
  followUpChips: string[];
  dataFreshness: string;
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
  opportunityAnswer?: OpportunityRankingAnswer;
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

// ── Direct Answer Panel ───────────────────────────────────────
// Renders the exact answer to the user's specific question BEFORE the full report

// ── Inline Bull/Bear Probability Bar (used inside DirectAnswerPanel) ────────
function InlineProbBar({ bull, bear }: { bull: number; bear: number }) {
  const neutral = Math.max(0, 100 - bull - bear);
  return (
    <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "5px" }}>
      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontSize: "9px", letterSpacing: "0.1em" }}>PROBABILITY DISTRIBUTION</div>
      <div style={{ display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden", gap: "1px" }}>
        <div style={{ width: `${bull}%`, background: "#00FF88" }} />
        {neutral > 0 && <div style={{ width: `${neutral}%`, background: "#FFD700" }} />}
        <div style={{ width: `${bear}%`, background: "#FF4444" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ ...MONO_SM, color: "#00FF88", fontSize: "10px" }}>BULL {bull}%</span>
        {neutral > 0 && <span style={{ ...MONO_SM, color: "#FFD700", fontSize: "10px" }}>NEUTRAL {neutral}%</span>}
        <span style={{ ...MONO_SM, color: "#FF4444", fontSize: "10px" }}>BEAR {bear}%</span>
      </div>
    </div>
  );
}

function DirectAnswerPanel({ answer }: { answer: FaultlineAnswer }) {
  const intent = answer.questionIntent;
  if (!intent || intent === "opportunity_ranking") return null;

  const panelStyle: React.CSSProperties = {
    padding: "16px 18px",
    background: "rgba(0, 255, 136, 0.04)",
    border: "1px solid rgba(0, 255, 136, 0.25)",
    borderRadius: "8px",
    marginBottom: "4px",
  };
  const labelStyle: React.CSSProperties = {
    ...MONO_SM, fontSize: "9px", letterSpacing: "0.14em",
    color: "#00FF88", marginBottom: "10px",
  };
  const subValueStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600,
    color: "rgba(255,255,255,0.75)",
  };
  const bigValueStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "22px", fontWeight: 800,
    color: "#FFFFFF", letterSpacing: "0.04em", lineHeight: 1.2,
  };
  const dimStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "12px",
    color: "rgba(255,255,255,0.5)", lineHeight: 1.5,
  };
  const rowStyle: React.CSSProperties = {
    display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "10px",
  };
  const colStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: "2px", minWidth: "120px",
  };
  const colLabelStyle: React.CSSProperties = {
    ...MONO_SM, fontSize: "8px", letterSpacing: "0.12em",
    color: "rgba(255,255,255,0.35)",
  };
  const colValueStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 700,
    color: "#E8EDF5",
  };
  const bulletStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "12px",
    color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
    paddingLeft: "14px",
  };

  // ── Downside ──
  if (intent === "downside") {
    const hasData = answer.downsideBaseZone || answer.downsideBearTarget || answer.downsideExtremeTarget;
    if (!hasData) return null;
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>DIRECT ANSWER — DOWNSIDE ANALYSIS</div>
        {answer.downsideMostLikely && (
          <div style={{ ...subValueStyle, marginBottom: "12px", color: "#E8EDF5" }}>{answer.downsideMostLikely}</div>
        )}
        <div style={rowStyle}>
          {answer.downsideBaseZone && (
            <div style={colStyle}>
              <div style={colLabelStyle}>BASE CASE SUPPORT</div>
              <div style={colValueStyle}>{answer.downsideBaseZone}</div>
            </div>
          )}
          {answer.downsideBearTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>BEAR CASE TARGET</div>
              <div style={{ ...colValueStyle, color: "#FF6B6B" }}>{answer.downsideBearTarget}</div>
            </div>
          )}
          {answer.downsideExtremeTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>EXTREME SCENARIO</div>
              <div style={{ ...colValueStyle, color: "#FF4444" }}>{answer.downsideExtremeTarget}</div>
            </div>
          )}
        </div>
        {answer.downsideTriggers && answer.downsideTriggers.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div style={colLabelStyle}>WHAT TRIGGERS EACH LEVEL</div>
            {answer.downsideTriggers.map((t, i) => (
              <div key={i} style={bulletStyle}>• {t}</div>
            ))}
          </div>
        )}
        {answer.downsideInvalidation && (
          <div style={{ marginTop: "8px", ...dimStyle, color: "rgba(0,255,136,0.6)" }}>
            ⚠ {answer.downsideInvalidation}
          </div>
        )}
      </div>
    );
  }

  // ── Upside / Target Price ──
  if (intent === "upside" || intent === "target_price") {
    const hasData = answer.upsideBaseTarget || answer.upsideBullTarget || answer.upsideExtremeTarget;
    if (!hasData) return null;
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>DIRECT ANSWER — UPSIDE ANALYSIS</div>
        {answer.upsideMostLikely && (
          <div style={{ ...subValueStyle, marginBottom: "12px", color: "#E8EDF5" }}>{answer.upsideMostLikely}</div>
        )}
        <div style={rowStyle}>
          {answer.upsideBaseTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>BASE CASE TARGET</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.upsideBaseTarget}</div>
            </div>
          )}
          {answer.upsideBullTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>BULL CASE TARGET</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.upsideBullTarget}</div>
            </div>
          )}
          {answer.upsideExtremeTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>EXTREME / MOONSHOT</div>
              <div style={{ ...colValueStyle, color: "#FFD700" }}>{answer.upsideExtremeTarget}</div>
            </div>
          )}
        </div>
        {answer.upsideCatalysts && answer.upsideCatalysts.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div style={colLabelStyle}>WHAT TRIGGERS EACH LEVEL</div>
            {answer.upsideCatalysts.map((c, i) => (
              <div key={i} style={bulletStyle}>• {c}</div>
            ))}
          </div>
        )}
        {answer.upsideInvalidation && (
          <div style={{ marginTop: "8px", ...dimStyle, color: "rgba(255,100,100,0.7)" }}>
            ⚠ {answer.upsideInvalidation}
          </div>
        )}
      </div>
    );
  }

  // ── Buy / Sell / Wait Verdict ──
  if (intent === "buy_verdict" || intent === "sell_verdict" || intent === "wait_verdict" || intent === "compare") {
    if (!answer.actionVerdict) return null;
    const verdictColors: Record<string, string> = {
      "BUY NOW": "#00FF88", "ACCUMULATE": "#00CC6A", "WAIT": "#FFD700",
      "SELL": "#FF4444", "REDUCE": "#FF6B6B", "HOLD": "#FFD700",
    };
    const vc = verdictColors[answer.actionVerdict] ?? "#E8EDF5";
    const intentLabel = intent === "buy_verdict" ? "BUY VERDICT" : intent === "sell_verdict" ? "SELL VERDICT" : intent === "compare" ? "COMPARISON VERDICT" : "TIMING VERDICT";
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>DIRECT ANSWER — {intentLabel}</div>
        <div style={{ ...bigValueStyle, color: vc, marginBottom: "8px" }}>{answer.actionVerdict}</div>
        {answer.actionVerdictReason && (
          <div style={{ ...subValueStyle, fontSize: "13px", marginBottom: "10px", color: "rgba(255,255,255,0.8)" }}>{answer.actionVerdictReason}</div>
        )}
        {answer.actionVerdictConditions && answer.actionVerdictConditions.length > 0 && (
          <div>
            <div style={colLabelStyle}>CONDITIONS THAT WOULD CHANGE THIS</div>
            {answer.actionVerdictConditions.map((c, i) => (
              <div key={i} style={bulletStyle}>• {c}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Entry Zone ──
  if (intent === "entry_zone") {
    const hasData = answer.entryZoneIdeal || answer.entryZoneAggressive || answer.entryZoneConservative;
    if (!hasData) return null;
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>DIRECT ANSWER — ENTRY ZONES</div>
        <div style={rowStyle}>
          {answer.entryZoneIdeal && (
            <div style={colStyle}>
              <div style={colLabelStyle}>IDEAL ENTRY</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.entryZoneIdeal}</div>
            </div>
          )}
          {answer.entryZoneAggressive && (
            <div style={colStyle}>
              <div style={colLabelStyle}>AGGRESSIVE (MOMENTUM)</div>
              <div style={colValueStyle}>{answer.entryZoneAggressive}</div>
            </div>
          )}
          {answer.entryZoneConservative && (
            <div style={colStyle}>
              <div style={colLabelStyle}>CONSERVATIVE (PULLBACK)</div>
              <div style={colValueStyle}>{answer.entryZoneConservative}</div>
            </div>
          )}
        </div>
        <div style={rowStyle}>
          {answer.entryZoneStop && (
            <div style={colStyle}>
              <div style={colLabelStyle}>STOP LOSS</div>
              <div style={{ ...colValueStyle, color: "#FF6B6B" }}>{answer.entryZoneStop}</div>
            </div>
          )}
          {answer.entryZoneTarget && (
            <div style={colStyle}>
              <div style={colLabelStyle}>FIRST TARGET</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.entryZoneTarget}</div>
            </div>
          )}
          {answer.entryZoneRR && (
            <div style={colStyle}>
              <div style={colLabelStyle}>RISK:REWARD</div>
              <div style={colValueStyle}>{answer.entryZoneRR}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Exit Zone ──
  if (intent === "exit_zone") {
    const hasData = answer.exitZonePrimary || answer.exitZoneSecondary;
    if (!hasData) return null;
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>DIRECT ANSWER — EXIT / TAKE PROFIT ZONES</div>
        <div style={rowStyle}>
          {answer.exitZonePrimary && (
            <div style={colStyle}>
              <div style={colLabelStyle}>FIRST TARGET (PARTIAL EXIT)</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.exitZonePrimary}</div>
            </div>
          )}
          {answer.exitZoneSecondary && (
            <div style={colStyle}>
              <div style={colLabelStyle}>SECOND TARGET (FULL EXIT)</div>
              <div style={{ ...colValueStyle, color: "#00FF88" }}>{answer.exitZoneSecondary}</div>
            </div>
          )}
          {answer.exitZoneFull && (
            <div style={colStyle}>
              <div style={colLabelStyle}>STOP OUT LEVEL</div>
              <div style={{ ...colValueStyle, color: "#FF6B6B" }}>{answer.exitZoneFull}</div>
            </div>
          )}
        </div>
        {answer.exitZoneReason && (
          <div style={{ ...dimStyle, marginTop: "6px" }}>{answer.exitZoneReason}</div>
        )}
      </div>
    );
  }

  // ── Invalidation ──
  if (intent === "invalidation") {
    if (!answer.invalidationPrice && (!answer.invalidationConditions || answer.invalidationConditions.length === 0)) return null;
    return (
      <div style={{ ...panelStyle, border: "1px solid rgba(255, 100, 100, 0.3)", background: "rgba(255, 68, 68, 0.04)" }}>
        <div style={{ ...labelStyle, color: "#FF6B6B" }}>DIRECT ANSWER — INVALIDATION LEVELS</div>
        {answer.invalidationPrice && (
          <div style={{ ...bigValueStyle, color: "#FF4444", marginBottom: "8px" }}>{answer.invalidationPrice}</div>
        )}
        {answer.invalidationConditions && answer.invalidationConditions.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={colLabelStyle}>CONDITIONS THAT BREAK THE THESIS</div>
            {answer.invalidationConditions.map((c, i) => (
              <div key={i} style={{ ...bulletStyle, color: "rgba(255,100,100,0.8)" }}>• {c}</div>
            ))}
          </div>
        )}
        {answer.invalidationWhatHappens && (
          <div style={{ ...dimStyle, color: "rgba(255,200,200,0.7)" }}>→ {answer.invalidationWhatHappens}</div>
        )}
      </div>
    );
  }

  // ── General Analysis — lead with verdict + bull/bear ──
  if (intent === "general_analysis") {
    const verdictColors: Record<string, string> = {
      "STRONG BUY": "#00FF88", "BUY": "#00FF88", "ACCUMULATE": "#00CC6A",
      "WAIT": "#FFD700", "HOLD": "#FFD700", "LOW CONVICTION": "#FFD700",
      "REDUCE": "#FF6B6B", "STRONG REDUCE": "#FF4444", "SELL": "#FF4444",
      "HIGH RISK": "#FF4444", "MACRO ANSWER": ACCENT,
    };
    const vc = verdictColors[answer.verdict] ?? "#E8EDF5";
    const bull = answer.bullProbability ?? 50;
    const bear = answer.bearProbability ?? 50;
    return (
      <div style={{ ...panelStyle, border: `1px solid ${vc}33`, background: `${vc}06` }}>
        <div style={{ ...labelStyle, color: vc }}>DIRECT ANSWER</div>
        <div style={{ ...bigValueStyle, color: vc, marginBottom: "6px" }}>{answer.verdict}</div>
        {answer.primaryDriver && (
          <div style={{ ...subValueStyle, fontSize: "13px", marginBottom: "8px", color: "rgba(255,255,255,0.8)" }}>{answer.primaryDriver}</div>
        )}
        {answer.executiveSummary && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: "4px" }}>{answer.executiveSummary}</div>
        )}
        <InlineProbBar bull={bull} bear={bear} />
      </div>
    );
  }

  // ── Risk Assessment ──
  if (intent === "risk_assessment") {
    const riskColors: Record<string, string> = {
      "LOW": "#00FF88", "MODERATE": "#FFD700", "HIGH": "#FF8C00", "EXTREME": "#FF4444",
    };
    const rc = answer.riskRating ? (riskColors[answer.riskRating] ?? "#E8EDF5") : "#FFD700";
    const bull = answer.bullProbability ?? 50;
    const bear = answer.bearProbability ?? 50;
    return (
      <div style={{ ...panelStyle, border: `1px solid ${rc}33`, background: `${rc}08` }}>
        <div style={{ ...labelStyle, color: rc }}>DIRECT ANSWER — RISK ASSESSMENT</div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
          {answer.riskRating && <div style={{ ...bigValueStyle, color: rc }}>{answer.riskRating} RISK</div>}
          {answer.riskRewardRatio && (
            <div style={colStyle}>
              <div style={colLabelStyle}>RISK:REWARD</div>
              <div style={{ ...colValueStyle, color: "#E8EDF5" }}>{answer.riskRewardRatio}</div>
            </div>
          )}
          {answer.maxDrawdownEstimate && (
            <div style={colStyle}>
              <div style={colLabelStyle}>MAX DRAWDOWN EST.</div>
              <div style={{ ...colValueStyle, color: "#FF6B6B" }}>{answer.maxDrawdownEstimate}</div>
            </div>
          )}
        </div>
        {answer.riskSummary && (
          <div style={{ ...subValueStyle, fontSize: "13px", marginBottom: "8px", color: "rgba(255,255,255,0.8)" }}>{answer.riskSummary}</div>
        )}
        {answer.riskFactors && answer.riskFactors.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={colLabelStyle}>KEY RISK FACTORS</div>
            {answer.riskFactors.map((r, i) => (
              <div key={i} style={bulletStyle}>• {r}</div>
            ))}
          </div>
        )}
        <InlineProbBar bull={bull} bear={bear} />
      </div>
    );
  }

  return null;
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
  // For general_analysis the DirectAnswerPanel already shows the executive summary — skip it in the body
  const isGeneralAnalysis = answer.questionIntent === "general_analysis";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── DIRECT ANSWER PANEL (renders first for ALL question types) ── */}
      <DirectAnswerPanel answer={answer} />

      {/* ── Bull / Bear with Probabilities — always visible, immediately after direct answer ── */}
      {!isGeneralAnalysis && <BullBearSection answer={answer} />}

      {/* ── BOTTOM LINE card (verdict + scores + action) ── */}
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

      {/* ── Executive Summary (only for non-general_analysis, since general_analysis shows it in DirectAnswerPanel) ── */}
      {!isGeneralAnalysis && (
        <div style={{ padding: "16px 18px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
          <div style={{ ...MONO_SM, color: ACCENT, marginBottom: "8px", letterSpacing: "0.12em" }}>FAULTLINE ASSESSMENT</div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#E8EDF5", lineHeight: 1.7, margin: 0 }}>
            {answer.executiveSummary}
          </p>
        </div>
      )}

      {/* ── Evidence Engine (14 categories) ── */}
      {answer.evidenceScores && answer.evidenceScores.length > 0 && (
        <EvidenceEngineGrid scores={answer.evidenceScores} />
      )}

      {/* ── Bull / Bear (shown here for general_analysis since InlineProbBar is already in DirectAnswerPanel) ── */}
      {isGeneralAnalysis && <BullBearSection answer={answer} />}

      {/* ── Why Not Buy/Sell (only for WAIT/HOLD) ── */}
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

      {/* ── What Changes Our View ── */}
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

// ── Opportunity Ranking Card (AI Intent Routing) ─────────────

function HoverTip({ label, tip }: { label: string; tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", cursor: "help" }}>
            {label}
            <Info size={10} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs bg-gray-900 border border-gray-700 text-gray-200 p-3">
          <p>{tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BUY:        { bg: "rgba(0,255,136,0.12)",  border: "rgba(0,255,136,0.35)",  text: "#00FF88" },
  ACCUMULATE: { bg: "rgba(0,212,255,0.10)",  border: "rgba(0,212,255,0.30)",  text: "#00D4FF" },
  WATCH:      { bg: "rgba(255,215,0,0.08)",  border: "rgba(255,215,0,0.25)",  text: "#FFD700" },
  AVOID:      { bg: "rgba(255,68,68,0.08)",  border: "rgba(255,68,68,0.25)",  text: "#FF4444" },
};

const RISK_COLORS: Record<string, string> = {
  Low:     "#00FF88",
  Medium:  "#FFD700",
  High:    "#FF9500",
  Extreme: "#FF4444",
};

const STAR_COLORS: Record<number, string> = {
  5: "#00FF88",
  4: "#7CFF7C",
  3: "#FFD700",
  2: "#FF9500",
  1: "#FF4444",
};

const BIAS_COLORS: Record<string, string> = {
  bullish: "#00FF88",
  bearish: "#FF4444",
  neutral: "#FFD700",
};

function OpportunityRankingCard({ answer, onAskFollowUp, onDeepDive, onSelectAsset }: {
  answer: OpportunityRankingAnswer;
  onAskFollowUp: (prompt: string) => void;
  onDeepDive: (path: string) => void;
  onSelectAsset: (ticker: string, name: string, assetType: "stock" | "crypto") => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showSectors, setShowSectors] = useState(false);
  const [showAvoid, setShowAvoid] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);

  const regimeColor = answer.regimeColor === "green" ? "#00FF88" : answer.regimeColor === "red" ? "#FF4444" : "#FFD700";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── Header: Macro Context ── */}
      <div style={{
        padding: "14px 18px",
        background: "rgba(0,212,255,0.04)",
        border: "1px solid rgba(0,212,255,0.14)",
        borderRadius: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={12} style={{ color: ACCENT }} />
            <span style={{ ...MONO_SM, color: ACCENT, letterSpacing: "0.12em" }}>OPPORTUNITY SCAN — FULL MARKET UNIVERSE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: regimeColor }} />
            <span style={{ ...MONO_SM, color: regimeColor, fontSize: "10px", fontWeight: 700 }}>{answer.regimeLabel}</span>
          </div>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D4E0", lineHeight: 1.65, margin: 0 }}>
          {answer.macroContext}
        </p>
        <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "9px", marginTop: "8px" }}>
          {answer.dataFreshness}
        </div>
      </div>

      {/* ── Why These Rank Highest ── */}
      <div style={{
        padding: "12px 16px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}>
        <Zap size={12} style={{ color: "#FFD700", marginTop: "2px", flexShrink: 0 }} />
        <div>
          <div style={{ ...MONO_SM, color: "#FFD700", marginBottom: "4px", fontSize: "9px", letterSpacing: "0.12em" }}>WHY THESE RANK HIGHEST</div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#C8D4E0", lineHeight: 1.65, margin: 0 }}>
            {answer.whyTheseRankHighest}
          </p>
        </div>
      </div>

      {/* ── Ranked Opportunities ── */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
          <span style={{ ...MONO_SM, color: ACCENT, letterSpacing: "0.12em" }}>RANKED OPPORTUNITIES</span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Tap any asset for full institutional report →</span>
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>{answer.topOpportunities.length} assets scored</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {answer.topOpportunities.map((opp, i) => {
            const ac = ACTION_COLORS[opp.action] ?? ACTION_COLORS.WATCH;
            const riskColor = RISK_COLORS[opp.riskLevel] ?? "#FFD700";
            const isExpanded = expandedIdx === i;
            const convColor = opp.convictionScore >= 70 ? "#00FF88" : opp.convictionScore >= 45 ? "#FFD700" : "#FF4444";
            return (
              <div key={i} style={{ borderBottom: i < answer.topOpportunities.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "11px 16px", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", transition: "background 0.12s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {/* Rank badge */}
                  <div style={{ ...MONO, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.25)", width: "18px", flexShrink: 0 }}>#{opp.rank}</div>

                  {/* Ticker + Name + Sector */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <span style={{ ...MONO, fontSize: "13px", fontWeight: 700, color: "#F0F4FF" }}>{opp.ticker}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>{opp.name}</span>
                      <span style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.25)", padding: "1px 5px", background: "rgba(255,255,255,0.04)", borderRadius: "3px" }}>{opp.sector}</span>
                      <span style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.2)", padding: "1px 5px", background: "rgba(255,255,255,0.03)", borderRadius: "3px", textTransform: "uppercase" }}>{opp.assetType}</span>
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opp.primaryDriver}
                    </div>
                  </div>

                  {/* Action badge */}
                  <div style={{ ...MONO_SM, fontSize: "10px", fontWeight: 700, padding: "3px 8px", background: ac.bg, border: `1px solid ${ac.border}`, borderRadius: "4px", color: ac.text, flexShrink: 0 }}>
                    {opp.action}
                  </div>

                  {/* Conviction score */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ ...MONO, fontSize: "14px", fontWeight: 700, color: convColor }}>{opp.convictionScore}</span>
                    <span style={{ ...MONO_SM, fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>SCORE</span>
                  </div>

                  {/* Risk badge */}
                  <div style={{ ...MONO_SM, fontSize: "9px", color: riskColor, padding: "2px 6px", background: `${riskColor}15`, border: `1px solid ${riskColor}30`, borderRadius: "3px", flexShrink: 0 }}>
                    {opp.riskLevel}
                  </div>

                  {/* Expand toggle */}
                  {isExpanded
                    ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                    : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Decision First: Full Report CTA */}
                    <button
                      onClick={() => onSelectAsset(opp.ticker, opp.name, opp.assetType)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        padding: "10px 16px",
                        background: `${ac.bg}`,
                        border: `1px solid ${ac.border}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: ac.text,
                        letterSpacing: "0.06em",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      <span>OPEN FULL INSTITUTIONAL REPORT FOR {opp.ticker}</span>
                      <ExternalLink size={11} />
                    </button>

                    {/* Thesis */}
                    <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: "6px" }}>
                      <div style={{ ...MONO_SM, color: "rgba(255,255,255,0.3)", marginBottom: "4px", fontSize: "9px" }}>INSTITUTIONAL THESIS</div>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#C8D4E0", lineHeight: 1.6, margin: 0 }}>{opp.thesisSummary}</p>
                    </div>

                    {/* Key metrics grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
                      {opp.entryZone && (
                        <div style={{ padding: "8px 10px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "5px" }}>
                          <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>
                            <HoverTip label="ENTRY ZONE" tip="The price range where risk/reward is most favorable. Entering within this zone maximizes the trade's probability of success." />
                          </div>
                          <div style={{ ...MONO, fontSize: "12px", color: "#00FF88", fontWeight: 700 }}>{opp.entryZone}</div>
                        </div>
                      )}
                      {opp.stopLevel && (
                        <div style={{ padding: "8px 10px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.12)", borderRadius: "5px" }}>
                          <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>
                            <HoverTip label="STOP LOSS" tip="The price level at which the trade thesis is invalidated. Exiting at this level caps maximum loss." />
                          </div>
                          <div style={{ ...MONO, fontSize: "12px", color: "#FF4444", fontWeight: 700 }}>{opp.stopLevel}</div>
                        </div>
                      )}
                      {opp.targetOne && (
                        <div style={{ padding: "8px 10px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "5px" }}>
                          <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>
                            <HoverTip label="TARGET" tip="Primary profit target based on technical levels, historical resistance, and macro context." />
                          </div>
                          <div style={{ ...MONO, fontSize: "12px", color: ACCENT, fontWeight: 700 }}>{opp.targetOne}</div>
                        </div>
                      )}
                      {opp.riskRewardRatio && (
                        <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: "5px" }}>
                          <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>
                            <HoverTip label="R/R RATIO" tip="Risk-to-reward ratio. A ratio of 1:3 means you risk $1 to potentially gain $3. Institutional traders typically require at least 1:2." />
                          </div>
                          <div style={{ ...MONO, fontSize: "12px", color: "#F0F4FF", fontWeight: 700 }}>{opp.riskRewardRatio}</div>
                        </div>
                      )}
                    </div>

                    {/* Catalyst + Risk row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div style={{ padding: "8px 10px", background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.08)", borderRadius: "5px" }}>
                        <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "3px" }}>NEAR-TERM CATALYST</div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#A8D8A8", lineHeight: 1.5, margin: 0 }}>{opp.nearTermCatalyst}</p>
                      </div>
                      <div style={{ padding: "8px 10px", background: "rgba(255,68,68,0.03)", border: "1px solid rgba(255,68,68,0.08)", borderRadius: "5px" }}>
                        <div style={{ ...MONO_SM, fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "3px" }}>KEY RISK</div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#D8A8A8", lineHeight: 1.5, margin: 0 }}>{opp.keyRisk}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sector Leaderboard ── */}
      {answer.sectorLeaderboard && answer.sectorLeaderboard.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          <button
            onClick={() => setShowSectors(v => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer" }}
          >
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em" }}>SECTOR LEADERBOARD</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>{answer.sectorLeaderboard.length} sectors rated</span>
              {showSectors ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />}
            </div>
          </button>
          {showSectors && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {answer.sectorLeaderboard.map((s, i) => {
                const starColor = STAR_COLORS[s.rating] ?? "#FFD700";
                const biasColor = BIAS_COLORS[s.bias] ?? "#FFD700";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: "5px" }}>
                    {/* Stars */}
                    <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={9} style={{ color: n <= s.rating ? starColor : "rgba(255,255,255,0.12)", fill: n <= s.rating ? starColor : "none" }} />
                      ))}
                    </div>
                    {/* Sector name */}
                    <span style={{ ...MONO_SM, fontSize: "11px", color: "#E8EDF5", fontWeight: 600, flex: 1, minWidth: 0 }}>{s.sector}</span>
                    {/* Bias badge */}
                    <span style={{ ...MONO_SM, fontSize: "9px", color: biasColor, padding: "2px 6px", background: `${biasColor}12`, border: `1px solid ${biasColor}25`, borderRadius: "3px", flexShrink: 0 }}>
                      {s.bias.toUpperCase()}
                    </span>
                    {/* Reason */}
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.35)", flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.reason}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Avoid List ── */}
      {answer.avoidList && answer.avoidList.length > 0 && (
        <div style={{ background: SURFACE, border: "1px solid rgba(255,68,68,0.12)", borderRadius: "8px", overflow: "hidden" }}>
          <button
            onClick={() => setShowAvoid(v => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <AlertCircle size={11} style={{ color: "#FF4444" }} />
              <span style={{ ...MONO_SM, color: "#FF6B6B", letterSpacing: "0.12em" }}>AVOID LIST</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>{answer.avoidList.length} flagged</span>
              {showAvoid ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />}
            </div>
          </button>
          {showAvoid && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {answer.avoidList.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 10px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.1)", borderRadius: "5px" }}>
                  <span style={{ ...MONO, fontSize: "12px", fontWeight: 700, color: "#FF6B6B", flexShrink: 0, minWidth: "48px" }}>{item.ticker}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.4)", flexShrink: 0, minWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,68,68,0.7)", lineHeight: 1.5 }}>{item.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Deep Dive Actions ── */}
      {answer.deepDiveLinks && answer.deepDiveLinks.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
          <button
            onClick={() => setShowDeepDive(v => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer" }}
          >
            <span style={{ ...MONO_SM, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>DEEPER ANALYSIS</span>
            {showDeepDive ? <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />}
          </button>
          {showDeepDive && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {answer.deepDiveLinks.map((link, i) => (
                <button
                  key={i}
                  onClick={() => onDeepDive(link.path)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "background 0.15s ease" }}
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
      )}

      {/* ── Follow-up Chips ── */}
      {answer.followUpChips && answer.followUpChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
          {answer.followUpChips.map((chip, i) => (
            <button
              key={i}
              onClick={() => onAskFollowUp(chip)}
              style={{
                padding: "7px 13px",
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.18)",
                borderRadius: "20px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: "12px",
                color: "rgba(0,212,255,0.85)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,212,255,0.12)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,212,255,0.06)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.18)"; }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
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
function FullMarketBriefingCard({ brief, onAskFollowUp, onSelectAsset }: { brief: BriefAnswer; onAskFollowUp: (prompt: string) => void; onSelectAsset?: (ticker: string, name: string, assetType: "stock" | "crypto") => void }) {
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

      {/* Top Opportunities — Decision First: each item is clickable */}
      {brief.topOpportunities.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...MONO_SM, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '10px' }}>TOP OPPORTUNITIES</span>
            {onSelectAsset && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Tap for full report →</span>}
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {brief.topOpportunities.map((opp, i) => (
              onSelectAsset ? (
                <button
                  key={i}
                  onClick={() => onSelectAsset(opp.ticker, opp.ticker, 'stock')}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s ease', width: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.09)'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.1)'; }}
                >
                  <span style={{ ...MONO, fontSize: '12px', fontWeight: 700, color: '#00FF88', minWidth: '60px' }}>{opp.ticker}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{opp.primaryDriver}</div>
                    <div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '2px' }}>{opp.suggestedAction} · {opp.timeHorizon}</div>
                  </div>
                  <div style={{ ...MONO, fontSize: '13px', fontWeight: 700, color: '#00FF88' }}>{opp.opportunityScore}</div>
                  <ExternalLink size={10} style={{ color: 'rgba(0,255,136,0.4)', flexShrink: 0 }} />
                </button>
              ) : (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '5px' }}>
                  <span style={{ ...MONO, fontSize: '12px', fontWeight: 700, color: '#00FF88', minWidth: '60px' }}>{opp.ticker}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{opp.primaryDriver}</div>
                    <div style={{ ...MONO_SM, color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '2px' }}>{opp.suggestedAction} · {opp.timeHorizon}</div>
                  </div>
                  <div style={{ ...MONO, fontSize: '13px', fontWeight: 700, color: '#00FF88' }}>{opp.opportunityScore}</div>
                </div>
              )
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
  // Auto-submit if ?q= URL param is present (used by MarketCommandCenter and other entry points)
  // Re-fires whenever the search string changes so navigating back with a new ?q= works too
  const locationSearch = typeof window !== "undefined" ? window.location.search : "";
  const [lastProcessedQuery, setLastProcessedQuery] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");
    if (urlQuery && urlQuery.trim() && urlQuery.trim() !== lastProcessedQuery) {
      setLastProcessedQuery(urlQuery.trim());
      // Remove the param from the URL without a page reload
      window.history.replaceState({}, "", window.location.pathname);
      // Small delay to let the page fully mount before submitting
      setTimeout(() => {
        void handleSubmit(urlQuery.trim());
      }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch]);

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

      // Route based on queryType
      if (answer.queryType === "opportunity") {
        const oppAnswer = answer as unknown as OpportunityRankingAnswer;
        const assistantMsg: ConversationMessage = {
          role: "assistant",
          content: oppAnswer.macroContext,
          timestamp: Date.now(),
          opportunityAnswer: oppAnswer,
        };
        setConversation(prev => [...prev, assistantMsg]);
      } else {
        const fa = answer as unknown as FaultlineAnswer;
        // Update global ticker if answer identified a security
        if (fa.ticker && fa.assetType) {
          setTicker(fa.ticker, fa.ticker, fa.assetType as "stock" | "crypto");
        }

        const assistantMsg: ConversationMessage = {
          role: "assistant",
          content: fa.executiveSummary,
          ticker: fa.ticker,
          timestamp: Date.now(),
          answer: fa,
        };
        setConversation(prev => [...prev, assistantMsg]);

        // Log to Decision Ledger (fire-and-forget, only for logged-in users)
        if (user && fa.ticker) {
          logMutation.mutate({
            ticker: fa.ticker,
            assetType: fa.assetType as "stock" | "crypto" | null,
            verdict: fa.verdict,
            opportunityScore: fa.opportunityScore,
            confidence: fa.confidence,
            primaryDriver: fa.primaryDriver ?? "",
            expectedTimeframe: fa.expectedTimeframe ?? "",
            queryType: fa.queryType ?? "general",
          });
        }
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

  // Decision First: selecting an asset from the ranked list sets global ticker context
  // and navigates to Symbol Intelligence for the full institutional report.
  const handleSelectAsset = useCallback((ticker: string, name: string, assetType: "stock" | "crypto") => {
    setTicker(ticker, name, assetType);
    navigate("/app/symbol-intelligence");
  }, [navigate, setTicker]);

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
          <div style={{ flex: 1, paddingTop: "24px", paddingBottom: "clamp(140px, 20vw, 180px)", display: "flex", flexDirection: "column", gap: "20px" }}>
            {conversation.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <UserBubble content={msg.content} />
                ) : msg.briefAnswer ? (
                  <div className="fl-answer">
                    <FullMarketBriefingCard brief={msg.briefAnswer} onAskFollowUp={(prompt) => void handleSubmit(prompt)} onSelectAsset={handleSelectAsset} />
                  </div>
                ) : msg.opportunityAnswer ? (
                  <div className="fl-answer">
                    <OpportunityRankingCard
                      answer={msg.opportunityAnswer}
                      onAskFollowUp={(prompt) => void handleSubmit(prompt)}
                      onDeepDive={handleDeepDive}
                      onSelectAsset={handleSelectAsset}
                    />
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
      <DisclaimerBanner variant="default" />
    </>
  );
}
