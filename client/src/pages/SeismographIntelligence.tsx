/**
 * FAULTLINE — Seismograph Command Center
 *
 * Category-defining institutional market intelligence experience.
 * Single data source: trpc.seismograph.getUnifiedIntelligence
 *
 * Layout order:
 *  1. Sticky header (live clock, refresh)
 *  2. FAULTLINE VERDICT — regime + one-line narrative
 *  3. TRADING CONDITIONS — conditions, bias, position size, confidence, cash, risk env
 *  4. BULL vs BEAR — two large animated probability cards
 *  5. PRESSURE CORE — living seismic sensor (canvas, always alive)
 *  6. SEISMOGRAPH WAVEFORM — 90-day pressure history
 *  7. TODAY'S BEST TRADE TYPES — dynamic from engines
 *  8. CURRENT CAUTIONS — what to avoid
 *  9. SCENARIO DISTRIBUTION — animated 5-way regime bars
 * 10. PRESSURE DRIVERS — evidence families + engine contributions
 * 11. HISTORICAL COMPARISON — analogs + trend summaries
 * 12. WHAT COULD CHANGE — shifts, watch list, invalidation
 * 13. TODAY'S PLAYBOOK — one-screen actionable summary
 * 14. ASHA + footer
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useRegisterAshaContext } from "@/contexts/AshaContext";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";

// ── Reduced-motion helper ─────────────────────────────────────────────────────
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Color utilities ────────────────────────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#f59e0b";
  if (score >= 25) return "#22c55e";
  return "#10b981";
}

function pressureLabel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "ELEVATED";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function stressColor(level: string): string {
  if (level === "Crisis") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Elevated") return "#f59e0b";
  return "#22c55e";
}

function directionColor(dir: string): string {
  if (dir === "Deteriorating" || dir === "Accelerating") return "#f97316";
  if (dir === "Improving") return "#22c55e";
  return "#06b6d4";
}

function signalColor(sig: string): string {
  if (sig === "bearish" || sig === "stressed") return "#f97316";
  if (sig === "bullish" || sig === "recovering") return "#22c55e";
  return "#06b6d4";
}

// ── Trading conditions derivation ─────────────────────────────────────────────
interface TradingConditionsData {
  conditionLabel: string;
  conditionColor: string;
  bias: string;
  biasColor: string;
  positionSize: string;
  positionSizeColor: string;
  confidence: string;
  confidenceColor: string;
  cashAllocation: string;
  riskEnvironment: string;
  riskEnvironmentColor: string;
}

function deriveTradingConditions(score: number, direction: string, confidence: number): TradingConditionsData {
  let conditionLabel: string;
  let conditionColor: string;
  let bias: string;
  let biasColor: string;
  let positionSize: string;
  let positionSizeColor: string;
  let cashAllocation: string;
  let riskEnvironment: string;
  let riskEnvironmentColor: string;

  if (score >= 80) {
    conditionLabel = "EXTREME CAUTION"; conditionColor = "#ef4444";
    bias = "Short"; biasColor = "#ef4444";
    positionSize = "Conservative"; positionSizeColor = "#ef4444";
    cashAllocation = "50–70%";
    riskEnvironment = "Elevated"; riskEnvironmentColor = "#ef4444";
  } else if (score >= 65) {
    conditionLabel = "DEFENSIVE"; conditionColor = "#f97316";
    bias = "Neutral"; biasColor = "#f59e0b";
    positionSize = "Conservative"; positionSizeColor = "#f97316";
    cashAllocation = "35–50%";
    riskEnvironment = "Elevated"; riskEnvironmentColor = "#f97316";
  } else if (score >= 50) {
    conditionLabel = "CHALLENGING"; conditionColor = "#f59e0b";
    bias = "Neutral"; biasColor = "#f59e0b";
    positionSize = "Conservative"; positionSizeColor = "#f59e0b";
    cashAllocation = "20–35%";
    riskEnvironment = "Neutral"; riskEnvironmentColor = "#f59e0b";
  } else if (score >= 35) {
    conditionLabel = "SELECTIVE"; conditionColor = "#06b6d4";
    bias = "Long"; biasColor = "#06b6d4";
    positionSize = "Standard"; positionSizeColor = "#06b6d4";
    cashAllocation = "10–20%";
    riskEnvironment = "Constructive"; riskEnvironmentColor = "#06b6d4";
  } else if (score >= 20) {
    conditionLabel = "FAVORABLE"; conditionColor = "#22c55e";
    bias = "Long"; biasColor = "#22c55e";
    positionSize = "Standard"; positionSizeColor = "#22c55e";
    cashAllocation = "5–15%";
    riskEnvironment = "Constructive"; riskEnvironmentColor = "#22c55e";
  } else {
    conditionLabel = "HIGHLY FAVORABLE"; conditionColor = "#10b981";
    bias = "Long"; biasColor = "#10b981";
    positionSize = "Aggressive"; positionSizeColor = "#10b981";
    cashAllocation = "0–10%";
    riskEnvironment = "Constructive"; riskEnvironmentColor = "#10b981";
  }

  const confidenceLabel = confidence >= 75 ? "High" : confidence >= 50 ? "Moderate" : "Low";
  const confidenceColor = confidence >= 75 ? "#22c55e" : confidence >= 50 ? "#f59e0b" : "#ef4444";

  if (direction === "Deteriorating" || direction === "Accelerating") {
    if (conditionLabel === "FAVORABLE" || conditionLabel === "HIGHLY FAVORABLE") {
      conditionLabel = "SELECTIVE"; conditionColor = "#06b6d4";
    }
  }

  return { conditionLabel, conditionColor, bias, biasColor, positionSize, positionSizeColor, confidence: confidenceLabel, confidenceColor, cashAllocation, riskEnvironment, riskEnvironmentColor };
}

// ── Trade type derivation ──────────────────────────────────────────────────────
interface TradeType {
  name: string;
  stars: number;
  why: string;
  confidence: string;
  evidence: string;
}

function deriveTradeTypes(score: number, direction: string, regime: string, bull: number, recession: number, crash: number): TradeType[] {
  const isRisk = score < 40;
  const isElevated = score >= 50 && score < 70;
  const isCrisis = score >= 70;
  const isBullish = bull > 45;
  const isDefensive = recession + crash > 30;

  const types: TradeType[] = [];

  if (isRisk && isBullish) {
    types.push({ name: "Swing Longs", stars: 5, why: "Low systemic pressure with bullish regime probability supports multi-day long positions", confidence: "High", evidence: `Bull probability ${bull}%, pressure ${score}` });
    types.push({ name: "Trend Following", stars: 5, why: "Constructive macro environment favors momentum-driven trend strategies", confidence: "High", evidence: `Regime: ${regime}, direction: ${direction}` });
    types.push({ name: "Momentum", stars: 4, why: "Favorable conditions support breakout momentum plays in leading sectors", confidence: "Moderate", evidence: `Pressure ${score}, direction: ${direction}` });
    types.push({ name: "Mean Reversion", stars: 2, why: "Trending conditions reduce mean-reversion edge", confidence: "Low", evidence: "Momentum environment unfavorable for reversals" });
    types.push({ name: "Aggressive Shorts", stars: 1, why: "Bullish regime makes aggressive short exposure high-risk", confidence: "Low", evidence: `Bull probability ${bull}%` });
    types.push({ name: "Defensive Rotation", stars: 1, why: "Defensive positioning not warranted at current pressure levels", confidence: "Low", evidence: `Pressure ${score}` });
  } else if (isElevated) {
    types.push({ name: "Selective Longs", stars: 3, why: "Elevated pressure warrants selectivity — only highest-conviction setups", confidence: "Moderate", evidence: `Pressure ${score}, direction: ${direction}` });
    types.push({ name: "Defensive Rotation", stars: 4, why: "Rotating toward defensive sectors reduces drawdown risk in elevated environments", confidence: "High", evidence: `Pressure ${score}, recession ${recession}%` });
    types.push({ name: "Mean Reversion", stars: 3, why: "Elevated pressure creates oversold conditions suitable for short-term reversals", confidence: "Moderate", evidence: `Pressure ${score}` });
    types.push({ name: "Trend Following", stars: 2, why: "Elevated pressure increases whipsaw risk for trend strategies", confidence: "Low", evidence: `Direction: ${direction}` });
    types.push({ name: "Swing Longs", stars: 2, why: "Elevated systemic pressure reduces multi-day long conviction", confidence: "Low", evidence: `Pressure ${score}` });
    types.push({ name: "Aggressive Shorts", stars: 2, why: "Selective short exposure in weakest sectors may be warranted", confidence: "Low", evidence: `Recession ${recession}%, crash ${crash}%` });
  } else if (isCrisis) {
    types.push({ name: "Defensive Rotation", stars: 5, why: "High systemic pressure demands defensive positioning in safe-haven assets", confidence: "High", evidence: `Pressure ${score}, crash ${crash}%` });
    types.push({ name: "Aggressive Shorts", stars: isDefensive ? 4 : 3, why: "Crisis-level pressure supports short exposure in vulnerable sectors", confidence: "Moderate", evidence: `Recession ${recession}%, crash ${crash}%` });
    types.push({ name: "Mean Reversion", stars: 2, why: "Volatile conditions create short-term reversals but with elevated risk", confidence: "Low", evidence: `Pressure ${score}` });
    types.push({ name: "Swing Longs", stars: 1, why: "Crisis pressure makes sustained long exposure high-risk", confidence: "Low", evidence: `Pressure ${score}` });
    types.push({ name: "Trend Following", stars: 1, why: "Trend strategies suffer in crisis volatility spikes", confidence: "Low", evidence: `Direction: ${direction}` });
    types.push({ name: "Momentum", stars: 1, why: "Momentum strategies face elevated reversal risk in crisis conditions", confidence: "Low", evidence: `Pressure ${score}` });
  } else {
    types.push({ name: "Swing Longs", stars: 4, why: "Moderate conditions support selective long exposure with defined risk", confidence: "Moderate", evidence: `Pressure ${score}, bull ${bull}%` });
    types.push({ name: "Trend Following", stars: 4, why: "Stable macro backdrop supports trend-following in leading sectors", confidence: "Moderate", evidence: `Regime: ${regime}` });
    types.push({ name: "Momentum", stars: 3, why: "Moderate environment supports momentum in select sectors", confidence: "Moderate", evidence: `Pressure ${score}` });
    types.push({ name: "Mean Reversion", stars: 3, why: "Stable conditions support mean-reversion in range-bound markets", confidence: "Moderate", evidence: `Pressure ${score}` });
    types.push({ name: "Defensive Rotation", stars: 2, why: "Defensive rotation not a priority at moderate pressure levels", confidence: "Low", evidence: `Pressure ${score}` });
    types.push({ name: "Aggressive Shorts", stars: 1, why: "Moderate conditions do not support aggressive short exposure", confidence: "Low", evidence: `Bull ${bull}%` });
  }

  return types;
}

// ── Cautions derivation ────────────────────────────────────────────────────────
function deriveCautions(score: number, direction: string, crash: number, recession: number, stressLevel: string): string[] {
  const cautions: string[] = [];
  if (score >= 65 || stressLevel === "High" || stressLevel === "Crisis") {
    cautions.push("Reduce leverage across all positions — elevated systemic pressure increases drawdown risk.");
  }
  if (direction === "Accelerating" || direction === "Deteriorating") {
    cautions.push("Avoid adding new risk exposure while pressure is accelerating — wait for stabilization.");
  }
  if (crash > 20) {
    cautions.push(`Avoid highly leveraged or illiquid positions — crash probability at ${crash}%.`);
  }
  if (recession > 25) {
    cautions.push("Remain selective with cyclical and growth exposure — recession probability elevated.");
  }
  if (score >= 45) {
    cautions.push("Avoid chasing overextended breakouts — elevated pressure increases reversal risk.");
    cautions.push("Avoid low-liquidity names — spreads widen and exits become costly in stressed conditions.");
  }
  if (score >= 60) {
    cautions.push("Remain selective with speculative growth — high-multiple names face multiple compression risk.");
  }
  if (cautions.length === 0) {
    cautions.push("No critical cautions at current pressure levels — maintain standard risk discipline.");
  }
  return cautions;
}

// ── Animated count-up hook ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return; }
    let raf: number;
    const start = performance.now() + delay;
    function tick(now: number) {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

// ── Staged load hook ──────────────────────────────────────────────────────────
function useStagedLoad(ready: boolean): number {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!ready) return;
    if (prefersReducedMotion()) { setPhase(8); return; }
    const delays = [0, 150, 350, 600, 900, 1200, 1600, 2100, 2700];
    delays.forEach((d, i) => {
      const t = setTimeout(() => setPhase(i + 1), d);
      timerRef.current.push(t);
    });
    return () => timerRef.current.forEach(clearTimeout);
  }, [ready]);
  return phase;
}

// ── Shared style constant ─────────────────────────────────────────────────────
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Courier New',monospace" };

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: "1px", background: "rgba(6,182,212,0.08)", margin: "32px 0" }} />;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ text, color = "rgba(6,182,212,0.45)" }: { text: string; color?: string }) {
  return (
    <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.18em", color, fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ display: "inline-block", width: "18px", height: "1px", background: color }} />
      {text}
    </div>
  );
}

// ── Animated probability bar ──────────────────────────────────────────────────
function AnimProbBar({ label, value, color, width = "140px", revealDelay = 0 }: { label: string; value: number; color: string; width?: string; revealDelay?: number }) {
  const [displayed, setDisplayed] = useState(prefersReducedMotion() ? value : 0);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) { setDisplayed(value); return; }
    let raf: number;
    const from = prevRef.current;
    const to = value;
    const start = performance.now() + revealDelay;
    const dur = 900;
    function tick(now: number) {
      const elapsed = Math.max(0, now - start);
      const p = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, revealDelay]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
      <div style={{ ...mono, width, fontSize: "9px", color: "rgba(6,182,212,0.55)", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "5px", background: "rgba(6,182,212,0.08)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: `${Math.min(100, displayed)}%`, background: color, borderRadius: "3px", transition: "width 0.05s linear", position: "relative", overflow: "hidden" }}>
          {!prefersReducedMotion() && (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)`, animation: `shimmer-flow 2.8s ease-in-out infinite`, animationDelay: `${revealDelay * 0.5}ms` }} />
          )}
        </div>
      </div>
      <div style={{ ...mono, width: "34px", textAlign: "right", fontSize: "11px", color, fontWeight: 700, flexShrink: 0 }}>{displayed}%</div>
    </div>
  );
}

// ── Pressure Core — living seismic sensor ─────────────────────────────────────
function PressureCore({ score, scoreColor }: { score: number; scoreColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const rm = prefersReducedMotion();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const t = tRef.current;

    ctx.clearRect(0, 0, W, H);

    if (rm) {
      // Static fallback
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.strokeStyle = scoreColor + "40";
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    const pressure = score / 100;
    // Breathing frequency: faster at high pressure
    const breathFreq = 0.018 + pressure * 0.022;
    const breathAmp = 4 + pressure * 8;
    const breathR = 60 + Math.sin(t * breathFreq) * breathAmp;

    // Outer ambient ring (slow, large)
    const outerAlpha = 0.04 + Math.sin(t * 0.008) * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, breathR + 28, 0, Math.PI * 2);
    ctx.strokeStyle = scoreColor + Math.round(outerAlpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 18;
    ctx.stroke();

    // Mid ring
    const midAlpha = 0.08 + Math.sin(t * 0.012 + 1) * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, breathR + 14, 0, Math.PI * 2);
    ctx.strokeStyle = scoreColor + Math.round(midAlpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 8;
    ctx.stroke();

    // Core ring
    const coreAlpha = 0.35 + Math.sin(t * breathFreq * 1.3 + 0.5) * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, breathR, 0, Math.PI * 2);
    ctx.strokeStyle = scoreColor + Math.round(coreAlpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner fill (very subtle)
    const fillAlpha = 0.04 + pressure * 0.06 + Math.sin(t * breathFreq) * 0.015;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, breathR);
    grad.addColorStop(0, scoreColor + Math.round(fillAlpha * 2.5 * 255).toString(16).padStart(2, "0"));
    grad.addColorStop(1, scoreColor + "00");
    ctx.beginPath();
    ctx.arc(cx, cy, breathR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Micro oscillation lines (seismic tremors) — 6 radial spikes
    const spikeCount = 6;
    const spikeFreq = 0.09 + pressure * 0.14;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + t * 0.004;
      const spikeAmp = (2 + pressure * 6) * (0.6 + Math.sin(t * spikeFreq + i * 1.3) * 0.4);
      const r0 = breathR + 2;
      const r1 = breathR + 2 + spikeAmp;
      const x0 = cx + r0 * Math.cos(angle);
      const y0 = cy + r0 * Math.sin(angle);
      const x1 = cx + r1 * Math.cos(angle);
      const y1 = cy + r1 * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = scoreColor + "60";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Energy pulse ring (expands outward, repeating)
    const pulseFreq = 0.025 + pressure * 0.02;
    const pulsePhase = (t * pulseFreq) % 1;
    const pulseR = breathR + pulsePhase * 50;
    const pulseAlpha = (1 - pulsePhase) * (0.25 + pressure * 0.2);
    if (pulseAlpha > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = scoreColor + Math.round(pulseAlpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Second pulse ring (offset by 0.5)
    const pulse2Phase = ((t * pulseFreq) + 0.5) % 1;
    const pulse2R = breathR + pulse2Phase * 50;
    const pulse2Alpha = (1 - pulse2Phase) * (0.15 + pressure * 0.1);
    if (pulse2Alpha > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cy, pulse2R, 0, Math.PI * 2);
      ctx.strokeStyle = scoreColor + Math.round(pulse2Alpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    tRef.current += 1;
    animRef.current = requestAnimationFrame(draw);
  }, [score, scoreColor, rm]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      style={{ width: "200px", height: "200px", display: "block" }}
    />
  );
}

// ── Live seismograph waveform ─────────────────────────────────────────────────
interface WaveformProps {
  sparkline: { score: number }[];
  scoreColor: string;
  currentScore: number;
}

function LiveSeismographWave({ sparkline, scoreColor, currentScore }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const rm = prefersReducedMotion();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pts = sparkline.length > 0 ? sparkline : Array.from({ length: 60 }, (_, i) => ({ score: currentScore + Math.sin(i * 0.3) * 4 }));
    const n = pts.length;
    const ys = pts.map((p) => H - Math.max(4, (p.score / 100) * (H - 8)) - 4);
    const t = phaseRef.current;
    const shiftFrac = rm ? 0 : ((t * 0.3) % (W / (n - 1))) / W;
    const noisedYs = ys.map((y, i) => {
      if (i < n - 8) return y;
      const age = n - 1 - i;
      const amplitude = rm ? 0 : (2.5 - age * 0.28) * (currentScore / 100 + 0.35);
      return y + Math.sin(t * 0.07 + i * 1.5) * amplitude + Math.sin(t * 0.13 + i * 0.9) * amplitude * 0.4;
    });

    // Outer halo
    if (!rm) {
      ctx.beginPath();
      ctx.strokeStyle = scoreColor + "18";
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const xStep0 = W / (n - 1);
      noisedYs.forEach((y, i) => {
        const x = i * xStep0 - shiftFrac * W;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Glow line
    ctx.beginPath();
    ctx.strokeStyle = scoreColor + "35";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const xStep = W / (n - 1);
    noisedYs.forEach((y, i) => {
      const x = i * xStep - shiftFrac * W;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Main line
    ctx.beginPath();
    ctx.strokeStyle = scoreColor + "d0";
    ctx.lineWidth = 1.5;
    noisedYs.forEach((y, i) => {
      const x = i * xStep - shiftFrac * W;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Scan cursor
    if (!rm) {
      const cursorX = W - 2 + Math.sin(t * 0.035) * 2;
      const cursorY = noisedYs[n - 1];
      ctx.beginPath();
      ctx.strokeStyle = scoreColor + "70";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, H);
      ctx.stroke();
      ctx.setLineDash([]);
      const rippleR = ((t * 0.6) % 14) + 3;
      const rippleAlpha = Math.max(0, 1 - rippleR / 17);
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = scoreColor + Math.round(rippleAlpha * 80).toString(16).padStart(2, "0");
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor;
      ctx.fill();
      const glowPulse = 0.5 + Math.sin(t * 0.12) * 0.5;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 6 + glowPulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor + Math.round(glowPulse * 40).toString(16).padStart(2, "0");
      ctx.fill();
    }

    phaseRef.current += 1;
    animRef.current = requestAnimationFrame(draw);
  }, [sparkline, scoreColor, currentScore, rm]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={56}
      style={{ width: "100%", height: "56px", display: "block", borderRadius: "4px" }}
    />
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ count, color }: { count: number; color: string }) {
  return (
    <span style={{ ...mono, fontSize: "10px", letterSpacing: "1px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < count ? color : "rgba(6,182,212,0.18)" }}>★</span>
      ))}
    </span>
  );
}

// ── Engine tag ────────────────────────────────────────────────────────────────
function EngineTag({ name }: { name: string }) {
  return (
    <span style={{ ...mono, fontSize: "8px", letterSpacing: "0.06em", color: "rgba(6,182,212,0.5)", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: "3px", padding: "1px 5px", marginRight: "4px", marginBottom: "3px", display: "inline-block" }}>
      {name}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SeismographIntelligence() {
  const [now, setNow] = useState(() => new Date());
  const [pressureExpanded, setPressureExpanded] = useState(false);

  const { data: intel, isLoading, refetch, isFetching } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatUtc = (d: Date) =>
    d.toISOString().replace("T", " ").substring(0, 16) + " UTC";

  // ── Skeleton ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", ...mono }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.45)", marginBottom: "8px" }}>LOADING INTELLIGENCE</div>
          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(6,182,212,0.4)", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
      </div>
    );
  }

  if (!intel) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", ...mono }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)" }}>INTELLIGENCE UNAVAILABLE</div>
      </div>
    );
  }

  const {
    currentScore, currentRegime, currentStressLevel, currentDirection, currentPercentile,
    todayStory, keyDevelopments, whyThisScore, whyThisRegime,
    probabilities, evidenceFamilies, evidenceConsensus, enginesAgreeing, enginesDisagreeing,
    analogs, analogSummary, transitionProbabilities, evolution, memory,
    regimeProbabilities5way, developingConditions, engineContributions, marketNarrative,
    macroTicker, dataFreshness, lastUpdated,
  } = intel;

  const regimeProbs = regimeProbabilities5way ?? { bull: 0, softLanding: 0, stagflation: 0, recession: 0, crash: 0 };
  const safeEngineContributions = engineContributions ?? [];
  const safeEvidenceFamilies = evidenceFamilies ?? [];
  const safeAnalogs = analogs ?? [];
  const safeKeyDevelopments = keyDevelopments ?? [];
  const safeDevelopingConditions = developingConditions ?? [];
  const safeEnginesAgreeing = enginesAgreeing ?? [];
  const safeEnginesDisagreeing = enginesDisagreeing ?? [];
  const safeEvolution = evolution ?? { sevenDayTrend: "", thirtyDayTrend: "", ninetyDayTrend: "", yearTrend: "", accelerating: false, buildingPressure: false, whatChanged: [], whatToWatch: [], invalidationConditions: [], sparkline90d: [] };
  const safeMemory = memory ?? { observationCount: 0, datasetSpan: "N/A", currentStreakDescription: "", longestStreak: 0, regimeHistory: [], keyThresholdsCrossed: [], lastMajorShift: null, historicalStats: { avgPressure: 0, maxPressure: 0, minPressure: 0, criticalMonths: 0, highRiskMonths: 0, elevatedMonths: 0, moderateMonths: 0, lowMonths: 0 } };
  const topEngines = [...safeEngineContributions].sort((a, b) => b.contributionWeight - a.contributionWeight).slice(0, 6);

  const scoreColor = pressureColor(currentScore);
  const loadPhase = useStagedLoad(true);
  const animatedScore = useCountUp(currentScore, 1100, 400);
  const animatedBull = useCountUp(regimeProbs.bull, 1000, 600);
  const animatedCrash = useCountUp(regimeProbs.crash + regimeProbs.recession, 1000, 700);

  // Derived data
  const tradingConditions = deriveTradingConditions(currentScore, currentDirection, probabilities.confidence);
  const tradeTypes = deriveTradeTypes(currentScore, currentDirection, currentRegime, regimeProbs.bull, regimeProbs.recession, regimeProbs.crash);
  const cautions = deriveCautions(currentScore, currentDirection, regimeProbs.crash, regimeProbs.recession, currentStressLevel);

  // Register ASHA page context
  const ashaCtx = useMemo(() => ({
    page: "seismograph" as const,
    pressureScore: currentScore,
    regime: currentRegime,
    narrative: todayStory,
    trend: currentDirection,
    keyDrivers: safeKeyDevelopments.slice(0, 3),
    historicalAnalog: safeAnalogs[0] ? `${safeAnalogs[0].period} (similarity: ${(safeAnalogs[0].similarity * 100).toFixed(0)}%)` : undefined,
    transitionProbability: transitionProbabilities?.transitionToElevated,
    additionalContext: {
      stressLevel: currentStressLevel,
      percentile: currentPercentile,
      enginesAgreeing: safeEnginesAgreeing,
      enginesDisagreeing: safeEnginesDisagreeing,
      dataFreshness,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentScore, currentRegime, todayStory, currentDirection, currentStressLevel, currentPercentile, transitionProbabilities?.transitionToElevated]);
  useRegisterAshaContext(ashaCtx);

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e2e8f0", padding: "0 0 80px", opacity: loadPhase >= 1 ? 1 : 0, transition: "opacity 0.4s ease-out", position: "relative", overflow: "hidden" }}>

      {/* Ambient page scanline */}
      {!prefersReducedMotion() && (
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.12) 30%, rgba(6,182,212,0.18) 50%, rgba(6,182,212,0.12) 70%, transparent 100%)", pointerEvents: "none", zIndex: 0, animation: "page-scanline 8s linear infinite", animationDelay: "1s" }} />
      )}

      {/* ── STICKY HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(0,0,0,0.95)", borderBottom: "1px solid rgba(6,182,212,0.1)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative", width: "7px", height: "7px", flexShrink: 0 }}>
              <div style={{ position: "absolute", inset: "-4px", borderRadius: "50%", background: "#22c55e", opacity: 0, animation: "live-ripple 2.2s ease-out infinite" }} />
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e, 0 0 16px #22c55e40", animation: "livepulse 2s infinite", position: "relative", zIndex: 1 }} />
            </div>
            <span style={{ ...mono, fontSize: "10px", letterSpacing: "0.14em", fontWeight: 700, color: "#06b6d4" }}>FAULTLINE SEISMOGRAPH</span>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.3)", letterSpacing: "0.06em" }}>{safeMemory.observationCount} OBS · {safeMemory.datasetSpan}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.3)" }}>{formatUtc(now)}</span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{ background: "none", border: "none", cursor: "pointer", color: isFetching ? "rgba(6,182,212,0.25)" : "rgba(6,182,212,0.5)", padding: 0, display: "flex", alignItems: "center" }}
            >
              <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "36px 20px 0" }}>

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — FAULTLINE VERDICT
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "36px", opacity: loadPhase >= 2 ? 1 : 0, transform: loadPhase >= 2 ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.5s ease-out, transform 0.5s ease-out" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.2em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "10px" }}>FAULTLINE VERDICT</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div style={{ ...mono, fontSize: "52px", fontWeight: 800, color: scoreColor, lineHeight: 1, textShadow: `0 0 40px ${scoreColor}40`, animation: loadPhase >= 2 ? "score-breathe-deep 4s ease-in-out infinite" : "none" }}>
              {animatedScore}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.2, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{currentRegime}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <span style={{ ...mono, fontSize: "10px", color: scoreColor, fontWeight: 700 }}>{pressureLabel(currentScore)}</span>
                <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)" }}>·</span>
                <span style={{ ...mono, fontSize: "10px", color: directionColor(currentDirection) }}>{currentDirection.toUpperCase()}</span>
                <span style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)" }}>·</span>
                <span style={{ ...mono, fontSize: "10px", color: "rgba(6,182,212,0.5)" }}>{currentPercentile}th PCTILE</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "15px", color: "rgba(226,232,240,0.8)", lineHeight: 1.7, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif", borderLeft: `3px solid ${scoreColor}60`, paddingLeft: "14px" }}>
            {todayStory}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — TRADING CONDITIONS
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 2 ? 1 : 0, transition: "opacity 0.5s ease-out 0.1s" }}>
          <SectionLabel text="TRADING CONDITIONS" />
          <div style={{ padding: "24px", background: "rgba(6,182,212,0.03)", borderRadius: "8px", border: `1px solid ${tradingConditions.conditionColor}25`, borderTop: `3px solid ${tradingConditions.conditionColor}` }}>
            {/* Condition label */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "22px" }}>
              <div>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.4)", marginBottom: "6px" }}>CURRENT TRADING CONDITIONS</div>
                <div style={{ ...mono, fontSize: "22px", fontWeight: 800, color: tradingConditions.conditionColor, letterSpacing: "0.04em" }}>{tradingConditions.conditionLabel}</div>
              </div>
              <div style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)", textAlign: "right" }}>
                <div>CONFIDENCE</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: tradingConditions.confidenceColor, marginTop: "2px" }}>{tradingConditions.confidence}</div>
              </div>
            </div>
            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "16px" }}>
              {[
                { label: "PREFERRED BIAS", value: tradingConditions.bias, color: tradingConditions.biasColor },
                { label: "POSITION SIZE", value: tradingConditions.positionSize, color: tradingConditions.positionSizeColor },
                { label: "CASH ALLOCATION", value: tradingConditions.cashAllocation, color: "rgba(6,182,212,0.8)" },
                { label: "RISK ENVIRONMENT", value: tradingConditions.riskEnvironment, color: tradingConditions.riskEnvironmentColor },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
                  <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.38)", marginBottom: "6px" }}>{label}</div>
                  <div style={{ ...mono, fontSize: "14px", fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — BULL VS BEAR PROBABILITY
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 3 ? 1 : 0, transition: "opacity 0.5s ease-out 0.15s" }}>
          <SectionLabel text="BULL vs BEAR PROBABILITY" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Bull card */}
            <div style={{ padding: "24px", background: "rgba(34,197,94,0.04)", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.2)", borderTop: "3px solid #22c55e", position: "relative", overflow: "hidden" }}>
              {!prefersReducedMotion() && (
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 100%, rgba(34,197,94,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
              )}
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.14em", color: "rgba(34,197,94,0.6)", marginBottom: "8px" }}>BULL CONTINUATION</div>
              <div style={{ ...mono, fontSize: "48px", fontWeight: 800, color: "#22c55e", lineHeight: 1, marginBottom: "8px", textShadow: "0 0 30px rgba(34,197,94,0.3)", animation: loadPhase >= 3 ? "score-breathe-deep 4s ease-in-out infinite 0.5s" : "none" }}>
                {animatedBull}%
              </div>
              <div style={{ height: "4px", background: "rgba(34,197,94,0.12)", borderRadius: "2px", marginBottom: "10px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${regimeProbs.bull}%`, background: "#22c55e", borderRadius: "2px", transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
              </div>
              <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.55)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
                {regimeProbs.bull > 50
                  ? "Dominant regime probability. Constructive macro environment supports continued upside."
                  : regimeProbs.bull > 30
                  ? "Meaningful bull probability. Conditions support selective long exposure."
                  : "Bull continuation probability is subdued. Elevated caution warranted."}
              </p>
            </div>
            {/* Bear/drawdown card */}
            <div style={{ padding: "24px", background: "rgba(239,68,68,0.04)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)", borderTop: "3px solid #ef4444", position: "relative", overflow: "hidden" }}>
              {!prefersReducedMotion() && (
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 100%, rgba(239,68,68,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
              )}
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.14em", color: "rgba(239,68,68,0.6)", marginBottom: "8px" }}>MAJOR DRAWDOWN RISK</div>
              <div style={{ ...mono, fontSize: "48px", fontWeight: 800, color: "#ef4444", lineHeight: 1, marginBottom: "8px", textShadow: "0 0 30px rgba(239,68,68,0.3)", animation: loadPhase >= 3 ? "score-breathe-deep 4s ease-in-out infinite 0.7s" : "none" }}>
                {animatedCrash}%
              </div>
              <div style={{ height: "4px", background: "rgba(239,68,68,0.12)", borderRadius: "2px", marginBottom: "10px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${regimeProbs.crash + regimeProbs.recession}%`, background: "#ef4444", borderRadius: "2px", transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
              </div>
              <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.55)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
                {regimeProbs.crash + regimeProbs.recession > 40
                  ? "Elevated drawdown probability. Recession and crash scenarios carry significant combined weight."
                  : regimeProbs.crash + regimeProbs.recession > 20
                  ? "Moderate drawdown risk. Tail scenarios warrant defensive positioning in a portion of the portfolio."
                  : "Drawdown risk is contained. Tail scenarios are low-probability at current conditions."}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — PRESSURE CORE
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 3 ? 1 : 0, transition: "opacity 0.6s ease-out 0.2s" }}>
          <SectionLabel text="PRESSURE CORE" />
          <div
            style={{ padding: "28px 24px", background: "rgba(6,182,212,0.02)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.1)", cursor: "pointer", transition: "border-color 0.2s" }}
            onClick={() => setPressureExpanded(e => !e)}
            role="button"
            aria-expanded={pressureExpanded}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
              {/* Living sensor */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <PressureCore score={currentScore} scoreColor={scoreColor} />
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.35)", textAlign: "center" }}>TAP TO EXPAND</div>
              </div>
              {/* Metrics */}
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  {[
                    { label: "PRESSURE INDEX", value: `${currentScore}`, color: scoreColor },
                    { label: "STRESS LEVEL", value: currentStressLevel, color: stressColor(currentStressLevel) },
                    { label: "HISTORICAL PERCENTILE", value: `${currentPercentile}th`, color: scoreColor },
                    { label: "TODAY'S CHANGE", value: currentDirection, color: directionColor(currentDirection) },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", marginBottom: "3px" }}>{label}</div>
                      <div style={{ ...mono, fontSize: "14px", fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "7-DAY TREND", value: safeEvolution.sevenDayTrend ? safeEvolution.sevenDayTrend.split(" ").slice(0, 4).join(" ") + "…" : "N/A" },
                    { label: "30-DAY TREND", value: safeEvolution.thirtyDayTrend ? safeEvolution.thirtyDayTrend.split(" ").slice(0, 4).join(" ") + "…" : "N/A" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: "8px 10px", background: "rgba(6,182,212,0.03)", borderRadius: "4px", border: "1px solid rgba(6,182,212,0.07)" }}>
                      <div style={{ ...mono, fontSize: "7px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.32)", marginBottom: "3px" }}>{label}</div>
                      <div style={{ fontSize: "11px", color: "rgba(226,232,240,0.6)", lineHeight: 1.4, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Expanded pressure detail */}
            {pressureExpanded && (
              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(6,182,212,0.1)", animation: "seismo-fade-up 0.3s ease-out" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                  {[
                    { label: "ACCELERATION", value: safeEvolution.accelerating ? "Building" : "Stable", color: safeEvolution.accelerating ? "#f97316" : "#22c55e" },
                    { label: "CONFIDENCE", value: `${probabilities.confidence}%`, color: "rgba(6,182,212,0.8)" },
                    { label: "REGIME DURATION", value: safeMemory.currentStreakDescription.split(" ").slice(-3).join(" ") || "N/A", color: "rgba(6,182,212,0.7)" },
                    { label: "OBSERVATIONS", value: `${safeMemory.observationCount}`, color: "rgba(6,182,212,0.6)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: "10px 12px", background: "rgba(6,182,212,0.03)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.08)" }}>
                      <div style={{ ...mono, fontSize: "7px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", marginBottom: "4px" }}>{label}</div>
                      <div style={{ ...mono, fontSize: "13px", fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Pressure contributors */}
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>PRESSURE CONTRIBUTORS</div>
                {topEngines.map((e, i) => {
                  const dc = e.direction === "bearish" ? "#f97316" : e.direction === "bullish" ? "#22c55e" : "rgba(6,182,212,0.5)";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
                      <div style={{ ...mono, width: "140px", fontSize: "9px", color: "rgba(6,182,212,0.6)", flexShrink: 0 }}>{e.engine}</div>
                      <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${e.contributionWeight}%`, background: dc, borderRadius: "2px", transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)" }} />
                      </div>
                      <div style={{ ...mono, width: "30px", textAlign: "right", fontSize: "9px", color: dc, fontWeight: 700 }}>{e.contributionWeight}%</div>
                      <div style={{ ...mono, width: "60px", fontSize: "8px", color: dc, textAlign: "right" }}>{e.direction.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 5 — SEISMOGRAPH WAVEFORM
        ══════════════════════════════════════════════════════ */}
        {safeEvolution.sparkline90d.length > 0 && (
          <div style={{ marginBottom: "32px", opacity: loadPhase >= 4 ? 1 : 0, transition: "opacity 0.5s ease-out 0.25s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.18em", color: "rgba(6,182,212,0.4)", fontWeight: 700 }}>LIVE PRESSURE SIGNAL — 90 DAYS</div>
              <span style={{ position: "relative", display: "inline-block", width: "5px", height: "5px", flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: "-3px", borderRadius: "50%", background: scoreColor, opacity: 0, animation: "live-ripple 2.2s ease-out infinite", animationDelay: "0.4s" }} />
                <span style={{ display: "block", width: "5px", height: "5px", borderRadius: "50%", background: scoreColor, boxShadow: `0 0 6px ${scoreColor}`, animation: "livepulse 2s infinite", position: "relative", zIndex: 1 }} />
              </span>
            </div>
            <LiveSeismographWave sparkline={safeEvolution.sparkline90d} scoreColor={scoreColor} currentScore={currentScore} />
            <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: "8px", color: "rgba(6,182,212,0.28)", marginTop: "5px" }}>
              <span>90 DAYS AGO</span><span>LIVE</span>
            </div>
          </div>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 6 — TODAY'S BEST TRADE TYPES
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 4 ? 1 : 0, transition: "opacity 0.5s ease-out 0.3s" }}>
          <SectionLabel text="TODAY'S BEST TRADE TYPES" />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tradeTypes.map((tt, i) => {
              const starColor = tt.stars >= 4 ? "#22c55e" : tt.stars === 3 ? "#06b6d4" : tt.stars === 2 ? "#f59e0b" : "#ef4444";
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)", borderLeft: `2px solid ${starColor}50`, display: "flex", alignItems: "flex-start", gap: "14px", opacity: loadPhase >= 4 ? 1 : 0, transform: loadPhase >= 4 ? "translateY(0)" : "translateY(6px)", transition: `opacity 0.4s ease-out ${i * 60}ms, transform 0.4s ease-out ${i * 60}ms` }}>
                  <div style={{ flexShrink: 0, minWidth: "80px" }}>
                    <Stars count={tt.stars} color={starColor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                      <span style={{ ...mono, fontSize: "11px", fontWeight: 700, color: starColor }}>{tt.name}</span>
                      <span style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.4)", padding: "1px 5px", border: "1px solid rgba(6,182,212,0.15)", borderRadius: "3px" }}>CONFIDENCE: {tt.confidence.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.5, margin: "0 0 3px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{tt.why}</p>
                    <p style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.35)", margin: 0 }}>{tt.evidence}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 7 — CURRENT CAUTIONS
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 4 ? 1 : 0, transition: "opacity 0.5s ease-out 0.35s" }}>
          <SectionLabel text="CURRENT CAUTIONS" color="rgba(245,158,11,0.5)" />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {cautions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 14px", background: "rgba(245,158,11,0.03)", borderRadius: "6px", borderLeft: "2px solid rgba(245,158,11,0.3)" }}>
                <span style={{ ...mono, fontSize: "10px", color: "rgba(245,158,11,0.6)", flexShrink: 0, marginTop: "2px" }}>⚠</span>
                <span style={{ fontSize: "13px", color: "rgba(226,232,240,0.7)", lineHeight: 1.6, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 8 — SCENARIO DISTRIBUTION
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 5 ? 1 : 0, transition: "opacity 0.5s ease-out 0.4s" }}>
          <SectionLabel text="SCENARIO DISTRIBUTION" />
          <div style={{ padding: "22px 20px", background: "rgba(6,182,212,0.02)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.1)" }}>
            <AnimProbBar label="BULL MARKET" value={regimeProbs.bull} color="#22c55e" revealDelay={0} />
            <AnimProbBar label="SOFT LANDING" value={regimeProbs.softLanding} color="#06b6d4" revealDelay={80} />
            <AnimProbBar label="STAGFLATION" value={regimeProbs.stagflation} color="#f59e0b" revealDelay={160} />
            <AnimProbBar label="RECESSION" value={regimeProbs.recession} color="#f97316" revealDelay={240} />
            <AnimProbBar label="CRISIS / CRASH" value={regimeProbs.crash} color="#ef4444" revealDelay={320} />
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(6,182,212,0.08)", display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", marginBottom: "3px" }}>MODEL CONFIDENCE</div>
                <div style={{ ...mono, fontSize: "13px", fontWeight: 700, color: "rgba(6,182,212,0.8)" }}>{probabilities.confidence}%</div>
              </div>
              {probabilities.primaryDriver && (
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", marginBottom: "3px" }}>PRIMARY DRIVER</div>
                  <div style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.4, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{probabilities.primaryDriver}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 9 — PRESSURE DRIVERS (Evidence + Engines)
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 5 ? 1 : 0, transition: "opacity 0.5s ease-out 0.45s" }}>
          <SectionLabel text="PRESSURE DRIVERS" />

          {/* What is building */}
          {marketNarrative.whatIsBuildingBeneathSurface && (
            <div style={{ marginBottom: "16px", padding: "16px 18px", background: "rgba(245,158,11,0.03)", borderRadius: "6px", borderLeft: "3px solid rgba(245,158,11,0.3)" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(245,158,11,0.5)", fontWeight: 700, marginBottom: "8px" }}>WHAT IS BUILDING BENEATH THE SURFACE</div>
              <p style={{ fontSize: "13px", color: "rgba(226,232,240,0.75)", lineHeight: 1.65, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{marketNarrative.whatIsBuildingBeneathSurface}</p>
            </div>
          )}

          {/* Developing conditions */}
          {safeDevelopingConditions.length > 0 && (
            <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {safeDevelopingConditions.map((c, i) => {
                const sevColor = c.severity === "Critical" ? "#ef4444" : c.severity === "High" ? "#f97316" : c.severity === "Moderate" ? "#f59e0b" : "#22c55e";
                const trendLabel = c.trend === "building" ? "▲ BUILDING" : c.trend === "easing" ? "▼ EASING" : "─ STABLE";
                const trendColor = c.trend === "building" ? "#f97316" : c.trend === "easing" ? "#22c55e" : "rgba(6,182,212,0.45)";
                return (
                  <div key={i} style={{ padding: "12px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", borderLeft: `2px solid ${sevColor}50` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "5px", flexWrap: "wrap" }}>
                      <div style={{ ...mono, fontSize: "11px", fontWeight: 700, color: sevColor }}>{c.title}</div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                        <span style={{ ...mono, fontSize: "8px", color: trendColor, fontWeight: 700 }}>{trendLabel}</span>
                        <span style={{ ...mono, fontSize: "8px", color: sevColor, padding: "1px 5px", border: `1px solid ${sevColor}35`, borderRadius: "3px" }}>{c.severity.toUpperCase()}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.6, margin: "0 0 6px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c.description}</p>
                    {c.durationDescription && <p style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.4)", margin: "0 0 5px" }}>{c.durationDescription}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap" }}>{c.engines.map((e, j) => <EngineTag key={j} name={e} />)}</div>
                    {c.expectedImpact && <p style={{ fontSize: "11px", color: "rgba(6,182,212,0.5)", fontStyle: "italic", margin: "5px 0 0", lineHeight: 1.45, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>Expected impact: {c.expectedImpact}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Evidence families */}
          {safeEvidenceFamilies.length > 0 && (
            <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "7px" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>EVIDENCE FAMILIES</div>
              {safeEvidenceFamilies.map((ef, i) => {
                const sc = signalColor(ef.signal);
                return (
                  <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: `2px solid ${sc}35` }}>
                    <div style={{ flexShrink: 0, width: "90px" }}>
                      <div style={{ ...mono, fontSize: "9px", fontWeight: 700, color: sc, letterSpacing: "0.04em", marginBottom: "2px" }}>{ef.name}</div>
                      <div style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.35)" }}>{ef.signal.toUpperCase()}</div>
                      <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <div style={{ flex: 1, height: "3px", background: "rgba(6,182,212,0.08)", borderRadius: "2px" }}>
                          <div style={{ height: "100%", width: `${(ef.strength / 10) * 100}%`, background: sc, borderRadius: "2px" }} />
                        </div>
                        <span style={{ ...mono, fontSize: "8px", color: sc }}>{ef.strength.toFixed(1)}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "11px", color: "rgba(226,232,240,0.7)", lineHeight: 1.55, margin: "0 0 3px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.currentValue}</p>
                      <p style={{ fontSize: "10px", color: "rgba(6,182,212,0.45)", lineHeight: 1.45, margin: 0, fontStyle: "italic", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.whyItMatters}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Engine consensus */}
          <div style={{ padding: "12px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.4)", fontWeight: 700 }}>ENGINE CONSENSUS</div>
              <span style={{ ...mono, fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "3px", background: evidenceConsensus === "strong" ? "rgba(34,197,94,0.12)" : evidenceConsensus === "divergent" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.1)", color: evidenceConsensus === "strong" ? "#22c55e" : evidenceConsensus === "divergent" ? "#ef4444" : "#f59e0b", border: `1px solid ${evidenceConsensus === "strong" ? "rgba(34,197,94,0.25)" : evidenceConsensus === "divergent" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.2)"}` }}>
                {evidenceConsensus.toUpperCase()}
              </span>
            </div>
            {safeEnginesAgreeing.length > 0 && <div style={{ marginBottom: "6px" }}><div style={{ ...mono, fontSize: "8px", color: "rgba(34,197,94,0.5)", letterSpacing: "0.08em", marginBottom: "4px" }}>CONFIRMING</div><div style={{ display: "flex", flexWrap: "wrap" }}>{safeEnginesAgreeing.map((e, i) => <EngineTag key={i} name={e} />)}</div></div>}
            {safeEnginesDisagreeing.length > 0 && <div><div style={{ ...mono, fontSize: "8px", color: "rgba(245,158,11,0.5)", letterSpacing: "0.08em", marginBottom: "4px" }}>DIVERGING</div><div style={{ display: "flex", flexWrap: "wrap" }}>{safeEnginesDisagreeing.map((e, i) => <EngineTag key={i} name={e} />)}</div></div>}
          </div>
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 10 — HISTORICAL COMPARISON
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 6 ? 1 : 0, transition: "opacity 0.5s ease-out 0.5s" }}>
          <SectionLabel text="HISTORICAL COMPARISON" />

          {/* Trend summaries */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {([
              { label: "7-DAY TREND", text: safeEvolution.sevenDayTrend },
              { label: "30-DAY TREND", text: safeEvolution.thirtyDayTrend },
              { label: "90-DAY TREND", text: safeEvolution.ninetyDayTrend },
              { label: "12-MONTH TREND", text: safeEvolution.yearTrend },
            ] as { label: string; text: string }[]).filter(t => t.text).map(({ label, text }, i) => (
              <div key={i} style={{ padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.08)" }}>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.35)", fontWeight: 700, marginBottom: "4px" }}>{label}</div>
                <p style={{ fontSize: "11px", color: "rgba(226,232,240,0.65)", lineHeight: 1.5, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{text}</p>
              </div>
            ))}
          </div>

          {/* Historical analogs */}
          {safeAnalogs.length > 0 && (
            <div>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>CLOSEST HISTORICAL ANALOGS</div>
              {analogSummary && <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.5)", lineHeight: 1.6, margin: "0 0 12px", fontStyle: "italic", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{analogSummary}</p>}
              {safeAnalogs.slice(0, 3).map((a, i) => (
                <div key={i} style={{ marginBottom: "10px", padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#06b6d4" }}>{a.period}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.38)", letterSpacing: "0.06em" }}>SIMILARITY</span>
                      <span style={{ ...mono, fontSize: "11px", fontWeight: 700, color: "#06b6d4" }}>{a.similarity}%</span>
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.55, margin: "0 0 10px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{a.description}</p>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    {([
                      { label: "3M RETURN", val: a.avgReturn3m },
                      { label: "6M RETURN", val: a.avgReturn6m },
                      { label: "12M RETURN", val: a.avgReturn12m },
                    ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ ...mono, fontSize: "8px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                        <div style={{ ...mono, fontSize: "13px", fontWeight: 700, color: val === null ? "rgba(6,182,212,0.25)" : val >= 0 ? "#22c55e" : "#ef4444" }}>
                          {val !== null ? `${val > 0 ? "+" : ""}${val}%` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {a.resolution && <p style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.38)", margin: "8px 0 0", lineHeight: 1.4 }}>Resolution: {a.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 11 — WHAT COULD CHANGE
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 6 ? 1 : 0, transition: "opacity 0.5s ease-out 0.55s" }}>
          <SectionLabel text="WHAT COULD CHANGE THE OUTLOOK" color="rgba(245,158,11,0.5)" />

          {marketNarrative.whatHasChanged && (
            <div style={{ marginBottom: "14px", padding: "14px 16px", background: "rgba(245,158,11,0.03)", borderRadius: "6px", borderLeft: "3px solid rgba(245,158,11,0.3)" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(245,158,11,0.5)", fontWeight: 700, marginBottom: "7px" }}>WHAT HAS CHANGED</div>
              <p style={{ fontSize: "13px", color: "rgba(226,232,240,0.72)", lineHeight: 1.65, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{marketNarrative.whatHasChanged}</p>
            </div>
          )}

          {safeEvolution.whatChanged.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>RECENT SHIFTS</div>
              {safeEvolution.whatChanged.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "5px" }}>
                  <span style={{ ...mono, fontSize: "10px", color: "rgba(245,158,11,0.4)", flexShrink: 0, marginTop: "2px" }}>›</span>
                  <span style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.5, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                </div>
              ))}
            </div>
          )}

          {safeEvolution.whatToWatch.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(245,158,11,0.45)", fontWeight: 700, marginBottom: "8px" }}>WHAT TO WATCH</div>
              {safeEvolution.whatToWatch.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(245,158,11,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(245,158,11,0.25)" }}>
                  <span style={{ fontSize: "12px", color: "rgba(245,158,11,0.7)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Invalidation conditions */}
          {(marketNarrative.whatWouldInvalidate || safeEvolution.invalidationConditions.length > 0) && (
            <div>
              <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(239,68,68,0.45)", fontWeight: 700, marginBottom: "8px" }}>INVALIDATION CONDITIONS</div>
              {marketNarrative.whatWouldInvalidate && (
                <div style={{ marginBottom: "8px", padding: "10px 12px", background: "rgba(239,68,68,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(239,68,68,0.25)" }}>
                  <p style={{ fontSize: "12px", color: "rgba(239,68,68,0.65)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{marketNarrative.whatWouldInvalidate}</p>
                </div>
              )}
              {safeEvolution.invalidationConditions.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(239,68,68,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(239,68,68,0.25)" }}>
                  <span style={{ fontSize: "12px", color: "rgba(239,68,68,0.65)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            SECTION 12 — TODAY'S PLAYBOOK
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "32px", opacity: loadPhase >= 7 ? 1 : 0, transition: "opacity 0.5s ease-out 0.6s" }}>
          <SectionLabel text="TODAY'S PLAYBOOK" color="rgba(6,182,212,0.6)" />
          <div style={{ padding: "24px", background: "rgba(6,182,212,0.03)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.15)", borderTop: `3px solid ${scoreColor}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              {[
                { label: "CURRENT ENVIRONMENT", value: currentRegime, color: stressColor(currentStressLevel) },
                { label: "RECOMMENDED BIAS", value: tradingConditions.bias, color: tradingConditions.biasColor },
                { label: "BEST TRADE STYLE", value: tradeTypes[0]?.name ?? "Selective", color: tradeTypes[0]?.stars >= 4 ? "#22c55e" : "#06b6d4" },
                { label: "PRIMARY RISK", value: currentStressLevel, color: stressColor(currentStressLevel) },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: "12px 14px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
                  <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.38)", marginBottom: "6px" }}>{label}</div>
                  <div style={{ ...mono, fontSize: "13px", fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ padding: "12px 14px", background: "rgba(34,197,94,0.04)", borderRadius: "6px", border: "1px solid rgba(34,197,94,0.15)" }}>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(34,197,94,0.5)", marginBottom: "7px" }}>BIGGEST OPPORTUNITY</div>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.7)", lineHeight: 1.5, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
                  {regimeProbs.bull > 40
                    ? "Long exposure in leading sectors with strong momentum and low systemic risk."
                    : regimeProbs.softLanding > 30
                    ? "Quality growth names benefiting from soft-landing macro trajectory."
                    : "Defensive positioning and income-generating strategies in a challenging environment."}
                </p>
              </div>
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.04)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.12em", color: "rgba(239,68,68,0.5)", marginBottom: "7px" }}>BIGGEST THREAT</div>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.7)", lineHeight: 1.5, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
                  {cautions[0] ?? "Maintain standard risk discipline and position sizing."}
                </p>
              </div>
            </div>

            {safeEvolution.whatChanged.length > 0 && (
              <div style={{ padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.08)" }}>
                <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "6px" }}>WHAT CHANGED</div>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.5, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{safeEvolution.whatChanged[0]}</p>
              </div>
            )}
          </div>
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════
            ASHA SEISMIC REPORT
        ══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "24px", opacity: loadPhase >= 7 ? 1 : 0, transition: "opacity 0.5s ease-out 0.65s" }}>
          <SectionErrorBoundary label="ASHA Intelligence"><AshaIntelligenceBrief variant="seismic-report" /></SectionErrorBoundary>
        </div>

        {/* ── ASK ASHA ── */}
        <div style={{ padding: "20px", background: "rgba(6,182,212,0.03)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.12)", textAlign: "center", marginBottom: "32px", opacity: loadPhase >= 8 ? 1 : 0, transition: "opacity 0.5s ease-out 0.7s" }}>
          <div style={{ ...mono, fontSize: "8px", letterSpacing: "0.18em", color: "rgba(6,182,212,0.4)", marginBottom: "10px" }}>ASK ASHA</div>
          <p style={{ fontSize: "13px", color: "rgba(226,232,240,0.55)", lineHeight: 1.65, margin: "0 0 16px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
            Ask ASHA any question about the current market environment. ASHA reads the full FAULTLINE intelligence context before responding.
          </p>
          <Link href="/asha">
            <button style={{ ...mono, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, color: "#050608", background: "#06b6d4", border: "none", borderRadius: "5px", padding: "10px 24px", cursor: "pointer", transition: "opacity 0.15s" }}>
              OPEN ASHA →
            </button>
          </Link>
        </div>

        {/* Footer */}
        <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(6,182,212,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.28)", letterSpacing: "0.08em" }}>FAULTLINE SEISMOGRAPH™ · SINGLE SOURCE OF TRUTH</div>
          <div style={{ ...mono, fontSize: "9px", color: "rgba(6,182,212,0.28)" }}>{safeMemory.observationCount} OBSERVATIONS · {safeMemory.datasetSpan}</div>
        </div>

      </div>

      <style>{`
        @keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes score-breathe-deep {
          0%   { filter: brightness(1)    drop-shadow(0 0 8px currentColor); }
          40%  { filter: brightness(1.22) drop-shadow(0 0 28px currentColor) drop-shadow(0 0 56px currentColor); }
          100% { filter: brightness(1)    drop-shadow(0 0 8px currentColor); }
        }
        @keyframes live-ripple {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes shimmer-flow {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes page-scanline {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 0.07; }
          95%  { opacity: 0.03; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes seismo-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
    </div>
  );
}
