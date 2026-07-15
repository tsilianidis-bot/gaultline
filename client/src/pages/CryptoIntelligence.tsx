/* ============================================================
   FAULTLINE — Crypto Intelligence™
   Institutional-grade digital asset risk, liquidity,
   momentum, and macro correlation intelligence.
   ============================================================ */
import { useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRegisterAshaContext } from "@/contexts/AshaContext";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import type {
  CryptoAssetSignal,
  CryptoSignal,
  CryptoRisk,
  MomentumDir,
  AccumulationPhaseAnalysis,
} from "../../../server/cryptoIntelligence";
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";

// ── Colour helpers ────────────────────────────────────────────

function signalColor(s: CryptoSignal) {
  if (s === "Bullish") return "text-cyan-400";
  if (s === "Bearish") return "text-red-400";
  return "text-amber-400";
}
function signalBg(s: CryptoSignal) {
  if (s === "Bullish") return "bg-cyan-500/15 border-cyan-500/40 text-cyan-300";
  if (s === "Bearish") return "bg-red-500/15 border-red-500/40 text-red-300";
  return "bg-amber-500/15 border-amber-500/40 text-amber-300";
}
function riskColor(r: CryptoRisk) {
  if (r === "Critical") return "text-red-400";
  if (r === "High")     return "text-orange-400";
  if (r === "Elevated") return "text-amber-400";
  if (r === "Moderate") return "text-yellow-400";
  return "text-emerald-400";
}
function riskBg(r: CryptoRisk) {
  if (r === "Critical") return "bg-red-500/15 border-red-500/40 text-red-300";
  if (r === "High")     return "bg-orange-500/15 border-orange-500/40 text-orange-300";
  if (r === "Elevated") return "bg-amber-500/15 border-amber-500/40 text-amber-300";
  if (r === "Moderate") return "bg-yellow-500/15 border-yellow-500/40 text-yellow-300";
  return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
}
function momentumIcon(m: MomentumDir) {
  if (m === "Accelerating") return "↑↑";
  if (m === "Stable")       return "→";
  if (m === "Decelerating") return "↓";
  return "↓↓";
}
function momentumColor(m: MomentumDir) {
  if (m === "Accelerating") return "text-cyan-400";
  if (m === "Stable")       return "text-slate-400";
  if (m === "Decelerating") return "text-amber-400";
  return "text-red-400";
}
function scoreBar(score: number, color = "bg-cyan-500") {
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(2, score)}%` }}
      />
    </div>
  );
}

// ── Accumulation Phase Panel ─────────────────────────────────
// Rendered when BTC cycle phase === "Bear Market → Accumulation Phase".
// Displays the full structured response: direct answer, confidence,
// key evidence, bull confirmation, invalidation, trading bias.

function AccumulationPhasePanel({ analysis }: { analysis: AccumulationPhaseAnalysis }) {
  const confColor = analysis.confidenceLevel >= 70
    ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/8"
    : analysis.confidenceLevel >= 55
    ? "text-amber-400 border-amber-500/40 bg-amber-500/8"
    : "text-slate-400 border-slate-500/40 bg-slate-500/8";

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/6 via-transparent to-transparent p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-amber-400 mb-1 tracking-wider">BITCOIN CYCLE INTELLIGENCE</div>
          <div className="text-lg font-black text-white">Bear Market → Accumulation Phase</div>
        </div>
        <span className={`text-xs font-mono px-3 py-1.5 rounded-full border ${confColor} self-start sm:self-auto`}>
          {analysis.confidenceLabel} Confidence — {analysis.confidenceLevel}%
        </span>
      </div>

      {/* Direct Answer */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <div className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider">FAULTLINE Assessment</div>
        <p className="text-base font-semibold text-white leading-relaxed">{analysis.directAnswer}</p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          BTC may be forming a base, but a new bull cycle is not confirmed until price breaks major resistance
          with strong volume, improving liquidity, and sustained risk-on confirmation.
        </p>
      </div>

      {/* Key Evidence */}
      <div>
        <div className="text-xs font-mono text-slate-500 mb-3 uppercase tracking-wider">Key Evidence</div>
        <ul className="space-y-2">
          {analysis.keyEvidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-amber-400 mt-0.5 shrink-0">▸</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Two-column: Confirmation vs Invalidation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-xs font-mono text-emerald-400 mb-3 uppercase tracking-wider">Bull Cycle Confirmation</div>
          <ul className="space-y-2">
            {analysis.bullCycleConfirmation.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="text-xs font-mono text-red-400 mb-3 uppercase tracking-wider">Invalidation Signals</div>
          <ul className="space-y-2">
            {analysis.invalidationSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trading Bias */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
        <div className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider">Actionable Trading Bias</div>
        <p className="text-sm text-slate-300 leading-relaxed">{analysis.tradingBias}</p>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 leading-relaxed">{analysis.disclaimer}</p>
    </div>
  );
}

// ── Crypto asset icons (SVG inline) ──────────────────────────

function BtcIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A" opacity="0.15"/>
      <path d="M21.5 13.5c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.6 2.6-1.3-.3.6-2.6-1.6-.4-.7 2.7-2.6-.6-.4 1.7s1.2.3 1.1.3c.6.2.7.6.7.9l-1.7 6.8c-.1.2-.3.5-.7.4 0 0-1.1-.3-1.1-.3l-.8 1.8 2.5.6 1.4.4-.7 2.7 1.6.4.7-2.7 1.3.3-.7 2.7 1.6.4.7-2.7c2.7.5 4.7.3 5.5-2.1.7-2-.1-3.1-1.4-3.8.9-.2 1.6-.8 1.8-2zm-3.2 4.5c-.5 2-3.8 1-4.9.7l.9-3.5c1.1.3 4.5.8 4 2.8zm.5-4.5c-.4 1.8-3.2.9-4.1.7l.8-3.1c.9.2 3.8.7 3.3 2.4z" fill="#F7931A"/>
    </svg>
  );
}
function EthIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#627EEA" opacity="0.15"/>
      <path d="M16 5l-.1.4v14.7l.1.1 6.5-3.8L16 5z" fill="#627EEA" opacity="0.6"/>
      <path d="M16 5L9.5 16.4l6.5 3.8V5z" fill="#627EEA"/>
      <path d="M16 21.5l-.1.1v4.9l.1.3 6.5-9.2L16 21.5z" fill="#627EEA" opacity="0.6"/>
      <path d="M16 26.8v-5.3l-6.5-3.9L16 26.8z" fill="#627EEA"/>
    </svg>
  );
}
function SolIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#9945FF" opacity="0.15"/>
      <path d="M8 21.5h12.5l3.5-3H11.5L8 21.5zM8 16h12.5l3.5-3H11.5L8 16zM11.5 10.5H24L20.5 7.5H8L11.5 10.5z" fill="#9945FF"/>
    </svg>
  );
}
function CryptoIcon({ ticker, size = 20 }: { ticker: string; size?: number }) {
  if (ticker === "BTC")    return <BtcIcon size={size} />;
  if (ticker === "ETH")    return <EthIcon size={size} />;
  if (ticker === "SOL")    return <SolIcon size={size} />;
  if (ticker === "TOTAL")  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-blue-500/15 flex items-center justify-center">
      <span className="text-blue-400 font-mono" style={{ fontSize: size * 0.35 }}>Σ</span>
    </div>
  );
  if (ticker === "ALT")    return (
    <div style={{ width: size, height: size }} className="rounded-full bg-purple-500/15 flex items-center justify-center">
      <span className="text-purple-400 font-mono" style={{ fontSize: size * 0.35 }}>ALT</span>
    </div>
  );
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-emerald-500/15 flex items-center justify-center">
      <span className="text-emerald-400 font-mono" style={{ fontSize: size * 0.35 }}>$</span>
    </div>
  );
}

// ── Animated liquidity wave canvas ───────────────────────────

function LiquidityWave({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let raf: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const amplitude = (score / 100) * (h * 0.35);
      const color = score > 60 ? "rgba(34,211,238," : score > 40 ? "rgba(251,191,36," : "rgba(239,68,68,";
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        const speed = 0.02 + layer * 0.008;
        const phase = frame * speed + layer * Math.PI * 0.6;
        const yBase = h * 0.5 + layer * 4;
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= w; x += 2) {
          const y = yBase + Math.sin(x * 0.025 + phase) * amplitude * (1 - layer * 0.2);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const opacity = (0.25 - layer * 0.07).toFixed(2);
        ctx.fillStyle = `${color}${opacity})`;
        ctx.fill();
      }
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [score]);
  return <canvas ref={canvasRef} width={280} height={60} className="w-full h-12 rounded" />;
}

// ── Risk gauge ────────────────────────────────────────────────

function RiskGauge({ score, label }: { score: number; label: string }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 80 ? "#ef4444" : score >= 65 ? "#f97316" : score >= 45 ? "#f59e0b" : score >= 25 ? "#eab308" : "#10b981";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="50" viewBox="0 0 80 50">
        <path d="M10 45 A30 30 0 0 1 70 45" stroke="#ffffff10" strokeWidth="6" fill="none" strokeLinecap="round"/>
        <path d="M10 45 A30 30 0 0 1 70 45" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 94.25} 94.25`} style={{ transition: "stroke-dasharray 1s ease" }}/>
        <g transform={`translate(40,45) rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2="-22" stroke={color} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="0" cy="0" r="3" fill={color}/>
        </g>
        <text x="40" y="48" textAnchor="middle" fill={color} fontSize="10" fontFamily="monospace" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-xs text-slate-400 font-mono">{label}</span>
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────

function CryptoSignalCard({ asset }: { asset: CryptoAssetSignal }) {
  return (
    <div className="relative rounded-xl border border-white/8 bg-gradient-to-b from-white/4 to-transparent p-4 hover:border-cyan-500/30 transition-all duration-300 group overflow-hidden">
      {/* Glow on hover */}
      <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
        asset.signal === "Bullish" ? "bg-cyan-500/5" : asset.signal === "Bearish" ? "bg-red-500/5" : "bg-amber-500/5"
      }`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <CryptoIcon ticker={asset.ticker} size={28} />
          <div>
            <div className="text-sm font-bold text-white font-mono tracking-wide">{asset.ticker}</div>
            <div className="text-xs text-slate-500">{asset.name}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${signalBg(asset.signal)}`}>
            {asset.signal.toUpperCase()}
          </span>
          <span className={`text-xs font-mono ${momentumColor(asset.momentum)}`}>
            {momentumIcon(asset.momentum)} {asset.momentum}
          </span>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Signal Strength</span>
            <span className={signalColor(asset.signal)}>{asset.signalScore}/100</span>
          </div>
          {scoreBar(asset.signalScore, asset.signal === "Bullish" ? "bg-cyan-500" : asset.signal === "Bearish" ? "bg-red-500" : "bg-amber-500")}
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Risk Level</span>
            <span className={riskColor(asset.risk)}>{asset.risk}</span>
          </div>
          {scoreBar(asset.riskScore, asset.risk === "Critical" || asset.risk === "High" ? "bg-red-500" : asset.risk === "Elevated" ? "bg-orange-500" : "bg-emerald-500")}
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{asset.explanation}</p>

      {/* Key drivers */}
      <div className="space-y-1">
        {asset.keyDrivers.slice(0, 2).map((d, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
            <span className="text-cyan-600 mt-0.5 shrink-0">›</span>
            <span>{d}</span>
          </div>
        ))}
      </div>

      {/* Macro alignment badge */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-slate-600">Macro Alignment</span>
        <span className={`text-xs font-mono ${
          asset.macroAlignment === "Aligned" ? "text-cyan-400" :
          asset.macroAlignment === "Diverging" ? "text-red-400" : "text-slate-400"
        }`}>{asset.macroAlignment}</span>
      </div>
    </div>
  );
}

// ── BTC macro metric tile ─────────────────────────────────────

function BtcMetricTile({
  label, score, sublabel, note, direction, colorClass,
}: {
  label: string;
  score: number;
  sublabel: string;
  note: string;
  direction: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-gradient-to-b from-white/4 to-transparent p-4 hover:border-cyan-500/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-bold font-mono ${colorClass}`}>{sublabel}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-2xl font-bold font-mono ${colorClass}`}>{score}</span>
        <span className="text-slate-600 text-sm">/100</span>
        <span className={`text-sm ${colorClass} ml-auto`}>{direction}</span>
      </div>
      {scoreBar(score, score >= 60 ? "bg-cyan-500" : score >= 40 ? "bg-amber-500" : "bg-red-500")}
      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{note}</p>
    </div>
  );
}

// ── Macro correlation row ─────────────────────────────────────

function CorrelationRow({ label, signal, note }: { label: string; signal: CryptoSignal; note: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-32 shrink-0">
        <span className="text-xs font-mono text-slate-400">{label}</span>
      </div>
      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border shrink-0 ${signalBg(signal)}`}>
        {signal.toUpperCase()}
      </span>
      <p className="text-xs text-slate-500 leading-relaxed">{note}</p>
    </div>
  );
}

// ── Portfolio action card ─────────────────────────────────────

function ActionCard({
  asset, action, condition, note,
}: {
  asset: string;
  action: string;
  condition: string;
  note: string;
}) {
  const actionColor =
    action === "Add" || action === "Selective Add" ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" :
    action === "Hold" ? "text-slate-300 border-slate-500/40 bg-slate-500/10" :
    action === "Trim" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
    action.includes("Reduce") ? "text-orange-400 border-orange-500/40 bg-orange-500/10" :
    "text-red-400 border-red-500/40 bg-red-500/10";

  return (
    <div className="rounded-xl border border-white/8 bg-gradient-to-b from-white/4 to-transparent p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-white font-mono">{asset}</span>
        <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded border ${actionColor}`}>
          {action.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{condition}</p>
      <p className="text-xs text-slate-600 italic">{note}</p>
    </div>
  );
}

// ── Error display ───────────────────────────────────────────
function CryptoErrorDisplay({ errMsg, onRetry }: { errMsg: string; onRetry: () => void }) {
  const isRateLimit = errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("too many");
  const isTimeout = errMsg.includes("timeout") || errMsg.includes("TIMEOUT");
  const isMarketData = errMsg.includes("CoinGecko") || errMsg.includes("market data");
  const displayMsg = isRateLimit
    ? "Rate limit reached — CoinGecko API is temporarily throttled. Please wait and retry."
    : isTimeout
    ? "AI analysis timeout — market data is available but AI is temporarily slow."
    : isMarketData
    ? "Market data unavailable — CoinGecko API may be temporarily down."
    : "Crypto signal data temporarily unavailable — please retry.";
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <p className="text-red-400 text-sm font-mono">{displayMsg}</p>
      {errMsg && <p className="text-red-400/50 text-xs font-mono mt-1">{errMsg.slice(0, 100)}</p>}
      <button onClick={onRetry} className="mt-3 text-xs text-red-300 underline">Retry</button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded ${className}`} />;
}

// ── Main page ─────────────────────────────────────────────────

function CryptoIntelligenceInner() {
  useSEO(PAGE_SEO.crypto);
  const { data, isLoading, error, refetch } = trpc.crypto.getSignals.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Register ASHA page context
  useRegisterAshaContext({
    page: "crypto",
    pressureScore: data?.pressureIndex,
    regime: data?.regime,
    keyDrivers: data?.signals?.slice(0, 3).map(s => `${s.ticker}: ${s.signal} (${s.signalScore})`),
    additionalContext: {
      btcSignal: data?.btcDashboard?.overallBtcBias,
      altcoinRisk: data?.altcoinRisk?.overallRisk,
    },
  });

  const pressureLabel = useMemo(() => {
    const p = data?.pressureIndex ?? 0;
    if (p >= 80) return { label: "CRITICAL", color: "text-red-400" };
    if (p >= 65) return { label: "HIGH STRESS", color: "text-orange-400" };
    if (p >= 45) return { label: "ELEVATED", color: "text-amber-400" };
    if (p >= 25) return { label: "MODERATE", color: "text-yellow-400" };
    return { label: "LOW", color: "text-emerald-400" };
  }, [data?.pressureIndex]);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-white/6">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.04)_0%,transparent_60%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 rounded">
              CRYPTO INTELLIGENCE™
            </span>
            <span className="text-xs font-mono text-slate-500">FAULTLINE INTELLIGENCE LAYER</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3 leading-tight">
            <span className="text-white">Crypto moves first</span>
            <br />
            <span className="text-cyan-400">when liquidity changes.</span>
          </h1>
          <p className="text-lg text-cyan-300/80 font-light mb-2">
            FAULTLINE is built to detect the shift.
          </p>
          <p className="text-sm text-slate-400 max-w-2xl mb-6">
            Track digital asset risk, liquidity, momentum, and macro correlation before the crowd reacts.
            FAULTLINE connects crypto signals to Federal Reserve policy, interest rates, dollar strength,
            and liquidity cycles — in real time.
          </p>

          {/* Tagline strip */}
          <div className="flex flex-wrap gap-2 mb-8">
            {["Macro", "Stocks", "Crypto", "Liquidity", "Systemic Risk"].map(tag => (
              <span key={tag} className="text-xs font-mono text-slate-400 border border-white/10 px-2.5 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>

          {/* Live pressure indicator */}
          {data && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-slate-400">FAULTLINE PRESSURE</span>
                <span className={`font-bold ${pressureLabel.color}`}>
                  {data.pressureIndex.toFixed(0)}/100 — {pressureLabel.label}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">REGIME: <span className="text-slate-300">{data.regime}</span></span>
              {data.cached && <span className="text-slate-600">CACHED</span>}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-16">

        {/* ── BLOCK 1: Crypto Market Signals ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black tracking-tight text-white font-mono">
                CRYPTO MARKET SIGNALS
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Six key digital asset signals assessed against FAULTLINE macro conditions.
                Signals may indicate directional bias — not price predictions.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded hover:bg-cyan-500/10 transition-colors"
            >
              ↻ REFRESH
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : error ? (
            <CryptoErrorDisplay errMsg={error?.message ?? ""} onRetry={() => refetch()} />
          ) : data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.signals.map(asset => (
                <CryptoSignalCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : null}
        </section>

        {/* ── BLOCK 2: Bitcoin Macro Dashboard ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-black tracking-tight text-white font-mono">
              BITCOIN MACRO DASHBOARD
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Six macro-derived indicators that historically correlate with Bitcoin market conditions.
              Conditions suggest — not predict — directional bias.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Cycle phase + overall bias hero */}
              <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-transparent p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs font-mono text-cyan-400 mb-1">MARKET CYCLE PHASE</div>
                    <div className="text-2xl font-black text-white">{data.btcDashboard.marketCyclePhase.phase}</div>
                    <div className="text-xs text-slate-400 mt-1">{data.btcDashboard.marketCyclePhase.note}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <RiskGauge score={data.btcDashboard.marketCyclePhase.confidence} label="Confidence" />
                    <div className="text-center">
                      <div className="text-xs font-mono text-slate-500 mb-1">OVERALL BIAS</div>
                      <span className={`text-lg font-black font-mono ${signalColor(data.btcDashboard.overallBtcBias)}`}>
                        {data.btcDashboard.overallBtcBias.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Liquidity wave */}
                <div className="mb-3">
                  <div className="text-xs font-mono text-slate-500 mb-1">LIQUIDITY CONDITIONS WAVE</div>
                  <LiquidityWave score={data.btcDashboard.liquidityConditions.score} />
                </div>
                {/* AI narrative */}
                {data.btcDashboard.aiNarrative && (
                  <p className="text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4 mt-2 italic">
                    "{data.btcDashboard.aiNarrative}"
                  </p>
                )}
              </div>

              {/* Bear Market → Accumulation Phase: structured intelligence panel */}
              {data.btcDashboard.accumulationAnalysis && (
                <AccumulationPhasePanel analysis={data.btcDashboard.accumulationAnalysis} />
              )}

              {/* 6 metric tiles */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <BtcMetricTile
                  label="Trend Strength"
                  score={data.btcDashboard.trendStrength.score}
                  sublabel={data.btcDashboard.trendStrength.label}
                  note={data.btcDashboard.trendStrength.note}
                  direction={data.btcDashboard.trendStrength.direction === "up" ? "↑" : data.btcDashboard.trendStrength.direction === "down" ? "↓" : "→"}
                  colorClass={data.btcDashboard.trendStrength.score >= 60 ? "text-cyan-400" : data.btcDashboard.trendStrength.score >= 40 ? "text-amber-400" : "text-red-400"}
                />
                <BtcMetricTile
                  label="Liquidity"
                  score={data.btcDashboard.liquidityConditions.score}
                  sublabel={data.btcDashboard.liquidityConditions.label}
                  note={data.btcDashboard.liquidityConditions.note}
                  direction={data.btcDashboard.liquidityConditions.direction === "expanding" ? "↑" : data.btcDashboard.liquidityConditions.direction === "contracting" ? "↓" : "→"}
                  colorClass={data.btcDashboard.liquidityConditions.score >= 60 ? "text-cyan-400" : data.btcDashboard.liquidityConditions.score >= 40 ? "text-amber-400" : "text-red-400"}
                />
                <BtcMetricTile
                  label="Dollar Pressure"
                  score={data.btcDashboard.dollarPressure.score}
                  sublabel={data.btcDashboard.dollarPressure.label}
                  note={data.btcDashboard.dollarPressure.note}
                  direction={data.btcDashboard.dollarPressure.direction === "strengthening" ? "↑" : data.btcDashboard.dollarPressure.direction === "weakening" ? "↓" : "→"}
                  colorClass={data.btcDashboard.dollarPressure.score >= 60 ? "text-orange-400" : data.btcDashboard.dollarPressure.score >= 40 ? "text-amber-400" : "text-emerald-400"}
                />
                <BtcMetricTile
                  label="Yield Pressure"
                  score={data.btcDashboard.yieldPressure.score}
                  sublabel={data.btcDashboard.yieldPressure.label}
                  note={data.btcDashboard.yieldPressure.note}
                  direction={data.btcDashboard.yieldPressure.direction === "rising" ? "↑" : data.btcDashboard.yieldPressure.direction === "falling" ? "↓" : "→"}
                  colorClass={data.btcDashboard.yieldPressure.score >= 60 ? "text-red-400" : data.btcDashboard.yieldPressure.score >= 40 ? "text-amber-400" : "text-emerald-400"}
                />
                <BtcMetricTile
                  label="ETF / Inst. Flow"
                  score={data.btcDashboard.etfInstitutionalFlow.score}
                  sublabel={data.btcDashboard.etfInstitutionalFlow.label}
                  note={data.btcDashboard.etfInstitutionalFlow.note}
                  direction={data.btcDashboard.etfInstitutionalFlow.direction === "inflow" ? "↑" : data.btcDashboard.etfInstitutionalFlow.direction === "outflow" ? "↓" : "→"}
                  colorClass={data.btcDashboard.etfInstitutionalFlow.score >= 60 ? "text-cyan-400" : data.btcDashboard.etfInstitutionalFlow.score >= 40 ? "text-amber-400" : "text-red-400"}
                />
                {/* Cycle phase tile */}
                <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-500/8 to-transparent p-4">
                  <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Cycle Phase</div>
                  <div className="text-sm font-bold text-purple-300 mb-1">{data.btcDashboard.marketCyclePhase.phase}</div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-slate-500">Confidence:</span>
                    <span className="text-xs font-mono text-purple-400">{data.btcDashboard.marketCyclePhase.confidence}%</span>
                  </div>
                  {scoreBar(data.btcDashboard.marketCyclePhase.confidence, "bg-purple-500")}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* ── BLOCK 3: Altcoin Risk Engine ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-black tracking-tight text-white font-mono">
              ALTCOIN RISK ENGINE
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              FAULTLINE helps identify when macro conditions are historically favorable or dangerous
              for altcoin exposure. Signals may indicate risk levels — not individual asset performance.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-64" />
          ) : data ? (
            <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/4 to-transparent p-6">
              {/* Header row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-2xl font-black font-mono ${riskColor(data.altcoinRisk.overallRisk)}`}>
                      {data.altcoinRisk.overallRisk.toUpperCase()} RISK
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${riskBg(data.altcoinRisk.overallRisk)}`}>
                      {data.altcoinRisk.riskScore}/100
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 max-w-lg">{data.altcoinRisk.recommendation}</p>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-xs font-mono text-slate-500 mb-1">ALTCOIN SEASON PROBABILITY</div>
                  <div className="text-3xl font-black text-purple-400 font-mono">
                    {data.altcoinRisk.altcoinSeasonProbability}%
                  </div>
                  {scoreBar(data.altcoinRisk.altcoinSeasonProbability, "bg-purple-500")}
                </div>
              </div>

              {/* 6 risk factor rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "BTC Dominance", text: data.altcoinRisk.btcDominanceSignal },
                  { label: "Liquidity", text: data.altcoinRisk.liquiditySignal },
                  { label: "Stablecoin Supply", text: data.altcoinRisk.stablecoinSignal },
                  { label: "Risk-On / Risk-Off", text: data.altcoinRisk.riskOnOffSignal },
                  { label: "Macro Pressure", text: data.altcoinRisk.macroPressureSignal },
                  { label: "Volatility", text: data.altcoinRisk.volatilitySignal },
                ].map(({ label, text }) => (
                  <div key={label} className="flex items-start gap-2 p-3 rounded-lg bg-white/3 border border-white/5">
                    <span className="text-cyan-600 shrink-0 mt-0.5">▸</span>
                    <div>
                      <span className="text-xs font-mono text-slate-400">{label}: </span>
                      <span className="text-xs text-slate-500">{text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ── BLOCK 4: Crypto + Macro Correlation ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-black tracking-tight text-white font-mono">
              CRYPTO + MACRO CORRELATION
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Crypto does not move in isolation. FAULTLINE connects digital asset signals to the
              macro forces that historically drive liquidity cycles and risk appetite.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-80" />
          ) : data ? (
            <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/4 to-transparent p-6">
              {/* Overall signal */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div>
                  <div className="text-xs font-mono text-slate-500 mb-1">OVERALL MACRO SIGNAL</div>
                  <span className={`text-xl font-black font-mono ${signalColor(data.macroCorrelation.overallMacroSignal)}`}>
                    {data.macroCorrelation.overallMacroSignal.toUpperCase()}
                  </span>
                </div>
                <div className="max-w-md text-right">
                  <p className="text-xs text-slate-400 italic">{data.macroCorrelation.correlationSummary}</p>
                </div>
              </div>

              {/* Correlation rows */}
              <div>
                <CorrelationRow label="Federal Reserve" signal={data.macroCorrelation.fedPolicyImpact.signal} note={data.macroCorrelation.fedPolicyImpact.note} />
                <CorrelationRow label="Interest Rates" signal={data.macroCorrelation.interestRateImpact.signal} note={data.macroCorrelation.interestRateImpact.note} />
                <CorrelationRow label="Dollar Strength" signal={data.macroCorrelation.dollarStrength.signal} note={data.macroCorrelation.dollarStrength.note} />
                <CorrelationRow label="Liquidity Cycle" signal={data.macroCorrelation.liquidityCycle.signal} note={data.macroCorrelation.liquidityCycle.note} />
                <CorrelationRow label="Equity Risk" signal={data.macroCorrelation.equityRiskAppetite.signal} note={data.macroCorrelation.equityRiskAppetite.note} />
                <CorrelationRow label="Bond Stress" signal={data.macroCorrelation.bondMarketStress.signal} note={data.macroCorrelation.bondMarketStress.note} />
              </div>
            </div>
          ) : null}
        </section>

        {/* ── BLOCK 5: Portfolio Action Guidance ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-black tracking-tight text-white font-mono">
              PORTFOLIO ACTION GUIDANCE
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              FAULTLINE helps assess macro conditions relative to crypto portfolio positioning.
              Guidance reflects current macro signals — not financial advice.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ActionCard
                  asset="Bitcoin (BTC)"
                  action={data.portfolioGuidance.btcGuidance.action}
                  condition={data.portfolioGuidance.btcGuidance.condition}
                  note={data.portfolioGuidance.btcGuidance.note}
                />
                <ActionCard
                  asset="Ethereum (ETH)"
                  action={data.portfolioGuidance.ethGuidance.action}
                  condition={data.portfolioGuidance.ethGuidance.condition}
                  note={data.portfolioGuidance.ethGuidance.note}
                />
                <ActionCard
                  asset="Altcoins"
                  action={data.portfolioGuidance.altGuidance.action}
                  condition={data.portfolioGuidance.altGuidance.condition}
                  note={data.portfolioGuidance.altGuidance.note}
                />
                <ActionCard
                  asset="Stablecoins / Cash"
                  action={data.portfolioGuidance.stableGuidance.action}
                  condition={data.portfolioGuidance.stableGuidance.condition}
                  note={data.portfolioGuidance.stableGuidance.note}
                />
              </div>

              {/* Overall bias */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="text-xs font-mono text-cyan-400 mb-1">OVERALL PORTFOLIO BIAS</div>
                <p className="text-sm text-slate-300">{data.portfolioGuidance.overallBias}</p>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-slate-600 italic text-center px-4">
                {data.portfolioGuidance.disclaimer}
              </p>
            </div>
          ) : null}
        </section>

        {/* ASHA Crypto Risk Brief */}
        <section className="mb-8">
          <AshaIntelligenceBrief variant="crypto-brief" />
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 via-transparent to-orange-500/5 p-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative">
            <div className="text-xs font-mono text-cyan-400 mb-3">EARLY ACCESS</div>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">
              One intelligence dashboard.
              <br />
              <span className="text-cyan-400">Every market signal.</span>
            </h3>
            <p className="text-slate-400 text-sm max-w-xl mx-auto mb-6">
              Join early access and track crypto, stocks, macro risk, and systemic pressure
              from one intelligence dashboard. FAULTLINE is built for investors who want
              to see the shift before it happens.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Macro", "Stocks", "Crypto", "Liquidity", "Systemic Risk"].map(tag => (
                <span key={tag} className="text-xs font-mono text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function CryptoIntelligence() {
  return (
    <PremiumGateFull variant="crypto">
      <CryptoIntelligenceInner />
    </PremiumGateFull>
  );
}
