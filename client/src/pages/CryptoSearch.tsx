/* ============================================================
   FAULTLINE — Crypto Intelligence Terminal
   Institutional-grade digital asset intelligence.
   Design: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, X, TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, Activity, BarChart2, Shield, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
// ── Inline types (mirrored from server/cryptoEngine.ts) ─────────
type CryptoSignalLabel =
  | "Speculative Acceleration"
  | "Liquidity Fragile"
  | "Momentum Breakout"
  | "AI Narrative Exposure"
  | "Macro Sensitive"
  | "Stablecoin Stress"
  | "Deleveraging Risk"
  | "Risk-Off Vulnerable"
  | "Neutral / Watch";

type CryptoSignalBias = "Bullish" | "Neutral" | "Bearish";
type CryptoRiskLevel  = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
type MomentumDir      = "Accelerating" | "Stable" | "Decelerating" | "Reversing";

interface CryptoSignalVector {
  label: string;
  score: number;
  direction: "positive" | "negative" | "neutral";
  description: string;
}

interface CryptoAssetIntelligence {
  id: string; symbol: string; name: string; image: string;
  currentPrice: number; priceChangePercent24h: number; priceChangePercent7d: number | null;
  marketCap: number; totalVolume: number; high24h: number; low24h: number;
  circulatingSupply: number; ath: number; athChangePercent: number;
  sparkline7d: number[]; volatility24h: number; distanceFromAth: number;
  signalBias: CryptoSignalBias; signalScore: number;
  riskLevel: CryptoRiskLevel; riskScore: number;
  momentum: MomentumDir; primaryLabel: CryptoSignalLabel;
  secondaryLabels: CryptoSignalLabel[]; vectors: CryptoSignalVector[];
  macroAlignment: "Aligned" | "Diverging" | "Neutral";
  liquiditySensitivity: "Low" | "Moderate" | "High" | "Extreme";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  regimeNote: string; keyInsights: string[]; generatedAt: number;
}

interface CryptoSystemicRisk {
  score: number; level: CryptoRiskLevel; btcDominance: number;
  stablecoinLiquidity: "Expanding" | "Stable" | "Tightening" | "Contracting";
  volatilityRegime: "Low" | "Normal" | "Elevated" | "Extreme";
  leverageConditions: "Low" | "Normal" | "Elevated" | "Extreme";
  marketBreadth: "Strong" | "Moderate" | "Weak" | "Deteriorating";
  macroLiquidity: "Expanding" | "Neutral" | "Tightening" | "Contracting";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  breakdown: CryptoSignalVector[]; regime: string; regimeColor: string;
  summary: string; fetchedAt: number;
}

// ── Constants ─────────────────────────────────────────────────
const EXAMPLE_SYMBOLS = ["BTC", "ETH", "SOL", "RNDR", "SEI", "HYPE"];

const SIGNAL_COLORS: Record<CryptoSignalLabel, string> = {
  "Speculative Acceleration": "#FF9500",
  "Liquidity Fragile":        "#FF2D55",
  "Momentum Breakout":        "#00FF88",
  "AI Narrative Exposure":    "#00D4FF",
  "Macro Sensitive":          "#FFD700",
  "Stablecoin Stress":        "#FF6B35",
  "Deleveraging Risk":        "#FF2D55",
  "Risk-Off Vulnerable":      "#FF9500",
  "Neutral / Watch":          "#64748B",
};

const BIAS_COLORS = {
  Bullish: "#00FF88",
  Neutral: "#00D4FF",
  Bearish: "#FF2D55",
};

const RISK_COLORS = {
  Low:      "#00FF88",
  Moderate: "#00D4FF",
  Elevated: "#FFD700",
  High:     "#FF9500",
  Critical: "#FF2D55",
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(decimals)}K`;
  if (n >= 1)    return `$${n.toFixed(decimals)}`;
  return `$${n.toFixed(6)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtSupply(n: number, symbol: string): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B ${symbol}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M ${symbol}`;
  return `${n.toLocaleString()} ${symbol}`;
}

// ── Sparkline ─────────────────────────────────────────────────
function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = canvas.offsetWidth  || 200;
    canvas.height = canvas.offsetHeight || height;
    const w = canvas.width;
    const h = canvas.height;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - ((v - min) / range) * (h - 6) - 3,
    }));
    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "30");
    grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // Line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color + "D0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // End dot
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
  }, [data, color, height]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: `${height}px`, display: "block" }} />;
}

// ── Risk gauge arc ────────────────────────────────────────────
function RiskGauge({ score, size = 80 }: { score: number; size: number }) {
  const level = score >= 8 ? "Critical" : score >= 6.5 ? "High" : score >= 5 ? "Elevated" : score >= 3 ? "Moderate" : "Low";
  const color = RISK_COLORS[level as keyof typeof RISK_COLORS];
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 300); return () => clearTimeout(t); }, [score]);
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(anim / 10) * circ} ${circ}`}
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size > 70 ? "22px" : "16px", color, lineHeight: 1 }}>{anim.toFixed(1)}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>/10</span>
      </div>
    </div>
  );
}

// ── Signal bar ────────────────────────────────────────────────
function SignalBar({ label, score, color }: { label: string; score: number; color: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 500); return () => clearTimeout(t); }, [score]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color }}>{score.toFixed(0)}</span>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${anim}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, boxShadow: `0 0 6px ${color}60`, borderRadius: "2px", transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
    </div>
  );
}

// ── Heatmap cell ──────────────────────────────────────────────
function HeatCell({ symbol, change, price, rank }: { symbol: string; change: number; price: number; rank: number }) {
  const intensity = Math.min(Math.abs(change) / 15, 1);
  const color = change >= 0 ? "#00FF88" : "#FF2D55";
  const alpha = Math.round(intensity * 200).toString(16).padStart(2, "0");
  return (
    <div style={{
      background: `${color}${alpha}`,
      border: `1px solid ${color}30`,
      borderRadius: "4px",
      padding: "6px 4px",
      textAlign: "center",
      cursor: "default",
      transition: "all 0.2s ease",
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#94A3B8", marginBottom: "2px" }}>#{rank}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "11px", color: "#F0F4FF" }}>{symbol}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, fontWeight: 600 }}>{fmtPct(change)}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B", marginTop: "1px" }}>{fmt(price, price < 1 ? 4 : 2)}</div>
    </div>
  );
}

// ── Systemic Risk Panel ───────────────────────────────────────
function SystemicRiskPanel({ risk }: { risk: CryptoSystemicRisk }) {
  const color = risk.regimeColor;
  return (
    <div style={{
      background: "rgba(10,12,18,0.98)",
      border: `1px solid ${color}35`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "6px",
      padding: "16px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div className="scanlines" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.15 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={12} style={{ color }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64748B", letterSpacing: "0.15em" }}>CRYPTO SYSTEMIC RISK</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 10px", background: `${color}14`, border: `1px solid ${color}40`, borderRadius: "12px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: "blink-alert 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color, letterSpacing: "0.12em" }}>{risk.regime}</span>
          </div>
        </div>

        {/* Score + breakdown */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "14px" }}>
          <RiskGauge score={risk.score} size={76} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
            {risk.breakdown.slice(0, 4).map(v => (
              <SignalBar key={v.label} label={v.label} score={v.score} color={v.direction === "positive" ? "#00FF88" : v.direction === "negative" ? "#FF2D55" : "#00D4FF"} />
            ))}
          </div>
        </div>

        {/* Metrics grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {[
            { label: "BTC Dominance",       value: `${risk.btcDominance.toFixed(1)}%`,  color: risk.btcDominance > 60 ? "#FF9500" : "#00FF88" },
            { label: "Stablecoin Liq.",     value: risk.stablecoinLiquidity,             color: risk.stablecoinLiquidity === "Expanding" ? "#00FF88" : risk.stablecoinLiquidity === "Contracting" ? "#FF2D55" : "#FFD700" },
            { label: "Volatility Regime",   value: risk.volatilityRegime,               color: risk.volatilityRegime === "Low" ? "#00FF88" : risk.volatilityRegime === "Extreme" ? "#FF2D55" : "#FFD700" },
            { label: "Market Breadth",      value: risk.marketBreadth,                  color: risk.marketBreadth === "Strong" ? "#00FF88" : risk.marketBreadth === "Deteriorating" ? "#FF2D55" : "#FFD700" },
            { label: "Macro Liquidity",     value: risk.macroLiquidity,                 color: risk.macroLiquidity === "Expanding" ? "#00FF88" : risk.macroLiquidity === "Contracting" ? "#FF2D55" : "#FFD700" },
            { label: "Speculative Intensity",value: risk.speculativeIntensity,          color: risk.speculativeIntensity === "Low" ? "#00FF88" : risk.speculativeIntensity === "Extreme" ? "#FF2D55" : "#FFD700" },
          ].map(({ label, value, color: c }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", padding: "6px 8px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#4B5563", letterSpacing: "0.1em", marginBottom: "3px" }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "12px", color: c }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
          {risk.summary}
        </p>
      </div>
    </div>
  );
}

// ── Asset Intelligence Card ───────────────────────────────────
function AssetCard({ asset, risk }: { asset: CryptoAssetIntelligence; risk: CryptoSystemicRisk }) {
  const biasColor  = BIAS_COLORS[asset.signalBias];
  const riskColor  = RISK_COLORS[asset.riskLevel];
  const labelColor = SIGNAL_COLORS[asset.primaryLabel];
  const change24h  = asset.priceChangePercent24h;
  const priceColor = change24h >= 0 ? "#00FF88" : "#FF2D55";
  const TrendIcon  = change24h > 0 ? TrendingUp : change24h < 0 ? TrendingDown : Minus;

  return (
    <div style={{
      background: "rgba(8,10,16,0.99)",
      border: `1px solid ${biasColor}35`,
      borderTop: `3px solid ${biasColor}`,
      borderRadius: "8px",
      overflow: "hidden",
      position: "relative",
    }}>
      <div className="scanlines" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.12 }} />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {asset.image && (
                <img src={asset.image} alt={asset.symbol} style={{ width: "32px", height: "32px", borderRadius: "50%", border: `1px solid ${biasColor}30` }} />
              )}
              <div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF", letterSpacing: "0.04em" }}>{asset.symbol}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.08em" }}>{asset.name}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#F0F4FF", lineHeight: 1 }}>{fmt(asset.currentPrice, asset.currentPrice < 1 ? 4 : 2)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", marginTop: "3px" }}>
                <TrendIcon size={10} style={{ color: priceColor }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: priceColor, fontWeight: 600 }}>{fmtPct(change24h)}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>24h</span>
              </div>
            </div>
          </div>

          {/* Signal bias + label */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <div style={{ padding: "3px 10px", background: `${biasColor}14`, border: `1px solid ${biasColor}50`, borderRadius: "12px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: biasColor, letterSpacing: "0.1em" }}>{asset.signalBias.toUpperCase()}</span>
            </div>
            <div style={{ padding: "3px 10px", background: `${labelColor}10`, border: `1px solid ${labelColor}40`, borderRadius: "12px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: labelColor, letterSpacing: "0.08em" }}>{asset.primaryLabel}</span>
            </div>
            {asset.secondaryLabels.map(l => (
              <div key={l} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sparkline */}
        {asset.sparkline7d.length > 2 && (
          <div style={{ padding: "8px 0 0", background: "rgba(0,0,0,0.2)" }}>
            <Sparkline data={asset.sparkline7d} color={biasColor} height={48} />
          </div>
        )}

        {/* Market metrics */}
        <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {[
            { label: "Market Cap",   value: fmt(asset.marketCap) },
            { label: "24h Volume",   value: fmt(asset.totalVolume) },
            { label: "24h High",     value: fmt(asset.high24h, asset.high24h < 1 ? 4 : 2) },
            { label: "24h Low",      value: fmt(asset.low24h,  asset.low24h  < 1 ? 4 : 2) },
            { label: "ATH",          value: fmt(asset.ath, asset.ath < 1 ? 4 : 2) },
            { label: "From ATH",     value: `${asset.distanceFromAth.toFixed(1)}%` },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.1em", marginBottom: "3px" }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "13px", color: "#94A3B8" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Intelligence vectors */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.15em", marginBottom: "8px" }}>SIGNAL VECTORS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {asset.vectors.map(v => (
              <SignalBar
                key={v.label}
                label={v.label}
                score={v.score}
                color={v.direction === "positive" ? "#00FF88" : v.direction === "negative" ? "#FF2D55" : "#00D4FF"}
              />
            ))}
          </div>
        </div>

        {/* Risk score + qualitative metrics */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <RiskGauge score={asset.riskScore} size={64} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { label: "Momentum",           value: asset.momentum,             color: asset.momentum === "Accelerating" ? "#00FF88" : asset.momentum === "Reversing" ? "#FF2D55" : "#00D4FF" },
                { label: "Macro Alignment",    value: asset.macroAlignment,       color: asset.macroAlignment === "Aligned" ? "#00FF88" : asset.macroAlignment === "Diverging" ? "#FF2D55" : "#00D4FF" },
                { label: "Liquidity Sensitivity", value: asset.liquiditySensitivity, color: asset.liquiditySensitivity === "Low" ? "#00FF88" : asset.liquiditySensitivity === "Extreme" ? "#FF2D55" : "#FFD700" },
                { label: "Speculative Intensity", value: asset.speculativeIntensity, color: asset.speculativeIntensity === "Low" ? "#00FF88" : asset.speculativeIntensity === "Extreme" ? "#FF2D55" : "#FFD700" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", padding: "5px 7px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.08em", marginBottom: "2px" }}>{label.toUpperCase()}</div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "11px", color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key insights */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.15em", marginBottom: "8px" }}>INTELLIGENCE INSIGHTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {asset.keyInsights.map((insight, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: biasColor, flexShrink: 0, marginTop: "3px" }}>{String(i + 1).padStart(2, "0")}</span>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>{insight}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "10px", padding: "8px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "4px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", lineHeight: 1.6, margin: 0 }}>{asset.regimeNote}</p>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", lineHeight: 1.5, margin: "10px 0 0", fontStyle: "italic" }}>
            Signal labels help assess conditions. FAULTLINE does not provide investment advice. Market conditions suggest caution — always conduct independent research.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CryptoSearch() {
  const [query, setQuery]           = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [searchInput, setSearchInput]   = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search suggestions
  const { data: suggestions, isFetching: isSearching } = trpc.crypto.search.useQuery(
    { query: searchInput },
    { enabled: searchInput.length >= 1, staleTime: 30_000, refetchOnWindowFocus: false }
  );

  // Asset intelligence
  const { data: intelligenceData, isLoading: isLoadingAsset, error: assetError, refetch: refetchAsset } =
    trpc.crypto.getAssetIntelligence.useQuery(
      { idOrSymbol: activeSymbol ?? "" },
      { enabled: !!activeSymbol, staleTime: 90_000, refetchOnWindowFocus: false }
    );

  // Systemic risk (always loaded)
  const { data: systemicRisk, isLoading: isLoadingRisk } = trpc.crypto.getSystemicRisk.useQuery(
    undefined,
    { staleTime: 3 * 60_000, refetchOnWindowFocus: false }
  );

  // Top markets for heatmap
  const { data: topMarkets, isLoading: isLoadingMarkets } = trpc.crypto.getTopMarkets.useQuery(
    { limit: 30 },
    { staleTime: 2 * 60_000, refetchOnWindowFocus: false }
  );

  // Global stats
  const { data: globalStats } = trpc.crypto.getGlobalStats.useQuery(
    undefined,
    { staleTime: 3 * 60_000, refetchOnWindowFocus: false }
  );

  const handleSearch = useCallback((symbol: string) => {
    setActiveSymbol(symbol.trim());
    setSearchInput("");
    setQuery(symbol.trim());
    setShowDropdown(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const riskColor = systemicRisk?.regimeColor ?? "#00D4FF";

  return (
    <div style={{ background: "#050608", minHeight: "100vh", color: "#F0F4FF", fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(160deg, #070910 0%, #0A0D14 50%, #050608 100%)",
        borderBottom: `1px solid ${riskColor}30`,
        padding: "20px 16px 16px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "500px", height: "200px", background: `radial-gradient(ellipse, ${riskColor}18 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="scanlines" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.2 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto" }}>
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Activity size={16} style={{ color: riskColor }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.2em" }}>DIGITAL ASSET INTELLIGENCE TERMINAL</span>
          </div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", color: "#F0F4FF", letterSpacing: "0.04em", lineHeight: 1.1, margin: "0 0 6px" }}>
            Crypto Intelligence
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#4B5563", lineHeight: 1.6, margin: "0 0 16px", maxWidth: "480px" }}>
            Analyze digital assets through the lens of liquidity, volatility, speculative pressure, AI narrative exposure, macroeconomic conditions, and systemic market risk.
          </p>

          {/* Global stats strip */}
          {globalStats && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
              {[
                { label: "Total Market Cap",  value: fmt(globalStats.totalMarketCap),                                                    color: globalStats.marketCapChangePercent24h >= 0 ? "#00FF88" : "#FF2D55" },
                { label: "24h Volume",        value: fmt(globalStats.totalVolume24h),                                                     color: "#00D4FF" },
                { label: "BTC Dominance",     value: `${globalStats.btcDominance.toFixed(1)}%`,                                           color: globalStats.btcDominance > 60 ? "#FF9500" : "#00D4FF" },
                { label: "Market Cap Δ 24h",  value: fmtPct(globalStats.marketCapChangePercent24h),                                       color: globalStats.marketCapChangePercent24h >= 0 ? "#00FF88" : "#FF2D55" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#374151", letterSpacing: "0.1em" }}>{label.toUpperCase()}</span>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div style={{ position: "relative" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(10,12,18,0.98)",
              border: `1px solid ${riskColor}40`,
              borderRadius: "6px",
              padding: "10px 14px",
              boxShadow: `0 0 20px ${riskColor}15`,
            }}>
              <Search size={14} style={{ color: riskColor, flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); setShowDropdown(true); }}
                onKeyDown={e => { if (e.key === "Enter" && searchInput.trim()) handleSearch(searchInput.trim()); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search any cryptocurrency — BTC, ETH, SOL, RNDR, SEI, HYPE..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  color: "#F0F4FF",
                  letterSpacing: "0.04em",
                }}
              />
              {isSearching && <div style={{ width: "12px", height: "12px", border: `2px solid ${riskColor}40`, borderTopColor: riskColor, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />}
              {searchInput && (
                <button onClick={() => { setSearchInput(""); setShowDropdown(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && suggestions && suggestions.length > 0 && (
              <div ref={dropdownRef} style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "rgba(8,10,16,0.99)",
                border: `1px solid ${riskColor}30`,
                borderRadius: "6px",
                zIndex: 100,
                overflow: "hidden",
                boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
              }}>
                {suggestions.map((coin, i) => (
                  <button
                    key={coin.id}
                    onClick={() => handleSearch(coin.symbol)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 14px",
                      background: "transparent",
                      border: "none",
                      borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {coin.thumb && <img src={coin.thumb} alt={coin.symbol} style={{ width: "20px", height: "20px", borderRadius: "50%" }} />}
                    <div>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: "#F0F4FF" }}>{coin.symbol}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151" }}>{coin.name}{coin.marketCapRank ? ` · #${coin.marketCapRank}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Example searches */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.1em", alignSelf: "center" }}>EXAMPLES:</span>
            {EXAMPLE_SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  color: "#64748B",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "3px",
                  padding: "3px 8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  letterSpacing: "0.06em",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = riskColor; e.currentTarget.style.borderColor = riskColor + "50"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#64748B"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "14px 16px 40px" }}>

        {/* Asset intelligence card */}
        {activeSymbol && (
          <div style={{ marginBottom: "14px" }}>
            {isLoadingAsset ? (
              <div style={{ background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "40px 20px", textAlign: "center" }}>
                <div style={{ width: "24px", height: "24px", border: `2px solid ${riskColor}30`, borderTopColor: riskColor, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.12em" }}>ANALYZING {activeSymbol.toUpperCase()}…</p>
              </div>
            ) : assetError ? (
              <div style={{ background: "rgba(255,45,85,0.05)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: "8px", padding: "20px", textAlign: "center" }}>
                <AlertTriangle size={16} style={{ color: "#FF2D55", marginBottom: "8px" }} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#FF2D55", margin: "0 0 8px" }}>Asset not found: {activeSymbol}</p>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#4B5563", margin: 0 }}>Try searching by full name or CoinGecko ID (e.g., "render-token" for RNDR)</p>
              </div>
            ) : intelligenceData ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", letterSpacing: "0.15em" }}>INTELLIGENCE CARD — {activeSymbol.toUpperCase()}</span>
                  <button
                    onClick={() => refetchAsset()}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: "4px", padding: "2px 6px" }}
                    onMouseEnter={e => (e.currentTarget.style.color = riskColor)}
                    onMouseLeave={e => (e.currentTarget.style.color = "#374151")}
                  >
                    <RefreshCw size={10} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.1em" }}>REFRESH</span>
                  </button>
                </div>
                <AssetCard asset={intelligenceData.asset} risk={intelligenceData.systemicRisk} />
              </div>
            ) : null}
          </div>
        )}

        {/* Systemic risk panel */}
        {systemicRisk && !isLoadingRisk && (
          <div style={{ marginBottom: "14px" }}>
            <SystemicRiskPanel risk={systemicRisk} />
          </div>
        )}

        {/* Market heatmap */}
        <div style={{ background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "14px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <BarChart2 size={12} style={{ color: "#00D4FF" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.15em" }}>MARKET HEATMAP — TOP 30 BY MARKET CAP</span>
          </div>
          {isLoadingMarkets ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
              <div style={{ width: "16px", height: "16px", border: "2px solid rgba(0,212,255,0.2)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : topMarkets && topMarkets.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: "4px" }}>
              {topMarkets.map(coin => (
                <div key={coin.id} onClick={() => handleSearch(coin.symbol)} style={{ cursor: "pointer" }}>
                  <HeatCell
                    symbol={coin.symbol}
                    change={coin.priceChangePercent24h}
                    price={coin.currentPrice}
                    rank={coin.marketCapRank}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", textAlign: "center", padding: "20px 0" }}>Market data loading…</p>
          )}
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", margin: "8px 0 0", textAlign: "center" }}>Click any asset to load its intelligence card</p>
        </div>

        {/* Feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
          {[
            { icon: <Zap size={12} />,      color: "#FF9500", title: "Speculative Pressure",     body: "Signals may indicate when speculative intensity is accelerating or decelerating across digital asset markets." },
            { icon: <Shield size={12} />,   color: "#FF2D55", title: "Systemic Risk Engine",     body: "FAULTLINE integrates BTC dominance, stablecoin liquidity, volatility regimes, and macro conditions into a 0–10 risk score." },
            { icon: <Activity size={12} />, color: "#00D4FF", title: "Macro Correlation",        body: "Crypto does not move in isolation. FAULTLINE connects digital asset signals to Fed policy, dollar strength, and liquidity cycles." },
            { icon: <BarChart2 size={12} />,color: "#00FF88", title: "Momentum Intelligence",   body: "Track momentum breakouts, reversals, and neutral regimes across Bitcoin, Ethereum, Solana, and emerging digital assets." },
            { icon: <Zap size={12} />,      color: "#00D4FF", title: "AI Narrative Exposure",   body: "Identify tokens with elevated AI narrative exposure — RNDR, FET, GRT, INJ — and assess speculative conditions." },
            { icon: <Shield size={12} />,   color: "#FFD700", title: "Liquidity Fragility",     body: "Monitor stablecoin supply, exchange flows, and volume/market cap ratios to assess liquidity conditions before the crowd reacts." },
          ].map(({ icon, color, title, body }) => (
            <div key={title} style={{ background: "rgba(10,12,18,0.98)", border: `1px solid ${color}18`, borderLeft: `2px solid ${color}`, borderRadius: "6px", padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color }}>
                {icon}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color }}>{title.toUpperCase()}</span>
              </div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#4B5563", lineHeight: 1.6, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "4px", padding: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#1F2937", lineHeight: 1.7, margin: 0, textAlign: "center" }}>
            FAULTLINE integrates digital assets into its broader market intelligence framework. Signal labels help assess conditions — they do not constitute investment advice. Market conditions suggest caution; always conduct independent research. Past signals do not guarantee future performance.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
