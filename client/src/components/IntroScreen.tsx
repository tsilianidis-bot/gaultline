/* ============================================================
   FAULTLINE — Abstract Pressure Engine Intro Screen
   Cinematic opening experience.
   Phases:
     0-800ms   : Canvas engine starts, deep black
     800-1600ms : FAULTLINE wordmark fades in with scanline reveal
     1600-2800ms: Subtitle + tagline typewrite
     2800-4200ms: Loading bar fills, data streams appear
     4200-5000ms: "ENTER SYSTEM" button materializes
     5000ms+   : User clicks → full-page dissolve into dashboard
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from 'react';
import { PressureEngine } from '@/lib/pressureEngine';

// ── Types ─────────────────────────────────────────────────────
type IntroPhase =
  | 'black'
  | 'logo-reveal'
  | 'subtitle'
  | 'loading'
  | 'ready'
  | 'exiting';

interface IntroScreenProps {
  onComplete: () => void;
}

// ── Loading messages that cycle during the load bar ───────────
const LOAD_MESSAGES = [
  'INITIALIZING PRESSURE ENGINE...',
  'LOADING FRED MACROECONOMIC FEEDS...',
  'CALIBRATING SYSTEMIC RISK DOMAINS...',
  'COMPUTING SCENARIO PROBABILITIES...',
  'ANALYZING HISTORICAL ANALOGS...',
  'DETECTING REGIME SIGNALS...',
  'SYNCHRONIZING NEURAL INDICATORS...',
  'SYSTEM READY.',
];

// ── Scanline reveal keyframes injected once ───────────────────
const INTRO_STYLES = `
@keyframes fl-scanline-reveal {
  0%   { clip-path: inset(0 0 100% 0); opacity: 0; }
  10%  { opacity: 1; }
  100% { clip-path: inset(0 0 0% 0); opacity: 1; }
}
@keyframes fl-char-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes fl-glow-pulse {
  0%, 100% { text-shadow: 0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15); }
  50%       { text-shadow: 0 0 40px rgba(0,212,255,0.7), 0 0 100px rgba(0,212,255,0.3), 0 0 160px rgba(0,212,255,0.1); }
}
@keyframes fl-bar-fill {
  from { width: 0%; }
  to   { width: 100%; }
}
@keyframes fl-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fl-flicker {
  0%, 95%, 100% { opacity: 1; }
  96%            { opacity: 0.85; }
  97%            { opacity: 1; }
  98%            { opacity: 0.9; }
}
@keyframes fl-exit-dissolve {
  0%   { opacity: 1; transform: scale(1); }
  40%  { opacity: 1; transform: scale(1.015); }
  100% { opacity: 0; transform: scale(1.04); }
}
@keyframes fl-data-stream {
  0%   { opacity: 0; transform: translateX(-8px); }
  20%  { opacity: 0.6; }
  80%  { opacity: 0.6; }
  100% { opacity: 0; transform: translateX(8px); }
}
@keyframes fl-enter-btn-appear {
  0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes fl-corner-draw {
  from { stroke-dashoffset: 60; }
  to   { stroke-dashoffset: 0; }
}
`;

// ── Typewriter hook ───────────────────────────────────────────
function useTypewriter(text: string, speed: number, active: boolean) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(''); setDone(false); idxRef.current = 0; return; }
    idxRef.current = 0;
    setDisplayed('');
    setDone(false);
    const iv = setInterval(() => {
      idxRef.current++;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);

  return { displayed, done };
}

// ── Data stream row ───────────────────────────────────────────
const DATA_ROWS = [
  { label: 'DGS10', value: '4.46%', color: '#00D4FF' },
  { label: 'T10Y2Y', value: '+0.48bps', color: '#00FF88' },
  { label: 'BAMLH0A0HYM2', value: '282bps', color: '#FF9500' },
  { label: 'NFCI', value: '-0.524', color: '#00D4FF' },
  { label: 'UNRATE', value: '4.3%', color: '#FFD700' },
  { label: 'M2SL', value: '$22,686B', color: '#00D4FF' },
  { label: 'SOFR', value: '3.59%', color: '#00FF88' },
  { label: 'CPIAUCSL', value: '2.4% YoY', color: '#FF9500' },
];

// ── Main component ────────────────────────────────────────────
export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PressureEngine | null>(null);
  const [phase, setPhase] = useState<IntroPhase>('black');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState(LOAD_MESSAGES[0]);
  const [loadMsgIdx, setLoadMsgIdx] = useState(0);
  const [btnHover, setBtnHover] = useState(false);
  const [stylesInjected, setStylesInjected] = useState(false);

  // Inject styles once
  useEffect(() => {
    if (stylesInjected) return;
    const el = document.createElement('style');
    el.textContent = INTRO_STYLES;
    document.head.appendChild(el);
    setStylesInjected(true);
    return () => { document.head.removeChild(el); };
  }, [stylesInjected]);

  // Start canvas engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new PressureEngine({ canvas: canvasRef.current, intensity: 0.7 });
    engineRef.current = engine;
    engine.start();

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvasRef.current);

    return () => { engine.stop(); ro.disconnect(); };
  }, []);

  // Phase sequencer
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase('logo-reveal'), 400));
    timers.push(setTimeout(() => setPhase('subtitle'), 1400));
    timers.push(setTimeout(() => setPhase('loading'), 2200));
    timers.push(setTimeout(() => setPhase('ready'), 5200));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Loading bar progress
  useEffect(() => {
    if (phase !== 'loading') return;
    let progress = 0;
    const total = 3000; // ms for bar to fill
    const step = 40;
    const iv = setInterval(() => {
      progress = Math.min(100, progress + (100 / (total / step)) * (0.8 + Math.random() * 0.4));
      setLoadProgress(progress);
      if (progress >= 100) clearInterval(iv);
    }, step);
    return () => clearInterval(iv);
  }, [phase]);

  // Loading message cycling
  useEffect(() => {
    if (phase !== 'loading') return;
    const iv = setInterval(() => {
      setLoadMsgIdx(i => {
        const next = Math.min(i + 1, LOAD_MESSAGES.length - 1);
        setLoadMessage(LOAD_MESSAGES[next]);
        return next;
      });
    }, 380);
    return () => clearInterval(iv);
  }, [phase]);

  // Trigger shockwave on logo reveal
  useEffect(() => {
    if (phase === 'logo-reveal' && engineRef.current) {
      setTimeout(() => engineRef.current?.triggerShockwave(), 200);
    }
    if (phase === 'ready' && engineRef.current) {
      engineRef.current.setIntensity(0.9);
    }
  }, [phase]);

  const handleEnter = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('exiting');
    engineRef.current?.triggerShockwave();
    setTimeout(() => {
      engineRef.current?.stop();
      onComplete();
    }, 900);
  }, [phase, onComplete]);

  // Typewriter for tagline
  const tagline = 'DETECTING HIDDEN SYSTEMIC PRESSURE IN REAL TIME';
  const { displayed: taglineText, done: taglineDone } = useTypewriter(
    tagline, 28, phase === 'subtitle' || phase === 'loading' || phase === 'ready',
  );

  // ── Render ─────────────────────────────────────────────────
  const isExiting = phase === 'exiting';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#020305',
        animation: isExiting ? 'fl-exit-dissolve 0.9s cubic-bezier(0.23,1,0.32,1) forwards' : undefined,
        overflow: 'hidden',
      }}
    >
      {/* Canvas layer */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Content layer */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '0 24px',
        textAlign: 'center',
      }}>

        {/* Corner brackets — top left */}
        <CornerBracket position="top-left" visible={phase !== 'black'} />
        <CornerBracket position="top-right" visible={phase !== 'black'} />
        <CornerBracket position="bottom-left" visible={phase !== 'black'} />
        <CornerBracket position="bottom-right" visible={phase !== 'black'} />

        {/* Horizontal scan lines — very subtle */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 4px)',
          opacity: phase === 'black' ? 0 : 0.6,
          transition: 'opacity 1.2s',
        }} />

        {/* FAULTLINE logo */}
        {phase !== 'black' && (
          <div style={{
            animation: 'fl-scanline-reveal 1.2s cubic-bezier(0.23,1,0.32,1) forwards, fl-flicker 8s ease-in-out 2s infinite',
            marginBottom: '8px',
          }}>
            {/* Wordmark */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(48px, 10vw, 96px)',
              letterSpacing: '0.18em',
              color: '#F0F4FF',
              lineHeight: 1,
              animation: 'fl-glow-pulse 3s ease-in-out 1.2s infinite',
              textShadow: '0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)',
            }}>
              FAULT<span style={{ color: '#00D4FF' }}>LINE</span>
            </div>

            {/* Divider line */}
            <div style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(255,215,0,0.4), transparent)',
              margin: '10px auto',
              width: '80%',
              animation: 'fl-fade-up 0.8s ease-out 0.8s both',
            }} />

            {/* Sub-wordmark */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 'clamp(9px, 1.5vw, 12px)',
              letterSpacing: '0.35em',
              color: 'rgba(0,212,255,0.7)',
              textTransform: 'uppercase',
              animation: 'fl-fade-up 0.8s ease-out 1s both',
            }}>
              MACROECONOMIC RISK INTELLIGENCE
            </div>
          </div>
        )}

        {/* Tagline typewriter */}
        {(phase === 'subtitle' || phase === 'loading' || phase === 'ready') && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 'clamp(9px, 1.8vw, 13px)',
            letterSpacing: '0.2em',
            color: 'rgba(148,163,184,0.8)',
            marginTop: '24px',
            marginBottom: '32px',
            minHeight: '20px',
            animation: 'fl-fade-up 0.6s ease-out both',
          }}>
            {taglineText}
            {!taglineDone && (
              <span style={{ animation: 'fl-char-blink 0.7s step-end infinite', color: '#00D4FF' }}>▌</span>
            )}
          </div>
        )}

        {/* Loading section */}
        {(phase === 'loading' || phase === 'ready') && (
          <div style={{
            width: '100%', maxWidth: '420px',
            animation: 'fl-fade-up 0.6s ease-out both',
          }}>
            {/* Progress bar */}
            <div style={{
              height: '2px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '1px',
              overflow: 'hidden',
              marginBottom: '10px',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${loadProgress}%`,
                background: 'linear-gradient(90deg, #00D4FF, #FFD700)',
                borderRadius: '1px',
                boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                transition: 'width 0.08s linear',
              }} />
              {/* Shimmer */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'fl-bar-fill 1.5s linear infinite',
                opacity: loadProgress < 100 ? 1 : 0,
                transition: 'opacity 0.3s',
              }} />
            </div>

            {/* Load message */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 'clamp(8px, 1.2vw, 10px)',
              letterSpacing: '0.15em',
              color: loadProgress >= 100 ? '#00FF88' : 'rgba(0,212,255,0.6)',
              textAlign: 'left',
              minHeight: '14px',
              transition: 'color 0.3s',
            }}>
              {loadMessage}
            </div>

            {/* Data stream rows */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {DATA_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 10px',
                    background: 'rgba(0,212,255,0.03)',
                    border: '1px solid rgba(0,212,255,0.06)',
                    borderRadius: '2px',
                    animation: `fl-data-stream 2.4s ease-in-out ${i * 0.12}s infinite`,
                    opacity: 0,
                  }}
                >
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '9px', letterSpacing: '0.1em',
                    color: 'rgba(107,114,128,0.8)',
                  }}>{row.label}</span>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px', fontWeight: 700,
                    color: row.color,
                    textShadow: `0 0 8px ${row.color}50`,
                  }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ENTER SYSTEM button */}
        {phase === 'ready' && (
          <button
            onClick={handleEnter}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              marginTop: '40px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 'clamp(10px, 1.5vw, 13px)',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: btnHover ? '#050608' : '#00D4FF',
              background: btnHover
                ? 'linear-gradient(135deg, #00D4FF, #FFD700)'
                : 'rgba(0,212,255,0.06)',
              border: `1px solid ${btnHover ? 'transparent' : 'rgba(0,212,255,0.35)'}`,
              borderRadius: '3px',
              padding: '14px 40px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.23,1,0.32,1)',
              boxShadow: btnHover
                ? '0 0 30px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)'
                : '0 0 12px rgba(0,212,255,0.1)',
              transform: btnHover ? 'scale(1.03)' : 'scale(1)',
              animation: 'fl-enter-btn-appear 0.6s cubic-bezier(0.23,1,0.32,1) both',
            }}
          >
            ENTER SYSTEM
          </button>
        )}

        {/* Skip link */}
        {(phase === 'loading' || phase === 'ready') && (
          <button
            onClick={handleEnter}
            style={{
              position: 'absolute', bottom: '28px', right: '28px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px', letterSpacing: '0.15em',
              color: 'rgba(75,85,99,0.7)',
              background: 'none', border: 'none', cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'color 0.2s',
              animation: 'fl-fade-up 0.5s ease-out 1s both',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(0,212,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(75,85,99,0.7)')}
          >
            SKIP INTRO
          </button>
        )}

        {/* Version tag */}
        {phase !== 'black' && (
          <div style={{
            position: 'absolute', bottom: '28px', left: '28px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '8px', letterSpacing: '0.15em',
            color: 'rgba(55,65,81,0.6)',
            animation: 'fl-fade-up 0.5s ease-out 1.5s both',
          }}>
            FAULTLINE v1.0 — BETA
          </div>
        )}
      </div>
    </div>
  );
}

// ── Corner bracket SVG ────────────────────────────────────────
function CornerBracket({ position, visible }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; visible: boolean }) {
  const size = 28;
  const stroke = '#00D4FF';
  const opacity = visible ? 0.4 : 0;

  const transforms: Record<string, string> = {
    'top-left': 'none',
    'top-right': 'scaleX(-1)',
    'bottom-left': 'scaleY(-1)',
    'bottom-right': 'scale(-1,-1)',
  };

  const positions: Record<string, React.CSSProperties> = {
    'top-left': { top: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
  };

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 28 28"
      style={{
        position: 'absolute',
        ...positions[position],
        opacity,
        transform: transforms[position],
        transition: 'opacity 1s ease',
        filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.5))',
      }}
    >
      <path
        d="M2 26 L2 2 L26 2"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeDasharray="60"
        strokeDashoffset="0"
        style={{ animation: visible ? 'fl-corner-draw 0.8s ease-out forwards' : undefined }}
      />
    </svg>
  );
}
