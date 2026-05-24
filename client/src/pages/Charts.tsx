/* ============================================================
   FAULTLINE — Charts Tab (Enhanced)
   Design: Palantir Noir — void-black, neon gold/electric-blue/crimson
   Typography: Rajdhani 700 (display) + IBM Plex Mono (data)

   Sections:
   1. Systemic Pressure Timeline (with 1D/1W/1M/3M/1Y toggle)
   2. Six Macro Chart Cards
   3. Historical Overlay Mode
   4. Correlation / Risk Map (SVG canvas)
   5. Disclaimer
   ============================================================ */
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import {
  Timeframe,
  getSystemicPressureData,
  getSystemicPressureSnapshot,
  macroChartCards,
  MacroChartCard,
  historicalOverlayScenarios,
  currentTrajectoryData,
  correlationNodes,
  correlationEdges,
} from "@/lib/chartData";
import { getRiskColor } from "@/components/RiskBadge";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";

// ── Shared tooltip style ──────────────────────────────────────
const TT: React.CSSProperties = {
  background: '#0A0C10',
  border: '1px solid rgba(0,212,255,0.18)',
  borderRadius: '4px',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '10px',
  color: '#F0F4FF',
  padding: '8px 10px',
};

// ── Timeframe toggle ──────────────────────────────────────────
const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

function TFToggle({ value, onChange }: { value: Timeframe; onChange: (tf: Timeframe) => void }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', letterSpacing: '0.06em',
            padding: '4px 9px', borderRadius: '2px',
            border: `1px solid ${value === tf ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
            background: value === tf ? 'rgba(0,212,255,0.12)' : 'transparent',
            color: value === tf ? '#00D4FF' : '#6B7280',
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────
function SectionCard({
  children, delay = 0, accentColor = 'rgba(0,212,255,0.15)',
  style = {},
}: {
  children: React.ReactNode; delay?: number;
  accentColor?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: 'rgba(10,12,16,0.92)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '6px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
      animation: `fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) ${delay}ms both`,
      ...style,
    }}>
      {/* top-left corner bracket */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: `1px solid ${accentColor}`, borderLeft: `1px solid ${accentColor}` }} />
      {/* bottom-right corner bracket */}
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: `1px solid ${accentColor}`, borderRight: `1px solid ${accentColor}` }} />
      {/* top gradient line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ eyebrow, title, subtitle, color = '#00D4FF' }: {
  eyebrow: string; title: string; subtitle?: string; color?: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }}>
        {eyebrow}
      </div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#E2E8F0', lineHeight: 1 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginTop: '3px', letterSpacing: '0.04em' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ── 1. Systemic Pressure Timeline ──────────────────────────────
function SystemicPressureTimeline() {
  const [tf, setTf] = useState<Timeframe>('1M');
  const data = useMemo(() => getSystemicPressureData(tf), [tf]);
  const staticSnap = useMemo(() => getSystemicPressureSnapshot(tf), [tf]);
  // Override snapshot with live engine values when available
  const { output, isLive } = useEngine();
  const liveScore = parseFloat(output.overall.score.toFixed(1));
  const snap = isLive
    ? { ...staticSnap, current: liveScore.toFixed(1), prior: (liveScore - output.overall.delta).toFixed(1), deltaLabel: `${output.overall.delta >= 0 ? '+' : ''}${output.overall.delta.toFixed(1)}`, trend: output.overall.delta > 0.1 ? 'rising' as const : output.overall.delta < -0.1 ? 'falling' as const : 'stable' as const }
    : staticSnap;
  const TrendIcon = snap.trend === 'rising' ? TrendingUp : snap.trend === 'falling' ? TrendingDown : Minus;
  const trendColor = snap.trend === 'rising' ? '#FF9500' : snap.trend === 'falling' ? '#00FF88' : '#6B7280';
  return (
    <SectionCard delay={0} accentColor="rgba(255,149,0,0.25)">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }}>
            Composite Score · Live
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#E2E8F0', lineHeight: 1 }}>
            Systemic Pressure Timeline
          </div>
        </div>
        <TFToggle value={tf} onChange={setTf} />
      </div>

      {/* Score snapshot row */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Current
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '42px', color: '#FF9500', lineHeight: 1, textShadow: '0 0 24px rgba(255,149,0,0.5)' }}>
            {snap.current}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', marginTop: '2px' }}>/ 10.0</div>
        </div>
        <div style={{ paddingBottom: '6px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Prior ({tf})
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '24px', color: '#94A3B8', lineHeight: 1 }}>
            {snap.prior}
          </div>
        </div>
        <div style={{ paddingBottom: '6px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Delta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendIcon size={14} style={{ color: trendColor }} />
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: trendColor, lineHeight: 1, textShadow: `0 0 12px ${trendColor}60` }}>
              {snap.deltaLabel}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', paddingBottom: '6px', textAlign: 'right' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
            color: output.regime.color, background: `${output.regime.color}12`,
            border: `1px solid ${output.regime.color}30`, borderRadius: '2px',
            padding: '3px 8px', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            ◆ {output.regime.label}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginTop: '4px' }}>
            {output.regime.sublabel}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9500" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FF9500" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: '#4B5563' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[4, 10]} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fill: '#4B5563' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT} labelStyle={{ color: '#6B7280' }} formatter={(v: number) => [`${v.toFixed(2)} / 10`, 'Systemic Pressure']} />
          {/* Danger zone reference */}
          <ReferenceLine y={7.5} stroke="rgba(255,45,85,0.3)" strokeDasharray="4 4" label={{ value: 'DANGER', position: 'right', fill: '#FF2D55', fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }} />
          <ReferenceLine y={6.0} stroke="rgba(255,215,0,0.2)" strokeDasharray="4 4" label={{ value: 'ELEVATED', position: 'right', fill: '#FFD700', fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }} />
          <Area
            type="monotone" dataKey="value" stroke="#FF9500" strokeWidth={2.5}
            fill="url(#pressureGrad)" dot={false}
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,149,0,0.6))' }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
        {[
          { color: '#FF2D55', label: '7.5+ Danger Zone' },
          { color: '#FF9500', label: '6.0–7.5 High Risk' },
          { color: '#FFD700', label: '4.5–6.0 Elevated' },
          { color: '#00FF88', label: '<4.5 Moderate' },
        ].map(z => (
          <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '1px', background: z.color, opacity: 0.7 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{z.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── 2. Macro Chart Card ───────────────────────────────────────
function MacroCard({ card, index }: { card: MacroChartCard; index: number }) {
  const [tf, setTf] = useState<Timeframe>('1M');
  const [expanded, setExpanded] = useState(false);
  const data = card.series[tf];
  const secData = card.secondarySeries?.[tf];
  const color = card.color;

  return (
    <SectionCard delay={index * 60} accentColor={`${color}20`}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
              color, background: `${color}15`, border: `1px solid ${color}30`,
              borderRadius: '2px', padding: '1px 6px', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {card.riskLevel}
            </div>
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '15px', color: '#E2E8F0', lineHeight: 1.1 }}>
            {card.title}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginTop: '2px' }}>
            {card.subtitle}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '26px', color, lineHeight: 1, textShadow: `0 0 16px ${color}50` }}>
            {card.currentValue}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7280', marginLeft: '3px' }}>{card.unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', marginTop: '2px' }}>
            {card.changeDirection === 'up' ? <TrendingUp size={10} style={{ color: '#FF9500' }} /> : card.changeDirection === 'down' ? <TrendingDown size={10} style={{ color: '#00FF88' }} /> : <Minus size={10} style={{ color: '#6B7280' }} />}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: card.changeDirection === 'up' ? '#FF9500' : card.changeDirection === 'down' ? '#00FF88' : '#6B7280' }}>
              {card.changeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* TF toggle */}
      <div style={{ marginBottom: '10px' }}>
        <TFToggle value={tf} onChange={setTf} />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {secData && (
              <linearGradient id={`grad2-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={card.secondaryColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={card.secondaryColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={TT} labelStyle={{ color: '#6B7280' }} formatter={(v: number, name: string) => [`${v} ${card.unit}`, name]} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${card.id})`} dot={false} name={card.title} style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
          {secData && (
            <Area type="monotone" data={secData} dataKey="value" stroke={card.secondaryColor} strokeWidth={1.5} fill={`url(#grad2-${card.id})`} dot={false} name={card.secondaryLabel} strokeDasharray="4 3" />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Expand / collapse interpretation */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Interpretation
        </span>
        {expanded ? <ChevronUp size={10} style={{ color: '#4B5563' }} /> : <ChevronDown size={10} style={{ color: '#4B5563' }} />}
      </button>
      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '6px' }}>
            {card.interpretation}
          </p>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563',
            background: 'rgba(255,255,255,0.02)', borderRadius: '3px', padding: '5px 8px',
            borderLeft: `2px solid ${color}30`,
          }}>
            API: {card.apiSource}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── 3. Historical Overlay Mode ────────────────────────────────
function HistoricalOverlay() {
  const [active, setActive] = useState<string[]>(['dotcom', 'gfc']);

  const toggle = (id: string) => {
    setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Build merged dataset with all active series
  const mergedData = useMemo(() => {
    const len = currentTrajectoryData.length;
    return currentTrajectoryData.map((pt, i) => {
      const row: Record<string, number | string> = { date: pt.date, current: pt.value };
      historicalOverlayScenarios.forEach(s => {
        if (active.includes(s.id)) row[s.id] = s.data[i]?.value ?? 100;
      });
      return row;
    });
  }, [active]);

  return (
    <SectionCard delay={0} accentColor="rgba(192,132,252,0.2)">
      <SectionHeader
        eyebrow="Pattern Recognition · Indexed to 100"
        title="Historical Overlay Mode"
        subtitle="Current trajectory vs historical crisis paths"
        color="#C084FC"
      />

      {/* Scenario toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
        {historicalOverlayScenarios.map(s => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.06em',
              padding: '4px 10px', borderRadius: '2px',
              border: `1px solid ${active.includes(s.id) ? s.color + '60' : 'rgba(255,255,255,0.07)'}`,
              background: active.includes(s.id) ? `${s.color}18` : 'transparent',
              color: active.includes(s.id) ? s.color : '#6B7280',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {s.shortLabel}
          </button>
        ))}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
          <div style={{ width: '8px', height: '2px', background: '#00D4FF', borderRadius: '1px' }} />
          Current
        </div>
      </div>

      {/* Overlay chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={mergedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[25, 135]} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fill: '#4B5563' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={TT} labelStyle={{ color: '#6B7280' }} formatter={(v: number, name: string) => {
            const s = historicalOverlayScenarios.find(x => x.id === name);
            return [`${v.toFixed(1)}`, s ? s.shortLabel : 'Current'];
          }} />
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
          {/* Current trajectory */}
          <Line type="monotone" dataKey="current" stroke="#00D4FF" strokeWidth={2.5} dot={false} name="current" style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' }} />
          {/* Historical lines */}
          {historicalOverlayScenarios.map(s => active.includes(s.id) && (
            <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={1.5} dot={false} name={s.id} strokeDasharray="5 3" style={{ filter: `drop-shadow(0 0 4px ${s.color}50)` }} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Scenario detail cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
        {historicalOverlayScenarios.filter(s => active.includes(s.id)).map(s => (
          <div key={s.id} style={{
            background: `${s.color}08`, border: `1px solid ${s.color}20`,
            borderLeft: `3px solid ${s.color}`, borderRadius: '4px', padding: '10px',
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: s.color, marginBottom: '2px' }}>
                  {s.label}
                </div>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
                  {s.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: s.color, lineHeight: 1 }}>
                    {s.peakDrawdown}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Peak DD
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#94A3B8', lineHeight: 1 }}>
                    {s.duration}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Duration
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {active.length === 0 && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#4B5563', textAlign: 'center', padding: '12px' }}>
            Select a scenario above to overlay
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── 4. Correlation / Risk Map (SVG) ──────────────────────────
function CorrelationRiskMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 340, h: 260 });

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setDims({ w, h: Math.max(220, Math.min(300, w * 0.75)) });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { w, h } = dims;
  const pad = 28;

  // Map node positions from 0–100 to SVG coords
  const nodePos = (x: number, y: number) => ({
    cx: pad + (x / 100) * (w - pad * 2),
    cy: pad + (y / 100) * (h - pad * 2),
  });

  const getNode = (id: string) => correlationNodes.find(n => n.id === id)!;

  return (
    <SectionCard delay={0} accentColor="rgba(0,212,255,0.15)">
      <SectionHeader
        eyebrow="Cross-Asset Relationships"
        title="Correlation / Risk Map"
        subtitle="Node size = stress level · Edge color = correlation direction · Dashed = breakdown"
      />

      <div ref={containerRef} style={{ width: '100%' }}>
        <svg width={w} height={h} style={{ display: 'block' }}>
          <defs>
            {/* Glow filter */}
            <filter id="nodeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Grid pattern */}
            <pattern id="gridPat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width={w} height={h} fill="url(#gridPat)" />

          {/* Edges */}
          {correlationEdges.map((edge, i) => {
            const from = getNode(edge.from);
            const to = getNode(edge.to);
            if (!from || !to) return null;
            const fp = nodePos(from.x, from.y);
            const tp = nodePos(to.x, to.y);
            const isPositive = edge.correlation > 0;
            const absCorr = Math.abs(edge.correlation);
            const edgeColor = edge.stressed
              ? `rgba(255,45,85,${0.3 + absCorr * 0.4})`
              : isPositive
                ? `rgba(255,149,0,${0.2 + absCorr * 0.3})`
                : `rgba(0,212,255,${0.2 + absCorr * 0.3})`;

            return (
              <g key={i}>
                <line
                  x1={fp.cx} y1={fp.cy} x2={tp.cx} y2={tp.cy}
                  stroke={edgeColor}
                  strokeWidth={1 + absCorr * 2}
                  strokeDasharray={edge.stressed ? '5 3' : undefined}
                  opacity={0.7}
                />
                {/* Correlation label at midpoint */}
                <text
                  x={(fp.cx + tp.cx) / 2}
                  y={(fp.cy + tp.cy) / 2 - 3}
                  fill={edgeColor}
                  fontSize="7"
                  fontFamily="'IBM Plex Mono', monospace"
                  textAnchor="middle"
                  opacity={0.8}
                >
                  {edge.correlation > 0 ? '+' : ''}{edge.correlation.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {correlationNodes.map(node => {
            const pos = nodePos(node.x, node.y);
            const r = 10 + (node.value / 100) * 14;
            return (
              <g key={node.id}>
                {/* Outer glow ring */}
                <circle
                  cx={pos.cx} cy={pos.cy} r={r + 4}
                  fill="none" stroke={node.color}
                  strokeWidth="1" opacity={0.2}
                />
                {/* Main node */}
                <circle
                  cx={pos.cx} cy={pos.cy} r={r}
                  fill={`${node.color}18`}
                  stroke={node.color}
                  strokeWidth="1.5"
                  filter="url(#nodeGlow)"
                />
                {/* Stress fill arc */}
                <circle
                  cx={pos.cx} cy={pos.cy} r={r * 0.55}
                  fill={`${node.color}35`}
                />
                {/* Value label */}
                <text
                  x={pos.cx} y={pos.cy + 1}
                  fill={node.color}
                  fontSize="9"
                  fontFamily="'Rajdhani', sans-serif"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.value}
                </text>
                {/* Name label */}
                <text
                  x={pos.cx}
                  y={pos.cy + r + 10}
                  fill="#6B7280"
                  fontSize="7"
                  fontFamily="'IBM Plex Mono', monospace"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
        {[
          { color: 'rgba(255,45,85,0.7)', label: 'Stress contagion (dashed)', dashed: true },
          { color: 'rgba(255,149,0,0.6)', label: 'Positive correlation', dashed: false },
          { color: 'rgba(0,212,255,0.6)', label: 'Negative correlation', dashed: false },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="16" height="4">
              <line x1="0" y1="2" x2="16" y2="2" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? '4 2' : undefined} />
            </svg>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,149,0,0.3)', border: '1px solid rgba(255,149,0,0.6)' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>Node size = stress level</span>
        </div>
      </div>

      {/* Stress contagion note */}
      <div style={{
        marginTop: '12px', padding: '8px 10px',
        background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.15)',
        borderRadius: '4px',
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF2D55', boxShadow: '0 0 6px rgba(255,45,85,0.8)', flexShrink: 0, marginTop: '3px', animation: 'blink-alert 1.2s ease-in-out infinite' }} />
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
            <strong style={{ color: '#FF2D55' }}>Stress contagion detected</strong> across Credit ↔ Liquidity ↔ Bonds ↔ Equities. Correlation breakdown between Equities and Bonds (traditional hedge) signals late-cycle regime shift. Cross-asset diversification effectiveness reduced.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── 5. Institutional Depth Widgets ──────────────────────────
function seededRandW(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function buildW(seed: number, n: number, base: number, vol: number) {
  const r = seededRandW(seed);
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(-3, Math.min(8, v + (r() - 0.48) * vol));
    return { t: i, v: parseFloat(v.toFixed(2)) };
  });
}

function InstitutionalWidgets() {
  const yieldCurveData = useMemo(() => buildW(301, 36, -0.4, 0.18), []);
  const vixData = useMemo(() => buildW(302, 36, 22, 2.5), []);
  const treasuryData = useMemo(() => buildW(303, 36, 4.4, 0.12), []);
  const aiSentData = useMemo(() => buildW(304, 36, 72, 4), []);
  const liquidityData = useMemo(() => buildW(305, 36, 5.8, 0.4), []);
  const creditData = useMemo(() => buildW(306, 36, 380, 18), []);

  const widgets = [
    {
      id: 'yield-curve', label: 'Yield Curve', sublabel: '10Y–2Y Spread', value: '-0.42', unit: '%',
      color: '#FF2D55', data: yieldCurveData, trend: 'inverted',
      note: 'Inverted — recession signal active',
      apiSource: 'FRED: T10Y2Y',
    },
    {
      id: 'vix', label: 'VIX Pulse', sublabel: 'Volatility Index', value: '22.8', unit: '',
      color: '#FF9500', data: vixData, trend: 'elevated',
      note: 'Elevated — above 20 threshold',
      apiSource: 'CBOE via Polygon.io',
    },
    {
      id: 'treasury', label: 'Treasury Ribbon', sublabel: '10Y Yield', value: '4.42', unit: '%',
      color: '#00D4FF', data: treasuryData, trend: 'rising',
      note: 'Rising — duration risk elevated',
      apiSource: 'FRED: DGS10',
    },
    {
      id: 'ai-sentiment', label: 'AI Sentiment', sublabel: 'Speculation Index', value: '72', unit: '/100',
      color: '#C084FC', data: aiSentData, trend: 'extreme',
      note: 'Extreme greed — bubble risk',
      apiSource: 'Alpha Vantage: Sentiment',
    },
    {
      id: 'liquidity', label: 'Liquidity Flow', sublabel: 'M2 / Fed Balance', value: '5.8', unit: '/10',
      color: '#FFD700', data: liquidityData, trend: 'tightening',
      note: 'Tightening — QT in progress',
      apiSource: 'FRED: M2SL, WALCL',
    },
    {
      id: 'credit-spread', label: 'Credit Spread', sublabel: 'HY OAS (bps)', value: '380', unit: 'bps',
      color: '#FF9500', data: creditData, trend: 'widening',
      note: 'Widening — credit stress rising',
      apiSource: 'FRED: BAMLH0A0HYM2',
    },
  ];

  const trendConfig: Record<string, { color: string; label: string }> = {
    inverted: { color: '#FF2D55', label: 'INVERTED' },
    elevated: { color: '#FF9500', label: 'ELEVATED' },
    rising: { color: '#FF9500', label: 'RISING' },
    extreme: { color: '#C084FC', label: 'EXTREME' },
    tightening: { color: '#FFD700', label: 'TIGHTENING' },
    widening: { color: '#FF9500', label: 'WIDENING' },
  };

  return (
    <SectionCard delay={0} accentColor="rgba(0,212,255,0.15)">
      <SectionHeader
        eyebrow="Institutional Depth · Live Instruments"
        title="Market Intelligence Ribbon"
        subtitle="Six high-signal instruments — structured for FRED, Polygon.io, Alpha Vantage, TradingView"
        color="#00D4FF"
      />
      {/* Data status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '6px 10px', background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.15)', borderRadius: '4px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF9500', flexShrink: 0 }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', letterSpacing: '0.1em' }}>MODEL</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>— Chart lines use calibrated baseline models. Current values update when live FRED/Polygon feeds are active.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {widgets.map((w, i) => {
          const tc = trendConfig[w.trend] ?? { color: '#6B7280', label: w.trend.toUpperCase() };
          return (
            <div key={w.id} style={{
              background: 'rgba(5,6,8,0.9)', border: `1px solid ${w.color}18`,
              borderRadius: '4px', padding: '10px', position: 'relative', overflow: 'hidden',
              animation: `cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) ${i * 70}ms both`,
              transition: 'border-color 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${w.color}35`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = `${w.color}18`}
            >
              {/* Corner bracket */}
              <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', borderTop: `1px solid ${w.color}30`, borderRight: `1px solid ${w.color}30` }} />
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>{w.sublabel}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#D1D5DB', marginBottom: '4px', lineHeight: 1 }}>{w.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '20px', color: w.color, textShadow: `0 0 12px ${w.color}60`, lineHeight: 1, animation: 'data-flicker 16s ease-in-out infinite' }}>{w.value}</span>
                {w.unit && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>{w.unit}</span>}
              </div>
              <ResponsiveContainer width="100%" height={36}>
                <LineChart data={w.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Line type="monotone" dataKey="v" stroke={w.color} strokeWidth={1.5} dot={false}
                    style={{ filter: `drop-shadow(0 0 3px ${w.color}60)` }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: tc.color, background: `${tc.color}10`, border: `1px solid ${tc.color}25`, borderRadius: '2px', padding: '1px 5px' }}>{tc.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '2px', padding: '1px 4px' }}>MODEL · {w.apiSource.split(':')[0]}</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '9px', color: '#4B5563', marginTop: '3px', lineHeight: 1.3 }}>{w.note}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: '10px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', padding: '6px 8px', borderLeft: '2px solid rgba(0,212,255,0.15)' }}>
        API integration ready: FRED (yield curve, treasury, liquidity) · Polygon.io (VIX, equities) · Alpha Vantage (sentiment) · FINRA TRACE (credit spreads) · TradingView (charting)
      </div>
    </SectionCard>
  );
}

// ── Main Charts Page ────────────────────────────────────────────
export default function Charts() {
  useSEO(PAGE_SEO.charts);
  const { isLive, lastUpdated } = useEngine();
  return (
    <div style={{ minHeight: '100vh', background: '#050608', padding: '20px 16px 32px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '20px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 0ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Market Intelligence · {isLive ? 'FRED Live Data' : 'Simulated Baseline'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '30px', color: '#F0F4FF', lineHeight: 1 }}>
            Charts
          </h1>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px #00FF88', animation: 'pulse-gold 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00FF88', letterSpacing: '0.1em' }}>FRED LIVE</span>
              {lastUpdated && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', marginLeft: '2px' }}>
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6B7280' }}>
          Systemic pressure, macro stress indicators, historical overlays, and cross-asset correlations
        </p>
      </div>

      {/* ── Section 1: Systemic Pressure Timeline ── */}
      <div style={{ marginBottom: '12px' }}>
        <SystemicPressureTimeline />
      </div>

      {/* ── Section 2: Macro Chart Cards ── */}
      <div style={{ marginBottom: '6px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
          ── Macro Stress Indicators ──
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
        {macroChartCards.map((card, i) => (
          <MacroCard key={card.id} card={card} index={i} />
        ))}
      </div>

      {/* ── Section 3: Historical Overlay ── */}
      <div style={{ marginBottom: '6px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
          ── Historical Pattern Comparison ──
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <HistoricalOverlay />
      </div>

      {/* ── Section 5: Institutional Depth Widgets ── */}
      <div style={{ marginBottom: '6px', animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
          ── Institutional Depth Instruments ──
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <InstitutionalWidgets />
      </div>

      {/* ── Section 4: Correlation / Risk Map ── */}
      <div style={{ marginBottom: '6px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 80ms both' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
          ── Cross-Asset Correlation ──
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <CorrelationRiskMap />
      </div>

      {/* ── Disclaimer ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '4px',
        animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 600ms both',
      }}>
        <Info size={12} style={{ color: '#4B5563', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', lineHeight: 1.5, letterSpacing: '0.04em' }}>
          <strong style={{ color: '#FF9500' }}>MODEL DATA — Not financial advice.</strong>{' '}
          Chart lines are calibrated baseline models, not live market feeds. The Systemic Pressure score and regime labels update from live FRED data when available. Full live integration (FRED, Polygon.io, Alpha Vantage) is in development. Risk scores are composite models, not guarantees of future outcomes. Consult a qualified financial professional before making investment decisions.
        </p>
      </div>
    </div>
  );
}
