/* ============================================================
   FAULTLINE — Product Experience Gate
   Shown once to first-time visitors after the CinematicIntro
   and before the ASHA onboarding / CinematicAuthGate.

   Sections:
   1.  Hero — full-viewport atmospheric opener with "See the Proof" CTA
   2.  The Problem — what traditional tools miss
   3.  Pressure Index™ — animated gauge + explanation
   4.  Historical Validation — 2000–2025 event cards + trust strip
   5.  Feature Showcase — 10 capability cards
   6.  Platform Flow — how the 5 questions work
   7.  Who It's For — 3 investor personas
   8.  Founder's Statement — personal credibility section
   9.  Founding, Trader, and Power monthly pricing
   10. Final CTA — "Enter FAULTLINE"
   ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getLoginUrl } from '../const';
import { trackGa4Event } from '../lib/ga4';

/** localStorage key for preserving checkout intent across the OAuth login redirect */
export const CHECKOUT_INTENT_KEY = 'fl_checkout_intent_v1';

// ── Public Pricing Configuration ───────────────────────────────────────────
// Public presentation only. Checkout stays unavailable until its matching
// Stripe Price ID has been independently verified server-side.
const PUBLIC_PRICING = [
  {
    id: 'founding', name: 'FOUNDING MEMBER', price: '$49', period: '/ month', color: GOLD,
    badge: 'FOUNDING RATE — LOCKED', cta: 'LOCK IN FOUNDER RATE',
    tagline: 'Join FAULTLINE during the founding period and keep your $49 monthly rate locked as long as your membership remains active.',
    features: ['Founding-member access to the FAULTLINE platform', 'Locked $49 monthly rate while membership remains active', 'Founding member recognition'],
  },
  {
    id: 'trader', name: 'TRADER', price: '$59', period: '/ month', color: CYAN,
    badge: 'PRIMARY EXPERIENCE', cta: 'GET TRADER',
    tagline: 'For serious investors who want FAULTLINE’s core market intelligence, monitoring, signals, watch tools, interpretation, and decision support.',
    features: ['Core market intelligence and monitoring', 'Signals, watch tools, and market interpretation', 'Decision support for active investors'],
  },
  {
    id: 'power', name: 'POWER', price: '$99', period: '/ month', color: PURPLE,
    badge: 'FULL PROFESSIONAL TOOLSET', cta: 'GET POWER',
    tagline: 'For users who want the deepest FAULTLINE intelligence experience, advanced analysis, expanded research capabilities, and the full professional toolset.',
    features: ['Everything in Trader', 'Advanced analysis and expanded research', 'Full professional intelligence toolset'],
  },
] as const;

// ── Assets ────────────────────────────────────────────────────
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

// ── Analytics helper ──────────────────────────────────────────
function track(eventName: string, params?: Record<string, string | number>) {
  trackGa4Event(eventName, params);
}

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
      <svg width="200" height="200" viewBox="0 0 200 200" aria-label={`Pressure Index: ${displayed} out of 100`} role="img">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
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

// ── Historical event card ──────────────────────────────────────
interface EventCardProps {
  year: string;
  event: string;
  drawdown: string;
  duration: string;
  signal: string;
  accent: string;
  delay: number;
}
function EventCard({ year, event, drawdown, duration, signal, accent, delay }: EventCardProps) {
  const { ref, visible } = useFadeIn(0.08);
  return (
    <div ref={ref} style={{
      background: `rgba(${accent === RED ? '255,59,48' : accent === GOLD ? '255,170,0' : '0,229,255'},0.04)`,
      border: `1px solid ${accent}25`,
      borderRadius: '12px',
      padding: '24px 20px',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontFamily: MONO, fontSize: '11px', color: accent, letterSpacing: '0.15em' }}>{year}</div>
        <div style={{ fontFamily: MONO, fontSize: '18px', color: RED, fontWeight: 700 }}>{drawdown}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: '13px', color: '#F0F4FF', marginBottom: '8px', lineHeight: 1.3 }}>{event}</div>
      <div style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>{duration}</div>
      <div style={{ borderTop: `1px solid ${accent}20`, paddingTop: '12px' }}>
        <div style={{ fontFamily: MONO, fontSize: '9px', color: accent, letterSpacing: '0.15em', marginBottom: '4px' }}>FAULTLINE WOULD HAVE SHOWN</div>
        <div style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{signal}</div>
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
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const validationRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    track('product_experience_view');
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollY(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to validation section
  const handleSeeProof = useCallback(() => {
    track('hero_see_proof_click');
    validationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Scroll to pricing section
  const handleSeePricing = useCallback(() => {
    track('hero_see_pricing_click');
    pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Enter platform (triggers ASHA after click — not on load)
  const handleEnter = useCallback(() => {
    track('enter_platform_click', { source: 'product_experience' });
    onEnter();
  }, [onEnter]);

  const handleLogin = useCallback(() => {
    track('sign_in_click', { source: 'product_experience' });
    window.location.href = getLoginUrl();
  }, []);

  const handlePricingInterest = useCallback((planName: string) => {
    track('pricing_configuration_required', { source: 'product_experience', plan: planName });
    setPricingNotice(`${planName} checkout is not yet available because its Stripe price configuration has not been verified.`);
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
        "Validate signals against the platform's evidence and data sources",
      ],
    },
  ];

  const HISTORICAL_EVENTS = [
    {
      year: '2000–2002',
      event: 'Dot-Com Crash',
      drawdown: '−49%',
      duration: '929 days',
      signal: 'Retrospective analysis: elevated credit spreads, extreme valuation dispersion, and deteriorating breadth would have registered Critical Stress (80+) under the current framework months before the peak.',
      accent: RED,
      delay: 0,
    },
    {
      year: '2007–2009',
      event: 'Global Financial Crisis',
      drawdown: '−57%',
      duration: '517 days',
      signal: 'Retrospective analysis: subprime contagion signals, TED spread explosion, and interbank liquidity collapse would have registered Critical Stress building from mid-2007 under the current framework.',
      accent: RED,
      delay: 80,
    },
    {
      year: '2020',
      event: 'COVID Crash',
      drawdown: '−34%',
      duration: '33 days',
      signal: 'Retrospective analysis: volatility regime shift, credit spread spike, and liquidity deterioration compressed into days — the Pressure Index would have crossed 80 within the first week under the current framework.',
      accent: GOLD,
      delay: 160,
    },
    {
      year: '2022',
      event: 'Fed Tightening Bear Market',
      drawdown: '−25%',
      duration: '282 days',
      signal: 'Retrospective analysis: inverted yield curve, real rate shock, and breadth collapse would have flagged Elevated Stress (60+) from January under the current framework — before the S&P peaked.',
      accent: GOLD,
      delay: 240,
    },
    {
      year: '2023–2024',
      event: 'Regional Banking Crisis',
      drawdown: 'KRE −40%',
      duration: '60 days',
      signal: 'Retrospective analysis: credit spread widening in financials, deposit flight signals, and contagion risk indicators would have shown sector-specific stress weeks before SVB under the current framework.',
      accent: CYAN,
      delay: 320,
    },
    {
      year: '2025',
      event: 'Tariff Shock & AI Bubble Pressure',
      drawdown: '−19%',
      duration: 'Ongoing',
      signal: 'Live forward tracking (ongoing): AI sector concentration risk, macro regime deterioration, and trade policy uncertainty are currently monitored in real time across all five FAULTLINE engines. This is not a completed forecast.',
      accent: CYAN,
      delay: 400,
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
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px clamp(16px,4vw,32px)',
          background: scrollY > 60 ? 'rgba(5,8,16,0.95)' : 'transparent',
          backdropFilter: scrollY > 60 ? 'blur(12px)' : 'none',
          borderBottom: scrollY > 60 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
        <div style={{ fontFamily: MONO, fontSize: '14px', letterSpacing: '0.2em', color: '#F0F4FF' }}>
          <span style={{ color: CYAN }}>FAULT</span>LINE
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleSeePricing}
            style={{
              fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: GOLD, background: 'transparent',
              border: `1px solid ${GOLD}40`,
              cursor: 'pointer', padding: '8px 14px', borderRadius: '6px',
              transition: 'all 0.15s ease-out',
            }}
            aria-label="View FAULTLINE pricing"
          >View Pricing</button>
          <button
            onClick={handleLogin}
            style={{
              fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 16px',
            }}
            aria-label="Sign in to your account"
          >Sign In</button>
          <button
            onClick={handleEnter}
            style={{
              fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
              padding: '10px 20px', borderRadius: '6px', fontWeight: 700,
              transition: 'all 0.15s ease-out',
            }}
            aria-label="Enter the FAULTLINE platform"
          >Enter Platform</button>
        </div>
      </nav>

      {/* ── Section 1: Hero ────────────────────────────────── */}
      <section
        aria-label="Hero"
        style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px clamp(16px,5vw,80px)',
          position: 'relative',
          backgroundImage: `url(${ASSETS.heroBg})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,8,16,0.7) 0%, rgba(5,8,16,0.5) 50%, rgba(5,8,16,0.9) 100%)' }} />

        <div style={{
          position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '820px',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 1s cubic-bezier(0.23,1,0.32,1), transform 1s cubic-bezier(0.23,1,0.32,1)',
        }}>
          <div style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '24px' }}>
            ◆ SYSTEMIC RISK INTELLIGENCE · 2000–2025 TRACK RECORD
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
            color: 'rgba(255,255,255,0.75)', lineHeight: 1.6,
            maxWidth: '640px', margin: '0 auto 16px',
          }}>
            The systemic pressure that precedes market crashes is measurable.<br />
            FAULTLINE measures it — in real time.
          </p>
          <p style={{
            fontFamily: SANS, fontSize: 'clamp(13px, 1.8vw, 16px)',
            color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
            maxWidth: '560px', margin: '0 auto 16px',
          }}>
            Institutional-grade macroeconomic intelligence for active traders, macro investors, and anyone who needs to understand why markets move — not just that they did.
          </p>
          {/* Founding offer callout */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: `${GOLD}12`, border: `1px solid ${GOLD}35`,
            borderRadius: '8px', padding: '10px 20px', marginBottom: '40px',
          }}>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: GOLD, letterSpacing: '0.15em' }}>
              ◆ FOUNDING MEMBER · $49 / MONTH · RATE LOCKED
            </span>
          </div>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleEnter}
              style={{
                fontFamily: MONO, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
                padding: '16px 36px', borderRadius: '8px', fontWeight: 700,
                boxShadow: `0 0 24px ${CYAN}40`,
                transition: 'all 0.15s ease-out',
              }}
              aria-label="Enter FAULTLINE platform for free"
            >Enter FAULTLINE →</button>
            <button
              onClick={handleSeeProof}
              style={{
                fontFamily: MONO, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', padding: '16px 36px', borderRadius: '8px',
                transition: 'all 0.15s ease-out',
              }}
              aria-label="See 25-year historical track record"
            >See the Proof ↓</button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          opacity: heroVisible ? 0.4 : 0, transition: 'opacity 1.5s ease 1s',
        }} aria-hidden="true">
          <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)' }}>SCROLL</div>
          <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)' }} />
        </div>
      </section>

      {/* ── Section 2: The Problem ─────────────────────────── */}
      <section aria-label="The problem with traditional tools" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1100px', margin: '0 auto' }}>
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
      <section aria-label="Pressure Index technology" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(0,229,255,0.02)', borderTop: '1px solid rgba(0,229,255,0.08)', borderBottom: '1px solid rgba(0,229,255,0.08)' }}>
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

      {/* ── Section 4: Historical Validation ──────────────── */}
      <section
        ref={validationRef}
        id="validation"
        aria-label="Historical backtest analysis across major market regimes"
        style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(255,59,48,0.02)', borderTop: '1px solid rgba(255,59,48,0.08)', borderBottom: '1px solid rgba(255,59,48,0.08)' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {(() => {
            const { ref, visible } = useFadeIn(0.1);
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease', marginBottom: '56px', textAlign: 'center' }}>
                <SectionLabel text="Historical Validation" color={RED} />
                <h2 style={{ fontFamily: MONO, fontSize: 'clamp(22px,3.5vw,40px)', color: '#F0F4FF', lineHeight: 1.2, marginBottom: '20px' }}>
                  Major market dislocations, 2000–2025.<br />
                  <span style={{ color: RED }}>Retrospective analysis.</span>
                </h2>
                <p style={{ fontFamily: SANS, fontSize: 'clamp(14px,1.8vw,17px)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: '640px', margin: '0 auto 16px' }}>
                  Retrospective testing shows how FAULTLINE's current framework would have interpreted systemic pressure conditions across major historical dislocations from 2000 to 2025.
                </p>
                <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 32px', letterSpacing: '0.05em' }}>
                  BACKTEST DISCLAIMER: The analysis below is retrospective. It applies FAULTLINE's current methodology to historical data. It does not represent live forward performance or a real-time prediction record. Past indicator behavior does not guarantee future results.
                </p>
                {/* Trust strip */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(20px,4vw,48px)', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {[
                    { value: '6', label: 'Market Regimes Analyzed' },
                    { value: '2000–2025', label: 'Historical Data Range' },
                    { value: '5', label: 'Intelligence Engines' },
                    { value: 'Open', label: 'Methodology Documentation' },
                  ].map((stat) => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 'clamp(24px,3vw,36px)', color: CYAN, fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '6px', letterSpacing: '0.05em' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Event cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '48px' }}>
            {HISTORICAL_EVENTS.map((ev) => (
              <EventCard key={ev.year} {...ev} />
            ))}
          </div>

          {/* Methodology link + CTA */}
          {(() => {
            const { ref, visible } = useFadeIn(0.1);
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease', textAlign: 'center' }}>
                <p style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '24px', lineHeight: 1.6 }}>
                  All historical analysis is based on publicly available market data. Methodology is fully documented and transparent.{' '}
                  <a href="/methodology" style={{ color: CYAN, textDecoration: 'none' }} onClick={() => track('methodology_link_click')}>
                    Read the methodology →
                  </a>
                </p>
                <button
                  onClick={() => { track('validation_cta_click'); onEnter(); }}
                  style={{
                    fontFamily: MONO, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
                    padding: '16px 40px', borderRadius: '8px', fontWeight: 700,
                    boxShadow: `0 0 24px ${CYAN}40`,
                    transition: 'all 0.15s ease-out',
                  }}
                  aria-label="See the track record inside the platform"
                >See the Full Track Record →</button>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Section 5: Feature Showcase ────────────────────── */}
      <section id="features" aria-label="Platform capabilities" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1200px', margin: '0 auto' }}>
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

      {/* ── Section 6: Platform Flow ────────────────────────── */}
      <section aria-label="Five intelligence destinations" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(167,139,250,0.02)', borderTop: '1px solid rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.08)' }}>
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
                    { q: 'NOW', label: 'What is happening right now?', color: CYAN },
                    { q: 'WHY', label: 'Why is it happening?', color: GOLD },
                    { q: 'OUTLOOK', label: 'What is most likely next?', color: PURPLE },
                    { q: 'WATCH', label: 'What should I keep watching?', color: '#F97316' },
                    { q: 'ACT', label: 'How should I respond?', color: GREEN },
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

      {/* ── Section 7: Who It's For ─────────────────────────── */}
      <section aria-label="Who FAULTLINE is for" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', maxWidth: '1100px', margin: '0 auto' }}>
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

      {/* ── Section 8: Founder's Statement ─────────────────── */}
      <section aria-label="Founder's statement" style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(0,229,255,0.015)', borderTop: '1px solid rgba(0,229,255,0.06)', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {(() => {
            const { ref, visible } = useFadeIn(0.1);
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'all 0.7s ease' }}>
                <SectionLabel text="Why I Built FAULTLINE" color={CYAN} />
                <blockquote style={{
                  fontFamily: SANS, fontSize: 'clamp(16px,2vw,20px)',
                  color: 'rgba(255,255,255,0.8)', lineHeight: 1.75,
                  borderLeft: `3px solid ${CYAN}`,
                  paddingLeft: '28px', margin: '0 0 32px',
                  fontStyle: 'normal',
                }}>
                  <p style={{ margin: '0 0 22px', color: '#F0F4FF', fontFamily: MONO, fontSize: 'clamp(19px,2.4vw,25px)', lineHeight: 1.35, fontWeight: 700 }}>
                    <span style={{ display: 'block' }}>Finding the right assets isn’t always the hardest part of investing.</span>
                    <span style={{ display: 'block', color: CYAN, marginTop: '5px' }}>Knowing what to do after you’ve found them can be.</span>
                  </p>
                  <p style={{ margin: '0 0 18px' }}>I built FAULTLINE because I wish I had a tool like this the first time I made life-changing gains.</p>
                  <p style={{ margin: '0 0 18px' }}>I had found the right assets. What I didn’t have was a system that could clearly show me what was happening around them — when market conditions were changing, when risk was building, when momentum was weakening, or when it might be time to protect what I had made.</p>
                  <p style={{ margin: '0 0 18px' }}>That experience stayed with me.</p>
                  <p style={{ margin: '0 0 18px' }}>Because making money in the market is only part of the challenge. <strong style={{ color: '#F0F4FF' }}>Knowing what to do once you’ve made it can be even harder.</strong></p>
                  <p style={{ margin: '0 0 18px' }}>Markets give us endless charts, headlines, indicators, opinions, and predictions. More information does not automatically create better decisions.</p>
                  <p style={{ margin: '0 0 18px', color: '#F0F4FF', fontWeight: 600 }}>What investors need is clarity.</p>
                  <p style={{ margin: '0 0 18px' }}>Those five questions became the foundation of FAULTLINE.</p>
                  <p style={{ margin: '0 0 18px' }}>I wanted to build the tool I wish had been sitting in front of me during those moments — something that could cut through the noise, explain the environment around my investments, and help me recognize when the odds were beginning to change.</p>
                  <p style={{ margin: '0 0 18px' }}>FAULTLINE isn’t about predicting every market move.</p>
                  <p style={{ margin: '0 0 22px' }}>It’s about seeing the market more clearly when the decisions matter most.</p>
                  <p style={{ margin: 0, color: '#F0F4FF', fontWeight: 700, fontSize: 'clamp(18px,2.2vw,23px)', lineHeight: 1.45 }}>Finding the opportunity can change your portfolio. <span style={{ color: CYAN }}>Knowing when to move can change your life.</span></p>
                </blockquote>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${CYAN}30, ${PURPLE}30)`,
                    border: `1px solid ${CYAN}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: '16px', color: CYAN, fontWeight: 700,
                  }}>RR</div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: '13px', color: '#F0F4FF', letterSpacing: '0.05em' }}>RICHARD ROPER</div>
                    <div style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Founder & CEO, FAULTLINE</div>
                  </div>
                </div>
                <div style={{ marginTop: '32px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'What’s happening?', desc: 'Observe the market environment' },
                    { label: 'Why is it happening?', desc: 'Understand the drivers' },
                    { label: 'What’s likely to happen next?', desc: 'Assess the evidence' },
                    { label: 'What should I be watching?', desc: 'Track what could change' },
                    { label: 'What should I do?', desc: 'Act with greater clarity' },
                  ].map((item) => (
                    <div key={item.label} style={{ flex: '1 1 180px' }}>
                      <div style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, letterSpacing: '0.15em', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Section 9: Public Pricing ───────────────────────── */}
      <section
        ref={pricingRef}
        id="pricing"
        aria-label="FAULTLINE pricing"
        style={{ padding: 'clamp(60px,8vw,120px) clamp(20px,5vw,80px)', background: 'rgba(0,229,255,0.015)', borderTop: '1px solid rgba(0,229,255,0.12)', borderBottom: '1px solid rgba(0,229,255,0.12)' }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <SectionLabel text="Membership" color={CYAN} />
            <h2 style={{ fontFamily: MONO, fontSize: 'clamp(24px,4vw,44px)', color: '#F0F4FF', lineHeight: 1.2, margin: '0 0 16px' }}>
              Choose the level of intelligence you need.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 'clamp(14px,1.8vw,17px)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: '620px', margin: '0 auto' }}>
              Three monthly memberships. Clear capabilities. No annual pricing or unverified discounts.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '18px', alignItems: 'stretch' }}>
            {PUBLIC_PRICING.map((plan) => {
              const isFounding = plan.id === 'founding';
              return (
                <div key={plan.id} style={{ display: 'flex', flexDirection: 'column', padding: '30px 26px', background: isFounding ? 'linear-gradient(145deg, rgba(255,170,0,0.11), rgba(255,170,0,0.025))' : 'rgba(255,255,255,0.025)', border: `1px solid ${isFounding ? 'rgba(255,170,0,0.45)' : `${plan.color}32`}`, borderRadius: '16px', boxShadow: isFounding ? '0 0 46px rgba(255,170,0,0.09)' : 'none' }}>
                  <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.16em', color: plan.color, marginBottom: '14px' }}>{plan.badge}</div>
                  <div style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', color: '#F0F4FF', marginBottom: '14px' }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ fontFamily: MONO, fontSize: 'clamp(42px,6vw,56px)', color: plan.color, fontWeight: 700, lineHeight: 1 }}>{plan.price}</span>
                    <span style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>{plan.period}</span>
                  </div>
                  <p style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.6, margin: '0 0 22px' }}>{plan.tagline}</p>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '26px' }}>
                    {plan.features.map((feature) => <div key={feature} style={{ display: 'flex', gap: '9px', fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}><span style={{ color: plan.color }}>✓</span><span>{feature}</span></div>)}
                  </div>
                  <button onClick={() => handlePricingInterest(plan.name)} style={{ width: '100%', padding: '14px', background: isFounding ? 'rgba(255,170,0,0.16)' : 'transparent', border: `1px solid ${plan.color}70`, borderRadius: '8px', color: plan.color, fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', fontWeight: 700, cursor: 'pointer' }}>{plan.cta}</button>
                </div>
              );
            })}
          </div>

          {pricingNotice && <p role="status" style={{ margin: '24px auto 0', maxWidth: '760px', textAlign: 'center', fontFamily: SANS, fontSize: '13px', color: 'rgba(255,255,255,0.48)', lineHeight: 1.6 }}>{pricingNotice}</p>}
        </div>
      </section>

      {/* ── Section 10: Final CTA ────────────────────────────── */}
      <section aria-label="Final call to action" style={{
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
                <button
                  onClick={handleEnter}
                  style={{
                    fontFamily: MONO, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#000', background: CYAN, border: 'none', cursor: 'pointer',
                    padding: '18px 48px', borderRadius: '8px', fontWeight: 700,
                    boxShadow: `0 0 32px ${CYAN}50`,
                    transition: 'all 0.15s ease-out',
                  }}
                  aria-label="Enter FAULTLINE platform"
                >Enter FAULTLINE →</button>
                <button
                  onClick={handleSeePricing}
                  style={{
                    fontFamily: MONO, fontSize: '14px', letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: GOLD, background: 'rgba(255,170,0,0.12)', border: `1px solid ${GOLD}60`, cursor: 'pointer',
                    padding: '18px 48px', borderRadius: '8px', fontWeight: 700,
                    boxShadow: `0 0 32px ${GOLD}28`, transition: 'all 0.15s ease-out',
                  }}
                  aria-label="View Founding Member, Trader, and Power pricing"
                >View Memberships →</button>
              </div>
              <div style={{ marginTop: '32px', fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
                FREE TO START · NO CREDIT CARD REQUIRED · NOT FINANCIAL ADVICE
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer role="contentinfo" style={{ padding: 'clamp(24px,4vw,32px)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)' }}>
          <span style={{ color: CYAN }}>FAULT</span>LINE · SYSTEMIC RISK INTELLIGENCE
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { label: 'About', href: '/about' },
            { label: 'Methodology', href: '/methodology' },
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
