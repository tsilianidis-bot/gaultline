import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  History,
  RefreshCw,
  ShieldCheck,
  Telescope,
  TrendingDown,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import { formatCanonicalPercent, formatCanonicalScore } from "@shared/marketMetrics";
import DataFreshnessChip from "@/components/DataFreshnessChip";
import { PageLoadingState, PageDegradedBanner } from "@/components/PageStateViews";

const NOW_DEEP_PATH = "/app/now/deep";

// ── Color helpers ────────────────────────────────────────────────────────────
function pressureColor(score: number) {
  if (score >= 75) return "#ff4d6d";
  if (score >= 50) return "#ffaa00";
  if (score >= 30) return "#00e5ff";
  return "#00e599";
}

function pressureLabel(score: number) {
  if (score >= 75) return "CRITICAL";
  if (score >= 60) return "ELEVATED";
  if (score >= 40) return "MODERATE";
  if (score >= 20) return "LOW";
  return "MINIMAL";
}

// ── Staged load hook ─────────────────────────────────────────────────────────
function useStagedLoad(stages: number[], deps: unknown[]) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    stages.forEach((delay, i) => {
      timers.push(setTimeout(() => setPhase(i + 1), delay));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return phase;
}

// ── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, active = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, active]);
  return value;
}

// ── Living seismic background ────────────────────────────────────────────────
function SeismicBackground({ pressure, accent }: { pressure: number; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const speed = 0.3 + (pressure / 100) * 0.7;
    const intensityVal = 0.3 + (pressure / 100) * 0.7;

    const draw = () => {
      tRef.current += 0.008 * speed;
      const t = tRef.current;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Subsurface grid
      ctx.strokeStyle = `rgba(0,229,255,${0.03 * intensityVal})`;
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Seismic waveforms (3 layers)
      const waveConfigs = [
        { y: H * 0.35, amp: 8 * intensityVal, freq: 0.012, phase: 0, alpha: 0.12 },
        { y: H * 0.55, amp: 14 * intensityVal, freq: 0.008, phase: Math.PI * 0.7, alpha: 0.08 },
        { y: H * 0.72, amp: 6 * intensityVal, freq: 0.018, phase: Math.PI * 1.3, alpha: 0.06 },
      ];

      waveConfigs.forEach(({ y, amp, freq, phase, alpha }) => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 2) {
          const wy = y + amp * Math.sin(x * freq + t + phase) * Math.cos(x * freq * 0.3 + t * 0.5);
          x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
        }
        ctx.stroke();
      });

      // Pressure pulse rings (emanate from center)
      const cx = W * 0.5;
      const cy = H * 0.4;
      const pulseCount = 3;
      for (let i = 0; i < pulseCount; i++) {
        const progress = ((t * 0.4 + i / pulseCount) % 1);
        const r = progress * Math.min(W, H) * 0.6;
        const alpha = (1 - progress) * 0.06 * intensityVal;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Soft illuminated nodes
      const nodes = [
        { x: W * 0.15, y: H * 0.25 },
        { x: W * 0.82, y: H * 0.35 },
        { x: W * 0.65, y: H * 0.7 },
        { x: W * 0.28, y: H * 0.65 },
      ];
      nodes.forEach(({ x, y }, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.2);
        const r = (2 + pulse * 2) * intensityVal;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        grad.addColorStop(0, `rgba(0,229,255,${0.15 * pulse * intensityVal})`);
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [pressure, accent]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.6 }}
    />
  );
}

// ── Dominant pressure instrument ─────────────────────────────────────────────
function PressureInstrument({
  score, accent, regime, direction, historicalPercentile, confidence, lastUpdated, phase,
}: {
  score: number; accent: string; regime: string; direction: string;
  historicalPercentile: number | null; confidence?: number; lastUpdated?: Date | null; phase: number;
}) {
  const displayScore = useCountUp(score, 1400, phase >= 3);
  const r = 110;
  const cx = 160;
  const cy = 155;
  const startAngle = -215;
  const sweepAngle = 250;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(toRad(from));
    const y1 = cy + radius * Math.sin(toRad(from));
    const x2 = cx + radius * Math.cos(toRad(to));
    const y2 = cy + radius * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  const endAngle = startAngle + sweepAngle;
  const fillAngle = startAngle + (sweepAngle * Math.min(100, Math.max(0, score))) / 100;
  const needleAngle = fillAngle;
  const nx = cx + (r - 8) * Math.cos(toRad(needleAngle));
  const ny = cy + (r - 8) * Math.sin(toRad(needleAngle));

  // Scale tick marks
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angle = startAngle + (sweepAngle * i) / 10;
    const inner = r + 16;
    const outer = r + (i % 5 === 0 ? 28 : 20);
    return {
      x1: cx + inner * Math.cos(toRad(angle)),
      y1: cy + inner * Math.sin(toRad(angle)),
      x2: cx + outer * Math.cos(toRad(angle)),
      y2: cy + outer * Math.sin(toRad(angle)),
      label: i % 5 === 0 ? String(i * 10) : null,
      lx: cx + (outer + 10) * Math.cos(toRad(angle)),
      ly: cy + (outer + 10) * Math.sin(toRad(angle)),
      major: i % 5 === 0,
    };
  });

  // Danger zone arc (75–100)
  const dangerStart = startAngle + (sweepAngle * 75) / 100;

  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "scale(1)" : "scale(0.92)",
        transition: "opacity 0.8s cubic-bezier(0.23,1,0.32,1), transform 0.8s cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* Outer diagnostic ring glow */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 340, height: 340,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${accent}12 0%, ${accent}04 50%, transparent 70%)`,
          boxShadow: `0 0 80px ${accent}20, 0 0 160px ${accent}08`,
        }}
      />

      <svg viewBox="0 0 320 280" width="100%" style={{ maxWidth: 360 }} aria-hidden="true">
        <defs>
          <filter id="glow-inst">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-needle">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e599" />
            <stop offset="50%" stopColor="#ffaa00" />
            <stop offset="100%" stopColor="#ff4d6d" />
          </linearGradient>
        </defs>

        {/* Outer diagnostic ring */}
        <circle
          cx={cx} cy={cy} r={r + 42}
          fill="none"
          stroke={`${accent}20`}
          strokeWidth="1"
          strokeDasharray="4 8"
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 0.6s ease 0.2s",
          }}
        />

        {/* Track */}
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Danger zone */}
        <path
          d={arcPath(dangerStart, endAngle, r)}
          fill="none"
          stroke="rgba(255,77,109,0.15)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Fill arc */}
        {score > 0 && (
          <path
            d={arcPath(startAngle, fillAngle, r)}
            fill="none"
            stroke={accent}
            strokeWidth="14"
            strokeLinecap="round"
            filter="url(#glow-inst)"
            style={{ transition: "all 1.4s cubic-bezier(0.23,1,0.32,1)" }}
          />
        )}

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <g key={i} style={{ opacity: phase >= 1 ? 1 : 0, transition: `opacity 0.4s ease ${0.1 + i * 0.03}s` }}>
            <line
              x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2}
              stroke={tick.major ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}
              strokeWidth={tick.major ? 1.5 : 0.8}
            />
            {tick.label && (
              <text
                x={tick.lx} y={tick.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize="8"
                fontFamily="monospace"
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}

        {/* Needle dot */}
        <circle
          cx={nx} cy={ny} r="7"
          fill={accent}
          filter="url(#glow-needle)"
          style={{ transition: "all 1.4s cubic-bezier(0.23,1,0.32,1)" }}
        />
        <circle cx={nx} cy={ny} r="3" fill="white" style={{ transition: "all 1.4s cubic-bezier(0.23,1,0.32,1)" }} />

        {/* Center score */}
        <text
          x={cx} y={cy - 18}
          textAnchor="middle"
          fill="white"
          fontSize="52"
          fontFamily="Rajdhani, sans-serif"
          fontWeight="700"
          style={{ opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          {displayScore}
        </text>
        <text
          x={cx} y={cy + 12}
          textAnchor="middle"
          fill={accent}
          fontSize="10"
          fontFamily="monospace"
          letterSpacing="4"
          style={{ opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          {pressureLabel(score)}
        </text>
        <text
          x={cx} y={cy + 30}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize="8"
          fontFamily="monospace"
          letterSpacing="2"
          style={{ opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.5s ease" }}
        >
          PRESSURE INDEX
        </text>

        {/* Scale labels */}
        <text x="28" y={cy + 55} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">0</text>
        <text x="284" y={cy + 55} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">100</text>
      </svg>

      {/* Metadata strip below gauge */}
      <div
        className="mt-2 grid w-full grid-cols-2 gap-2 px-2"
        style={{ opacity: phase >= 5 ? 1 : 0, transition: "opacity 0.5s ease" }}
      >
        <div className="rounded border border-white/10 bg-white/[0.03] p-2.5 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Direction</p>
          <p className="mt-1 font-mono text-[10px] font-semibold text-white">{direction}</p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] p-2.5 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Percentile</p>
          <p className="mt-1 font-mono text-[10px] font-semibold text-white">
            {historicalPercentile !== null ? `${Math.round(historicalPercentile)}th` : "—"}
          </p>
        </div>
        {confidence !== undefined && (
          <div className="col-span-2 rounded border border-white/10 bg-white/[0.03] p-2.5 text-center">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-1 font-mono text-[10px] font-semibold text-white">{formatCanonicalPercent(confidence * 100)}</p>
          </div>
        )}
        {lastUpdated && (
          <div className="col-span-2 text-center">
            <p className="font-mono text-[8px] text-slate-600">Updated {lastUpdated.toLocaleTimeString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live seismograph waveform strip ──────────────────────────────────────────
function SeismographStrip({ pressure, accent, phase }: { pressure: number; accent: string; phase: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const scanRef = useRef(0);

  useEffect(() => {
    if (phase < 6) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const amplitude = 8 + (pressure / 100) * 22;
    const speed = 0.4 + (pressure / 100) * 0.8;

    const draw = () => {
      tRef.current += 0.015 * speed;
      scanRef.current = (scanRef.current + 1.2) % W;
      const t = tRef.current;
      const scan = scanRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background grid lines
      ctx.strokeStyle = "rgba(0,229,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let y = H * 0.25; y <= H * 0.75; y += H * 0.25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Waveform
      ctx.beginPath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = accent;
      for (let x = 0; x <= W; x += 1) {
        const age = (x - scan + W) % W;
        const fade = age / W;
        const wave = (H / 2) + amplitude * Math.sin(x * 0.04 + t) * Math.cos(x * 0.015 + t * 0.6)
          + (amplitude * 0.4) * Math.sin(x * 0.09 + t * 1.3);
        if (x === 0) ctx.moveTo(x, wave);
        else ctx.lineTo(x, wave);
      }
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Scan cursor
      ctx.beginPath();
      ctx.strokeStyle = `${accent}80`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.moveTo(scan, 0);
      ctx.lineTo(scan, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ripple dot at scan head
      const scanY = (H / 2) + amplitude * Math.sin(scan * 0.04 + t) * Math.cos(scan * 0.015 + t * 0.6);
      const rippleR = 3 + 2 * Math.sin(t * 4);
      ctx.beginPath();
      ctx.arc(scan, scanY, rippleR, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.shadowBlur = 12;
      ctx.shadowColor = accent;
      ctx.fill();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [pressure, accent, phase]);

  return (
    <div
      className="relative overflow-hidden rounded border border-white/10 bg-[#060a10]"
      style={{
        opacity: phase >= 6 ? 1 : 0,
        transition: "opacity 0.6s ease",
        height: 72,
      }}
    >
      <div className="absolute left-3 top-2 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">
        LIVE PRESSURE SIGNAL
      </div>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

// ── Active driver channel ────────────────────────────────────────────────────
function ActiveDriverChannel({
  label, strength, trend, index, phase,
}: { label: string; strength: number; trend: string; index: number; phase: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = pressureColor(strength);
  const trendIcon = trend === "deteriorating" ? "↑" : trend === "improving" ? "↓" : "→";
  const trendColor = trend === "deteriorating" ? "#ff4d6d" : trend === "improving" ? "#00e599" : "#64748b";
  const trendLabel = trend === "deteriorating" ? "Accelerating" : trend === "improving" ? "Fading" : "Stable";
  const animDelay = `${0.1 + index * 0.08}s`;

  return (
    <div
      className="group relative overflow-hidden rounded border border-white/10 bg-white/[0.025] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.04]"
      style={{
        opacity: phase >= 5 ? 1 : 0,
        transform: phase >= 5 ? "translateX(0)" : "translateX(-12px)",
        transition: `opacity 0.5s ease ${animDelay}, transform 0.5s ease ${animDelay}`,
      }}
    >
      {/* Energy flow shimmer on active portion */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 opacity-0 group-hover:opacity-100"
        style={{
          width: `${strength}%`,
          background: `linear-gradient(90deg, transparent, ${color}15, transparent)`,
          transition: "opacity 0.3s ease",
          animation: "driver-shimmer 2s linear infinite",
        }}
      />

      <button
        type="button"
        className="w-full p-3 text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="w-5 shrink-0 font-mono text-[9px] text-slate-600">{String(index + 1).padStart(2, "0")}</span>
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-200">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.08em]" style={{ color: trendColor }}>{trendIcon} {trendLabel}</span>
                <span className="font-mono text-[11px] font-semibold" style={{ color }}>{formatCanonicalScore(strength)}</span>
              </div>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${strength}%`,
                  background: `linear-gradient(90deg, ${color}80, ${color})`,
                  transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                  boxShadow: `0 0 8px ${color}60`,
                }}
              />
              {/* Leading edge pulse */}
              <div
                className="absolute top-0 h-full w-2 rounded-full"
                style={{
                  left: `calc(${strength}% - 4px)`,
                  background: color,
                  opacity: 0.8,
                  filter: `blur(2px)`,
                  transition: "left 1.2s cubic-bezier(0.23,1,0.32,1)",
                }}
              />
            </div>
          </div>
          <div className="ml-1 text-slate-600">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 px-4 pb-3 pt-2">
          <p className="text-xs leading-5 text-slate-400">
            Current reading: <span style={{ color }}>{formatCanonicalScore(strength)}</span> ·
            Trend: <span style={{ color: trendColor }}>{trendLabel}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Bull vs Bear card ────────────────────────────────────────────────────────
function BullBearCard({
  label, value, accent, description, phase, phaseTarget,
}: { label: string; value: number; accent: string; description: string; phase: number; phaseTarget: number }) {
  const displayValue = useCountUp(Math.round(value), 1000, phase >= phaseTarget);
  return (
    <div
      className="relative overflow-hidden rounded border bg-[#060a10] p-5"
      style={{
        borderColor: `${accent}30`,
        boxShadow: `0 0 30px ${accent}08`,
        opacity: phase >= phaseTarget ? 1 : 0,
        transform: phase >= phaseTarget ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${accent}08, transparent 60%)` }} />
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 font-['Rajdhani'] text-5xl font-bold" style={{ color: accent }}>
        {displayValue}<span className="text-2xl">%</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: accent, transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)", boxShadow: `0 0 8px ${accent}60` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

// ── What Changed panel ───────────────────────────────────────────────────────
function WhatChangedPanel({
  pressure, building, easing, direction, changedItems, regime, phase,
}: {
  pressure: number; building: number; easing: number; direction: string;
  changedItems: string[]; regime: string; phase: number;
}) {
  const accent = pressureColor(pressure);
  return (
    <div
      className="rounded border border-white/10 bg-[#060a10] p-5"
      style={{
        opacity: phase >= 7 ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">What Changed</p>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded border border-white/10 bg-white/[0.025] p-3 text-center">
          <TrendingUp size={14} className="mx-auto text-rose-300" />
          <p className="mt-2 font-['Rajdhani'] text-2xl text-white">{building}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-rose-300/70">Building</p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.025] p-3 text-center">
          <TrendingDown size={14} className="mx-auto text-emerald-300" />
          <p className="mt-2 font-['Rajdhani'] text-2xl text-white">{easing}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-emerald-300/70">Easing</p>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.025] p-3 text-center">
          <div className="mx-auto h-3.5 w-3.5 rounded-full" style={{ background: accent }} />
          <p className="mt-2 font-mono text-[9px] font-semibold text-white">{direction}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">Direction</p>
        </div>
      </div>
      <div className="space-y-2">
        {(changedItems.length ? changedItems : ["No verified directional change in current window."]).slice(0, 3).map(item => (
          <div key={item} className="flex gap-2 border-l-2 border-white/15 pl-3">
            <p className="text-xs leading-5 text-slate-400">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status rail ──────────────────────────────────────────────────────────────
function StatusRail({
  pressure, accent, isLive, lastUpdated, marketMode, phase,
}: {
  pressure: number; accent: string; isLive: boolean; lastUpdated?: Date | null;
  marketMode: string; phase: number;
}) {
  const items = [
    { label: "PRESSURE", value: formatCanonicalScore(pressure), color: accent },
    { label: "MODE", value: isLive ? "LIVE" : "PROTECTED", color: isLive ? "#00e599" : "#ffaa00" },
    { label: "UPDATED", value: lastUpdated ? lastUpdated.toLocaleTimeString() : "—", color: "rgba(255,255,255,0.5)" },
    { label: "STATE", value: marketMode.toUpperCase(), color: "rgba(255,255,255,0.4)" },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1 overflow-x-auto pb-1"
      style={{ opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.4s ease" }}
    >
      {items.map(item => (
        <div key={item.label} className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">{item.label}</span>
          <span className="font-mono text-[9px] font-semibold" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id, index, eyebrow, title, description, children,
}: {
  id: string; index: string; eyebrow: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section data-now-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`now-${id}-title`}>
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">{index} · {eyebrow}</p>
        <div>
          <h2 id={`now-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

// ── Destination link ─────────────────────────────────────────────────────────
function DestinationLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="group flex min-h-28 flex-col justify-between rounded border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-300">{label}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-sm leading-5 text-slate-400">{detail}</p>
        <ArrowRight className="shrink-0 text-cyan-300 transition-transform group-hover:translate-x-1" size={16} />
      </div>
    </Link>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Now() {
  const {
    output, marketState, marketMode, sourceHealth,
    isLoading, isLive, lastUpdated, dataError, refresh,
  } = useEngine();

  // Staged cinematic entry: phases 1–7 over ~5s
  const phase = useStagedLoad([0, 400, 900, 1500, 2200, 3000, 4000], [isLoading]);

  const fallbackDomains = useMemo(
    () => output.domains.slice(0, 5).map(domain => ({
      name: domain.label,
      signal: domain.riskLevel,
      strength: domain.score * 10,
      trend: domain.delta > 0.1 ? "deteriorating" : domain.delta < -0.1 ? "improving" : "stable",
      currentValue: formatCanonicalScore(domain.score * 10),
      historicalContext: "Canonical history is temporarily unavailable.",
      whyItMatters: domain.description,
    })),
    [output.domains],
  );

  const evidenceFamilies = marketState?.why.evidenceFamilies ?? fallbackDomains;
  const pressure = marketState?.now.pressureScore ?? output.overall.score * 10;
  const regime = marketState?.now.regime ?? output.regime.label;
  const stressLevel = marketState?.now.stressLevel ?? output.overall.riskLevel;
  const direction = marketState?.now.direction
    ?? (output.overall.delta > 0.1 ? "Deteriorating" : output.overall.delta < -0.1 ? "Improving" : "Stable");
  const headline = marketState?.now.headline ?? output.narrative.summary;
  const historicalPercentile = marketState?.now.historicalPercentile ?? null;
  const topDrivers = marketState?.now.topDrivers
    ?? [...output.domains].sort((a, b) => b.score - a.score).slice(0, 3).map(domain => domain.label);
  const building = evidenceFamilies.filter(item => item.trend === "deteriorating").length;
  const easing = evidenceFamilies.filter(item => item.trend === "improving").length;
  const probabilities = marketState?.outlook.regimeProbabilities ?? {
    bull: output.probability.bullProbability,
    softLanding: output.probability.softLandingProbability,
    stagflation: output.probability.stagflationProbability,
    recession: output.probability.recessionProbability,
    crash: output.probability.crashProbability,
  };
  const topAnalog = marketState?.outlook.topAnalog ?? (output.analogs[0]
    ? { period: output.analogs[0].year, label: output.analogs[0].era, similarity: output.analogs[0].similarity, resolution: "Deterministic fallback analog; canonical resolution unavailable." }
    : null);
  const watchItems = marketState?.watch.whatToWatch ?? output.narrative.keyRisks;
  const changedItems = marketState?.watch.whatChanged
    ?? output.domains.filter(domain => Math.abs(domain.delta) > 0.1).map(domain => `${domain.label}: ${domain.delta > 0 ? "pressure increased" : "pressure eased"}.`);
  const modeLabel = marketState ? (isLive ? "Canonical live state" : "Canonical protected state") : "Protected fallback state";
  const accent = pressureColor(pressure);

  const topDriversWithStrength = useMemo(() => {
    const families = evidenceFamilies.slice(0, 5);
    return families.sort((a, b) => b.strength - a.strength);
  }, [evidenceFamilies]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (isLoading && !marketState) {
    return <PageLoadingState eyebrow="NOW · Current market state" message="Loading canonical market state…" />;
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-white">
      {/* Keyframes for driver shimmer */}
      <style>{`
        @keyframes driver-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .driver-shimmer { animation: none !important; }
          canvas { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8 md:pt-10">

        {/* ── HERO COMMAND CENTER ──────────────────────────────────────── */}
        <section
          data-now-section="verdict"
          className="relative overflow-hidden rounded border border-white/10 bg-[#070b12]"
          style={{ boxShadow: `0 0 60px ${accent}10, 0 0 120px ${accent}05` }}
        >
          {/* Living seismic background */}
          <SeismicBackground pressure={pressure} accent={accent} />

          {/* Edge illumination */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}20, transparent)` }} />

          <div className="relative z-10 p-5 md:p-8">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">
                  NOW · Current market state
                </span>
                <DataFreshnessChip
                  freshness={marketState?.freshness ?? (isLive ? "live" : "stale")}
                  tooltip={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : undefined}
                />
              </div>
              <div className="flex items-center gap-2">
                <Link href="/app/tools" className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-300">
                  <ArrowRight size={11} /> Tools
                </Link>
                <button
                  type="button"
                  onClick={handleRefresh}
                  aria-label="Refresh market data"
                  className="flex items-center gap-2 rounded border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-300 active:scale-[0.97]"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>

            {/* Status rail */}
            <div className="mt-3">
              <StatusRail
                pressure={pressure}
                accent={accent}
                isLive={isLive}
                lastUpdated={lastUpdated}
                marketMode={marketMode}
                phase={phase}
              />
            </div>

            {dataError && (
              <div className="mt-4">
                <PageDegradedBanner message="Live refresh is degraded. FAULTLINE is preserving the latest verified state." detail={dataError} />
              </div>
            )}

            {/* ── THREE-COLUMN HERO ── */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">

              {/* LEFT: FAULTLINE Verdict */}
              <div
                className="flex flex-col justify-center"
                style={{
                  opacity: phase >= 7 ? 1 : 0,
                  transform: phase >= 7 ? "translateX(0)" : "translateX(-16px)",
                  transition: "opacity 0.6s ease, transform 0.6s ease",
                }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">FAULTLINE Verdict</p>
                <h1 className="mt-3 font-['Rajdhani'] text-3xl font-semibold leading-[1.05] text-white md:text-4xl lg:text-5xl">
                  {headline}
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {marketState?.why.narrative.whatIsHappening ?? output.narrative.regimeAssessment}
                </p>

                {/* Regime badges */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className="rounded border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em]"
                    style={{ borderColor: `${accent}50`, background: `${accent}10`, color: accent }}
                  >
                    {regime}
                  </span>
                  <span className="rounded border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">{direction}</span>
                  <span className="rounded border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">{stressLevel} pressure</span>
                  {historicalPercentile !== null && (
                    <span className="rounded border border-violet-300/20 bg-violet-300/[0.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300">
                      {Math.round(historicalPercentile)}th percentile
                    </span>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={CANONICAL_DESTINATION_BY_ID.why.path} className="flex items-center gap-2 rounded bg-cyan-300 px-4 py-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[#031014] transition hover:bg-cyan-200 active:scale-[0.97]">
                    Understand why <ArrowRight size={13} />
                  </Link>
                  <Link href={NOW_DEEP_PATH} className="flex items-center gap-2 rounded border border-white/15 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                    Deep dashboard
                  </Link>
                </div>
              </div>

              {/* CENTER: Dominant Pressure Instrument */}
              <div className="flex items-center justify-center lg:px-4">
                <PressureInstrument
                  score={pressure}
                  accent={accent}
                  regime={regime}
                  direction={direction}
                  historicalPercentile={historicalPercentile}
                  lastUpdated={lastUpdated}
                  phase={phase}
                />
              </div>

              {/* RIGHT: Bull vs Bear + Seismograph */}
              <div
                className="flex flex-col gap-4"
                style={{
                  opacity: phase >= 4 ? 1 : 0,
                  transform: phase >= 4 ? "translateX(0)" : "translateX(16px)",
                  transition: "opacity 0.6s ease, transform 0.6s ease",
                }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Bull vs Bear</p>
                <BullBearCard
                  label="Bull continuation probability"
                  value={probabilities.bull}
                  accent="#00e599"
                  description="Probability the current uptrend continues without a major drawdown."
                  phase={phase}
                  phaseTarget={4}
                />
                <BullBearCard
                  label="Major drawdown risk"
                  value={probabilities.crash}
                  accent="#ff4d6d"
                  description="Probability of a significant market correction or crisis event."
                  phase={phase}
                  phaseTarget={4}
                />

                {/* Seismograph strip */}
                <SeismographStrip pressure={pressure} accent={accent} phase={phase} />
              </div>
            </div>

            {/* ── DRIVER CHANNELS ── */}
            <div
              className="mt-6 border-t border-white/10 pt-5"
              style={{
                opacity: phase >= 5 ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            >
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Active Pressure Channels</p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {topDriversWithStrength.map((driver, i) => (
                  <ActiveDriverChannel
                    key={driver.name}
                    label={driver.name}
                    strength={driver.strength}
                    trend={driver.trend}
                    index={i}
                    phase={phase}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT CHANGED + SCENARIO DISTRIBUTION ─────────────────────── */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <WhatChangedPanel
            pressure={pressure}
            building={building}
            easing={easing}
            direction={direction}
            changedItems={changedItems}
            regime={regime}
            phase={phase}
          />

          {/* Scenario distribution */}
          <div
            className="rounded border border-white/10 bg-[#060a10] p-5"
            style={{ opacity: phase >= 7 ? 1 : 0, transition: "opacity 0.6s ease" }}
          >
            <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Scenario Distribution</p>
            <div className="space-y-3">
              {[
                { label: "Bull continuation", value: probabilities.bull, color: "#00e599" },
                { label: "Soft landing", value: probabilities.softLanding, color: "#00e5ff" },
                { label: "Stagflation", value: probabilities.stagflation, color: "#ffaa00" },
                { label: "Recession", value: probabilities.recession, color: "#ff7a45" },
                { label: "Crash / bear", value: probabilities.crash, color: "#ff4d6d" },
              ].map((seg, i) => (
                <div key={seg.label} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{seg.label}</span>
                    <span className="font-mono text-[10px] font-semibold" style={{ color: seg.color }}>{formatCanonicalPercent(seg.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${seg.value}%`,
                        background: seg.color,
                        transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                        boxShadow: `0 0 6px ${seg.color}50`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {marketState?.outlook.highestProbabilityPath && (
              <p className="mt-4 border-l-2 border-violet-300/50 bg-violet-300/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
                {marketState.outlook.highestProbabilityPath}
              </p>
            )}
          </div>
        </div>

        {/* ── STANDARD SECTIONS ─────────────────────────────────────────── */}
        <Section id="summary" index="01" eyebrow="Summary" title="The market in plain English" description="A direct synthesis before charts, modules, or specialist tools.">
          <p className="max-w-4xl text-lg leading-8 text-slate-200">
            {marketState?.why.story ?? output.narrative.summary}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[`Regime: ${regime}`, `Top risk: ${topDrivers[0] ?? "No dominant risk"}`, `Breadth: ${building} rising domains`].map(item => (
              <div key={item} className="border-l-2 border-cyan-300/50 bg-white/[0.025] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-300">{item}</div>
            ))}
          </div>
        </Section>

        <Section id="changed" index="02" eyebrow="Change" title="What changed—and how long it has been developing" description="Direction matters more than a single reading. FAULTLINE separates rising pressure from easing conditions without inventing a false start date.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-rose-400/15 bg-rose-400/[0.04] p-5">
              <TrendingUp size={17} className="text-rose-300" />
              <p className="mt-4 font-['Rajdhani'] text-3xl text-white">{building}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-rose-200/70">Building domains</p>
            </div>
            <div className="rounded border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
              <TrendingDown size={17} className="text-emerald-300" />
              <p className="mt-4 font-['Rajdhani'] text-3xl text-white">{easing}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-200/70">Easing domains</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.025] p-5">
              <Clock3 size={17} className="text-cyan-300" />
              <p className="mt-4 text-sm font-semibold text-white">{marketState?.history.currentStreakDescription ?? "Duration unavailable in fallback state"}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Development window</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {(changedItems.length ? changedItems : ["No verified directional change is available in the current comparison window."]).slice(0, 4).map(item => (
              <p key={item} className="border-l border-white/15 pl-4 text-sm leading-6 text-slate-400">{item}</p>
            ))}
          </div>
        </Section>

        <Section id="breadth" index="03" eyebrow="Breadth" title="Where pressure is concentrated" description="Every domain is normalized to the same 0–100 scale so concentration and breadth can be compared directly.">
          <div className="grid gap-3 md:grid-cols-2">
            {evidenceFamilies.map(family => (
              <div key={family.name} className="rounded border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">{family.name}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">{family.trend}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold" style={{ color: pressureColor(family.strength) }}>
                    {formatCanonicalScore(family.strength)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${family.strength}%`, background: pressureColor(family.strength), transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="probabilities" index="04" eyebrow="Probabilities" title="What the current state implies" description="Scenario probabilities are distributions, not certainty. They update from the same canonical market state used across FAULTLINE.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Bull continuation", value: probabilities.bull, accent: "#00e599" },
              { label: "Soft landing", value: probabilities.softLanding, accent: "#00e5ff" },
              { label: "Stagflation", value: probabilities.stagflation, accent: "#ffaa00" },
              { label: "Recession", value: probabilities.recession, accent: "#ff7a45" },
              { label: "Crash / bear", value: probabilities.crash, accent: "#ff4d6d" },
            ].map(card => (
              <div key={card.label} className="rounded border border-white/10 bg-[#090d14] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                <p className="mt-3 font-['Rajdhani'] text-3xl font-semibold" style={{ color: card.accent }}>{formatCanonicalPercent(card.value)}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${card.value}%`, background: card.accent, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
              </div>
            ))}
          </div>
          {marketState?.outlook.highestProbabilityPath && (
            <p className="mt-5 border-l-2 border-violet-300/50 bg-violet-300/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
              Highest-probability path: {marketState.outlook.highestProbabilityPath}
            </p>
          )}
        </Section>

        <Section id="why" index="05" eyebrow="Why" title="The primary drivers beneath the reading" description="NOW provides the causal headline; WHY carries the full transmission map, positioning evidence, and historical explanation.">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">Why this score</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{marketState?.why.whyThisScore ?? output.narrative.regimeAssessment}</p>
              <p className="mt-4 text-sm leading-7 text-slate-400">{marketState?.why.narrative.whatIsBuildingBeneathSurface ?? output.narrative.keyRisks.join(" ")}</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Dominant drivers</p>
              <ol className="mt-4 space-y-3">
                {topDrivers.slice(0, 4).map((driver, index) => (
                  <li key={driver} className="flex gap-3 text-sm text-slate-300"><span className="font-mono text-cyan-300">0{index + 1}</span>{driver}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-5"><DestinationLink href={CANONICAL_DESTINATION_BY_ID.why.path} label="Open WHY" detail="Trace drivers, transmission, positioning, and history." /></div>
        </Section>

        <Section id="history" index="06" eyebrow="History" title="How current conditions compare with the past" description="Historical context is shown with sample size, dataset span, analog similarity, and resolution—not as a prediction.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-white/10 bg-white/[0.025] p-5"><Database size={16} className="text-cyan-300" /><p className="mt-4 font-['Rajdhani'] text-2xl text-white">{marketState?.history.observationCount.toLocaleString() ?? "—"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Observations</p></div>
            <div className="rounded border border-white/10 bg-white/[0.025] p-5"><History size={16} className="text-violet-300" /><p className="mt-4 text-sm font-semibold text-white">{marketState?.history.datasetSpan ?? "Canonical history unavailable"}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Dataset span</p></div>
            <div className="rounded border border-white/10 bg-white/[0.025] p-5"><Telescope size={16} className="text-amber-300" /><p className="mt-4 text-sm font-semibold text-white">{topAnalog ? `${topAnalog.label} · ${formatCanonicalPercent(topAnalog.similarity)}` : "No verified analog"}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Closest analog</p></div>
          </div>
          {topAnalog && <p className="mt-5 text-sm leading-7 text-slate-400">{topAnalog.period}: {topAnalog.resolution}</p>}
        </Section>

        <Section id="watch-next" index="07" eyebrow="Watch next" title="What could confirm—or invalidate—the current state" description="A focused monitoring list keeps NOW actionable without turning it into the WATCH workspace.">
          <div className="grid gap-3 md:grid-cols-2">
            {watchItems.slice(0, 6).map(item => (
              <div key={item} className="flex gap-3 rounded border border-white/10 bg-white/[0.025] p-4">
                <Activity size={15} className="mt-0.5 shrink-0 text-orange-300" />
                <p className="text-sm leading-6 text-slate-300">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5"><DestinationLink href={CANONICAL_DESTINATION_BY_ID.watch.path} label="Open WATCH" detail="Set thresholds, monitor signals, and follow developing conditions." /></div>
        </Section>

        <Section id="asha" index="08" eyebrow="ASHA" title="Continue the interpretation with ASHA" description="Carry today's canonical market state into a focused conversation without changing the evidence source.">
          <div className="rounded border border-cyan-300/20 bg-cyan-300/[0.035] p-6 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 shrink-0 text-cyan-300" size={22} />
              <div><p className="font-['Rajdhani'] text-xl font-semibold text-white">Ask what is happening, why it matters, or what would change the conclusion.</p><p className="mt-2 text-sm leading-6 text-slate-400">ASHA receives the same regime, pressure, evidence, probability, history, and source-health context shown here.</p></div>
            </div>
            <Link href={PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha"} className="mt-5 inline-flex shrink-0 items-center gap-2 rounded bg-cyan-300 px-4 py-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-[#031014] transition hover:bg-cyan-200 active:scale-[0.97] md:mt-0">Open ASHA <ArrowRight size={14} /></Link>
          </div>
        </Section>

        <Section id="expert-tools" index="09" eyebrow="Expert tools" title="Go deeper without crowding the primary answer" description="Specialist workspaces remain available for expert analysis while NOW stays conclusion-first.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID.pressure.path} label="Pressure Engine" detail="Inspect pressure domains and scoring detail." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["signal-outlook"].path} label="Signal Outlook" detail="Open scenario and transition analysis." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} label="Decision Engine" detail="Stress-test a response against the regime." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path} label="Symbol Intelligence" detail="Analyze a specific asset in context." />
            <DestinationLink href="/app/seismograph-command-center" label="Seismograph Intelligence" detail="Live pressure across all 10 engines with historical context." />
          </div>
        </Section>

        <Section id="confidence" index="10" eyebrow="Confidence" title="What this conclusion rests on" description="Freshness, source health, fallback status, and warnings remain visible so users can distinguish evidence from certainty.">
          <div className="grid gap-3 md:grid-cols-2">
            {(sourceHealth.length ? sourceHealth : [{ id: "fallback", label: "Deterministic fallback", status: "degraded", required: true, asOf: lastUpdated?.toISOString() ?? "Unavailable", detail: "Canonical source health is not currently available." }]).map(source => (
              <div key={source.id} className="flex gap-3 rounded border border-white/10 bg-white/[0.025] p-4">
                {source.status === "healthy" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={16} /> : <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={16} />}
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">{source.label}</p><span className="font-mono text-[8px] uppercase tracking-[0.13em] text-slate-500">{source.status}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{source.detail}</p><p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">As of {source.asOf}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Mode: {marketMode} · Updated {lastUpdated ? lastUpdated.toLocaleString() : "unavailable"}</p>
            <Link href={NOW_DEEP_PATH} className="font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-300 hover:text-cyan-200">Inspect every legacy dashboard module →</Link>
          </div>
        </Section>

      </div>
    </main>
  );
}
