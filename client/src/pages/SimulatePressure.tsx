/* ============================================================
   FAULTLINE — Simulate Pressure
   Flagship interactive feature: drag sliders to stress-test
   the global financial system and watch the engine react live.

   Design: Palantir Noir — void-black, neon gold/electric-blue/crimson
   Typography: Rajdhani 700 (display) + IBM Plex Mono (data)
   ============================================================ */
import { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useEngine } from '@/contexts/EngineContext';
import { RawIndicators, DEFAULT_INDICATORS } from '@/lib/engine';
import { getRiskColor } from '@/components/RiskBadge';
import {
  Zap, RotateCcw, AlertTriangle, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';

// ── Slider config ─────────────────────────────────────────────
interface SliderConfig {
  key: keyof RawIndicators;
  label: string;
  sublabel: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  stressVal: number;   // "extreme stress" preset
  color: string;
  category: 'rates' | 'credit' | 'inflation' | 'speculation' | 'liquidity' | 'economy';
  description: string;
  stressNote: string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: 'yield10Y', label: '10Y Treasury Yield', sublabel: 'DGS10', unit: '%',
    min: 0.5, max: 8.0, step: 0.05, defaultVal: 4.68, stressVal: 6.5,
    color: '#00D4FF', category: 'rates',
    description: 'Rising yields compress equity valuations and increase borrowing costs.',
    stressNote: 'Above 6%: fiscal crisis territory, mortgage market stress',
  },
  {
    key: 'yieldCurveSpread', label: 'Yield Curve (10Y-2Y)', sublabel: 'T10Y2Y', unit: 'bps',
    min: -300, max: 200, step: 5, defaultVal: -42, stressVal: -250,
    color: '#FF2D55', category: 'rates',
    description: 'Deep inversion historically precedes recession by 12–18 months.',
    stressNote: 'Below -200bps: deep inversion, recession probability >80%',
  },
  {
    key: 'hySpread', label: 'HY Credit Spread', sublabel: 'BAMLH0A0HYM2', unit: 'bps',
    min: 100, max: 1200, step: 10, defaultVal: 342, stressVal: 900,
    color: '#FF9500', category: 'credit',
    description: 'Widening spreads signal credit market stress and risk-off sentiment.',
    stressNote: 'Above 800bps: credit crunch, 2008-level distress',
  },
  {
    key: 'vix', label: 'VIX Volatility Index', sublabel: 'CBOE VIX', unit: '',
    min: 8, max: 90, step: 1, defaultVal: 22.4, stressVal: 65,
    color: '#C084FC', category: 'liquidity',
    description: 'Elevated VIX signals fear, margin calls, and forced deleveraging.',
    stressNote: 'Above 40: panic territory, forced selling cascade',
  },
  {
    key: 'cpi', label: 'CPI Inflation', sublabel: 'CPIAUCSL YoY', unit: '%',
    min: 0, max: 15, step: 0.1, defaultVal: 3.4, stressVal: 9.0,
    color: '#FFD700', category: 'inflation',
    description: 'Re-acceleration traps the Fed between inflation and recession.',
    stressNote: 'Above 7%: 1970s stagflation analog, Fed credibility crisis',
  },
  {
    key: 'fedFundsRate', label: 'Fed Funds Rate', sublabel: 'SOFR proxy', unit: '%',
    min: 0, max: 10, step: 0.25, defaultVal: 5.25, stressVal: 8.0,
    color: '#00FF88', category: 'inflation',
    description: 'Higher rates compress growth, increase debt service, and stress banks.',
    stressNote: 'Above 7%: Volcker-era territory, severe recession risk',
  },
  {
    key: 'aiConcentration', label: 'AI/Mega-Cap Concentration', sublabel: 'Top-7 S&P weight', unit: '%',
    min: 10, max: 50, step: 0.5, defaultVal: 32.4, stressVal: 45,
    color: '#C084FC', category: 'speculation',
    description: 'Extreme concentration creates single-point-of-failure systemic risk.',
    stressNote: 'Above 40%: dot-com 2000 analog exceeded, bubble fragility extreme',
  },
  {
    key: 'bankLiquidityStress', label: 'Bank Liquidity Stress', sublabel: 'NFCI proxy', unit: '/10',
    min: 0, max: 10, step: 0.1, defaultVal: 6.8, stressVal: 9.5,
    color: '#FF9500', category: 'liquidity',
    description: 'Bank stress triggers credit contraction and systemic contagion.',
    stressNote: 'Above 8.5: SVB-style cascade risk, FDIC intervention likely',
  },
  {
    key: 'unemployment', label: 'Unemployment Rate', sublabel: 'UNRATE', unit: '%',
    min: 2.0, max: 12.0, step: 0.1, defaultVal: 4.1, stressVal: 8.5,
    color: '#00FF88', category: 'economy',
    description: 'Rising unemployment triggers Sahm Rule recession signal.',
    stressNote: 'Above 6%: Sahm Rule triggered, recession confirmed',
  },
  {
    key: 'creStress', label: 'Commercial Real Estate Stress', sublabel: 'CRE composite', unit: '/10',
    min: 0, max: 10, step: 0.1, defaultVal: 7.2, stressVal: 9.8,
    color: '#FF2D55', category: 'credit',
    description: 'CRE distress cascades through regional banks and CMBS markets.',
    stressNote: 'Above 8.5: regional bank failures, CMBS market freeze',
  },
];

const CATEGORIES = ['all', 'rates', 'credit', 'inflation', 'speculation', 'liquidity', 'economy'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<Category, string> = {
  all: '#00D4FF', rates: '#00D4FF', credit: '#FF9500',
  inflation: '#FFD700', speculation: '#C084FC', liquidity: '#FF9500', economy: '#00FF88',
};

// ── Presets ───────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'baseline', label: 'Current Baseline', color: '#00D4FF',
    description: 'Live market conditions as of today',
    overrides: {} as Partial<RawIndicators>,
  },
  {
    id: 'credit-crunch', label: 'Credit Crunch', color: '#FF9500',
    description: '2008-style credit market seizure',
    overrides: { hySpread: 850, bankLiquidityStress: 9.2, vix: 58, creStress: 9.5, yieldCurveSpread: -180 } as Partial<RawIndicators>,
  },
  {
    id: 'ai-bubble-burst', label: 'AI Bubble Burst', color: '#C084FC',
    description: 'Dot-com 2000 analog — tech collapse',
    overrides: { aiConcentration: 44, vix: 52, hySpread: 620, bankLiquidityStress: 7.5 } as Partial<RawIndicators>,
  },
  {
    id: 'stagflation', label: 'Stagflation Trap', color: '#FFD700',
    description: '1970s — inflation + recession simultaneously',
    overrides: { cpi: 8.5, fedFundsRate: 7.5, unemployment: 7.2, yieldCurveSpread: -220 } as Partial<RawIndicators>,
  },
  {
    id: 'yield-crisis', label: 'Yield Crisis', color: '#FF2D55',
    description: 'Sovereign debt / fiscal dominance scenario',
    overrides: { yield10Y: 6.8, yield30Y: 7.2, yieldCurveSpread: 50, auctionBidCover: 1.8, debtToGdpPct: 145 } as Partial<RawIndicators>,
  },
  {
    id: 'liquidity-freeze', label: 'Liquidity Freeze', color: '#FF2D55',
    description: 'March 2020 / Lehman-style market seizure',
    overrides: { vix: 78, bankLiquidityStress: 9.8, hySpread: 1100, fedBalanceSheet: 6.0 } as Partial<RawIndicators>,
  },
];

// ── Seeded sparkline for score history ────────────────────────
function buildScoreHistory(score: number): { t: number; v: number }[] {
  const points = 24;
  const result = [];
  let v = Math.max(1, score - 1.5);
  const step = (score - v) / points;
  for (let i = 0; i < points; i++) {
    v = Math.min(10, v + step + (Math.random() - 0.48) * 0.3);
    result.push({ t: i, v: parseFloat(v.toFixed(2)) });
  }
  return result;
}

// ── Tooltip style ─────────────────────────────────────────────
const TT: React.CSSProperties = {
  background: '#0A0C10', border: '1px solid rgba(0,212,255,0.18)',
  borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '10px', color: '#F0F4FF', padding: '8px 10px',
};

// ── Single slider component ───────────────────────────────────
function PressureSlider({
  config, value, onChange, isOverridden,
}: {
  config: SliderConfig;
  value: number;
  onChange: (v: number) => void;
  isOverridden: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = ((value - config.min) / (config.max - config.min)) * 100;
  const defaultPct = ((config.defaultVal - config.min) / (config.max - config.min)) * 100;
  const isStressed = value > config.stressVal || (config.key === 'yieldCurveSpread' && value < config.stressVal);
  const delta = value - config.defaultVal;
  const deltaLabel = delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(config.step < 1 ? 1 : 0)}${config.unit}`;

  return (
    <div style={{
      background: isOverridden ? `${config.color}08` : 'rgba(10,12,16,0.8)',
      border: `1px solid ${isOverridden ? config.color + '30' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '6px', padding: '12px 14px',
      transition: 'all 0.2s ease',
      boxShadow: isStressed ? `0 0 16px ${config.color}20` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1px' }}>
            {config.sublabel}
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: '#D1D5DB', lineHeight: 1 }}>
            {config.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '18px', color: config.color, textShadow: `0 0 10px ${config.color}50`, lineHeight: 1 }}>
            {value.toFixed(config.step < 1 ? 1 : 0)}{config.unit}
          </div>
          {isOverridden && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: delta > 0 ? '#FF9500' : '#00FF88', marginTop: '1px' }}>
              {deltaLabel}
            </div>
          )}
        </div>
      </div>

      {/* Slider track */}
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        {/* Default marker */}
        <div style={{
          position: 'absolute', top: '-3px', left: `${defaultPct}%`,
          width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)',
          transform: 'translateX(-50%)', zIndex: 1, pointerEvents: 'none',
        }} />
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%', height: '4px', cursor: 'pointer',
            appearance: 'none', background: `linear-gradient(90deg, ${config.color}60 ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
            borderRadius: '2px', outline: 'none',
          }}
          className="faultline-slider"
        />
      </div>

      {/* Min/max labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151' }}>{config.min}{config.unit}</span>
        {isStressed && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#FF2D55', background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.25)', borderRadius: '2px', padding: '0 4px', animation: 'blink-alert 1.2s ease-in-out infinite' }}>
            ⚠ STRESS ZONE
          </span>
        )}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151' }}>{config.max}{config.unit}</span>
      </div>

      {/* Expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Context</span>
        {expanded ? <ChevronUp size={9} style={{ color: '#374151' }} /> : <ChevronDown size={9} style={{ color: '#374151' }} />}
      </button>
      {expanded && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#6B7280', lineHeight: 1.5, marginBottom: '4px' }}>{config.description}</p>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', background: 'rgba(255,149,0,0.06)', borderRadius: '3px', padding: '4px 6px', borderLeft: '2px solid rgba(255,149,0,0.3)' }}>
            {config.stressNote}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function SimulatePressure() {
  const {
    indicators, output, simulateOverrides,
    setSimulateOverride, resetSimulation, isSimulating,
  } = useEngine();

  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [showPresets, setShowPresets] = useState(true);

  const { overall, domains, regime, probability } = output;
  const color = getRiskColor(overall.riskLevel);

  // Slider values: merge live + overrides
  const getSliderValue = useCallback((key: keyof RawIndicators): number => {
    return (simulateOverrides as unknown as Record<string, number>)[key] ?? (indicators as unknown as Record<string, number>)[key] ?? (DEFAULT_INDICATORS as unknown as Record<string, number>)[key];
  }, [simulateOverrides, indicators]);

  const handleSliderChange = useCallback((key: keyof RawIndicators, value: number) => {
    setSimulateOverride(key, value);
  }, [setSimulateOverride]);

  const applyPreset = useCallback((preset: typeof PRESETS[0]) => {
    resetSimulation();
    Object.entries(preset.overrides).forEach(([key, value]) => {
      setSimulateOverride(key as keyof RawIndicators, value as number);
    });
  }, [resetSimulation, setSimulateOverride]);

  const filteredSliders = useMemo(() =>
    activeCategory === 'all' ? SLIDERS : SLIDERS.filter(s => s.category === activeCategory),
    [activeCategory]
  );

  // Radar data for domain comparison
  const radarData = useMemo(() => domains.map(d => ({
    domain: d.label.replace(' Stress', '').replace(' Conditions', '').replace(' Risk', '').replace(' Pressure', '').replace(' Market', '').replace(' System', '').replace(' Bubble / Speculation', '').replace(' Bubble', ''),
    score: d.score,
    baseline: Math.max(0, d.score - Math.abs(d.delta)),
  })), [domains]);

  // Score history sparkline
  const scoreHistory = useMemo(() => buildScoreHistory(overall.score), [overall.score]);

  const overrideCount = Object.keys(simulateOverrides).length;

  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 40px', maxWidth: '800px', margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '20px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 0ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Scenario Stress Testing · Interactive
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '30px', color: '#F0F4FF', lineHeight: 1, marginBottom: '4px' }}>
              Simulate Pressure
            </h1>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6B7280' }}>
              Move any macro variable and watch the systemic risk engine react in real time.
            </p>
          </div>
          {isSimulating && (
            <button
              onClick={resetSimulation}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF9500',
                background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.3)',
                borderRadius: '4px', padding: '6px 12px', cursor: 'pointer',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                animation: 'glow-pulse 2s ease-in-out infinite',
              }}
            >
              <RotateCcw size={11} />
              Reset ({overrideCount} active)
            </button>
          )}
        </div>
      </div>

      {/* ── Live Impact Panel ── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(10,12,16,0.95) 0%, ${color}08 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: '8px', padding: '16px', marginBottom: '16px',
        boxShadow: isSimulating ? `0 0 30px ${color}15` : 'none',
        transition: 'all 0.4s ease',
        animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 60ms both',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top gradient line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '3px' }}>
              {isSimulating ? '⚡ SIMULATED REGIME' : 'CURRENT REGIME'}
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color, lineHeight: 1, textShadow: `0 0 20px ${color}50` }}>
              {regime.label}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginTop: '2px' }}>
              {regime.sublabel}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Systemic Risk
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '40px', color, lineHeight: 1, textShadow: `0 0 24px ${color}60`, transition: 'color 0.4s ease' }}>
              {overall.score.toFixed(1)}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }}>/ 10.0</div>
          </div>
        </div>

        {/* Probability row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            { label: 'Crash/Bear', value: probability.crashProbability, color: '#FF2D55' },
            { label: 'Recession', value: probability.recessionProbability, color: '#FF9500' },
            { label: 'Stagflation', value: probability.stagflationProbability, color: '#FFD700' },
          ].map(p => (
            <div key={p.label} style={{ background: 'rgba(5,6,8,0.6)', borderRadius: '4px', padding: '8px', textAlign: 'center', border: `1px solid ${p.color}15` }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: p.color, lineHeight: 1, transition: 'color 0.3s ease' }}>
                {p.value}%
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>

        {/* Score history sparkline */}
        <ResponsiveContainer width="100%" height={50}>
          <AreaChart data={scoreHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#simGrad)" dot={false} style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Domain radar */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
            Domain Impact Map
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="domain" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#6B7280' }} />
              <Radar name="Simulated" dataKey="score" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
              <Radar name="Baseline" dataKey="baseline" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth={1} strokeDasharray="3 3" />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {isSimulating && (
          <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <Zap size={10} style={{ color: '#FF9500', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '10px', color: '#94A3B8', lineHeight: 1.5 }}>
                <strong style={{ color: '#FF9500' }}>Simulation active</strong> — {overrideCount} indicator{overrideCount !== 1 ? 's' : ''} overridden. All scores, regime, and probabilities reflect simulated conditions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Presets ── */}
      {showPresets && (
        <div style={{ marginBottom: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 100ms both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>
            ── Scenario Presets ──
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  background: 'rgba(10,12,16,0.8)', border: `1px solid ${preset.color}20`,
                  borderRadius: '5px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${preset.color}45`; (e.currentTarget as HTMLElement).style.background = `${preset.color}08`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${preset.color}20`; (e.currentTarget as HTMLElement).style.background = 'rgba(10,12,16,0.8)'; }}
              >
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: preset.color, marginBottom: '2px' }}>{preset.label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', lineHeight: 1.3 }}>{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Category Filter ── */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 140ms both' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.08em',
              padding: '4px 10px', borderRadius: '2px', textTransform: 'uppercase',
              border: `1px solid ${activeCategory === cat ? CATEGORY_COLORS[cat] + '50' : 'rgba(255,255,255,0.07)'}`,
              background: activeCategory === cat ? `${CATEGORY_COLORS[cat]}12` : 'transparent',
              color: activeCategory === cat ? CATEGORY_COLORS[cat] : '#4B5563',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Sliders ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {filteredSliders.map((config, i) => (
          <div key={config.key} style={{ animation: `cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 50}ms both` }}>
            <PressureSlider
              config={config}
              value={getSliderValue(config.key)}
              onChange={v => handleSliderChange(config.key, v)}
              isOverridden={config.key in simulateOverrides}
            />
          </div>
        ))}
      </div>

      {/* ── Domain Score Breakdown ── */}
      <div style={{ marginBottom: '16px', animation: 'cinematic-reveal 0.6s cubic-bezier(0.23,1,0.32,1) 200ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>
          ── Live Domain Scores ──
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {domains.map(d => {
            const dc = getRiskColor(d.riskLevel);
            return (
              <div key={d.id} style={{ background: 'rgba(10,12,16,0.8)', border: `1px solid ${dc}18`, borderRadius: '4px', padding: '10px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                  {d.label.replace(' Stress', '').replace(' Conditions', '').replace(' Risk', '').replace(' Pressure', '').replace(' Market', '').replace(' System', '')}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: dc, lineHeight: 1, transition: 'color 0.3s ease, text-shadow 0.3s ease', textShadow: `0 0 12px ${dc}50` }}>
                    {d.score.toFixed(1)}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>/10</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: d.delta > 0 ? '#FF9500' : '#00FF88', marginLeft: 'auto' }}>
                    {d.delta > 0 ? <TrendingUp size={8} style={{ display: 'inline' }} /> : <TrendingDown size={8} style={{ display: 'inline' }} />}
                    {' '}{d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}
                  </span>
                </div>
                {/* Score bar */}
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.score * 10}%`, background: dc, borderRadius: '1px', transition: 'width 0.4s cubic-bezier(0.23,1,0.32,1)', boxShadow: `0 0 6px ${dc}60` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '4px',
      }}>
        <Info size={12} style={{ color: '#4B5563', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', lineHeight: 1.5 }}>
          <strong style={{ color: '#6B7280' }}>Probabilistic risk intelligence. Not financial advice.</strong>{' '}
          Simulate Pressure is an educational stress-testing tool. Simulated scenarios do not predict future market events. All models are composites, not guarantees.
        </p>
      </div>

      {/* Slider CSS */}
      <style>{`
        .faultline-slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #F0F4FF;
          border: 2px solid rgba(0,212,255,0.6);
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0,212,255,0.4);
          transition: box-shadow 0.15s ease;
        }
        .faultline-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 14px rgba(0,212,255,0.7);
        }
        .faultline-slider::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #F0F4FF;
          border: 2px solid rgba(0,212,255,0.6);
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0,212,255,0.4);
        }
      `}</style>
    </div>
  );
}
