/**
 * FAULTLINE Seismograph Intelligence
 * Default post-login command center — institutional market intelligence
 * synthesized from 317+ months of historical data.
 *
 * Every section answers: What? Why? Evidence? Historical comparisons?
 * What next? What would invalidate this?
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, BarChart2, BookOpen, Brain,
  Calendar, ChevronDown, ChevronUp, Clock, Compass, GitBranch, History,
  Info, Layers, RefreshCw, Shield, SlidersHorizontal, Target, TrendingDown, TrendingUp,
  Zap,
} from "lucide-react";

// ─── Color helpers ────────────────────────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#eab308";
  if (score >= 30) return "#84cc16";
  return "#22c55e";
}
function pressureGlow(score: number): string {
  if (score >= 80) return "0 0 24px rgba(239,68,68,0.5)";
  if (score >= 65) return "0 0 24px rgba(249,115,22,0.4)";
  if (score >= 45) return "0 0 24px rgba(234,179,8,0.35)";
  return "0 0 24px rgba(34,197,94,0.35)";
}
function regimeColor(regime: string): string {
  const r = regime.toUpperCase();
  if (r.includes("CRITICAL") || r.includes("CRISIS")) return "#ef4444";
  if (r.includes("HIGH")) return "#f97316";
  if (r.includes("ELEVATED")) return "#eab308";
  if (r.includes("MODERATE")) return "#84cc16";
  return "#22c55e";
}
function regimeLabel(regime: string): string {
  const r = regime.toUpperCase();
  if (r.includes("CRITICAL")) return "Critical Stress";
  if (r.includes("HIGH")) return "High Risk";
  if (r.includes("ELEVATED")) return "Elevated Risk";
  if (r.includes("MODERATE")) return "Moderate Risk";
  if (r.includes("LOW")) return "Low Risk";
  return regime;
}
function signalColor(signal: string): string {
  if (signal === "stressed" || signal === "bearish") return "#ef4444";
  if (signal === "recovering" || signal === "bullish") return "#22c55e";
  return "#94a3b8";
}
function returnColor(r: number | null): string {
  if (r === null) return "text-slate-500";
  if (r >= 5) return "text-green-400";
  if (r >= 0) return "text-green-300";
  if (r >= -5) return "text-orange-400";
  return "text-red-400";
}
function formatMonth(m: string): string {
  const parts = m.split("-");
  const y = parts[0] ?? "";
  const mo = parts[1] ?? "01";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo) - 1] ?? "Jan"} '${y.slice(2)}`;
}
function trendIcon(trend: string) {
  if (trend === "deteriorating") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  if (trend === "improving") return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  return <Activity className="w-3.5 h-3.5 text-slate-400" />;
}

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimatedNumber({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return <>{val}</>;
}

// ─── Circular pressure gauge ──────────────────────────────────────────────────
function PressureGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(score), 300); return () => clearTimeout(t); }, [score]);
  const color = pressureColor(score);
  const glow = pressureGlow(score);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - animated / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
          {/* Zone bands */}
          {[
            { color: "#22c55e", start: 0, span: 0.30 },
            { color: "#84cc16", start: 0.30, span: 0.15 },
            { color: "#eab308", start: 0.45, span: 0.20 },
            { color: "#f97316", start: 0.65, span: 0.15 },
            { color: "#ef4444", start: 0.80, span: 0.20 },
          ].map((z, i) => (
            <circle key={i} cx="60" cy="60" r="52" fill="none" stroke={z.color} strokeWidth="4" strokeOpacity="0.2"
              strokeDasharray={`${circumference * z.span} ${circumference * (1 - z.span)}`}
              strokeDashoffset={-circumference * z.start} />
          ))}
          {/* Progress arc */}
          <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1), stroke 0.6s ease",
              filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}80)` }} />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 2 * Math.PI - Math.PI / 2;
            const x1 = 60 + 46 * Math.cos(angle); const y1 = 60 + 46 * Math.sin(angle);
            const x2 = 60 + 55 * Math.cos(angle); const y2 = 60 + 55 * Math.sin(angle);
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-black tabular-nums" style={{ color, textShadow: glow, fontFamily: "'IBM Plex Mono', monospace" }}>
            <AnimatedNumber target={Math.round(animated)} />
          </div>
          <div className="text-xs text-slate-600 tracking-widest mt-0.5">/ 100</div>
        </div>
      </div>
      <div className="flex justify-between w-48 px-1">
        {["0","25","50","75","100"].map((l) => (
          <span key={l} className="text-xs text-slate-600">{l}</span>
        ))}
      </div>
      <div className="text-xs text-slate-500 uppercase tracking-widest">Systemic Pressure Index</div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ id, icon, title, subtitle, children, accentColor = "#0ea5e9" }: {
  id: string; icon: React.ReactNode; title: string; subtitle: string;
  children: React.ReactNode; accentColor?: string;
}) {
  return (
    <section id={id} className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full" style={{ background: accentColor, opacity: 0.5 }} />
      <div className="pl-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span style={{ color: accentColor }}>{icon}</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

// ─── Probability bar ──────────────────────────────────────────────────────────
function ProbabilityBar({ label, value, color, description }: {
  label: string; value: number; color: string; description?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 600); return () => clearTimeout(t); }, [value]);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${w}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
      </div>
      {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
    </div>
  );
}

// ─── Evidence family card ─────────────────────────────────────────────────────
function EvidenceFamilyCard({ family }: { family: {
  name: string; signal: string; strength: number; currentValue: string;
  historicalContext: string; trend: string; whyItMatters: string;
}}) {
  const [expanded, setExpanded] = useState(false);
  const color = signalColor(family.signal);
  return (
    <div className="rounded-lg border cursor-pointer transition-all duration-200"
      style={{ borderColor: expanded ? `${color}40` : "#1e293b", background: expanded ? `${color}08` : "#0f172a" }}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-200 truncate">{family.name}</div>
            <div className="text-xs text-slate-500 truncate">{family.currentValue}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {trendIcon(family.trend)}
          <div className="text-right">
            <div className="text-xs font-bold" style={{ color }}>{family.signal.charAt(0).toUpperCase() + family.signal.slice(1)}</div>
            <div className="text-xs text-slate-500">{family.strength}/100</div>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-800 pt-2.5">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1">Historical Context</div>
            <p className="text-xs text-slate-300 leading-relaxed">{family.historicalContext}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1">Why It Matters</div>
            <p className="text-xs text-slate-400 leading-relaxed">{family.whyItMatters}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analog card ──────────────────────────────────────────────────────────────
function AnalogCard({ analog, rank }: { analog: {
  period: string; label: string; similarity: number; score: number; regime: string;
  description: string; outcome3m: string; outcome6m: string; outcome12m: string;
  avgReturn3m: number | null; avgReturn6m: number | null; avgReturn12m: number | null;
  durationMonths: number; peakPressure: number; resolution: string;
}; rank: number }) {
  const [expanded, setExpanded] = useState(rank === 0);
  const color = regimeColor(analog.regime);
  return (
    <div className="rounded-lg border cursor-pointer transition-all"
      style={{ borderColor: expanded ? `${color}40` : "#1e293b", background: expanded ? `${color}06` : "#0f172a" }}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: `${color}20`, color }}>{rank + 1}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-200 truncate">{analog.label}</div>
            <div className="text-xs text-slate-500">{analog.durationMonths} months · Peak: {analog.peakPressure}/100</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="text-right">
            <div className="text-sm font-bold" style={{ color }}>{analog.similarity}%</div>
            <div className="text-xs text-slate-500">match</div>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-800 pt-2.5">
          <p className="text-xs text-slate-300 leading-relaxed">{analog.description}</p>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">What Happened Next</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "3 Months", value: analog.avgReturn3m, text: analog.outcome3m },
                { label: "6 Months", value: analog.avgReturn6m, text: analog.outcome6m },
                { label: "12 Months", value: analog.avgReturn12m, text: analog.outcome12m },
              ].map((o) => (
                <div key={o.label} className="rounded bg-slate-800/60 p-2 text-center">
                  <div className="text-xs text-slate-500 mb-0.5">{o.label}</div>
                  <div className={`text-sm font-bold tabular-nums ${returnColor(o.value)}`}>
                    {o.value !== null ? `${o.value > 0 ? "+" : ""}${o.value}%` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Resolution: </span>{analog.resolution}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pattern card ─────────────────────────────────────────────────────────────
function PatternCard({ pattern }: { pattern: {
  name: string; description: string; confidence: number; daysActive: number;
  historicalFrequency: string;
  outcomeDistribution: { bullish: number; sideways: number; correction: number };
  avgReturn1m: number; avgReturn3m: number; avgReturn6m: number;
  invalidationConditions: string; analogs: string[];
}}) {
  const [expanded, setExpanded] = useState(false);
  const conf = pattern.confidence;
  const confColor = conf >= 75 ? "#22c55e" : conf >= 55 ? "#eab308" : "#94a3b8";
  return (
    <div className="rounded-lg border cursor-pointer transition-all"
      style={{ borderColor: expanded ? "#0ea5e940" : "#1e293b", background: expanded ? "#0ea5e908" : "#0f172a" }}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: confColor, boxShadow: `0 0 4px ${confColor}` }} />
            <div className="text-sm font-semibold text-slate-200 truncate">{pattern.name}</div>
          </div>
          <div className="text-xs text-slate-500">{pattern.historicalFrequency}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="text-right">
            <div className="text-xs font-bold" style={{ color: confColor }}>{conf}%</div>
            <div className="text-xs text-slate-500">confidence</div>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-800 pt-2.5">
          <p className="text-xs text-slate-300 leading-relaxed">{pattern.description}</p>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">Historical Outcome Distribution</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: "Bullish", value: pattern.outcomeDistribution.bullish, color: "#22c55e" },
                { label: "Sideways", value: pattern.outcomeDistribution.sideways, color: "#94a3b8" },
                { label: "Correction", value: pattern.outcomeDistribution.correction, color: "#ef4444" },
              ].map((o) => (
                <div key={o.label} className="rounded bg-slate-800/60 p-2 text-center">
                  <div className="text-xs text-slate-500 mb-0.5">{o.label}</div>
                  <div className="text-sm font-bold" style={{ color: o.color }}>{o.value}%</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">Average Returns After Pattern</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "1 Month", value: pattern.avgReturn1m },
                { label: "3 Months", value: pattern.avgReturn3m },
                { label: "6 Months", value: pattern.avgReturn6m },
              ].map((r) => (
                <div key={r.label} className="rounded bg-slate-800/60 p-2 text-center">
                  <div className="text-xs text-slate-500 mb-0.5">{r.label}</div>
                  <div className={`text-sm font-bold tabular-nums ${returnColor(r.value)}`}>
                    {r.value > 0 ? "+" : ""}{r.value}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Invalidation: </span>{pattern.invalidationConditions}
          </div>
          {pattern.analogs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pattern.analogs.map((a) => (
                <span key={a} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">{a}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Timeline chart ───────────────────────────────────────────────────────────
function TimelineChart({ data, annotations }: {
  data: Array<{ month: string; score: number; regime: string }>;
  annotations: Array<{ month: string; annotation: string }>;
}) {
  const step = Math.max(1, Math.floor(data.length / 120));
  const sampled = data.filter((_, i) => i % step === 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { month: string; score: number; regime: string } }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const ann = annotations.find((a) => a.month === d.month);
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs max-w-xs">
        <div className="font-bold text-slate-200 mb-0.5">{formatMonth(d.month)}</div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: pressureColor(d.score) }} />
          <span style={{ color: pressureColor(d.score) }}>{d.score}/100</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{regimeLabel(d.regime)}</span>
        </div>
        {ann && <div className="text-slate-300 mt-1 leading-relaxed">{ann.annotation}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={sampled} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 9, fill: "#475569" }}
            interval={Math.floor(sampled.length / 8)} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine y={65} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={45} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={30} stroke="#84cc16" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Area type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#pressureGrad)" dot={false} />
          {annotations.map((ann) => (
            <ReferenceLine key={ann.month} x={ann.month} stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity={0.5} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {annotations.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {annotations.slice(0, 8).map((ann) => (
            <div key={ann.month} className="flex items-start gap-2 text-xs">
              <span className="text-amber-400 flex-shrink-0 font-mono">{formatMonth(ann.month)}</span>
              <span className="text-slate-400 leading-relaxed">{ann.annotation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preset windows ───────────────────────────────────────────────────────────
const PRESETS = [
  { label: "7D",  months: 1,   desc: "7 days" },
  { label: "30D", months: 1,   desc: "30 days" },
  { label: "90D", months: 3,   desc: "90 days" },
  { label: "6M",  months: 6,   desc: "6 months" },
  { label: "1Y",  months: 12,  desc: "1 year" },
  { label: "3Y",  months: 36,  desc: "3 years" },
  { label: "5Y",  months: 60,  desc: "5 years" },
  { label: "All", months: 999, desc: "Full history" },
] as const;

// Compute trend summary from a slice of timeline data
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

// ─── Evolution chart with date-range selector ─────────────────────────────────
function EvolutionChart({ timeline }: {
  timeline: Array<{ month: string; score: number; regime: string; isAnnotated: boolean; annotation?: string }>;
}) {
  const [preset, setPreset] = useState<string>("90D");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  // Derive the visible slice
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
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs max-w-xs shadow-xl">
        <div className="font-bold text-slate-200 mb-0.5">{formatMonth(d.month)}</div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: pressureColor(d.score) }} />
          <span style={{ color: pressureColor(d.score) }}>{d.score}/100</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{regimeLabel(d.regime)}</span>
        </div>
        {d.annotation && <div className="text-amber-300 mt-1 leading-relaxed border-t border-slate-700 pt-1">{d.annotation}</div>}
      </div>
    );
  };

  // Determine tick interval based on slice length
  const tickInterval = slice.length <= 12 ? 0 : slice.length <= 36 ? 2 : slice.length <= 72 ? 5 : Math.floor(slice.length / 12);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
          {PRESETS.map((p) => (
            <button key={p.label}
              onClick={() => { setPreset(p.label); setShowCustom(false); }}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
              style={{
                background: preset === p.label && !showCustom ? "#0ea5e9" : "transparent",
                color: preset === p.label && !showCustom ? "#fff" : "#64748b",
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border"
          style={{
            background: showCustom ? "#0ea5e920" : "transparent",
            color: showCustom ? "#0ea5e9" : "#64748b",
            borderColor: showCustom ? "#0ea5e940" : "#334155",
          }}>
          <Calendar className="w-3 h-3" />
          Custom Range
        </button>
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">From</span>
              <input ref={startRef} type="month" value={customStart}
                min={timeline[0]?.month ?? "2000-01"}
                max={(customEnd || timeline[timeline.length - 1]?.month) ?? "2025-12"}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs rounded bg-slate-900 border border-slate-600 text-slate-200 px-2 py-1 focus:outline-none focus:border-sky-500" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">To</span>
              <input ref={endRef} type="month" value={customEnd}
                min={(customStart || timeline[0]?.month) ?? "2000-01"}
                max={timeline[timeline.length - 1]?.month ?? "2025-12"}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs rounded bg-slate-900 border border-slate-600 text-slate-200 px-2 py-1 focus:outline-none focus:border-sky-500" />
            </div>
            {customStart && customEnd && (
              <button onClick={() => { setCustomStart(""); setCustomEnd(""); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={slice} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="evolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 9, fill: "#475569" }}
            interval={tickInterval} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine y={65} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={45} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={30} stroke="#84cc16" strokeDasharray="3 3" strokeOpacity={0.3} />
          <Area type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#evolGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Dynamic trend summary */}
      {trend && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Direction", value: trend.direction, color: trend.dirColor },
            { label: "Net Change", value: `${trend.delta >= 0 ? "+" : ""}${trend.delta} pts`, color: trend.dirColor },
            { label: "Avg Pressure", value: `${trend.avg}/100`, color: pressureColor(trend.avg) },
            { label: "Range", value: `${trend.min}–${trend.max}`, color: "#94a3b8" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-800/60 p-2.5 text-center">
              <div className="text-xs text-slate-500 mb-0.5">{m.label}</div>
              <div className="text-xs font-bold" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
      {trend && trend.regimeCount >= 2 && (
        <div className="text-xs text-slate-500">
          <span className="text-slate-400 font-medium">{trend.regimeCount} regimes</span> observed across this {trend.months}-month window
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-800/60 rounded animate-pulse" />
        </div>
        <div className="space-y-6 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="rounded-xl bg-slate-800/40 h-40" />)}
        </div>
      </div>
    );
  }

  if (error || !intel) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-200 mb-2">Intelligence Engine Initializing</h2>
          <p className="text-sm text-slate-400 mb-4">
            The Seismograph is loading historical market data. This typically takes under 30 seconds.
          </p>
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors">
            <RefreshCw className={`w-4 h-4 ${seedMutation.isPending ? "animate-spin" : ""}`} />
            {seedMutation.isPending ? "Loading..." : "Initialize Engine"}
          </button>
        </div>
      </div>
    );
  }

  const scoreColor = pressureColor(intel.currentScore);
  const annotatedPoints = intel.timeline.filter((t) => t.isAnnotated);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-sky-400" />
              <h1 className="text-xl font-black tracking-tight text-slate-100">SEISMOGRAPH INTELLIGENCE</h1>
            </div>
            <p className="text-xs text-slate-500">
              Institutional market intelligence synthesized from {intel.memory.observationCount} months of historical data
              · {intel.memory.datasetSpan}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: intel.dataFreshness === "live" ? "#0ea5e920" : "#f59e0b20",
                color: intel.dataFreshness === "live" ? "#0ea5e9" : "#f59e0b",
                border: `1px solid ${intel.dataFreshness === "live" ? "#0ea5e940" : "#f59e0b40"}`,
              }}>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: intel.dataFreshness === "live" ? "#0ea5e9" : "#f59e0b" }} />
              {intel.dataFreshness === "live" ? "Live" : "Historical"}
            </div>
            <button onClick={() => refetch()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── 1: Today's Market Story ── */}
        <Section id="story" icon={<Brain className="w-4 h-4" />}
          title="Today's Market Story"
          subtitle="What is happening and why — synthesized from all intelligence engines"
          accentColor="#0ea5e9">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed font-medium">{intel.todayStory}</p>
            {intel.keyDevelopments.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Developments</div>
                <div className="space-y-1.5">
                  {intel.keyDevelopments.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                      <span className="text-slate-300 leading-relaxed">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-slate-800/60 p-3">
                <div className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3 h-3" /> Why This Score
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{intel.whyThisScore}</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-3">
                <div className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3 h-3" /> Why This Regime
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{intel.whyThisRegime}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 2: Pressure Index ── */}
        <Section id="pressure" icon={<Zap className="w-4 h-4" />}
          title="Current Pressure Index"
          subtitle="Systemic stress level synthesized from all contributing intelligence engines"
          accentColor={scoreColor}>
          <div className="rounded-xl border bg-slate-900/60 p-5" style={{ borderColor: `${scoreColor}30` }}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <PressureGauge score={intel.currentScore} />
                <div className="text-center mt-1">
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: scoreColor }}>
                    {intel.currentStressLevel} STRESS
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { label: "Regime", value: regimeLabel(intel.currentRegime), color: regimeColor(intel.currentRegime) },
                    { label: "Direction", value: intel.currentDirection,
                      color: intel.currentDirection === "Improving" ? "#22c55e" : intel.currentDirection === "Deteriorating" ? "#ef4444" : "#94a3b8" },
                    { label: "Percentile", value: `${intel.currentPercentile}th`, color: scoreColor },
                    { label: "Observations", value: `${intel.memory.observationCount} mo`, color: "#94a3b8" },
                    { label: "Evidence", value: intel.evidenceConsensus.charAt(0).toUpperCase() + intel.evidenceConsensus.slice(1), color: "#0ea5e9" },
                    { label: "Dataset", value: intel.memory.datasetSpan, color: "#64748b" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-slate-800/60 p-2.5 text-center">
                      <div className="text-xs text-slate-500 mb-0.5">{m.label}</div>
                      <div className="text-xs font-bold truncate" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {intel.enginesAgreeing.slice(0, 3).map((e) => (
                    <span key={e} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430" }}>{e}</span>
                  ))}
                  {intel.enginesDisagreeing.slice(0, 2).map((e) => (
                    <span key={e} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e30" }}>{e}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 3: Current Regime ── */}
        <Section id="regime" icon={<Compass className="w-4 h-4" />}
          title="Current Regime"
          subtitle="The prevailing market environment — what it means and what evidence supports it"
          accentColor="#8b5cf6">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-base font-bold text-slate-100">{regimeLabel(intel.currentRegime)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {intel.probabilities.confidence}% confidence · {intel.probabilities.primaryDriver} primary driver
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${regimeColor(intel.currentRegime)}20`, color: regimeColor(intel.currentRegime),
                    border: `1px solid ${regimeColor(intel.currentRegime)}40` }}>
                  {intel.currentPercentile}th pctile
                </div>
              </div>
              <div className="space-y-3">
                <ProbabilityBar label="Bull / Recovery" value={intel.probabilities.bull} color="#22c55e"
                  description={intel.probabilities.bull >= 40 ? "Constructive conditions — risk-on positioning historically appropriate" : undefined} />
                <ProbabilityBar label="Neutral / Consolidation" value={intel.probabilities.neutral} color="#94a3b8" />
                <ProbabilityBar label="Bear / Deterioration" value={intel.probabilities.bear} color="#ef4444"
                  description={intel.probabilities.bear >= 40 ? "Elevated risk — defensive positioning historically appropriate" : undefined} />
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Evidence basis: </span>{intel.probabilities.evidenceBasis}
                </div>
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Historical basis: </span>{intel.probabilities.historicalBasis}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Intelligence Engine Breakdown</div>
              <div className="space-y-2">
                {intel.evidenceFamilies.map((f) => <EvidenceFamilyCard key={f.name} family={f} />)}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 4: Active Patterns ── */}
        <Section id="patterns" icon={<Layers className="w-4 h-4" />}
          title="Active Patterns"
          subtitle="What is developing beneath the surface — detected from historical pattern analysis"
          accentColor="#f59e0b">
          {intel.activePatterns.length > 0 ? (
            <div className="space-y-2">
              {intel.activePatterns.map((p) => <PatternCard key={p.name} pattern={p} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-300 mb-1">No Elevated Patterns Active</div>
              <p className="text-xs text-slate-500">
                Current conditions do not match any historically significant pattern thresholds.
                This is a constructive signal — elevated patterns typically precede stress events.
              </p>
            </div>
          )}
        </Section>

        {/* ── 5: Regime Transition Probabilities ── */}
        <Section id="transitions" icon={<GitBranch className="w-4 h-4" />}
          title="Regime Transition Probabilities"
          subtitle="Where the market is most likely heading — computed from historical transition rates"
          accentColor="#0ea5e9">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="space-y-3">
              <ProbabilityBar label="Remain in Current Regime" value={intel.transitionProbabilities.remainInRegime} color="#0ea5e9" />
              <ProbabilityBar label="Transition to Elevated / High Risk" value={intel.transitionProbabilities.transitionToElevated} color="#f97316" />
              <ProbabilityBar label="Transition to Lower Risk" value={intel.transitionProbabilities.transitionToLow} color="#22c55e" />
              <ProbabilityBar label="Transition to Crisis" value={intel.transitionProbabilities.transitionToCrisis} color="#ef4444" />
            </div>
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: "#0ea5e920", color: "#0ea5e9" }}>
                  {intel.transitionProbabilities.confidence}% confidence
                </div>
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Historical basis: </span>
                {intel.transitionProbabilities.historicalBasis}
              </div>
              {intel.transitionProbabilities.currentEvidence.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                  <span className="text-slate-400">{e}</span>
                </div>
              ))}
            </div>
            {intel.recentTransitions.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent Regime Changes</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {intel.recentTransitions.slice(0, 6).map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-slate-500 font-mono flex-shrink-0">{formatMonth(t.date)}</span>
                      <span className="text-slate-400">
                        <span style={{ color: regimeColor(t.fromRegime) }}>{regimeLabel(t.fromRegime)}</span>
                        {" → "}
                        <span style={{ color: regimeColor(t.toRegime) }}>{regimeLabel(t.toRegime)}</span>
                        {" · "}{t.pressureAtTransition}/100
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── 6: Evolution Analysis ── */}
        <Section id="evolution" icon={<BarChart2 className="w-4 h-4" />}
          title="Evolution Analysis"
          subtitle="How conditions have changed across any time window — select a preset or define a custom date range"
          accentColor="#22c55e">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <EvolutionChart timeline={intel.timeline} />
            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs font-semibold text-slate-400 mb-2">Standard Trend Windows</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { label: "7-Day", value: intel.evolution.sevenDayTrend, color: "#0ea5e9" },
                  { label: "30-Day", value: intel.evolution.thirtyDayTrend, color: "#8b5cf6" },
                  { label: "90-Day", value: intel.evolution.ninetyDayTrend, color: "#f59e0b" },
                  { label: "12-Month", value: intel.evolution.yearTrend, color: "#22c55e" },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg bg-slate-800/60 p-3">
                    <div className="text-xs font-semibold mb-0.5" style={{ color: t.color }}>{t.label}</div>
                    <div className="text-xs text-slate-300">{t.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {(intel.evolution.accelerating || intel.evolution.buildingPressure) && (
              <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-orange-300">
                  {intel.evolution.accelerating
                    ? "Pressure is accelerating — both 7-day and 30-day trends are rising simultaneously."
                    : "Pressure is building across all measured timeframes — sustained deterioration."}
                </div>
              </div>
            )}
            {intel.evolution.whatChanged.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">What Changed</div>
                <div className="space-y-1">
                  {intel.evolution.whatChanged.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                      <span className="text-slate-300">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">What to Monitor</div>
              <div className="space-y-1">
                {intel.evolution.whatToWatch.slice(0, 4).map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Target className="w-3 h-3 text-sky-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-400">{w}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">What Would Invalidate This Assessment</div>
              <div className="space-y-1">
                {intel.evolution.invalidationConditions.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Shield className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-400">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 7: Historical Memory ── */}
        <Section id="memory" icon={<History className="w-4 h-4" />}
          title="Historical Memory"
          subtitle="The closest historical environments and what happened next — from 317 months of institutional data"
          accentColor="#f59e0b">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Dataset", value: `${intel.memory.observationCount} months`, color: "#0ea5e9" },
                  { label: "Avg Pressure", value: `${intel.memory.historicalStats.avgPressure}/100`, color: "#94a3b8" },
                  { label: "Peak Pressure", value: `${intel.memory.historicalStats.maxPressure}/100`, color: "#ef4444" },
                  { label: "Longest Streak", value: `${intel.memory.longestStreak} mo`, color: "#f59e0b" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-slate-800/60 p-2.5 text-center">
                    <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
                    <div className="text-xs font-bold" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">Historical Regime Distribution ({intel.memory.observationCount} months)</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Low Risk", months: intel.memory.historicalStats.lowMonths, color: "#22c55e" },
                    { label: "Moderate Risk", months: intel.memory.historicalStats.moderateMonths, color: "#84cc16" },
                    { label: "Elevated Risk", months: intel.memory.historicalStats.elevatedMonths, color: "#eab308" },
                    { label: "High Risk", months: intel.memory.historicalStats.highRiskMonths, color: "#f97316" },
                    { label: "Critical", months: intel.memory.historicalStats.criticalMonths, color: "#ef4444" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 w-24 flex-shrink-0">{r.label}</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${(r.months / intel.memory.observationCount) * 100}%`, background: r.color }} />
                      </div>
                      <span className="text-slate-500 w-20 text-right">
                        {r.months} mo ({Math.round((r.months / intel.memory.observationCount) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-slate-400 pt-1">
                <span className="font-semibold text-slate-300">Current streak: </span>{intel.memory.currentStreakDescription}
              </div>
              {intel.memory.lastMajorShift && (
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Last major shift: </span>{intel.memory.lastMajorShift}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Analog Engine Summary
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{intel.analogSummary}</p>
            </div>

            {intel.analogs.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Closest Historical Analogs</div>
                {intel.analogs.map((a, i) => <AnalogCard key={a.period} analog={a} rank={i} />)}
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Full Historical Timeline ({intel.memory.observationCount} months)
              </div>
              <TimelineChart
                data={intel.timeline}
                annotations={annotatedPoints.map((t) => ({ month: t.month, annotation: t.annotation ?? "" }))}
              />
            </div>
          </div>
        </Section>

        {/* ── Next Steps ── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Continue Your Analysis</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Signal Outlook", href: "/app/signal-outlook", icon: <Target className="w-3.5 h-3.5" />, desc: "Asset-level signals" },
              { label: "Symbol Intelligence", href: "/app/discover", icon: <BarChart2 className="w-3.5 h-3.5" />, desc: "Individual stock analysis" },
              { label: "Daily Briefing", href: "/app/daily-report", icon: <BookOpen className="w-3.5 h-3.5" />, desc: "Today's full briefing" },
              { label: "Pressure Index", href: "/app/pressure-index", icon: <Zap className="w-3.5 h-3.5" />, desc: "Deep pressure analysis" },
              { label: "Pre-Flight Check", href: "/app/preflight", icon: <Shield className="w-3.5 h-3.5" />, desc: "Market readiness" },
              { label: "Ask FAULTLINE", href: "/app/ask", icon: <Brain className="w-3.5 h-3.5" />, desc: "AI market intelligence" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all cursor-pointer group">
                  <span className="text-slate-500 group-hover:text-sky-400 transition-colors">{link.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors truncate">{link.label}</div>
                    <div className="text-xs text-slate-600 truncate">{link.desc}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-sky-400 ml-auto flex-shrink-0 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
