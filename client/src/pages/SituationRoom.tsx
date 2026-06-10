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
import { trackSituationRoomUse } from "@/hooks/useAnalytics";
import {
  CheckCircle, XCircle, AlertTriangle, Target, Zap,
  TrendingUp, TrendingDown, Activity, Shield, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, Minus, Eye, Crosshair,
  DollarSign, History, FlaskConical, ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
type MoveType =
  | "buy_add_risk" | "hold" | "trim" | "sell" | "hedge"
  | "raise_cash" | "rotate_sectors" | "buy_specific_ticker" | "sell_specific_ticker"
  | "increase_crypto" | "reduce_crypto";

type SimulatorTimeframe = "today" | "this_week" | "one_three_months" | "six_twelve_months";

type ThesisType =
  | "momentum" | "breakout" | "mean_reversion" | "long_term"
  | "value" | "ai_theme" | "crypto_cycle" | "sector_rotation" | "other";

type VerdictType = "APPROVED" | "CAUTION" | "WAIT" | "DEFENSIVE" | "HIGH_CONVICTION";

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
const MOVE_OPTIONS: { value: MoveType; label: string; glyph: string }[] = [
  { value: "buy_add_risk",        label: "Buy / Add Risk",           glyph: "↑" },
  { value: "hold",                label: "Hold",                     glyph: "—" },
  { value: "trim",                label: "Trim",                     glyph: "↓" },
  { value: "sell",                label: "Sell",                     glyph: "✕" },
  { value: "hedge",               label: "Hedge",                    glyph: "⛨" },
  { value: "raise_cash",          label: "Raise Cash",               glyph: "◎" },
  { value: "rotate_sectors",      label: "Rotate Sectors",           glyph: "⟳" },
  { value: "buy_specific_ticker",  label: "Buy a Specific Ticker",    glyph: "◈" },
  { value: "sell_specific_ticker", label: "Sell a Specific Ticker",   glyph: "⊖" },
  { value: "increase_crypto",      label: "Increase Crypto Exposure", glyph: "₿" },
  { value: "reduce_crypto",       label: "Reduce Crypto Exposure",   glyph: "↙" },
];

const TIMEFRAME_OPTIONS: { value: SimulatorTimeframe; label: string; sub: string }[] = [
  { value: "today",            label: "Today",       sub: "Intraday / EOD" },
  { value: "this_week",        label: "This Week",   sub: "1–5 sessions" },
  { value: "one_three_months", label: "1–3 Months",  sub: "Tactical" },
  { value: "six_twelve_months",label: "6–12 Months", sub: "Strategic" },
];

const THESIS_OPTIONS: { value: ThesisType; label: string }[] = [
  { value: "momentum",        label: "Momentum" },
  { value: "breakout",        label: "Breakout" },
  { value: "mean_reversion",  label: "Mean Reversion" },
  { value: "long_term",       label: "Long-Term" },
  { value: "value",           label: "Value" },
  { value: "ai_theme",        label: "AI Theme" },
  { value: "crypto_cycle",    label: "Crypto Cycle" },
  { value: "sector_rotation", label: "Sector Rotation" },
  { value: "other",           label: "Other" },
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

  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<SimulatorTimeframe>("today");
  const [selectedThesis, setSelectedThesis] = useState<ThesisType>("momentum");
  const [ticker, setTicker] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState<string>("BTC");
  const [showResult, setShowResult] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    greenLights: true, threatBoard: true, actionBias: true, invalidation: false, watchNext: false,
    verdict: true, outcomeSimulator: true, entryQuality: true, positionSizing: true,
    historicalAnalogs: true, thesisStressTest: true,
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const simulate = trpc.trade.simulate.useMutation({
    onSuccess: () => {
      setShowResult(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    },
  });

  const isCryptoMove = selectedMove === "increase_crypto" || selectedMove === "reduce_crypto";
  const isTickerMove = selectedMove === "buy_specific_ticker" || selectedMove === "sell_specific_ticker";

  const handleSimulate = () => {
    if (!selectedMove) return;
    trackSituationRoomUse(selectedMove, selectedTimeframe);
    let resolvedTicker: string | undefined;
    if (isTickerMove && ticker.trim()) {
      resolvedTicker = ticker.trim().toUpperCase();
    } else if (isCryptoMove) {
      resolvedTicker = cryptoSymbol;
    }
    simulate.mutate({
      moveType: selectedMove,
      timeframe: selectedTimeframe,
      ticker: resolvedTicker,
      thesisType: selectedThesis,
    });
  };

  const handleReset = () => { setShowResult(false); simulate.reset(); };
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
          <SectionLabel icon={<Crosshair size={14} />} title="Trade Preflight Simulator" color="#00D4FF" />

          {/* Move type grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "6px", marginBottom: "14px" }}>
            {MOVE_OPTIONS.map(opt => {
              const sel = selectedMove === opt.value;
              return (
                <button key={opt.value} onClick={() => { setSelectedMove(opt.value); setShowResult(false); simulate.reset(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px",
                    background: sel ? "rgba(0,212,255,0.11)" : "rgba(255,255,255,0.025)",
                    border: sel ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "4px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    boxShadow: sel ? "0 0 16px rgba(0,212,255,0.12)" : "none",
                  }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: sel ? "#00D4FF" : "rgba(100,116,139,0.55)", width: "14px", flexShrink: 0 }}>{opt.glyph}</span>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: sel ? "#E2E8F0" : "#94A3B8", fontWeight: sel ? 600 : 400, lineHeight: 1.3 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Ticker input */}
          {isTickerMove && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>Ticker Symbol</label>
              <input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))} placeholder="e.g. NVDA, TSLA, AAPL" maxLength={10}
                style={{ width: "100%", padding: "10px 14px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "4px", color: "#E2E8F0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", letterSpacing: "0.12em", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          {/* Crypto asset selector */}
          {isCryptoMove && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>
                Select Asset
                <span style={{ marginLeft: "8px", color: "rgba(0,212,255,0.6)", fontSize: "10px" }}>— {cryptoSymbol} selected</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                {CRYPTO_OPTIONS.map(opt => {
                  const sel = cryptoSymbol === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setCryptoSymbol(opt.value); setShowResult(false); simulate.reset(); }}
                      style={{
                        padding: "8px 4px",
                        background: sel ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)",
                        border: sel ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
                      }}
                    >
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: sel ? "#00D4FF" : "#94A3B8", fontWeight: sel ? 700 : 400, marginBottom: "2px" }}>{opt.value}</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "9px", color: sel ? "rgba(0,212,255,0.7)" : "rgba(100,116,139,0.5)", lineHeight: 1.2 }}>{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeframe */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Timeframe</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {TIMEFRAME_OPTIONS.map(tf => {
                const sel = selectedTimeframe === tf.value;
                return (
                  <button key={tf.value} onClick={() => { setSelectedTimeframe(tf.value); setShowResult(false); simulate.reset(); }}
                    style={{ padding: "10px 8px", background: sel ? "rgba(0,212,255,0.10)" : "rgba(255,255,255,0.02)", border: sel ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", cursor: "pointer", textAlign: "center", transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)" }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: sel ? "#00D4FF" : "#94A3B8" }}>{tf.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", marginTop: "2px" }}>{tf.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thesis Type */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Thesis Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {THESIS_OPTIONS.map(th => {
                const sel = selectedThesis === th.value;
                return (
                  <button key={th.value} onClick={() => setSelectedThesis(th.value)}
                    style={{
                      padding: "6px 12px",
                      background: sel ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.025)",
                      border: sel ? "1px solid rgba(167,139,250,0.50)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "4px", cursor: "pointer",
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                      color: sel ? "#A78BFA" : "#64748B",
                      transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    }}>
                    {th.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run button */}
          <button onClick={handleSimulate} disabled={!selectedMove || isLoading}
            style={{
              width: "100%", padding: "14px",
              background: selectedMove && !isLoading ? "linear-gradient(135deg, rgba(0,212,255,0.18) 0%, rgba(0,212,255,0.07) 100%)" : "rgba(255,255,255,0.03)",
              border: selectedMove && !isLoading ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: "4px", cursor: selectedMove && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
            {isLoading ? (
              <>
                <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#00D4FF", letterSpacing: "0.15em" }}>RUNNING PREFLIGHT…</span>
              </>
            ) : (
              <>
                <Zap size={14} color={selectedMove ? "#00D4FF" : "#64748B"} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: selectedMove ? "#00D4FF" : "#64748B", letterSpacing: "0.15em" }}>
                  {selectedMove ? `RUN PREFLIGHT — ${MOVE_OPTIONS.find(m => m.value === selectedMove)?.label?.toUpperCase()}` : "SELECT A MOVE TO SIMULATE"}
                </span>
              </>
            )}
          </button>

          {simulate.isError && (
            <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: "4px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF2D55" }}>Simulation failed. Please try again.</span>
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

            {/* ═══ NEW: THESIS STRESS TEST ═══ */}
            {result.thesisStressTest && (
              <CollapsiblePanel open={open.thesisStressTest} onToggle={() => toggle("thesisStressTest")} icon={<FlaskConical size={14} />} title="Thesis Stress Test" color="#F59E0B">
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)", borderRadius: "3px", marginBottom: "8px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#F59E0B", letterSpacing: "0.1em" }}>{result.thesisStressTest.thesisLabel}</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>Core Dependency</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>{result.thesisStressTest.coreDependency}</div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Failure Points</div>
                {result.thesisStressTest.failurePoints.map((fp: string, i: number) => (
                  <ListRow key={i} text={fp} color="#F59E0B" icon={<AlertTriangle size={12} />} />
                ))}
              </CollapsiblePanel>
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
