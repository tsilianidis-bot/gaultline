/* ============================================================
   FAULTLINE — Dashboard v7 "Launch-Ready"
   Mobile-first, trustworthy, shareable, retention-optimized.
   Reactive: all values from EngineContext.
   Design: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useRef, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Share2, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { useLiveIndicatorReadings } from "@/hooks/useLiveIndicatorReadings";
import { evaluableIndicatorValues, type IndicatorReading } from "@/lib/liveIndicatorReadings";
import { getRiskColor } from "@/components/RiskBadge";
import DataIntegrity from "@/components/DataIntegrity";
import HomeCryptoSection from "@/components/HomeCryptoSection";
import WaitlistSection from "@/components/WaitlistSection";
import { CryptoPorchPanel, StockPorchPanel } from "@/components/DashboardSearchPanels";
import { OpportunityDiscoveryPanel } from "@/components/OpportunityDiscoveryPanel";
import Onboarding from "@/components/Onboarding";
import ShareCard from "@/components/ShareCard";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trpc } from "@/lib/trpc";
import { CANONICAL_DESTINATION_BY_ID } from "@shared/routeRegistry";
import { useAuth } from "@/_core/hooks/useAuth";
import { ViewModeSelector } from "@/components/ViewModeSelector";
import PulseMode from "@/components/dashboard/PulseMode";
import SignalsMode from "@/components/dashboard/SignalsMode";
import IntelligenceMode from "@/components/dashboard/IntelligenceMode";
import MarketSynthesisPanel from "@/components/MarketSynthesisPanel";
import HomepageBriefingPanel from "@/components/HomepageBriefingPanel";
import SeismographNarrativeBanner from "@/components/SeismographNarrativeBanner";
import SOBPanel from "@/components/SOBPanel";
import FaultlineTerm from "@/components/FaultlineTerm";
import { engineProbabilityPercent, engineProbabilityText } from "@/lib/marketStateProjection";
import { formatCanonicalScore } from "@shared/marketMetrics";
import { availableDelta, finiteOrNull, pointsDeltaText, score100Value, similarityText } from "@/lib/displayFallbacks";
import type { ProbabilityDisplay } from "@shared/probabilityContract";

/** Engine 0–10 domain/overall score shown on the canonical 0–100 scale. */
// Canonical composite direction (state.now.direction) → strip cell. "Unavailable" when absent.
function canonicalDirectionView(direction: string | undefined): { label: string; color: string } {
  switch (direction) {
    case 'Accelerating': return { label: 'ACCELERATING ▲', color: '#FF2D55' };
    case 'Deteriorating': return { label: 'DETERIORATING ▲', color: '#FF9500' };
    case 'Improving': return { label: 'IMPROVING ▼', color: '#00FF88' };
    case 'Stable': return { label: 'STABLE —', color: '#B0C4D8' };
    default: return { label: 'UNAVAILABLE', color: '#94A3B8' };
  }
}

function score100(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? formatCanonicalScore(score * 10) : "—";
}
import AshaHeroSection from "@/components/AshaHeroSection";
import AshaDailyGreeting from "@/components/AshaDailyGreeting";
import { AshaIntelligenceBrief } from "@/components/AshaIntelligenceBrief";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import AshaOrb, { AshaRegimeState } from "@/components/AshaOrb";
import SeismicWaveShared from "@/components/SeismicWave";
import { Activity } from "lucide-react";
import { PageDegradedBanner, PageLoadingState } from "@/components/PageStateViews";
import { EarlyWarningPresentationPanel } from "@/components/EarlyWarningPresentationPanel";
type DashboardMode = "pulse" | "signals" | "intelligence";

// ── Inline upgrade prompt (free-tier only) ────────────────────
function DashboardUpgradePrompt() {
  const { user } = useAuth();
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, { enabled: !!user, retry: false });
  const tier = tierQuery.data?.tier ?? "free";
  if (!user || tier === "premium" || tier === "founding") return null;
  return (
    <a
      href="/app/account"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        marginBottom: '12px',
        borderRadius: '6px',
        background: 'rgba(0,212,255,0.04)',
        border: '1px solid rgba(0,229,255,0.25)',
        textDecoration: 'none',
        transition: 'background 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,229,255,0.14)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.04)'; }}
    >
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(0,229,255,0.65)', marginBottom: '2px' }}>{tier === 'core' ? 'UPGRADE TO PRO' : 'UPGRADE TO CORE'}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#C0D0E0' }}>
          {tier === 'core' ? 'Situation Room · Institutional dashboards · Historical analogs' : 'Unlimited Ask Intelligence · Symbol Intelligence · Full Signal Outlook · Portfolio tracker'}
        </div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#00E5FF', flexShrink: 0, marginLeft: '12px' }}>UPGRADE →</div>
    </a>
  );
}

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663562889431/oAHJBBc62GHpVJwTBFZPAm/faultline-hero-bg-5aiJwmUWM5RkwbakA3ZsnX.webp";

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

// ── SeismicWave — thin wrapper around shared component ─────────────────────────────
function SeismicWave({ color, score }: { color: string; score: number }) {
  return <SeismicWaveShared color={color} score={score} height={52} />;
}
// Legacy implementation kept below for reference only — not used
function _SeismicWaveLegacy({ color, score }: { color: string; score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;
    const amplitude = 10 + score * 3;
    const freq1 = 0.022 + score * 0.003;
    const freq2 = 0.015 + score * 0.002;
    const freq3 = 0.035 + score * 0.005;
    let animId: number;
    // Size canvas once (not every frame — avoids per-frame layout reflow)
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 52;
    // Resize observer to handle container size changes
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth || 400;
      canvas.height = canvas.offsetHeight || 52;
    });
    ro.observe(canvas);
    const draw = () => {
      const w = canvas.width; const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Layer 1 — deep glow (widest)
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25) * 1.6;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '18';
      ctx.lineWidth = 10;
      ctx.stroke();

      // Layer 2 — mid glow
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq2 + t * 0.85) * (amplitude * 0.7) * Math.sin(x * 0.01 + t * 0.4);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '28';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Layer 3 — sharp primary line
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq1 + t) * amplitude * Math.sin(x * 0.007 + t * 0.25);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + 'D0';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Layer 4 — high-freq noise overlay
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq3 + t * 1.3) * (amplitude * 0.25);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      t += 0.038;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [color, score]);
  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '52px', display: 'block', opacity: 0.9 }} />
  );
}

// ── Radar scan overlay ────────────────────────────────────────
function RadarScan({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Rings */}
      {[1, 0.66, 0.33].map((scale, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}${i === 0 ? '20' : i === 1 ? '14' : '08'}`, transform: `scale(${scale})`, top: `${(1 - scale) * 50}%`, left: `${(1 - scale) * 50}%`, width: `${scale * 100}%`, height: `${scale * 100}%` }} />
      ))}
      {/* Cross hairs */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: `${color}15`, transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: `${color}15`, transform: 'translateX(-50%)' }} />
      {/* Sweep arm */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '50%', height: '2px',
          transformOrigin: '0% 50%',
          background: `linear-gradient(90deg, ${color}80, transparent)`,
          animation: 'radar-sweep 3s linear infinite',
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
      {/* Center dot */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '4px', height: '4px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

// ── Pressure ring ─────────────────────────────────────────────
function PressureRing({ score, color, size = 96 }: { score: number; color: string; size?: number }) {
  const [anim, setAnim] = useState(0);
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  useEffect(() => { const t = setTimeout(() => setAnim(score), 300); return () => clearTimeout(t); }, [score]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {score >= 7 && (
        <>
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `1px solid ${color}30`, animation: 'pressure-wave 2.5s ease-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: `1px solid ${color}18`, animation: 'pressure-wave 2.5s ease-out 0.8s infinite', pointerEvents: 'none' }} />
        </>
      )}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(anim / 10) * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.23,1,0.32,1)', filter: `drop-shadow(0 0 8px ${color}80)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size > 80 ? '26px' : '18px', color, textShadow: `0 0 20px ${color}80`, lineHeight: 1 }}>
          {Math.round(anim * 10)}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>/100</span>
      </div>
    </div>
  );
}

// ── Animated probability bar ──────────────────────────────────
function ProbBar({ label, display, color }: { label: string; display: ProbabilityDisplay; color: string }) {
  // Probability contract: a bar and a number render only when the claim is AVAILABLE.
  const percent = display.state === 'AVAILABLE' ? display.percent : null;
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(percent ?? 0), 600); return () => clearTimeout(t); }, [percent]);
  return (
    <div style={{ flex: 1, minWidth: '72px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
      {percent !== null && (
        <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${anim}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, boxShadow: `0 0 6px ${color}60`, borderRadius: '2px', transition: 'width 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
        </div>
      )}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: percent !== null ? color : '#94A3B8', fontWeight: 600 }}>{display.text}</div>
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
  const intensity = score / 10;
  const hexAlpha = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  const severityMap: Record<string, string> = { low: 'Stable', moderate: 'Building', elevated: 'Elevated', high: 'Accelerating', critical: 'Critical' };
  const severityText = severityMap[level] ?? 'Stable';
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
        {score100Value(score)}
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

// ── Mini live instrument widget ───────────────────────────────
/**
 * One real macro reading (FRED / markets snapshot) with its own freshness tag.
 * No reading → "—" UNAVAILABLE. Never the DEFAULT_INDICATORS demo baseline and
 * no synthetic sparkline.
 */
function MiniWidget({ label, reading, unit, decimals, color }: {
  label: string; reading: IndicatorReading | undefined; unit?: string; decimals: number; color: string;
}) {
  const stateLabel = reading ? reading.stateLabel : 'UNAVAILABLE';
  return (
    <div title={reading?.source ?? 'No real source for this indicator'} style={{
      background: 'rgba(12,15,22,0.92)', border: `1px solid ${color}18`, borderRadius: '4px',
      padding: '12px', position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s cubic-bezier(0.23,1,0.32,1)',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: reading ? color : '#64748B', lineHeight: 1 }}>
            {reading ? reading.value.toFixed(decimals) : '—'}
          </span>
          {unit && reading && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#B0C4D8' }}>{unit}</span>}
        </div>
        {stateLabel && (
          <div data-indicator-state={stateLabel} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: stateLabel === 'UNAVAILABLE' || stateLabel === 'STALE' ? '#F59E0B' : '#94A3B8', letterSpacing: '0.08em' }}>
            {stateLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ── What Changed Today item ───────────────────────────────────
function ChangeItem({ label, delta, color, detail }: { label: string; delta: number | null; color: string; detail: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
      <div style={{ width: '3px', height: '30px', background: color, borderRadius: '2px', boxShadow: `0 0 8px ${color}60`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D1D5DB', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '3px', padding: '3px 8px', flexShrink: 0 }}>
        {pointsDeltaText(delta)}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
// ── Intelligence ticker bar ─────────────────────────────────────────────
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

export default function Dashboard() {
  useSEO(PAGE_SEO.home);
  const { output, isLoading, isLive, integrityLabel, lastUpdated, isSimulating, marketMode } = useEngine();
  // Macro stress widgets read real FRED / markets-snapshot readings only.
  const { readings: liveReadings } = useLiveIndicatorReadings();
  const liveValues = useMemo(() => evaluableIndicatorValues(liveReadings), [liveReadings]);
  const { overall, domains, regime, analogs, narrative } = output;
  // Closest-analog sentence: names a period only when an analog with a finite
  // 0–100 similarity exists; otherwise says Unavailable (never "0% match").
  const analogSentence = (lead: string): string => {
    const top = analogs[0];
    return top?.era && typeof top.similarity === 'number' && Number.isFinite(top.similarity)
      ? `${lead} ${top.era} at ${Math.round(top.similarity)}% similarity.`
      : `${lead} Unavailable.`;
  };
  const [showShare, setShowShare] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [heroInputFocused, setHeroInputFocused] = useState(false);
  const [heroInputValue, setHeroInputValue] = useState('');
  const heroInputRef = useRef<HTMLInputElement>(null);
  // Derive ASHA regime state from pressure score
  const ashaRegimeState: AshaRegimeState = overall.score >= 7 ? 'critical' : overall.score >= 4.5 ? 'rising' : 'calm';
  // 3-mode intelligence system
  const { data: meData } = trpc.auth.me.useQuery();
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [dashMode, setDashMode] = useState<DashboardMode>("pulse");
  const setModeMutation = trpc.auth.setDashboardMode.useMutation();
  // Sync mode from user profile once loaded
  useEffect(() => {
    if (meData?.dashboardMode) {
      setDashMode(meData.dashboardMode as DashboardMode);
    }
  }, [meData?.dashboardMode]);
  const handleModeChange = (mode: DashboardMode) => {
    setDashMode(mode);
    setModeMutation.mutate({ mode });
  };

  // Severity label from riskLevel
  const severityLabel = (riskLevel: string): string => {
    const map: Record<string, string> = { low: 'Stable', moderate: 'Building', elevated: 'Elevated', high: 'Accelerating', critical: 'Critical' };
    return map[riskLevel] ?? 'Stable';
  };

  // Relative timestamp
  const updatedAgo = useMemo(() => {
    if (!lastUpdated) return null;
    const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1m ago';
    return `${mins}m ago`;
  }, [lastUpdated]);

  // Key shifts for Current Regime section
  const keyShifts = useMemo(() => {
    const sorted = [...domains].sort((a, b) => Math.abs(availableDelta(b) ?? 0) - Math.abs(availableDelta(a) ?? 0));
    return sorted.slice(0, 4).map(d => {
      const delta = availableDelta(d);
      return {
      label: d.label.split(' ')[0],
      direction: delta === null ? '—' : delta > 0.05 ? 'rising' : delta < -0.05 ? 'easing' : 'stable',
      severity: severityLabel(d.riskLevel),
      color: getRiskColor(d.riskLevel),
      };
    });
  }, [domains]);

  // Stable memoized derived data
  const heatmapScores = useMemo(() => domains.map(d => ({ label: d.label.split(' ')[0], score: d.score })), [domains]);
  const topThreat = useMemo(() => [...domains].sort((a, b) => b.score - a.score)[0], [domains]);
  const topStabilizer = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const changedDomains = useMemo(() => [...domains].filter(d => Math.abs(availableDelta(d) ?? 0) > 0.1).sort((a, b) => Math.abs(availableDelta(b) ?? 0) - Math.abs(availableDelta(a) ?? 0)).slice(0, 4), [domains]);
  const aiDomain = useMemo(() => domains.find(d => d.id === 'ai-bubble'), [domains]);
  const color = regime.color;

  // Map riskLevel to data-regime attribute for reactive CSS lighting
  const regimeAttr = overall.riskLevel === 'low' ? 'bullish' : overall.riskLevel === 'moderate' ? 'moderate' : overall.riskLevel === 'elevated' ? 'elevated' : 'crisis';

  // Fail closed (after every hook): without the canonical market state the
  // browser engine runs on the fixed DEFAULT_INDICATORS demo inputs, so the
  // deep view must not present that output as the current market reading.
  if (marketMode === 'deterministic-fallback') {
    if (isLoading) {
      return <PageLoadingState eyebrow="NOW · Deep view" message="Loading canonical market state…" />;
    }
    return <PageDegradedBanner message="Current canonical state is unavailable." detail="The deep view withholds the current market reading until one authoritative state is available." />;
  }

  return (
    <div data-regime={regimeAttr} style={{ background: '#080A0F', minHeight: '100vh', position: 'relative' }} className="ambient-bg">
      {/* SEO: Visually hidden H1 for search engine crawlers */}
      <h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        FAULTLINE — Macroeconomic &amp; Market Risk Intelligence Platform
      </h1>
      {/* Regime ambient overlay */}
      <div className="regime-ambient" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, transition: 'background 2s ease' }} />
      <AmbientParticles riskLevel={overall.riskLevel} />

      {/* Intelligence Ticker */}
      <IntelTicker items={[
        { label: 'FAULTLINE', value: score100(overall.score), color },
        { label: 'REGIME', value: regime.label, color },
        { label: 'BULL SCENARIO', value: engineProbabilityText(output, 'bullProbability'), color: '#00FF88' },
        { label: 'CRASH PROB.', value: engineProbabilityText(output, 'crashProbability'), color: '#94A3B8' },
        { label: 'TOP THREAT', value: topThreat?.label?.split(' ')[0] ?? '—', color: '#FF2D55' },
        { label: 'ANALOG', value: analogs[0]?.era?.split(' ').slice(0, 2).join(' ') ?? '—', color: '#00E5FF' },
        { label: 'DELTA', value: pointsDeltaText(availableDelta(overall)), color },
        { label: 'STATUS', value: integrityLabel === 'LIVE' ? 'LIVE FEED' : integrityLabel, color: integrityLabel === 'LIVE' ? '#00FF88' : integrityLabel === 'UNAVAILABLE' ? '#94A3B8' : '#FF9500' },
      ]} />

      {/* Onboarding */}
      <Onboarding forceOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Share card */}
      {showShare && <ShareCard onClose={() => setShowShare(false)} />}

      {/* ── ASHA COMMAND CENTER — Primary first impression ─────────────────── */}
      <div style={{
        position: 'relative',
        background: `linear-gradient(160deg, #070910 0%, #0A0D14 40%, #050608 100%)`,
        borderBottom: `1px solid ${color}35`,
        overflow: 'hidden',
      }}>
        {/* Deep radial glow — reactive to regime */}
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '350px', background: `radial-gradient(ellipse at center, ${color}22 0%, ${color}08 40%, transparent 70%)`, pointerEvents: 'none', transition: 'background 2s ease' }} />
        {/* Secondary glow orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '10%', width: '200px', height: '200px', background: `radial-gradient(ellipse, ${color}06 0%, transparent 70%)`, pointerEvents: 'none', animation: 'ambient-float 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '30%', right: '8%', width: '160px', height: '160px', background: `radial-gradient(ellipse, rgba(255,45,85,0.04) 0%, transparent 70%)`, pointerEvents: 'none', animation: 'ambient-float 24s ease-in-out 6s infinite' }} />
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTop: `2px solid ${color}70`, borderLeft: `2px solid ${color}70`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTop: `2px solid ${color}70`, borderRight: `2px solid ${color}70`, pointerEvents: 'none' }} />
        {/* Scanlines */}
        <div className="scanlines" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: 0.35 }} />

        {/* Help + Share buttons */}
        <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '8px', zIndex: 10 }}>
          <button onClick={() => setShowOnboarding(true)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#B0C4D8', backdropFilter: 'blur(8px)', minHeight: 'unset' }}>
            <HelpCircle size={14} />
          </button>
          <button onClick={() => setShowShare(true)} style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}40`, borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color, backdropFilter: 'blur(8px)', minHeight: 'unset', boxShadow: `0 0 14px ${color}25` }}>
            <Share2 size={14} />
          </button>
        </div>

        {/* Simulate badge */}
        {isSimulating && (
          <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(255,149,0,0.15)', border: '1px solid rgba(255,149,0,0.4)', borderRadius: '3px', backdropFilter: 'blur(8px)' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF9500', animation: 'blink-alert 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#FF9500', letterSpacing: '0.12em' }}>SIMULATION MODE</span>
          </div>
        )}

        {/* ── ASHA Presence — orb, identity, seismic wave, input ── */}
        <div style={{ position: 'relative', zIndex: 2, padding: '36px 20px 0' }}>

          {/* Regime pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, transparent, ${color}50)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 16px', background: `${color}14`, border: `1px solid ${color}50`, borderRadius: '20px', boxShadow: `0 0 20px ${color}15` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}`, animation: 'blink-alert 6s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>{regime.label}</span>
            </div>
            <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, ${color}50, transparent)` }} />
          </div>

          {/* ASHA identity row — orb + name + tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            {/* Orb — glows brighter when input is focused */}
            <div style={{ transition: 'transform 0.3s cubic-bezier(0.23,1,0.32,1)', transform: heroInputFocused ? 'scale(1.08)' : 'scale(1)' }}>
              <AshaOrb regimeState={ashaRegimeState} size={56} isListening={heroInputFocused} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.25em', color: 'rgba(0,229,255,0.55)', marginBottom: '3px' }}>PLATO · FAULTLINE INTELLIGENCE LAYER</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 'clamp(28px, 7vw, 40px)', lineHeight: 1, color, textShadow: `0 0 30px ${color}70`, letterSpacing: '-0.01em' }}>
                {score100Value(overall.score)}<span style={{ fontSize: '0.45em', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>/100</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(240,244,255,0.4)', letterSpacing: '0.12em', marginTop: '2px' }}>{regime.sublabel}</div>
            </div>
          </div>

          {/* Hey ASHA input — the primary interaction */}
          <div style={{ maxWidth: '480px', margin: '0 auto 16px', position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: heroInputFocused ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.03)',
              border: heroInputFocused ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', padding: '10px 14px',
              boxShadow: heroInputFocused ? `0 0 24px ${color}20, inset 0 0 12px ${color}06` : 'none',
              transition: 'all 0.25s cubic-bezier(0.23,1,0.32,1)',
            }}>
              <AshaOrb regimeState={ashaRegimeState} size={18} isListening={heroInputFocused} />
              <input
                ref={heroInputRef}
                type="text"
                value={heroInputValue}
                onChange={e => setHeroInputValue(e.target.value)}
                onFocus={() => setHeroInputFocused(true)}
                onBlur={() => setHeroInputFocused(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && heroInputValue.trim()) {
                    window.location.href = `/app/discover?q=${encodeURIComponent(heroInputValue.trim())}`;
                  }
                }}
                placeholder="Ask PLATO..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px',
                  color: '#E8F0F8', letterSpacing: '0.04em',
                  // @ts-ignore
                  '--placeholder-color': 'rgba(148,163,184,0.6)',
                }}
                className="asha-hero-input"
              />
              {heroInputValue && (
                <button
                  onClick={() => { window.location.href = `/app/discover?q=${encodeURIComponent(heroInputValue.trim())}`; }}
                  style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '4px', padding: '4px 10px', color, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.15s ease', minHeight: 'unset' }}
                >
                  ASK →
                </button>
              )}
            </div>
          </div>

          {/* Seismic waveform — hero element */}
          <div style={{ margin: '0 -20px' }}>
            <SeismicWave color={color} score={overall.score} />
          </div>
        </div>

        {/* ── Live Intelligence Strip — 8 cells, Bloomberg-terminal style ── */}
        {(() => {
          // Direction: the engine delta when known; otherwise the canonical
          // composite direction (state.now.direction), never derived from a 0.
          const overallDelta = availableDelta(overall);
          const { label: directionLabel, color: directionColor } = overallDelta !== null
            ? (overallDelta > 0.2 ? { label: 'RISING ▲', color: '#FF9500' } : overallDelta < -0.2 ? { label: 'FALLING ▼', color: '#00FF88' } : { label: 'STABLE —', color: '#B0C4D8' })
            : canonicalDirectionView(overall.direction);
          const analogLabel = analogs[0]?.era?.split(' ').slice(0, 3).join(' ') ?? '—';
          // No analog → "Unavailable", never a 0% match.
          const analogSim = typeof analogs[0]?.similarity === 'number' && Number.isFinite(analogs[0].similarity) ? Math.round(analogs[0].similarity) : null;
          const verdictColor = overall.riskLevel === 'low' ? '#00FF88' : overall.riskLevel === 'moderate' ? '#FFD700' : overall.riskLevel === 'elevated' ? '#FF9500' : '#FF2D55';
          const verdictLabel = overall.riskLevel === 'low' ? 'RISK ON' : overall.riskLevel === 'moderate' ? 'STAY SELECTIVE' : overall.riskLevel === 'elevated' ? 'REDUCE EXPOSURE' : 'STEP ASIDE';
          const cells = [
            { label: 'PRESSURE INDEX', value: score100Value(overall.score), sub: '/ 100', valueColor: color },
            { label: 'REGIME', value: regime.label.split(' ').slice(0, 2).join(' '), sub: regime.sublabel.slice(0, 18), valueColor: color },
            { label: 'BULL SCENARIO', value: engineProbabilityText(output, 'bullProbability'), sub: 'scenario weight', valueColor: engineProbabilityPercent(output, 'bullProbability') !== null ? '#00FF88' : '#94A3B8' },
            { label: 'CRASH PROBABILITY', value: engineProbabilityText(output, 'crashProbability'), sub: 'no governed model', valueColor: '#94A3B8' },
            { label: 'DIRECTION', value: directionLabel, sub: `Δ ${pointsDeltaText(overallDelta)} vs baseline`, valueColor: directionColor },
            { label: 'CLOSEST ANALOG', value: analogLabel, sub: analogSim !== null ? `${analogSim}% match` : 'Unavailable', valueColor: '#00E5FF' },
            { label: 'TOP THREAT', value: topThreat?.label?.split(' ').slice(0, 2).join(' ') ?? '—', sub: score100(topThreat?.score), valueColor: '#FF2D55' },
            { label: "TODAY'S VERDICT", value: verdictLabel, sub: 'FAULTLINE signal', valueColor: verdictColor },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${color}22`, position: 'relative', zIndex: 2 }}>
              {cells.map((cell, i) => (
                <div key={cell.label} style={{
                  padding: '11px 10px',
                  textAlign: 'center',
                  borderRight: i % 4 < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${cell.valueColor}08`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent'; }}
                >
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(100,116,139,0.55)', letterSpacing: '0.14em', marginBottom: '4px', textTransform: 'uppercase' }}>{cell.label}</div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: cell.valueColor, textShadow: `0 0 10px ${cell.valueColor}50`, lineHeight: 1.1, marginBottom: '3px' }}>{cell.value}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(148,163,184,0.4)', lineHeight: 1.3 }}>{cell.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── ASHA Executive Summary — 2-sentence briefing beneath the strip ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: '12px 16px',
          background: `linear-gradient(90deg, ${color}08 0%, transparent 70%)`,
          borderTop: `1px solid ${color}14`,
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <Activity size={12} style={{ color: `${color}80`, flexShrink: 0, marginTop: '2px', animation: 'blink-alert 2.5s ease-in-out infinite' }} />
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '12px',
            color: 'rgba(176,196,216,0.85)',
            lineHeight: 1.65,
            margin: 0,
          }}>
            <span style={{ color, fontWeight: 600 }}>PLATO:</span>{' '}
            {overall.riskLevel === 'low'
              ? `Systemic pressure is low at ${score100(overall.score)} — conditions favor risk-taking. ${analogSentence('The closest historical analog is')}`
              : overall.riskLevel === 'moderate'
              ? `Systemic pressure is building at ${score100(overall.score)} — mixed signals favor selective positioning. ${analogSentence('The closest analog is')}`
              : overall.riskLevel === 'elevated'
              ? `Systemic pressure is elevated at ${score100(overall.score)} — reduce exposure and tighten stops. ${analogSentence('The closest analog is')}`
              : `Systemic pressure is at crisis levels — ${score100(overall.score)}. Capital preservation is the trade. ${analogSentence('Closest analog:')}`
            }{' '}Bull scenario: {engineProbabilityText(output, 'bullProbability')}. Crash probability: {engineProbabilityText(output, 'crashProbability')}.
          </p>
        </div>
      </div>

      {/* ── TODAY'S ANSWER — 3-second verdict banner ───────────────────── */}
      {(() => {
        const score = overall.score;
        const riskLevel = overall.riskLevel;
        let verdict: string;
        let verdictColor: string;
        let verdictSub: string;
        if (riskLevel === 'low' || score <= 3.5) {
          verdict = 'RISK ON';
          verdictColor = '#00FF88';
          verdictSub = 'Regime supports risk-on positioning — momentum window open';
        } else if (riskLevel === 'moderate' || score <= 5.5) {
          verdict = 'STAY SELECTIVE';
          verdictColor = '#00E5FF';
          verdictSub = 'Mixed signals — favor high-conviction setups with tight stops';
        } else if (riskLevel === 'elevated' || score <= 7.5) {
          verdict = 'REDUCE EXPOSURE';
          verdictColor = '#FF9500';
          verdictSub = 'Systemic pressure elevated — reduce size, tighten stops';
        } else {
          verdict = 'STEP ASIDE';
          verdictColor = '#FF2D55';
          verdictSub = 'Crisis-level risk detected — capital preservation is the trade';
        }
        return (
          <div style={{
            position: 'relative', zIndex: 2,
            margin: '0',
            padding: '14px 20px',
            background: `linear-gradient(90deg, ${verdictColor}12 0%, transparent 60%)`,
            borderBottom: `1px solid ${verdictColor}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: verdictColor, boxShadow: `0 0 10px ${verdictColor}`, animation: 'pulse 2s ease-in-out infinite' }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(100,116,139,0.6)', marginBottom: '2px' }}>TODAY'S ANSWER</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: '22px', color: verdictColor, letterSpacing: '0.08em', lineHeight: 1, textShadow: `0 0 20px ${verdictColor}60` }}>{verdict}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.5, maxWidth: '380px', textAlign: 'right' }}>
              {verdictSub}
            </div>
          </div>
        );
      })()}

      {/* ── TODAY'S INTELLIGENCE STRIP — 8 above-the-fold cards ─────── */}
      {(() => {
        const topDomain = topThreat;
        const bestDomain = topStabilizer;
        const biggestShift = changedDomains[0];
        const topAnalog = analogs[0];
        const riskScore = overall.score;

        const cards = [
          {
            label: "TODAY'S VERDICT",
            value: overall.riskLevel === 'low' ? 'RISK ON' : overall.riskLevel === 'moderate' ? 'STAY SELECTIVE' : overall.riskLevel === 'elevated' ? 'REDUCE EXPOSURE' : 'STEP ASIDE',
            sub: overall.riskLevel === 'low' ? 'Conditions favor risk-on positioning' : overall.riskLevel === 'moderate' ? 'High-conviction setups only' : overall.riskLevel === 'elevated' ? 'Trim and protect' : 'Capital preservation mode',
            color: overall.riskLevel === 'low' ? '#00FF88' : overall.riskLevel === 'moderate' ? '#FFD700' : overall.riskLevel === 'elevated' ? '#FF9500' : '#FF2D55',
            href: CANONICAL_DESTINATION_BY_ID.act.path,
          },
          {
            label: 'HIGHEST CONVICTION OPP',
            value: overall.riskLevel === 'low' ? 'BREAKOUTS' : overall.riskLevel === 'moderate' ? 'REVERSALS' : 'HEDGES',
            sub: overall.riskLevel === 'low' ? 'Momentum + macro aligned' : overall.riskLevel === 'moderate' ? 'Oversold bounces forming' : 'Inverse ETFs + puts',
            color: overall.riskLevel === 'low' ? '#00FF88' : overall.riskLevel === 'moderate' ? '#00E5FF' : '#FF9500',
            href: '/app/signals',
          },
          {
            label: 'HIGHEST RISK',
            value: topDomain?.label?.split(' ').slice(0, 2).join(' ') ?? '—',
            sub: `Score: ${score100(topDomain?.score)} · ${topDomain?.riskLevel ?? '—'} risk`,
            color: '#FF2D55',
            href: '/app/pressure',
          },
          {
            label: 'BEST SECTOR',
            value: bestDomain?.label?.split(' ').slice(0, 2).join(' ') ?? '—',
            sub: `Score: ${score100(bestDomain?.score)} · lowest pressure`,
            color: '#00FF88',
            href: '/app/signal-outlook',
          },
          {
            label: 'BEST CRYPTO',
            value: overall.riskLevel === 'low' ? 'BTC / ETH' : overall.riskLevel === 'moderate' ? 'BTC ONLY' : 'AVOID',
            sub: overall.riskLevel === 'low' ? 'Risk-on crypto rotation active' : overall.riskLevel === 'moderate' ? 'Bitcoin as digital gold' : 'Crypto risk elevated',
            color: overall.riskLevel === 'low' ? '#F7931A' : overall.riskLevel === 'moderate' ? '#F7931A' : '#FF9500',
            href: '/app/crypto',
          },
          {
            label: 'LARGEST ROTATION',
            value: biggestShift ? `${biggestShift.label.split(' ')[0]} ${biggestShift.delta > 0 ? '↑' : '↓'}` : '—',
            sub: biggestShift ? `Δ ${pointsDeltaText(availableDelta(biggestShift))} vs baseline` : 'No major shifts',
            color: biggestShift ? (biggestShift.delta > 0 ? '#FF9500' : '#00FF88') : '#B0C4D8',
            href: '/app/pressure',
          },
          {
            label: 'MOST DANGEROUS ASSET',
            value: overall.riskLevel === 'critical' ? 'LEVERAGED ETFs' : overall.riskLevel === 'elevated' ? 'SMALL CAPS' : overall.riskLevel === 'moderate' ? 'MEMECOINS' : 'NONE',
            sub: overall.riskLevel === 'critical' ? 'Avoid 2x/3x exposure' : overall.riskLevel === 'elevated' ? 'High beta underperforming' : overall.riskLevel === 'moderate' ? 'Speculative risk elevated' : 'Risk environment benign',
            color: '#FF2D55',
            href: '/app/pressure',
          },
          {
            label: 'MOST UNDERVALUED',
            value: overall.riskLevel === 'low' ? 'SMALL CAPS' : overall.riskLevel === 'moderate' ? 'VALUE' : 'TREASURIES',
            sub: overall.riskLevel === 'low' ? 'IWM lagging SPX — catch-up trade' : overall.riskLevel === 'moderate' ? 'Value vs growth spread widening' : 'Flight to safety premium',
            color: '#00E5FF',
            href: '/app/signals',
          },
          {
            label: 'MOST OVEREXTENDED',
            value: overall.riskLevel === 'low' ? 'AI SEMIS' : overall.riskLevel === 'moderate' ? 'MEGA CAP' : 'NONE',
            sub: overall.riskLevel === 'low' ? 'NVDA/AMD stretched vs fundamentals' : overall.riskLevel === 'moderate' ? 'MAG7 concentration risk' : 'No obvious overextension',
            color: '#FF9500',
            href: '/app/signals',
          },
          {
            label: 'TOP CATALYST',
            value: topAnalog?.era?.split(' ').slice(0, 2).join(' ') ?? 'FED POLICY',
            sub: topAnalog ? `${similarityText(topAnalog.similarity)} analog match · ${topAnalog.year?.slice(0, 4) ?? ''}` : 'Watch FOMC + CPI',
            color: '#C084FC',
            href: CANONICAL_DESTINATION_BY_ID.watch.path,
          },
        ];

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.09)',
          }}>
            {cards.map((card, i) => (
              <a
                key={card.label}
                href={card.href}
                style={{
                  display: 'block',
                  padding: '10px 12px',
                  borderRight: i % 4 < 3 ? '1px solid rgba(255,255,255,0.09)' : 'none',
                  borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.09)' : 'none',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = `${card.color}08`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent'; }}
              >
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', color: 'rgba(100,116,139,0.55)', marginBottom: '4px' }}>{card.label}</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: card.color, lineHeight: 1, marginBottom: '3px', textShadow: `0 0 12px ${card.color}50` }}>{card.value}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: 'rgba(148,163,184,0.5)', lineHeight: 1.4 }}>{card.sub}</div>
              </a>
            ))}
          </div>
        );
      })()}

            {/* ── 1. ASHA Intelligence First — Greeting + Market Brief above the fold ── */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>
        {/* ASHA Daily Greeting — first thing the user sees on every session */}
        <SectionErrorBoundary label="PLATO Greeting"><AshaDailyGreeting /></SectionErrorBoundary>
        {/* ASHA Market Brief — 30-60 second synthesis from all 10 engines */}
        <div style={{ marginBottom: '16px', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
          <SectionErrorBoundary label="PLATO Intelligence"><AshaIntelligenceBrief variant="market-brief" /></SectionErrorBoundary>
        </div>
        {/* Inline upgrade prompt (free/core tier only) */}
        <DashboardUpgradePrompt />
      </div>

            {/* ── 2. ASHA Hero: 13-instrument ticker strip + intelligence panel + ASHA figure ── */}
      <AshaHeroSection />

            {/* ── 3. Supporting intelligence panels ───────────────────────── */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>
        <EarlyWarningPresentationPanel mode="home" />
        {/* ── Seismograph Narrative Banner: what is happening, why, how long, what to watch ── */}
        <SeismographNarrativeBanner context="dashboard" defaultExpanded={false} />
        {/* ── Homepage Briefing: Market Story, Why Today Is Different, History Says ── */}
        <HomepageBriefingPanel />
        {/* ── What does this mean? synthesis panel ─────────────── */}
        <MarketSynthesisPanel context="dashboard" />
        {/* ── 3-Mode Intelligence Selector ─────────────────────── */}
        <ViewModeSelector mode={dashMode} onChange={handleModeChange} />

        {/* ── Mode-conditional rendering ───────────────────────── */}
        {/* SIGNALS hierarchy: movers first inside SignalsMode; compact integrity secondary there (#66).
            Pre-Flight / awareness entry cards removed from the customer experience (#67). */}
        {canonicalState ? (
          <>
            {dashMode === "pulse" && <PulseMode />}
            {dashMode === "signals" && <SignalsMode />}
            {dashMode === "intelligence" && <IntelligenceMode />}
          </>
        ) : (
          <PageDegradedBanner message="Current canonical state is unavailable." detail="Dashboard intelligence modes withhold current interpretation until one authoritative state is available." />
        )}

        {/* ── Quick Actions bar (tertiary links; not the primary signals hierarchy) ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', animation: 'cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) 100ms both' }} data-dashboard-quick-actions="true">
          {([
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
        {/* Pulse / Intelligence: full Data Integrity here.
            Signals mode owns compact integrity inside SignalsMode (#66).
            Pre-Flight / awareness cards removed (#67). */}
        {dashMode !== "signals" && <DataIntegrity />}

        {/* ── SITUATION ROOM ENTRY CARD ──────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,170,0,0.07) 0%, rgba(12,15,22,0.98) 60%)', border: '1px solid rgba(255,170,0,0.22)', borderLeft: '3px solid #FFAA00', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 42ms both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFAA00', boxShadow: '0 0 8px #FFAA00', animation: 'blink-alert 6s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#FFAA00', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Decision Engine</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(255,170,0,0.55)', border: '1px solid rgba(255,170,0,0.3)', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.1em' }}>STEP 2 — DECISION ENGINE</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#B0C4D8', lineHeight: 1.55, maxWidth: '500px' }}>
                Simulate your next move. Move Favorability Score, Final Verdict, Green Lights, Threat Board, Historical Analogs, Position Sizing, and Thesis Stress Test.
              </div>
            </div>
            <a href="/app/decision-engine" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(255,170,0,0.10)', border: '1px solid rgba(255,170,0,0.45)', borderRadius: '4px', color: '#FFAA00', textDecoration: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.15em', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.18s cubic-bezier(0.23,1,0.32,1)', boxShadow: '0 0 20px rgba(255,170,0,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,170,0,0.18)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,170,0,0.7)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,170,0,0.10)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,170,0,0.45)'; }}
            >
              <span style={{ fontSize: '14px' }}>⊕</span>
              OPEN DECISION ENGINE
            </a>
          </div>
        </div>


        {/* ── INSIDER INTELLIGENCE ENTRY CARD ──────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.05) 0%, rgba(12,15,22,0.98) 60%)', border: '1px solid rgba(0,255,136,0.18)', borderLeft: '3px solid #00FF88', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 50ms both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 8px #00FF88', animation: 'blink-alert 6s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#00FF88', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Insider Intelligence™</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(0,255,136,0.55)', border: '1px solid rgba(0,255,136,0.3)', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.1em' }}>SMART MONEY</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#B0C4D8', lineHeight: 1.55, maxWidth: '500px' }}>
                Track where corporate insiders show conviction before the market notices. Conviction Score, Cluster Buy Alerts, and AI-powered analysis.
              </div>
            </div>
            <a href="/app/insider-intelligence" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.40)', borderRadius: '4px', color: '#00FF88', textDecoration: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.15em', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.18s cubic-bezier(0.23,1,0.32,1)', boxShadow: '0 0 20px rgba(0,255,136,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.15)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,255,136,0.65)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.08)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,255,136,0.40)'; }}
            >
              <span style={{ fontSize: '14px' }}>⊕</span>
              OPEN INSIDER INTEL
            </a>
          </div>
        </div>

        {/* ── CURRENT REGIME ANCHOR ─────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${color}08 0%, rgba(12,15,22,0.98) 60%)`, border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, animation: 'blink-alert 6s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: color, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 600 }}>Current Regime</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {updatedAgo && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.55)', letterSpacing: '0.1em' }}>Updated {updatedAgo}</span>
              )}
              <div style={{ padding: '2px 7px', background: `${color}15`, border: `1px solid ${color}35`, borderRadius: '3px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{severityLabel(overall.riskLevel)}</span>
              </div>
            </div>
          </div>
          {/* Regime name */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#FFFFFF', marginBottom: '6px', lineHeight: 1.2 }}>{regime.label}</div>
          {/* Narrative sentence */}
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#B0C4D8', lineHeight: 1.65, marginBottom: '12px' }}>{regime.description}</div>
          {/* Key Shifts */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.11)', paddingTop: '10px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '7px' }}>Key Shifts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {keyShifts.map(shift => (
                <div key={shift.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: `${shift.color}10`, border: `1px solid ${shift.color}25`, borderRadius: '3px' }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: shift.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: shift.color, letterSpacing: '0.08em' }}>{shift.label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.6)' }}>{shift.direction}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* S.O.B.™ Panel */}
        <div style={{ marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 120ms both' }}>
          <SOBPanel
            canonicalEnvelope={output?.canonicalEnvelope}
            regime={regime?.label}
            pressureIndex={finiteOrNull(overall?.score) === null ? null : Math.round(overall.score * 10)}
          />
        </div>

        {/* Scenario readings — probability contract (shared/probabilityContract):
            a number renders only for a calibrated claim with complete, fresh data. */}
        <div className="intel-module" style={{ padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 150ms both' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Scenario Readings</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: 'rgba(100,116,139,0.6)', lineHeight: 1.5 }}>The bull/neutral/bear scenario weights are evidence-vote shares with no defined event, horizon or calibration record, so no percentage is shown. FAULTLINE does not offer crash, recession, stagflation or soft-landing probabilities.</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {output.probabilityDisplay ? (
              <>
                <ProbBar label="Bull scenario" display={output.probabilityDisplay.bullProbability} color="#00FF88" />
                <ProbBar label="Crash" display={output.probabilityDisplay.crashProbability} color="#FF2D55" />
                <ProbBar label="Recession" display={output.probabilityDisplay.recessionProbability} color="#FF9500" />
                <ProbBar label="Stagflation" display={output.probabilityDisplay.stagflationProbability} color="#FFD700" />
                <ProbBar label="Soft Landing" display={output.probabilityDisplay.softLandingProbability} color="#00E5FF" />
              </>
            ) : (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#94A3B8' }}>{engineProbabilityText(output, 'bullProbability')}</span>
            )}
          </div>
        </div>

        {/* Risk heatmap with signal prioritization tiers */}
        <div className="intel-module" style={{ padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 220ms both' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Risk Domain Heatmap</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: 'rgba(100,116,139,0.6)', lineHeight: 1.5 }}>Each domain measures a distinct source of structural stress — liquidity conditions, credit pressure, speculative excess, and macro instability. Darker cells indicate elevated pressure.</div>
          </div>
          {/* Tier 1: Primary Signals */}
          {(() => {
            const primary = domains.filter(d => d.riskLevel === 'critical' || d.riskLevel === 'high');
            const developing = domains.filter(d => d.riskLevel === 'elevated');
            const stable = domains.filter(d => d.riskLevel === 'moderate' || d.riskLevel === 'low');
            return (
              <>
                {primary.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#FF2D55', animation: 'blink-alert 1.5s ease-in-out infinite' }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FF2D55', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Primary Signals</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {primary.map((d, i) => <HeatCell key={d.id} label={d.label.split(' ')[0]} score={d.score} delay={i * 45} />)}
                    </div>
                  </div>
                )}
                {developing.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#FFD700' }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Developing Pressures</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {developing.map((d, i) => <HeatCell key={d.id} label={d.label.split(' ')[0]} score={d.score} delay={i * 45} />)}
                    </div>
                  </div>
                )}
                {stable.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00FF88' }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#00FF88', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Stable Conditions</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {stable.map((d, i) => <HeatCell key={d.id} label={d.label.split(' ')[0]} score={d.score} delay={i * 45} />)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Narrative intelligence */}
        <div style={{ marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 280ms both' }}>
          <NarrativePanel narrative={narrative} regime={regime} />
        </div>

        {/* What Changed Today */}
        {changedDomains.length > 0 && (
          <div className="intel-module" style={{ padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 340ms both' }}>
            <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Regime Shift Signals</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: 'rgba(100,116,139,0.6)', lineHeight: 1.5 }}>Domains where pressure has moved meaningfully since the prior reading. Sustained directional moves signal emerging regime conditions.</div>
          </div>
            {/* What Changed micro-summary */}
            {changedDomains.length > 0 && (() => {
              const topMover = changedDomains[0];
              const direction = topMover.delta > 0 ? 'increased' : 'eased';
              const moved = finiteOrNull(topMover.delta) !== null && Math.abs(Math.round(topMover.delta * 10)) > 0;
              return (
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '10px', borderLeft: `2px solid ${getRiskColor(topMover.riskLevel)}40` }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {topMover.label.split(' ')[0]} pressure {direction}{moved ? ` ${pointsDeltaText(Math.abs(topMover.delta)).replace(/^\+/, '')} since last reading` : ''}.{' '}
                    {topMover.delta > 0.2 ? 'Sustained directional moves of this magnitude often precede regime reclassification.' : 'Monitor for continuation.'}
                  </span>
                </div>
              );
            })()}
            {changedDomains.map(d => (
              <ChangeItem key={d.id} label={d.label} delta={availableDelta(d)} color={getRiskColor(d.riskLevel)} detail={d.drivers[0] ?? d.description} />
            ))}
          </div>
        )}

        {/* Top Threat / Stabilizer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 400ms both' }}>
          <div className="intel-module" style={{ padding: '14px', borderLeft: '3px solid #FF2D55' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FF2D55', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '7px' }}>Top Threat</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#F0F6FF', marginBottom: '4px' }}>{topThreat.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '22px', color: '#FF2D55', textShadow: '0 0 16px rgba(255,45,85,0.6)', marginBottom: '5px', lineHeight: 1 }}>{score100Value(topThreat.score)}<span style={{ fontSize: '10px', color: '#64748B' }}>/100</span></div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.45 }}>{topThreat.drivers[0] ?? topThreat.description}</div>
          </div>
          <div className="intel-module" style={{ padding: '14px', borderLeft: '3px solid #00FF88' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#00FF88', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '7px' }}>Stabilizer</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#F0F6FF', marginBottom: '4px' }}>{topStabilizer.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '22px', color: '#00FF88', textShadow: '0 0 16px rgba(0,255,136,0.6)', marginBottom: '5px', lineHeight: 1 }}>{score100Value(topStabilizer.score)}<span style={{ fontSize: '10px', color: '#64748B' }}>/100</span></div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.45 }}>{topStabilizer.drivers[0] ?? topStabilizer.description}</div>
          </div>
        </div>

        {/* Live market instruments */}
        <div style={{ marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 460ms both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Market Stress Indicators</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: integrityLabel === 'LIVE' ? 'rgba(0,255,136,0.06)' : 'rgba(255,149,0,0.06)', border: `1px solid ${integrityLabel === 'LIVE' ? 'rgba(0,255,136,0.15)' : 'rgba(255,149,0,0.15)'}`, borderRadius: '2px' }}>
              {integrityLabel === 'LIVE' && (
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00FF88', animation: 'pulse-gold 2s ease-in-out infinite' }} />
              )}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: integrityLabel === 'LIVE' ? '#00FF88' : '#FF9500', letterSpacing: '0.1em' }}>FRED {integrityLabel}</span>
            </div>
          </div>
          {/* What Changed — Market Stress (real readings only; STALE is not evaluated) */}
          {liveValues.hySpread != null && liveValues.hySpread > 400 && (
            <div style={{ padding: '7px 10px', background: 'rgba(255,45,85,0.04)', borderLeft: '2px solid rgba(255,45,85,0.3)', borderRadius: '3px', marginBottom: '10px' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#B0C4D8', fontStyle: 'italic', lineHeight: 1.5 }}>
                Credit spreads widened while equities remain elevated — a divergence historically associated with deteriorating credit conditions.
              </span>
            </div>
          )}
          {liveValues.yield10Y != null && liveValues.yield10Y > 4.5 && (liveValues.hySpread == null || liveValues.hySpread <= 400) && (
            <div style={{ padding: '7px 10px', background: 'rgba(255,149,0,0.04)', borderLeft: '2px solid rgba(255,149,0,0.3)', borderRadius: '3px', marginBottom: '10px' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#B0C4D8', fontStyle: 'italic', lineHeight: 1.5 }}>
                Elevated long-end yields continue to pressure rate-sensitive sectors and increase the cost of refinancing.
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <MiniWidget label="10Y Treasury" reading={liveReadings.yield10Y} unit="%" decimals={2} color="#00E5FF" />
            <MiniWidget label="Fed Funds (eff.)" reading={liveReadings.fedFundsRate} unit="%" decimals={2} color="#00E5FF" />
            <MiniWidget label="HY Spread" reading={liveReadings.hySpread} unit="bps" decimals={0} color={liveValues.hySpread != null && liveValues.hySpread > 400 ? '#FF2D55' : '#FF9500'} />
            <MiniWidget label="CPI YoY" reading={liveReadings.cpi} unit="%" decimals={1} color="#FFD700" />
            <MiniWidget label="10Y–2Y Curve" reading={liveReadings.yieldCurveSpread} unit="bps" decimals={0} color="#00E5FF" />
            <MiniWidget label="30Y Treasury" reading={liveReadings.yield30Y} unit="%" decimals={2} color="#00E5FF" />
          </div>
        </div>

        {/* Historical analog */}
        <div className="intel-module" style={{ padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 520ms both' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Historical Regime Analogs</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: 'rgba(100,116,139,0.6)', lineHeight: 1.5 }}>Current macro conditions most closely resemble these historical periods based on domain score patterns. Similarity reflects structural alignment, not price prediction.</div>
          </div>
          {/* What Changed — Analog context */}
          {analogs[0] && (
            <div style={{ padding: '7px 10px', background: 'rgba(0,212,255,0.04)', borderLeft: '2px solid rgba(0,229,255,0.32)', borderRadius: '3px', marginBottom: '10px' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#B0C4D8', fontStyle: 'italic', lineHeight: 1.5 }}>
                Structural alignment with {analogs[0].era} ({analogs[0].year.slice(0, 4)}) at {similarityText(analogs[0].similarity)} similarity. {analogs[0].matchReasons?.[0] ?? 'Pattern overlap across multiple pressure domains.'}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {analogs.slice(0, 3).map((analog, i) => {
              const aColor = i === 0 ? '#00E5FF' : i === 1 ? '#FFD700' : '#FF9500';
              return (
                <div key={analog.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', animation: `fade-slide-up 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '4px', background: `${aColor}15`, border: `1px solid ${aColor}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '11px', color: aColor, lineHeight: 1 }}>{analog.year.slice(0, 4)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D1D5DB', marginBottom: '4px' }}>{analog.era}</div>
                    <div style={{ position: 'relative', height: '3px', background: 'rgba(255,255,255,0.11)', borderRadius: '2px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${finiteOrNull(analog.similarity) ?? 0}%`, background: `linear-gradient(90deg, ${aColor}60, ${aColor})`, borderRadius: '2px', boxShadow: `0 0 6px ${aColor}60`, transition: 'width 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: aColor, fontWeight: 600, flexShrink: 0 }}>{similarityText(analog.similarity)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily AI Risk Update */}
        {aiDomain && (
          <div className="intel-module" style={{ padding: '16px', marginBottom: '10px', borderLeft: '3px solid #C084FC', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 580ms both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C084FC', boxShadow: '0 0 8px #C084FC', animation: 'blink-alert 6s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Speculative Concentration Risk</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '30px', color: '#C084FC', textShadow: '0 0 20px rgba(192,132,252,0.6)', lineHeight: 1 }}>{score100Value(aiDomain.score)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#B0C4D8' }}>/100 — {aiDomain.riskLevel.toUpperCase()}</span>
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#B0C4D8', lineHeight: 1.65 }}>
              {aiDomain.description} {aiDomain.drivers.slice(0, 2).join('. ')}.
            </p>
          </div>
        )}

        {/* Core metrics: removed (Data Integrity, Oct 2 2026). It rendered the static
            lib/data.ts `metrics` demo set (10Y 4.68%, 30Y 4.91%, random chart data)
            as current readings; the real readings are in Market Stress Indicators. */}

        {/* How FAULTLINE Works */}
        <details className="intel-module" style={{ padding: '14px 16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 700ms both' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', listStyle: 'none', userSelect: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em' }}>How FAULTLINE Works</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#374151', marginLeft: 'auto' }}>tap to expand</span>
          </summary>
          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: '12px' }}>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#B0C4D8', lineHeight: 1.7, marginBottom: '10px' }}>
              FAULTLINE monitors six distinct sources of systemic stress and converts them into a regularly refreshed Pressure Index designed to identify elevated market risk before broader instability becomes obvious.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                ['Liquidity Conditions', 'Treasury market depth, repo stress, and funding pressure'],
                ['Credit Market Stress', 'High-yield spreads, investment-grade conditions, and default risk'],
                ['Market Concentration', 'Mega-cap dominance, breadth divergence, and index fragility'],
                ['Speculative Excess', 'AI/tech bubble dynamics, leverage, and momentum extremes'],
                ['Volatility Behavior', 'VIX regime, suppression patterns, and tail-risk pricing'],
                ['Macro Regime Pressure', 'Inflation trajectory, Fed policy stance, and recession risk'],
              ].map(([label, desc]) => (
                <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#00E5FF', marginTop: '2px', flexShrink: 0 }}>›</span>
                  <div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#D1D5DB' }}>{label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#4B5563' }}> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* ── Cinematic Search Panels (Stock + Crypto, porch-gated) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 560ms both' }}>
          <StockPorchPanel />
          <CryptoPorchPanel />
        </div>

        {/* Opportunity Discovery Engine — proactive security-specific opportunities */}
        <OpportunityDiscoveryPanel />

        {/* QA r13 B13: the static "LIVE SIGNAL PREVIEW" demo rows (hard-coded prices,
            actions and confidence) are not mounted in the app. */}

        {/* Digital Asset & Crypto Intelligence */}
        <HomeCryptoSection />

        {/* Waitlist / Founding Access Form */}
        <WaitlistSection />

        {/* SEO Content Section — Institutional copy for search engine indexing */}
        <section
          aria-label="Platform Intelligence Overview"
          style={{
            padding: '48px 24px 32px',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            maxWidth: '900px',
            margin: '0 auto',
          }}
        >
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '11px', fontWeight: 600, color: 'rgba(0,229,255,0.65)', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '32px', textAlign: 'center' }}>
            Platform Intelligence Architecture
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            {/* FAULTLINE Pressure Index */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(0,212,255,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                FAULTLINE Pressure Index™
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                A composite macroeconomic risk intelligence score synthesizing credit spreads, volatility regimes, liquidity conditions, and systemic market pressure across equity, bond, and credit markets. Updated regularly.
              </p>
            </article>
            {/* Aftershock Engine */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(255,149,0,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Aftershock Engine™
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                Detects contagion risk, sector cascade patterns, and systemic aftershock sequences following primary market ruptures. Classifies signals as Primary Rupture, First-Wave Aftershock, Macro Shockwave, and more.
              </p>
            </article>
            {/* Stock Intelligence */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(0,255,136,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Stock Intelligence Engine
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                Combines live market data, momentum analysis, volatility conditions, liquidity trends, and macroeconomic intelligence to classify stocks with signal labels: Momentum Breakout, AI Bubble Exposure, Macro Beneficiary, Recession Defensive, and more.
              </p>
            </article>
            {/* Crypto Intelligence */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(139,92,246,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Crypto Intelligence System
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                Institutional-grade digital asset risk analysis covering BTC dominance, altcoin systemic risk, crypto market regime alignment, contagion exposure, and liquidity conditions across the digital asset ecosystem.
              </p>
            </article>
            {/* Market Regime Analysis */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(255,215,0,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Market Regime Analysis
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                Probabilistic bull, bear, and crash regime classification using macro pressure, credit conditions, volatility regimes, and historical analog pattern recognition. Identifies regime transitions before they become consensus.
              </p>
            </article>
            {/* AI Market Analytics */}
            <article style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '13px', fontWeight: 700, color: 'rgba(255,45,85,0.8)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>
                AI-Powered Macro Analytics
              </h3>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, margin: 0 }}>
                Scenario simulation, AI sector concentration monitoring, systemic risk stress-testing, and natural language intelligence narratives. FAULTLINE synthesizes macro data into actionable institutional intelligence.
              </p>
            </article>
          </div>
        </section>
        {/* Disclaimer */}
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#4B5563', letterSpacing: '0.1em' }}>
            PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE
          </span>
        </div>
      </div>
    </div>
  );
}
