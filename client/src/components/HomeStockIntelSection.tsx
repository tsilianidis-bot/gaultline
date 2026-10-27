/* ============================================================
   FAULTLINE — Home: Real-Time Market & Stock Intelligence Section
   Cinematic institutional preview of the Signals engine.
   ============================================================ */
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { PentagonalThesisNarrative } from '@/components/PentagonalThesisNarrative';

// ── Macro Environment Panel data ──────────────────────────────
const MACRO_METRICS = [
  { label: 'Scenario Context', value: 'DERIVED', unit: '', color: '#00D4FF', bar: false },
  { label: 'Forecast Horizon', value: 'NOT SET', unit: '', color: '#94A3B8', bar: false },
  { label: 'Source Quality', value: 'DISCLOSED', unit: '', color: '#00FF88', bar: false },
  { label: 'Historical Evidence', value: 'RESEARCH', unit: '', color: '#FFD700', bar: false },
  { label: 'Static Inputs', value: 'QUALIFIED', unit: '', color: '#FF9500', bar: false },
  { label: 'Analog Use', value: 'CONTEXT ONLY', unit: '', color: '#00D4FF', bar: false },
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
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.8)', animation: 'blink-alert 6s ease-in-out infinite' }} />
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
          Shared stock thesis
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {["NVDA", "XLU", "ARKK"].map(symbol => (
            <PentagonalThesisNarrative key={symbol} symbol={symbol} surface="ai-stock-intelligence" compact />
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
