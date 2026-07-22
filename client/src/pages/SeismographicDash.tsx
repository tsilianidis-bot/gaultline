/* ============================================================
   FAULTLINE — Seismographic Dash
   Unified home page merging Dashboard + Seismograph Intelligence.
   Architecture: ASHA hero → Live waveform → Executive briefing →
                 Today's Answer → Intelligence strip → Mode selector →
                 Deep-dive intelligence → Risk heatmap → Analogs →
                 Metrics → Search panels → SEO section
   Design: Palantir Noir — void black, neon accents, scanlines.
   All animations respect prefers-reduced-motion.
   ============================================================ */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Share2, HelpCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { metrics, MetricCard } from "@/lib/data";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import DataIntegrity from "@/components/DataIntegrity";
import HomeCryptoSection from "@/components/HomeCryptoSection";
import WaitlistSection from "@/components/WaitlistSection";
import HomeStockIntelSection from "@/components/HomeStockIntelSection";
import { CryptoPorchPanel, StockPorchPanel } from "@/components/DashboardSearchPanels";
import { OpportunityDiscoveryPanel } from "@/components/OpportunityDiscoveryPanel";
import Onboarding from "@/components/Onboarding";
import ShareCard from "@/components/ShareCard";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ViewModeSelector } from "@/components/ViewModeSelector";
import PulseMode from "@/components/dashboard/PulseMode";
import SignalsMode from "@/components/dashboard/SignalsMode";
import IntelligenceMode from "@/components/dashboard/IntelligenceMode";
import { AwarenessDashboardCard, MarketPreflightModal } from "@/components/MarketPreflight";
import PreflightGate from "@/components/PreflightGate";
import MarketSynthesisPanel from "@/components/MarketSynthesisPanel";
import HomepageBriefingPanel from "@/components/HomepageBriefingPanel";
import SeismographNarrativeBanner from "@/components/SeismographNarrativeBanner";
import SOBPanel from "@/components/SOBPanel";
import FaultlineTerm from "@/components/FaultlineTerm";
import ScoreExplainer from "@/components/ScoreExplainer";
import AshaHeroSection from "@/components/AshaHeroSection";
import AshaDailyGreeting from "@/components/AshaDailyGreeting";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import AshaOrb, { AshaRegimeState } from "@/components/AshaOrb";
import SeismicWaveShared from "@/components/SeismicWave";
import { Activity } from "lucide-react";
import { Link } from "wouter";
import { useRegisterAshaContext } from "@/contexts/AshaContext";

type DashboardMode = "pulse" | "signals" | "intelligence";

// ── Color utilities (from Seismograph) ────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#f59e0b";
  if (score >= 25) return "#22c55e";
  return "#10b981";
}
function stressColor(level: string): string {
  if (level === "Crisis") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Elevated") return "#f59e0b";
  return "#22c55e";
}
function directionColor_seismo(dir: string): string {
  if (dir === "Deteriorating" || dir === "Accelerating") return "#f97316";
  if (dir === "Improving") return "#22c55e";
  return "#06b6d4";
}

// ── Reduced-motion helper ─────────────────────────────────────────────────────
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Animated count-up hook (from Seismograph) ─────────────────────────────────
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

// ── Staged load hook (from Seismograph) ──────────────────────────────────────
function useStagedLoad(ready: boolean): number {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!ready) return;
    if (prefersReducedMotion()) { setPhase(5); return; }
    const delays = [0, 200, 500, 800, 1200, 1800];
    delays.forEach((d, i) => {
      const t = setTimeout(() => setPhase(i + 1), d);
      timerRef.current.push(t);
    });
    return () => timerRef.current.forEach(clearTimeout);
  }, [ready]);
  return phase;
}

// ── Live seismograph waveform (from Seismograph) ──────────────────────────────
interface WaveformProps {
  sparkline: { score: number }[];
  scoreColor: string;
  currentScore: number;
}
function LiveSeismographWave({ sparkline, scoreColor, currentScore }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dataRef = useRef<number[]>([]);
  const tRef = useRef(0);
  useEffect(() => {
    if (sparkline.length > 0) {
      dataRef.current = sparkline.map((p) => p.score);
    } else {
      dataRef.current = Array.from({ length: 60 }, (_, i) =>
        currentScore + Math.sin(i * 0.3) * 3 + Math.random() * 2 - 1
      );
    }
  }, [sparkline, currentScore]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const data = dataRef.current;
      const len = data.length;
      if (len < 2) { animRef.current = requestAnimationFrame(draw); return; }
      const t = tRef.current;
      // Shift data slightly each frame for flowing motion
      if (!prefersReducedMotion()) {
        tRef.current += 0.012;
        if (tRef.current > 1) {
          tRef.current -= 1;
          dataRef.current = [...data.slice(1), data[data.length - 1] + (Math.random() - 0.48) * 1.2];
        }
      }
      const minV = Math.min(...data) - 2;
      const maxV = Math.max(...data) + 2;
      const range = maxV - minV || 1;
      const toY = (v: number) => h - ((v - minV) / range) * h * 0.75 - h * 0.12;
      // Halo glow layer
      ctx.beginPath();
      ctx.moveTo(0, toY(data[0]));
      for (let i = 1; i < len; i++) {
        const x = (i / (len - 1)) * w;
        ctx.lineTo(x, toY(data[i]));
      }
      ctx.strokeStyle = scoreColor + "18";
      ctx.lineWidth = 10;
      ctx.stroke();
      // Mid glow
      ctx.beginPath();
      ctx.moveTo(0, toY(data[0]));
      for (let i = 1; i < len; i++) {
        const x = (i / (len - 1)) * w;
        ctx.lineTo(x, toY(data[i]));
      }
      ctx.strokeStyle = scoreColor + "30";
      ctx.lineWidth = 4;
      ctx.stroke();
      // Core line
      ctx.beginPath();
      ctx.moveTo(0, toY(data[0]));
      for (let i = 1; i < len; i++) {
        const x = (i / (len - 1)) * w;
        ctx.lineTo(x, toY(data[i]));
      }
      ctx.strokeStyle = scoreColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = scoreColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Scan cursor
      if (!prefersReducedMotion()) {
        const scanX = (t % 1) * w;
        const scanIdx = Math.floor((t % 1) * (len - 1));
        const scanY = toY(data[Math.min(scanIdx, len - 1)]);
        ctx.beginPath();
        ctx.arc(scanX, scanY, 3, 0, Math.PI * 2);
        ctx.fillStyle = scoreColor;
        ctx.shadowColor = scoreColor;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [scoreColor]);
  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ── Animated probability bar (from Seismograph) ───────────────────────────────
function AnimProbBar({ label, value, color, width = "100px", revealDelay = 0 }: {
  label: string; value: number; color: string; width?: string; revealDelay?: number;
}) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Courier New',monospace" };
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
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
      <div style={{ ...mono, width, fontSize: "9px", color: "rgba(6,182,212,0.55)", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: `${Math.min(100, displayed)}%`, background: color, borderRadius: "2px", transition: "width 0.05s linear", position: "relative", overflow: "hidden" }}>
          {!prefersReducedMotion() && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)", animation: `shimmer-flow ${2.8 + revealDelay * 0.001}s ease-in-out infinite`, animationDelay: `${revealDelay * 0.5}ms` }} />
          )}
        </div>
      </div>
      <div style={{ ...mono, width: "30px", textAlign: "right", fontSize: "10px", color, fontWeight: 700, flexShrink: 0 }}>{displayed}%</div>
    </div>
  );
}

// ── Seismograph layout primitives ─────────────────────────────────────────────
const seismoMono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Courier New',monospace" };
function SeismoDivider() {
  return <div style={{ width: "100%", height: "1px", background: "rgba(6,182,212,0.1)", margin: "0 0 20px" }} />;
}
function SectionLabel({ text, color }: { text: string; color?: string }) {
  return (
    <div style={{ ...seismoMono, fontSize: "9px", letterSpacing: "0.16em", fontWeight: 700, color: color || "rgba(6,182,212,0.45)", marginBottom: "14px", textTransform: "uppercase" }}>
      {text}
    </div>
  );
}
function NarrativeBlock({ question, answer, accentColor }: { question: string; answer: string; accentColor?: string }) {
  return (
    <div style={{ marginBottom: "14px", paddingLeft: "12px", borderLeft: `2px solid ${accentColor || "rgba(6,182,212,0.25)"}` }}>
      <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.12em", color: accentColor || "rgba(6,182,212,0.45)", fontWeight: 700, marginBottom: "5px" }}>{question}</div>
      <div style={{ fontSize: "13px", color: "rgba(226,232,240,0.82)", lineHeight: 1.65, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{answer}</div>
    </div>
  );
}
function EngineTag({ name }: { name: string }) {
  return (
    <span style={{ ...seismoMono, display: "inline-block", fontSize: "8px", color: "rgba(6,182,212,0.55)", padding: "2px 6px", border: "1px solid rgba(6,182,212,0.15)", borderRadius: "3px", letterSpacing: "0.04em", marginRight: "4px", marginBottom: "4px" }}>
      {name}
    </span>
  );
}


// ── Seeded deterministic mini-series ─────────────────────────
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function buildMiniSeries(seed: number, n: number, base: number, vol: number) {
  const r = seededRand(seed);
  let v = base;
  return Array.from({ length: n }, () => {
    v = Math.max(1, Math.min(9.9, v + (r() - 0.48) * vol));
    return { v: parseFloat(v.toFixed(2)) };
  });
}

// ── Ambient particle canvas ───────────────────────────────────
function AmbientParticles({ riskLevel }: { riskLevel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorMap: Record<string, [number, number, number]> = {
    critical: [255, 45, 85],
    high: [255, 149, 0],
    elevated: [255, 215, 0],
    moderate: [0, 212, 255],
    low: [0, 255, 136],
  };
  const [r, g, b] = colorMap[riskLevel] ?? [0, 212, 255];
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 2.2 + 0.5,
      opacity: Math.random() * 0.55 + 0.12,
    }));
    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [riskLevel, r, g, b]);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

// ── SeismicWave wrapper ─────────────────────────────────────────────────────────
function SeismicWave({ color, score }: { color: string; score: number }) {
  return <SeismicWaveShared color={color} score={score} height={52} />;
}

// ── Intelligence ticker bar ─────────────────────────────────────────────────
function IntelTicker({ items }: { items: { label: string; value: string; color: string }[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="intel-ticker" style={{ height: '26px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', animation: 'ticker-scroll 28s linear infinite', whiteSpace: 'nowrap', willChange: 'transform' }}>
        {doubled.map((item, i) => (
          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.14)' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.label}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: item.color, fontWeight: 600, letterSpacing: '0.05em' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ProbBar ─────────────────────────────────────────
function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 600); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ flex: 1, minWidth: '72px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
      <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${anim}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, boxShadow: `0 0 6px ${color}60`, borderRadius: '2px', transition: 'width 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color, fontWeight: 600 }}>{value}%</div>
    </div>
  );
}

// ── Narrative panel ───────────────────────────────────────────
function NarrativePanel({ narrative, regime }: {
  narrative: { summary: string; keyRisks: string[] };
  regime: { label: string; color: string };
}) {
  const [revealed, setRevealed] = useState(0);
  const words = useMemo(() => narrative.summary.split(' '), [narrative.summary]);
  useEffect(() => {
    setRevealed(0);
    const iv = setInterval(() => {
      setRevealed(prev => { if (prev >= words.length) { clearInterval(iv); return prev; } return prev + 1; });
    }, 28);
    return () => clearInterval(iv);
  }, [narrative.summary, words.length]);
  return (
    <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderLeft: `3px solid ${regime.color}`, borderRadius: '6px', padding: '16px', position: 'relative', overflow: 'hidden' }}>
      <div className="data-stream" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '3px', height: '16px', background: regime.color, borderRadius: '2px', boxShadow: `0 0 8px ${regime.color}` }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Intelligence Narrative
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: regime.color, marginLeft: 'auto' }}>
            {regime.label}
          </span>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#B0C4D8', lineHeight: 1.75, marginBottom: '14px' }}>
          {words.slice(0, revealed).join(' ')}
          {revealed < words.length && <span className="narrative-cursor" />}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {narrative.keyRisks.slice(0, 3).map((risk, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', animation: `fade-slide-up 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 80 + 600}ms both` }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: regime.color, flexShrink: 0, marginTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#B0C4D8', lineHeight: 1.55 }}>{risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Heatmap cell ──────────────────────────────────────────────
function HeatCell({ label, score, delay }: { label: string; score: number; delay: number }) {
  const level = score >= 8.5 ? 'critical' : score >= 7 ? 'high' : score >= 5 ? 'elevated' : score >= 3 ? 'moderate' : 'low';
  const color = getRiskColor(level);
  const severityText = level === 'critical' ? 'CRISIS' : level === 'high' ? 'HIGH' : level === 'elevated' ? 'ELEV' : level === 'moderate' ? 'MOD' : 'LOW';
  const intensity = score / 10;
  function hexAlpha(a: number) { return Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0'); }
  return (
    <div style={{
      background: `${color}${hexAlpha(intensity * 0.12)}`,
      border: `1px solid ${color}${hexAlpha(intensity * 0.25)}`,
      borderRadius: '4px', padding: '10px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${delay}ms both`,
      transition: 'transform 0.2s ease',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
    >
      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color, textShadow: `0 0 10px ${color}80`, animation: score >= 7 ? 'heatmap-pulse 2s ease-in-out infinite' : 'none', lineHeight: 1 }}>
        {score.toFixed(1)}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: `${color}90`, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1 }}>
        {severityText}
      </span>
    </div>
  );
}

// ── What Changed Today item ───────────────────────────────────
function ChangeItem({ label, delta, color, detail }: { label: string; delta: number; color: string; detail: string }) {
  const sign = delta > 0 ? '+' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
      <div style={{ width: '3px', height: '30px', background: color, borderRadius: '2px', boxShadow: `0 0 8px ${color}60`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D1D5DB', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '3px', padding: '3px 8px', flexShrink: 0 }}>
        {sign}{delta.toFixed(1)}
      </div>
    </div>
  );
}

// ── MetricCard item ───────────────────────────────────────────
function MetricCardItem({ metric, index }: { metric: MetricCard; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = getRiskColor(metric.riskLevel);
  return (
    <div
      className="intel-module"
      style={{ padding: '10px 12px', cursor: 'pointer', animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${index * 60}ms both` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{metric.category}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '2px', padding: '1px 5px', textTransform: 'uppercase' }}>{metric.riskLevel}</span>
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '14px', color: '#F0F6FF', marginBottom: '3px' }}>{metric.label}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.45 }}>{metric.interpretation}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px', fontWeight: 700, color, textShadow: `0 0 12px ${color}60`, lineHeight: 1 }}>{metric.value}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B' }}>{metric.unit}</div>
          {expanded ? <ChevronUp size={12} style={{ color: '#64748B' }} /> : <ChevronDown size={12} style={{ color: '#64748B' }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.09)', animation: 'fade-slide-up 0.25s ease both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Signal Drivers</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color, fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>›</span>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.45 }}>{metric.historicalComparison}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Awareness Section ─────────────────────────────────────────
function DashboardAwarenessSection() {
  const [open, setOpen] = useState(false);
  const { output } = useEngine();
  const regimeLabel = output?.regime?.label ?? "Unknown";
  return (
    <>
      <AwarenessDashboardCard onOpen={() => setOpen(true)} />
      <MarketPreflightModal
        open={open}
        onClose={() => setOpen(false)}
        currentPage="dashboard"
        regimeLabel={regimeLabel}
      />
    </>
  );
}

// ── Upgrade prompt ────────────────────────────────────────────
function DashboardUpgradePrompt() {
  const { user } = useAuth();
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, { enabled: !!user, retry: false });
  const tier = tierQuery.data?.tier ?? "free";
  if (!user || tier === "premium" || tier === "founding") return null;
  return (
    <a
      href="/app/account"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', marginBottom: '12px', borderRadius: '6px',
        background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,229,255,0.25)',
        textDecoration: 'none', transition: 'background 0.15s ease', cursor: 'pointer',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,229,255,0.14)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.04)'; }}
    >
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(0,229,255,0.65)', marginBottom: '2px' }}>{tier === 'core' ? 'UPGRADE TO PRO' : 'UPGRADE TO CORE'}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C0D0E0' }}>
          {tier === 'core' ? 'Situation Room · Market Preflight · Institutional dashboards · Historical analogs' : 'Unlimited Ask Intelligence · Symbol Intelligence · Full Signal Outlook · Portfolio tracker'}
        </div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#00E5FF', flexShrink: 0, marginLeft: '12px' }}>UPGRADE →</div>
    </a>
  );
}


// ── Main SeismographicDash component ─────────────────────────
const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663562889431/oAHJBBc62GHpVJwTBFZPAm/faultline-hero-bg-5aiJwmUWM5RkwbakA3ZsnX.webp";

export default function SeismographicDash() {
  useSEO(PAGE_SEO.home);

  // ── Dashboard data ──────────────────────────────────────────
  const { output, rawFred, indicators, isLoading: dashLoading, isLive, lastUpdated, isSimulating } = useEngine();
  const { overall, domains, regime, probability, analogs, narrative } = output;
  const [showShare, setShowShare] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [heroInputFocused, setHeroInputFocused] = useState(false);
  const [heroInputValue, setHeroInputValue] = useState('');
  const heroInputRef = useRef<HTMLInputElement>(null);
  const ashaRegimeState: AshaRegimeState = overall.score >= 7 ? 'critical' : overall.score >= 4.5 ? 'rising' : 'calm';

  // ── 3-mode intelligence system ──────────────────────────────
  const { data: meData } = trpc.auth.me.useQuery();
  const [dashMode, setDashMode] = useState<DashboardMode>("pulse");
  const setModeMutation = trpc.auth.setDashboardMode.useMutation();
  useEffect(() => {
    if (meData?.dashboardMode) setDashMode(meData.dashboardMode as DashboardMode);
  }, [meData?.dashboardMode]);
  const handleModeChange = (mode: DashboardMode) => {
    setDashMode(mode);
    setModeMutation.mutate({ mode });
  };

  // ── Seismograph data ────────────────────────────────────────
  const [now, setNow] = useState(() => new Date());
  const { data: intel, isLoading: seismoLoading, refetch, isFetching } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const formatUtc = (d: Date) => d.toISOString().replace("T", " ").substring(0, 16) + " UTC";

  // ── Derived data ────────────────────────────────────────────
  const severityLabel = (riskLevel: string): string => {
    const map: Record<string, string> = { low: 'Stable', moderate: 'Building', elevated: 'Elevated', high: 'Accelerating', critical: 'Critical' };
    return map[riskLevel] ?? 'Stable';
  };
  const updatedAgo = useMemo(() => {
    if (!lastUpdated) return null;
    const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1m ago';
    return `${mins}m ago`;
  }, [lastUpdated]);
  const keyShifts = useMemo(() => {
    const sorted = [...domains].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return sorted.slice(0, 4).map(d => ({
      label: d.label.split(' ')[0],
      direction: d.delta > 0.05 ? 'rising' : d.delta < -0.05 ? 'easing' : 'stable',
      severity: severityLabel(d.riskLevel),
      color: getRiskColor(d.riskLevel),
    }));
  }, [domains]);
  const heatmapScores = useMemo(() => domains.map(d => ({ label: d.label.split(' ')[0], score: d.score })), [domains]);
  const topThreat = useMemo(() => [...domains].sort((a, b) => b.score - a.score)[0], [domains]);
  const topStabilizer = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const changedDomains = useMemo(() => [...domains].filter(d => Math.abs(d.delta) > 0.1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4), [domains]);
  const aiDomain = useMemo(() => domains.find(d => d.id === 'ai-bubble'), [domains]);
  const color = regime.color;
  const regimeAttr = overall.riskLevel === 'low' ? 'bullish' : overall.riskLevel === 'moderate' ? 'moderate' : overall.riskLevel === 'elevated' ? 'elevated' : 'crisis';

  // ── Seismograph derived data ────────────────────────────────
  const seismoReady = !!intel;
  const loadPhase = useStagedLoad(seismoReady);
  const currentScore = intel?.currentScore ?? 0;
  const animatedScore = useCountUp(currentScore, 1100, 400);
  const scoreColor = intel ? pressureColor(intel.currentScore) : "#06b6d4";
  const currentRegime = intel?.currentRegime ?? "";
  const currentDirection = intel?.currentDirection ?? "";
  const currentStressLevel = intel?.currentStressLevel ?? "";
  const currentPercentile = intel?.currentPercentile ?? 0;
  const todayStory = intel?.todayStory ?? "";
  const keyDevelopments = intel?.keyDevelopments ?? [];
  const whyThisScore = intel?.whyThisScore ?? "";
  const whyThisRegime = intel?.whyThisRegime ?? "";
  const probabilities = intel?.probabilities ?? { primaryDriver: "" };
  const evidenceFamilies = intel?.evidenceFamilies ?? [];
  const evidenceConsensus = intel?.evidenceConsensus ?? { summary: "", bullishCount: 0, bearishCount: 0, neutralCount: 0 };
  const enginesAgreeing = intel?.enginesAgreeing ?? 0;
  const enginesDisagreeing = intel?.enginesDisagreeing ?? 0;
  const seismoAnalogs = intel?.analogs ?? [];
  const analogSummary = intel?.analogSummary ?? "";
  const transitionProbabilities = intel?.transitionProbabilities ?? { remainInRegime: 0, transitionToElevated: 0, transitionToLow: 0, transitionToCrisis: 0, historicalBasis: "" };
  const evolution = intel?.evolution ?? { whatChanged: [], whatToWatch: [], invalidationConditions: [] };
  const memory = intel?.memory ?? { observationCount: 0, datasetSpan: "", historicalStats: { avgPressure: 0, maxPressure: 0, criticalMonths: 0, highRiskMonths: 0 } };
  const regimeProbabilities5way = intel?.regimeProbabilities5way ?? { deepBull: 0, bull: 0, neutral: 0, bear: 0, crisis: 0 };
  const developingConditions = intel?.developingConditions ?? [];
  const engineContributions = intel?.engineContributions ?? [];
  const marketNarrative = intel?.marketNarrative ?? { whatIsBuildingBeneathSurface: "", whyIsItHappening: "", highestProbabilityPath: "", whatHasChanged: "", whatWouldInvalidate: "" };
  const sparkline = intel?.macroTicker ?? [];
  const topEngines = [...engineContributions].sort((a: any, b: any) => b.contributionWeight - a.contributionWeight).slice(0, 5);

  // ── ASHA context registration ───────────────────────────────
  const ashaCtx = useMemo(() => ({
    page: "seismograph" as const,
    pressureScore: currentScore,
    regime: currentRegime,
    narrative: todayStory,
    trend: currentDirection,
    keyDrivers: keyDevelopments?.slice(0, 3),
    historicalAnalog: seismoAnalogs?.[0] ? `${seismoAnalogs[0].period} (similarity: ${(seismoAnalogs[0].similarity * 100).toFixed(0)}%)` : undefined,
    transitionProbability: transitionProbabilities?.transitionToElevated,
    additionalContext: { stressLevel: currentStressLevel, percentile: currentPercentile, enginesAgreeing, enginesDisagreeing },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentScore, currentRegime, todayStory, currentDirection, currentStressLevel, currentPercentile, transitionProbabilities?.transitionToElevated]);
  useRegisterAshaContext(ashaCtx);

  // ── Dashboard hero derived ──────────────────────────────────
  const directionLabel = overall.delta > 0.15 ? 'RISING' : overall.delta < -0.15 ? 'EASING' : 'STABLE';
  const directionColor = overall.delta > 0.15 ? '#FF9500' : overall.delta < -0.15 ? '#00FF88' : '#B0C4D8';
  const topAnalog = analogs[0];
  const analogLabel = topAnalog?.era?.split(' ').slice(0, 2).join(' ') ?? '—';
  const analogSim = topAnalog?.similarity ?? 0;
  const verdictScore = overall.score;
  const verdictLabel = verdictScore >= 7.5 ? 'RISK OFF' : verdictScore >= 5.5 ? 'CAUTION' : verdictScore >= 3.5 ? 'SELECTIVE' : 'RISK ON';
  const verdictColor = verdictScore >= 7.5 ? '#FF2D55' : verdictScore >= 5.5 ? '#FF9500' : verdictScore >= 3.5 ? '#FFD700' : '#00FF88';
  const bestDomain = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const biggestShift = useMemo(() => [...domains].filter(d => Math.abs(d.delta) > 0.05).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0], [domains]);

  return (
    <div data-regime={regimeAttr} style={{ background: '#080A0F', minHeight: '100vh', position: 'relative' }} className="ambient-bg">
      {/* Market Preflight Gate */}
      <PreflightGate />
      {/* SEO H1 */}
      <h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        FAULTLINE — Macroeconomic &amp; Market Risk Intelligence Platform
      </h1>
      {/* Regime ambient overlay */}
      <div className="regime-ambient" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, transition: 'background 2s ease' }} />
      <AmbientParticles riskLevel={overall.riskLevel} />
      {/* Ambient page scanline */}
      {!prefersReducedMotion() && (
        <div aria-hidden="true" style={{ position: "fixed", left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.12) 30%, rgba(6,182,212,0.18) 50%, rgba(6,182,212,0.12) 70%, transparent 100%)", pointerEvents: "none", zIndex: 1, animation: "page-scanline 8s linear infinite", animationDelay: "1s" }} />
      )}
      {/* Intelligence Ticker */}
      <IntelTicker items={[
        { label: 'FAULTLINE', value: `${overall.score.toFixed(1)}/10`, color },
        { label: 'REGIME', value: regime.label, color },
        { label: 'BULL', value: `${probability.bullProbability}%`, color: '#00FF88' },
        { label: 'CRASH', value: `${probability.crashProbability}%`, color: '#FF2D55' },
        { label: 'TOP THREAT', value: topThreat?.label?.split(' ')[0] ?? '—', color: '#FF2D55' },
        { label: 'ANALOG', value: analogs[0]?.era?.split(' ').slice(0, 2).join(' ') ?? '—', color: '#00E5FF' },
        { label: 'DELTA', value: `${overall.delta >= 0 ? '+' : ''}${overall.delta.toFixed(1)}`, color },
        { label: 'STATUS', value: isLive ? 'LIVE FEED' : 'SIMULATED', color: isLive ? '#00FF88' : '#FF9500' },
      ]} />
      {/* Onboarding */}
      <Onboarding forceOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      {showShare && <ShareCard onClose={() => setShowShare(false)} />}


      {/* ══════════════════════════════════════════════════════
          SECTION 1 — ASHA Intelligence First
      ══════════════════════════════════════════════════════ */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>
        <SectionErrorBoundary label="ASHA Greeting"><AshaDailyGreeting /></SectionErrorBoundary>
        <div style={{ marginBottom: '16px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
          <SectionErrorBoundary label="ASHA Intelligence"><AshaIntelligenceBrief variant="market-brief" /></SectionErrorBoundary>
        </div>
        <DashboardUpgradePrompt />
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — ASHA Hero: ticker strip + intelligence panel
      ══════════════════════════════════════════════════════ */}
      <AshaHeroSection />

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — Live Seismograph Waveform
          (from SeismographIntelligence — the signature visual)
      ══════════════════════════════════════════════════════ */}
      {seismoReady && loadPhase >= 1 && (
        <div style={{ padding: "0 16px", maxWidth: "800px", margin: "0 auto", marginBottom: "8px", animation: "cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 0ms both" }}>
          <div style={{ background: "rgba(0,0,0,0.85)", borderRadius: "8px", border: `1px solid ${scoreColor}22`, overflow: "hidden", position: "relative" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 6px", borderBottom: `1px solid ${scoreColor}14` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={12} style={{ color: scoreColor, opacity: 0.7 }} />
                <span style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.45)" }}>LIVE SEISMOGRAPH</span>
                {!prefersReducedMotion() && (
                  <span style={{ display: "inline-block", width: "5px", height: "5px", borderRadius: "50%", background: scoreColor, animation: "pulse-dot 1.4s ease-in-out infinite" }} />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...seismoMono, fontSize: "7px", color: "rgba(6,182,212,0.3)", letterSpacing: "0.1em" }}>UTC</div>
                  <div style={{ ...seismoMono, fontSize: "9px", color: "rgba(6,182,212,0.45)" }}>{formatUtc(now)}</div>
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(6,182,212,0.4)", padding: "2px", display: "flex", alignItems: "center" }}
                  title="Refresh intelligence"
                >
                  <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
                </button>
              </div>
            </div>
            {/* Score + waveform */}
            <div style={{ display: "flex", alignItems: "stretch", gap: "0" }}>
              {/* Score readout */}
              <div style={{ padding: "14px 16px", borderRight: `1px solid ${scoreColor}14`, minWidth: "90px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
                <div style={{ ...seismoMono, fontSize: "7px", letterSpacing: "0.14em", color: "rgba(6,182,212,0.35)", marginBottom: "2px" }}>PRESSURE</div>
                <div style={{ ...seismoMono, fontSize: "38px", fontWeight: 900, color: scoreColor, lineHeight: 1, textShadow: `0 0 20px ${scoreColor}55`, letterSpacing: "-0.02em" }}>
                  {animatedScore}
                </div>
                <div style={{ ...seismoMono, fontSize: "8px", color: "rgba(6,182,212,0.3)", letterSpacing: "0.06em" }}>/ 100</div>
                <div style={{ ...seismoMono, fontSize: "8px", color: stressColor(currentStressLevel), letterSpacing: "0.1em", marginTop: "4px", textTransform: "uppercase" }}>
                  {currentStressLevel}
                </div>
                <div style={{ ...seismoMono, fontSize: "8px", color: directionColor_seismo(currentDirection), letterSpacing: "0.06em" }}>
                  {currentDirection}
                </div>
                <div style={{ ...seismoMono, fontSize: "8px", color: "rgba(6,182,212,0.3)", letterSpacing: "0.06em" }}>
                  P{currentPercentile}
                </div>
              </div>
              {/* Waveform */}
              <div style={{ flex: 1, height: "110px", position: "relative", overflow: "hidden" }}>
                <LiveSeismographWave sparkline={sparkline} scoreColor={scoreColor} currentScore={currentScore} />
                {/* Regime label overlay */}
                <div style={{ position: "absolute", top: "8px", right: "10px", ...seismoMono, fontSize: "9px", color: scoreColor, letterSpacing: "0.1em", opacity: 0.65, textTransform: "uppercase" }}>
                  {currentRegime}
                </div>
              </div>
            </div>
            {/* Key developments strip */}
            {keyDevelopments.length > 0 && (
              <div style={{ padding: "8px 14px", borderTop: `1px solid ${scoreColor}14`, display: "flex", gap: "16px", overflowX: "auto", scrollbarWidth: "none" }}>
                {keyDevelopments.slice(0, 3).map((kd: string, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", flexShrink: 0, maxWidth: "220px" }}>
                    <span style={{ ...seismoMono, fontSize: "9px", color: scoreColor, opacity: 0.5, flexShrink: 0, marginTop: "1px" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: "10px", color: "rgba(226,232,240,0.55)", lineHeight: 1.45, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{kd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — Narrative + Briefing + Synthesis + Modes
      ══════════════════════════════════════════════════════ */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>
        <SeismographNarrativeBanner context="dashboard" defaultExpanded={false} />
        <HomepageBriefingPanel />
        <MarketSynthesisPanel context="dashboard" />
        <ViewModeSelector mode={dashMode} onChange={handleModeChange} />
        {dashMode === "pulse" && <PulseMode />}
        {dashMode === "signals" && <SignalsMode />}
        {dashMode === "intelligence" && <IntelligenceMode />}
        {/* Quick Actions bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 100ms both' }}>
          {([
            { label: 'Pre-Flight',      path: '/app/pre-flight',              color: '#00E5FF' },
            { label: 'Decision Engine', path: '/app/decision-engine',          color: '#FF9500' },
            { label: 'Day Trade',       path: '/app/day-trade-intelligence',  color: '#00FF88' },
            { label: 'Signal Outlook',  path: '/app/signal-outlook',          color: '#C084FC' },
            { label: 'Market Stress',   path: '/app/pressure',                color: '#FF2D55' },
          ] as { label: string; path: string; color: string }[]).map(action => (
            <a key={action.path} href={action.path} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', background: `${action.color}0D`, border: `1px solid ${action.color}30`, borderRadius: '4px', color: action.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = `${action.color}1A`; (e.currentTarget as HTMLAnchorElement).style.borderColor = `${action.color}55`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = `${action.color}0D`; (e.currentTarget as HTMLAnchorElement).style.borderColor = `${action.color}30`; }}
            >
              {action.label}
            </a>
          ))}
        </div>
        <DataIntegrity />
        <DashboardAwarenessSection />
      </div>


      {/* ══════════════════════════════════════════════════════
          SECTION 5 — Deep-Dive Seismograph Intelligence
          (all 7 sections from SeismographIntelligence.tsx)
      ══════════════════════════════════════════════════════ */}
      {seismoReady && loadPhase >= 2 && (
        <div style={{ padding: "0 16px", maxWidth: "800px", margin: "0 auto", marginTop: "8px", animation: "cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 200ms both" }}>
          <div style={{ background: "rgba(0,0,0,0.82)", borderRadius: "8px", border: "1px solid rgba(6,182,212,0.1)", padding: "18px 16px" }}>

            {/* ── SECTION 5a — Today's Story ── */}
            <SectionLabel text="Today's Story" color="rgba(6,182,212,0.6)" />
            <NarrativeBlock question="WHAT IS HAPPENING" answer={todayStory} accentColor="rgba(6,182,212,0.4)" />
            <NarrativeBlock question="WHY THIS SCORE" answer={whyThisScore} />
            <NarrativeBlock question="WHY THIS REGIME" answer={whyThisRegime} />
            {keyDevelopments.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>KEY DEVELOPMENTS</div>
                {keyDevelopments.map((kd: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px" }}>
                    <span style={{ ...seismoMono, fontSize: "9px", color: "rgba(6,182,212,0.35)", flexShrink: 0, marginTop: "2px" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: "12px", color: "rgba(226,232,240,0.72)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{kd}</span>
                  </div>
                ))}
              </div>
            )}
            {developingConditions.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>DEVELOPING CONDITIONS</div>
                {developingConditions.map((dc: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "5px", padding: "6px 10px", background: "rgba(6,182,212,0.02)", borderRadius: "4px", borderLeft: "2px solid rgba(6,182,212,0.15)" }}>
                    <span style={{ fontSize: "11px", color: "rgba(226,232,240,0.6)", lineHeight: 1.5, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{dc}</span>
                  </div>
                ))}
              </div>
            )}
            <SeismoDivider />

            {/* ── SECTION 5b — What Is Building Beneath the Surface ── */}
            <SectionLabel text="What Is Building Beneath the Surface" color="rgba(6,182,212,0.6)" />
            <NarrativeBlock question="BENEATH THE SURFACE" answer={marketNarrative.whatIsBuildingBeneathSurface} accentColor="rgba(6,182,212,0.4)" />
            <NarrativeBlock question="WHY IT IS HAPPENING" answer={marketNarrative.whyIsItHappening} />
            <SeismoDivider />

            {/* ── SECTION 5c — Evidence Consensus ── */}
            <SectionLabel text="Evidence Consensus" color="rgba(6,182,212,0.6)" />
            <div style={{ display: "flex", gap: "14px", marginBottom: "14px", flexWrap: "wrap" }}>
              {([
                { label: "BULLISH", val: evidenceConsensus.bullishCount, color: "#22c55e" },
                { label: "BEARISH", val: evidenceConsensus.bearishCount, color: "#ef4444" },
                { label: "NEUTRAL", val: evidenceConsensus.neutralCount, color: "rgba(6,182,212,0.5)" },
                { label: "AGREEING", val: enginesAgreeing, color: "#22c55e" },
                { label: "DISAGREEING", val: enginesDisagreeing, color: "#f97316" },
              ] as { label: string; val: number; color: string }[]).map(({ label, val, color: c }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ ...seismoMono, fontSize: "7px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.1em", marginBottom: "2px" }}>{label}</div>
                  <div style={{ ...seismoMono, fontSize: "20px", fontWeight: 700, color: c }}>{val}</div>
                </div>
              ))}
            </div>
            {evidenceConsensus.summary && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{evidenceConsensus.summary}</p>
              </div>
            )}
            {evidenceFamilies.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>EVIDENCE FAMILIES</div>
                {evidenceFamilies.map((ef: any, i: number) => {
                  const sc = ef.signal === "bearish" ? "#ef4444" : ef.signal === "bullish" ? "#22c55e" : "rgba(6,182,212,0.5)";
                  return (
                    <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px", padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.07)" }}>
                      <div style={{ flexShrink: 0, width: "80px" }}>
                        <div style={{ ...seismoMono, fontSize: "9px", color: sc, fontWeight: 700, letterSpacing: "0.04em", marginBottom: "2px" }}>{ef.name}</div>
                        <div style={{ ...seismoMono, fontSize: "8px", color: sc, letterSpacing: "0.06em", opacity: 0.7, marginBottom: "4px" }}>{ef.signal?.toUpperCase() ?? ''}</div>
                        <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <div style={{ flex: 1, height: "3px", background: "rgba(6,182,212,0.08)", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${(ef.strength / 10) * 100}%`, background: sc, borderRadius: "2px" }} />
                          </div>
                          <span style={{ ...seismoMono, fontSize: "8px", color: sc }}>{ef.strength.toFixed(1)}</span>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "11px", color: "rgba(226,232,240,0.72)", lineHeight: 1.55, margin: "0 0 4px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.currentValue}</p>
                        <p style={{ fontSize: "10px", color: "rgba(6,182,212,0.45)", lineHeight: 1.45, margin: "0 0 4px", fontStyle: "italic", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{ef.whyItMatters}</p>
                        <p style={{ ...seismoMono, fontSize: "9px", color: "rgba(6,182,212,0.3)", lineHeight: 1.4, margin: 0 }}>{ef.historicalContext}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Engine contributions */}
            {topEngines.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>ENGINE CONTRIBUTIONS</div>
                {topEngines.map((e: any, i: number) => {
                  const dc = e.direction === "bearish" ? "#f97316" : e.direction === "bullish" ? "#22c55e" : "rgba(6,182,212,0.5)";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
                      <div style={{ ...seismoMono, width: "130px", fontSize: "9px", color: "rgba(6,182,212,0.6)", flexShrink: 0, letterSpacing: "0.02em" }}>{e.engine}</div>
                      <div style={{ flex: 1, height: "4px", background: "rgba(6,182,212,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${e.contributionWeight}%`, background: dc, borderRadius: "2px", transition: "width 0.9s cubic-bezier(0.23,1,0.32,1)" }} />
                      </div>
                      <div style={{ ...seismoMono, width: "28px", textAlign: "right", fontSize: "9px", color: dc, fontWeight: 700, flexShrink: 0 }}>{e.contributionWeight}%</div>
                      <div style={{ ...seismoMono, width: "60px", fontSize: "8px", color: dc, textAlign: "right", flexShrink: 0, letterSpacing: "0.04em" }}>{e.direction?.toUpperCase() ?? ''}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <SeismoDivider />

            {/* ── SECTION 5d — Highest Probability Path Forward ── */}
            <SectionLabel text="Highest Probability Path Forward" color="rgba(6,182,212,0.6)" />
            <NarrativeBlock question="HIGHEST-PROBABILITY OUTCOME" answer={marketNarrative.highestProbabilityPath} accentColor="rgba(6,182,212,0.4)" />
            {probabilities.primaryDriver && (
              <NarrativeBlock question="PRIMARY DRIVER" answer={probabilities.primaryDriver} />
            )}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>REGIME TRANSITION PROBABILITIES</div>
              <AnimProbBar label="REMAIN IN REGIME" value={transitionProbabilities.remainInRegime} color="#06b6d4" width="140px" />
              <AnimProbBar label="TRANSITION ELEVATED" value={transitionProbabilities.transitionToElevated} color="#f97316" width="140px" revealDelay={100} />
              <AnimProbBar label="TRANSITION LOW" value={transitionProbabilities.transitionToLow} color="#22c55e" width="140px" revealDelay={200} />
              <AnimProbBar label="TRANSITION CRISIS" value={transitionProbabilities.transitionToCrisis} color="#ef4444" width="140px" revealDelay={300} />
            </div>
            {transitionProbabilities.historicalBasis && (
              <div style={{ marginBottom: "20px", padding: "10px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "4px" }}>HISTORICAL BASIS</div>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{transitionProbabilities.historicalBasis}</p>
              </div>
            )}
            <SeismoDivider />

            {/* ── SECTION 5e — Historical Analogs ── */}
            <SectionLabel text="Historical Analogs" color="rgba(6,182,212,0.6)" />
            {analogSummary && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
                <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.55, margin: 0, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{analogSummary}</p>
              </div>
            )}
            {seismoAnalogs.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                {seismoAnalogs.slice(0, 3).map((a: any, i: number) => (
                  <div key={i} style={{ marginBottom: "14px", padding: "12px 14px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <div style={{ ...seismoMono, fontSize: "11px", fontWeight: 700, color: "rgba(6,182,212,0.75)" }}>{a.period}</div>
                      <div style={{ ...seismoMono, fontSize: "9px", color: "rgba(6,182,212,0.4)" }}>SIM: {(a.similarity * 100).toFixed(0)}%</div>
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.55, margin: "0 0 10px", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{a.description}</p>
                    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                      {([
                        { label: "3M RETURN", val: a.avgReturn3m },
                        { label: "6M RETURN", val: a.avgReturn6m },
                        { label: "12M RETURN", val: a.avgReturn12m },
                      ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                        <div key={label}>
                          <div style={{ ...seismoMono, fontSize: "8px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                          <div style={{ ...seismoMono, fontSize: "13px", fontWeight: 700, color: val === null ? "rgba(6,182,212,0.25)" : val >= 0 ? "#22c55e" : "#ef4444" }}>
                            {val !== null ? `${val > 0 ? "+" : ""}${val}%` : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                    {a.resolution && (
                      <p style={{ ...seismoMono, fontSize: "9px", color: "rgba(6,182,212,0.38)", margin: "8px 0 0", lineHeight: 1.4 }}>Resolution: {a.resolution}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Historical stats */}
            <div style={{ marginBottom: "20px", padding: "14px 16px", background: "rgba(6,182,212,0.02)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.08)" }}>
              <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "10px" }}>DATASET CONTEXT — {memory.datasetSpan}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px" }}>
                {([
                  { label: "AVG PRESSURE", val: memory.historicalStats.avgPressure },
                  { label: "MAX PRESSURE", val: memory.historicalStats.maxPressure },
                  { label: "CRISIS MONTHS", val: memory.historicalStats.criticalMonths },
                  { label: "HIGH-RISK MONTHS", val: memory.historicalStats.highRiskMonths },
                ] as { label: string; val: number }[]).map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ ...seismoMono, fontSize: "8px", color: "rgba(6,182,212,0.32)", letterSpacing: "0.08em", marginBottom: "3px" }}>{label}</div>
                    <div style={{ ...seismoMono, fontSize: "14px", fontWeight: 700, color: "rgba(6,182,212,0.75)" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            <SeismoDivider />

            {/* ── SECTION 5f — What Could Change the Outlook ── */}
            <SectionLabel text="What Could Change the Outlook" color="rgba(245,158,11,0.55)" />
            <NarrativeBlock question="WHAT HAS CHANGED" answer={marketNarrative.whatHasChanged} accentColor="rgba(245,158,11,0.4)" />
            {evolution.whatChanged.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.38)", fontWeight: 700, marginBottom: "8px" }}>RECENT SHIFTS</div>
                {evolution.whatChanged.map((c: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "5px" }}>
                    <span style={{ ...seismoMono, fontSize: "10px", color: "rgba(245,158,11,0.4)", flexShrink: 0, marginTop: "2px" }}>›</span>
                    <span style={{ fontSize: "12px", color: "rgba(226,232,240,0.65)", lineHeight: 1.5, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
            {evolution.whatToWatch.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ ...seismoMono, fontSize: "8px", letterSpacing: "0.1em", color: "rgba(245,158,11,0.45)", fontWeight: 700, marginBottom: "8px" }}>WHAT TO WATCH</div>
                {evolution.whatToWatch.map((c: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(245,158,11,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(245,158,11,0.25)" }}>
                    <span style={{ fontSize: "12px", color: "rgba(245,158,11,0.7)", lineHeight: 1.55, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
            <SeismoDivider />

            {/* ── SECTION 5g — Invalidation Conditions ── */}
            <SectionLabel text="What Would Invalidate This View" color="rgba(239,68,68,0.5)" />
            <NarrativeBlock question="INVALIDATION SCENARIO" answer={marketNarrative.whatWouldInvalidate} accentColor="rgba(239,68,68,0.35)" />
            {evolution.invalidationConditions.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                {evolution.invalidationConditions.map((c: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "6px", padding: "8px 12px", background: "rgba(239,68,68,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(239,68,68,0.2)" }}>
                    <span style={{ ...seismoMono, fontSize: "9px", color: "rgba(239,68,68,0.4)", flexShrink: 0, marginTop: "2px" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: "12px", color: "rgba(226,232,240,0.6)", lineHeight: 1.5, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════
          SECTION 6 — Dashboard Risk Heatmap + SOB + Narrative
      ══════════════════════════════════════════════════════ */}
      <div style={{ padding: '0 16px', maxWidth: '800px', margin: '0 auto', marginTop: '8px' }}>
        {/* Risk Heatmap */}
        <div style={{ marginBottom: '12px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 120ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '2px' }}>
            Risk Heatmap — 10 Domains
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {heatmapScores.slice(0, 10).map((d, i) => (
              <HeatCell key={d.label} label={d.label} score={d.score} delay={i * 55} />
            ))}
          </div>
        </div>

        {/* SOB Panel */}
        <SectionErrorBoundary label="SOB Panel">
          <SOBPanel context="dashboard" />
        </SectionErrorBoundary>

        {/* Narrative Panel */}
        <div style={{ marginBottom: '12px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 160ms both' }}>
          <NarrativePanel narrative={narrative} regime={regime} />
        </div>

        {/* Probability bars */}
        <div style={{ marginBottom: '12px', background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '14px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 180ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
            Market Probability Distribution
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <ProbBar label="Bull" value={probability.bullProbability} color="#00FF88" />
            <ProbBar label="Bear" value={probability.bearProbability} color="#FF9500" />
            <ProbBar label="Crash" value={probability.crashProbability} color="#FF2D55" />
            <ProbBar label="Neutral" value={probability.neutralProbability} color="#00E5FF" />
          </div>
        </div>

        {/* What Changed Today */}
        {changedDomains.length > 0 && (
          <div style={{ marginBottom: '12px', background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '14px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 200ms both' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
              What Changed Today
            </div>
            {changedDomains.map((d, i) => (
              <ChangeItem
                key={d.id}
                label={d.label}
                delta={d.delta}
                color={getRiskColor(d.riskLevel)}
                detail={d.interpretation}
              />
            ))}
          </div>
        )}

        {/* Regime Anchor */}
        <div style={{ marginBottom: '12px', background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '14px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 220ms both' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>Regime</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color, textShadow: `0 0 14px ${color}60`, lineHeight: 1.1 }}>{regime.label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: directionColor, marginTop: '4px' }}>{directionLabel}</div>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>Verdict</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color: verdictColor, textShadow: `0 0 14px ${verdictColor}60`, lineHeight: 1.1 }}>{verdictLabel}</div>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>Analog</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '16px', color: '#00E5FF', lineHeight: 1.2 }}>{analogLabel}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{(analogSim * 100).toFixed(0)}% match</div>
            </div>
          </div>
        </div>

        {/* AI Bubble Monitor */}
        {aiDomain && (
          <div style={{ marginBottom: '12px', background: 'rgba(12,15,22,0.95)', border: `1px solid ${getRiskColor(aiDomain.riskLevel)}20`, borderRadius: '6px', padding: '14px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 240ms both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>AI Bubble Monitor</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: getRiskColor(aiDomain.riskLevel), background: `${getRiskColor(aiDomain.riskLevel)}12`, border: `1px solid ${getRiskColor(aiDomain.riskLevel)}25`, borderRadius: '2px', padding: '1px 5px', textTransform: 'uppercase' }}>{aiDomain.riskLevel}</div>
            </div>
            <SeismicWave color={getRiskColor(aiDomain.riskLevel)} score={aiDomain.score} />
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#B0C4D8', lineHeight: 1.55, marginTop: '8px' }}>{aiDomain.interpretation}</div>
          </div>
        )}

        {/* Metrics */}
        <div style={{ marginBottom: '12px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 260ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '2px' }}>
            Market Metrics
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {metrics.slice(0, 8).map((m, i) => (
              <MetricCardItem key={m.id} metric={m} index={i} />
            ))}
          </div>
        </div>

        {/* Search Panels */}
        <SectionErrorBoundary label="Stock Porch">
          <StockPorchPanel />
        </SectionErrorBoundary>
        <SectionErrorBoundary label="Crypto Porch">
          <CryptoPorchPanel />
        </SectionErrorBoundary>
        <SectionErrorBoundary label="Opportunity Discovery">
          <OpportunityDiscoveryPanel />
        </SectionErrorBoundary>
        <SectionErrorBoundary label="Home Stock Intel">
          <HomeStockIntelSection />
        </SectionErrorBoundary>
        <SectionErrorBoundary label="Home Crypto">
          <HomeCryptoSection />
        </SectionErrorBoundary>

        {/* Waitlist */}
        <WaitlistSection />

        {/* SEO Footer */}
        <div style={{ padding: '24px 0 32px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '20px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#4B5563', textTransform: 'uppercase', marginBottom: '14px' }}>
            FAULTLINE Intelligence Platform
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#4B5563', lineHeight: 1.7, marginBottom: '12px' }}>
            FAULTLINE is an AI-powered macroeconomic intelligence platform that monitors systemic market risk across 10 analytical domains — credit markets, monetary policy, equity valuations, geopolitical risk, AI bubble formation, and more. ASHA, our intelligence layer, synthesizes signals from 10 analytical engines to surface what is happening, why it is happening, how long it has been developing, and how current conditions compare with history.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Market Risk Dashboard', path: '/app/pressure' },
              { label: 'Signal Outlook', path: '/app/signal-outlook' },
              { label: 'Historical Analogs', path: '/app/analogs' },
              { label: 'AI Bubble Monitor', path: '/app/pressure' },
              { label: 'Daily Report', path: '/app/report' },
            ].map(link => (
              <a key={link.path} href={link.path} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#4B5563', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1px', transition: 'color 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#00E5FF'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#4B5563'}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Global keyframe styles */}
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes cinematic-reveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heatmap-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes pulse-dot { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes page-scanline { 0% { top: -2px; } 100% { top: 100vh; } }
        @keyframes shimmer-flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .intel-ticker { background: rgba(8,10,15,0.95); border-bottom: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
        .intel-module { background: rgba(12,15,22,0.92); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; transition: border-color 0.2s ease; }
        .intel-module:hover { border-color: rgba(255,255,255,0.16); }
        .narrative-cursor { display: inline-block; width: 2px; height: 14px; background: currentColor; margin-left: 2px; animation: heatmap-pulse 0.8s step-end infinite; vertical-align: text-bottom; }
        .data-stream { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px); }
      `}</style>
    </div>
  );
}
