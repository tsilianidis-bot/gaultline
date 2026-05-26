/* ============================================================
   FAULTLINE — DashboardSearchPanels
   Cinematic stock + crypto search panels for the main dashboard.
   Both panels show a live arc-gauge preview, then gate full
   results behind a "porch" upgrade overlay.
   Aesthetic: Palantir Noir — void black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Style constants ───────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const RAJ  = "'Rajdhani', sans-serif";

// ── Arc Gauge (SVG, cinematic) ────────────────────────────────
function ArcGauge({
  value,       // 0–100
  color,
  label,
  sublabel,
  size = 120,
  blurred = false,
}: {
  value: number;
  color: string;
  label: string;
  sublabel?: string;
  size?: number;
  blurred?: boolean;
}) {
  const [animVal, setAnimVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimVal(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.38;
  // Arc spans 220° (from 160° to 380° = -200° to 20° in SVG coords)
  const startAngle = 160; // degrees
  const totalAngle = 220;
  const endAngle   = startAngle + (animVal / 100) * totalAngle;

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const trackStart = polarToXY(startAngle, r);
  const trackEnd   = polarToXY(startAngle + totalAngle, r);
  const arcStart   = polarToXY(startAngle, r);
  const arcEnd     = polarToXY(endAngle, r);
  const largeArc   = (animVal / 100) * totalAngle > 180 ? 1 : 0;
  const trackLarge = totalAngle > 180 ? 1 : 0;

  // Tick marks
  const ticks = [0, 25, 50, 75, 100].map(pct => {
    const angle = startAngle + (pct / 100) * totalAngle;
    const outer = polarToXY(angle, r + 6);
    const inner = polarToXY(angle, r + 2);
    return { outer, inner, pct };
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Outer glow ring */}
      {!blurred && value > 60 && (
        <div style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${color}18 0%, transparent 70%)`,
          animation: 'pressure-wave 3s ease-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <svg width={size} height={size} style={{ filter: blurred ? 'blur(4px)' : 'none', transition: 'filter 0.3s ease' }}>
        {/* Outer decorative ring */}
        <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        {/* Track */}
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${trackLarge} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
        />
        {/* Value arc */}
        {animVal > 0 && (
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}90)`,
              transition: 'all 1.4s cubic-bezier(0.23,1,0.32,1)',
            }}
          />
        )}
        {/* Tick marks */}
        {ticks.map(({ outer, inner, pct }) => (
          <line key={pct}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke={pct <= animVal ? color : 'rgba(255,255,255,0.08)'}
            strokeWidth="1.5"
            style={{ transition: 'stroke 1.4s ease' }}
          />
        ))}
        {/* Needle dot at arc end */}
        {animVal > 0 && (
          <circle cx={arcEnd.x} cy={arcEnd.y} r="3.5" fill={color}
            style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'all 1.4s cubic-bezier(0.23,1,0.32,1)' }}
          />
        )}
      </svg>
      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingTop: '8px',
        filter: blurred ? 'blur(4px)' : 'none',
        transition: 'filter 0.3s ease',
      }}>
        <span style={{ fontFamily: RAJ, fontWeight: 800, fontSize: size > 100 ? '22px' : '16px', color, lineHeight: 1, textShadow: `0 0 16px ${color}80` }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontFamily: MONO, fontSize: '7px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: '2px' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Signal badge ──────────────────────────────────────────────
function SignalBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: '7px', color, letterSpacing: '0.1em',
      border: `1px solid ${color}40`, borderRadius: '2px', padding: '2px 5px',
      background: `${color}10`, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ── Animated bar ──────────────────────────────────────────────
function AnimBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 400 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${w}%`,
        background: `linear-gradient(90deg, ${color}70, ${color})`,
        boxShadow: `0 0 6px ${color}60`,
        transition: 'width 1.2s cubic-bezier(0.23,1,0.32,1)',
      }} />
    </div>
  );
}

// ── Porch overlay ─────────────────────────────────────────────
function PorchOverlay({ color, onUpgrade, onLogin, isLoggedIn }: {
  color: string;
  onUpgrade: () => void;
  onLogin: () => void;
  isLoggedIn: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'linear-gradient(to bottom, rgba(5,6,10,0) 0%, rgba(5,6,10,0.65) 30%, rgba(5,6,10,0.97) 60%, rgba(5,6,10,1) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      padding: '20px',
      backdropFilter: 'blur(0px)',
    }}>
      <div style={{
        width: '100%', maxWidth: '320px', textAlign: 'center',
        background: 'rgba(8,10,16,0.95)', border: `1px solid ${color}35`,
        borderRadius: '8px', padding: '18px 20px',
        boxShadow: `0 0 40px ${color}15, 0 8px 32px rgba(0,0,0,0.6)`,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: `${color}18`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style={{ fontFamily: RAJ, fontWeight: 700, fontSize: '14px', color: '#E2E8F0', marginBottom: '6px', letterSpacing: '0.04em' }}>
          PRO INTELLIGENCE
        </div>
        <div style={{ fontFamily: SANS, fontSize: '11px', color: '#64748B', lineHeight: 1.55, marginBottom: '14px' }}>
          Full search, live scores, signal breakdowns, and regime context. Upgrade to unlock.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onUpgrade}
            style={{
              width: '100%', padding: '9px 0',
              background: `linear-gradient(135deg, ${color}30, ${color}18)`,
              border: `1px solid ${color}60`, borderRadius: '5px',
              fontFamily: MONO, fontSize: '9px', color, letterSpacing: '0.15em',
              cursor: 'pointer', textTransform: 'uppercase',
              boxShadow: `0 0 16px ${color}20`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 24px ${color}40`; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 16px ${color}20`; e.currentTarget.style.borderColor = `${color}60`; }}
          >
            Upgrade to Pro
          </button>
          {!isLoggedIn && (
            <button
              onClick={onLogin}
              style={{
                width: '100%', padding: '7px 0',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '5px', fontFamily: MONO, fontSize: '9px',
                color: '#64748B', letterSpacing: '0.12em', cursor: 'pointer',
                textTransform: 'uppercase', transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#94A3B8'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#64748B'; }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CRYPTO SEARCH PANEL ───────────────────────────────────────
const CRYPTO_EXAMPLES = ["BTC", "ETH", "SOL", "AVAX", "RNDR", "HYPE"];

const CRYPTO_DEMO: Record<string, {
  name: string; price: string; change: number;
  score: number; riskLevel: string; bias: string;
  momentum: string; signals: string[]; color: string;
}> = {
  BTC:  { name: "Bitcoin",        price: "$97,420", change: +1.84, score: 62, riskLevel: "Elevated", bias: "Bullish",  momentum: "Stable",       signals: ["Macro Sensitive", "Liquidity Fragile"],      color: "#FF9500" },
  ETH:  { name: "Ethereum",       price: "$3,240",  change: +2.31, score: 55, riskLevel: "Moderate", bias: "Bullish",  momentum: "Accelerating", signals: ["Momentum Breakout", "AI Narrative Exposure"], color: "#00D4FF" },
  SOL:  { name: "Solana",         price: "$178",    change: -0.92, score: 71, riskLevel: "High",     bias: "Neutral",  momentum: "Decelerating", signals: ["Speculative Acceleration", "Risk-Off Vulnerable"], color: "#FF2D55" },
  AVAX: { name: "Avalanche",      price: "$38.40",  change: +0.44, score: 58, riskLevel: "Elevated", bias: "Neutral",  momentum: "Stable",       signals: ["Macro Sensitive"],                            color: "#FFD700" },
  RNDR: { name: "Render",         price: "$8.72",   change: +5.12, score: 78, riskLevel: "High",     bias: "Bullish",  momentum: "Accelerating", signals: ["AI Narrative Exposure", "Speculative Acceleration"], color: "#C084FC" },
  HYPE: { name: "Hyperliquid",    price: "$24.15",  change: -2.40, score: 82, riskLevel: "Critical", bias: "Bearish",  momentum: "Reversing",    signals: ["Deleveraging Risk", "Liquidity Fragile"],    color: "#FF2D55" },
};

const RISK_COLORS: Record<string, string> = {
  Low: "#00FF88", Moderate: "#00D4FF", Elevated: "#FFD700", High: "#FF9500", Critical: "#FF2D55",
};
const BIAS_COLORS: Record<string, string> = { Bullish: "#00FF88", Neutral: "#FFD700", Bearish: "#FF2D55" };

export function CryptoPorchPanel() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [active, setActive] = useState("BTC");
  const [hasSearched, setHasSearched] = useState(false);

  const demo = CRYPTO_DEMO[active] ?? CRYPTO_DEMO.BTC;
  const riskColor = RISK_COLORS[demo.riskLevel] ?? "#FFD700";
  const biasColor = BIAS_COLORS[demo.bias] ?? "#FFD700";

  const handleSearch = useCallback(() => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    const match = Object.keys(CRYPTO_DEMO).find(k => k === sym);
    setActive(match ?? "BTC");
    setHasSearched(true);
  }, [input]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  return (
    <div style={{
      background: 'rgba(5,6,10,0.98)', border: '1px solid rgba(0,212,255,0.18)',
      borderLeft: '3px solid rgba(0,212,255,0.5)', borderRadius: '6px',
      position: 'relative', overflow: 'hidden',
      animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 580ms both',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '280px', height: '280px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            fontFamily: MONO, fontSize: '7px', color: '#00D4FF',
            border: '1px solid rgba(0,212,255,0.25)', borderRadius: '2px',
            padding: '2px 6px', background: 'rgba(0,212,255,0.06)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>◈ CRYPTO INTELLIGENCE</div>
          <div style={{
            marginLeft: 'auto', fontFamily: MONO, fontSize: '7px', color: '#FF9500',
            border: '1px solid rgba(255,149,0,0.3)', borderRadius: '2px',
            padding: '2px 6px', background: 'rgba(255,149,0,0.08)',
            letterSpacing: '0.12em',
          }}>PRO</div>
        </div>
        <div style={{ fontFamily: RAJ, fontWeight: 700, fontSize: '17px', color: '#E2E8F0', marginBottom: '4px', letterSpacing: '0.03em' }}>
          Crypto Signal Engine
        </div>
        <div style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', lineHeight: 1.5, marginBottom: '12px' }}>
          Risk score, momentum, and signal bias for any digital asset.
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKey}
              placeholder="BTC · ETH · SOL · RNDR…"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: '4px', color: '#E2E8F0',
                fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 14px', background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.35)', borderRadius: '4px',
              fontFamily: MONO, fontSize: '9px', color: '#00D4FF',
              letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all 0.2s ease', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; }}
          >
            SCAN
          </button>
        </div>

        {/* Quick-select chips */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {CRYPTO_EXAMPLES.map(sym => (
            <button
              key={sym}
              onClick={() => { setActive(sym); setInput(sym); setHasSearched(true); }}
              style={{
                padding: '3px 8px', background: active === sym ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active === sym ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '3px', fontFamily: MONO, fontSize: '8px',
                color: active === sym ? '#00D4FF' : '#475569',
                cursor: 'pointer', letterSpacing: '0.08em',
                transition: 'all 0.15s ease',
              }}
            >{sym}</button>
          ))}
        </div>
      </div>

      {/* Preview result — blurred behind porch */}
      <div style={{ padding: '0 16px 16px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {/* Arc gauge */}
          <ArcGauge
            value={demo.score}
            color={riskColor}
            label={`${demo.score}`}
            sublabel="RISK"
            size={108}
            blurred={true}
          />
          {/* Right side info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: RAJ, fontWeight: 700, fontSize: '20px', color: '#E2E8F0', filter: 'blur(5px)' }}>{active}</span>
              <span style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', filter: 'blur(5px)' }}>{demo.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', filter: 'blur(5px)' }}>
              <SignalBadge label={demo.bias} color={biasColor} />
              <SignalBadge label={`${demo.riskLevel} Risk`} color={riskColor} />
            </div>
            <div style={{ marginBottom: '8px', filter: 'blur(5px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: MONO, fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Signal Score</span>
                <span style={{ fontFamily: MONO, fontSize: '7px', color: riskColor }}>{demo.score}/100</span>
              </div>
              <AnimBar value={demo.score} color={riskColor} />
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', filter: 'blur(5px)' }}>
              {demo.signals.map(s => <SignalBadge key={s} label={s} color="#64748B" />)}
            </div>
            <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '8px', color: '#4B5563', filter: 'blur(5px)' }}>
              Momentum: <span style={{ color: demo.momentum === 'Accelerating' ? '#00FF88' : demo.momentum === 'Reversing' ? '#FF2D55' : '#94A3B8' }}>{demo.momentum}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Porch overlay */}
      <PorchOverlay
        color="#00D4FF"
        isLoggedIn={!!user}
        onUpgrade={() => navigate("/app/account")}
        onLogin={() => { window.location.href = getLoginUrl(); }}
      />
    </div>
  );
}

// ── STOCK SEARCH PANEL ────────────────────────────────────────
const STOCK_EXAMPLES = ["NVDA", "AAPL", "TSLA", "SPY", "XLU", "ARKK"];

const STOCK_DEMO: Record<string, {
  name: string; price: string; change: number;
  score: number; action: string; confidence: number;
  signals: string[]; regime: string; color: string;
}> = {
  NVDA: { name: "NVIDIA Corp",       price: "$924",  change: +3.42, score: 84, action: "BUY",   confidence: 84, signals: ["Momentum Breakout", "AI Bubble Exposure"],  regime: "Aligned",       color: "#00D4FF" },
  AAPL: { name: "Apple Inc",         price: "$211",  change: +0.88, score: 61, action: "HOLD",  confidence: 61, signals: ["Macro Beneficiary", "Neutral / Watch"],      regime: "Neutral",       color: "#FFD700" },
  TSLA: { name: "Tesla Inc",         price: "$248",  change: -1.44, score: 72, action: "WATCH", confidence: 58, signals: ["Liquidity Sensitive", "Macro Vulnerable"],   regime: "Counter-Trend", color: "#FF9500" },
  SPY:  { name: "S&P 500 ETF",       price: "$527",  change: +0.61, score: 55, action: "HOLD",  confidence: 65, signals: ["Macro Beneficiary"],                         regime: "Neutral",       color: "#00FF88" },
  XLU:  { name: "Utilities SPDR",    price: "$68",   change: +0.71, score: 48, action: "WATCH", confidence: 61, signals: ["Recession Defensive", "Macro Beneficiary"],  regime: "Neutral",       color: "#94A3B8" },
  ARKK: { name: "ARK Innovation ETF",price: "$48",   change: -1.87, score: 77, action: "SELL",  confidence: 77, signals: ["Liquidity Sensitive", "Macro Vulnerable"],   regime: "Counter-Trend", color: "#FF2D55" },
};

const ACTION_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  BUY:   { text: "#00D4FF", border: "rgba(0,212,255,0.4)",  bg: "rgba(0,212,255,0.12)"  },
  SELL:  { text: "#FF2D55", border: "rgba(255,45,85,0.4)",  bg: "rgba(255,45,85,0.12)"  },
  HOLD:  { text: "#FFD700", border: "rgba(255,215,0,0.35)", bg: "rgba(255,215,0,0.10)"  },
  WATCH: { text: "#94A3B8", border: "rgba(148,163,184,0.3)", bg: "rgba(148,163,184,0.08)" },
};

const REGIME_COLORS: Record<string, string> = {
  "Aligned": "#00D4FF", "Neutral": "#FFD700", "Counter-Trend": "#FF2D55",
};

export function StockPorchPanel() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [active, setActive] = useState("NVDA");

  const demo = STOCK_DEMO[active] ?? STOCK_DEMO.NVDA;
  const actionStyle = ACTION_COLORS[demo.action] ?? ACTION_COLORS.HOLD;
  const regimeColor = REGIME_COLORS[demo.regime] ?? "#FFD700";

  const handleSearch = useCallback(() => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    const match = Object.keys(STOCK_DEMO).find(k => k === sym);
    setActive(match ?? "NVDA");
  }, [input]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  return (
    <div style={{
      background: 'rgba(5,6,10,0.98)', border: '1px solid rgba(255,149,0,0.18)',
      borderLeft: '3px solid rgba(255,149,0,0.5)', borderRadius: '6px',
      position: 'relative', overflow: 'hidden',
      animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 640ms both',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '280px', height: '280px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(255,149,0,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            fontFamily: MONO, fontSize: '7px', color: '#FF9500',
            border: '1px solid rgba(255,149,0,0.25)', borderRadius: '2px',
            padding: '2px 6px', background: 'rgba(255,149,0,0.06)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>◆ STOCK INTELLIGENCE</div>
          <div style={{
            marginLeft: 'auto', fontFamily: MONO, fontSize: '7px', color: '#FF9500',
            border: '1px solid rgba(255,149,0,0.3)', borderRadius: '2px',
            padding: '2px 6px', background: 'rgba(255,149,0,0.08)',
            letterSpacing: '0.12em',
          }}>PRO</div>
        </div>
        <div style={{ fontFamily: RAJ, fontWeight: 700, fontSize: '17px', color: '#E2E8F0', marginBottom: '4px', letterSpacing: '0.03em' }}>
          Stock Signal Engine
        </div>
        <div style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', lineHeight: 1.5, marginBottom: '12px' }}>
          BUY / HOLD / SELL signals with macro regime alignment and confidence score.
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKey}
              placeholder="NVDA · AAPL · TSLA · SPY…"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,149,0,0.2)',
                borderRadius: '4px', color: '#E2E8F0',
                fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,149,0,0.5)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,149,0,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,149,0,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 14px', background: 'rgba(255,149,0,0.12)',
              border: '1px solid rgba(255,149,0,0.35)', borderRadius: '4px',
              fontFamily: MONO, fontSize: '9px', color: '#FF9500',
              letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all 0.2s ease', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,149,0,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,149,0,0.12)'; }}
          >
            SCAN
          </button>
        </div>

        {/* Quick-select chips */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {STOCK_EXAMPLES.map(sym => (
            <button
              key={sym}
              onClick={() => { setActive(sym); setInput(sym); }}
              style={{
                padding: '3px 8px', background: active === sym ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active === sym ? 'rgba(255,149,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '3px', fontFamily: MONO, fontSize: '8px',
                color: active === sym ? '#FF9500' : '#475569',
                cursor: 'pointer', letterSpacing: '0.08em',
                transition: 'all 0.15s ease',
              }}
            >{sym}</button>
          ))}
        </div>
      </div>

      {/* Preview result — blurred behind porch */}
      <div style={{ padding: '0 16px 16px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {/* Arc gauge */}
          <ArcGauge
            value={demo.confidence}
            color={actionStyle.text}
            label={demo.action}
            sublabel={`${demo.confidence}% CONF`}
            size={108}
            blurred={true}
          />
          {/* Right side info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: RAJ, fontWeight: 700, fontSize: '20px', color: '#E2E8F0', filter: 'blur(5px)' }}>{active}</span>
              <span style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', filter: 'blur(5px)' }}>{demo.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', filter: 'blur(5px)' }}>
              <span style={{
                fontFamily: MONO, fontSize: '8px', letterSpacing: '0.12em',
                color: actionStyle.text, border: `1px solid ${actionStyle.border}`,
                borderRadius: '3px', padding: '3px 8px', background: actionStyle.bg,
                textTransform: 'uppercase', fontWeight: 700,
                boxShadow: `0 0 10px ${actionStyle.text}30`,
              }}>{demo.action}</span>
              <span style={{
                fontFamily: MONO, fontSize: '7px', color: regimeColor,
                border: `1px solid ${regimeColor}40`, borderRadius: '2px',
                padding: '2px 6px', background: `${regimeColor}10`,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>{demo.regime}</span>
            </div>
            <div style={{ marginBottom: '8px', filter: 'blur(5px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: MONO, fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confidence</span>
                <span style={{ fontFamily: MONO, fontSize: '7px', color: actionStyle.text }}>{demo.confidence}%</span>
              </div>
              <AnimBar value={demo.confidence} color={actionStyle.text} />
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', filter: 'blur(5px)' }}>
              {demo.signals.map(s => <SignalBadge key={s} label={s} color="#64748B" />)}
            </div>
            <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '8px', color: '#4B5563', filter: 'blur(5px)' }}>
              Price: <span style={{ color: '#94A3B8' }}>{demo.price}</span>
              <span style={{ marginLeft: '8px', color: demo.change >= 0 ? '#00FF88' : '#FF2D55' }}>
                {demo.change >= 0 ? '+' : ''}{demo.change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Porch overlay */}
      <PorchOverlay
        color="#FF9500"
        isLoggedIn={!!user}
        onUpgrade={() => navigate("/app/account")}
        onLogin={() => { window.location.href = getLoginUrl(); }}
      />
    </div>
  );
}
