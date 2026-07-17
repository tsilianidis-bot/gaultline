/* ============================================================
   FAULTLINE — Cinematic Intro v4.0
   Three deliberate phases. No artificial loading delay.
   Feels intentional, cinematic, premium, emotionally engaging.

   PHASE 1 — FAULTLINE IDENTITY (0–3.8s)
     0.0–0.8s  : Fade in from black. PressureEngine warms.
     0.8–3.0s  : Full FAULTLINE identity on screen — logo,
                 brand, tagline, ambient particle field.
     3.0–3.8s  : Begin transition. Cyan energy gathers center.

   PHASE 2 — TRANSFORMATION (3.8–5.6s)
     Logo fades. Seismograph pulse converges. A central
     intelligence light forms. ASHA is born from FAULTLINE.

   PHASE 3 — ASHA SHOWCASE (5.6–12s)
     ASHA orb fully present. "SPIRIT OF FAULTLINE" identity.
     Supporting line. Ambient network alive. ~6–7 seconds.
     Then onComplete() fires → sign-in or dashboard.

   Skip always available top-right.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import { PressureEngine } from "@/lib/pressureEngine";
import AshaOrb from "./AshaOrb";

// ── Exported key (App.tsx uses this) ──────────────────────────
export const CINEMATIC_SEEN_KEY = "fl_cinematic_intro_v1";

// ── Props ──────────────────────────────────────────────────────
interface CinematicIntroProps {
  onComplete: () => void;
}

// ── Phase type ─────────────────────────────────────────────────
type Phase =
  | "black"          // 0–0.4s  : absolute black, engine starts
  | "faultline"      // 0.4–3.0s: full FAULTLINE identity
  | "converge"       // 3.0–3.8s: energy gathering, logo dimming
  | "transform"      // 3.8–5.6s: logo dissolves, light forms
  | "asha"           // 5.6–12s : ASHA showcase
  | "exiting";       // dissolve out

// ── Keyframes ─────────────────────────────────────────────────
const STYLES = `
@keyframes ci-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ci-scanline-reveal {
  0%   { clip-path: inset(0 0 100% 0); opacity: 0; }
  8%   { opacity: 1; }
  100% { clip-path: inset(0 0 0% 0); opacity: 1; }
}
@keyframes ci-glow-pulse {
  0%, 100% { text-shadow: 0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15); }
  50%       { text-shadow: 0 0 40px rgba(0,212,255,0.7), 0 0 100px rgba(0,212,255,0.3), 0 0 160px rgba(0,212,255,0.1); }
}
@keyframes ci-flicker {
  0%, 94%, 100% { opacity: 1; }
  95%            { opacity: 0.88; }
  97%            { opacity: 1; }
  99%            { opacity: 0.93; }
}
@keyframes ci-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ci-char-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes ci-divider-grow {
  from { width: 0%; opacity: 0; }
  to   { width: 80%; opacity: 1; }
}
@keyframes ci-corner-draw {
  from { stroke-dashoffset: 60; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ci-logo-dissolve {
  0%   { opacity: 1; filter: blur(0px) brightness(1); transform: scale(1); }
  35%  { opacity: 0.7; filter: blur(1px) brightness(1.6); transform: scale(1.02); }
  100% { opacity: 0; filter: blur(14px) brightness(4); transform: scale(1.1); }
}
@keyframes ci-energy-gather {
  0%   { opacity: 0; transform: scale(0.3) translate(var(--ex), var(--ey)); }
  60%  { opacity: 0.8; }
  100% { opacity: 0; transform: scale(0) translate(0, 0); }
}
@keyframes ci-light-form {
  0%   { opacity: 0; transform: scale(0.1); filter: blur(20px); }
  50%  { opacity: 0.9; filter: blur(6px); }
  100% { opacity: 1; transform: scale(1); filter: blur(0px); }
}
@keyframes ci-orb-emerge {
  0%   { opacity: 0; transform: scale(0.5); filter: blur(12px); }
  55%  { opacity: 0.85; filter: blur(3px); }
  100% { opacity: 1; transform: scale(1); filter: blur(0px); }
}
@keyframes ci-asha-title {
  0%   { opacity: 0; letter-spacing: 0.8em; }
  100% { opacity: 1; letter-spacing: 0.45em; }
}
@keyframes ci-asha-subtitle {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ci-ring-expand {
  0%   { r: 0; opacity: 0.6; }
  100% { r: 120; opacity: 0; }
}
@keyframes ci-network-line {
  0%   { stroke-dashoffset: 400; opacity: 0; }
  15%  { opacity: 0.35; }
  85%  { opacity: 0.35; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes ci-dot-pulse {
  0%, 100% { opacity: 0.25; r: 1.5; }
  50%       { opacity: 0.7; r: 3; }
}
@keyframes ci-exit-dissolve {
  0%   { opacity: 1; transform: scale(1); }
  30%  { opacity: 1; transform: scale(1.01); }
  100% { opacity: 0; transform: scale(1.05); }
}
@keyframes ci-seismo-converge {
  0%   { stroke-dashoffset: 0; opacity: 0.5; }
  100% { stroke-dashoffset: 600; opacity: 0; }
}
@keyframes ci-supporting-line {
  from { opacity: 0; }
  to   { opacity: 0.55; }
}
`;

// ── Typewriter hook ────────────────────────────────────────────
function useTypewriter(text: string, speed: number, active: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); idxRef.current = 0; return; }
    idxRef.current = 0; setDisplayed(""); setDone(false);
    const iv = setInterval(() => {
      idxRef.current++;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);

  return { displayed, done };
}

// ── Corner bracket ─────────────────────────────────────────────
function CornerBracket({ pos, visible }: { pos: "tl" | "tr" | "bl" | "br"; visible: boolean }) {
  const xf = { tl: "none", tr: "scaleX(-1)", bl: "scaleY(-1)", br: "scale(-1,-1)" }[pos];
  const st: React.CSSProperties = {
    position: "absolute",
    ...(pos === "tl" || pos === "bl" ? { left: 20 } : { right: 20 }),
    ...(pos === "tl" || pos === "tr" ? { top: 20 } : { bottom: 20 }),
    opacity: visible ? 0.38 : 0,
    transform: xf,
    transition: "opacity 1.2s ease",
    filter: "drop-shadow(0 0 4px rgba(0,212,255,0.45))",
  };
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" style={st}>
      <path d="M2 26 L2 2 L26 2" fill="none" stroke="#00D4FF" strokeWidth="1.5"
        strokeLinecap="square" strokeDasharray="60" strokeDashoffset="0"
        style={{ animation: visible ? "ci-corner-draw 0.9s ease-out 0.2s both" : undefined }} />
    </svg>
  );
}

// ── Ambient network SVG (ASHA phase) ──────────────────────────
const NET_PTS = Array.from({ length: 20 }, (_, i) => ({
  x: 5 + ((i * 41 + Math.sin(i * 1.7) * 90) % 90),
  y: 5 + ((i * 33 + Math.cos(i * 1.1) * 80) % 90),
}));
const NET_LINES: Array<{ x1: number; y1: number; x2: number; y2: number; d: number }> = [];
for (let i = 0; i < NET_PTS.length; i++) {
  for (let j = i + 1; j < NET_PTS.length; j++) {
    const dx = NET_PTS[i].x - NET_PTS[j].x;
    const dy = NET_PTS[i].y - NET_PTS[j].y;
    if (Math.sqrt(dx * dx + dy * dy) < 26) {
      NET_LINES.push({ x1: NET_PTS[i].x, y1: NET_PTS[i].y, x2: NET_PTS[j].x, y2: NET_PTS[j].y, d: (i + j) * 0.09 });
    }
  }
}

function AmbientNetwork({ visible }: { visible: boolean }) {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4,
      opacity: visible ? 1 : 0, transition: "opacity 1.8s cubic-bezier(0.23,1,0.32,1)",
    }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}>
        {NET_LINES.map((l, i) => (
          <line key={i} x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke="rgba(0,212,255,0.28)" strokeWidth="0.12"
            strokeDasharray="400" strokeDashoffset="400"
            style={{ animation: `ci-network-line 4s ease-in-out ${l.d}s infinite` }} />
        ))}
        {NET_PTS.map((p, i) => (
          <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="1.5" fill="rgba(0,212,255,0.45)"
            style={{ animation: `ci-dot-pulse 2.5s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </svg>
    </div>
  );
}

// ── Energy particle (converge phase) ──────────────────────────
function EnergyParticles({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 30 + Math.random() * 35;
    return {
      ex: `${Math.cos(angle) * dist}vw`,
      ey: `${Math.sin(angle) * dist}vh`,
      delay: i * 0.04,
      size: 2 + Math.random() * 3,
      color: i % 3 === 0 ? "#FFD700" : "#00D4FF",
    };
  });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          // @ts-ignore
          "--ex": p.ex, "--ey": p.ey,
          animation: `ci-energy-gather 1.2s cubic-bezier(0.23,1,0.32,1) ${p.delay}s both`,
        }} />
      ))}
    </div>
  );
}

// ── Seismograph line (FAULTLINE phase) ────────────────────────
function SeismographLine({ visible, converging }: { visible: boolean; converging: boolean }) {
  const path = "M0,50 C20,50 25,20 50,50 S75,80 100,50 S125,20 150,50 S175,80 200,50 S225,20 250,50 S275,80 300,50 S325,20 350,50 S375,80 400,50";
  return (
    <div style={{
      position: "absolute", bottom: "18%", left: 0, right: 0,
      height: "60px", pointerEvents: "none", zIndex: 3,
      opacity: visible ? (converging ? 0 : 0.22) : 0,
      transition: converging ? "opacity 1.5s ease" : "opacity 1.2s ease 1s",
    }}>
      <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="#00D4FF" strokeWidth="0.8"
          strokeDasharray="600"
          style={{ animation: converging ? "ci-seismo-converge 1.5s ease-out forwards" : undefined }} />
      </svg>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PressureEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("black");
  const [stylesInjected, setStylesInjected] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Inject styles once
  useEffect(() => {
    if (stylesInjected) return;
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    setStylesInjected(true);
    return () => { try { document.head.removeChild(el); } catch {} };
  }, [stylesInjected]);

  // PressureEngine canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new PressureEngine({ canvas: canvasRef.current, intensity: 0.65 });
    engineRef.current = engine;
    engine.start();
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvasRef.current);
    return () => { engine.stop(); ro.disconnect(); };
  }, []);

  // Phase sequencer — precise timing per spec
  useEffect(() => {
    const t = timersRef.current;
    // Phase 1: FAULTLINE identity
    t.push(setTimeout(() => {
      setPhase("faultline");
      setTimeout(() => engineRef.current?.triggerShockwave(), 300);
    }, 400));
    // Phase 1→2 boundary: begin converge
    t.push(setTimeout(() => {
      setPhase("converge");
      engineRef.current?.setIntensity(1.1);
      engineRef.current?.triggerShockwave();
    }, 3000));
    // Phase 2: transform
    t.push(setTimeout(() => {
      setPhase("transform");
    }, 3800));
    // Phase 3: ASHA showcase
    t.push(setTimeout(() => {
      setPhase("asha");
      engineRef.current?.setIntensity(0.8);
    }, 5600));
    // Auto-complete after ASHA showcase (~6.5s on screen)
    t.push(setTimeout(() => {
      handleComplete();
    }, 12100));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = useCallback(() => {
    if (phase === "exiting") return;
    setPhase("exiting");
    engineRef.current?.triggerShockwave();
    setTimeout(() => {
      engineRef.current?.stop();
      onComplete();
    }, 700);
  }, [phase, onComplete]);

  const handleSkip = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    setPhase("exiting");
    engineRef.current?.triggerShockwave();
    setTimeout(() => {
      engineRef.current?.stop();
      onComplete();
    }, 400);
  }, [onComplete]);

  // Tagline typewriter — active from faultline phase onward
  const tagline = "DETECTING HIDDEN SYSTEMIC PRESSURE IN REAL TIME";
  const { displayed: taglineText, done: taglineDone } = useTypewriter(
    tagline, 30,
    phase === "faultline" || phase === "converge"
  );

  const isExiting = phase === "exiting";
  const showLogo = phase === "faultline" || phase === "converge" || phase === "transform";
  const logoDissolving = phase === "transform";
  const logoConverging = phase === "converge";
  const showSeismo = phase === "faultline" || phase === "converge";
  const showEnergy = phase === "converge";
  const showAsha = phase === "asha" || phase === "exiting";
  const showNetwork = phase === "asha" || phase === "exiting";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FAULTLINE Intelligence Opening"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#020305",
        animation: isExiting ? "ci-exit-dissolve 0.7s cubic-bezier(0.23,1,0.32,1) forwards" : undefined,
        overflow: "hidden",
      }}
    >
      {/* PressureEngine canvas */}
      <canvas ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Ambient intelligence network */}
      <AmbientNetwork visible={showNetwork} />

      {/* Energy particles converging to center */}
      <EnergyParticles visible={showEnergy} />

      {/* Seismograph line */}
      <SeismographLine visible={showSeismo} converging={logoConverging} />

      {/* CRT scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.010) 2px, rgba(0,212,255,0.010) 4px)",
        opacity: phase === "black" ? 0 : 0.55,
        transition: "opacity 1.2s",
      }} />

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 11,
        background: "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.7) 100%)",
      }} />

      {/* Corner brackets */}
      <CornerBracket pos="tl" visible={showLogo || showAsha} />
      <CornerBracket pos="tr" visible={showLogo || showAsha} />
      <CornerBracket pos="bl" visible={showLogo || showAsha} />
      <CornerBracket pos="br" visible={showLogo || showAsha} />

      {/* ── Content ── */}
      <div style={{
        position: "relative", zIndex: 20,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100%", padding: "0 24px",
        textAlign: "center",
      }}>

        {/* ═══════════════════════════════════════════════════
            PHASE 1 + 2: FAULTLINE IDENTITY
            Full identity on screen 0.8–3.0s. Begins dissolving at 3.0s.
            ═══════════════════════════════════════════════════ */}
        {showLogo && (
          <div style={{
            animation: logoDissolving
              ? "ci-logo-dissolve 1.8s cubic-bezier(0.23,1,0.32,1) forwards"
              : "ci-scanline-reveal 1.2s cubic-bezier(0.23,1,0.32,1) forwards",
            marginBottom: "8px",
            pointerEvents: "none",
            // Dim slightly during converge to signal transition beginning
            filter: logoConverging ? "brightness(0.85)" : undefined,
            transition: logoConverging ? "filter 0.8s ease" : undefined,
          }}>
            {/* FAULTLINE wordmark */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(52px, 10.5vw, 100px)",
              letterSpacing: "0.18em",
              color: "#F0F4FF",
              lineHeight: 1,
              animation: logoDissolving ? undefined : "ci-glow-pulse 3s ease-in-out 1.2s infinite, ci-flicker 9s ease-in-out 3s infinite",
              textShadow: "0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)",
            }}>
              FAULT<span style={{ color: "#00D4FF" }}>LINE</span>
            </div>

            {/* Divider */}
            <div style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.65), rgba(255,215,0,0.4), transparent)",
              margin: "12px auto 10px",
              animation: "ci-divider-grow 0.9s ease-out 0.9s both",
            }} />

            {/* Sub-label */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(9px, 1.5vw, 13px)",
              letterSpacing: "0.38em",
              color: "rgba(0,212,255,0.72)",
              textTransform: "uppercase",
              animation: "ci-fade-up 0.8s ease-out 1.1s both",
            }}>
              MACROECONOMIC RISK INTELLIGENCE
            </div>
          </div>
        )}

        {/* Tagline typewriter — visible during FAULTLINE phase only */}
        {(phase === "faultline" || phase === "converge") && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(9px, 1.6vw, 12px)",
            letterSpacing: "0.22em",
            color: "rgba(148,163,184,0.75)",
            marginTop: "20px",
            minHeight: "18px",
            animation: "ci-fade-up 0.6s ease-out 1.4s both",
            opacity: logoConverging ? 0 : undefined,
            transition: logoConverging ? "opacity 0.8s ease" : undefined,
          }}>
            {taglineText}
            {!taglineDone && (
              <span style={{ animation: "ci-char-blink 0.7s step-end infinite", color: "#00D4FF" }}>▌</span>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            PHASE 3: ASHA SHOWCASE
            ~6–7 seconds. ASHA is the intelligence within FAULTLINE.
            ═══════════════════════════════════════════════════ */}
        {showAsha && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "22px",
            animation: "ci-orb-emerge 1.6s cubic-bezier(0.23,1,0.32,1) forwards",
          }}>
            {/* ASHA Orb — large, prominent */}
            <AshaOrb
              regimeState="calm"
              size={88}
              isListening={false}
              label={undefined}
            />

            {/* ASHA name */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(36px, 6vw, 64px)",
              letterSpacing: "0.45em",
              color: "#00D4FF",
              lineHeight: 1,
              textShadow: "0 0 30px rgba(0,212,255,0.6), 0 0 80px rgba(0,212,255,0.2)",
              animation: "ci-asha-title 1.2s cubic-bezier(0.23,1,0.32,1) 0.2s both",
            }}>
              ASHA
            </div>

            {/* SPIRIT OF FAULTLINE */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(9px, 1.5vw, 12px)",
              letterSpacing: "0.35em",
              color: "rgba(255,215,0,0.75)",
              textTransform: "uppercase",
              animation: "ci-asha-subtitle 0.8s ease-out 0.7s both",
            }}>
              SPIRIT OF FAULTLINE
            </div>

            {/* Supporting line */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(8px, 1.2vw, 11px)",
              letterSpacing: "0.18em",
              color: "rgba(148,163,184,0.55)",
              textTransform: "uppercase",
              animation: "ci-supporting-line 1s ease-out 1.4s both",
            }}>
              THE INTELLIGENCE BENEATH THE SURFACE
            </div>

            {/* Expanding ring — ambient energy */}
            <svg
              width="0" height="0"
              viewBox="0 0 240 240"
              style={{
                position: "absolute",
                width: "clamp(200px, 40vw, 340px)",
                height: "clamp(200px, 40vw, 340px)",
                pointerEvents: "none",
                zIndex: -1,
                opacity: 0.12,
              }}
            >
              <circle cx="120" cy="120" r="0" fill="none" stroke="#00D4FF" strokeWidth="1"
                style={{ animation: "ci-ring-expand 3s ease-out 0.5s infinite" }} />
              <circle cx="120" cy="120" r="0" fill="none" stroke="#00D4FF" strokeWidth="0.5"
                style={{ animation: "ci-ring-expand 3s ease-out 1.5s infinite" }} />
            </svg>
          </div>
        )}
      </div>

      {/* Skip button — always visible */}
      <button
        onClick={handleSkip}
        aria-label="Skip introduction"
        style={{
          position: "absolute", top: "20px", right: "20px", zIndex: 30,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "4px",
          padding: "8px 18px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px", letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.30)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          animation: "ci-fade-up 0.5s ease-out 1.2s both",
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = "rgba(0,212,255,0.75)";
          b.style.borderColor = "rgba(0,212,255,0.30)";
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = "rgba(255,255,255,0.30)";
          b.style.borderColor = "rgba(255,255,255,0.10)";
        }}
      >
        SKIP INTRO
      </button>

      {/* Version tag */}
      <div style={{
        position: "absolute", bottom: "24px", left: "24px", zIndex: 30,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "8px", letterSpacing: "0.15em",
        color: "rgba(55,65,81,0.55)",
        animation: "ci-fade-up 0.5s ease-out 1.6s both",
      }}>
        FAULTLINE v1.0 — BETA
      </div>
    </div>
  );
}
