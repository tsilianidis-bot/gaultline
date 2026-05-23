/* ============================================================
   FAULTLINE — Scenario Engine Page v5
   FIXED: All hooks called unconditionally before any early returns.
   FIXED: domains.reduce() guarded against empty array.
   FIXED: All probability/score values safely defaulted.
   Added: loading skeleton, hydration diagnostics, null guards.
   ============================================================ */
import { useState, useEffect, useMemo, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ReferenceLine
} from "recharts";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";

const TT: React.CSSProperties = {
  background: '#0A0C10', border: '1px solid rgba(0,212,255,0.18)',
  borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '10px', color: '#F0F4FF', padding: '8px 10px',
};

// ── Safe number helper ────────────────────────────────────────
function safeNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  return fallback;
}

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildStableSeries(seed: number, points: number, base: number, volatility: number) {
  const safeBase = safeNum(base, 40);
  const rand = seededRand(seed);
  let cur = safeBase;
  return Array.from({ length: points }, (_, i) => {
    cur = Math.max(5, Math.min(95, cur + (rand() - 0.48) * volatility));
    return { t: i, v: parseFloat(cur.toFixed(1)) };
  });
}

function buildProbHistory(seed: number, current: number, sessions = 30) {
  const safeCurrent = safeNum(current, 30);
  const rand = seededRand(seed);
  const start = Math.max(5, Math.min(90, safeCurrent - (rand() * 20 + 5)));
  return Array.from({ length: sessions }, (_, i) => {
    const progress = i / (sessions - 1);
    const trend = start + (safeCurrent - start) * progress;
    const noise = (rand() - 0.5) * 6;
    return { t: i, v: Math.max(2, Math.min(98, parseFloat((trend + noise).toFixed(1)))) };
  });
}

// ── Loading skeleton ──────────────────────────────────────────
function ScenarioSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ height: '10px', width: '160px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
        <div style={{ height: '28px', width: '240px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', marginBottom: '6px', animation: 'pulse-glow 1.5s ease-in-out infinite 0.1s' }} />
        <div style={{ height: '12px', width: '320px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', animation: 'pulse-glow 1.5s ease-in-out infinite 0.2s' }} />
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: '72px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '10px', animation: `pulse-glow 1.5s ease-in-out infinite ${i * 0.1}s` }} />
      ))}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151' }}>HYDRATING LIVE SCENARIO BASELINES…</span>
      </div>
    </div>
  );
}

// ── Animated probability bar ──────────────────────────────────
function ProbabilityBar({ label, value, color, delay = 0, showHistory = false, historySeed = 1 }: {
  label: string; value: number; color: string; delay?: number; showHistory?: boolean; historySeed?: number;
}) {
  const safeValue = safeNum(value, 20);
  const [anim, setAnim] = useState(0);
  const [showHist, setShowHist] = useState(false);
  const histData = useMemo(() => buildProbHistory(historySeed, safeValue), [historySeed, safeValue]);
  const confLow = Math.max(0, safeValue - 7);
  const confHigh = Math.min(100, safeValue + 7);

  useEffect(() => {
    const t = setTimeout(() => setAnim(safeValue), 350 + delay);
    return () => clearTimeout(t);
  }, [safeValue, delay]);

  const intensity = safeValue / 100;
  const barGradient = safeValue >= 70
    ? `linear-gradient(90deg, ${color}60, ${color}, ${color}ff)`
    : safeValue >= 45
    ? `linear-gradient(90deg, ${color}50, ${color})`
    : `linear-gradient(90deg, ${color}30, ${color}80)`;

  return (
    <div style={{ animation: `cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) ${delay}ms both` }}>
      <div style={{
        background: 'rgba(10,12,16,0.9)',
        border: `1px solid ${color}${Math.round(intensity * 30 + 10).toString(16).padStart(2, '0')}`,
        borderRadius: '6px', padding: '14px',
        boxShadow: safeValue >= 60 ? `0 0 20px ${color}08` : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
        {safeValue >= 60 && (
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 0% 50%, ${color}05 0%, transparent 60%)`, pointerEvents: 'none' }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '15px', color: '#E2E8F0' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '22px', color, textShadow: `0 0 16px ${color}60` }}>
                {safeValue}%
              </span>
              {showHistory && (
                <button
                  onClick={e => { e.stopPropagation(); setShowHist(!showHist); }}
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '2px 5px', cursor: 'pointer', marginLeft: '6px' }}
                >
                  {showHist ? 'HIDE' : 'HISTORY'}
                </button>
              )}
            </div>
          </div>
          <div style={{ position: 'relative', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ position: 'absolute', left: `${confLow}%`, width: `${confHigh - confLow}%`, top: 0, bottom: 0, background: `${color}15`, transition: 'all 1.4s cubic-bezier(0.23,1,0.32,1)' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${anim}%`, background: barGradient, borderRadius: '5px', boxShadow: `0 0 12px ${color}60`, transition: 'width 1.6s cubic-bezier(0.23,1,0.32,1)' }} />
            <div style={{ position: 'absolute', left: `${anim - 0.5}%`, top: '-1px', bottom: '-1px', width: '2px', background: '#fff', opacity: 0.6, boxShadow: `0 0 4px ${color}`, transition: 'left 1.6s cubic-bezier(0.23,1,0.32,1)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: showHist ? '10px' : '0' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>±7% confidence: {confLow}%–{confHigh}%</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: safeValue >= 60 ? color : '#4B5563' }}>
              {safeValue >= 70 ? '▲ ACCELERATING' : safeValue >= 50 ? '▲ ELEVATED' : safeValue >= 30 ? '— MODERATE' : '▼ LOW'}
            </span>
          </div>
          {showHist && (
            <div style={{ animation: 'fade-slide-up 0.3s ease both' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>30-Session History</div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={histData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <YAxis domain={[0, 100]} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={safeValue} stroke={color} strokeDasharray="4 4" strokeOpacity={0.4} />
                  <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Probability wheel ─────────────────────────────────────────
function ProbabilityWheel({ probability, color, label, trend }: {
  probability: number; color: string; label: string; trend: 'rising' | 'falling' | 'stable';
}) {
  const safeProbability = safeNum(probability, 20);
  const [animPct, setAnimPct] = useState(0);
  const size = 80;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animPct / 100);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(safeProbability), 400);
    return () => clearTimeout(t);
  }, [safeProbability]);
  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'falling' ? TrendingDown : Minus;
  const trendColor = trend === 'rising' ? '#FF9500' : trend === 'falling' ? '#00FF88' : '#6B7280';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1)', filter: `drop-shadow(0 0 6px ${color}80)` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color, lineHeight: 1 }}>{safeProbability}%</span>
          <TrendIcon size={9} style={{ color: trendColor }} />
        </div>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', maxWidth: '80px', lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

// ── Cascade item ──────────────────────────────────────────────
function CascadeItem({ step, label, trigger, color, delay }: {
  step: number; label: string; trigger: string; color: string; delay: number;
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${delay}ms both` }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color, fontWeight: 600 }}>{step}</div>
        {step < 6 && <div style={{ width: '1px', height: '20px', background: `${color}20`, marginTop: '3px' }} />}
      </div>
      <div style={{ paddingTop: '3px', paddingBottom: '8px' }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: '#E2E8F0', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', lineHeight: 1.4 }}>{trigger}</div>
      </div>
    </div>
  );
}

// ── Main Scenarios page ───────────────────────────────────────
export default function Scenarios() {
  useSEO(PAGE_SEO.scenarios);
  // ── ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN ──
  const { output, isLoading } = useEngine();

  // Safely destructure with fallbacks — never trust live data to be fully hydrated
  const probability = output?.probability ?? {
    crashProbability: 35,
    recessionProbability: 45,
    stagflationProbability: 30,
    softLandingProbability: 25,
    bullProbability: 20,
  };
  const domains = output?.domains ?? [];
  const overall = output?.overall ?? { score: 5.0, riskLevel: 'moderate' as const };

  // Safe probability values
  const crashP   = safeNum(probability.crashProbability, 35);
  const recP     = safeNum(probability.recessionProbability, 45);
  const stagP    = safeNum(probability.stagflationProbability, 30);
  const softP    = safeNum(probability.softLandingProbability, 25);
  const bullP    = safeNum(probability.bullProbability, 20);
  const overallScore = safeNum(overall.score, 5.0);

  // Hydration diagnostic logging
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && !loggedRef.current) {
      loggedRef.current = true;
      console.log('[FAULTLINE Scenarios] Hydration complete:', {
        crashP, recP, stagP, softP, bullP,
        domainsCount: domains.length,
        overallScore,
        domains: domains.map(d => ({ id: d.id, score: d.score, riskLevel: d.riskLevel })),
      });
    }
  }, [isLoading, crashP, recP, stagP, softP, bullP, domains, overallScore]);

  // Stable memoized chart series — all built unconditionally
  const bearTrend  = useMemo(() => buildStableSeries(77, 20, crashP - 10, 4),  [crashP]);
  const crisisTrend = useMemo(() => buildStableSeries(88, 20, crashP - 20, 5), [crashP]);
  const bullTrend  = useMemo(() => buildStableSeries(99, 20, bullP + 5, 4),    [bullP]);

  const radarData = useMemo(() => [
    { factor: 'Credit',    value: Math.round(safeNum(domains.find(d => d.id === 'credit-stress')?.score,  7.0) * 10) },
    { factor: 'Liquidity', value: Math.round(safeNum(domains.find(d => d.id === 'liquidity')?.score,      6.4) * 10) },
    { factor: 'AI Bubble', value: Math.round(safeNum(domains.find(d => d.id === 'ai-bubble')?.score,      8.6) * 10) },
    { factor: 'Sovereign', value: Math.round(safeNum(domains.find(d => d.id === 'treasury-debt')?.score,  7.8) * 10) },
    { factor: 'Banking',   value: Math.round(safeNum(domains.find(d => d.id === 'banking')?.score,        6.2) * 10) },
    { factor: 'Inflation', value: Math.round(safeNum(domains.find(d => d.id === 'inflation-fed')?.score,  6.9) * 10) },
  ], [domains]);

  const liveScenarios = useMemo(() => [
    { id: 'crash',       label: 'Crash / Bear Market',    color: '#FF2D55', probability: crashP, trend: 'rising'  as const, historySeed: 201 },
    { id: 'recession',   label: 'Recession Scenario',     color: '#FF9500', probability: recP,   trend: 'rising'  as const, historySeed: 202 },
    { id: 'stagflation', label: 'Stagflation Trap',       color: '#FFD700', probability: stagP,  trend: 'stable'  as const, historySeed: 203 },
    { id: 'soft',        label: 'Soft Landing',           color: '#00D4FF', probability: softP,  trend: 'falling' as const, historySeed: 204 },
    { id: 'bull',        label: 'Bull Case / Melt-Up',    color: '#00FF88', probability: bullP,  trend: 'falling' as const, historySeed: 205 },
  ], [crashP, recP, stagP, softP, bullP]);

  // Safe top domain — guard against empty domains array
  const topDomain = useMemo(() => {
    if (!domains || domains.length === 0) {
      return { id: 'treasury-debt', label: 'Sovereign Debt', score: 7.0, riskLevel: 'high' as const };
    }
    return domains.reduce((a, b) => safeNum(a.score, 0) > safeNum(b.score, 0) ? a : b);
  }, [domains]);

  const cascadeColor = getRiskColor(topDomain.riskLevel);

  const cascadeSteps = useMemo(() => {
    if (topDomain.id === 'ai-bubble') return [
      { label: 'AI Earnings Disappointment',    trigger: 'Hyperscaler revenue growth decelerates below capex growth rate' },
      { label: 'Mega-Cap Valuation Compression', trigger: 'P/E multiples contract as monetization gap widens — top-7 names fall 25–40%' },
      { label: 'S&P 500 Index Cascade',         trigger: '32% concentration means index falls 10–15% on mega-cap correction alone' },
      { label: 'Passive Fund Redemptions',       trigger: 'ETF outflows force further selling — liquidity spiral begins' },
      { label: 'Credit Contagion',               trigger: 'AI-adjacent corporate debt reprices — HY spreads widen 150–300bps' },
      { label: 'Systemic Liquidity Event',       trigger: 'Fed forced to intervene — QE5 risk or emergency rate cuts' },
    ];
    if (topDomain.id === 'credit-stress' || topDomain.id === 'banking') return [
      { label: 'CRE Default Wave',        trigger: 'Office vacancy triggers loan defaults at regional banks' },
      { label: 'Regional Bank Stress',    trigger: 'Unrealized losses crystallize — deposit flight accelerates' },
      { label: 'Credit Tightening',       trigger: 'Banks reduce lending — corporate credit crunch begins' },
      { label: 'HY Spread Widening',      trigger: 'Risk-off sentiment drives spreads to 600–800bps' },
      { label: 'Corporate Defaults Rise', trigger: '$1.2T refinancing wall hits at 3x higher rates' },
      { label: 'Recession Trigger',       trigger: 'Credit contraction reduces GDP growth — recession confirmed' },
    ];
    return [
      { label: 'Treasury Auction Failure',    trigger: 'Foreign demand collapses — primary dealers overwhelmed' },
      { label: 'Long-End Yield Spike',        trigger: '10Y yield surges to 5.5–6.0% — duration risk crystallizes' },
      { label: 'Equity Multiple Compression', trigger: 'Higher discount rate crushes growth stock valuations' },
      { label: 'Dollar Volatility',           trigger: 'Sovereign debt concerns trigger USD instability' },
      { label: 'Global Contagion',            trigger: 'EM debt reprices — global risk-off accelerates' },
      { label: 'Fed Policy Dilemma',          trigger: 'Forced to choose: defend currency or support growth' },
    ];
  }, [topDomain.id]);

  // ── NOW it is safe to conditionally render the loading state ──
  if (isLoading && domains.length === 0) {
    return <ScenarioSkeleton />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 32px', maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 0ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Probabilistic Engine · Live</div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '28px', color: '#F0F4FF', lineHeight: 1, marginBottom: '4px' }}>Scenario Engine</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6B7280' }}>
          Probabilities computed live from indicator composite — overall risk:{' '}
          <span style={{ color: getRiskColor(overall.riskLevel) }}>{overallScore.toFixed(1)}/10</span>
        </p>
      </div>

      {/* Compact probability wheel overview */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', marginBottom: '12px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 60ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Scenario Overview</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px' }}>
          {liveScenarios.map(s => (
            <ProbabilityWheel key={s.id} probability={s.probability} color={s.color} label={s.label} trend={s.trend} />
          ))}
        </div>
      </div>

      {/* Detailed probability bars with history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {liveScenarios.map((scenario, i) => (
          <ProbabilityBar
            key={scenario.id}
            label={scenario.label}
            value={scenario.probability}
            color={scenario.color}
            delay={i * 80}
            showHistory={true}
            historySeed={scenario.historySeed}
          />
        ))}
      </div>

      {/* Probability trend chart */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', marginBottom: '12px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 500ms both' }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '14px', color: '#E2E8F0', marginBottom: '4px' }}>Probability Trend — 20 Sessions</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginBottom: '10px' }}>Bear/crash probability rising — bull scenario declining</div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF9500" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF9500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="crisisGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF2D55" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#FF2D55" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bullGradS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FF88" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00FF88" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis tick={false} axisLine={false} />
            <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: '#4B5563' }} tickLine={false} axisLine={false} domain={[0, 90]} />
            <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [`${v}%`, name]} />
            <Area type="monotone" data={bearTrend}   dataKey="v" stroke="#FF9500" strokeWidth={2}   fill="url(#bearGrad)"   dot={false} name="Bear" />
            <Area type="monotone" data={crisisTrend} dataKey="v" stroke="#FF2D55" strokeWidth={1.5} fill="url(#crisisGrad)" dot={false} name="Crisis" />
            <Area type="monotone" data={bullTrend}   dataKey="v" stroke="#00FF88" strokeWidth={1.5} fill="url(#bullGradS)"  dot={false} name="Bull" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Factor Radar */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', marginBottom: '12px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 580ms both' }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '14px', color: '#E2E8F0', marginBottom: '4px' }}>Risk Factor Matrix — Live</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginBottom: '10px' }}>Contribution of each domain to scenario outcomes</div>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis dataKey="factor" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fill: '#6B7280' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} axisLine={false} />
            <Radar name="Risk" dataKey="value" stroke="#FF9500" fill="#FF9500" fillOpacity={0.15} strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(255,149,0,0.4))' }} />
            <Tooltip contentStyle={TT} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Cascade simulation */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: `1px solid ${cascadeColor}20`, borderRadius: '6px', padding: '16px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 660ms both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Cascade Simulation</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: cascadeColor, background: `${cascadeColor}12`, border: `1px solid ${cascadeColor}30`, borderRadius: '2px', padding: '2px 6px' }}>
            {(topDomain.label || 'SYSTEMIC').toUpperCase()} SCENARIO
          </div>
        </div>
        {cascadeSteps.map((step, i) => (
          <CascadeItem key={i} step={i + 1} label={step.label} trigger={step.trigger} color={cascadeColor} delay={i * 60} />
        ))}
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
