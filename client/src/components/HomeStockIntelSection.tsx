/* ============================================================
   FAULTLINE — Home: Real-Time Market & Stock Intelligence Section
   Cinematic institutional preview of the Signals engine.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';

// ── Static demo data (no API calls — pure teaser) ─────────────
const DEMO_STOCKS = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 924.58,
    change: +3.42,
    cap: 'Mega',
    action: 'BUY' as const,
    confidence: 84,
    signals: ['Momentum Breakout', 'AI Bubble Exposure'],
    bullFactors: ['Dominant AI inference share', 'Data-center backlog expanding', 'Margin expansion cycle'],
    bearFactors: ['Elevated valuation vs. peers', 'Concentration risk in AI spend'],
    regime: 'Aligned',
  },
  {
    ticker: 'XLU',
    name: 'Utilities Select SPDR',
    price: 68.14,
    change: +0.71,
    cap: 'ETF',
    action: 'WATCH' as const,
    confidence: 61,
    signals: ['Recession Defensive', 'Macro Beneficiary'],
    bullFactors: ['Rate-cut tailwind building', 'Defensive rotation flows', 'Dividend yield premium'],
    bearFactors: ['Underperforms in risk-on regimes', 'Rate sensitivity if cuts delayed'],
    regime: 'Neutral',
  },
  {
    ticker: 'ARKK',
    name: 'ARK Innovation ETF',
    price: 48.22,
    change: -1.87,
    cap: 'ETF',
    action: 'SELL' as const,
    confidence: 77,
    signals: ['Liquidity Sensitive', 'Macro Vulnerable'],
    bullFactors: ['High beta in risk-on rallies'],
    bearFactors: ['Liquidity deterioration', 'Rate-sensitive duration risk', 'Speculative excess unwinding'],
    regime: 'Counter-Trend',
  },
];

const SIGNAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Momentum Breakout':   { bg: 'rgba(0,212,255,0.10)',  text: '#00D4FF', border: 'rgba(0,212,255,0.25)' },
  'AI Bubble Exposure':  { bg: 'rgba(255,149,0,0.10)',  text: '#FF9500', border: 'rgba(255,149,0,0.25)' },
  'Macro Beneficiary':   { bg: 'rgba(0,255,136,0.08)',  text: '#00FF88', border: 'rgba(0,255,136,0.20)' },
  'Macro Vulnerable':    { bg: 'rgba(255,45,85,0.10)',  text: '#FF2D55', border: 'rgba(255,45,85,0.25)' },
  'Liquidity Sensitive': { bg: 'rgba(255,215,0,0.08)',  text: '#FFD700', border: 'rgba(255,215,0,0.20)' },
  'Recession Defensive': { bg: 'rgba(100,116,139,0.10)', text: '#94A3B8', border: 'rgba(100,116,139,0.25)' },
  'Neutral / Watch':     { bg: 'rgba(100,116,139,0.07)', text: '#64748B', border: 'rgba(100,116,139,0.18)' },
};

const ACTION_COLORS = {
  BUY:   { bg: 'rgba(0,212,255,0.14)',  text: '#00D4FF', border: 'rgba(0,212,255,0.35)', glow: 'rgba(0,212,255,0.45)' },
  SELL:  { bg: 'rgba(255,45,85,0.14)',  text: '#FF2D55', border: 'rgba(255,45,85,0.35)',  glow: 'rgba(255,45,85,0.45)' },
  HOLD:  { bg: 'rgba(255,215,0,0.10)',  text: '#FFD700', border: 'rgba(255,215,0,0.30)',  glow: 'rgba(255,215,0,0.35)' },
  WATCH: { bg: 'rgba(100,116,139,0.10)', text: '#94A3B8', border: 'rgba(100,116,139,0.25)', glow: 'rgba(100,116,139,0.25)' },
};

const REGIME_ALIGN_COLORS = {
  'Aligned':       '#00D4FF',
  'Neutral':       '#FFD700',
  'Counter-Trend': '#FF2D55',
};

// ── Macro Environment Panel data ──────────────────────────────
const MACRO_METRICS = [
  { label: 'Bull Probability',   value: 62,  unit: '%', color: '#00FF88', bar: true },
  { label: 'Crash Probability',  value: 28,  unit: '%', color: '#FF2D55', bar: true },
  { label: 'Treasury Stress',    value: 'ELEVATED', unit: '', color: '#FF9500', bar: false },
  { label: 'Volatility Regime',  value: 'SUPPRESSED', unit: '', color: '#FFD700', bar: false },
  { label: 'Liquidity Conditions', value: 'TIGHTENING', unit: '', color: '#FF9500', bar: false },
  { label: 'AI Concentration',   value: 74,  unit: '%', color: '#00D4FF', bar: true },
];

// ── Animated confidence bar ───────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 500); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{
        height: '100%', width: `${w}%`,
        background: `linear-gradient(90deg, ${color}80, ${color})`,
        boxShadow: `0 0 6px ${color}60`,
        borderRadius: '2px',
        transition: 'width 1s cubic-bezier(0.23,1,0.32,1)',
      }} />
    </div>
  );
}

// ── Fake ticker search visual ─────────────────────────────────
function SearchBarTeaser() {
  const [typed, setTyped] = useState('');
  const DEMO_QUERY = 'AAPL';
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(DEMO_QUERY.slice(0, i));
      if (i >= DEMO_QUERY.length) clearInterval(iv);
    }, 180);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 14px',
      background: 'rgba(8,10,14,0.95)',
      border: '1px solid rgba(0,212,255,0.25)',
      borderRadius: '4px',
      boxShadow: '0 0 20px rgba(0,212,255,0.08)',
      marginBottom: '14px',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '12px', color: '#F0F4FF', letterSpacing: '0.1em', flex: 1,
      }}>
        {typed}<span style={{ borderRight: '1px solid #00D4FF', animation: 'blink-alert 1s step-end infinite', marginLeft: '1px' }}>&nbsp;</span>
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '12px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.12em',
      }}>SEARCH ANY TICKER</span>
    </div>
  );
}

// ── Stock Intelligence Card ───────────────────────────────────
function StockCard({ stock, delay }: { stock: typeof DEMO_STOCKS[0]; delay: number }) {
  const [visible, setVisible] = useState(false);
  const ac = ACTION_COLORS[stock.action];
  const rc = REGIME_ALIGN_COLORS[stock.regime as keyof typeof REGIME_ALIGN_COLORS];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      background: 'rgba(8,10,14,0.92)',
      border: `1px solid ${ac.border}`,
      borderRadius: '4px',
      padding: '14px',
      position: 'relative',
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.23,1,0.32,1)',
    }}>
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${ac.text}80, ${ac.text}20)`,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '17px', color: '#F0F4FF', letterSpacing: '0.05em' }}>{stock.ticker}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.6)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.1em' }}>{stock.cap}</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.04em' }}>{stock.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '15px', color: '#F0F4FF' }}>${stock.price.toFixed(2)}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: stock.change >= 0 ? '#00FF88' : '#FF2D55', letterSpacing: '0.06em' }}>
            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Action badge + regime alignment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', borderRadius: '2px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
          background: ac.bg, color: ac.text, border: `1px solid ${ac.border}`,
          boxShadow: `0 0 8px ${ac.glow}`,
        }}>
          {stock.action === 'BUY' && '▲ '}
          {stock.action === 'SELL' && '▼ '}
  {(stock.action as string) === 'HOLD' && '◆ '}
        {stock.action === 'WATCH' && '◎ '}
          {stock.action}
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
          color: rc, padding: '2px 6px',
          background: `${rc}10`, border: `1px solid ${rc}25`, borderRadius: '2px',
          letterSpacing: '0.08em',
        }}>
          {stock.regime === 'Counter-Trend' ? 'COUNTER' : stock.regime.toUpperCase()}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.08em' }}>CONFIDENCE</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: ac.text, fontWeight: 700 }}>{stock.confidence}%</span>
          </div>
          <ConfBar value={stock.confidence} color={ac.text} />
        </div>
      </div>

      {/* Signal labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
        {stock.signals.map(sig => {
          const sc = SIGNAL_COLORS[sig] ?? SIGNAL_COLORS['Neutral / Watch'];
          return (
            <span key={sig} style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: '2px',
              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            }}>{sig}</span>
          );
        })}
      </div>

      {/* Bull / Bear factors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#00FF88', letterSpacing: '0.1em', marginBottom: '4px' }}>▲ BULLISH</div>
          {stock.bullFactors.map(f => (
            <div key={f} style={{ display: 'flex', gap: '5px', marginBottom: '3px' }}>
              <span style={{ color: '#00FF88', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>›</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#FF2D55', letterSpacing: '0.1em', marginBottom: '4px' }}>▼ BEARISH</div>
          {stock.bearFactors.map(f => (
            <div key={f} style={{ display: 'flex', gap: '5px', marginBottom: '3px' }}>
              <span style={{ color: '#FF2D55', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>›</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(148,163,184,0.7)', lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Macro Environment Panel ───────────────────────────────────
function MacroEnvPanel() {
  return (
    <div style={{
      background: 'rgba(8,10,14,0.92)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      padding: '14px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.8)', animation: 'blink-alert 2s ease-in-out infinite' }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Macro Regime Context</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {MACRO_METRICS.map(m => (
          <div key={m.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.08em' }}>{m.label.toUpperCase()}</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '12px', color: m.color }}>
                {typeof m.value === 'number' ? `${m.value}${m.unit}` : m.value}
              </span>
            </div>
            {m.bar && typeof m.value === 'number' && <ConfBar value={m.value} color={m.color} />}
            {!m.bar && (
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: `${m.color}30`, borderRadius: '2px' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Momentum Classification Legend ───────────────────────────
const MOMENTUM_CLASSES = [
  { label: 'Momentum Breakout',   color: '#00D4FF', desc: 'Price + volume surge above regime threshold' },
  { label: 'AI Bubble Exposure',  color: '#FF9500', desc: 'Elevated correlation to speculative AI cycle' },
  { label: 'Macro Beneficiary',   color: '#00FF88', desc: 'Positively aligned with current macro regime' },
  { label: 'Macro Vulnerable',    color: '#FF2D55', desc: 'Structurally exposed to macro headwinds' },
  { label: 'Liquidity Sensitive', color: '#FFD700', desc: 'Performance tied to funding & credit conditions' },
  { label: 'Recession Defensive', color: '#94A3B8', desc: 'Historically resilient in contraction cycles' },
  { label: 'Neutral / Watch',     color: '#64748B', desc: 'No dominant signal — monitor for regime shift' },
];

// ── Main Section ──────────────────────────────────────────────
export default function HomeStockIntelSection() {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{
      padding: '0 0 4px',
      borderTop: '1px solid rgba(0,212,255,0.08)',
      marginTop: '10px',
      position: 'relative',
    }}>
      {/* Section header */}
      <div style={{
        padding: '20px 16px 16px',
        background: 'linear-gradient(180deg, rgba(0,212,255,0.04) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        marginBottom: '14px',
      }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3))' }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
            color: '#00D4FF', letterSpacing: '0.2em', textTransform: 'uppercase',
            padding: '3px 10px', background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)', borderRadius: '2px',
          }}>Stock Intelligence Engine</span>
          <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(0,212,255,0.3), transparent)' }} />
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 800,
          fontSize: 'clamp(20px, 5vw, 28px)', color: '#F0F4FF',
          letterSpacing: '0.03em', lineHeight: 1.1,
          margin: '0 0 8px', textAlign: 'center',
        }}>
          Real-Time Market &amp; Stock Intelligence
        </h2>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
          color: 'rgba(148,163,184,0.7)', lineHeight: 1.7,
          textAlign: 'center', margin: '0 auto 14px', maxWidth: '520px',
          letterSpacing: '0.02em',
        }}>
          FAULTLINE combines live market data, momentum analysis, volatility conditions, liquidity trends,
          and macroeconomic intelligence to classify stocks within the broader market environment.
        </p>

        {/* Two-column capability pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxWidth: '480px', margin: '0 auto' }}>
          {[
            ['Broader Market Conditions', '#00D4FF'],
            ['Individual Stock Opportunities', '#00FF88'],
            ['Momentum Classification', '#FFD700'],
            ['Macro Regime Alignment', '#FF9500'],
            ['Volatility & Liquidity Signals', '#FF2D55'],
            ['AI Concentration Exposure', '#00D4FF'],
          ].map(([label, c]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 8px',
              background: `${c}08`,
              border: `1px solid ${c}18`,
              borderRadius: '3px',
            }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: c as string, flexShrink: 0 }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(148,163,184,0.8)', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: '0 16px' }}>

        {/* Ticker search teaser */}
        <SearchBarTeaser />

        {/* Macro environment panel */}
        <MacroEnvPanel />

        {/* Signal classification legend */}
        <div style={{
          background: 'rgba(8,10,14,0.85)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '4px',
          padding: '12px 14px',
          marginBottom: '14px',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>Signal Classification System</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {MOMENTUM_CLASSES.map(mc => (
              <div key={mc.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: '2px', flexShrink: 0,
                  background: `${mc.color}10`, color: mc.color, border: `1px solid ${mc.color}25`,
                }}>{mc.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(100,116,139,0.55)', lineHeight: 1.5, paddingTop: '2px' }}>{mc.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock intelligence cards */}
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
          Live Signal Preview — 3 of 500+ Monitored Assets
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {DEMO_STOCKS.map((s, i) => (
            <StockCard key={s.ticker} stock={s} delay={i * 150} />
          ))}
        </div>

        {/* Lock overlay teaser */}
        <div style={{
          position: 'relative',
          background: 'rgba(8,10,14,0.92)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '4px',
          padding: '18px 14px',
          marginBottom: '16px',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          {/* Blurred ghost rows */}
          <div style={{ filter: 'blur(4px)', opacity: 0.3, pointerEvents: 'none', marginBottom: '14px' }}>
            {['MSFT', 'TSLA', 'GLD', 'TLT', 'SPY'].map(t => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: '#F0F4FF' }}>{t}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#00D4FF' }}>████ ██%</span>
              </div>
            ))}
          </div>
          {/* Lock overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,6,8,0.75)', backdropFilter: 'blur(2px)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', opacity: 0.8 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#00D4FF', letterSpacing: '0.15em', marginBottom: '4px' }}>495+ MORE ASSETS LOCKED</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.08em' }}>Full screener available on Core, Pro &amp; Founding</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(0,212,255,0.02) 100%)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '4px',
          padding: '18px 16px',
          textAlign: 'center',
          marginBottom: '4px',
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Full Intelligence · 500+ Signals · Live Data
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: '#F0F4FF', marginBottom: '12px', letterSpacing: '0.03em' }}>
            Unlock the complete stock intelligence engine
          </div>
          {isAuthenticated ? (
            <Link href="/signals">
              <button style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
                fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '10px 28px', borderRadius: '3px', cursor: 'pointer',
                background: 'rgba(0,212,255,0.15)', color: '#00D4FF',
                border: '1px solid rgba(0,212,255,0.4)',
                boxShadow: '0 0 20px rgba(0,212,255,0.2)',
                transition: 'all 0.2s ease',
              }}>
                Open Signals Terminal →
              </button>
            </Link>
          ) : (
            <a href={getLoginUrl()} style={{ textDecoration: 'none' }}>
              <button style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
                fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '10px 28px', borderRadius: '3px', cursor: 'pointer',
                background: 'rgba(0,212,255,0.15)', color: '#00D4FF',
                border: '1px solid rgba(0,212,255,0.4)',
                boxShadow: '0 0 20px rgba(0,212,255,0.2)',
                transition: 'all 0.2s ease',
              }}>
                Unlock Core Access →
              </button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
