/* ============================================================
   FAULTLINE — Product Experience Gate
   Shown once to first-time visitors after the CinematicIntro
   and before the ASHA onboarding / CinematicAuthGate.

   Sections:
   1. Hero — full-viewport atmospheric opener
   2. The Problem — what traditional tools miss
   3. Pressure Index™ — animated gauge + explanation
   4. Feature Showcase — 10 capability cards
   5. Platform Flow — how the 5 questions work
   6. Who It's For — 3 investor personas
   7. Pricing — tier cards with CTA
   8. Final CTA — "Enter FAULTLINE"
   ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getLoginUrl } from '../const';

// ── Assets (reuse from MarketingSite) ─────────────────────────
const ASSETS = {
  heroBg:          '/manus-storage/faultline_hero_bg_7d6aaf14.jpg',
  dashboardMockup: '/manus-storage/faultline_dashboard_mockup_456bb973.jpg',
  macroIntel:      '/manus-storage/faultline_macro_intel_09b4c85d.jpg',
  riskEngine:      '/manus-storage/faultline_risk_engine_fd070c61.jpg',
  ctaAtmosphere:   '/manus-storage/faultline_cta_atmosphere_93bd4048.jpg',
};

const CYAN   = '#00E5FF';
const GOLD   = '#FFAA00';
const GREEN  = '#00FF88';
const PURPLE = '#A78BFA';
const RED    = '#FF3B30';
const MONO   = "'IBM Plex Mono', 'Courier New', monospace";
const SANS   = "'IBM Plex Sans', system-ui, sans-serif";

// ── Intersection-observer fade-in hook ────────────────────────
function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Animated pressure gauge ────────────────────────────────────
function PressureGauge({ value = 62 }: { value?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const { ref, visible } = useFadeIn(0.3);
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const total = 90;
    const tick = () => {
      frame++;
      setDisplayed(Math.round((value * frame) / total));
      if (frame < total) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, value]);

  const radius = 80;
  const circ   = 2 * Math.PI * radius;
  const pct    = displayed / 100;
  const dash   = circ * pct;
  const color  = displayed < 30 ? GREEN : displayed < 60 ? GOLD : displayed < 80 ? '#FF8C00' : RED;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {/* Track */}
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {/* Arc */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: 'stroke 0.3s ease', filter: `drop-shadow(0 0 8px ${color})` }}
        />
        {/* Value */}
        <text x="100" y="96" textAnchor="middle" fill={color}
          style={{ fontFamily: MONO, fontSize: '36px', fontWeight: 700 }}>
          {displayed}
        </text>
        <text x="100" y="118" textAnchor="middle" fill="rgba(255,255,255,0.4)"
          style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.15em' }}>
          / 100
        </text>
        <text x="100" y="140" textAnchor="middle" fill="rgba(255,255,255,0.25)"
          style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.2em' }}>
          PRESSURE INDEX™
        </text>
      </svg>
      <div style={{ fontFamily: MONO, fontSize: '11px', color, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {displayed < 30 ? 'LOW STRESS' : displayed < 60 ? 'MODERATE STRESS' : displayed < 80 ? 'ELEVATED STRESS' : 'CRITICAL STRESS'}
      </div>
    </div>
  );
}

// ── Feature card ───────────────────────────────────────────────
interface FeatureCardProps {
  icon: string; title: string; description: string; accent: string; delay: number;
}
function FeatureCard({ icon, title, description, accent, delay }: FeatureCardProps) {
  const { ref, visible } = useFadeIn(0.1);
  return (
    <div ref={ref} style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: '12px',
      padding: '24px',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>{icon}</div>
      <div style={{
        fontFamily: MONO, fontSize: '11px', color: accent,
        letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px',
      }}>{title}</div>
      <div style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
        {description}
      </div>
    </div>
  );
}

// ── Persona card ───────────────────────────────────────────────
function PersonaCard({ emoji, title, subtitle, bullets, accent }: {
  emoji: string; title: string; subtitle: string; bullets: string[]; accent: string;
}) {
  const { ref, visible } = useFadeIn(0.1);
  return (
    <div ref={ref} style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${accent}22`,
      borderRadius: '16px',
      padding: '32px 28px',
      transition: 'opacity 0.6s ease, transform 0.6s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>{emoji}</div>
      <div style={{ fontFamily: MONO, fontSize: '13px', color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>{subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accent, flexShrink: 0, marginTop: '7px' }} />
            <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pricing card ───────────────────────────────────────────────
function PricingCard({ name, price, interval, description, features, accent, highlight, onCta, ctaLabel }: {
  name: string; price: string; interval: string; description: string;
  features: string[]; accent: string; highlight?: boolean;
  onCta: () => void; ctaLabel: string;
}) {
  const { ref, visible } = useFadeIn(0.1);
  return (
    <div ref={ref} style={{
      background: highlight ? `rgba(${accent === CYAN ? '0,229,255' : accent === GOLD ? '255,170,0' : '0,255,136'},0.05)` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${highlight ? accent + '40' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '16px',
      padding: '32px 28px',
      position: 'relative',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
          background: accent, color: '#000', fontFamily: MONO, fontSize: '10px',
          letterSpacing: '0.15em', padding: '4px 14px', borderRadius: '20px', fontWeight: 700,
        }}>MOST POPULAR</div>
      )}
      <div style={{ fontFamily: MONO, fontSize: '12px', color: accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontFamily: MONO, fontSize: '32px', color: '#F0F4FF', fontWeight: 700 }}>{price}</span>
        <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>/{interval}</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px', lineHeight: 1.5 }}>{description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: accent, flexShrink: 0, marginTop: '2px' }}>✓</span>
            <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>
      <button onClick={onCta} style={{
        width: '100%', padding: '14px',
        background: highlight ? accent : 'transparent',
        border: `1px solid ${accent}`,
        borderRadius: '8px',
        color: highlight ? '#000' : accent,
        fontFamily: MONO, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
        cursor: 'pointer', fontWeight: 700,
        transition: 'all 0.15s ease-out',
      }}>{ctaLabel}</button>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────
function SectionLabel({ text, color = CYAN }: { text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ width: '24px', height: '1px', background: color }} />
      <span style={{ fontFamily: MONO, fontSize: '10px', color, letterSpacing: '0.25em', textTransform: 'uppercase' }}>{text}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
interface ProductExperienceProps {
  onEnter: () => void;
}

export default function ProductExperience({ onEnter }: ProductExperienceProps) {
  const [scrollY, setScrollY] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Entrance animation
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollY(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleEnter = useCallback(() => {
    onEnter();
  }, [onEnter]);

  const handleLogin = useCallback(() => {
    window.location.href = getLoginUrl();
  }, []);

  const FEATURES = [
    { icon: '📡', title: 'Pressure Index™', description: 'A composite systemic stress score built from credit spreads, volatility, liquidity, and macro positioning. Not sentiment — measurement.', accent: CYAN },
    { icon: '🎯', title: 'Bull vs. Crash Probability', description: 'Real-time probability distribution across five market regimes: Bull, Soft Landing, Stagflation, Recession, and Crash.', accent: GREEN },
    { icon: '🔍', title: 'Market Regime Detection', description: 'Identifies the current macro regime and how long it has been developing — context that changes how every signal should be read.', accent: GOLD },
    { icon: '📚', title: 'Historical Analog Engine', description: 'Matches current conditions against every comparable historical period to show what typically happened next.', accent: PURPLE },
    { icon: '🤖', title: 'AI Market Intelligence', description: 'ASHA synthesizes all platform data into a personalized Oracle Briefing — your institutional-grade market strategist, available 24/7.', accent: CYAN },
    { icon: '🔔', title: 'Signals & Alerts', description: 'Screener-grade signal detection across equities, crypto, and macro instruments with configurable alert thresholds.', accent: GREEN },
    { icon: '💼', title: 'Portfolio Intelligence', description: 'Analyze your portfolio against current macro conditions. Understand how your positions are exposed to each risk regime.', accent: GOLD },
    { icon: '📋', title: 'Daily Briefings', description: 'Structured daily intelligence reports covering market state, key drivers, and what to watch — delivered before markets open.', accent: PURPLE },
    { icon: '🗺️', title: 'Scenario Analysis', description: 'Model multiple macro scenarios and understand the probability-weighted outcomes for your positions and watchlist.', accent: CYAN },
    { icon: '🏛️', title: 'Institutional Research Tools', description: 'Macro driver analysis, transmission mechanism mapping, positioning data, and evidence-based methodology — all in one platform.', accent: GREEN },
  ];

  const PERSONAS = [
    {
      emoji: '📈',
      title: 'Active Trader',
      subtitle: 'Needs to know the macro context before every trade.',
      accent: CYAN,
      bullets: [
        'Understand whether the macro backdrop supports or contradicts your setup',
        'See real-time pressure readings before entering positions',
        'Get AI-synthesized briefings that explain what is driving the market today',
        'Access day trade intelligence calibrated to current regime conditions',
      ],
    },
    {
      emoji: '🌍',
      title: 'Macro Investor',
      subtitle: 'Manages multi-asset portfolios across economic cycles.',
      accent: GOLD,
      bullets: [
        'Track systemic pressure across credit, volatility, and liquidity simultaneously',
        'Identify regime transitions before they become consensus',
        'Compare current conditions against historical analogs with matching outcomes',
        'Model scenario probabilities for portfolio positioning decisions',
      ],
    },
    {
      emoji: '🏛️',
      title: 'Institutional Analyst',
      subtitle: 'Requires evidence-based research with transparent methodology.',
      accent: PURPLE,
      bullets: [
        'Access the full macro driver transmission chain with source citations',
        'Review historical track record and methodology documentation',
        'Export structured briefings and research for team distribution',
        'Validate signals against the platform\'s evidence and data sources',
      ],
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050810',
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ── Sticky nav ─────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        background: scrollY > 60 ? 'rgba(5,8,16,0.95)' : 'transparent',
        backdropFilter: scrollY > 60 ? 'blur(12px)' : 'none',
        borderBottom: scrollY > 60 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        <div style={{ fontFamily: MONO, fontSize: '14px', letterSpacing: '0.2em', color: '#F0F4FF' }}>
          <span style={{ color: CYAN }}>FAULT</span>LINE
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={handleLogin} style={{
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '8px 16px',
          }}>Sign In</button>
          <button onClick={handleEnter} style={{
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
            padding: '10px 20px', borderRadius: '6px', fontWeight: 700,
            transition: 'all 0.15s ease-out',
          }}>Enter Platform</button>
        </div>
      </nav>

      {/* ── Section 1: Hero ────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px',
        position: 'relative',
        backgroundImage: `url(${ASSETS.heroBg})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}>
        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,8,16,0.7) 0%, rgba(5,8,16,0.5) 50%, rgba(5,8,16,0.9) 100%)' }} />

        <div style={{
          position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '800px',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 1s cubic-bezier(0.23,1,0.32,1), transform 1s cubic-bezier(0.23,1,0.32,1)',
        }}>
          <div style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '24px' }}>
            ◆ SYSTEMIC RISK INTELLIGENCE
          </div>
          <h1 style={{
            fontFamily: MONO, fontSize: 'clamp(40px, 8vw, 80px)',
            fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.1,
            color: '#F0F4FF', margin: '0 0 24px',
          }}>
            <span style={{ color: CYAN }}>FAULT</span>LINE
          </h1>
          <p style={{
            fontFamily: SANS, fontSize: 'clamp(16px, 2.5vw, 22px)',
            color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
            maxWidth: '600px', margin: '0 auto 16px',
          }}>
            See what builds beneath the surface before markets move.
          </p>
          <p style={{
            fontFamily: SANS, fontSize: 'clamp(13px, 1.8vw, 16px)',
            color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
            maxWidth: '520px', margin: '0 auto 48px',
          }}>
            Institutional-grade macroeconomic intelligence for active traders, macro investors, and anyone who needs to understand why markets move — not just that they did.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleEnter} style={{
              fontFamily: MONO, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
              padding: '16px 36px', borderRadius: '8px', fontWeight: 700,
              boxShadow: `0 0 24px ${CYAN}40`,
              transition: 'all 0.15s ease-out',
            }}>Enter FAULTLINE →</button>
            <a href="#features" style={{
              fontFamily: MONO, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', padding: '16px 36px', borderRadius: '8px',
              textDecoration: 'none',
              transition: 'all 0.15s ease-out',
            }}>See the Platform ↓</a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          opacity: heroVisible ? 0.4 : 0, transition: 'opacity 1.5s ease 1s',
        }}>
          <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)' }}>SCROLL</div>
          <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)' }} />
        </div>
      </section>

      {/* ── Section 2: The Problem ─────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1100px', margin: '0 auto' }}>
        {(() => {
          const { ref, visible } = useFadeIn(0.1);
          return (
            <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease' }}>
              <SectionLabel text="The Problem" color={RED} />
              <h2 style={{ fontFamily: MONO, fontSize: 'clamp(24px,4vw,42px)', color: '#F0F4FF', marginBottom: '20px', lineHeight: 1.2 }}>
                Traditional tools show you <span style={{ color: RED }}>what happened.</span><br />
                FAULTLINE shows you <span style={{ color: CYAN }}>what's building.</span>
              </h2>
              <p style={{ fontFamily: SANS, fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: '680px', marginBottom: '48px' }}>
                Most market tools are reactive. They display prices, charts, and news after the fact. FAULTLINE measures the systemic pressure that precedes major market moves — giving you the context to understand why conditions are changing before the move is obvious.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {[
                  { label: 'Traditional Tools', items: ['Show price and volume', 'Describe what already happened', 'Require you to interpret the macro context yourself', 'React to news after it breaks', 'Treat every market environment the same'], color: 'rgba(255,59,48,0.08)', border: 'rgba(255,59,48,0.2)', accent: RED },
                  { label: 'FAULTLINE', items: ['Measure systemic pressure before it becomes price action', 'Explain why conditions are changing', 'Synthesize macro, credit, volatility, and positioning into one score', 'Identify regime transitions as they develop', 'Calibrate every signal to the current macro environment'], color: 'rgba(0,229,255,0.04)', border: 'rgba(0,229,255,0.2)', accent: CYAN },
                ].map((col) => (
                  <div key={col.label} style={{ background: col.color, border: `1px solid ${col.border}`, borderRadius: '12px', padding: '28px' }}>
                    <div style={{ fontFamily: MONO, fontSize: '11px', color: col.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px' }}>{col.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {col.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <span style={{ color: col.accent, flexShrink: 0 }}>{col.accent === RED ? '✗' : '✓'}</span>
                          <span style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Section 3: Pressure Index™ ─────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(0,229,255,0.02)', borderTop: '1px solid rgba(0,229,255,0.08)', borderBottom: '1px solid rgba(0,229,255,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', alignItems: 'center' }}>
          <div>
            {(() => {
              const { ref, visible } = useFadeIn(0.1);
              return (
                <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease' }}>
                  <SectionLabel text="Core Technology" color={CYAN} />
                  <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,36px)', color: '#F0F4FF', marginBottom: '20px', lineHeight: 1.3 }}>
                    The <span style={{ color: CYAN }}>Pressure Index™</span>
                  </h2>
                  <p style={{ fontFamily: SANS, fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '20px' }}>
                    Not a sentiment score. A systemic stress measurement.
                  </p>
                  <p style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
                    The Pressure Index™ synthesizes credit spread direction, volatility regime, liquidity conditions, and macro positioning into a single 0–100 score. It measures the structural stress building in the financial system — the kind that precedes major market dislocations.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: '0–30', desc: 'Low Stress — Risk-on conditions supported', color: GREEN },
                      { label: '30–60', desc: 'Moderate Stress — Caution warranted', color: GOLD },
                      { label: '60–80', desc: 'Elevated Stress — Defensive positioning advised', color: '#FF8C00' },
                      { label: '80–100', desc: 'Critical Stress — Systemic risk elevated', color: RED },
                    ].map((r) => (
                      <div key={r.label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ fontFamily: MONO, fontSize: '11px', color: r.color, minWidth: '50px', letterSpacing: '0.05em' }}>{r.label}</div>
                        <div style={{ flex: 1, height: '1px', background: `${r.color}30` }} />
                        <div style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'right', maxWidth: '220px' }}>{r.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PressureGauge value={62} />
          </div>
        </div>
      </section>

      {/* ── Section 4: Feature Showcase ────────────────────── */}
      <section id="features" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1200px', margin: '0 auto' }}>
        {(() => {
          const { ref, visible } = useFadeIn(0.1);
          return (
            <div ref={ref} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease', marginBottom: '48px' }}>
              <SectionLabel text="Platform Capabilities" color={GOLD} />
              <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,36px)', color: '#F0F4FF', lineHeight: 1.3 }}>
                Everything you need to understand <span style={{ color: GOLD }}>why markets move.</span>
              </h2>
            </div>
          );
        })()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 60} />
          ))}
        </div>
      </section>

      {/* ── Section 5: Platform Flow ────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(167,139,250,0.02)', borderTop: '1px solid rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.08)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          {(() => {
            const { ref, visible } = useFadeIn(0.1);
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease' }}>
                <SectionLabel text="The Five Questions" color={PURPLE} />
                <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,36px)', color: '#F0F4FF', marginBottom: '16px', lineHeight: 1.3 }}>
                  Every market session answered in <span style={{ color: PURPLE }}>five questions.</span>
                </h2>
                <p style={{ fontFamily: SANS, fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
                  FAULTLINE organizes the entire market intelligence workflow around five essential questions. Each has a dedicated destination with the data, analysis, and AI synthesis needed to answer it completely.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                  {[
                    { q: 'NOW', label: 'What is happening right now?', color: CYAN, path: '/app/now' },
                    { q: 'WHY', label: 'Why is it happening?', color: GOLD, path: '/app/why' },
                    { q: 'OUTLOOK', label: 'What is most likely next?', color: PURPLE, path: '/app/outlook' },
                    { q: 'WATCH', label: 'What should I keep watching?', color: '#F97316', path: '/app/watch' },
                    { q: 'ACT', label: 'How should I respond?', color: GREEN, path: '/app/act' },
                  ].map((dest) => (
                    <div key={dest.q} style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${dest.color}25`,
                      borderRadius: '12px', padding: '24px 16px',
                    }}>
                      <div style={{ fontFamily: MONO, fontSize: '18px', color: dest.color, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '10px' }}>{dest.q}</div>
                      <div style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{dest.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Section 6: Who It's For ─────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1100px', margin: '0 auto' }}>
        {(() => {
          const { ref, visible } = useFadeIn(0.1);
          return (
            <div ref={ref} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease', marginBottom: '48px' }}>
              <SectionLabel text="Who It's For" color={GREEN} />
              <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,36px)', color: '#F0F4FF', lineHeight: 1.3 }}>
                Built for investors who need to understand <span style={{ color: GREEN }}>the full picture.</span>
              </h2>
            </div>
          );
        })()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {PERSONAS.map((p) => <PersonaCard key={p.title} {...p} />)}
        </div>
      </section>

      {/* ── Section 7: Pricing ─────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(0,255,136,0.02)', borderTop: '1px solid rgba(0,255,136,0.08)', borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {(() => {
            const { ref, visible } = useFadeIn(0.1);
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease', marginBottom: '48px', textAlign: 'center' }}>
                <SectionLabel text="Pricing" color={GREEN} />
                <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,36px)', color: '#F0F4FF', lineHeight: 1.3 }}>
                  Start free. Upgrade when you're ready.
                </h2>
                <p style={{ fontFamily: SANS, fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: '500px', margin: '16px auto 0' }}>
                  Every plan includes the core Seismograph and Pressure Index. Upgrade for advanced intelligence, AI briefings, and institutional tools.
                </p>
              </div>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <PricingCard
              name="Free"
              price="$0"
              interval="forever"
              description="Core market intelligence. No credit card required."
              features={['Pressure Index™', 'Market Seismograph', 'Bull/Crash Probability', 'Basic market regime detection']}
              accent="rgba(255,255,255,0.5)"
              onCta={handleEnter}
              ctaLabel="Start Free"
            />
            <PricingCard
              name="Core"
              price="$9.99"
              interval="mo"
              description="Signals screener, Portfolio tracker, and the full decision toolkit."
              features={['Everything in Free', 'Signals & Alerts', 'Portfolio Intelligence', 'Symbol Intelligence', 'Day Trade Intelligence']}
              accent={CYAN}
              onCta={handleEnter}
              ctaLabel="Start Core"
            />
            <PricingCard
              name="Pro"
              price="$59"
              interval="mo"
              description="Full institutional intelligence suite."
              features={['Everything in Core', 'ASHA Oracle Briefings', 'Historical Analog Engine', 'Scenario Analysis', 'Daily Briefings Archive', 'Macro Research Tools']}
              accent={GOLD}
              highlight
              onCta={handleEnter}
              ctaLabel="Start Pro"
            />
            <PricingCard
              name="Founding"
              price="$49"
              interval="mo (locked)"
              description="Pro access at the founding rate. Locked forever. Limited cohort."
              features={['Everything in Pro', 'Rate locked for life — never increases', 'Founding member status', 'Priority access to new features']}
              accent={PURPLE}
              onCta={handleEnter}
              ctaLabel="Claim Founding Rate"
            />
          </div>
        </div>
      </section>

      {/* ── Section 8: Final CTA ────────────────────────────── */}
      <section style={{
        minHeight: '60vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)',
        position: 'relative',
        backgroundImage: `url(${ASSETS.ctaAtmosphere})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,8,16,0.8), rgba(5,8,16,0.6), rgba(5,8,16,0.9))' }} />
        {(() => {
          const { ref, visible } = useFadeIn(0.1);
          return (
            <div ref={ref} style={{ position: 'relative', zIndex: 1, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.8s ease' }}>
              <div style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '24px' }}>
                ◆ YOU'VE SEEN THE PLATFORM
              </div>
              <h2 style={{ fontFamily: MONO, fontSize: 'clamp(28px,5vw,56px)', color: '#F0F4FF', marginBottom: '20px', lineHeight: 1.2 }}>
                Now enter it.
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 'clamp(14px,2vw,18px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: '500px', margin: '0 auto 48px' }}>
                ASHA will personalize your experience based on your investing style, goals, and interests. Your first briefing is waiting.
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleEnter} style={{
                  fontFamily: MONO, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
                  padding: '18px 48px', borderRadius: '8px', fontWeight: 700,
                  boxShadow: `0 0 32px ${CYAN}50`,
                  transition: 'all 0.15s ease-out',
                }}>Enter FAULTLINE →</button>
              </div>
              <div style={{ marginTop: '32px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
                FREE TO START · NO CREDIT CARD REQUIRED
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{ padding: '32px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)' }}>
          <span style={{ color: CYAN }}>FAULT</span>LINE · SYSTEMIC RISK INTELLIGENCE
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {[
            { label: 'About', href: '/about' },
            { label: 'Methodology', href: '/app/methodology' },
            { label: 'Track Record', href: '/app/track-record' },
          ].map((l) => (
            <a key={l.label} href={l.href} style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textDecoration: 'none', textTransform: 'uppercase' }}>{l.label}</a>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
          NOT FINANCIAL ADVICE
        </div>
      </footer>
    </div>
  );
}
