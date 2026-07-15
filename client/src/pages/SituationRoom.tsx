/* ============================================================
   FAULTLINE — Situation Room v2
   Market command center. Stress-test your next move before
   risking capital. Now with 8 new intelligence panels.
   ============================================================ */
import { useState, useRef, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useRegisterAshaContext } from "@/contexts/AshaContext";
import PageHeader from "@/components/PageHeader";
import SeismographNarrativeBanner from "@/components/SeismographNarrativeBanner";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trackSituationRoomUse, trackSituationRoomUsed } from "@/hooks/useAnalytics";
import {
  CheckCircle, XCircle, AlertTriangle, Target, Zap,
  TrendingUp, TrendingDown, Activity, Shield, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, Minus, Eye, Crosshair,
  DollarSign, History, FlaskConical, ArrowRight,
} from "lucide-react";
import FaultlineTerm from "@/components/FaultlineTerm";
import ScoreExplainer from "@/components/ScoreExplainer";
import { UniversalTickerHeader } from "@/components/UniversalTickerHeader";
import { useTickerStore } from "@/contexts/TickerStore";
import DecisionConfidencePanel, { type ConfidenceData } from "@/components/DecisionConfidencePanel";

// ── Types ─────────────────────────────────────────────────────
type MoveType =
  | "add_risk" | "reduce_risk" | "hedge" | "rotate"
  | "raise_cash" | "deploy_cash" | "buy_specific_asset" | "sell_specific_asset"
  | "hold";

type SimulatorTimeframe = "today" | "this_week" | "one_three_months" | "six_twelve_months";

type ThesisType =
  | "momentum" | "breakout" | "mean_reversion" | "long_term"
  | "value" | "ai_theme" | "crypto_cycle" | "sector_rotation" | "other";

type VerdictType = "APPROVED" | "CAUTION" | "WAIT" | "DEFENSIVE" | "HIGH_CONVICTION";

type ExposureCategory =
  | "ai_infrastructure" | "technology" | "large_cap_growth" | "small_cap_growth"
  | "value" | "dividend" | "financials" | "industrials" | "energy" | "healthcare"
  | "international" | "emerging_markets" | "bitcoin" | "ethereum" | "ai_crypto"
  | "altcoins" | "memecoins" | "options" | "leveraged_exposure" | "concentrated_position"
  | "custom_exposure" | "entire_portfolio" | "technology_exposure" | "ai_exposure"
  | "crypto_exposure" | "single_position" | "market_risk" | "recession_risk" | "inflation_risk";

// Step 2 options per move type
const EXPOSURE_STEP2: Record<MoveType, { value: ExposureCategory; label: string; sub: string }[]> = {
  add_risk: [
    { value: "ai_infrastructure",    label: "AI Infrastructure",   sub: "Semiconductors, data centers, cloud" },
    { value: "technology",           label: "Technology",          sub: "Broad tech exposure" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Mega-cap quality growth" },
    { value: "small_cap_growth",     label: "Small Cap Growth",    sub: "Higher beta, higher upside" },
    { value: "value",                label: "Value",               sub: "Below intrinsic worth" },
    { value: "dividend",             label: "Dividend",            sub: "Income + stability" },
    { value: "financials",           label: "Financials",          sub: "Banks, insurance, fintech" },
    { value: "industrials",          label: "Industrials",         sub: "Manufacturing, infrastructure" },
    { value: "energy",               label: "Energy",              sub: "Oil, gas, renewables" },
    { value: "healthcare",           label: "Healthcare",          sub: "Biotech, pharma, devices" },
    { value: "international",        label: "International",       sub: "Non-US developed markets" },
    { value: "emerging_markets",     label: "Emerging Markets",    sub: "EM exposure" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "BTC direct exposure" },
    { value: "ethereum",             label: "Ethereum",            sub: "ETH direct exposure" },
    { value: "ai_crypto",            label: "AI Crypto",           sub: "AI-themed tokens" },
    { value: "altcoins",             label: "Altcoins",            sub: "Broad alt exposure" },
    { value: "options",              label: "Options",             sub: "Calls, spreads, LEAPS" },
    { value: "leveraged_exposure",   label: "Leveraged",           sub: "2x/3x ETFs, margin" },
  ],
  reduce_risk: [
    { value: "technology",           label: "Technology",          sub: "Trim tech allocation" },
    { value: "ai_infrastructure",    label: "AI Infrastructure",   sub: "Trim AI/semis" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Reduce growth exposure" },
    { value: "small_cap_growth",     label: "Small Cap Growth",    sub: "Reduce high-beta" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "Reduce BTC" },
    { value: "ethereum",             label: "Ethereum",            sub: "Reduce ETH" },
    { value: "altcoins",             label: "Altcoins",            sub: "Reduce alt exposure" },
    { value: "leveraged_exposure",   label: "Leveraged",           sub: "Reduce leverage" },
    { value: "concentrated_position",label: "Concentrated Position",sub: "Trim single large position" },
    { value: "options",              label: "Options",             sub: "Close or roll options" },
  ],
  hedge: [
    { value: "entire_portfolio",     label: "Entire Portfolio",    sub: "Broad portfolio hedge" },
    { value: "technology_exposure",  label: "Technology Exposure", sub: "Hedge tech concentration" },
    { value: "ai_exposure",          label: "AI Exposure",         sub: "Hedge AI/semis" },
    { value: "crypto_exposure",      label: "Crypto Exposure",     sub: "Hedge crypto book" },
    { value: "single_position",      label: "Single Position",     sub: "Collar or put on one name" },
    { value: "market_risk",          label: "Market Risk",         sub: "SPX puts, VIX calls" },
    { value: "recession_risk",       label: "Recession Risk",      sub: "Defensive rotation hedge" },
    { value: "inflation_risk",       label: "Inflation Risk",      sub: "TIPS, commodities, gold" },
  ],
  rotate: [
    { value: "technology",           label: "Tech → Financials",   sub: "Growth to value rotation" },
    { value: "large_cap_growth",     label: "Growth → Value",      sub: "Style rotation" },
    { value: "energy",               label: "Into Energy",         sub: "Commodity cycle play" },
    { value: "healthcare",           label: "Into Healthcare",     sub: "Defensive rotation" },
    { value: "industrials",          label: "Into Industrials",    sub: "Capex cycle play" },
    { value: "international",        label: "US → International",  sub: "Geographic rotation" },
    { value: "emerging_markets",     label: "Into EM",             sub: "EM re-rating play" },
    { value: "bitcoin",              label: "Stocks → Bitcoin",    sub: "Risk-on crypto rotation" },
  ],
  raise_cash: [
    { value: "entire_portfolio",     label: "Across Portfolio",    sub: "Trim broadly, raise cash" },
    { value: "technology",           label: "From Technology",     sub: "Sell tech, hold cash" },
    { value: "large_cap_growth",     label: "From Growth",         sub: "Sell growth, hold cash" },
    { value: "bitcoin",              label: "From Crypto",         sub: "Sell crypto, hold cash" },
    { value: "concentrated_position",label: "Concentrated Position",sub: "Trim large single name" },
    { value: "leveraged_exposure",   label: "From Leverage",       sub: "Deleverage, hold cash" },
  ],
  deploy_cash: [
    { value: "ai_infrastructure",    label: "AI Infrastructure",   sub: "Deploy into AI/semis" },
    { value: "technology",           label: "Technology",          sub: "Deploy into broad tech" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Deploy into quality growth" },
    { value: "value",                label: "Value",               sub: "Deploy into value" },
    { value: "dividend",             label: "Dividend",            sub: "Deploy into income" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "Deploy into BTC" },
    { value: "ethereum",             label: "Ethereum",            sub: "Deploy into ETH" },
    { value: "emerging_markets",     label: "Emerging Markets",    sub: "Deploy into EM" },
  ],
  buy_specific_asset: [
    { value: "ai_infrastructure",    label: "AI / Semis",          sub: "NVDA, AMD, AVGO, TSM" },
    { value: "technology",           label: "Technology",          sub: "AAPL, MSFT, GOOGL, META" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Quality mega-cap" },
    { value: "small_cap_growth",     label: "Small Cap",           sub: "Higher beta names" },
    { value: "financials",           label: "Financials",          sub: "JPM, GS, BAC, V" },
    { value: "energy",               label: "Energy",              sub: "XOM, CVX, SLB" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "BTC or spot ETF" },
    { value: "ethereum",             label: "Ethereum",            sub: "ETH or spot ETF" },
    { value: "ai_crypto",            label: "AI Crypto",           sub: "NEAR, FET, RNDR" },
    { value: "altcoins",             label: "Altcoins",            sub: "SOL, AVAX, DOT" },
  ],
  sell_specific_asset: [
    { value: "ai_infrastructure",    label: "AI / Semis",          sub: "NVDA, AMD, AVGO" },
    { value: "technology",           label: "Technology",          sub: "AAPL, MSFT, GOOGL" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Quality mega-cap" },
    { value: "concentrated_position",label: "Concentrated Position",sub: "Single large holding" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "BTC or spot ETF" },
    { value: "ethereum",             label: "Ethereum",            sub: "ETH or spot ETF" },
    { value: "altcoins",             label: "Altcoins",            sub: "SOL, AVAX, DOT" },
    { value: "leveraged_exposure",   label: "Leveraged",           sub: "2x/3x ETF, margin" },
  ],
  hold: [
    { value: "ai_infrastructure",    label: "AI / Semis",          sub: "Holding AI/semis position" },
    { value: "technology",           label: "Technology",          sub: "Holding tech position" },
    { value: "large_cap_growth",     label: "Large Cap Growth",    sub: "Holding growth names" },
    { value: "small_cap_growth",     label: "Small Cap Growth",    sub: "Holding small-cap" },
    { value: "bitcoin",              label: "Bitcoin",             sub: "Holding BTC" },
    { value: "ethereum",             label: "Ethereum",            sub: "Holding ETH" },
    { value: "altcoins",             label: "Altcoins",            sub: "Holding altcoins" },
    { value: "concentrated_position",label: "Concentrated Position",sub: "Single large holding" },
    { value: "entire_portfolio",     label: "Entire Portfolio",    sub: "Holding all positions" },
  ],
};

// ── Crypto asset options ─────────────────────────────────────
const CRYPTO_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "BTC",   label: "Bitcoin",       icon: "₿" },
  { value: "ETH",   label: "Ethereum",      icon: "Ξ" },
  { value: "SOL",   label: "Solana",        icon: "◎" },
  { value: "BNB",   label: "BNB",           icon: "B" },
  { value: "XRP",   label: "XRP",           icon: "✕" },
  { value: "ADA",   label: "Cardano",       icon: "A" },
  { value: "AVAX",  label: "Avalanche",     icon: "△" },
  { value: "DOGE",  label: "Dogecoin",      icon: "D" },
  { value: "LINK",  label: "Chainlink",     icon: "L" },
  { value: "DOT",   label: "Polkadot",      icon: "●" },
  { value: "MATIC", label: "Polygon",       icon: "M" },
  { value: "UNI",   label: "Uniswap",       icon: "U" },
  { value: "ATOM",  label: "Cosmos",        icon: "A" },
  { value: "LTC",   label: "Litecoin",      icon: "L" },
  { value: "NEAR",  label: "NEAR Protocol", icon: "N" },
];

// ── Constants ─────────────────────────────────────────────────
const MOVE_OPTIONS: { value: MoveType; label: string; glyph: string; sub: string }[] = [
  { value: "add_risk",           label: "Add Risk",           glyph: "↑", sub: "Increase exposure to a sector, asset class, or theme" },
  { value: "reduce_risk",        label: "Reduce Risk",        glyph: "↓", sub: "Trim or exit positions to lower overall exposure" },
  { value: "hedge",              label: "Hedge",              glyph: "⛨", sub: "Protect existing positions against downside" },
  { value: "rotate",             label: "Rotate",             glyph: "⟳", sub: "Shift capital from one sector or asset to another" },
  { value: "raise_cash",         label: "Raise Cash",         glyph: "◎", sub: "Sell down and move to cash or equivalents" },
  { value: "deploy_cash",        label: "Deploy Cash",        glyph: "◈", sub: "Put idle cash to work in the market" },
  { value: "buy_specific_asset", label: "Buy Specific Asset", glyph: "₿", sub: "Enter a specific stock, ETF, or crypto position" },
  { value: "sell_specific_asset",label: "Sell Specific Asset",glyph: "✕", sub: "Exit or short a specific position" },
  { value: "hold",               label: "Hold",               glyph: "⏸", sub: "Stay in current positions — validate the decision" },
];

// ── Rotate From/To options ─────────────────────────────────────
const ROTATE_FROM_OPTIONS = [
  "Technology", "AI Infrastructure", "Large Cap Growth", "Small Cap Growth",
  "Financials", "Energy", "Healthcare", "Industrials", "Bitcoin", "Ethereum",
  "Altcoins", "Leveraged Exposure", "Emerging Markets", "International",
];
const ROTATE_TO_OPTIONS = [
  "Technology", "AI Infrastructure", "Large Cap Growth", "Small Cap Growth",
  "Financials", "Energy", "Healthcare", "Industrials", "Bitcoin", "Ethereum",
  "Altcoins", "Emerging Markets", "International", "Cash / T-Bills",
  "Gold / Commodities", "Dividend / Value",
];

// ── Raise Cash reason options ──────────────────────────────────
const RAISE_CASH_REASONS: { value: string; label: string; sub: string }[] = [
  { value: "risk_reduction",          label: "Risk Reduction",          sub: "Market conditions are deteriorating" },
  { value: "waiting_for_opportunity", label: "Waiting for Opportunity",  sub: "Dry powder for better entry" },
  { value: "near_term_expenses",      label: "Near-Term Expenses",       sub: "Capital needed soon" },
  { value: "market_concerns",         label: "Market Concerns",          sub: "Macro or geopolitical uncertainty" },
  { value: "tactical_positioning",    label: "Tactical Positioning",     sub: "Rotating to cash before re-entry" },
];

// ── Deploy Cash target options ─────────────────────────────────
const DEPLOY_CASH_TARGETS: { value: string; label: string; sub: string }[] = [
  { value: "ai",          label: "AI / Semis",       sub: "NVDA, AMD, AVGO, TSM" },
  { value: "technology",  label: "Technology",       sub: "Broad tech ETFs, FAANG" },
  { value: "financials",  label: "Financials",       sub: "JPM, GS, BAC, V" },
  { value: "energy",      label: "Energy",           sub: "XOM, CVX, SLB" },
  { value: "small_caps",  label: "Small Caps",       sub: "IWM, high-beta names" },
  { value: "bitcoin",     label: "Bitcoin",          sub: "BTC or spot ETF" },
  { value: "ethereum",    label: "Ethereum",         sub: "ETH or spot ETF" },
  { value: "ai_crypto",   label: "AI Crypto",        sub: "NEAR, FET, RNDR" },
  { value: "custom",      label: "Custom / Other",   sub: "Specify a ticker" },
];

// ── Position size options ──────────────────────────────────────
const POSITION_SIZE_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "new_position",     label: "New Position",     sub: "Opening fresh exposure" },
  { value: "add_to_existing",  label: "Add to Existing",  sub: "Scaling into a current holding" },
  { value: "full_position",    label: "Full Position",    sub: "Deploying full planned allocation" },
];

// ── Exit type options ──────────────────────────────────────────
const EXIT_TYPE_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "partial_exit",  label: "Partial Exit",   sub: "Trim 25–50% of position" },
  { value: "full_exit",     label: "Full Exit",      sub: "Close entire position" },
  { value: "risk_reduction",label: "Risk Reduction", sub: "Cut to stop-loss size" },
  { value: "profit_taking", label: "Profit Taking",  sub: "Lock in gains at target" },
];

// ── Hold concern options ───────────────────────────────────────
const HOLD_CONCERN_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "volatility",    label: "Volatility",     sub: "Uncomfortable with price swings" },
  { value: "drawdown",      label: "Drawdown",       sub: "Position is underwater" },
  { value: "profit_taking", label: "Profit Taking",  sub: "Considering locking in gains" },
  { value: "no_concern",    label: "No Concern",     sub: "Conviction hold, just validating" },
  { value: "unsure",        label: "Unsure",         sub: "Not sure if I should hold or act" },
];

const TIMEFRAME_OPTIONS: { value: SimulatorTimeframe; label: string; sub: string }[] = [
  { value: "today",            label: "Today",       sub: "Intraday / EOD" },
  { value: "this_week",        label: "This Week",   sub: "1–5 sessions" },
  { value: "one_three_months", label: "1–3 Months",  sub: "Tactical" },
  { value: "six_twelve_months",label: "6–12 Months", sub: "Strategic" },
];

const THESIS_OPTIONS: { value: ThesisType; label: string; icon: string; sub: string; description: string; conditions: string[] }[] = [
  {
    value: "momentum",
    label: "Momentum",
    icon: "⚡",
    sub: "Ride the trend",
    description: "Price and volume are accelerating in a clear direction. You are trading with the trend, not against it.",
    conditions: ["RSI above 55 and rising", "Price above 20-day and 50-day MA", "Volume confirming the move", "Regime not in contraction"],
  },
  {
    value: "breakout",
    label: "Breakout",
    icon: "🔓",
    sub: "Break above resistance",
    description: "Price is breaking through a key level — resistance, consolidation range, or all-time high — with conviction.",
    conditions: ["Price clearing a defined resistance zone", "Volume spike on the break", "No major macro headwind", "Volatility regime not extreme"],
  },
  {
    value: "mean_reversion",
    label: "Mean Reversion",
    icon: "↩",
    sub: "Snap back to average",
    description: "Price has stretched too far from its mean and is likely to revert. You are fading the extreme, not chasing it.",
    conditions: ["RSI below 30 or above 70 (extended)", "Price far from 20-day MA", "No structural breakdown in play", "Low macro stress"],
  },
  {
    value: "long_term",
    label: "Long-Term Hold",
    icon: "🏛",
    sub: "Multi-month conviction",
    description: "You are building or holding a position based on a 6–18 month thesis. Short-term noise is acceptable.",
    conditions: ["Strong fundamental or macro tailwind", "Price above 200-day MA", "Regime not in structural bear", "Drawdown tolerance defined"],
  },
  {
    value: "value",
    label: "Value",
    icon: "⚖",
    sub: "Buy below intrinsic worth",
    description: "The asset is trading below what you believe it is worth. You are buying the discount, not the momentum.",
    conditions: ["Valuation metrics below historical average", "Catalyst or re-rating event visible", "No deteriorating fundamentals", "Patience for 3–12 month horizon"],
  },
  {
    value: "ai_theme",
    label: "AI Theme",
    icon: "🤖",
    sub: "Structural AI cycle play",
    description: "You are positioned in the AI infrastructure or application cycle — semiconductors, data centers, software, or enablers.",
    conditions: ["AI capex cycle intact", "Earnings revisions positive", "No regulatory shock risk", "Concentration risk managed"],
  },
  {
    value: "crypto_cycle",
    label: "Crypto Cycle",
    icon: "₿",
    sub: "Crypto market cycle timing",
    description: "You are trading the crypto market cycle — accumulation, expansion, or distribution phase — based on on-chain and macro signals.",
    conditions: ["Bitcoin dominance trend", "Macro liquidity conditions", "Halving cycle position", "Risk-on / risk-off regime"],
  },
  {
    value: "sector_rotation",
    label: "Sector Rotation",
    icon: "⟳",
    sub: "Shift capital between sectors",
    description: "Capital is rotating out of one sector and into another as the macro cycle evolves. You are following the money.",
    conditions: ["Relative strength divergence between sectors", "Rate environment shifting", "Earnings cycle leadership changing", "Regime transition signal"],
  },
  {
    value: "other",
    label: "Other / Custom",
    icon: "◈",
    sub: "Describe your own thesis",
    description: "Your thesis does not fit a standard category. FAULTLINE will stress-test it against current macro conditions regardless.",
    conditions: ["Custom thesis evaluated on macro fit", "Regime compatibility checked", "Key risk factors identified", "Invalidation conditions defined"],
  },
];

const VERDICT_CONFIG: Record<VerdictType, { label: string; color: string; glow: string; borderColor: string }> = {
  HIGH_CONVICTION: { label: "HIGH CONVICTION", color: "#00FF88", glow: "rgba(0,255,136,0.25)", borderColor: "rgba(0,255,136,0.5)" },
  APPROVED:        { label: "APPROVED",         color: "#00E5FF", glow: "rgba(0,212,255,0.20)", borderColor: "rgba(0,212,255,0.45)" },
  CAUTION:         { label: "CAUTION",          color: "#FF9500", glow: "rgba(255,149,0,0.20)",  borderColor: "rgba(255,149,0,0.45)" },
  WAIT:            { label: "WAIT",             color: "#A78BFA", glow: "rgba(167,139,250,0.18)", borderColor: "rgba(167,139,250,0.40)" },
  DEFENSIVE:       { label: "DEFENSIVE",        color: "#FF2D55", glow: "rgba(255,45,85,0.22)",  borderColor: "rgba(255,45,85,0.45)" },
};

const GRADE_COLOR: Record<string, string> = {
  "A+": "#00FF88", "A": "#00E5FF", "A-": "#00E5FF",
  "B+": "#FF9500", "B": "#FF9500", "B-": "#FF6B35",
  "C":  "#FF2D55",
};

// ── Color helpers ─────────────────────────────────────────────
function favColor(score: number) {
  if (score >= 70) return "#00FF88";
  if (score >= 50) return "#00E5FF";
  if (score >= 35) return "#FF9500";
  return "#FF2D55";
}
function riskColor(level: string) {
  const m: Record<string, string> = { Low: "#00FF88", Medium: "#FF9500", High: "#FF2D55", Extreme: "#FF0040" };
  return m[level] ?? "#94A3B8";
}
function condColor(level: string) {
  const m: Record<string, string> = {
    Low: "#00FF88", Moderate: "#FF9500", Elevated: "#FF6B35", Critical: "#FF2D55",
    Broad: "#00FF88", Narrowing: "#FF9500", Deteriorating: "#FF2D55",
    Cleared: "#00FF88", Caution: "#FF9500", Defensive: "#FF2D55",
  };
  return m[level] ?? "#94A3B8";
}
function sevColor(sev: string) {
  const m: Record<string, string> = { low: "#00FF88", moderate: "#FF9500", elevated: "#FF6B35", critical: "#FF2D55" };
  return m[sev] ?? "#94A3B8";
}
function pressureColor(score: number) {
  if (score >= 65) return "#FF2D55";
  if (score >= 45) return "#FF9500";
  if (score >= 25) return "#00E5FF";
  return "#00FF88";
}
function returnColor(v: number) { return v > 0 ? "#00FF88" : v < 0 ? "#FF2D55" : "#94A3B8"; }
function returnSign(v: number) { return v > 0 ? `+${v}%` : `${v}%`; }

// ── Animated ring ─────────────────────────────────────────────
function ScoreRing({ score, color, size = 130, label }: { score: number; color: string; size?: number; label?: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 200); return () => clearTimeout(t); }, [score]);
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const dash = (anim / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth={9} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 8px ${color}80)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size >= 120 ? "30px" : "22px", color, lineHeight: 1, textShadow: `0 0 18px ${color}80` }}>{anim}</div>
        {label && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "2px" }}>{label}</div>}
      </div>
    </div>
  );
}

// ── Probability bar ───────────────────────────────────────────
function ProbBar({ value, color, label }: { value: number; color: string; label: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 400); return () => clearTimeout(t); }, [value]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.75)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color }}>{value}%</span>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.09)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${anim}%`, background: `linear-gradient(90deg, ${color}50, ${color})`, borderRadius: "3px", boxShadow: `0 0 8px ${color}50`, transition: "width 1.4s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ icon, title, color = "#00E5FF" }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>{title}</span>
      <div style={{ flex: 1, height: "1px", background: `${color}20` }} />
    </div>
  );
}

// ── Metric chip ───────────────────────────────────────────────
function MetricChip({ label, value }: { label: string; value: string }) {
  const c = condColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "8px 10px", background: `${c}08`, border: `1px solid ${c}22`, borderRadius: "4px", minWidth: "76px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "12px", color: c }}>{value}</div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────
function ListRow({ text, color, icon, sub }: { text: string; color: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
      <div style={{ color, flexShrink: 0, marginTop: "2px" }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#CBD5E1", lineHeight: 1.5 }}>{text}</div>
        {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginTop: "3px", fontStyle: "italic" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Collapsible panel ─────────────────────────────────────────
function CollapsiblePanel({
  open, onToggle, icon, title, color, count, children,
}: { open: boolean; onToggle: () => void; icon: React.ReactNode; title: string; color: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(12,15,22,0.98)", border: `1px solid ${color}18`, borderRadius: "6px", overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ color }}>{icon}</div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>{title}</span>
          {count !== undefined && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginLeft: "4px" }}>{count}</span>}
        </div>
        {open ? <ChevronUp size={13} color="#64748B" /> : <ChevronDown size={13} color="#64748B" />}
      </button>
      {open && <div style={{ padding: "0 16px 14px" }}>{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function SituationRoom() {
  useSEO(PAGE_SEO.situationRoom);
  const { output } = useEngine();

  // Register ASHA page context
  useRegisterAshaContext({
    page: "situation-room",
    pressureScore: output?.overall?.score !== undefined ? output.overall.score * 10 : undefined,
    regime: output?.regime?.label,
    narrative: output?.narrative?.summary,
    keyDrivers: output?.narrative?.keyRisks,
  });

  // URL param auto-execution (Smart Discovery dispatch)
  const searchStr = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const urlSymbol = urlParams.get("symbol")?.toUpperCase() ?? null;
  const urlType = urlParams.get("type") ?? "stock";
  const urlMove = (urlParams.get("move") ?? "buy_specific_asset") as MoveType;
  const urlAutorun = urlParams.get("autorun") === "1";

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(urlSymbol && urlAutorun ? 3 : 1);
  const [selectedMove, setSelectedMove] = useState<MoveType | null>(urlSymbol && urlAutorun ? urlMove : null);
  const [selectedExposure, setSelectedExposure] = useState<ExposureCategory | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<SimulatorTimeframe>("today");
  const [ticker, setTicker] = useState(urlSymbol ?? "");
  const [cryptoSymbol, setCryptoSymbol] = useState<string>("BTC");
  const [showResult, setShowResult] = useState(false);
  // Decision tree sub-inputs
  const [rotateFrom, setRotateFrom] = useState<string>("");
  const [rotateTo, setRotateTo] = useState<string>("");
  const [raiseCashReason, setRaiseCashReason] = useState<string>("");
  const [deployCashTarget, setDeployCashTarget] = useState<string>("");
  const [positionSize, setPositionSize] = useState<string>(urlAutorun ? "normal" : "");
  const [exitType, setExitType] = useState<string>(urlAutorun && urlMove === "sell_specific_asset" ? "full" : "");
  const [holdConcern, setHoldConcern] = useState<string>(urlAutorun && urlMove === "hold" ? "general review" : "");
  const [open, setOpen] = useState<Record<string, boolean>>({
    greenLights: true, threatBoard: true, actionBias: true, invalidation: false, watchNext: false,
    verdict: true, outcomeSimulator: false, entryQuality: false, positionSizing: false,
    historicalAnalogs: false, thesisStressTest: false,
    recMoves: true, recStocks: false, recCrypto: false, recAlts: false, recSectors: false, recPortfolio: false, recFaultline: true,
    hotSectorPicks: false,
  });
  const resultRef = useRef<HTMLDivElement>(null);
  const autorunFiredRef = useRef(false);

  const { setTicker: setGlobalTicker } = useTickerStore();

  const simulate = trpc.trade.simulate.useMutation({
    onSuccess: (data, variables) => {
      setShowResult(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      // Update global Ask context so user can ask follow-up questions about this symbol
      if (variables.ticker) {
        setGlobalTicker(variables.ticker, variables.ticker, "stock");
      }
    },
  });

  const isCryptoMove = false;
  // Security-first: ticker is required for ALL move types
  const isTickerMove = selectedMove !== null;

  // Validation: check all required fields for the selected move type are filled
  const isReadyToSimulate = (): boolean => {
    if (!selectedMove || !selectedTimeframe) return false;
    // Security-first: ticker is always required
    if (!ticker.trim()) return false;
    if (selectedMove === "rotate") return rotateFrom.trim().length > 0 && rotateTo.trim().length > 0;
    if (selectedMove === "raise_cash") return raiseCashReason.trim().length > 0;
    if (selectedMove === "deploy_cash") return deployCashTarget.trim().length > 0;
    if (selectedMove === "buy_specific_asset") return ticker.trim().length > 0 && positionSize.trim().length > 0;
    if (selectedMove === "sell_specific_asset") return ticker.trim().length > 0 && exitType.trim().length > 0;
    if (selectedMove === "hold") return holdConcern.trim().length > 0;
    if (selectedMove === "hedge") return selectedExposure !== null;
    return selectedExposure !== null;
  };

  const handleSimulate = () => {
    if (!selectedMove || !isReadyToSimulate()) return;
    trackSituationRoomUse(selectedMove, selectedTimeframe);
    let resolvedTicker: string | undefined;
    if (ticker.trim()) {
      resolvedTicker = ticker.trim().toUpperCase();
    } else if (isCryptoMove) {
      resolvedTicker = cryptoSymbol;
    }
    // GA4 key event: situation_room_used
    const assetType = isCryptoMove ? "crypto" : (resolvedTicker ? "stock" : "other");
    trackSituationRoomUsed({
      assetType,
      tickerOrSymbol: resolvedTicker ?? selectedMove,
      timeframe: selectedTimeframe,
    });
    simulate.mutate({
      moveType: selectedMove,
      timeframe: selectedTimeframe,
      ticker: resolvedTicker,
      exposureCategory: selectedExposure ?? undefined,
      rotateFrom: selectedMove === "rotate" ? rotateFrom : undefined,
      rotateTo: selectedMove === "rotate" ? rotateTo : undefined,
      raiseCashReason: selectedMove === "raise_cash" ? raiseCashReason : undefined,
      deployCashTarget: selectedMove === "deploy_cash" ? deployCashTarget : undefined,
      positionSizeType: selectedMove === "buy_specific_asset" ? positionSize : undefined,
      exitType: selectedMove === "sell_specific_asset" ? exitType : undefined,
      holdConcern: selectedMove === "hold" ? holdConcern : undefined,
    });
  };

  // Auto-fire when dispatched from Smart Discovery with autorun=1
  useEffect(() => {
    if (urlAutorun && urlSymbol && !autorunFiredRef.current && selectedMove) {
      autorunFiredRef.current = true;
      // Small delay to let React settle state
      const t = setTimeout(() => {
        simulate.mutate({
          moveType: urlMove,
          timeframe: "today",
          ticker: urlSymbol,
          positionSizeType: urlMove === "buy_specific_asset" ? "normal" : undefined,
          exitType: urlMove === "sell_specific_asset" ? "full" : undefined,
          holdConcern: urlMove === "hold" ? "general review" : undefined,
        });
      }, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAutorun, urlSymbol, urlMove, selectedMove]);

  const handleMoveSelect = (move: MoveType) => {
    setSelectedMove(move);
    setSelectedExposure(null);
    setShowResult(false);
    simulate.reset();
    setWizardStep(2);
  };

  const handleExposureSelect = (exp: ExposureCategory) => {
    setSelectedExposure(exp);
    setWizardStep(3);
  };

  const handleReset = () => {
    setShowResult(false);
    simulate.reset();
    setWizardStep(1);
    setSelectedMove(null);
    setSelectedExposure(null);
  };

  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const result = simulate.data;
  const isLoading = simulate.isPending;
  const pressureScore = Math.round(output.overall.score * 10);
  const pColor = pressureColor(pressureScore);

  // Derive market status from engine output (client-side, pre-simulation)
  const clientMarketStatus = pressureScore >= 60 ? "Defensive" : pressureScore >= 40 ? "Caution" : "Cleared";
  const msColor = condColor(clientMarketStatus);

  return (
    <div style={{ background: "#050608", minHeight: "100vh", paddingBottom: "80px" }}>
      {/* Ambient corner brackets */}
      <div style={{ position: "fixed", top: 12, left: 12, width: 18, height: 18, borderTop: `2px solid ${pColor}40`, borderLeft: `2px solid ${pColor}40`, pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "fixed", top: 12, right: 12, width: 18, height: 18, borderTop: `2px solid ${pColor}40`, borderRight: `2px solid ${pColor}40`, pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "fixed", bottom: 12, left: 12, width: 18, height: 18, borderBottom: `2px solid ${pColor}40`, borderLeft: `2px solid ${pColor}40`, pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "fixed", bottom: 12, right: 12, width: 18, height: 18, borderBottom: `2px solid ${pColor}40`, borderRight: `2px solid ${pColor}40`, pointerEvents: "none", zIndex: 5 }} />

      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "0 16px" }}>
        <PageHeader
          title="FAULTLINE Situation Room"
          subtitle="Stress-test your next move before risking capital"
          badge="COMMAND CENTER"
        />
        <SeismographNarrativeBanner context="situation" defaultExpanded={false} />

        {/* ══════════════════════════════════════════════════════
            SECTION A — MARKET STATUS
        ══════════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(135deg, ${msColor}06 0%, rgba(12,15,22,0.98) 55%)`,
          border: `1px solid ${msColor}25`,
          borderLeft: `3px solid ${msColor}`,
          borderRadius: "6px",
          padding: "18px",
          marginBottom: "10px",
          animation: "cinematic-reveal 0.55s cubic-bezier(0.23,1,0.32,1) both",
        }}>
          <SectionLabel icon={<Activity size={14} />} title="Market Status" color={msColor} />

          {/* Status badge + pressure index */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "16px", flexWrap: "wrap" }}>
            {/* Market Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: msColor, boxShadow: `0 0 10px ${msColor}`, animation: "blink-alert 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Status</span>
              <div style={{ padding: "3px 12px", background: `${msColor}14`, border: `1px solid ${msColor}40`, borderRadius: "3px" }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: msColor, letterSpacing: "0.08em" }}>{clientMarketStatus}</span>
              </div>
            </div>

            {/* Pressure index */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em" }}><FaultlineTerm id="pressure-index">Pressure</FaultlineTerm></span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "26px", color: pColor, textShadow: `0 0 16px ${pColor}70`, lineHeight: 1 }}>{pressureScore}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.45)" }}>/100</span>
            </div>

            {/* Regime */}
            <div style={{ padding: "3px 10px", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "3px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em" }}>{output.regime.label}</span>
            </div>
          </div>

          {/* Bull / Crash probabilities */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <TrendingUp size={13} color="#00FF88" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>Bull</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#00FF88" }}>{output.probability.bullProbability}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <TrendingDown size={13} color="#FF2D55" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)" }}>Drawdown</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#FF2D55" }}>{output.probability.crashProbability}%</span>
            </div>
          </div>

          {/* Score Explainers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <ScoreExplainer scoreKey="pressureIndex" value={pressureScore} trend={pressureScore > 60 ? 'rising' : pressureScore < 40 ? 'falling' : 'stable'} historicalPercentile={pressureScore} compact />
            <ScoreExplainer scoreKey="bullProbability" value={output.probability.bullProbability} trend="stable" compact />
            <ScoreExplainer scoreKey="crashRisk" value={output.probability.crashProbability} trend="stable" compact />
          </div>
          {/* Condition chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {output.domains.map(d => {
              const chipLevel = d.riskLevel === "low" ? "Low" : d.riskLevel === "moderate" ? "Moderate" : d.riskLevel === "elevated" ? "Elevated" : "Critical";
              const chipLabel = d.label.split(" ")[0];
              return <MetricChip key={d.id} label={chipLabel} value={chipLevel} />;
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION B — TRADE PREFLIGHT SIMULATOR
        ══════════════════════════════════════════════════════ */}
        <div style={{
          background: "rgba(12,15,22,0.98)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "6px",
          padding: "18px",
          marginBottom: "10px",
          animation: "cinematic-reveal 0.55s cubic-bezier(0.23,1,0.32,1) 60ms both",
        }}>
          <SectionLabel icon={<Crosshair size={14} />} title="Decision Engine" color="#00E5FF" />

          {/* ── Wizard step indicator ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "20px" }}>
            {([1, 2, 3] as const).map((step, i) => {
              const labels = ["What are you considering?", "What type of exposure?", "When & how?"];
              const done = wizardStep > step;
              const active = wizardStep === step;
              return (
                <>
                  <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "#00E5FF" : active ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.14)",
                      border: done ? "1px solid #00E5FF" : active ? "1px solid rgba(0,212,255,0.6)" : "1px solid rgba(255,255,255,0.10)",
                      transition: "all 0.2s ease",
                    }}>
                      {done
                        ? <span style={{ fontSize: "12px", color: "#050608" }}>✓</span>
                        : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: active ? "#00E5FF" : "#475569", fontWeight: 700 }}>{step}</span>}
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: active ? "#00E5FF" : done ? "rgba(0,229,255,0.65)" : "rgba(100,116,139,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", lineHeight: 1.3 }}>{labels[i]}</span>
                  </div>
                  {i < 2 && <div style={{ height: "1px", width: "20px", background: wizardStep > step + 1 ? "#00E5FF" : "rgba(255,255,255,0.14)", flexShrink: 0, marginBottom: "16px", transition: "background 0.2s ease" }} />}
                </>
              );
            })}
          </div>

          {/* ── STEP 1: What are you considering? ── */}
          {wizardStep === 1 && (
            <div style={{ animation: "cinematic-reveal 0.3s cubic-bezier(0.23,1,0.32,1) both" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Select your move</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "8px" }}>
                {MOVE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handleMoveSelect(opt.value)}
                    style={{
                      display: "flex", flexDirection: "column", gap: "4px", padding: "12px 14px",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: "6px", cursor: "pointer", textAlign: "left",
                      transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.14)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.50)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", color: "#00E5FF", width: "16px", flexShrink: 0 }}>{opt.glyph}</span>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0", letterSpacing: "0.04em" }}>{opt.label}</span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(100,116,139,0.6)", lineHeight: 1.4, paddingLeft: "24px" }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: What type of exposure? ── */}
          {wizardStep === 2 && selectedMove && (
            <div style={{ animation: "cinematic-reveal 0.3s cubic-bezier(0.23,1,0.32,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  <span style={{ color: "#00E5FF" }}>{MOVE_OPTIONS.find(m => m.value === selectedMove)?.label}</span> — select exposure type
                </div>
                <button onClick={() => { setWizardStep(1); setSelectedMove(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>← Back</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
                {(EXPOSURE_STEP2[selectedMove] ?? []).map(opt => (
                  <button key={opt.value} onClick={() => handleExposureSelect(opt.value)}
                    style={{
                      display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: "5px", cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.14)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.50)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
                  >
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#CBD5E1" }}>{opt.label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: When & how? ── */}
          {wizardStep === 3 && selectedMove && (
            <div style={{ animation: "cinematic-reveal 0.3s cubic-bezier(0.23,1,0.32,1) both" }}>
              {/* Summary bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", padding: "8px 12px", background: "rgba(0,229,255,0.10)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00E5FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>{MOVE_OPTIONS.find(m => m.value === selectedMove)?.label}</span>
                  {selectedExposure && <>
                    <span style={{ color: "rgba(100,116,139,0.4)", fontSize: "10px" }}>›</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{EXPOSURE_STEP2[selectedMove]?.find(e => e.value === selectedExposure)?.label}</span>
                  </>}
                </div>
                <button onClick={() => setWizardStep(2)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>← Edit</button>
              </div>

              {/* ── Security / Ticker input — required for ALL move types ── */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>
                  Security / Ticker <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span>
                  <span style={{ color: "rgba(100,116,139,0.4)", fontSize: "9px", marginLeft: "8px" }}>NVDA · PLTR · TSLA · SPY · BTC · ETH · TAO</span>
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={e => { setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "")); setShowResult(false); simulate.reset(); }}
                  placeholder="Enter a security — NVDA, PLTR, TSLA, SPY, BTC, ETH, TAO…"
                  maxLength={10}
                  style={{
                    width: "100%", padding: "10px 14px",
                    background: "rgba(0,229,255,0.10)",
                    border: ticker.trim() ? "1px solid rgba(0,212,255,0.40)" : "1px solid rgba(255,45,85,0.35)",
                    borderRadius: "4px", color: "#E2E8F0",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px",
                    letterSpacing: "0.12em", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.15s ease",
                  }}
                />
              </div>

              {/* ── ROTATE: From / To selectors ── */}
              {selectedMove === "rotate" && (
                <div style={{ marginBottom: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>Rotate From <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                    <select value={rotateFrom} onChange={e => setRotateFrom(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: rotateFrom ? "1px solid rgba(0,229,255,0.50)" : "1px solid rgba(255,45,85,0.35)", borderRadius: "4px", color: rotateFrom ? "#E2E8F0" : "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
                      <option value="">Select sector / asset…</option>
                      {ROTATE_FROM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>Rotate To <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                    <select value={rotateTo} onChange={e => setRotateTo(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: rotateTo ? "1px solid rgba(0,229,255,0.50)" : "1px solid rgba(255,45,85,0.35)", borderRadius: "4px", color: rotateTo ? "#E2E8F0" : "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
                      <option value="">Select sector / asset…</option>
                      {ROTATE_TO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* ── RAISE CASH: Why are you raising cash? ── */}
              {selectedMove === "raise_cash" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "8px" }}>Why are you raising cash? <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px" }}>
                    {RAISE_CASH_REASONS.map(opt => (
                      <button key={opt.value} onClick={() => setRaiseCashReason(opt.value)}
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: raiseCashReason === opt.value ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.025)", border: raiseCashReason === opt.value ? "1px solid rgba(0,229,255,0.65)" : "1px solid rgba(255,255,255,0.14)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: raiseCashReason === opt.value ? "#00E5FF" : "#CBD5E1" }}>{opt.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── DEPLOY CASH: Where are you deploying? ── */}
              {selectedMove === "deploy_cash" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "8px" }}>Where are you deploying? <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
                    {DEPLOY_CASH_TARGETS.map(opt => (
                      <button key={opt.value} onClick={() => setDeployCashTarget(opt.value)}
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: deployCashTarget === opt.value ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.025)", border: deployCashTarget === opt.value ? "1px solid rgba(0,229,255,0.65)" : "1px solid rgba(255,255,255,0.14)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: deployCashTarget === opt.value ? "#00E5FF" : "#CBD5E1" }}>{opt.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── BUY SPECIFIC ASSET: Position size ── */}
              {selectedMove === "buy_specific_asset" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "8px" }}>Position size / entry type <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px" }}>
                    {POSITION_SIZE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setPositionSize(opt.value)}
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: positionSize === opt.value ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.025)", border: positionSize === opt.value ? "1px solid rgba(0,229,255,0.65)" : "1px solid rgba(255,255,255,0.14)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: positionSize === opt.value ? "#00E5FF" : "#CBD5E1" }}>{opt.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SELL SPECIFIC ASSET: Exit type ── */}
              {selectedMove === "sell_specific_asset" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "8px" }}>Exit type <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px" }}>
                    {EXIT_TYPE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setExitType(opt.value)}
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: exitType === opt.value ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.025)", border: exitType === opt.value ? "1px solid rgba(0,229,255,0.65)" : "1px solid rgba(255,255,255,0.14)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: exitType === opt.value ? "#00E5FF" : "#CBD5E1" }}>{opt.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── HOLD: What's your concern? ── */}
              {selectedMove === "hold" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "8px" }}>What's your concern with holding? <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px" }}>
                    {HOLD_CONCERN_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setHoldConcern(opt.value)}
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: holdConcern === opt.value ? "rgba(0,229,255,0.20)" : "rgba(255,255,255,0.025)", border: holdConcern === opt.value ? "1px solid rgba(0,229,255,0.65)" : "1px solid rgba(255,255,255,0.14)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: holdConcern === opt.value ? "#00E5FF" : "#CBD5E1" }}>{opt.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeframe */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Timeframe</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                  {TIMEFRAME_OPTIONS.map(tf => {
                    const sel = selectedTimeframe === tf.value;
                    return (
                      <button key={tf.value} onClick={() => setSelectedTimeframe(tf.value)}
                        style={{ padding: "10px 8px", background: sel ? "rgba(0,212,255,0.10)" : "rgba(255,255,255,0.02)", border: sel ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", cursor: "pointer", textAlign: "center", transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)" }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: sel ? "#00E5FF" : "#94A3B8" }}>{tf.label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", marginTop: "2px" }}>{tf.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FAULTLINE interprets banner */}
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.10)", borderRadius: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={13} color="#00E5FF" style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(100,116,139,0.7)", lineHeight: 1.5 }}>FAULTLINE reads current market structure, macro regime, and volatility — then tells you what the market is signalling about your move, what to watch for, and what would invalidate the setup.</span>
              </div>

              {/* Run button */}
              {!isReadyToSimulate() && !isLoading && (
                <div style={{ marginBottom: "8px", padding: "8px 12px", background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.20)", borderRadius: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={12} color="#FF9500" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(255,149,0,0.75)", letterSpacing: "0.06em" }}>Complete all required fields above to run analysis</span>
                </div>
              )}
              <button onClick={handleSimulate} disabled={isLoading || !isReadyToSimulate()}
                style={{
                  width: "100%", padding: "14px",
                  background: isLoading ? "rgba(255,255,255,0.03)" : isReadyToSimulate() ? "linear-gradient(135deg, rgba(0,212,255,0.18) 0%, rgba(0,212,255,0.07) 100%)" : "rgba(255,255,255,0.02)",
                  border: isLoading ? "1px solid rgba(255,255,255,0.11)" : isReadyToSimulate() ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.11)",
                  borderRadius: "4px", cursor: (isLoading || !isReadyToSimulate()) ? "not-allowed" : "pointer",
                  opacity: (!isLoading && !isReadyToSimulate()) ? 0.45 : 1,
                  transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}>
                {isLoading ? (
                  <>
                    <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,229,255,0.45)", borderTopColor: "#00E5FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#00E5FF", letterSpacing: "0.15em" }}>FAULTLINE READING MARKET…</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} color={isReadyToSimulate() ? "#00E5FF" : "#64748B"} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: isReadyToSimulate() ? "#00E5FF" : "#64748B", letterSpacing: "0.15em" }}>RUN FAULTLINE ANALYSIS</span>
                  </>
                )}
              </button>

              {simulate.isError && (() => {
                const errMsg = simulate.error?.message ?? "";
                const isNotFound = errMsg.includes("NOT_FOUND") || errMsg.includes("not found");
                const isRateLimit = errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("too many");
                const isTimeout = errMsg.includes("timeout") || errMsg.includes("TIMEOUT");
                const isForbidden = errMsg.includes("FORBIDDEN") || errMsg.includes("membership");
                const displayMsg = isForbidden
                  ? "This feature requires a Core membership or higher"
                  : isNotFound
                  ? "Asset not supported — check the ticker symbol"
                  : isRateLimit
                  ? "Rate limit reached — please wait a moment and retry"
                  : isTimeout
                  ? "AI analysis timeout — please retry"
                  : "Analysis failed — please retry";
                return (
                  <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: "4px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF2D55" }}>{displayMsg}</span>
                    {errMsg && !isForbidden && (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(255,45,85,0.5)", marginTop: "4px" }}>
                        {errMsg.slice(0, 100)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* ══════════════════════════════════════════════════════
            SIMULATION RESULT (sections C–H + new panels)
        ══════════════════════════════════════════════════════ */}
        {showResult && result && (
          <div ref={resultRef} style={{ animation: "cinematic-reveal 0.65s cubic-bezier(0.23,1,0.32,1) both" }}>

            {/* ═══════════════════════════════════════════════════════
                SECURITY CONTEXT BAR
            ═══════════════════════════════════════════════════════ */}
            {result.ticker && (
              <div style={{ marginBottom: "16px" }}>
                <UniversalTickerHeader symbol={result.ticker} />
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 1 — MARKET VERDICT (Large institutional label)
            ═══════════════════════════════════════════════════════ */}
            {(() => {
              const vt = result.verdict.verdict as VerdictType;
              const vc = VERDICT_CONFIG[vt] ?? VERDICT_CONFIG.CAUTION;
              // Map internal verdict to Phase 4 institutional labels
              const institutionalLabel: Record<VerdictType, string> = {
                HIGH_CONVICTION: "BUY",
                APPROVED: "BUY",
                CAUTION: "HOLD",
                WAIT: "WAIT",
                DEFENSIVE: "REDUCE",
              };
              const institutionalSub: Record<VerdictType, string> = {
                HIGH_CONVICTION: "High Conviction — Begin Accumulating",
                APPROVED: "Conditions Favorable — Proceed with Sizing",
                CAUTION: "Mixed Signals — Monitor and Size Conservatively",
                WAIT: "Insufficient Confirmation — Wait for Setup",
                DEFENSIVE: "Elevated Risk — Reduce Exposure",
              };
              const label = institutionalLabel[vt] ?? "HOLD";
              const sub = institutionalSub[vt] ?? "";
              const oppScore = Math.round(result.moveFavorabilityScore);
              const riskScore = Math.round(result.adversePressureProbability);
              return (
                <div style={{
                  background: `linear-gradient(135deg, ${vc.glow} 0%, rgba(10,13,20,0.98) 55%)`,
                  border: `1px solid ${vc.borderColor}`,
                  borderRadius: "8px",
                  padding: "28px 28px 24px",
                  marginBottom: "12px",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Subtle corner accent */}
                  <div style={{ position: "absolute", top: 0, right: 0, width: "120px", height: "120px", background: `radial-gradient(circle at top right, ${vc.color}10 0%, transparent 70%)`, pointerEvents: "none" }} />

                  {/* Label row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "6px" }}>
                        MARKET VERDICT{result.ticker ? ` — ${result.ticker}` : ""}
                      </div>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "64px", lineHeight: 1, color: vc.color, letterSpacing: "-0.02em", textShadow: `0 0 40px ${vc.color}50` }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(148,163,184,0.8)", marginTop: "6px", letterSpacing: "0.02em" }}>
                        {sub}
                      </div>
                    </div>

                    {/* Score cluster */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "180px" }}>
                      {/* Confidence */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Confidence</span>
                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: vc.color }}>{result.verdict.confidence}%</span>
                        </div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${result.verdict.confidence}%`, background: vc.color, borderRadius: "2px", transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
                        </div>
                      </div>
                      {/* Opportunity Score */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Opportunity Score</span>
                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: favColor(oppScore) }}>{oppScore}</span>
                        </div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${oppScore}%`, background: favColor(oppScore), borderRadius: "2px", transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
                        </div>
                      </div>
                      {/* Risk Score */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Risk Score</span>
                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: riskColor(result.riskLevel) }}>{riskScore}</span>
                        </div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${riskScore}%`, background: riskColor(result.riskLevel), borderRadius: "2px", transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
                        </div>
                      </div>
                      {/* Expected Holding Period */}
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.11)" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Holding Period</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#00E5FF", fontWeight: 600 }}>{result.timeframeLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reset button */}
                  <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.11)", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "4px", cursor: "pointer", color: "#64748B", transition: "all 0.15s ease" }}>
                      <RefreshCw size={11} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.12em" }}>NEW SIMULATION</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════
                SECTION 2 — WHY
            ═══════════════════════════════════════════════════════ */}
            <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "20px 22px", marginBottom: "10px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "10px" }}>WHY</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#CBD5E1", lineHeight: 1.7 }}>{result.verdict.reason}</div>
              {result.marketInterpretation && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "14px", color: "#F0F4FF", marginBottom: "6px" }}>{result.marketInterpretation.headline}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.65 }}>{result.marketInterpretation.setupContext}</div>
                  {result.marketInterpretation.opportunityWindow && (
                    <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(0,229,255,0.10)", border: "1px solid rgba(0,229,255,0.20)", borderRadius: "4px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00E5FF", textTransform: "uppercase", letterSpacing: "0.12em" }}>OPPORTUNITY WINDOW: </span>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8" }}>{result.marketInterpretation.opportunityWindow}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════
                DECISION CONFIDENCE PANEL
            ═══════════════════════════════════════════════════════ */}
            {(() => {
              const vt = result.verdict.verdict as VerdictType;
              const institutionalLabel: Record<VerdictType, string> = {
                HIGH_CONVICTION: "BUY", APPROVED: "BUY", CAUTION: "HOLD", WAIT: "WAIT", DEFENSIVE: "REDUCE",
              };
              const confData: ConfidenceData = {
                confidenceScore: Math.round(result.verdict.confidence),
                probabilityRange: [
                  Math.max(0, Math.round(result.moveFavorabilityScore - 15)),
                  Math.min(100, Math.round(result.moveFavorabilityScore + 10)),
                ],
                supportingSignals: ((result.outcomeSimulator?.scenarios?.find((s: any) => s.label === "Bull Case") as any)?.keyDrivers ?? []).slice(0, 4),
                conflictingSignals: ((result.outcomeSimulator?.scenarios?.find((s: any) => s.label === "Bear Case") as any)?.keyRisks ?? []).slice(0, 4),
                dataFreshnessMinutes: 3,
                institutionalAgreement: Math.min(100, Math.round(result.moveFavorabilityScore * 0.85)),
                historicalSimilarity: 72,
                historicalWinRate: undefined,
                expectedVolatility: result.riskLevel === "High" ? "HIGH" : result.riskLevel === "Extreme" ? "EXTREME" : result.riskLevel === "Low" ? "LOW" : "MODERATE",
                rewardRisk: result.outcomeSimulator?.scenarios
                  ? (() => {
                      const bull = result.outcomeSimulator.scenarios.find((s: any) => s.label === "Bull Case");
                      const bear = result.outcomeSimulator.scenarios.find((s: any) => s.label === "Bear Case");
                      if (bull?.expectedReturn && bear?.expectedReturn) return Math.abs(bull.expectedReturn) / Math.max(0.1, Math.abs(bear.expectedReturn));
                      return 2.0;
                    })()
                  : 2.0,
                verdict: institutionalLabel[vt] as ConfidenceData["verdict"],
              };
              return (
                <div style={{ marginBottom: "10px" }}>
                  <DecisionConfidencePanel data={confData} defaultExpanded={false} />
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════
                SECTION 3+4 — BULL CASE / BEAR CASE (side by side)
            ═══════════════════════════════════════════════════════ */}
            {result.outcomeSimulator && (() => {
              const bull = result.outcomeSimulator.scenarios.find((s: any) => s.label === "Bull Case");
              const bear = result.outcomeSimulator.scenarios.find((s: any) => s.label === "Bear Case");
              const base = result.outcomeSimulator.scenarios.find((s: any) => s.label === "Base Case");
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  {/* Bull Case */}
                  <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "6px", padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <TrendingUp size={14} color="#00FF88" />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00FF88", textTransform: "uppercase", letterSpacing: "0.18em" }}>BULL CASE</span>
                    </div>
                    {bull && (
                      <>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "28px", color: "#00FF88", marginBottom: "4px" }}>{returnSign(bull.expectedReturn)}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(0,255,136,0.7)", marginBottom: "10px" }}>Probability: {bull.probability}%</div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px", marginBottom: "12px" }}>
                          <div style={{ height: "100%", width: `${bull.probability}%`, background: "#00FF88", borderRadius: "2px" }} />
                        </div>
                      </>
                    )}
                    {result.marketInterpretation?.watchFor && result.marketInterpretation.watchFor.length > 0 && (
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>CATALYSTS TO WATCH</div>
                        {result.marketInterpretation.watchFor.slice(0, 3).map((w: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00FF88", marginTop: "5px", flexShrink: 0 }} />
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {base && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>BASE CASE: </span>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#94A3B8" }}>{returnSign(base.expectedReturn)} ({base.probability}%)</span>
                      </div>
                    )}
                  </div>

                  {/* Bear Case */}
                  <div style={{ background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.18)", borderRadius: "6px", padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <TrendingDown size={14} color="#FF2D55" />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", textTransform: "uppercase", letterSpacing: "0.18em" }}>BEAR CASE</span>
                    </div>
                    {bear && (
                      <>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "28px", color: "#FF2D55", marginBottom: "4px" }}>{returnSign(bear.expectedReturn)}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(255,45,85,0.7)", marginBottom: "10px" }}>Probability: {bear.probability}%</div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px", marginBottom: "12px" }}>
                          <div style={{ height: "100%", width: `${bear.probability}%`, background: "#FF2D55", borderRadius: "2px" }} />
                        </div>
                      </>
                    )}
                    {result.marketInterpretation?.invalidationConditions && result.marketInterpretation.invalidationConditions.length > 0 && (
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>INVALIDATION</div>
                        {result.marketInterpretation.invalidationConditions.slice(0, 3).map((c: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#FF2D55", marginTop: "5px", flexShrink: 0 }} />
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.invalidationTriggers && result.invalidationTriggers.length > 0 && !result.marketInterpretation?.invalidationConditions?.length && (
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>INVALIDATION</div>
                        {result.invalidationTriggers.slice(0, 3).map((t: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#FF2D55", marginTop: "5px", flexShrink: 0 }} />
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{t}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════
                SECTION 5 — ACTION PLAN
            ═══════════════════════════════════════════════════════ */}
            <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "20px 22px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <Crosshair size={14} color="#00FF88" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00FF88", textTransform: "uppercase", letterSpacing: "0.18em" }}>ACTION PLAN</span>
              </div>
              {/* Primary action bias */}
              <div style={{ padding: "12px 16px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "5px", marginBottom: "12px" }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#00FF88", marginBottom: "4px" }}>{result.actionBias}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8" }}>{result.bestVersionOfMove}</div>
              </div>
              {/* What FAULTLINE Would Do */}
              {result.recommendedMoves?.whatFaultlineWouldDo && (
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>WHAT FAULTLINE WOULD DO</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {result.recommendedMoves.whatFaultlineWouldDo.actions.slice(0, 4).map((action: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", fontWeight: 700 }}>{i + 1}</span>
                        </div>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#CBD5E1", lineHeight: 1.55 }}>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Areas to avoid */}
              {result.avoidAreas && result.avoidAreas.length > 0 && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(255,45,85,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>AVOID</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {result.avoidAreas.map((a: string, i: number) => (
                      <span key={i} style={{ padding: "3px 8px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "3px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#FF6B8A" }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════
                SECTION 6 — KEY LEVELS (from top opportunities if ticker provided)
            ═══════════════════════════════════════════════════════ */}
            {result.ticker && result.recommendedMoves && (() => {
              const allOpps = [...(result.recommendedMoves.topStocks || []), ...(result.recommendedMoves.topCrypto || [])];
              const tickerOpp = allOpps.find((o: any) => o.ticker?.toUpperCase() === result.ticker?.toUpperCase());
              if (!tickerOpp) return null;
              return (
                <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: "6px", padding: "20px 22px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <Target size={14} color="#00E5FF" />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00E5FF", textTransform: "uppercase", letterSpacing: "0.18em" }}>KEY LEVELS — {result.ticker}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                    {[
                      { label: "Entry Zone", value: `$${tickerOpp.entryZoneLow?.toFixed(2)} – $${tickerOpp.entryZoneHigh?.toFixed(2)}`, color: "#00E5FF" },
                      { label: "Stop Loss", value: `$${tickerOpp.stopLoss?.toFixed(2)}`, color: "#FF2D55" },
                      { label: "Risk / Reward", value: `${tickerOpp.riskRewardRatio?.toFixed(1)}:1`, color: "#00FF88" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: "5px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "5px" }}>{label}</div>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[
                      { label: "Target 1", value: `$${tickerOpp.targetOne?.toFixed(2)}`, color: "#00FF88" },
                      { label: "Target 2", value: `$${tickerOpp.targetTwo?.toFixed(2)}`, color: "#00FF88" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: "10px 14px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════
                SECTION 7 — TIMEFRAME + POSITION SIZING
            ═══════════════════════════════════════════════════════ */}
            <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "20px 22px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <Activity size={14} color="#A78BFA" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.18em" }}>TIMEFRAME</span>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                {(["today", "this_week", "one_three_months", "six_twelve_months"] as const).map((tf) => {
                  const labels: Record<string, string> = { today: "Intraday", this_week: "Swing", one_three_months: "Position", six_twelve_months: "Long-Term" };
                  const isActive = result.timeframe === tf;
                  return (
                    <div key={tf} style={{ padding: "6px 14px", background: isActive ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.11)"}`, borderRadius: "4px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: isActive ? "#A78BFA" : "#64748B", fontWeight: isActive ? 700 : 400 }}>{labels[tf]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "14px" }}>
                Expected duration: <strong style={{ color: "#F0F4FF" }}>{result.timeframeLabel}</strong>
              </div>
              {/* Position sizing */}
              {result.positionSizing && (
                <div style={{ paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>POSITION SIZING</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "8px" }}>
                    {result.positionSizing.tiers.map((tier: any) => (
                      <div key={tier.label} style={{ padding: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: "4px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>{tier.label}</div>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF" }}>{tier.allocation}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.55 }}>{result.positionSizing.guidance}</div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════
                SECTION 8 — THREAT BOARD (condensed)
            ═══════════════════════════════════════════════════════ */}
            {result.marketCondition?.threatBoard && result.marketCondition.threatBoard.length > 0 && (
              <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(255,45,85,0.12)", borderRadius: "6px", padding: "18px 22px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Shield size={14} color="#FF2D55" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", textTransform: "uppercase", letterSpacing: "0.18em" }}>ACTIVE THREATS</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginLeft: "auto" }}>{result.marketCondition.threatBoard.filter((t: any) => t.severity === "critical" || t.severity === "elevated").length} elevated</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {result.marketCondition.threatBoard.slice(0, 4).map((threat: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: `${sevColor(threat.severity)}06`, border: `1px solid ${sevColor(threat.severity)}18`, borderRadius: "4px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: sevColor(threat.severity), flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#CBD5E1", flex: 1 }}>{threat.threat}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: sevColor(threat.severity), textTransform: "uppercase", letterSpacing: "0.1em" }}>{threat.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 9 — TOP OPPORTUNITIES (condensed)
            ═══════════════════════════════════════════════════════ */}
            {result.recommendedMoves && (result.recommendedMoves.topStocks?.length > 0 || result.recommendedMoves.topCrypto?.length > 0) && (
              <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(0,229,255,0.20)", borderRadius: "6px", padding: "18px 22px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Zap size={14} color="#00E5FF" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00E5FF", textTransform: "uppercase", letterSpacing: "0.18em" }}>TOP OPPORTUNITIES</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[...result.recommendedMoves.topStocks.slice(0, 3), ...result.recommendedMoves.topCrypto.slice(0, 2)].map((opp: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.10)", borderRadius: "5px" }}>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: "60px" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#00E5FF" }}>{opp.ticker}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B" }}>{opp.assetType?.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8" }}>{opp.rationale?.substring(0, 80)}{opp.rationale?.length > 80 ? "…" : ""}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: favColor(opp.favorabilityScore) }}>{opp.favorabilityScore}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B" }}>SCORE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 10 — HISTORICAL ANALOGS (condensed)
            ═══════════════════════════════════════════════════════ */}
            {result.historicalAnalogs && result.historicalAnalogs.length > 0 && (
              <div style={{ background: "rgba(10,13,20,0.95)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "6px", padding: "18px 22px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <History size={14} color="#A78BFA" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.18em" }}>HISTORICAL ANALOGS</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {result.historicalAnalogs.slice(0, 3).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.10)", borderRadius: "4px" }}>
                      <div style={{ minWidth: "40px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#A78BFA" }}>{a.similarity}%</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B" }}>MATCH</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#CBD5E1", marginBottom: "2px" }}>{a.label} <span style={{ color: "#64748B" }}>({a.period})</span></div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.4 }}>{a.outcome}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                COMPLIANCE DISCLAIMER
            ═══════════════════════════════════════════════════════ */}
            <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "4px", marginTop: "4px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", lineHeight: 1.6, textAlign: "center", letterSpacing: "0.04em" }}>
                FAULTLINE simulations are market-regime guidance, not personalized financial advice or guaranteed predictions.
                All readings are probability-weighted estimates derived from macroeconomic data and should not be the sole basis for any investment decision.
                Position sizing, scenario projections, and verdict outputs are model-generated estimates only.
              </div>
            </div>
          </div>
        )}

        {/* Pre-simulation disclaimer */}
        {!showResult && (
          <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "4px", marginTop: "4px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)", lineHeight: 1.6, textAlign: "center" }}>
              FAULTLINE simulations are market-regime guidance, not personalized financial advice or guaranteed predictions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
