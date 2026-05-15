/* ============================================================
   FAULTLINE — Scores Page v4
   Pressure-reactive color escalation, momentum indicators,
   confidence intervals, cinematic loading
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { DomainScore } from "@/lib/engine";
import RiskBadge, { getRiskColor } from "@/components/RiskBadge";
import ScoreRing from "@/components/ScoreRing";

// ── Seeded deterministic sparkline ───────────────────────────
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ── Pressure-reactive score bar with confidence interval ─────
function PressureBar({ score, riskLevel, seed }: { score: number; riskLevel: DomainScore['riskLevel']; seed: number }) {
  const [width, setWidth] = useState(0);
  const color = getRiskColor(riskLevel);
  const pct = (score / 10) * 100;
  const confLow = Math.max(0, pct - 5);
  const confHigh = Math.min(100, pct + 5);

  useEffect(() => { const t = setTimeout(() => setWidth(pct), 350); return () => clearTimeout(t); }, [pct]);

  // Gradient based on pressure level
  const barGradient = riskLevel === 'critical'
    ? 'linear-gradient(90deg, rgba(255,45,85,0.6), #FF2D55)'
    : riskLevel === 'high'
    ? 'linear-gradient(90deg, rgba(255,149,0,0.6), #FF9500)'
    : riskLevel === 'elevated'
    ? 'linear-gradient(90deg, rgba(255,215,0,0.6), #FFD700)'
    : riskLevel === 'moderate'
    ? 'linear-gradient(90deg, rgba(0,212,255,0.6), #00D4FF)'
    : 'linear-gradient(90deg, rgba(0,255,136,0.6), #00FF88)';

  return (
    <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'visible' }}>
      {/* Confidence interval band */}
      <div style={{
        position: 'absolute', top: '-2px', bottom: '-2px',
        left: `${confLow}%`, width: `${confHigh - confLow}%`,
        background: `${color}10`, borderRadius: '4px',
        transition: 'all 1.4s cubic-bezier(0.23,1,0.32,1)',
      }} />
      {/* Main bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${width}%`, background: barGradient,
        borderRadius: '4px', boxShadow: `0 0 10px ${color}60`,
        transition: 'width 1.4s cubic-bezier(0.23,1,0.32,1)',
        animation: riskLevel === 'critical' ? 'border-pulse-crimson 2s ease-in-out infinite' : 'none',
      }} />
    </div>
  );
}

// ── Momentum indicator ────────────────────────────────────────
function MomentumArrow({ delta }: { delta: number }) {
  const isUp = delta > 0.1;
  const isDown = delta < -0.1;
  const color = isUp ? '#FF9500' : isDown ? '#00FF88' : '#6B7280';
  const rotation = isUp ? '-45deg' : isDown ? '45deg' : '0deg';
  const label = isUp ? 'RISING' : isDown ? 'EASING' : 'STABLE';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${rotation})`, transition: 'transform 0.4s ease' }}>
        <path d="M6 2 L10 8 L6 6 L2 8 Z" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color, letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>
        {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
      </span>
    </div>
  );
}

// ── Pressure level descriptor ─────────────────────────────────
function PressureLevel({ riskLevel, score }: { riskLevel: DomainScore['riskLevel']; score: number }) {
  const config = {
    critical: { label: 'CRITICAL PRESSURE', desc: 'Extreme stress — systemic cascade risk', pulseClass: 'animate-pulse-crimson' },
    high: { label: 'HIGH PRESSURE', desc: 'Significant stress — monitor closely', pulseClass: 'animate-pulse-amber' },
    elevated: { label: 'ELEVATED TENSION', desc: 'Building stress — watch for escalation', pulseClass: 'animate-pulse-gold' },
    moderate: { label: 'MODERATE RISK', desc: 'Contained — normal monitoring', pulseClass: 'animate-pulse-blue' },
    low: { label: 'LOW RISK', desc: 'Stable — no immediate concern', pulseClass: '' },
  }[riskLevel];
  const color = getRiskColor(riskLevel);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, animation: riskLevel !== 'low' ? 'blink-alert 2s ease-in-out infinite' : 'none' }} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color, letterSpacing: '0.1em' }}>{config.label}</span>
    </div>
  );
}

// ── Domain score card ─────────────────────────────────────────
function DomainCard({ score, index }: { score: DomainScore; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = getRiskColor(score.riskLevel);
  const isHighPressure = score.riskLevel === 'critical' || score.riskLevel === 'high';

  const borderClass = score.riskLevel === 'critical' ? 'pressure-border-critical'
    : score.riskLevel === 'high' ? 'pressure-border-high'
    : score.riskLevel === 'elevated' ? 'pressure-border-elevated'
    : '';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={borderClass}
      style={{
        background: isHighPressure ? `rgba(10,12,16,0.95)` : 'rgba(10,12,16,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${color}`,
        borderRadius: '4px', padding: '14px',
        cursor: 'pointer',
        animation: `cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) ${(index + 2) * 70}ms both`,
        transition: 'background 0.2s ease',
        position: 'relative', overflow: 'hidden',
        boxShadow: isHighPressure ? `0 0 24px ${color}08, inset 0 1px 0 rgba(255,255,255,0.03)` : 'none',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(17,19,24,0.98)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isHighPressure ? 'rgba(10,12,16,0.95)' : 'rgba(10,12,16,0.9)'}
    >
      {/* Corner accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderTop: `1px solid ${color}30`, borderRight: `1px solid ${color}30` }} />
      {/* Ambient glow for high pressure */}
      {isHighPressure && (
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 40% at 0% 50%, ${color}04 0%, transparent 60%)`, pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
        <ScoreRing score={score.score} maxScore={10} riskLevel={score.riskLevel} label="" delta={score.delta} size={64} showLabel={false} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: '#E2E8F0' }}>{score.label}</span>
            <RiskBadge level={score.riskLevel} size="xs" />
          </div>
          <PressureLevel riskLevel={score.riskLevel} score={score.score} />
          <div style={{ margin: '8px 0' }}>
            <PressureBar score={score.score} riskLevel={score.riskLevel} seed={index * 17 + 3} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <MomentumArrow delta={score.delta} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '20px', color, textShadow: `0 0 16px ${color}60`, lineHeight: 1 }}>
              {score.score.toFixed(1)}<span style={{ fontSize: '10px', color: '#4B5563' }}>/10</span>
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '8px' }}>{score.description}</p>
          {score.drivers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Live Drivers</div>
              {score.drivers.map((d, di) => (
                <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color, fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>▸</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', lineHeight: 1.5 }}>{d}</span>
                </div>
              ))}
            </div>
          )}
          {/* Confidence interval note */}
          <div style={{ marginTop: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', padding: '5px 8px', borderLeft: `2px solid ${color}20` }}>
            Confidence interval: {Math.max(0, score.score - 0.5).toFixed(1)} – {Math.min(10, score.score + 0.5).toFixed(1)} · ±5% band shown on bar
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Scores page ──────────────────────────────────────────
export default function Scores() {
  const [mounted, setMounted] = useState(false);
  const { output } = useEngine();
  const { overall, domains } = output;

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const color = getRiskColor(overall.riskLevel);
  const criticalCount = domains.filter(d => d.riskLevel === 'critical').length;
  const highCount = domains.filter(d => d.riskLevel === 'high').length;

  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 32px', maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 0ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Risk Intelligence</div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '28px', color: '#F0F4FF', lineHeight: 1, marginBottom: '4px' }}>Systemic Risk Scores</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6B7280' }}>
          Composite scoring across all major stress dimensions — pressure-reactive, computed live
        </p>
        {(criticalCount > 0 || highCount > 0) && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {criticalCount > 0 && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF2D55', background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.25)', borderRadius: '2px', padding: '3px 8px', animation: 'blink-alert 2s ease-in-out infinite' }}>
                {criticalCount} CRITICAL DOMAIN{criticalCount > 1 ? 'S' : ''}
              </div>
            )}
            {highCount > 0 && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)', borderRadius: '2px', padding: '3px 8px' }}>
                {highCount} HIGH PRESSURE DOMAIN{highCount > 1 ? 'S' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overall score hero */}
      <div style={{
        background: 'rgba(10,12,16,0.95)', borderRadius: '8px', padding: '20px', marginBottom: '16px',
        border: `1px solid ${color}25`,
        boxShadow: `0 0 40px ${color}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
        animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 60ms both',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 60% at 0% 50%, ${color}06 0%, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <ScoreRing score={overall.score} maxScore={10} riskLevel={overall.riskLevel} label={overall.label} delta={overall.delta} size={110} showLabel={false} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#F0F4FF' }}>{overall.label}</span>
              <RiskBadge level={overall.riskLevel} size="sm" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '38px', color, textShadow: `0 0 24px ${color}60`, animation: 'score-tick 4s ease-in-out infinite' }}>
                {overall.score.toFixed(1)}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: '#4B5563' }}>/ 10</span>
            </div>
            <PressureBar score={overall.score} riskLevel={overall.riskLevel} seed={99} />
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <MomentumArrow delta={overall.delta} />
              <PressureLevel riskLevel={overall.riskLevel} score={overall.score} />
            </div>
            {overall.drivers.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {overall.drivers.slice(0, 3).map((d, i) => (
                  <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '2px', padding: '2px 6px' }}>{d}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain score cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {domains.map((score, i) => <DomainCard key={score.id} score={score} index={i} />)}
      </div>

      {/* Score legend */}
      <div style={{ marginTop: '20px', background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px', animation: `cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) ${(domains.length + 3) * 70}ms both` }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>Pressure Scale</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
          {[
            { range: '1–2', label: 'Low', color: '#00FF88', desc: 'Stable' },
            { range: '3–4', label: 'Moderate', color: '#00D4FF', desc: 'Contained' },
            { range: '5–6', label: 'Elevated', color: '#FFD700', desc: 'Building' },
            { range: '7–8', label: 'High', color: '#FF9500', desc: 'Stress' },
            { range: '9–10', label: 'Critical', color: '#FF2D55', desc: 'Cascade' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '6px', background: `${item.color}06`, borderRadius: '3px', border: `1px solid ${item.color}15` }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '12px', color: item.color, marginBottom: '2px', textShadow: `0 0 8px ${item.color}60` }}>{item.range}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>{item.label}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '9px', color: '#4B5563' }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', textAlign: 'center' }}>
          Shaded bands on bars represent ±5% confidence intervals · Tap any card for live drivers
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ textAlign: 'center', padding: '12px 0 0' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', letterSpacing: '0.1em' }}>
          PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE
        </span>
      </div>
    </div>
  );
}
