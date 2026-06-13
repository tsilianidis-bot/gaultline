import DisclaimerBanner from "@/components/DisclaimerBanner";
import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO } from "@/hooks/useSEO";

// ── Types (mirrored from server) ──────────────────────────────
interface SectorCoin {
  id: string; symbol: string; name: string;
  price: number; change24h: number; change7d: number;
  marketCap: number; volume24h: number;
  momentum: "strong" | "moderate" | "weak" | "negative";
}
interface SectorData {
  name: string; key: string; coins: SectorCoin[];
  avgChange24h: number; avgChange7d: number;
  momentum: "strong" | "moderate" | "weak" | "negative";
  alert: string | null; score: number; color: string;
}
interface RotationAlert {
  id: string; type: string; severity: "high" | "medium" | "low";
  title: string; body: string; timestamp: number;
}
interface AltRotationPayload {
  score: number; regime: string;
  regimeKey: "btc_dominance" | "early_rotation" | "selective_expansion" | "broad_altseason" | "speculative_mania";
  regimeColor: string;
  btcDominance: { current: number; trend: string; velocity: number; pressure: string; signal: string; score: number };
  ethLeadership: { ethBtcRatio: number; ethChange24h: number; btcChange24h: number; relativePerformance: number; status: string; label: string; trend: string; score: number };
  stablecoinLiquidity: { usdtMarketCap: number; usdcMarketCap: number; totalStablecoinCap: number; usdtChange24h: number; usdcChange24h: number; combinedChange24h: number; status: string; label: string; score: number };
  sectors: SectorData[];
  marketBreadth: { total2Proxy: number; total3Proxy: number; altcoinDominance: number; breadthSignal: string; score: number };
  alerts: RotationAlert[];
  aiCommentary: string;
  scoreBreakdown: { label: string; weight: number; rawScore: number; contribution: number }[];
  fetchedAt: number; dataSource: string;
}

// ── Animated Arc Gauge ────────────────────────────────────────
function ArcGauge({ score, color, regime }: { score: number; color: string; regime: string }) {
  const [displayScore, setDisplayScore] = useState(0);
  const [arcProgress, setArcProgress] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 2200;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeOut(t);
      setDisplayScore(Math.round(eased * score));
      setArcProgress(eased * score);
      if (t < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score]);

  // SVG arc math
  const cx = 160, cy = 160, r = 120;
  const startAngle = -210; // degrees
  const totalArc = 240;   // degrees
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcAngle = (arcProgress / 100) * totalArc + startAngle;

  const describeArc = (start: number, end: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)), y: cy + r * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  // Tick marks
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const pct = i / 20;
    const angle = startAngle + pct * totalArc;
    const inner = r - 12;
    const outer = r + 4;
    const x1 = cx + inner * Math.cos(toRad(angle));
    const y1 = cy + inner * Math.sin(toRad(angle));
    const x2 = cx + outer * Math.cos(toRad(angle));
    const y2 = cy + outer * Math.sin(toRad(angle));
    const lit = pct * 100 <= arcProgress;
    return { x1, y1, x2, y2, lit, major: i % 5 === 0 };
  });

  // Needle tip
  const needleAngle = arcAngle;
  const needleLen = r - 18;
  const nx = cx + needleLen * Math.cos(toRad(needleAngle));
  const ny = cy + needleLen * Math.sin(toRad(needleAngle));

  return (
    <div className="flex flex-col items-center">
      <svg width="320" height="280" viewBox="0 0 320 280" style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id="gaugeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx={cx} cy={cy} r={140} fill="url(#gaugeGlow)" />

        {/* Track */}
        <path d={describeArc(startAngle, startAngle + totalArc)}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />

        {/* Active arc */}
        <path d={describeArc(startAngle, arcAngle)}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          filter="url(#glowFilter)"
          style={{ transition: "none" }} />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.lit ? color : "rgba(255,255,255,0.12)"}
            strokeWidth={t.major ? 2 : 1}
            opacity={t.lit ? (t.major ? 1 : 0.7) : 0.3} />
        ))}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={color} strokeWidth="2" strokeLinecap="round"
          filter="url(#glowFilter)" />
        <circle cx={nx} cy={ny} r="4" fill={color} filter="url(#strongGlow)" />
        <circle cx={cx} cy={cy} r="8" fill="#0a0a0a" stroke={color} strokeWidth="2" />

        {/* Score text */}
        <text x={cx} y={cy + 8} textAnchor="middle"
          fill={color} fontSize="52" fontWeight="700" fontFamily="monospace"
          filter="url(#glowFilter)">
          {displayScore}
        </text>

        {/* Regime label */}
        <text x={cx} y={cy + 36} textAnchor="middle"
          fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily="monospace" letterSpacing="2">
          ALT ROTATION SCORE
        </text>

        {/* Scale labels */}
        {[
          { label: "0", angle: startAngle },
          { label: "25", angle: startAngle + 60 },
          { label: "50", angle: startAngle + 120 },
          { label: "75", angle: startAngle + 180 },
          { label: "100", angle: startAngle + totalArc },
        ].map(({ label, angle }) => {
          const lr = r + 22;
          const lx = cx + lr * Math.cos(toRad(angle));
          const ly = cy + lr * Math.sin(toRad(angle));
          return (
            <text key={label} x={lx} y={ly + 4} textAnchor="middle"
              fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
              {label}
            </text>
          );
        })}
      </svg>

      {/* Regime badge */}
      <div className="mt-2 px-5 py-2 rounded-sm border text-center"
        style={{ borderColor: color + "60", background: color + "12" }}>
        <div className="text-xs tracking-widest font-mono" style={{ color }}>
          {regime.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ── Score Breakdown Bar ───────────────────────────────────────
function ScoreBar({ label, weight, rawScore, contribution, color }: {
  label: string; weight: number; rawScore: number; contribution: number; color: string;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(rawScore), 300);
    return () => clearTimeout(t);
  }, [rawScore]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-zinc-400 tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500">{weight}%</span>
          <span className="text-xs font-mono font-bold" style={{ color }}>{contribution}pts</span>
        </div>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
      </div>
    </div>
  );
}

// ── Sector Heatmap Card ───────────────────────────────────────
function SectorCard({ sector }: { sector: SectorData }) {
  const momentumColor = sector.momentum === "strong" ? "#34D399"
    : sector.momentum === "moderate" ? "#00D4FF"
    : sector.momentum === "weak" ? "#F59E0B"
    : "#FF2D55";

  return (
    <div className="rounded border p-3 space-y-2 transition-all duration-300 hover:border-opacity-60"
      style={{ borderColor: sector.color + "30", background: "rgba(10,10,10,0.8)" }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs font-mono tracking-widest" style={{ color: sector.color }}>
            {sector.name.toUpperCase()}
          </div>
          {sector.alert && (
            <div className="text-xs font-mono mt-0.5" style={{ color: momentumColor }}>
              ⚡ {sector.alert}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-bold"
            style={{ color: sector.avgChange24h >= 0 ? "#34D399" : "#FF2D55" }}>
            {sector.avgChange24h >= 0 ? "+" : ""}{sector.avgChange24h.toFixed(1)}%
          </div>
          <div className="text-xs font-mono text-zinc-500">24h avg</div>
        </div>
      </div>

      {/* Momentum bar */}
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, Math.max(0, (sector.avgChange24h + 15) / 30 * 100))}%`,
            background: `linear-gradient(90deg, ${sector.color}60, ${sector.color})`,
          }} />
      </div>

      {/* Top coins */}
      <div className="grid grid-cols-3 gap-1">
        {sector.coins.slice(0, 3).map(coin => (
          <div key={coin.id} className="text-center">
            <div className="text-xs font-mono text-zinc-300">{coin.symbol}</div>
            <div className="text-xs font-mono"
              style={{ color: coin.change24h >= 0 ? "#34D399" : "#FF2D55" }}>
              {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Score pill */}
      <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
        <span className="text-xs font-mono text-zinc-600">SECTOR SCORE</span>
        <span className="text-xs font-mono font-bold" style={{ color: sector.color }}>{sector.score}</span>
      </div>
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────
function AlertCard({ alert }: { alert: RotationAlert }) {
  const severityColor = alert.severity === "high" ? "#FF2D55" : alert.severity === "medium" ? "#F59E0B" : "#00D4FF";
  const typeIcon = alert.type === "sector_rotation" ? "⟳"
    : alert.type === "dominance_shift" ? "◈"
    : alert.type === "liquidity" ? "◉"
    : alert.type === "momentum" ? "▲"
    : "◀";

  return (
    <div className="rounded border p-3 space-y-1 transition-all duration-200 hover:border-opacity-70"
      style={{ borderColor: severityColor + "30", background: severityColor + "08" }}>
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5" style={{ color: severityColor }}>{typeIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono font-bold tracking-wider" style={{ color: severityColor }}>
            {alert.title.toUpperCase()}
          </div>
          <div className="text-xs font-mono text-zinc-400 mt-0.5 leading-relaxed">{alert.body}</div>
        </div>
        <div className="text-xs font-mono px-1.5 py-0.5 rounded border shrink-0"
          style={{ color: severityColor, borderColor: severityColor + "40" }}>
          {alert.severity.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
function AltRotationInner() {
  useSEO({
    title: "Alt Rotation — Crypto Sector Rotation & Altcoin Intelligence",
    description: "Track crypto sector rotation, altcoin momentum, and digital asset macro alignment with FAULTLINE's Alt Rotation intelligence module.",
    canonical: "/alt-rotation",
  });
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = trpc.altRotation.getData.useQuery(undefined, {
    refetchInterval: 3 * 60 * 1000, // refresh every 3 min
    enabled: !!user,
  });

  const [activeTab, setActiveTab] = useState<"overview" | "sectors" | "signals" | "breadth">("overview");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-xs font-mono tracking-widest text-amber-400 mb-2">ALT ROTATION ENGINE™</div>
          <div className="text-2xl font-mono font-bold text-white">SIGN IN REQUIRED</div>
          <div className="text-sm font-mono text-zinc-400 leading-relaxed">
            Access the world's first institutional crypto macro rotation intelligence engine.
          </div>
          <a href={getLoginUrl()}
            className="inline-block px-8 py-3 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 font-mono text-sm tracking-widest hover:bg-amber-400/20 transition-all">
            SIGN IN TO ACCESS
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xs font-mono tracking-widest text-amber-400 animate-pulse">
            INITIALIZING ALT ROTATION ENGINE™
          </div>
          <div className="text-xs font-mono text-zinc-600 animate-pulse">
            FETCHING LIVE MARKET STRUCTURE DATA...
          </div>
          <div className="flex gap-1 justify-center mt-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1 h-6 rounded-full bg-amber-400/40 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-mono text-sm">DATA FETCH FAILED</div>
          <div className="text-zinc-500 font-mono text-xs">{error?.message ?? "Unknown error"}</div>
          <button onClick={() => refetch()}
            className="px-6 py-2 border border-zinc-700 text-zinc-400 font-mono text-xs rounded hover:border-zinc-500 transition-all">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const d = data as AltRotationPayload;
  const regimeColor = d.regimeColor;

  return (
    <div className="min-h-screen bg-black text-white"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease-out" }}>

      {/* Header */}
      <div className="border-b border-zinc-800/60 px-4 md:px-8 py-4"
        style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(0,0,0,0.8) 100%)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono tracking-widest" style={{ color: regimeColor }}>
                FAULTLINE
              </div>
              <div className="w-px h-3 bg-zinc-700" />
              <div className="text-xs font-mono tracking-widest text-zinc-500">
                ALT ROTATION ENGINE™
              </div>
            </div>
            <div className="text-lg md:text-xl font-mono font-bold text-white mt-1">
              CRYPTO MACRO ROTATION INTELLIGENCE
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-mono text-zinc-600">LAST UPDATE</div>
              <div className="text-xs font-mono text-zinc-400">
                {new Date(d.fetchedAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded border text-xs font-mono"
              style={{ borderColor: regimeColor + "40", color: regimeColor, background: regimeColor + "10" }}>
              LIVE
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* Hero: Arc Gauge + Score Breakdown + Regime */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Arc Gauge */}
          <div className="lg:col-span-1 rounded border border-zinc-800/60 p-6 flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(ellipse at center, rgba(20,20,20,0.9) 0%, rgba(0,0,0,0.95) 100%)" }}>
            <ArcGauge score={d.score} color={regimeColor} regime={d.regime} />
          </div>

          {/* Score Breakdown */}
          <div className="lg:col-span-1 rounded border border-zinc-800/60 p-6 space-y-4"
            style={{ background: "rgba(8,8,8,0.95)" }}>
            <div className="text-xs font-mono tracking-widest text-zinc-500 mb-4">SCORE DECOMPOSITION</div>
            {d.scoreBreakdown.map((item, i) => (
              <ScoreBar key={i} {...item} color={regimeColor} />
            ))}
            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-xs font-mono text-zinc-600">COMPOSITE SCORE</span>
              <span className="text-lg font-mono font-bold" style={{ color: regimeColor }}>{d.score}</span>
            </div>
          </div>

          {/* Regime Definitions */}
          <div className="lg:col-span-1 rounded border border-zinc-800/60 p-6 space-y-3"
            style={{ background: "rgba(8,8,8,0.95)" }}>
            <div className="text-xs font-mono tracking-widest text-zinc-500 mb-4">REGIME DEFINITIONS</div>
            {[
              { range: "0–25", label: "Bitcoin Dominance Regime", color: "#F59E0B", key: "btc_dominance" },
              { range: "26–45", label: "Early Rotation Watch", color: "#FB923C", key: "early_rotation" },
              { range: "46–65", label: "Selective Alt Expansion", color: "#00D4FF", key: "selective_expansion" },
              { range: "66–85", label: "Broad Altseason", color: "#34D399", key: "broad_altseason" },
              { range: "86–100", label: "Speculative Mania Phase", color: "#FF2D55", key: "speculative_mania" },
            ].map(r => (
              <div key={r.key} className="flex items-center gap-3 p-2 rounded transition-all"
                style={{
                  background: r.key === d.regimeKey ? r.color + "12" : "transparent",
                  border: r.key === d.regimeKey ? `1px solid ${r.color}30` : "1px solid transparent",
                }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono" style={{ color: r.key === d.regimeKey ? r.color : "rgba(255,255,255,0.5)" }}>
                    {r.label}
                  </div>
                </div>
                <div className="text-xs font-mono text-zinc-600 shrink-0">{r.range}</div>
                {r.key === d.regimeKey && (
                  <div className="text-xs font-mono shrink-0" style={{ color: r.color }}>◀ NOW</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Commentary */}
        <div className="rounded border p-5 space-y-2"
          style={{ borderColor: regimeColor + "30", background: regimeColor + "06" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: regimeColor }} />
            <div className="text-xs font-mono tracking-widest" style={{ color: regimeColor }}>
              ROTATION INTELLIGENCE ANALYSIS
            </div>
          </div>
          <p className="text-sm font-mono text-zinc-300 leading-relaxed">{d.aiCommentary}</p>
        </div>

        {/* Alerts */}
        {d.alerts.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-mono tracking-widest text-zinc-500">ACTIVE INTELLIGENCE ALERTS</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {d.alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800/60">
          {(["overview", "sectors", "signals", "breadth"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-xs font-mono tracking-widest transition-all border-b-2"
              style={{
                borderColor: activeTab === tab ? regimeColor : "transparent",
                color: activeTab === tab ? regimeColor : "rgba(255,255,255,0.4)",
              }}>
              {tab === "overview" ? "OVERVIEW" : tab === "sectors" ? "SECTOR HEATMAP" : tab === "signals" ? "SIGNAL ENGINES" : "MARKET BREADTH"}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* BTC Dominance Engine */}
            <div className="rounded border border-zinc-800/60 p-5 space-y-4"
              style={{ background: "rgba(8,8,8,0.95)" }}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono tracking-widest text-amber-400">BTC DOMINANCE ENGINE</div>
                <div className="text-xs font-mono px-2 py-0.5 rounded border"
                  style={{
                    color: d.btcDominance.pressure === "high" ? "#FF2D55" : d.btcDominance.pressure === "medium" ? "#F59E0B" : "#34D399",
                    borderColor: d.btcDominance.pressure === "high" ? "#FF2D5530" : d.btcDominance.pressure === "medium" ? "#F59E0B30" : "#34D39930",
                  }}>
                  {d.btcDominance.pressure.toUpperCase()} PRESSURE
                </div>
              </div>

              <div className="text-center py-4">
                <div className="text-4xl font-mono font-bold text-amber-400">
                  {d.btcDominance.current.toFixed(1)}%
                </div>
                <div className="text-xs font-mono text-zinc-500 mt-1">BTC MARKET DOMINANCE</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">TREND</span>
                  <span className="text-zinc-300 capitalize">{d.btcDominance.trend}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">SCORE</span>
                  <span style={{ color: regimeColor }}>{d.btcDominance.score}/100</span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <div className="text-xs font-mono text-zinc-400 leading-relaxed">{d.btcDominance.signal}</div>
              </div>

              {/* Dominance bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-zinc-600">
                  <span>40%</span><span>50%</span><span>60%</span><span>70%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden relative">
                  <div className="h-full rounded-full bg-amber-400/80"
                    style={{ width: `${Math.min(100, Math.max(0, (d.btcDominance.current - 40) / 30 * 100))}%` }} />
                </div>
              </div>
            </div>

            {/* ETH Leadership Index */}
            <div className="rounded border border-zinc-800/60 p-5 space-y-4"
              style={{ background: "rgba(8,8,8,0.95)" }}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono tracking-widest text-cyan-400">ETH LEADERSHIP INDEX</div>
                <div className="text-xs font-mono px-2 py-0.5 rounded border"
                  style={{
                    color: d.ethLeadership.status === "outperforming" ? "#34D399" : d.ethLeadership.status === "underperforming" ? "#FF2D55" : "#F59E0B",
                    borderColor: d.ethLeadership.status === "outperforming" ? "#34D39930" : d.ethLeadership.status === "underperforming" ? "#FF2D5530" : "#F59E0B30",
                  }}>
                  {d.ethLeadership.label.toUpperCase()}
                </div>
              </div>

              <div className="text-center py-4">
                <div className="text-4xl font-mono font-bold text-cyan-400">
                  {d.ethLeadership.ethBtcRatio.toFixed(4)}
                </div>
                <div className="text-xs font-mono text-zinc-500 mt-1">ETH/BTC RATIO</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded border border-zinc-800">
                  <div className="text-xs font-mono text-zinc-500">ETH 24H</div>
                  <div className="text-sm font-mono font-bold"
                    style={{ color: d.ethLeadership.ethChange24h >= 0 ? "#34D399" : "#FF2D55" }}>
                    {d.ethLeadership.ethChange24h >= 0 ? "+" : ""}{d.ethLeadership.ethChange24h.toFixed(2)}%
                  </div>
                </div>
                <div className="text-center p-2 rounded border border-zinc-800">
                  <div className="text-xs font-mono text-zinc-500">BTC 24H</div>
                  <div className="text-sm font-mono font-bold"
                    style={{ color: d.ethLeadership.btcChange24h >= 0 ? "#34D399" : "#FF2D55" }}>
                    {d.ethLeadership.btcChange24h >= 0 ? "+" : ""}{d.ethLeadership.btcChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">RELATIVE PERF</span>
                  <span style={{ color: d.ethLeadership.relativePerformance >= 0 ? "#34D399" : "#FF2D55" }}>
                    {d.ethLeadership.relativePerformance >= 0 ? "+" : ""}{d.ethLeadership.relativePerformance.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">TREND</span>
                  <span className="text-zinc-300 capitalize">{d.ethLeadership.trend}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">SCORE</span>
                  <span style={{ color: regimeColor }}>{d.ethLeadership.score}/100</span>
                </div>
              </div>
            </div>

            {/* Stablecoin Liquidity Engine */}
            <div className="rounded border border-zinc-800/60 p-5 space-y-4"
              style={{ background: "rgba(8,8,8,0.95)" }}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono tracking-widest text-emerald-400">STABLECOIN LIQUIDITY</div>
                <div className="text-xs font-mono px-2 py-0.5 rounded border"
                  style={{
                    color: d.stablecoinLiquidity.status === "expanding" ? "#34D399" : d.stablecoinLiquidity.status === "contracting" ? "#FF2D55" : "#F59E0B",
                    borderColor: d.stablecoinLiquidity.status === "expanding" ? "#34D39930" : d.stablecoinLiquidity.status === "contracting" ? "#FF2D5530" : "#F59E0B30",
                  }}>
                  {d.stablecoinLiquidity.label.toUpperCase()}
                </div>
              </div>

              <div className="text-center py-4">
                <div className="text-4xl font-mono font-bold text-emerald-400">
                  ${d.stablecoinLiquidity.totalStablecoinCap.toFixed(0)}B
                </div>
                <div className="text-xs font-mono text-zinc-500 mt-1">TOTAL STABLECOIN SUPPLY</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded border border-zinc-800">
                  <div className="text-xs font-mono text-zinc-500">USDT</div>
                  <div className="text-sm font-mono font-bold text-zinc-200">
                    ${d.stablecoinLiquidity.usdtMarketCap.toFixed(0)}B
                  </div>
                </div>
                <div className="text-center p-2 rounded border border-zinc-800">
                  <div className="text-xs font-mono text-zinc-500">USDC</div>
                  <div className="text-sm font-mono font-bold text-zinc-200">
                    ${d.stablecoinLiquidity.usdcMarketCap.toFixed(0)}B
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">STATUS</span>
                  <span style={{ color: d.stablecoinLiquidity.status === "expanding" ? "#34D399" : d.stablecoinLiquidity.status === "contracting" ? "#FF2D55" : "#F59E0B" }}>
                    {d.stablecoinLiquidity.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-500">SCORE</span>
                  <span style={{ color: regimeColor }}>{d.stablecoinLiquidity.score}/100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Sector Heatmap */}
        {activeTab === "sectors" && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-zinc-500 leading-relaxed">
              Real-time sector rotation intelligence across 7 crypto verticals. Synchronized breakouts across multiple assets within a sector generate rotation alerts.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {d.sectors.sort((a, b) => b.avgChange24h - a.avgChange24h).map(sector => (
                <SectorCard key={sector.key} sector={sector} />
              ))}
            </div>
          </div>
        )}

        {/* Tab: Signal Engines */}
        {activeTab === "signals" && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-zinc-500 leading-relaxed">
              Individual signal engine outputs feeding the composite Alt Rotation Score.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BTC Dominance detail */}
              <div className="rounded border border-zinc-800/60 p-5 space-y-3"
                style={{ background: "rgba(8,8,8,0.95)" }}>
                <div className="text-xs font-mono tracking-widest text-amber-400">BTC DOMINANCE ENGINE</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Current Dominance</span>
                    <span className="text-amber-400 font-bold">{d.btcDominance.current.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Trend</span>
                    <span className="text-zinc-200 capitalize">{d.btcDominance.trend}</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Pressure</span>
                    <span className="capitalize" style={{ color: d.btcDominance.pressure === "high" ? "#FF2D55" : d.btcDominance.pressure === "medium" ? "#F59E0B" : "#34D399" }}>
                      {d.btcDominance.pressure}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Engine Score</span>
                    <span className="font-bold" style={{ color: regimeColor }}>{d.btcDominance.score}/100</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-800 text-xs font-mono text-zinc-400 leading-relaxed">
                  {d.btcDominance.signal}
                </div>
              </div>

              {/* ETH Leadership detail */}
              <div className="rounded border border-zinc-800/60 p-5 space-y-3"
                style={{ background: "rgba(8,8,8,0.95)" }}>
                <div className="text-xs font-mono tracking-widest text-cyan-400">ETH LEADERSHIP INDEX</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">ETH/BTC Ratio</span>
                    <span className="text-cyan-400 font-bold">{d.ethLeadership.ethBtcRatio.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Status</span>
                    <span style={{ color: d.ethLeadership.status === "outperforming" ? "#34D399" : d.ethLeadership.status === "underperforming" ? "#FF2D55" : "#F59E0B" }}>
                      {d.ethLeadership.label}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Relative Perf</span>
                    <span style={{ color: d.ethLeadership.relativePerformance >= 0 ? "#34D399" : "#FF2D55" }}>
                      {d.ethLeadership.relativePerformance >= 0 ? "+" : ""}{d.ethLeadership.relativePerformance.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Engine Score</span>
                    <span className="font-bold" style={{ color: regimeColor }}>{d.ethLeadership.score}/100</span>
                  </div>
                </div>
              </div>

              {/* Stablecoin detail */}
              <div className="rounded border border-zinc-800/60 p-5 space-y-3"
                style={{ background: "rgba(8,8,8,0.95)" }}>
                <div className="text-xs font-mono tracking-widest text-emerald-400">STABLECOIN LIQUIDITY ENGINE</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">USDT Supply</span>
                    <span className="text-zinc-200">${d.stablecoinLiquidity.usdtMarketCap.toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">USDC Supply</span>
                    <span className="text-zinc-200">${d.stablecoinLiquidity.usdcMarketCap.toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Total Supply</span>
                    <span className="text-emerald-400 font-bold">${d.stablecoinLiquidity.totalStablecoinCap.toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Status</span>
                    <span style={{ color: d.stablecoinLiquidity.status === "expanding" ? "#34D399" : d.stablecoinLiquidity.status === "contracting" ? "#FF2D55" : "#F59E0B" }}>
                      {d.stablecoinLiquidity.label}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Engine Score</span>
                    <span className="font-bold" style={{ color: regimeColor }}>{d.stablecoinLiquidity.score}/100</span>
                  </div>
                </div>
              </div>

              {/* Market Breadth detail */}
              <div className="rounded border border-zinc-800/60 p-5 space-y-3"
                style={{ background: "rgba(8,8,8,0.95)" }}>
                <div className="text-xs font-mono tracking-widest text-purple-400">MARKET BREADTH ENGINE</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">TOTAL2 (ex-BTC)</span>
                    <span className="text-zinc-200">${d.marketBreadth.total2Proxy.toFixed(0)}B</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">TOTAL3 (ex-BTC/ETH)</span>
                    <span className="text-zinc-200">${d.marketBreadth.total3Proxy.toFixed(0)}B</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Altcoin Dominance</span>
                    <span className="text-purple-400 font-bold">{d.marketBreadth.altcoinDominance.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Breadth Signal</span>
                    <span style={{ color: d.marketBreadth.breadthSignal === "expanding" ? "#34D399" : d.marketBreadth.breadthSignal === "contracting" ? "#FF2D55" : "#F59E0B" }}>
                      {d.marketBreadth.breadthSignal.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-zinc-400">Engine Score</span>
                    <span className="font-bold" style={{ color: regimeColor }}>{d.marketBreadth.score}/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Market Breadth */}
        {activeTab === "breadth" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "TOTAL CRYPTO MARKET", value: `$${((d.marketBreadth.total2Proxy + (d.stablecoinLiquidity.totalStablecoinCap)) / 1000).toFixed(2)}T`, color: regimeColor },
                { label: "TOTAL2 (EX-BTC)", value: `$${d.marketBreadth.total2Proxy.toFixed(0)}B`, color: "#00D4FF" },
                { label: "TOTAL3 (EX-BTC/ETH)", value: `$${d.marketBreadth.total3Proxy.toFixed(0)}B`, color: "#A78BFA" },
                { label: "ALTCOIN DOMINANCE", value: `${d.marketBreadth.altcoinDominance.toFixed(1)}%`, color: "#34D399" },
              ].map(stat => (
                <div key={stat.label} className="rounded border border-zinc-800/60 p-5 text-center"
                  style={{ background: "rgba(8,8,8,0.95)" }}>
                  <div className="text-xs font-mono tracking-widest text-zinc-500 mb-2">{stat.label}</div>
                  <div className="text-2xl font-mono font-bold" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Sector performance table */}
            <div className="rounded border border-zinc-800/60 overflow-hidden"
              style={{ background: "rgba(8,8,8,0.95)" }}>
              <div className="px-5 py-3 border-b border-zinc-800">
                <div className="text-xs font-mono tracking-widest text-zinc-500">SECTOR PERFORMANCE MATRIX</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-4 py-3 text-left text-zinc-500 tracking-wider">SECTOR</th>
                      <th className="px-4 py-3 text-right text-zinc-500 tracking-wider">24H AVG</th>
                      <th className="px-4 py-3 text-right text-zinc-500 tracking-wider">7D AVG</th>
                      <th className="px-4 py-3 text-right text-zinc-500 tracking-wider">MOMENTUM</th>
                      <th className="px-4 py-3 text-right text-zinc-500 tracking-wider">SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.sectors.sort((a, b) => b.avgChange24h - a.avgChange24h).map(sector => (
                      <tr key={sector.key} className="border-b border-zinc-800/30 hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: sector.color }} />
                            <span style={{ color: sector.color }}>{sector.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right"
                          style={{ color: sector.avgChange24h >= 0 ? "#34D399" : "#FF2D55" }}>
                          {sector.avgChange24h >= 0 ? "+" : ""}{sector.avgChange24h.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right"
                          style={{ color: sector.avgChange7d >= 0 ? "#34D399" : "#FF2D55" }}>
                          {sector.avgChange7d >= 0 ? "+" : ""}{sector.avgChange7d.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right capitalize"
                          style={{ color: sector.momentum === "strong" ? "#34D399" : sector.momentum === "moderate" ? "#00D4FF" : sector.momentum === "weak" ? "#F59E0B" : "#FF2D55" }}>
                          {sector.momentum}
                        </td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: sector.color }}>
                          {sector.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-800/60 pt-4 flex justify-between items-center">
          <div className="text-xs font-mono text-zinc-600">
            DATA: {d.dataSource} · UPDATED: {new Date(d.fetchedAt).toLocaleTimeString()} · CACHE: 3 MIN
          </div>
          <Link href="/app/crypto-intel"
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            → CRYPTO INTEL
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AltRotation() {
  return (
    <PremiumGateFull variant="altRotation">
      <AltRotationInner />
    </PremiumGateFull>
  );
}
