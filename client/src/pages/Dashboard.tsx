/* ============================================================
   FAULTLINE — Dashboard v7 "Launch-Ready"
   Mobile-first, trustworthy, shareable, retention-optimized.
   Reactive: all values from EngineContext.
   Design: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useRef, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Share2, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { metrics, MetricCard } from "@/lib/data";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import DataIntegrity from "@/components/DataIntegrity";
import Onboarding from "@/components/Onboarding";
import ShareCard from "@/components/ShareCard";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663562889431/oAHJBBc62GHpVJwTBFZPAm/faultline-hero-bg-5aiJwmUWM5RkwbakA3ZsnX.webp";

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

// ── Animated seismic waveform ─────────────────────────────────
function SeismicWave({ color, score }: { color: string; score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;
    const amplitude = 8 + score * 2.5;
    const freq = 0.025 + score * 0.004;
    let animId: number;
    const draw = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const w = canvas.width; const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // Glow layer
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq + t) * amplitude * Math.sin(x * 0.008 + t * 0.3) * 1.4;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 6;
      ctx.stroke();
      // Sharp line
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq + t) * amplitude * Math.sin(x * 0.008 + t * 0.3);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + 'CC';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      t += 0.04;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [color, score]);
  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '40px', display: 'block', opacity: 0.85 }} />
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
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(anim / 10) * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.23,1,0.32,1)', filter: `drop-shadow(0 0 8px ${color}80)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size > 80 ? '26px' : '18px', color, textShadow: `0 0 20px ${color}80`, lineHeight: 1 }}>
          {anim.toFixed(1)}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>/10</span>
      </div>
    </div>
  );
}

// ── Animated probability bar ──────────────────────────────────
function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 600); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ flex: 1, minWidth: '72px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
      <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
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
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Intelligence Narrative
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: regime.color, marginLeft: 'auto' }}>
            {regime.label}
          </span>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#94A3B8', lineHeight: 1.75, marginBottom: '14px' }}>
          {words.slice(0, revealed).join(' ')}
          {revealed < words.length && <span className="narrative-cursor" />}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {narrative.keyRisks.slice(0, 3).map((risk, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', animation: `fade-slide-up 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 80 + 600}ms both` }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: regime.color, flexShrink: 0, marginTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#94A3B8', lineHeight: 1.55 }}>{risk}</span>
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
  return (
    <div style={{
      background: `${color}${hexAlpha(intensity * 0.12)}`,
      border: `1px solid ${color}${hexAlpha(intensity * 0.25)}`,
      borderRadius: '4px', padding: '10px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${delay}ms both`,
      transition: 'transform 0.2s ease',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
    >
      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color, textShadow: `0 0 10px ${color}80`, animation: score >= 7 ? 'heatmap-pulse 2s ease-in-out infinite' : 'none', lineHeight: 1 }}>
        {score.toFixed(1)}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

// ── Mini live instrument widget ───────────────────────────────
function MiniWidget({ label, value, unit, color, seed, trend }: {
  label: string; value: string; unit?: string; color: string; seed: number; trend: 'up' | 'down' | 'flat';
}) {
  const data = useMemo(() => buildMiniSeries(seed, 20, 5, 1.2), [seed]);
  const trendColor = trend === 'up' ? '#FF9500' : trend === 'down' ? '#00FF88' : '#6B7280';
  const trendChar = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
  return (
    <div style={{
      background: 'rgba(12,15,22,0.92)', border: `1px solid ${color}18`, borderRadius: '4px',
      padding: '12px', position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s cubic-bezier(0.23,1,0.32,1)',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '7px' }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color, textShadow: `0 0 12px ${color}60`, lineHeight: 1 }}>
            {value}
          </span>
          {unit && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#94A3B8' }}>{unit}</span>}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: trendColor, marginLeft: 'auto' }}>{trendChar}</span>
        </div>
        <ResponsiveContainer width="100%" height={28}>
          <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false}
              style={{ filter: `drop-shadow(0 0 3px ${color}60)` }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── What Changed Today item ───────────────────────────────────
function ChangeItem({ label, delta, color, detail }: { label: string; delta: number; color: string; detail: string }) {
  const sign = delta > 0 ? '+' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: '3px', height: '30px', background: color, borderRadius: '2px', boxShadow: `0 0 8px ${color}60`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D1D5DB', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
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
    <div onClick={() => setExpanded(!expanded)} style={{
      background: 'rgba(12,15,22,0.92)', border: '1px solid rgba(255,255,255,0.09)',
      borderLeft: `2px solid ${color}`, borderRadius: '4px', padding: '13px',
      cursor: 'pointer', transition: 'background 0.2s ease',
      animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${index * 40}ms both`,
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(17,19,24,0.95)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(10,12,16,0.85)'}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', borderTop: `1px solid ${color}25`, borderRight: `1px solid ${color}25` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{metric.category}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '2px', padding: '1px 5px', textTransform: 'uppercase' }}>{metric.riskLevel}</span>
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '14px', color: '#E2E8F0', marginBottom: '3px' }}>{metric.label}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }}>{metric.interpretation}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px', fontWeight: 700, color, textShadow: `0 0 12px ${color}60`, lineHeight: 1 }}>{metric.value}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B' }}>{metric.unit}</div>
          {expanded ? <ChevronUp size={12} style={{ color: '#64748B' }} /> : <ChevronDown size={12} style={{ color: '#64748B' }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', animation: 'fade-slide-up 0.25s ease both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Signal Drivers</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color, fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>›</span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }}>{metric.historicalComparison}</span>
            </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const { output, rawFred, indicators, isLoading, isLive, lastUpdated, isSimulating } = useEngine();
  const { overall, domains, regime, probability, analogs, narrative } = output;
  const [showShare, setShowShare] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Stable memoized derived data
  const heatmapScores = useMemo(() => domains.map(d => ({ label: d.label.split(' ')[0], score: d.score })), [domains]);
  const topThreat = useMemo(() => [...domains].sort((a, b) => b.score - a.score)[0], [domains]);
  const topStabilizer = useMemo(() => [...domains].sort((a, b) => a.score - b.score)[0], [domains]);
  const changedDomains = useMemo(() => [...domains].filter(d => Math.abs(d.delta) > 0.1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4), [domains]);
  const aiDomain = useMemo(() => domains.find(d => d.id === 'ai-bubble'), [domains]);
  const color = regime.color;

  return (
    <div style={{ background: '#050608', minHeight: '100vh', position: 'relative' }} className="ambient-bg">
      <AmbientParticles riskLevel={overall.riskLevel} />

      {/* Onboarding */}
      <Onboarding forceOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Share card */}
      {showShare && <ShareCard onClose={() => setShowShare(false)} />}

      {/* ── HERO: Vivid Command Panel ─────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        background: `linear-gradient(160deg, #070910 0%, #0A0D14 40%, #050608 100%)`,
        borderBottom: `1px solid ${color}35`,
        overflow: 'hidden',
      }}>
        {/* Deep radial glow */}
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', background: `radial-gradient(ellipse at center, ${color}18 0%, ${color}06 40%, transparent 70%)`, pointerEvents: 'none' }} />
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTop: `2px solid ${color}70`, borderLeft: `2px solid ${color}70`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTop: `2px solid ${color}70`, borderRight: `2px solid ${color}70`, pointerEvents: 'none' }} />
        {/* Scanlines */}
        <div className="scanlines" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: 0.35 }} />

        {/* Help + Share buttons */}
        <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '8px', zIndex: 10 }}>
          <button onClick={() => setShowOnboarding(true)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', backdropFilter: 'blur(8px)', minHeight: 'unset' }}>
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
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF9500', letterSpacing: '0.12em' }}>SIMULATION MODE</span>
          </div>
        )}

        {/* Main hero content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '52px 20px 0' }}>
          {/* Regime pill row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, transparent, ${color}50)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 16px', background: `${color}14`, border: `1px solid ${color}50`, borderRadius: '20px', boxShadow: `0 0 20px ${color}15` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}`, animation: 'blink-alert 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>{regime.label}</span>
            </div>
            <div style={{ height: '1px', flex: 1, background: `linear-gradient(90deg, ${color}50, transparent)` }} />
          </div>

          {/* Giant score */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: '88px', lineHeight: 1, color, textShadow: `0 0 40px ${color}90, 0 0 80px ${color}40, 0 0 120px ${color}20`, letterSpacing: '-0.02em', animation: 'fade-in 0.8s ease both' }}>{overall.score.toFixed(1)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '18px', color: 'rgba(255,255,255,0.28)', marginBottom: '14px' }}>/10</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(240,244,255,0.45)', letterSpacing: '0.12em', marginTop: '-4px' }}>{regime.sublabel}</div>
          </div>

          {/* Seismic waveform */}
          <div style={{ margin: '10px -20px 0' }}>
            <SeismicWave color={color} score={overall.score} />
          </div>
        </div>

        {/* Stat grid strip */}
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `1px solid ${color}22` }}>
          {[
            { label: 'BULL', value: `${probability.bullProbability}%`, c: '#00FF88', sub: 'probability' },
            { label: 'CRASH', value: `${probability.crashProbability}%`, c: '#FF2D55', sub: 'probability' },
            { label: 'DELTA', value: `${overall.delta >= 0 ? '+' : ''}${overall.delta.toFixed(1)}`, c: color, sub: 'vs baseline' },
            { label: isLive ? 'LIVE' : 'SIM', value: isLoading ? '...' : isLive ? 'FRED' : 'BASE', c: isLive ? '#00FF88' : '#FF9500', sub: isLive ? 'data feed' : 'mode' },
          ].map(({ label, value, c, sub }, i) => (
            <div key={label} style={{ padding: '12px 10px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(100,116,139,0.65)', letterSpacing: '0.15em', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color: c, textShadow: `0 0 14px ${c}70`, lineHeight: 1 }}>{value}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(100,116,139,0.45)', marginTop: '2px' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>

        {/* Data Integrity panel */}
        <DataIntegrity />

        {/* Bull vs Crash */}
        <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '16px', marginBottom: '10px', boxShadow: '0 0 0 1px rgba(0,212,255,0.04), 0 4px 24px rgba(0,0,0,0.4)', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 150ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Bull vs Crash Probability</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '24px', color: '#00FF88', textShadow: '0 0 16px rgba(0,255,136,0.6)' }}>
              {probability.bullProbability}% <span style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: '#64748B' }}>BULL</span>
            </span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '24px', color: '#FF2D55', textShadow: '0 0 16px rgba(255,45,85,0.6)' }}>
              {probability.crashProbability}% <span style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: '#64748B' }}>CRASH</span>
            </span>
          </div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '14px', gap: '1px' }}>
            <div style={{ flex: probability.bullProbability, background: 'linear-gradient(90deg, #00FF88, #00CC6A)', boxShadow: '0 0 8px rgba(0,255,136,0.4)', transition: 'flex 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
            <div style={{ flex: probability.crashProbability, background: 'linear-gradient(90deg, #FF9500, #FF2D55)', boxShadow: '0 0 8px rgba(255,45,85,0.4)', transition: 'flex 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <ProbBar label="Recession" value={probability.recessionProbability} color="#FF9500" />
            <ProbBar label="Stagflation" value={probability.stagflationProbability} color="#FFD700" />
            <ProbBar label="Soft Landing" value={probability.softLandingProbability} color="#00D4FF" />
          </div>
        </div>

        {/* Risk heatmap */}
        <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 220ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Risk Domain Heatmap</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {heatmapScores.map((item, i) => <HeatCell key={item.label} label={item.label} score={item.score} delay={i * 45} />)}
          </div>
        </div>

        {/* Narrative intelligence */}
        <div style={{ marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 280ms both' }}>
          <NarrativePanel narrative={narrative} regime={regime} />
        </div>

        {/* What Changed Today */}
        {changedDomains.length > 0 && (
          <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 340ms both' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>What Changed Today</div>
            {changedDomains.map(d => (
              <ChangeItem key={d.id} label={d.label} delta={d.delta} color={getRiskColor(d.riskLevel)} detail={d.drivers[0] ?? d.description} />
            ))}
          </div>
        )}

        {/* Top Threat / Stabilizer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 400ms both' }}>
          <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderLeft: '3px solid #FF2D55', borderRadius: '6px', padding: '14px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#FF2D55', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '7px' }}>Top Threat</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E2E8F0', marginBottom: '4px' }}>{topThreat.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '22px', color: '#FF2D55', textShadow: '0 0 16px rgba(255,45,85,0.6)', marginBottom: '5px', lineHeight: 1 }}>{topThreat.score.toFixed(1)}<span style={{ fontSize: '10px', color: '#64748B' }}>/10</span></div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }}>{topThreat.drivers[0] ?? topThreat.description}</div>
          </div>
          <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderLeft: '3px solid #00FF88', borderRadius: '6px', padding: '14px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#00FF88', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '7px' }}>Stabilizer</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E2E8F0', marginBottom: '4px' }}>{topStabilizer.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '22px', color: '#00FF88', textShadow: '0 0 16px rgba(0,255,136,0.6)', marginBottom: '5px', lineHeight: 1 }}>{topStabilizer.score.toFixed(1)}<span style={{ fontSize: '10px', color: '#64748B' }}>/10</span></div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.45 }}>{topStabilizer.drivers[0] ?? topStabilizer.description}</div>
          </div>
        </div>

        {/* Live market instruments */}
        <div style={{ marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 460ms both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Live Market Instruments</span>
            {isLive && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '2px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00FF88', animation: 'pulse-gold 2s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#00FF88', letterSpacing: '0.1em' }}>FRED LIVE</span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <MiniWidget label="10Y Treasury" value={(rawFred['DGS10'] ?? indicators.yield10Y).toFixed(2)} unit="%" color="#00D4FF" seed={11} trend={(rawFred['DGS10'] ?? indicators.yield10Y) > 4.5 ? 'up' : 'flat'} />
            <MiniWidget label="SOFR Rate" value={(rawFred['SOFR'] ?? indicators.fedFundsRate).toFixed(2)} unit="%" color="#00D4FF" seed={66} trend={(rawFred['SOFR'] ?? indicators.fedFundsRate) > 5 ? 'up' : 'flat'} />
            <MiniWidget
              label="HY Spread"
              value={(() => { const v = rawFred['BAMLH0A0HYM2']; return v != null ? (v > 20 ? Math.round(v) : Math.round(v * 100)).toString() : indicators.hySpread.toString(); })()}
              unit="bps"
              color={indicators.hySpread > 400 ? '#FF2D55' : '#FF9500'} seed={33}
              trend={indicators.hySpread > 400 ? 'up' : 'flat'}
            />
            <MiniWidget label="CPI YoY" value={indicators.cpi.toFixed(1)} unit="%" color={indicators.cpi > 3.5 ? '#FF9500' : '#FFD700'} seed={44} trend={indicators.cpi > 3 ? 'up' : 'down'} />
            <MiniWidget label="Unemployment" value={(rawFred['UNRATE'] ?? indicators.unemployment).toFixed(1)} unit="%" color={indicators.unemployment > 4.5 ? '#FF9500' : '#00FF88'} seed={77} trend={indicators.unemployment > 4.5 ? 'up' : 'flat'} />
            <MiniWidget label="30Y Treasury" value={(rawFred['DGS30'] ?? indicators.yield30Y).toFixed(2)} unit="%" color="#00D4FF" seed={88} trend={(rawFred['DGS30'] ?? indicators.yield30Y) > 4.8 ? 'up' : 'flat'} />
          </div>
        </div>

        {/* Historical analog */}
        <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 520ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Current Conditions Most Resemble</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {analogs.slice(0, 3).map((analog, i) => {
              const aColor = i === 0 ? '#00D4FF' : i === 1 ? '#FFD700' : '#FF9500';
              return (
                <div key={analog.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', animation: `fade-slide-up 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '4px', background: `${aColor}15`, border: `1px solid ${aColor}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '11px', color: aColor, lineHeight: 1 }}>{analog.year.slice(0, 4)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#D1D5DB', marginBottom: '4px' }}>{analog.era}</div>
                    <div style={{ position: 'relative', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${analog.similarity}%`, background: `linear-gradient(90deg, ${aColor}60, ${aColor})`, borderRadius: '2px', boxShadow: `0 0 6px ${aColor}60`, transition: 'width 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: aColor, fontWeight: 600, flexShrink: 0 }}>{analog.similarity}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily AI Risk Update */}
        {aiDomain && (
          <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderLeft: '3px solid #C084FC', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 580ms both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C084FC', boxShadow: '0 0 8px #C084FC', animation: 'blink-alert 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Daily AI Risk Update</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '30px', color: '#C084FC', textShadow: '0 0 20px rgba(192,132,252,0.6)', lineHeight: 1 }}>{aiDomain.score.toFixed(1)}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#94A3B8' }}>/10 — {aiDomain.riskLevel.toUpperCase()}</span>
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#94A3B8', lineHeight: 1.65 }}>
              {aiDomain.description} {aiDomain.drivers.slice(0, 2).join('. ')}.
            </p>
          </div>
        )}

        {/* Core metrics */}
        <div style={{ background: 'rgba(12,15,22,0.95)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '16px', marginBottom: '10px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 640ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Core High-Signal Metrics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {metrics.map((metric, i) => <MetricCardItem key={metric.id} metric={metric} index={i} />)}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em' }}>
            PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE
          </span>
        </div>
      </div>
    </div>
  );
}
