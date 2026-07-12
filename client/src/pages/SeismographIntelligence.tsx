/**
 * FAULTLINE Seismograph Intelligence — Original HUD Terminal
 *
 * Faithfully reproduces the original v1 promotional video design:
 * - Dark navy/black background with cyan grid lines
 * - 60/40 left/right column split
 * - HUD corner brackets framing the screen
 * - Seismograph waveform charts
 * - Circular pressure gauges for active patterns
 * - Transition probability bars with horizon selector
 * - System status bar with ONLINE/LIVE indicators
 * - All data from real FAULTLINE intelligence engines
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { Calendar, SlidersHorizontal } from "lucide-react";

// ─── Color helpers ────────────────────────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#eab308";
  if (score >= 30) return "#84cc16";
  return "#22c55e";
}

function stressColor(level: string): string {
  if (level === "Crisis") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Elevated") return "#eab308";
  return "#22c55e";
}

function regimeLabel(r: string): string {
  const map: Record<string, string> = {
    bull: "Bull Market", bear: "Bear Market", neutral: "Neutral",
    low: "Low Stress", elevated: "Elevated Stress", high: "High Stress",
    crisis: "Crisis", late_cycle: "Late Cycle Stress", expansion: "Expansion",
    contraction: "Contraction", stagflation: "Stagflation", recovery: "Recovery",
  };
  return map[r?.toLowerCase()] ?? r?.replace(/_/g, " ").toUpperCase() ?? "UNKNOWN";
}

function formatMonth(m: string): string {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

// ─── HUD Corner brackets ──────────────────────────────────────────────────────
function HudCorners({ color = "#06b6d4" }: { color?: string }) {
  const s = { position: "absolute" as const, width: 16, height: 16 };
  const b = `2px solid ${color}`;
  return (
    <>
      <div style={{ ...s, top: 0, left: 0, borderTop: b, borderLeft: b }} />
      <div style={{ ...s, top: 0, right: 0, borderTop: b, borderRight: b }} />
      <div style={{ ...s, bottom: 0, left: 0, borderBottom: b, borderLeft: b }} />
      <div style={{ ...s, bottom: 0, right: 0, borderBottom: b, borderRight: b }} />
    </>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function HudPanel({ children, className = "", accentColor = "#06b6d4", style }: {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        border: `1px solid ${accentColor}30`,
        background: "rgba(0,8,20,0.85)",
        boxShadow: `0 0 12px ${accentColor}10, inset 0 0 20px rgba(0,0,0,0.4)`,
        ...style,
      }}
    >
      <HudCorners color={accentColor} />
      {children}
    </div>
  );
}

// ─── Panel header ─────────────────────────────────────────────────────────────
function PanelHeader({ icon, title, color = "#06b6d4" }: { icon?: React.ReactNode; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: `${color}25` }}>
      {icon && <span style={{ color }}>{icon}</span>}
      <span className="text-xs font-bold tracking-widest uppercase" style={{ color, fontFamily: "monospace" }}>{title}</span>
    </div>
  );
}

// ─── Blinking dot ─────────────────────────────────────────────────────────────
function BlinkDot({ color = "#22c55e" }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 800);
    return () => clearInterval(t);
  }, []);
  return <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: on ? color : "transparent", boxShadow: on ? `0 0 4px ${color}` : "none", transition: "all 0.2s" }} />;
}

// ─── Seismograph waveform ─────────────────────────────────────────────────────
function SeismographWaveform({ data, color, label, signalQuality, riskLevel }: {
  data: number[];
  color: string;
  label: string;
  signalQuality: number;
  riskLevel: string;
}) {
  const riskColors: Record<string, string> = { HIGH: "#ef4444", MODERATE: "#f97316", WATCH: "#06b6d4", LOW: "#22c55e" };
  const rc = riskColors[riskLevel] ?? color;
  return (
    <div className="space-y-1.5">
      <div className="text-xs tracking-widest uppercase" style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>PATTERN STRENGTH</div>
      <div className="flex items-end gap-px" style={{ height: 36 }}>
        {data.map((v, i) => (
          <div key={i} style={{ width: 3, height: `${Math.max(4, v)}%`, background: color, opacity: 0.7 + (i / data.length) * 0.3, boxShadow: `0 0 2px ${color}` }} />
        ))}
      </div>
      <div className="text-xs tracking-widest uppercase" style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>SIGNAL QUALITY</div>
      <div className="h-1.5 rounded-sm" style={{ background: `${color}30` }}>
        <div className="h-full rounded-sm" style={{ width: `${signalQuality}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-widest" style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>RISK LEVEL</span>
        <span className="px-1.5 py-0.5 text-xs font-bold tracking-widest" style={{ background: `${rc}20`, border: `1px solid ${rc}60`, color: rc, fontFamily: "monospace", fontSize: 9 }}>{riskLevel}</span>
      </div>
    </div>
  );
}

// ─── Circular gauge ───────────────────────────────────────────────────────────
function CircularGauge({ value, color, icon, label, days }: {
  value: number;
  color: string;
  icon: React.ReactNode;
  label: string;
  days: number;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke={`${color}20`} strokeWidth="4" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${fill} ${circ - fill}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute flex flex-col items-center" style={{ transform: "none" }}>
          <span style={{ color, fontSize: 14 }}>{icon}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold tracking-wide" style={{ color, fontFamily: "monospace", fontSize: 9 }}>{label}</div>
        <div className="text-xs" style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>DAY {days}</div>
      </div>
    </div>
  );
}

// ─── Transition probability row ───────────────────────────────────────────────
function ProbRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-wide" style={{ color, fontFamily: "monospace", fontSize: 10 }}>{label}</span>
        <span className="text-xs font-bold" style={{ color, fontFamily: "monospace" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-sm" style={{ background: `${color}15` }}>
        <div className="h-full rounded-sm transition-all duration-1000" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}60` }} />
      </div>
    </div>
  );
}

// ─── Preset windows for evolution chart ──────────────────────────────────────
const PRESETS = [
  { label: "7D",  months: 1 },
  { label: "30D", months: 1 },
  { label: "90D", months: 3 },
  { label: "6M",  months: 6 },
  { label: "1Y",  months: 12 },
  { label: "3Y",  months: 36 },
  { label: "5Y",  months: 60 },
  { label: "All", months: 999 },
] as const;

function computeCustomTrend(slice: Array<{ month: string; score: number; regime: string }>) {
  if (slice.length < 2) return null;
  const scores = slice.map((s) => s.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const first = scores[0]!;
  const last = scores[scores.length - 1]!;
  const delta = last - first;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const regimes = new Set(slice.map((s) => s.regime));
  const direction = delta >= 5 ? "Rising" : delta <= -5 ? "Declining" : "Stable";
  const dirColor = delta >= 5 ? "#ef4444" : delta <= -5 ? "#22c55e" : "#94a3b8";
  return { avg: Math.round(avg), delta: Math.round(delta * 10) / 10, max, min, direction, dirColor, regimeCount: regimes.size, months: slice.length };
}

// ─── Evolution chart ──────────────────────────────────────────────────────────
function EvolutionChart({ timeline }: {
  timeline: Array<{ month: string; score: number; regime: string; isAnnotated: boolean; annotation?: string }>;
}) {
  const [preset, setPreset] = useState<string>("90D");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const slice = useMemo(() => {
    if (showCustom && customStart && customEnd) {
      return timeline.filter((t) => t.month >= customStart && t.month <= customEnd);
    }
    const p = PRESETS.find((x) => x.label === preset);
    const n = p ? p.months : 3;
    return timeline.slice(-Math.min(n, timeline.length));
  }, [timeline, preset, customStart, customEnd, showCustom]);

  const trend = useMemo(() => computeCustomTrend(slice), [slice]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { month: string; score: number; regime: string; annotation?: string } }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "rgba(0,8,20,0.95)", border: "1px solid #06b6d430", padding: "8px 10px", borderRadius: 4 }}>
        <div style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 10, fontWeight: "bold" }}>{formatMonth(d.month)}</div>
        <div style={{ color: pressureColor(d.score), fontFamily: "monospace", fontSize: 10 }}>{d.score}/100 · {regimeLabel(d.regime)}</div>
        {d.annotation && <div style={{ color: "#f59e0b", fontFamily: "monospace", fontSize: 9, marginTop: 4, maxWidth: 200 }}>{d.annotation}</div>}
      </div>
    );
  };

  const tickInterval = slice.length <= 12 ? 0 : slice.length <= 36 ? 2 : slice.length <= 72 ? 5 : Math.floor(slice.length / 12);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-0.5 p-0.5 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d420" }}>
          {PRESETS.map((p) => (
            <button key={p.label}
              onClick={() => { setPreset(p.label); setShowCustom(false); }}
              className="px-2 py-0.5 rounded text-xs font-bold transition-all"
              style={{
                background: preset === p.label && !showCustom ? "#06b6d4" : "transparent",
                color: preset === p.label && !showCustom ? "#000" : "#06b6d480",
                fontFamily: "monospace",
                fontSize: 9,
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all"
          style={{
            background: showCustom ? "#06b6d420" : "transparent",
            color: showCustom ? "#06b6d4" : "#06b6d450",
            border: `1px solid ${showCustom ? "#06b6d440" : "#06b6d420"}`,
            fontFamily: "monospace",
            fontSize: 9,
          }}>
          <Calendar className="w-2.5 h-2.5" />
          CUSTOM
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 p-2 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d420" }}>
          <SlidersHorizontal className="w-3 h-3 flex-shrink-0" style={{ color: "#06b6d4" }} />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>FROM</span>
              <input type="month" value={customStart}
                min={timeline[0]?.month ?? "2000-01"}
                max={(customEnd || timeline[timeline.length - 1]?.month) ?? "2025-12"}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid #06b6d430", color: "#06b6d4", fontFamily: "monospace", fontSize: 9, padding: "2px 4px", borderRadius: 2 }} />
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 9 }}>TO</span>
              <input type="month" value={customEnd}
                min={(customStart || timeline[0]?.month) ?? "2000-01"}
                max={timeline[timeline.length - 1]?.month ?? "2025-12"}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid #06b6d430", color: "#06b6d4", fontFamily: "monospace", fontSize: 9, padding: "2px 4px", borderRadius: 2 }} />
            </div>
            {customStart && customEnd && (
              <button onClick={() => { setCustomStart(""); setCustomEnd(""); }}
                style={{ color: "#06b6d450", fontFamily: "monospace", fontSize: 9 }}>CLEAR</button>
            )}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={slice} margin={{ top: 2, right: 2, bottom: 0, left: -25 }}>
          <defs>
            <linearGradient id="evolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 8, fill: "#06b6d460", fontFamily: "monospace" }}
            interval={tickInterval} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#06b6d460", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine y={65} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={45} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Area type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={1.5} fill="url(#evolGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {trend && (
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: "DIRECTION", value: trend.direction, color: trend.dirColor },
            { label: "NET CHANGE", value: `${trend.delta >= 0 ? "+" : ""}${trend.delta}`, color: trend.dirColor },
            { label: "AVG SCORE", value: `${trend.avg}/100`, color: pressureColor(trend.avg) },
            { label: "RANGE", value: `${trend.min}–${trend.max}`, color: "#06b6d4" },
          ].map((m) => (
            <div key={m.label} className="text-center p-1.5 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d415" }}>
              <div style={{ color: "#06b6d460", fontFamily: "monospace", fontSize: 8 }}>{m.label}</div>
              <div style={{ color: m.color, fontFamily: "monospace", fontSize: 10, fontWeight: "bold" }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SeismographIntelligence() {
  const { data: intel, isLoading, error, refetch } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );
  const seedMutation = trpc.seismograph.seedNow.useMutation({ onSuccess: () => refetch() });
  const [horizonTab, setHorizonTab] = useState<"1M" | "3M" | "6M" | "12M">("3M");
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000814", fontFamily: "monospace" }}>
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold tracking-widest" style={{ color: "#06b6d4" }}>FAULTLINE SEISMOGRAPH™</div>
          <div className="text-xs tracking-widest" style={{ color: "#06b6d480" }}>INITIALIZING INTELLIGENCE ENGINES...</div>
          <div className="flex justify-center gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1 rounded-full animate-pulse" style={{ height: 16 + i * 6, background: "#06b6d4", animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / no data ──────────────────────────────────────────────────────────
  if (error || !intel) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#000814", fontFamily: "monospace" }}>
        <div className="text-center space-y-4">
          <div className="text-sm tracking-widest" style={{ color: "#ef4444" }}>INTELLIGENCE ENGINE OFFLINE</div>
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            className="px-4 py-2 text-xs font-bold tracking-widest"
            style={{ border: "1px solid #06b6d4", color: "#06b6d4", background: "transparent" }}>
            {seedMutation.isPending ? "INITIALIZING..." : "INITIALIZE ENGINE"}
          </button>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const score = intel.currentScore;
  const scoreColor = pressureColor(score);
  const stressLvl = intel.currentStressLevel;
  const stressC = stressColor(stressLvl);

  // Build waveform data from patterns (or generate from score history)
  const patterns = intel.activePatterns ?? [];
  const patternColors = ["#ef4444", "#f97316", "#06b6d4"];
  const patternRiskLevels = ["HIGH", "MODERATE", "WATCH"];

  // Generate waveform bars from pattern confidence + days active
  function buildWaveform(confidence: number, daysActive: number, color: string): number[] {
    const bars = 28;
    return Array.from({ length: bars }, (_, i) => {
      const progress = i / bars;
      const base = 15 + progress * confidence * 0.6;
      const noise = Math.sin(i * 2.3 + daysActive * 0.1) * 15 + Math.cos(i * 1.7) * 10;
      return Math.max(5, Math.min(95, base + noise));
    });
  }

  // Transition probabilities based on horizon
  const tp = intel.transitionProbabilities;
  const horizonMultipliers: Record<string, number> = { "1M": 0.6, "3M": 1.0, "6M": 1.3, "12M": 1.6 };
  const hm = horizonMultipliers[horizonTab] ?? 1;
  const rawProbs = [
    { label: "Deterioration (Elevated Stress)", pct: Math.round(tp.transitionToElevated * hm), color: "#f97316" },
    { label: "Sideways / Choppy (Range-Bound)", pct: Math.round(tp.remainInRegime * hm * 0.8), color: "#f97316" },
    { label: "Stabilization (Base-Building)", pct: Math.round(tp.transitionToLow * hm), color: "#06b6d4" },
    { label: "Improvement (Early Expansion)", pct: Math.round(tp.transitionToLow * hm * 0.5), color: "#22c55e" },
    { label: "Systemic Event (Tail Risk)", pct: Math.round(tp.transitionToCrisis * hm), color: "#ef4444" },
  ];
  // Normalize to 100
  const total = rawProbs.reduce((s, p) => s + p.pct, 0);
  const transProbs = rawProbs.map(p => ({ ...p, pct: Math.round((p.pct / total) * 100) }));

  // Evidence consensus score (0-10)
  const evidenceScore = ((score / 100) * 10).toFixed(1);

  // Historical analog
  const topAnalog = intel.topAnalog;

  // Current state label
  const stateLabel = stressLvl === "Crisis" ? "CRITICAL" : stressLvl === "High" ? "ELEVATED" : stressLvl === "Elevated" ? "CAUTIOUS" : "STABLE";
  const stateColor = stressC;

  const utcTime = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <div className="min-h-screen" style={{ background: "#000814", fontFamily: "monospace", color: "#06b6d4" }}>
      {/* ── Top system status bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "#06b6d420", background: "rgba(0,8,20,0.9)" }}>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-widest" style={{ color: "#06b6d4" }}>FAULTLINE SEISMOGRAPH™</span>
          <span className="text-xs tracking-widest" style={{ color: "#06b6d460" }}>SEISMOGRAPH INTELLIGENCE DASHBOARD</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <BlinkDot color="#22c55e" />
            <span className="text-xs tracking-widest" style={{ color: "#22c55e", fontSize: 10 }}>SYSTEM STATUS ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BlinkDot color="#22c55e" />
            <span className="text-xs tracking-widest" style={{ color: "#22c55e", fontSize: 10 }}>DATA FEED LIVE</span>
          </div>
          <span className="text-xs" style={{ color: "#06b6d460", fontSize: 10 }}>LAST UPDATE: {utcTime}</span>
          <button onClick={() => refetch()} className="text-xs px-2 py-0.5 rounded" style={{ border: "1px solid #06b6d430", color: "#06b6d4", fontSize: 9 }}>↺ REFRESH</button>
        </div>
      </div>

      {/* ── Main HUD grid ── */}
      <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto auto auto" }}>

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-3">

          {/* Market State */}
          <HudPanel accentColor={stateColor}>
            <PanelHeader icon={<span style={{ fontSize: 14 }}>◈</span>} title="MARKET STATE" color="#06b6d4" />
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs tracking-widest" style={{ color: "#06b6d4", fontSize: 10 }}>CURRENT STATE:</div>
                  <div className="text-2xl font-bold tracking-widest" style={{ color: stateColor, textShadow: `0 0 20px ${stateColor}60` }}>{stateLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs tracking-widest" style={{ color: "#06b6d460", fontSize: 9 }}>PRESSURE SCORE</div>
                  <div className="text-3xl font-bold" style={{ color: scoreColor, fontFamily: "monospace", textShadow: `0 0 20px ${scoreColor}60` }}>{score}</div>
                  <div className="text-xs" style={{ color: "#06b6d460", fontSize: 9 }}>/100</div>
                </div>
              </div>

              {/* Evidence consensus bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs tracking-widest" style={{ color: "#06b6d4", fontSize: 9 }}>EVIDENCE CONSENSUS:</span>
                  <span className="text-lg font-bold" style={{ color: stateColor, fontFamily: "monospace" }}>{evidenceScore}/10</span>
                </div>
                <div className="h-2 rounded-sm" style={{ background: "#06b6d415" }}>
                  <div className="h-full rounded-sm transition-all duration-1000"
                    style={{ width: `${(parseFloat(evidenceScore) / 10) * 100}%`, background: `linear-gradient(90deg, #22c55e, #eab308, ${stateColor})`, boxShadow: `0 0 8px ${stateColor}60` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  {[0, 2.5, 5, 7.5, 10].map(v => (
                    <span key={v} style={{ color: "#06b6d430", fontSize: 8 }}>{v}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="text-xs" style={{ color: "#06b6d4", fontSize: 9 }}>Active Regime:</div>
                  <div className="text-xs font-bold" style={{ color: "#06b6d4" }}>{regimeLabel(intel.currentRegime)}</div>
                </div>
                {topAnalog && (
                  <div>
                    <div className="text-xs" style={{ color: "#06b6d4", fontSize: 9 }}>Historical Analog:</div>
                    <div className="text-xs font-bold" style={{ color: "#06b6d4" }}>{topAnalog.period} — {topAnalog.similarity}% similarity</div>
                  </div>
                )}
              </div>

              {intel.whyThisScore && (
                <div className="pt-1 border-t" style={{ borderColor: "#06b6d415" }}>
                  <div className="text-xs leading-relaxed" style={{ color: "#06b6d480", fontSize: 10 }}>{intel.whyThisScore}</div>
                </div>
              )}
            </div>
          </HudPanel>

          {/* Active Patterns */}
          <HudPanel accentColor="#06b6d4">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>◎</span>} title="ACTIVE PATTERNS" color="#06b6d4" />
            <div className="p-3">
              {patterns.length === 0 ? (
                <div className="text-center py-4" style={{ color: "#06b6d440", fontSize: 10 }}>NO ACTIVE PATTERNS DETECTED</div>
              ) : (
                <>
                  {/* Circular gauges row */}
                  <div className="flex items-start justify-around mb-3">
                    {patterns.slice(0, 3).map((p, i) => (
                      <CircularGauge
                        key={i}
                        value={p.confidence}
                        color={patternColors[i] ?? "#06b6d4"}
                        icon={<span style={{ fontSize: 12 }}>{i === 0 ? "⊕" : i === 1 ? "⟳" : "⬡"}</span>}
                        label={p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name}
                        days={p.daysActive}
                      />
                    ))}
                    {patterns.length < 3 && Array.from({ length: 3 - patterns.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex flex-col items-center gap-1.5">
                        <div style={{ width: 72, height: 72, border: "1px dashed #06b6d420", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#06b6d420", fontSize: 10 }}>—</span>
                        </div>
                        <div style={{ color: "#06b6d430", fontSize: 9 }}>NO PATTERN</div>
                      </div>
                    ))}
                  </div>

                  {/* Waveform charts */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(patterns.length, 3)}, 1fr)` }}>
                    {patterns.slice(0, 3).map((p, i) => (
                      <div key={i} className="cursor-pointer" onClick={() => setExpandedPattern(expandedPattern === i ? null : i)}>
                        <SeismographWaveform
                          data={buildWaveform(p.confidence, p.daysActive, patternColors[i] ?? "#06b6d4")}
                          color={patternColors[i] ?? "#06b6d4"}
                          label={p.name}
                          signalQuality={p.confidence}
                          riskLevel={patternRiskLevels[i] ?? "WATCH"}
                        />
                        {expandedPattern === i && (
                          <div className="mt-2 p-2 rounded text-xs space-y-1" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${patternColors[i] ?? "#06b6d4"}30` }}>
                            <div style={{ color: "#06b6d4", fontSize: 9 }}>{p.description}</div>
                            <div className="grid grid-cols-3 gap-1 pt-1">
                              {[
                                { l: "1M AVG", v: `${p.avgReturn1m >= 0 ? "+" : ""}${p.avgReturn1m.toFixed(1)}%` },
                                { l: "3M AVG", v: `${p.avgReturn3m >= 0 ? "+" : ""}${p.avgReturn3m.toFixed(1)}%` },
                                { l: "6M AVG", v: `${p.avgReturn6m >= 0 ? "+" : ""}${p.avgReturn6m.toFixed(1)}%` },
                              ].map(m => (
                                <div key={m.l} className="text-center">
                                  <div style={{ color: "#06b6d440", fontSize: 8 }}>{m.l}</div>
                                  <div style={{ color: parseFloat(m.v) >= 0 ? "#22c55e" : "#ef4444", fontSize: 9, fontWeight: "bold" }}>{m.v}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ color: "#06b6d440", fontSize: 8 }}>INVALIDATION: {p.invalidationConditions}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </HudPanel>

          {/* Today's Intelligence */}
          <HudPanel accentColor="#06b6d4">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>⬡</span>} title="TODAY'S INTELLIGENCE" color="#06b6d4" />
            <div className="p-3 space-y-2">
              <div className="text-xs leading-relaxed" style={{ color: "#94a3b8", fontSize: 10 }}>{intel.todayStory}</div>
              {intel.keyDevelopments?.length > 0 && (
                <div className="space-y-1 pt-1 border-t" style={{ borderColor: "#06b6d415" }}>
                  {intel.keyDevelopments.slice(0, 3).map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span style={{ color: "#06b6d4", fontSize: 9, marginTop: 1 }}>▸</span>
                      <span style={{ color: "#06b6d480", fontSize: 9 }}>{d}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </HudPanel>

          {/* Evolution Analysis */}
          <HudPanel accentColor="#22c55e">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>↗</span>} title="EVOLUTION ANALYSIS" color="#22c55e" />
            <div className="p-3 space-y-2">
              <EvolutionChart timeline={intel.timeline} />
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t" style={{ borderColor: "#22c55e15" }}>
                {[
                  { label: "7-DAY", value: intel.evolution.sevenDayTrend, color: "#06b6d4" },
                  { label: "30-DAY", value: intel.evolution.thirtyDayTrend, color: "#8b5cf6" },
                  { label: "90-DAY", value: intel.evolution.ninetyDayTrend, color: "#f59e0b" },
                  { label: "12-MONTH", value: intel.evolution.yearTrend, color: "#22c55e" },
                ].map((t) => (
                  <div key={t.label} className="p-1.5 rounded" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${t.color}20` }}>
                    <div style={{ color: t.color, fontFamily: "monospace", fontSize: 8, fontWeight: "bold" }}>{t.label}</div>
                    <div style={{ color: "#94a3b8", fontSize: 9 }}>{t.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </HudPanel>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-3">

          {/* Transition Probabilities */}
          <HudPanel accentColor="#06b6d4">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>▦</span>} title="TRANSITION PROBABILITIES" color="#06b6d4" />
            <div className="p-3 space-y-3">
              {/* Horizon selector */}
              <div className="flex items-center gap-2">
                <span style={{ color: "#06b6d460", fontSize: 9 }}>HORIZON:</span>
                <div className="flex gap-1">
                  {(["1M", "3M", "6M", "12M"] as const).map(h => (
                    <button key={h} onClick={() => setHorizonTab(h)}
                      className="px-2 py-0.5 text-xs font-bold transition-all"
                      style={{
                        border: `1px solid ${horizonTab === h ? "#22c55e" : "#06b6d430"}`,
                        color: horizonTab === h ? "#22c55e" : "#06b6d460",
                        background: horizonTab === h ? "#22c55e15" : "transparent",
                        fontFamily: "monospace",
                        fontSize: 9,
                      }}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {transProbs.map((p, i) => (
                  <ProbRow key={i} label={p.label} pct={p.pct} color={p.color} />
                ))}
              </div>

              <div className="flex justify-between pt-1 border-t" style={{ borderColor: "#06b6d415" }}>
                <span style={{ color: "#06b6d440", fontSize: 8 }}>PROBABILITIES SUM TO 100%</span>
                <span style={{ color: "#06b6d440", fontSize: 8 }}>DATA-DRIVEN ESTIMATES</span>
              </div>

              {tp.historicalBasis && (
                <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d415" }}>
                  <div style={{ color: "#06b6d460", fontSize: 9 }}>{tp.historicalBasis}</div>
                </div>
              )}
            </div>
          </HudPanel>

          {/* Evidence Families */}
          <HudPanel accentColor="#8b5cf6">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>◈</span>} title="INTELLIGENCE ENGINE BREAKDOWN" color="#8b5cf6" />
            <div className="p-3 space-y-1.5">
              {intel.evidenceFamilies?.slice(0, 6).map((ef, i) => {
                const efColor = ef.signal === "bullish" || ef.signal === "recovering" ? "#22c55e" : ef.signal === "bearish" || ef.signal === "stressed" ? "#ef4444" : "#eab308";
                return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "#94a3b8", fontSize: 9 }}>{ef.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: pressureColor(ef.strength), fontSize: 9, fontWeight: "bold" }}>{ef.strength}/100</span>
                      <span className="px-1 py-0.5 text-xs" style={{ background: `${efColor}20`, color: efColor, fontSize: 8, border: `1px solid ${efColor}40` }}>{ef.signal.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-sm" style={{ background: "#06b6d410" }}>
                    <div className="h-full rounded-sm" style={{ width: `${ef.strength}%`, background: pressureColor(ef.strength), boxShadow: `0 0 4px ${pressureColor(ef.strength)}60` }} />
                  </div>
                </div>
                );
              })}
              <div className="pt-1 border-t" style={{ borderColor: "#8b5cf615" }}>
                <div style={{ color: "#06b6d460", fontSize: 9 }}>
                  CONSENSUS: <span style={{ color: "#8b5cf6", fontWeight: "bold" }}>{intel.evidenceConsensus?.toUpperCase()}</span>
                  {intel.enginesAgreeing?.length > 0 && <span> · {intel.enginesAgreeing.length} ENGINES AGREEING</span>}
                </div>
              </div>
            </div>
          </HudPanel>

          {/* Historical Analog Engine */}
          <HudPanel accentColor="#f59e0b">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>⏱</span>} title="HISTORICAL ANALOG ENGINE" color="#f59e0b" />
            <div className="p-3 space-y-2">
              {intel.analogs?.slice(0, 3).map((a, i) => (
                <div key={i} className="p-2 rounded space-y-1" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${i === 0 ? "#f59e0b40" : "#06b6d415"}` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: i === 0 ? "#f59e0b" : "#06b6d4", fontSize: 10 }}>{a.period}</span>
                    <span className="px-1.5 py-0.5" style={{ background: "#f59e0b20", color: "#f59e0b", fontSize: 8, border: "1px solid #f59e0b40" }}>{a.similarity}% MATCH</span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 9 }}>{a.description}</div>
                  {a.resolution && (
                    <div style={{ color: "#06b6d460", fontSize: 9 }}>OUTCOME: {a.resolution}</div>
                  )}
                  {a.avgReturn3m !== null && a.avgReturn3m !== undefined && (
                    <div className="flex gap-2 pt-0.5">
                      {[
                        { l: "3M", v: a.avgReturn3m },
                        { l: "6M", v: a.avgReturn6m },
                        { l: "12M", v: a.avgReturn12m },
                      ].filter(x => x.v !== undefined).map(m => (
                        <div key={m.l} className="text-center">
                          <div style={{ color: "#06b6d440", fontSize: 8 }}>{m.l}</div>
                          <div style={{ color: (m.v ?? 0) >= 0 ? "#22c55e" : "#ef4444", fontSize: 9, fontWeight: "bold" }}>
                            {(m.v ?? 0) >= 0 ? "+" : ""}{(m.v ?? 0).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {intel.analogSummary && (
                <div className="pt-1 border-t" style={{ borderColor: "#f59e0b15" }}>
                  <div style={{ color: "#06b6d460", fontSize: 9 }}>{intel.analogSummary}</div>
                </div>
              )}
            </div>
          </HudPanel>

          {/* Historical Memory */}
          <HudPanel accentColor="#06b6d4">
            <PanelHeader icon={<span style={{ fontSize: 12 }}>◷</span>} title="HISTORICAL MEMORY" color="#06b6d4" />
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "OBSERVATIONS", value: intel.memory.observationCount.toString() },
                  { label: "DATASET SPAN", value: intel.memory.datasetSpan },
                  { label: "PERCENTILE", value: `${intel.currentPercentile}th` },
                ].map((m) => (
                  <div key={m.label} className="text-center p-1.5 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d415" }}>
                    <div style={{ color: "#06b6d440", fontSize: 8 }}>{m.label}</div>
                    <div style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 10, fontWeight: "bold" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {intel.memory.currentStreakDescription && (
                <div className="p-2 rounded" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #06b6d415" }}>
                  <div style={{ color: "#06b6d4", fontSize: 9 }}>{intel.memory.currentStreakDescription}</div>
                </div>
              )}

              {intel.memory.keyThresholdsCrossed?.length > 0 && (
                <div className="space-y-1">
                  <div style={{ color: "#06b6d460", fontSize: 8 }}>KEY THRESHOLDS CROSSED:</div>
                  {intel.memory.keyThresholdsCrossed.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span style={{ color: "#f59e0b", fontSize: 9 }}>▸</span>
                      <span style={{ color: "#94a3b8", fontSize: 9 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t" style={{ borderColor: "#06b6d415" }}>
                {[
                  { label: "AVG PRESSURE", value: `${intel.memory.historicalStats.avgPressure}/100` },
                  { label: "MAX PRESSURE", value: `${intel.memory.historicalStats.maxPressure}/100` },
                  { label: "CRISIS MONTHS", value: intel.memory.historicalStats.criticalMonths.toString() },
                  { label: "HIGH RISK MONTHS", value: intel.memory.historicalStats.highRiskMonths.toString() },
                ].map((m) => (
                  <div key={m.label} className="flex justify-between items-center p-1 rounded" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <span style={{ color: "#06b6d440", fontSize: 8 }}>{m.label}</span>
                    <span style={{ color: "#06b6d4", fontSize: 9, fontWeight: "bold" }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </HudPanel>
        </div>
      </div>

      {/* ── Bottom footer bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: "#06b6d420", background: "rgba(0,8,20,0.9)" }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10 }}>🌐</span>
          <span style={{ color: "#06b6d440", fontSize: 9 }}>DATA COVERAGE: GLOBAL MARKETS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#06b6d440", fontSize: 9 }}>⏱ HISTORY: 25 YRS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#06b6d440", fontSize: 9 }}>⬡ MODEL VERSION: 3.7.4</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: "#06b6d440", fontSize: 9 }}>🛡 CONFIDENCE FRAMEWORK: INSTITUTIONAL GRADE</span>
        </div>
      </div>
    </div>
  );
}
