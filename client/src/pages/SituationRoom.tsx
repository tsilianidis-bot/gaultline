/* ============================================================
   FAULTLINE — Situation Room v2
   Market command center. Stress-test your next move before
   risking capital. Now with 8 new intelligence panels.
   ============================================================ */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import PageHeader from "@/components/PageHeader";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trackSituationRoomUse, trackSituationRoomUsed } from "@/hooks/useAnalytics";
import {
  CheckCircle, XCircle, AlertTriangle, Target, Zap,
  TrendingUp, TrendingDown, Activity, Shield, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, Minus, Eye, Crosshair,
  DollarSign, History, FlaskConical, ArrowRight,
} from "lucide-react";

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
  APPROVED:        { label: "APPROVED",         color: "#00D4FF", glow: "rgba(0,212,255,0.20)", borderColor: "rgba(0,212,255,0.45)" },
  CAUTION:         { label: "CAUTION",          color: "#FF9500", glow: "rgba(255,149,0,0.20)",  borderColor: "rgba(255,149,0,0.45)" },
  WAIT:            { label: "WAIT",             color: "#A78BFA", glow: "rgba(167,139,250,0.18)", borderColor: "rgba(167,139,250,0.40)" },
  DEFENSIVE:       { label: "DEFENSIVE",        color: "#FF2D55", glow: "rgba(255,45,85,0.22)",  borderColor: "rgba(255,45,85,0.45)" },
};

const GRADE_COLOR: Record<string, string> = {
  "A+": "#00FF88", "A": "#00D4FF", "A-": "#00D4FF",
  "B+": "#FF9500", "B": "#FF9500", "B-": "#FF6B35",
  "C":  "#FF2D55",
};

// ── Color helpers ─────────────────────────────────────────────
function favColor(score: number) {
  if (score >= 70) return "#00FF88";
  if (score >= 50) return "#00D4FF";
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
  if (score >= 25) return "#00D4FF";
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
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
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
      <div style={{ height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${anim}%`, background: `linear-gradient(90deg, ${color}50, ${color})`, borderRadius: "3px", boxShadow: `0 0 8px ${color}50`, transition: "width 1.4s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ icon, title, color = "#00D4FF" }: { icon: React.ReactNode; title: string; color?: string }) {
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
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);
  const [selectedExposure, setSelectedExposure] = useState<ExposureCategory | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<SimulatorTimeframe>("today");
  const [ticker, setTicker] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState<string>("BTC");
  const [showResult, setShowResult] = useState(false);
  // Decision tree sub-inputs
  const [rotateFrom, setRotateFrom] = useState<string>("");
  const [rotateTo, setRotateTo] = useState<string>("");
  const [raiseCashReason, setRaiseCashReason] = useState<string>("");
  const [deployCashTarget, setDeployCashTarget] = useState<string>("");
  const [positionSize, setPositionSize] = useState<string>("");
  const [exitType, setExitType] = useState<string>("");
  const [holdConcern, setHoldConcern] = useState<string>("");
  const [open, setOpen] = useState<Record<string, boolean>>({
    greenLights: true, threatBoard: true, actionBias: true, invalidation: false, watchNext: false,
    verdict: true, outcomeSimulator: false, entryQuality: false, positionSizing: false,
    historicalAnalogs: false, thesisStressTest: false,
    recMoves: true, recStocks: false, recCrypto: false, recAlts: false, recSectors: false, recPortfolio: false, recFaultline: true,
    hotSectorPicks: false,
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const simulate = trpc.trade.simulate.useMutation({
    onSuccess: () => {
      setShowResult(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
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
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Pressure</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "26px", color: pColor, textShadow: `0 0 16px ${pColor}70`, lineHeight: 1 }}>{pressureScore}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.45)" }}>/100</span>
            </div>

            {/* Regime */}
            <div style={{ padding: "3px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "3px" }}>
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
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "6px",
          padding: "18px",
          marginBottom: "10px",
          animation: "cinematic-reveal 0.55s cubic-bezier(0.23,1,0.32,1) 60ms both",
        }}>
          <SectionLabel icon={<Crosshair size={14} />} title="Decision Engine" color="#00D4FF" />

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
                      background: done ? "#00D4FF" : active ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.04)",
                      border: done ? "1px solid #00D4FF" : active ? "1px solid rgba(0,212,255,0.6)" : "1px solid rgba(255,255,255,0.10)",
                      transition: "all 0.2s ease",
                    }}>
                      {done
                        ? <span style={{ fontSize: "12px", color: "#050608" }}>✓</span>
                        : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: active ? "#00D4FF" : "#475569", fontWeight: 700 }}>{step}</span>}
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: active ? "#00D4FF" : done ? "rgba(0,212,255,0.5)" : "rgba(100,116,139,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", lineHeight: 1.3 }}>{labels[i]}</span>
                  </div>
                  {i < 2 && <div style={{ height: "1px", width: "20px", background: wizardStep > step + 1 ? "#00D4FF" : "rgba(255,255,255,0.08)", flexShrink: 0, marginBottom: "16px", transition: "background 0.2s ease" }} />}
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
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "6px", cursor: "pointer", textAlign: "left",
                      transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.35)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", color: "#00D4FF", width: "16px", flexShrink: 0 }}>{opt.glyph}</span>
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
                  <span style={{ color: "#00D4FF" }}>{MOVE_OPTIONS.find(m => m.value === selectedMove)?.label}</span> — select exposure type
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
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "5px", cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.35)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", padding: "8px 12px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00D4FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>{MOVE_OPTIONS.find(m => m.value === selectedMove)?.label}</span>
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
                    background: "rgba(0,212,255,0.05)",
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
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: rotateFrom ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(255,45,85,0.35)", borderRadius: "4px", color: rotateFrom ? "#E2E8F0" : "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
                      <option value="">Select sector / asset…</option>
                      {ROTATE_FROM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>Rotate To <span style={{ color: "#FF2D55", fontSize: "9px" }}>* required</span></label>
                    <select value={rotateTo} onChange={e => setRotateTo(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: rotateTo ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(255,45,85,0.35)", borderRadius: "4px", color: rotateTo ? "#E2E8F0" : "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
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
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: raiseCashReason === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)", border: raiseCashReason === opt.value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: raiseCashReason === opt.value ? "#00D4FF" : "#CBD5E1" }}>{opt.label}</span>
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
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: deployCashTarget === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)", border: deployCashTarget === opt.value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: deployCashTarget === opt.value ? "#00D4FF" : "#CBD5E1" }}>{opt.label}</span>
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
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: positionSize === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)", border: positionSize === opt.value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: positionSize === opt.value ? "#00D4FF" : "#CBD5E1" }}>{opt.label}</span>
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
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: exitType === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)", border: exitType === opt.value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: exitType === opt.value ? "#00D4FF" : "#CBD5E1" }}>{opt.label}</span>
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
                        style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", background: holdConcern === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)", border: holdConcern === opt.value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: holdConcern === opt.value ? "#00D4FF" : "#CBD5E1" }}>{opt.label}</span>
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
                        style={{ padding: "10px 8px", background: sel ? "rgba(0,212,255,0.10)" : "rgba(255,255,255,0.02)", border: sel ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", cursor: "pointer", textAlign: "center", transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)" }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: sel ? "#00D4FF" : "#94A3B8" }}>{tf.label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", marginTop: "2px" }}>{tf.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FAULTLINE interprets banner */}
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.10)", borderRadius: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={13} color="#00D4FF" style={{ flexShrink: 0 }} />
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
                  border: isLoading ? "1px solid rgba(255,255,255,0.06)" : isReadyToSimulate() ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "4px", cursor: (isLoading || !isReadyToSimulate()) ? "not-allowed" : "pointer",
                  opacity: (!isLoading && !isReadyToSimulate()) ? 0.45 : 1,
                  transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}>
                {isLoading ? (
                  <>
                    <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#00D4FF", letterSpacing: "0.15em" }}>FAULTLINE READING MARKET…</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} color={isReadyToSimulate() ? "#00D4FF" : "#64748B"} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: isReadyToSimulate() ? "#00D4FF" : "#64748B", letterSpacing: "0.15em" }}>RUN FAULTLINE ANALYSIS</span>
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

            {/* Result header */}
            <div style={{
              background: `linear-gradient(135deg, ${favColor(result.moveFavorabilityScore)}07 0%, rgba(12,15,22,0.98) 60%)`,
              border: `1px solid ${favColor(result.moveFavorabilityScore)}28`,
              borderLeft: `3px solid ${favColor(result.moveFavorabilityScore)}`,
              borderRadius: "6px", padding: "14px 16px", marginBottom: "10px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px",
            }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "3px" }}>Preflight Result</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF" }}>
                  {result.moveLabel}
                  {result.ticker && <span style={{ color: "#00D4FF" }}> — {result.ticker}</span>}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.55)", fontWeight: 400, marginLeft: "10px" }}>{result.timeframeLabel}</span>
                </div>
              </div>
              <button onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "4px", cursor: "pointer", color: "#94A3B8" }}>
                <RefreshCw size={12} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}>NEW SIMULATION</span>
              </button>
            </div>

            {/* ═══ NEW: DECISION VERDICT BANNER ═══ */}
            {result.verdict && (() => {
              const vt = result.verdict.verdict as VerdictType;
              const vc = VERDICT_CONFIG[vt] ?? VERDICT_CONFIG.CAUTION;
              return (
                <div style={{
                  background: `linear-gradient(135deg, ${vc.color}08 0%, rgba(12,15,22,0.98) 60%)`,
                  border: `1px solid ${vc.borderColor}`,
                  borderLeft: `4px solid ${vc.color}`,
                  borderRadius: "6px", padding: "18px", marginBottom: "10px",
                  boxShadow: `0 0 32px ${vc.glow}`,
                  animation: "cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) both",
                }}>
                  <SectionLabel icon={<Zap size={14} />} title="Decision Verdict" color={vc.color} />
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "28px", color: vc.color, letterSpacing: "0.12em", textShadow: `0 0 24px ${vc.color}60`, lineHeight: 1 }}>{vc.label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.55)", marginTop: "4px" }}>Confidence: <span style={{ color: vc.color, fontWeight: 700 }}>{result.verdict.confidence}%</span></div>
                    </div>
                    <div style={{ flex: 1, minWidth: "180px" }}>
                      <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${result.verdict.confidence}%`, background: vc.color, borderRadius: "2px", boxShadow: `0 0 8px ${vc.color}60`, transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "12px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.65, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                    {result.verdict.reason}
                  </div>
                </div>
              );
            })()}

            {/* SECTION C — Move Favorability Score */}
            <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "20px", marginBottom: "10px" }}>
              <SectionLabel icon={<Target size={14} />} title="Move Favorability Score" color={favColor(result.moveFavorabilityScore)} />
              <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <ScoreRing score={result.moveFavorabilityScore} color={favColor(result.moveFavorabilityScore)} size={130} label="FAVORABILITY" />
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Move Score</div>
                </div>
                <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <ProbBar value={result.favorableSetupProbability} color="#00FF88" label="Favorable Setup" />
                  <ProbBar value={result.adversePressureProbability} color="#FF2D55" label="Adverse Pressure" />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ padding: "4px 10px", background: `${riskColor(result.riskLevel)}12`, border: `1px solid ${riskColor(result.riskLevel)}35`, borderRadius: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: riskColor(result.riskLevel), letterSpacing: "0.1em" }}>RISK: {result.riskLevel.toUpperCase()}</span>
                    </div>
                    <div style={{ padding: "4px 10px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "3px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#00D4FF", letterSpacing: "0.1em" }}>CONFIDENCE: {result.confidenceLevel.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ NEW: POSITION OUTCOME SIMULATOR ═══ */}
            {result.outcomeSimulator && (
              <CollapsiblePanel open={open.outcomeSimulator} onToggle={() => toggle("outcomeSimulator")} icon={<BarChart2 size={14} />} title="Position Outcome Simulator" color="#00D4FF">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                  {result.outcomeSimulator.scenarios.map((s: any) => {
                    const scenColor = s.label === "Bull Case" ? "#00FF88" : s.label === "Bear Case" ? "#FF2D55" : "#94A3B8";
                    return (
                      <div key={s.label} style={{ background: `${scenColor}06`, border: `1px solid ${scenColor}22`, borderRadius: "6px", padding: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                          {s.label === "Bull Case" ? <TrendingUp size={12} color={scenColor} /> : s.label === "Bear Case" ? <TrendingDown size={12} color={scenColor} /> : <Minus size={12} color={scenColor} />}
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</span>
                        </div>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: returnColor(s.expectedReturn), textShadow: `0 0 12px ${returnColor(s.expectedReturn)}50` }}>
                          {returnSign(s.expectedReturn)}
                        </div>
                        <div style={{ marginTop: "8px", height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${s.probability}%`, background: scenColor, borderRadius: "2px" }} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", marginTop: "5px" }}>{s.probability}% probability</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px" }}>
                  <ArrowRight size={13} color="#64748B" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Probability-Weighted Outcome</span>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: returnColor(result.outcomeSimulator.weightedOutcome), marginLeft: "auto" }}>
                    {returnSign(result.outcomeSimulator.weightedOutcome)}
                  </span>
                </div>
              </CollapsiblePanel>
            )}
            <div style={{ marginBottom: "10px" }} />

            {/* ═══ NEW: ENTRY QUALITY GRADE ═══ */}
            {result.entryQuality && (
              <CollapsiblePanel open={open.entryQuality} onToggle={() => toggle("entryQuality")} icon={<Target size={14} />} title="Entry Quality Grade" color={GRADE_COLOR[result.entryQuality.overallGrade] ?? "#94A3B8"}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
                  <div style={{
                    width: "60px", height: "60px", borderRadius: "8px", flexShrink: 0,
                    background: `${GRADE_COLOR[result.entryQuality.overallGrade] ?? "#94A3B8"}12`,
                    border: `2px solid ${GRADE_COLOR[result.entryQuality.overallGrade] ?? "#94A3B8"}50`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "26px", color: GRADE_COLOR[result.entryQuality.overallGrade] ?? "#94A3B8" }}>
                      {result.entryQuality.overallGrade}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Overall Entry Grade</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", marginTop: "3px" }}>Based on {result.entryQuality.categories.length} regime factors</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                  {result.entryQuality.categories.map((cat: any) => {
                    const gc = GRADE_COLOR[cat.grade] ?? "#94A3B8";
                    return (
                      <div key={cat.category} style={{ background: `${gc}06`, border: `1px solid ${gc}20`, borderRadius: "4px", padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{cat.category}</span>
                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: gc }}>{cat.grade}</span>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(100,116,139,0.65)", lineHeight: 1.5 }}>{cat.note}</div>
                      </div>
                    );
                  })}
                </div>
              </CollapsiblePanel>
            )}
            <div style={{ marginBottom: "10px" }} />

            {/* SECTION D — Action Bias */}
            <CollapsiblePanel open={open.actionBias} onToggle={() => toggle("actionBias")} icon={<BarChart2 size={14} />} title="Action Bias" color="#00D4FF">
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#CBD5E1", lineHeight: 1.65, marginBottom: "14px" }}>{result.actionBias}</div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>Best Version of This Move</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>{result.bestVersionOfMove}</div>
              </div>
            </CollapsiblePanel>
            <div style={{ marginBottom: "10px" }} />

            {/* ═══ NEW: POSITION SIZING ═══ */}
            {result.positionSizing && (
              <CollapsiblePanel open={open.positionSizing} onToggle={() => toggle("positionSizing")} icon={<DollarSign size={14} />} title="Position Sizing Guidance" color="#00FF88">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                  {result.positionSizing.tiers.map((tier: any) => {
                    const tierColor = tier.label === "Conservative" ? "#94A3B8" : tier.label === "Standard" ? "#00D4FF" : "#A78BFA";
                    return (
                      <div key={tier.label} style={{ background: `${tierColor}06`, border: `1px solid ${tierColor}22`, borderRadius: "6px", padding: "14px" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>{tier.label}</div>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "28px", color: tierColor, lineHeight: 1 }}>{tier.allocation}%</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(100,116,139,0.55)", marginTop: "6px", lineHeight: 1.5 }}>{tier.rationale}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "4px" }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6 }}>{result.positionSizing.guidance}</div>
                </div>
              </CollapsiblePanel>
            )}
            <div style={{ marginBottom: "10px" }} />

            {/* FAULTLINE Analysis */}
            <div style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.04) 0%, rgba(12,15,22,0.98) 100%)", border: "1px solid rgba(0,212,255,0.14)", borderRadius: "6px", padding: "16px", marginBottom: "10px" }}>
              <SectionLabel icon={<Zap size={14} />} title="FAULTLINE Analysis" color="#00D4FF" />
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.7 }}>{result.explanation}</div>
              <div style={{ marginTop: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.35)", textAlign: "right" }}>
                Generated {new Date(result.generatedAt).toLocaleString()} · FAULTLINE Intelligence Engine
              </div>
            </div>

            {/* SECTION E + F — Green Lights + Threat Board (side-by-side on wider screens) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {/* Green Lights */}
              <CollapsiblePanel open={open.greenLights} onToggle={() => toggle("greenLights")} icon={<CheckCircle size={13} />} title="Green Lights" color="#00FF88" count={result.greenLights.length}>
                {result.greenLights.length === 0
                  ? <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)", padding: "4px 0" }}>No green lights in current regime</div>
                  : result.greenLights.map((item: string, i: number) => <ListRow key={i} text={item} color="#00FF88" icon={<CheckCircle size={12} />} />)
                }
              </CollapsiblePanel>

              {/* Threat Board */}
              <CollapsiblePanel open={open.threatBoard} onToggle={() => toggle("threatBoard")} icon={<Shield size={13} />} title="Threat Board" color="#FF2D55" count={result.redFlags.length}>
                {result.redFlags.length === 0
                  ? <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)", padding: "4px 0" }}>No active threats detected</div>
                  : result.redFlags.map((item: string, i: number) => <ListRow key={i} text={item} color="#FF2D55" icon={<XCircle size={12} />} />)
                }
              </CollapsiblePanel>
            </div>

            {/* Threat Board — hidden pressure points from backend */}
            {result.marketCondition?.threatBoard && result.marketCondition.threatBoard.filter((t: any) => t.severity !== "low").length > 0 && (
              <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,107,53,0.15)", borderRadius: "6px", padding: "14px", marginBottom: "10px" }}>
                <SectionLabel icon={<Eye size={14} />} title="Hidden Pressure Points" color="#FF6B35" />
                {result.marketCondition.threatBoard
                  .filter((t: any) => t.severity !== "low")
                  .slice(0, 5)
                  .map((item: any, i: number) => (
                    <ListRow key={i} text={item.threat} color={sevColor(item.severity)} icon={<AlertTriangle size={12} />} sub={item.hiddenPressure} />
                  ))}
              </div>
            )}

            {/* Areas to Avoid */}
            <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,149,0,0.14)", borderRadius: "6px", padding: "14px", marginBottom: "10px" }}>
              <SectionLabel icon={<AlertTriangle size={14} />} title="Areas to Avoid" color="#FF9500" />
              {result.avoidAreas.map((item: string, i: number) => <ListRow key={i} text={item} color="#FF9500" icon={<AlertTriangle size={12} />} />)}
            </div>

            {/* ═══ NEW: HISTORICAL ANALOGS ═══ */}
            {result.historicalAnalogs && result.historicalAnalogs.length > 0 && (
              <CollapsiblePanel open={open.historicalAnalogs} onToggle={() => toggle("historicalAnalogs")} icon={<History size={14} />} title="Historical Analog Engine" color="#A78BFA">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                  {result.historicalAnalogs.map((a: any, i: number) => (
                    <div key={i} style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: "6px", padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0", lineHeight: 1.2 }}>{a.label}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginTop: "2px" }}>{a.period}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", textTransform: "uppercase" }}>Similarity</div>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#A78BFA" }}>{a.similarity}%</div>
                        </div>
                      </div>
                      <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden", marginBottom: "8px" }}>
                        <div style={{ height: "100%", width: `${a.similarity}%`, background: "#A78BFA", borderRadius: "1px" }} />
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.55 }}>{a.outcome}</div>
                    </div>
                  ))}
                </div>
              </CollapsiblePanel>
            )}
            <div style={{ marginBottom: "10px" }} />

            {/* ═══ RECOMMENDED MOVES ═══ */}
            {result.recommendedMoves && (
              <div style={{ marginBottom: "10px" }}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "14px 16px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "6px" }}>
                  <TrendingUp size={16} color="#00FF88" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00FF88", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>RECOMMENDED MOVES</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", marginTop: "2px" }}>FAULTLINE's top opportunities and portfolio actions based on current regime</div>
                  </div>
                </div>

                {/* What FAULTLINE Would Do */}
                <CollapsiblePanel open={open.recFaultline} onToggle={() => toggle("recFaultline")} icon={<Crosshair size={14} />} title="What FAULTLINE Would Do" color="#00FF88">
                  <div style={{ padding: "4px 0" }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#00FF88", marginBottom: "8px", lineHeight: 1.3 }}>{result.recommendedMoves.whatFaultlineWouldDo.headline}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "12px" }}>{result.recommendedMoves.whatFaultlineWouldDo.rationale}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {result.recommendedMoves.whatFaultlineWouldDo.actions.map((action: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", fontWeight: 700 }}>{i + 1}</span>
                          </div>
                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#CBD5E1", lineHeight: 1.5 }}>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsiblePanel>
                <div style={{ marginBottom: "6px" }} />

                {/* Top Stock Opportunities */}
                {result.recommendedMoves.topStocks.length > 0 && (
                  <>
                    <CollapsiblePanel open={open.recStocks} onToggle={() => toggle("recStocks")} icon={<BarChart2 size={14} />} title="Top Stock Opportunities" color="#00D4FF" count={result.recommendedMoves.topStocks.length}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                        {result.recommendedMoves.topStocks.map((opp: any, i: number) => (
                          <div key={i} style={{ padding: "12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "5px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#00D4FF" }}>{opp.ticker}</span>
                                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B" }}>{opp.name}</span>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", padding: "2px 5px", background: "rgba(100,116,139,0.1)", borderRadius: "3px" }}>{opp.sector}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: opp.direction === "LONG" ? "#00FF88" : "#FF2D55", padding: "2px 6px", background: opp.direction === "LONG" ? "rgba(0,255,136,0.1)" : "rgba(255,45,85,0.1)", borderRadius: "3px", border: `1px solid ${opp.direction === "LONG" ? "rgba(0,255,136,0.25)" : "rgba(255,45,85,0.25)"}` }}>{opp.direction}</span>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>${opp.currentPrice.toFixed(2)}</span>
                              </div>
                            </div>
                            {/* Trade parameters */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "6px", marginBottom: "8px" }}>
                              <div style={{ padding: "6px 8px", background: "rgba(0,255,136,0.06)", borderRadius: "4px", border: "1px solid rgba(0,255,136,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Entry Zone</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00FF88" }}>${opp.entryZoneLow.toFixed(2)}–${opp.entryZoneHigh.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,45,85,0.06)", borderRadius: "4px", border: "1px solid rgba(255,45,85,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Stop Loss</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF2D55" }}>${opp.stopLoss.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(0,212,255,0.06)", borderRadius: "4px", border: "1px solid rgba(0,212,255,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Target 1</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF" }}>${opp.targetOne.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(0,212,255,0.04)", borderRadius: "4px", border: "1px solid rgba(0,212,255,0.08)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Target 2</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF" }}>${opp.targetTwo.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(167,139,250,0.06)", borderRadius: "4px", border: "1px solid rgba(167,139,250,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>R/R Ratio</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#A78BFA" }}>{opp.riskRewardRatio.toFixed(1)}:1</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,149,0,0.06)", borderRadius: "4px", border: "1px solid rgba(255,149,0,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Score</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF9500" }}>{opp.favorabilityScore}/100</div>
                              </div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.55 }}>{opp.rationale}</div>
                          </div>
                        ))}
                      </div>
                    </CollapsiblePanel>
                    <div style={{ marginBottom: "6px" }} />
                  </>
                )}

                {/* Top Crypto Opportunities */}
                {result.recommendedMoves.topCrypto.length > 0 && (
                  <>
                    <CollapsiblePanel open={open.recCrypto} onToggle={() => toggle("recCrypto")} icon={<Activity size={14} />} title="Top Crypto Opportunities" color="#FF9500" count={result.recommendedMoves.topCrypto.length}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                        {result.recommendedMoves.topCrypto.map((opp: any, i: number) => (
                          <div key={i} style={{ padding: "12px", background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.12)", borderRadius: "5px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#FF9500" }}>{opp.ticker}</span>
                                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B" }}>{opp.name}</span>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", padding: "2px 5px", background: "rgba(100,116,139,0.1)", borderRadius: "3px" }}>{opp.sector}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: opp.direction === "LONG" ? "#00FF88" : "#FF2D55", padding: "2px 6px", background: opp.direction === "LONG" ? "rgba(0,255,136,0.1)" : "rgba(255,45,85,0.1)", borderRadius: "3px", border: `1px solid ${opp.direction === "LONG" ? "rgba(0,255,136,0.25)" : "rgba(255,45,85,0.25)"}` }}>{opp.direction}</span>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>${opp.currentPrice.toFixed(2)}</span>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "6px", marginBottom: "8px" }}>
                              <div style={{ padding: "6px 8px", background: "rgba(0,255,136,0.06)", borderRadius: "4px", border: "1px solid rgba(0,255,136,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Entry Zone</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00FF88" }}>${opp.entryZoneLow.toFixed(2)}–${opp.entryZoneHigh.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,45,85,0.06)", borderRadius: "4px", border: "1px solid rgba(255,45,85,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Stop Loss</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF2D55" }}>${opp.stopLoss.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,149,0,0.06)", borderRadius: "4px", border: "1px solid rgba(255,149,0,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Target 1</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF9500" }}>${opp.targetOne.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,149,0,0.04)", borderRadius: "4px", border: "1px solid rgba(255,149,0,0.08)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Target 2</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF9500" }}>${opp.targetTwo.toFixed(2)}</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(167,139,250,0.06)", borderRadius: "4px", border: "1px solid rgba(167,139,250,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>R/R Ratio</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#A78BFA" }}>{opp.riskRewardRatio.toFixed(1)}:1</div>
                              </div>
                              <div style={{ padding: "6px 8px", background: "rgba(255,149,0,0.06)", borderRadius: "4px", border: "1px solid rgba(255,149,0,0.12)" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", marginBottom: "2px" }}>Score</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF9500" }}>{opp.favorabilityScore}/100</div>
                              </div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.55 }}>{opp.rationale}</div>
                          </div>
                        ))}
                      </div>
                    </CollapsiblePanel>
                    <div style={{ marginBottom: "6px" }} />
                  </>
                )}

                {/* Better Alternatives (only when user's move has low favorability) */}
                {result.recommendedMoves.betterAlternatives.length > 0 && (
                  <>
                    <CollapsiblePanel open={open.recAlts} onToggle={() => toggle("recAlts")} icon={<ArrowRight size={14} />} title="Better Alternatives" color="#A78BFA" count={result.recommendedMoves.betterAlternatives.length}>
                      <div style={{ padding: "4px 0 8px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", marginBottom: "8px" }}>Your selected move has low favorability. FAULTLINE identified these higher-probability setups in the current regime:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {result.recommendedMoves.betterAlternatives.map((opp: any, i: number) => (
                          <div key={i} style={{ padding: "10px 12px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#A78BFA" }}>{opp.ticker}</span>
                                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B" }}>{opp.name}</span>
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{opp.rationale}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>${opp.currentPrice.toFixed(2)}</div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#A78BFA" }}>Score: {opp.favorabilityScore}/100</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsiblePanel>
                    <div style={{ marginBottom: "6px" }} />
                  </>
                )}

                {/* Sector Rotation Intelligence */}
                <CollapsiblePanel open={open.recSectors} onToggle={() => toggle("recSectors")} icon={<RefreshCw size={14} />} title="Sector Rotation Intelligence" color="#00D4FF">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "4px" }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00FF88", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Increase Exposure</div>
                      {result.recommendedMoves.sectorRotation.increase.map((s: any, i: number) => (
                        <div key={i} style={{ padding: "8px 10px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "4px", marginBottom: "5px" }}>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00FF88", marginBottom: "3px" }}>{s.sector}</div>
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#64748B", lineHeight: 1.4 }}>{s.reason}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Reduce Exposure</div>
                      {result.recommendedMoves.sectorRotation.reduce.map((s: any, i: number) => (
                        <div key={i} style={{ padding: "8px 10px", background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.12)", borderRadius: "4px", marginBottom: "5px" }}>
                          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF2D55", marginBottom: "3px" }}>{s.sector}</div>
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#64748B", lineHeight: 1.4 }}>{s.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Sector scores bar chart */}
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>All Sectors — Regime Favorability</div>
                    {result.recommendedMoves.sectorRotation.favorabilityScores.map((s: any, i: number) => {
                      const c = s.score >= 70 ? "#00FF88" : s.score >= 50 ? "#FF9500" : "#FF2D55";
                      return (
                        <div key={i} style={{ marginBottom: "5px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8" }}>{s.sector}</span>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "12px", color: c }}>{s.score}</span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${s.score}%`, background: c, borderRadius: "2px", boxShadow: `0 0 6px ${c}50`, transition: "width 1s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsiblePanel>
                <div style={{ marginBottom: "6px" }} />

                {/* Hot Sector Picks */}
                {result.hotSectorPicks && result.hotSectorPicks.length > 0 && (
                  <>
                    <CollapsiblePanel open={open.hotSectorPicks} onToggle={() => toggle("hotSectorPicks")} icon={<Zap size={14} />} title="Hot Sector Picks" color="#00FF88" count={result.hotSectorPicks.length}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "4px" }}>
                        {result.hotSectorPicks.map((sector: any, si: number) => {
                          const sColor = sector.sectorScore >= 70 ? "#00FF88" : sector.sectorScore >= 50 ? "#FF9500" : "#FF2D55";
                          return (
                            <div key={si} style={{ border: `1px solid ${sColor}20`, borderRadius: "6px", overflow: "hidden" }}>
                              {/* Sector header */}
                              <div style={{ padding: "10px 14px", background: `${sColor}08`, borderBottom: `1px solid ${sColor}15`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: sColor, boxShadow: `0 0 8px ${sColor}80` }} />
                                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: sColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sector.sector}</span>
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: sColor, padding: "2px 6px", background: `${sColor}12`, borderRadius: "3px", border: `1px solid ${sColor}25` }}>{sector.sectorLabel}</span>
                                </div>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: sColor }}>{sector.sectorScore}<span style={{ fontSize: "10px", color: "#64748B", fontWeight: 400 }}>/100</span></span>
                              </div>
                              {/* Reason */}
                              <div style={{ padding: "8px 14px 4px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.5, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{sector.reason}</div>
                              {/* Tickers */}
                              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                {sector.tickers.map((t: any, ti: number) => {
                                  const actionColor = t.action === "LONG" ? "#00FF88" : t.action === "WATCH" ? "#FF9500" : "#FF2D55";
                                  const rrColor = t.riskRewardRatio >= 3 ? "#00FF88" : t.riskRewardRatio >= 2 ? "#FF9500" : "#FF2D55";

                                  // Client-side INVALID TEMPLATE DATA DETECTED guard.
                                  // Detects the exact placeholder values that were produced by the
                                  // basePrice=100 fallback bug: stop=$88, T1=$125, T2=$140.
                                  const isTemplateData =
                                    Math.abs(t.currentPrice - 100) < 0.01 &&
                                    (Math.abs(t.stopLoss - 88) < 0.01 ||
                                     Math.abs(t.targetOne - 125) < 0.01 ||
                                     Math.abs(t.targetTwo - 140) < 0.01);

                                  // Dynamic price formatting: 4 decimals for sub-$1 (e.g. GRT $0.1923),
                                  // 3 for sub-$10 (e.g. FET $1.423), 2 for everything else.
                                  const fmtPrice = (p: number) =>
                                    p < 1 ? p.toFixed(4) : p < 10 ? p.toFixed(3) : p.toFixed(2);

                                  // Format the live price timestamp for display (HH:MM)
                                  const priceTime = t.priceTimestamp
                                    ? new Date(t.priceTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : null;

                                  if (isTemplateData) {
                                    return (
                                      <div key={ti} style={{ padding: "10px 12px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: "5px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{t.ticker}</span>
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", padding: "2px 8px", background: "rgba(255,45,85,0.12)", borderRadius: "3px", border: "1px solid rgba(255,45,85,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>INVALID TEMPLATE DATA DETECTED</span>
                                        </div>
                                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#FF2D55", lineHeight: 1.5 }}>
                                          This card received placeholder values (price=$100, stop=$88, T1=$125, T2=$140). Live market data could not be fetched. The card has been blocked from rendering to prevent display of fake trade levels.
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={ti} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "5px" }}>
                                      {/* Ticker row */}
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{t.ticker}</span>
                                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B" }}>{t.name}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: actionColor, padding: "2px 6px", background: `${actionColor}12`, borderRadius: "3px", border: `1px solid ${actionColor}25`, textTransform: "uppercase" }}>{t.action}</span>
                                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#CBD5E1" }}>${fmtPrice(t.currentPrice)}</span>
                                        </div>
                                      </div>
                                      {/* Trade parameters grid */}
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginBottom: "6px" }}>
                                        {[
                                          { label: "ENTRY LOW",  val: `$${fmtPrice(t.entryZoneLow)}`,  color: "#00D4FF" },
                                          { label: "ENTRY HIGH", val: `$${fmtPrice(t.entryZoneHigh)}`, color: "#00D4FF" },
                                          { label: "STOP",       val: `$${fmtPrice(t.stopLoss)}`,       color: "#FF2D55" },
                                          { label: "T1",         val: `$${fmtPrice(t.targetOne)}`,      color: "#00FF88" },
                                          { label: "T2",         val: `$${fmtPrice(t.targetTwo)}`,      color: "#00FF88" },
                                        ].map((p, pi) => (
                                          <div key={pi} style={{ padding: "5px 6px", background: `${p.color}06`, border: `1px solid ${p.color}15`, borderRadius: "3px", textAlign: "center" }}>
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.7)", marginBottom: "2px", letterSpacing: "0.08em" }}>{p.label}</div>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "12px", color: p.color }}>{p.val}</div>
                                          </div>
                                        ))}
                                      </div>
                                      {/* R:R + Momentum + Score row */}
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>R:R</span>
                                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: rrColor }}>{t.riskRewardRatio.toFixed(1)}x</span>
                                        <span style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.08)" }} />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>MOM</span>
                                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#FF9500" }}>{t.momentumScore}</span>
                                        <span style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.08)" }} />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>SCORE</span>
                                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF" }}>{t.compositeScore}</span>
                                      </div>
                                      {/* Rationale */}
                                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.5, marginBottom: t.dataSource ? "6px" : 0 }}>{t.rationale}</div>
                                      {/* Live data provenance footer */}
                                      {t.dataSource && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "5px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 5px #00FF8880", flexShrink: 0 }} />
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#334155", letterSpacing: "0.06em" }}>
                                            LIVE · {t.dataSource}{priceTime ? ` · ${priceTime}` : ""}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsiblePanel>
                    <div style={{ marginBottom: "6px" }} />
                  </>
                )}

                {/* Portfolio Actions */}
                <CollapsiblePanel open={open.recPortfolio} onToggle={() => toggle("recPortfolio")} icon={<DollarSign size={14} />} title="Portfolio Action Recommendations" color="#FF9500" count={result.recommendedMoves.portfolioActions.length}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "4px" }}>
                    {result.recommendedMoves.portfolioActions.map((pa: any, i: number) => {
                      const urgencyColor = pa.urgency === "high" ? "#FF2D55" : pa.urgency === "medium" ? "#FF9500" : "#00FF88";
                      return (
                        <div key={i} style={{ padding: "10px 12px", background: `${urgencyColor}06`, border: `1px solid ${urgencyColor}18`, borderRadius: "5px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: urgencyColor, boxShadow: `0 0 6px ${urgencyColor}80`, flexShrink: 0, marginTop: "5px" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: urgencyColor, marginBottom: "3px" }}>{pa.action}</div>
                            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{pa.rationale}</div>
                          </div>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: urgencyColor, padding: "2px 5px", background: `${urgencyColor}12`, borderRadius: "3px", border: `1px solid ${urgencyColor}25`, textTransform: "uppercase", flexShrink: 0 }}>{pa.urgency}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsiblePanel>
              </div>
            )}

            <div style={{ marginBottom: "10px" }} />

            {/* ═══ RECOMMENDED VEHICLES ═══ */}
            {result.recommendedVehicles && result.recommendedVehicles.vehicles.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <CollapsiblePanel
                  open={open.recVehicles ?? true}
                  onToggle={() => toggle("recVehicles")}
                  icon={<Target size={14} />}
                  title={`Recommended Vehicles — ${result.recommendedVehicles.exposureLabel}`}
                  color="#00FF88"
                  count={result.recommendedVehicles.vehicles.length}
                >
                  <div style={{ marginBottom: "8px", padding: "8px 10px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "4px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.65)" }}>{result.recommendedVehicles.notes}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
                    {result.recommendedVehicles.vehicles.map((v: any, i: number) => {
                      const riskColor = v.riskLevel === "Extreme" ? "#FF2D55" : v.riskLevel === "High" ? "#FF9500" : v.riskLevel === "Medium" ? "#FFD60A" : "#00FF88";
                      const rrColor = v.riskRewardRatio >= 3 ? "#00FF88" : v.riskRewardRatio >= 2 ? "#FFD60A" : "#FF9500";
                      return (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px" }}>
                          {/* Header row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "14px", color: "#00D4FF" }}>{v.ticker}</span>
                              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8" }}>{v.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: riskColor, padding: "2px 6px", background: `${riskColor}12`, border: `1px solid ${riskColor}30`, borderRadius: "3px", textTransform: "uppercase" }}>{v.riskLevel}</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.6)", padding: "2px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px" }}>{v.vehicleType}</span>
                            </div>
                          </div>
                          {/* Price levels */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px", marginBottom: "8px" }}>
                            {[
                              { label: "PRICE", val: `$${v.currentPrice.toFixed(2)}`, color: "#E2E8F0" },
                              { label: "ENTRY", val: `$${v.entryZoneLow.toFixed(2)}–$${v.entryZoneHigh.toFixed(2)}`, color: "#00D4FF" },
                              { label: "STOP",  val: `$${v.stopLoss.toFixed(2)}`, color: "#FF2D55" },
                              { label: "T1",    val: `$${v.targetOne.toFixed(2)}`, color: "#00FF88" },
                              { label: "T2",    val: `$${v.targetTwo.toFixed(2)}`, color: "#00FF88" },
                            ].map((p, pi) => (
                              <div key={pi} style={{ padding: "5px 6px", background: `${p.color}06`, border: `1px solid ${p.color}15`, borderRadius: "3px", textAlign: "center" }}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", marginBottom: "2px", letterSpacing: "0.08em" }}>{p.label}</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "11px", color: p.color }}>{p.val}</div>
                              </div>
                            ))}
                          </div>
                          {/* R:R + Conviction row */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>R:R</span>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: rrColor }}>{v.riskRewardRatio.toFixed(1)}x</span>
                            <span style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.08)" }} />
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>CONVICTION</span>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#00D4FF" }}>{v.conviction}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.45)" }}>/100</span>
                          </div>
                          {/* Rationale */}
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.5 }}>{v.rationale}</div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsiblePanel>
              </div>
            )}

            {/* ═══ PORTFOLIO IMPACT ═══ */}
            {result.portfolioImpact && (
              <div style={{ marginBottom: "10px" }}>
                <CollapsiblePanel
                  open={open.portfolioImpact ?? true}
                  onToggle={() => toggle("portfolioImpact")}
                  icon={<BarChart2 size={14} />}
                  title="Portfolio Impact"
                  color="#FF9500"
                >
                  {/* Headline + net risk change */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E2E8F0" }}>{result.portfolioImpact.headline}</div>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                      color: result.portfolioImpact.netRiskChange === "Increased" ? "#FF2D55" : result.portfolioImpact.netRiskChange === "Decreased" ? "#00FF88" : "#FFD60A",
                      padding: "3px 8px",
                      background: result.portfolioImpact.netRiskChange === "Increased" ? "rgba(255,45,85,0.10)" : result.portfolioImpact.netRiskChange === "Decreased" ? "rgba(0,255,136,0.10)" : "rgba(255,214,10,0.10)",
                      border: `1px solid ${result.portfolioImpact.netRiskChange === "Increased" ? "rgba(255,45,85,0.30)" : result.portfolioImpact.netRiskChange === "Decreased" ? "rgba(0,255,136,0.30)" : "rgba(255,214,10,0.30)"}`,
                      borderRadius: "3px", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0,
                    }}>Risk {result.portfolioImpact.netRiskChange}</span>
                  </div>
                  {/* Allocation lines */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {result.portfolioImpact.lines.map((line: any, i: number) => {
                      const changeColor = line.change > 0 ? "#00FF88" : line.change < 0 ? "#FF2D55" : "#64748B";
                      const changeLabel = line.change > 0 ? `+${line.change}%` : line.change < 0 ? `${line.change}%` : "—";
                      return (
                        <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#CBD5E1" }}>{line.category}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)" }}>{line.currentAllocation}%</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)" }}>→</span>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#E2E8F0" }}>{line.targetAllocation}%</span>
                              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: changeColor }}>{changeLabel}</span>
                            </div>
                          </div>
                          {/* Visual bar */}
                          <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden", marginBottom: "5px" }}>
                            <div style={{ height: "100%", width: `${Math.min(line.targetAllocation * 2, 100)}%`, background: `linear-gradient(90deg, ${changeColor}40, ${changeColor})`, borderRadius: "2px", transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)", fontStyle: "italic" }}>{line.rationale}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Summary */}
                  <div style={{ padding: "10px 12px", background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.12)", borderRadius: "4px" }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6 }}>{result.portfolioImpact.summary}</div>
                  </div>
                </CollapsiblePanel>
              </div>
            )}

            {/* ═══ FAULTLINE MARKET INTERPRETATION ═══ */}
            {result.marketInterpretation && (
              <div style={{
                padding: "16px",
                background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.18)",
                borderRadius: "6px",
                marginBottom: "10px",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Zap size={14} color="#00D4FF" />
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#00D4FF", letterSpacing: "0.15em", textTransform: "uppercase" }}>FAULTLINE READS</div>
                </div>
                {/* Headline */}
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#E2E8F0", lineHeight: 1.6, marginBottom: "10px", fontWeight: 500 }}>
                  {result.marketInterpretation.headline}
                </div>
                {/* Setup context */}
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {result.marketInterpretation.setupContext}
                </div>
                {/* Opportunity window */}
                <div style={{ marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>Opportunity Window</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#CBD5E1", lineHeight: 1.6 }}>{result.marketInterpretation.opportunityWindow}</div>
                </div>
                {/* Two-column: Watch For + Invalidation */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Watch For</div>
                    {result.marketInterpretation.watchFor.map((item: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginBottom: "5px" }}>
                        <span style={{ color: "#22C55E", fontSize: "10px", marginTop: "2px", flexShrink: 0 }}>›</span>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF6B35", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Invalidation</div>
                    {result.marketInterpretation.invalidationConditions.map((item: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginBottom: "5px" }}>
                        <span style={{ color: "#FF6B35", fontSize: "10px", marginTop: "2px", flexShrink: 0 }}>›</span>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#94A3B8", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginBottom: "10px" }} />

            {/* SECTION G — What Could Break the Setup / Invalidation Triggers */}
            <CollapsiblePanel open={open.invalidation} onToggle={() => toggle("invalidation")} icon={<Shield size={14} />} title="What Could Break the Setup" color="#FF6B35" count={result.invalidationTriggers.length}>
              {result.invalidationTriggers.map((item: string, i: number) => <ListRow key={i} text={item} color="#FF6B35" icon={<AlertTriangle size={12} />} />)}
            </CollapsiblePanel>
            <div style={{ marginBottom: "10px" }} />

            {/* SECTION H — Key Indicators to Watch Next */}
            <CollapsiblePanel open={open.watchNext} onToggle={() => toggle("watchNext")} icon={<Activity size={14} />} title="Key Indicators to Watch Next" color="#00D4FF" count={result.watchNext.length}>
              {result.watchNext.map((item: string, i: number) => <ListRow key={i} text={item} color="#00D4FF" icon={<Minus size={12} />} />)}
            </CollapsiblePanel>
            <div style={{ marginBottom: "10px" }} />

            {/* Insider Intelligence Cross-Link */}
            <div style={{ padding: "16px", background: "rgba(12,15,22,0.98)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "6px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#00D4FF", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600, marginBottom: "4px" }}>Insider Intelligence™</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(100,116,139,0.65)" }}>Track where corporate insiders show conviction before the market notices.</div>
                </div>
                <a href="/app/insider-intelligence" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.35)", borderRadius: "4px", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em", textDecoration: "none", transition: "all 0.18s" }}>
                  OPEN MODULE →
                </a>
              </div>
            </div>

            {/* Compliance disclaimer */}
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px" }}>
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
          <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "4px", marginTop: "4px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)", lineHeight: 1.6, textAlign: "center" }}>
              FAULTLINE simulations are market-regime guidance, not personalized financial advice or guaranteed predictions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
