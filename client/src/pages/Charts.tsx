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
  macroChartCards,
  MacroChartCard,
  historicalOverlayScenarios,
  correlationNodes,
  correlationEdges,
} from "@/lib/chartData";
import { getRiskColor } from "@/components/RiskBadge";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { trpc } from "@/lib/trpc";
import { useAppHeaderFred } from "@/hooks/useAppHeaderFred";
import { buildChartsInstruments, macroCardSourceText } from "@/lib/chartsInstrumentReadings";
import { usePressureSnapshot } from "@/hooks/usePressureSnapshot";
import { PRESSURE_BANDS, PRESSURE_UNAVAILABLE_COLOR } from "@/lib/pressureSnapshot";
import { formatEt } from "@shared/credibilityLabels";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";

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

// ── 1. Systemic Pressure (canonical /100) ──────────────────────
// The composite is the canonical Pressure Index (marketState.canonicalCurrent,
// 0–100), the same value as NOW, Pressure and the header strip, with its
// as-of time in ET. No 0–10 engine score, no seeded timeline, no static prior.
function SystemicPressureTimeline() {
  const view = usePressureSnapshot();
  // Freshness label = the same customer integrity label as the header chip (never a hard-coded "LIVE").
  const { integrityLabel } = useEngine();
  const ready = view.status === 'ready' ? view : null;
  const color = ready ? ready.band.color : PRESSURE_UNAVAILABLE_COLOR;
  const asOf = ready ? formatEt(ready.provenance.asOf) : null;
  return (
    <SectionCard delay={0} accentColor="rgba(255,149,0,0.25)">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }}>
            Composite Score · Canonical Pressure Index
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#E2E8F0', lineHeight: 1 }}>
            Systemic Pressure
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Current
          </div>
          <div data-charts-pressure={ready ? ready.displayScore : 'unavailable'} style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '42px', color, lineHeight: 1 }}>
            {ready ? ready.displayScore : view.status === 'loading' ? '…' : '—'}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', marginTop: '2px' }}>{ready ? '/ 100' : view.status === 'loading' ? 'Loading' : 'Unavailable'}</div>
        </div>
        {ready && (
          <div style={{ paddingBottom: '6px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Direction
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '20px', color: '#94A3B8', lineHeight: 1 }}>
              {ready.state.pressureDirection === 'Unknown' ? 'Unavailable' : ready.state.pressureDirection}
            </div>
          </div>
        )}
        {ready && (
          <div style={{ marginLeft: 'auto', paddingBottom: '6px', textAlign: 'right' }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
              color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '2px',
              padding: '3px 8px', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              ◆ {ready.regime}
            </div>
          </div>
        )}
      </div>
      <div data-charts-pressure-basis style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginBottom: '10px' }}>
        {ready
          ? `${integrityLabel} · Canonical Pressure Index · as of ${asOf ?? '—'} · evidence ${ready.provenance.evidenceQuality}`
          : view.status === 'loading' ? 'Loading canonical Pressure state…' : 'Canonical Pressure state unavailable'}
      </div>

      {/* Engine bands (0–100), from the engine thresholds */}
      <div style={{ display: 'flex', gap: '14px', marginTop: '4px', flexWrap: 'wrap' }}>
        {PRESSURE_BANDS.map(b => (
          <div key={b.regime} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '1px', background: b.color, opacity: 0.7 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{b.range} {b.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>
        History: <a href="/app/pressure-history" style={{ color: '#00D4FF' }}>Pressure history</a>
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
            {macroCardSourceText(card.apiSource)}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── 3. Historical Crisis Reference ────────────────────────────
// The former overlay plotted seeded crisis "paths" and a seeded "current
// trajectory" on recent calendar dates. No indexed historical series is
// connected, so nothing is plotted: the episodes are listed as reference only.
function HistoricalOverlay() {
  return (
    <SectionCard delay={0} accentColor="rgba(192,132,252,0.2)">
      <SectionHeader
        eyebrow="Historical Reference · Not a data overlay"
        title="Historical Crisis Reference"
        subtitle="Past stress episodes for context. No current trajectory or crisis path is plotted: no indexed historical series is connected."
        color="#C084FC"
      />
      <div data-historical-reference style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {historicalOverlayScenarios.map(s => (
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
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: s.color, lineHeight: 1 }}>{s.peakDrawdown}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Peak DD (approx.)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#94A3B8', lineHeight: 1 }}>{s.duration}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                </div>
              </div>
            </div>
          </div>
        ))}
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
        eyebrow="Cross-Asset Relationships · Illustrative"
        title="Correlation / Risk Map"
        subtitle="Illustrative layout of how stress can travel between asset classes. Node sizes, edges and links are static, not computed from market data."
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
                {/* No correlation figure: the edge values are static, not measured. */}
              </g>
            );
          })}

          {/* Nodes */}
          {correlationNodes.map(node => {
            const pos = nodePos(node.x, node.y);
            const r = 16; // uniform: node values are static, so size encodes nothing
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
                {/* No stress figure: node values are static, not current readings. */}
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
          { color: 'rgba(255,45,85,0.7)', label: 'Stress channel (dashed, illustrative)', dashed: true },
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
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>Illustrative · static layout, not market data</span>
        </div>
      </div>

      {/* Stress contagion note */}
      <div style={{
        marginTop: '12px', padding: '8px 10px',
        background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.15)',
        borderRadius: '4px',
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF2D55', boxShadow: '0 0 6px rgba(255,45,85,0.8)', flexShrink: 0, marginTop: '3px', animation: 'blink-alert 5s ease-in-out infinite' }} />
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
            <strong style={{ color: '#94A3B8' }}>Illustrative.</strong> The dashed links show the channels (Credit ↔ Liquidity ↔ Bonds ↔ Equities) the Pressure Index watches; they are not a detected or measured contagion reading.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── 5. Institutional Depth Widgets ──────────────────────────
// Bound to the app's existing readings (markets.getGlobalSnapshot + FRED via
// /api/fred) with source and as-of; otherwise Unavailable / Not tracked.
// No fixed values and no modelled sparklines.
function InstitutionalWidgets() {
  const quotesQuery = trpc.markets.getGlobalSnapshot.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const fred = useAppHeaderFred();
  const widgets = useMemo(
    () => buildChartsInstruments({ quotes: quotesQuery.data?.items ?? null, fred, now: Date.now() }),
    [quotesQuery.data, fred],
  );

  return (
    <SectionCard delay={0} accentColor="rgba(0,212,255,0.15)">
      <SectionHeader
        eyebrow="Institutional Depth · Market Readings"
        title="Market Intelligence Ribbon"
        subtitle="Current or delayed readings from the app's market snapshot and FRED, each with its source and as-of time"
        color="#00D4FF"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {widgets.map((w, i) => (
          <div key={w.id} data-charts-instrument={w.id} data-status={w.status} style={{
            background: 'rgba(5,6,8,0.9)', border: `1px solid ${w.color}18`,
            borderRadius: '4px', padding: '10px', position: 'relative', overflow: 'hidden',
            animation: `cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) ${i * 70}ms both`,
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', borderTop: `1px solid ${w.color}30`, borderRight: `1px solid ${w.color}30` }} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>{w.sublabel}</div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#D1D5DB', marginBottom: '4px', lineHeight: 1 }}>{w.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: w.status === 'bound' ? '20px' : '13px', color: w.color, lineHeight: 1 }}>{w.value}</span>
              {w.unit && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>{w.unit}</span>}
              {w.stateLabel && <span style={{ marginLeft: '6px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '2px', padding: '1px 4px' }}>{w.stateLabel}</span>}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', marginTop: '3px', lineHeight: 1.3 }}>{w.basis}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Main Charts Page ────────────────────────────────────────────
export default function Charts() {
  useSEO(PAGE_SEO.charts);
  const { lastUpdated, integrityLabel } = useEngine();
  return (
    <div style={{ minHeight: '100vh', background: '#050608', maxWidth: '800px', margin: '0 auto' }}>
      <PageHeader
        title="Charts"
        subtitle="Canonical Pressure Index and market readings with source and as-of — Unavailable where no feed is connected."
        badge={integrityLabel === 'LIVE' ? 'FRED LIVE' : `FRED ${integrityLabel}`}
        badgeColor={integrityLabel === 'LIVE' ? 'green' : integrityLabel === 'UNAVAILABLE' ? 'gray' : 'amber'}
      />
      <div style={{ padding: '20px 16px 32px' }}>

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
          <strong style={{ color: '#94A3B8' }}>Not financial advice.</strong>{' '}
          Systemic Pressure is the canonical Pressure Index with its as-of time. The Market Intelligence Ribbon shows readings from the app's market snapshot and FRED, each with its source and as-of. Macro cards without a connected feed show Unavailable. The historical episodes and the correlation map are reference and illustrative content, not data. Risk scores are composite models, not guarantees of future outcomes.
        </p>
      </div>
      </div>{/* /padding div */}
    </div>
  );
}
