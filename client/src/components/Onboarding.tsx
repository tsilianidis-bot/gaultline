/* ============================================================
   FAULTLINE — Onboarding Flow
   Fast, elegant, minimal — explains scores, probabilities,
   regimes, and systemic pressure in 4 screens.
   Shown on first visit, dismissible, re-accessible via header.
   ============================================================ */
import { useState, useEffect } from "react";
import { X, ChevronRight, Activity, TrendingUp, AlertTriangle, Zap } from "lucide-react";

const STORAGE_KEY = "faultline_onboarded_v1";

const SLIDES = [
  {
    icon: Activity,
    color: "#00D4FF",
    title: "What FAULTLINE Measures",
    subtitle: "Systemic pressure · Real-time · FRED data",
    body: "FAULTLINE detects hidden systemic pressure building beneath financial markets before major regime shifts become obvious. It monitors liquidity conditions, credit market stress, speculative behavior, macro regime pressure, concentration risk, and structural instability.",
    detail: "The system converts these inputs into a real-time Pressure Index designed to identify elevated market risk before stress becomes obvious.",
    detailColor: "#00D4FF",
  },
  {
    icon: TrendingUp,
    color: "#00FF88",
    title: "Reading the Pressure Score",
    subtitle: "0–10 scale · Domain-weighted composite",
    body: "Each domain — Liquidity, Credit, Speculative Excess, Macro Instability, Concentration, and Structural Fragility — is scored 0–10 using real FRED macroeconomic data. The composite Pressure Index drives the overall regime classification.",
    detail: "3.0–5.0 = Moderate · 5.0–7.0 = Elevated · 7.0–8.5 = High · 8.5+ = Critical",
    detailColor: "#FFD700",
  },
  {
    icon: AlertTriangle,
    color: "#FF9500",
    title: "Regime Classification",
    subtitle: "5 macro regimes · Auto-detected",
    body: "FAULTLINE classifies the current environment into one of five regimes: Low Risk, Moderate, Elevated Stress, Late-Cycle Fragility, or Critical Systemic Stress. Regime changes are the most important signal — they indicate a structural shift in macro conditions.",
    detail: "The regime drives the color system, probability estimates, and narrative intelligence across the entire platform.",
    detailColor: "#FF9500",
  },
  {
    icon: Zap,
    color: "#C084FC",
    title: "Stress-Test Any Scenario",
    subtitle: "Simulate · Adjust · Observe",
    body: "Use the Simulate tab to manually adjust any indicator — push HY spreads to 600bps, spike CPI, or tighten liquidity conditions — and watch every score, regime, probability, and narrative react in real time.",
    detail: "Simulation mode is clearly labeled. Tap Reset to return to live FRED data. These are probabilistic estimates, not financial advice.",
    detailColor: "#C084FC",
  },
];

interface OnboardingProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function Onboarding({ forceOpen, onClose }: OnboardingProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so the app loads first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "1");
    onClose?.();
  };

  const next = () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  if (!open) return null;

  const slide = SLIDES[step];
  const Icon = slide.icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
      background: 'rgba(5,6,8,0.85)',
      backdropFilter: 'blur(8px)',
      animation: 'fade-in 0.25s ease both',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: '#0A0C10',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none',
        borderRadius: '12px 12px 0 0',
        padding: '24px 24px 32px',
        animation: 'onboard-slide 0.35s cubic-bezier(0.23,1,0.32,1) both',
        position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={close}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '50%',
            width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: '#6B7280',
            minHeight: 'unset',
          }}
        >
          <X size={12} />
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                height: '2px',
                flex: 1,
                background: i <= step ? slide.color : 'rgba(255,255,255,0.08)',
                borderRadius: '2px',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: '48px', height: '48px',
          background: `${slide.color}12`,
          border: `1px solid ${slide.color}30`,
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: `0 0 24px ${slide.color}20`,
        }}>
          <Icon size={22} style={{ color: slide.color }} />
        </div>

        {/* Content */}
        <div key={step} style={{ animation: 'onboard-slide 0.3s cubic-bezier(0.23,1,0.32,1) both' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: slide.color, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>
            {slide.subtitle}
          </div>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F0F4FF', marginBottom: '12px', lineHeight: 1.2 }}>
            {slide.title}
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#94A3B8', lineHeight: 1.65, marginBottom: '14px' }}>
            {slide.body}
          </p>
          <div style={{
            padding: '10px 12px',
            background: `${slide.detailColor}08`,
            border: `1px solid ${slide.detailColor}20`,
            borderRadius: '4px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: slide.detailColor,
            lineHeight: 1.5,
          }}>
            {slide.detail}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
          <button
            onClick={close}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4B5563',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              minHeight: '36px',
              padding: '0 4px',
            }}
          >
            Skip
          </button>

          <button
            onClick={next}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${slide.color}20, ${slide.color}10)`,
              border: `1px solid ${slide.color}40`,
              borderRadius: '4px',
              color: slide.color,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: `0 0 16px ${slide.color}15`,
              transition: 'all 0.15s cubic-bezier(0.23,1,0.32,1)',
              minHeight: '44px',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 24px ${slide.color}30`)}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 16px ${slide.color}15`)}
          >
            {step < SLIDES.length - 1 ? 'Next' : 'Enter FAULTLINE'}
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Step counter */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>
            {step + 1} of {SLIDES.length}
          </span>
        </div>
      </div>
    </div>
  );
}
