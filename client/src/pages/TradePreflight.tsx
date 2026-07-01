/* ============================================================
   FAULTLINE — Trade Preflight Simulator
   Stress-tests a user's intended market move against current
   market regime conditions and returns a probability-weighted
   risk/favorability reading.
   ============================================================ */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { AlertTriangle, CheckCircle, XCircle, Target, Zap, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Activity, Shield, BarChart2, RefreshCw } from "lucide-react";
import { ShareReportButton } from "@/components/ShareReportButton";
import { SizingCalculator } from "@/components/SizingCalculator";
import { useTickerStore } from "@/contexts/TickerStore";

// ── Types ─────────────────────────────────────────────────────
type MoveType =
  | "add_risk"
  | "reduce_risk"
  | "hedge"
  | "rotate"
  | "raise_cash"
  | "deploy_cash"
  | "buy_specific_asset"
  | "sell_specific_asset";

type SimulatorTimeframe = "today" | "this_week" | "one_three_months" | "six_twelve_months";

// ── Constants ─────────────────────────────────────────────────
const MOVE_OPTIONS: { value: MoveType; label: string; icon: string }[] = [
  { value: "add_risk",           label: "Add Risk",                  icon: "↑" },
  { value: "reduce_risk",        label: "Reduce Risk",               icon: "↓" },
  { value: "hedge",              label: "Hedge",                     icon: "⛨" },
  { value: "rotate",             label: "Rotate",                    icon: "⟳" },
  { value: "raise_cash",         label: "Raise Cash",                icon: "◎" },
  { value: "deploy_cash",        label: "Deploy Cash",               icon: "◈" },
  { value: "buy_specific_asset", label: "Buy Specific Asset",        icon: "₿" },
  { value: "sell_specific_asset",label: "Sell Specific Asset",       icon: "✕" },
];

const TIMEFRAME_OPTIONS: { value: SimulatorTimeframe; label: string; sub: string }[] = [
  { value: "today",              label: "Today",          sub: "Intraday / EOD" },
  { value: "this_week",          label: "This Week",      sub: "1–5 sessions" },
  { value: "one_three_months",   label: "1–3 Months",     sub: "Tactical horizon" },
  { value: "six_twelve_months",  label: "6–12 Months",    sub: "Strategic horizon" },
];

// ── Color helpers ─────────────────────────────────────────────
function favorabilityColor(score: number): string {
  if (score >= 70) return "#00FF88";
  if (score >= 50) return "#00D4FF";
  if (score >= 35) return "#FF9500";
  return "#FF2D55";
}

function riskColor(level: string): string {
  const map: Record<string, string> = { Low: "#00FF88", Medium: "#FF9500", High: "#FF2D55", Extreme: "#FF0040" };
  return map[level] ?? "#94A3B8";
}

function conditionColor(level: string): string {
  const map: Record<string, string> = {
    Low: "#00FF88", Moderate: "#FF9500", Elevated: "#FF6B35", Critical: "#FF2D55",
    Broad: "#00FF88", Narrowing: "#FF9500", Deteriorating: "#FF2D55",
  };
  return map[level] ?? "#94A3B8";
}

function pressureColor(score: number): string {
  if (score >= 65) return "#FF2D55";
  if (score >= 45) return "#FF9500";
  if (score >= 25) return "#00D4FF";
  return "#00FF88";
}

// ── Animated score ring ───────────────────────────────────────
function ScoreRing({ score, color, size = 120, label }: { score: number; color: string; size?: number; label?: string }) {
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimScore(score), 200); return () => clearTimeout(t); }, [score]);
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = (animScore / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size >= 120 ? "28px" : "20px", color, lineHeight: 1, textShadow: `0 0 16px ${color}80` }}>{animScore}</div>
        {label && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: "2px" }}>{label}</div>}
      </div>
    </div>
  );
}

// ── Probability bar ───────────────────────────────────────────
function ProbBar({ value, color, label }: { value: number; color: string; label: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 400); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.8)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color }}>{value}%</span>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${anim}%`, background: `linear-gradient(90deg, ${color}60, ${color})`, borderRadius: "3px", boxShadow: `0 0 8px ${color}60`, transition: "width 1.4s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
    </div>
  );
}

// ── Condition chip ────────────────────────────────────────────
function ConditionChip({ label, value }: { label: string; value: string }) {
  const color = conditionColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "8px 10px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: "4px", minWidth: "80px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "12px", color }}>{value}</div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ icon, title, color = "#00D4FF" }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>{title}</span>
      <div style={{ flex: 1, height: "1px", background: `${color}20` }} />
    </div>
  );
}

// ── List item ─────────────────────────────────────────────────
function ListItem({ text, color, icon }: { text: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ color, flexShrink: 0, marginTop: "1px" }}>{icon}</div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#CBD5E1", lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function TradePreflight() {
  useSEO(PAGE_SEO.diagnostic); // reuse diagnostic SEO until tradePreflight entry is added
  const { output } = useEngine();

  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<SimulatorTimeframe>("today");
  const [ticker, setTicker] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    greenLights: true,
    redFlags: true,
    invalidation: false,
    watchNext: false,
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const { setTicker: setGlobalTicker } = useTickerStore();

  const simulate = trpc.trade.simulate.useMutation({
    onSuccess: (data, variables) => {
      setShowResult(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      // Update global Ask context so user can ask follow-up questions about this symbol
      if (variables.ticker) {
        setGlobalTicker(variables.ticker, variables.ticker, "stock");
      }
    },
  });

  const handleSimulate = () => {
    if (!selectedMove || !ticker.trim()) return;
    simulate.mutate({
      moveType: selectedMove,
      timeframe: selectedTimeframe,
      ticker: ticker.trim().toUpperCase(),
    });
  };

  const handleReset = () => {
    setShowResult(false);
    simulate.reset();
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const result = simulate.data;
  const isLoading = simulate.isPending;
  const color = pressureColor(output.overall.score * 10);

  return (
    <div style={{ background: "#050608", minHeight: "100vh", paddingBottom: "60px" }}>
      {/* Corner brackets */}
      <div style={{ position: "fixed", top: 12, left: 12, width: 16, height: 16, borderTop: `2px solid ${color}50`, borderLeft: `2px solid ${color}50`, pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "fixed", top: 12, right: 12, width: 16, height: 16, borderTop: `2px solid ${color}50`, borderRight: `2px solid ${color}50`, pointerEvents: "none", zIndex: 5 }} />

      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "0 16px" }}>
        <PageHeader
          title="Trade Preflight Simulator"
          subtitle="Stress-test your move against today's market regime"
          badge="PREMIUM"
          rightSlot={
            result ? (
              <ShareReportButton
                reportType="market_preflight"
                subject={`Trade Preflight — ${result.ticker ?? result.moveLabel ?? "Market"}`}
                snapshotData={{
                  ticker: result.ticker,
                  moveLabel: result.moveLabel,
                  timeframeLabel: result.timeframeLabel,
                  moveFavorabilityScore: result.moveFavorabilityScore,
                  riskLevel: result.riskLevel,
                  confidenceLevel: result.confidenceLevel,
                  favorableSetupProbability: result.favorableSetupProbability,
                  adversePressureProbability: result.adversePressureProbability,
                }}
                size="sm"
              />
            ) : undefined
          }
        />

        {/* ── Current Market Condition Panel ──────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.04) 0%, rgba(12,15,22,0.98) 60%)",
          border: "1px solid rgba(0,212,255,0.20)",
          borderLeft: `3px solid ${color}`,
          borderRadius: "6px",
          padding: "16px",
          marginBottom: "12px",
          animation: "cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) both",
        }}>
          <SectionHeader icon={<Activity size={14} />} title="Current Equity Market Condition" color={color} />

          {/* Pressure + regime row */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: "blink-alert 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Equity Pressure Index</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color, textShadow: `0 0 14px ${color}70` }}>{Math.round(output.overall.score * 10)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>/100</span>
            </div>
            <div style={{ padding: "3px 10px", background: `${color}12`, border: `1px solid ${color}30`, borderRadius: "3px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{output.regime.label}</span>
            </div>
          </div>

          {/* Bull/Crash probabilities */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={13} color="#00FF88" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)" }}>Bull</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#00FF88" }}>{output.probability.bullProbability}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingDown size={13} color="#FF2D55" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)" }}>Crash</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#FF2D55" }}>{output.probability.crashProbability}%</span>
            </div>
          </div>

          {/* Condition chips grid */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {output.domains.map(d => {
              const chipLabel = d.label.split(" ")[0];
              const chipLevel = d.riskLevel === "low" ? "Low" : d.riskLevel === "moderate" ? "Moderate" : d.riskLevel === "elevated" ? "Elevated" : "Critical";
              return <ConditionChip key={d.id} label={chipLabel} value={chipLevel} />;
            })}
          </div>
        </div>

        {/* ── Simulate Your Move ──────────────────────────────── */}
        <div style={{
          background: "rgba(12,15,22,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "6px",
          padding: "16px",
          marginBottom: "12px",
          animation: "cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 80ms both",
        }}>
          <SectionHeader icon={<Target size={14} />} title="Simulate Your Move" color="#00D4FF" />

          {/* Move type grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px", marginBottom: "14px" }}>
            {MOVE_OPTIONS.map(opt => {
              const isSelected = selectedMove === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setSelectedMove(opt.value); setShowResult(false); simulate.reset(); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 12px",
                    background: isSelected ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                    border: isSelected ? "1px solid rgba(0,212,255,0.50)" : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    textAlign: "left",
                    boxShadow: isSelected ? "0 0 14px rgba(0,212,255,0.15)" : "none",
                  }}
                >
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: isSelected ? "#00D4FF" : "rgba(100,116,139,0.6)", width: "14px", flexShrink: 0 }}>{opt.icon}</span>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: isSelected ? "#E2E8F0" : "#94A3B8", fontWeight: isSelected ? 600 : 400, lineHeight: 1.3 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Security / Ticker input — required for ALL move types (Security-First Analysis) */}
          {selectedMove && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "6px" }}>
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
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(0,212,255,0.05)",
                  border: ticker.trim() ? "1px solid rgba(0,212,255,0.40)" : "1px solid rgba(255,45,85,0.35)",
                  borderRadius: "4px",
                  color: "#E2E8F0",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "14px",
                  letterSpacing: "0.12em",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease",
                }}
              />
            </div>
          )}

          {/* Timeframe selector */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Timeframe</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {TIMEFRAME_OPTIONS.map(tf => {
                const isSelected = selectedTimeframe === tf.value;
                return (
                  <button
                    key={tf.value}
                    onClick={() => { setSelectedTimeframe(tf.value); setShowResult(false); simulate.reset(); }}
                    style={{
                      padding: "10px 8px",
                      background: isSelected ? "rgba(0,212,255,0.10)" : "rgba(255,255,255,0.02)",
                      border: isSelected ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                    }}
                  >
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: isSelected ? "#00D4FF" : "#94A3B8" }}>{tf.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.55)", marginTop: "2px" }}>{tf.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run simulation button */}
          <button
            onClick={handleSimulate}
            disabled={!selectedMove || !ticker.trim() || isLoading}
            style={{
              width: "100%",
              padding: "13px",
              background: selectedMove && ticker.trim() && !isLoading
                ? "linear-gradient(135deg, rgba(0,212,255,0.20) 0%, rgba(0,212,255,0.08) 100%)"
                : "rgba(255,255,255,0.03)",
              border: selectedMove && ticker.trim() && !isLoading
                ? "1px solid rgba(0,212,255,0.50)"
                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: "4px",
              cursor: selectedMove && ticker.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoading ? (
              <>
                <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "fl-spin 0.8s linear infinite" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#00D4FF", letterSpacing: "0.15em" }}>RUNNING SIMULATION…</span>
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

        {/* ── Simulation Result ───────────────────────────────── */}
        {showResult && result && (
          <div ref={resultRef} style={{ animation: "cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) both" }}>

            {/* Result header bar */}
            <div style={{
              background: `linear-gradient(135deg, ${favorabilityColor(result.moveFavorabilityScore)}08 0%, rgba(12,15,22,0.98) 60%)`,
              border: `1px solid ${favorabilityColor(result.moveFavorabilityScore)}30`,
              borderLeft: `3px solid ${favorabilityColor(result.moveFavorabilityScore)}`,
              borderRadius: "6px",
              padding: "14px 16px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "3px" }}>Simulation Result</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF" }}>
                  {result.moveLabel}
                  {result.ticker && <span style={{ color: "#00D4FF" }}> — {result.ticker}</span>}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(100,116,139,0.6)", fontWeight: 400, marginLeft: "10px" }}>{result.timeframeLabel}</span>
                </div>
              </div>
              <button
                onClick={handleReset}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "4px", cursor: "pointer", color: "#94A3B8" }}
              >
                <RefreshCw size={12} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.1em" }}>NEW SIMULATION</span>
              </button>
            </div>

            {/* Score ring + probability bars */}
            <div style={{
              background: "rgba(12,15,22,0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "20px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <ScoreRing score={result.moveFavorabilityScore} color={favorabilityColor(result.moveFavorabilityScore)} size={120} label="FAVORABILITY" />
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Move Score</div>
              </div>

              <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <ProbBar value={result.favorableSetupProbability} color="#00FF88" label="Favorable Setup" />
                <ProbBar value={result.adversePressureProbability} color="#FF2D55" label="Adverse Pressure" />

                {/* Risk + Confidence badges */}
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

            {/* Action Bias */}
            <div style={{
              background: "rgba(12,15,22,0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "10px",
            }}>
              <SectionHeader icon={<BarChart2 size={14} />} title="Action Bias" color="#00D4FF" />
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#CBD5E1", lineHeight: 1.65, marginBottom: "12px" }}>
                {result.actionBias}
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>Best Version of This Move</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>{result.bestVersionOfMove}</div>
              </div>
            </div>

            {/* AI Explanation */}
            <div style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.04) 0%, rgba(12,15,22,0.98) 100%)",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "10px",
            }}>
              <SectionHeader icon={<Zap size={14} />} title="FAULTLINE Analysis" color="#00D4FF" />
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.7, fontStyle: "italic" }}>
                {result.explanation}
              </div>
            </div>

            {/* Green Lights + Red Flags */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {/* Green Lights */}
              <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", padding: "14px" }}>
                <button
                  onClick={() => toggleSection("greenLights")}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expandedSections.greenLights ? "10px" : 0 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <CheckCircle size={13} color="#00FF88" />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#00FF88", textTransform: "uppercase", letterSpacing: "0.15em" }}>Green Lights</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{result.greenLights.length}</span>
                  </div>
                  {expandedSections.greenLights ? <ChevronUp size={12} color="#64748B" /> : <ChevronDown size={12} color="#64748B" />}
                </button>
                {expandedSections.greenLights && result.greenLights.map((item, i) => (
                  <ListItem key={i} text={item} color="#00FF88" icon={<CheckCircle size={12} />} />
                ))}
                {expandedSections.greenLights && result.greenLights.length === 0 && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)", padding: "6px 0" }}>No green lights in current regime</div>
                )}
              </div>

              {/* Red Flags */}
              <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "6px", padding: "14px" }}>
                <button
                  onClick={() => toggleSection("redFlags")}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expandedSections.redFlags ? "10px" : 0 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <XCircle size={13} color="#FF2D55" />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FF2D55", textTransform: "uppercase", letterSpacing: "0.15em" }}>Red Flags</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{result.redFlags.length}</span>
                  </div>
                  {expandedSections.redFlags ? <ChevronUp size={12} color="#64748B" /> : <ChevronDown size={12} color="#64748B" />}
                </button>
                {expandedSections.redFlags && result.redFlags.map((item, i) => (
                  <ListItem key={i} text={item} color="#FF2D55" icon={<XCircle size={12} />} />
                ))}
                {expandedSections.redFlags && result.redFlags.length === 0 && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)", padding: "6px 0" }}>No red flags in current regime</div>
                )}
              </div>
            </div>

            {/* Areas to Avoid */}
            <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,149,0,0.15)", borderRadius: "6px", padding: "14px", marginBottom: "10px" }}>
              <SectionHeader icon={<AlertTriangle size={14} />} title="Areas to Avoid" color="#FF9500" />
              {result.avoidAreas.map((item, i) => (
                <ListItem key={i} text={item} color="#FF9500" icon={<AlertTriangle size={12} />} />
              ))}
            </div>

            {/* Invalidation Triggers */}
            <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "14px", marginBottom: "10px" }}>
              <button
                onClick={() => toggleSection("invalidation")}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expandedSections.invalidation ? "10px" : 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Shield size={14} color="#FF6B35" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF6B35", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>Invalidation Triggers</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,107,53,0.20)", width: "40px" }} />
                </div>
                {expandedSections.invalidation ? <ChevronUp size={12} color="#64748B" /> : <ChevronDown size={12} color="#64748B" />}
              </button>
              {expandedSections.invalidation && result.invalidationTriggers.map((item, i) => (
                <ListItem key={i} text={item} color="#FF6B35" icon={<AlertTriangle size={12} />} />
              ))}
              {!expandedSections.invalidation && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>{result.invalidationTriggers.length} conditions that would change this reading</div>
              )}
            </div>

            {/* Key Indicators to Watch */}
            <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "14px", marginBottom: "10px" }}>
              <button
                onClick={() => toggleSection("watchNext")}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expandedSections.watchNext ? "10px" : 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={14} color="#00D4FF" />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00D4FF", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>Key Indicators to Watch</span>
                </div>
                {expandedSections.watchNext ? <ChevronUp size={12} color="#64748B" /> : <ChevronDown size={12} color="#64748B" />}
              </button>
              {expandedSections.watchNext && result.watchNext.map((item, i) => (
                <ListItem key={i} text={item} color="#00D4FF" icon={<Minus size={12} />} />
              ))}
              {!expandedSections.watchNext && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>{result.watchNext.length} indicators to monitor</div>
              )}
            </div>

            {/* Sizing Calculator — standalone mode for ticker-specific preflight */}
            {result.ticker && (
              <div style={{ marginBottom: '10px' }}>
                <SizingCalculator
                  ticker={result.ticker}
                  assetType="STOCK"
                  defaultExpanded={false}
                />
              </div>
            )}

            {/* Compliance Disclaimer */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "4px",
              marginBottom: "10px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", lineHeight: 1.6, textAlign: "center", letterSpacing: "0.04em" }}>
                FAULTLINE simulations are market-regime guidance, not personalized financial advice or guaranteed predictions.
                All readings are probability-weighted estimates derived from macroeconomic data and should not be the sole basis for any investment decision.
              </div>
            </div>
          </div>
        )}

        {/* Initial disclaimer (before simulation) */}
        {!showResult && (
          <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", marginTop: "4px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.45)", lineHeight: 1.6, textAlign: "center" }}>
              FAULTLINE simulations are market-regime guidance, not personalized financial advice or guaranteed predictions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
