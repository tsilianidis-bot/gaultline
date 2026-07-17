/* ============================================================
   FAULTLINE — Cinematic Intro v5.0
   Three deliberate phases. Premium quality.

   PHASE 1 — FAULTLINE IDENTITY (0.4–3.0s)
     Full wordmark. Tagline. Seismograph. PressureEngine.

   PHASE 2 — TRANSFORMATION (3.0–5.6s)
     Logo dissolves. Energy converges. Intelligence awakens.

   PHASE 3 — ASHA REVEAL (5.6–12.5s)
     AshaIntelligenceCanvas takes over the full screen.
     One living orb. Breathing. Filaments. Wisps.
     Text fades in: ASHA → SPIRIT OF FAULTLINE → tagline.
     Orb brightens → particle dissolve → dashboard.

   Skip always available top-right.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import { PressureEngine } from "@/lib/pressureEngine";
import AshaIntelligenceCanvas, { type AshaCanvasHandle } from "./AshaIntelligenceCanvas";
import { CinematicAudioEngine } from "@/lib/CinematicAudioEngine";

// ── Exported key ───────────────────────────────────────────────
export const CINEMATIC_SEEN_KEY = "fl_cinematic_intro_v1";

// ── Props ──────────────────────────────────────────────────────
interface CinematicIntroProps {
  onComplete: () => void;
}

// ── Phase type ─────────────────────────────────────────────────
type Phase =
  | "black"       // 0–0.4s
  | "faultline"   // 0.4–3.0s  — full FAULTLINE identity
  | "converge"    // 3.0–3.8s  — energy gathering, logo dims
  | "transform"   // 3.8–5.6s  — logo dissolves
  | "asha"        // 5.6–12.5s — ASHA canvas reveal
  | "exiting";    // particle dissolve → onComplete

// ── Text reveal stages within asha phase ──────────────────────
// These are offsets from when the asha phase starts (elapsed - 5.6)
const ASHA_TEXT_DELAYS = {
  name:      1.4,   // "ASHA" fades in 1.4s after orb phase starts
  subtitle:  2.6,   // "SPIRIT OF FAULTLINE"
  tagline:   3.6,   // "The Intelligence Beneath the Surface."
};

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
  35%  { opacity: 0.65; filter: blur(1.5px) brightness(1.8); transform: scale(1.02); }
  100% { opacity: 0; filter: blur(16px) brightness(4.5); transform: scale(1.12); }
}
@keyframes ci-seismo-fade {
  from { opacity: 0.22; }
  to   { opacity: 0; }
}
@keyframes ci-exit-dissolve {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes ci-asha-name {
  0%   { opacity: 0; letter-spacing: 0.9em; filter: blur(4px); }
  100% { opacity: 1; letter-spacing: 0.45em; filter: blur(0px); }
}
@keyframes ci-asha-sub {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ci-asha-tag {
  from { opacity: 0; }
  to   { opacity: 0.52; }
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
    opacity: visible ? 0.32 : 0,
    transform: xf,
    transition: "opacity 1.4s ease",
    filter: "drop-shadow(0 0 4px rgba(0,212,255,0.4))",
  };
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" style={st}>
      <path d="M2 26 L2 2 L26 2" fill="none" stroke="#00D4FF" strokeWidth="1.5"
        strokeLinecap="square" strokeDasharray="60" strokeDashoffset="0"
        style={{ animation: visible ? "ci-corner-draw 0.9s ease-out 0.2s both" : undefined }} />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const pressureCanvasRef = useRef<HTMLCanvasElement>(null);
  const pressureEngineRef = useRef<PressureEngine | null>(null);
  const ashaCanvasRef     = useRef<AshaCanvasHandle>(null);

  const [phase, setPhase]               = useState<Phase>("black");
  const [stylesInjected, setStylesInjected] = useState(false);
  const [ashaElapsed, setAshaElapsed]   = useState(0);  // seconds since asha phase started
  const ashaStartRef = useRef(0);
  const ashaRafRef   = useRef(0);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioRef     = useRef<CinematicAudioEngine | null>(null);
  const audioStartedRef = useRef(false);
  // Chime refs — track which chimes have fired to avoid double-firing
  const chimesFiredRef = useRef({ name: false, subtitle: false, tagline: false });

  // Inject styles once
  useEffect(() => {
    if (stylesInjected) return;
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    setStylesInjected(true);
    return () => { try { document.head.removeChild(el); } catch {} };
  }, [stylesInjected]);

  // PressureEngine for FAULTLINE phase
  useEffect(() => {
    if (!pressureCanvasRef.current) return;
    const engine = new PressureEngine({ canvas: pressureCanvasRef.current, intensity: 0.65 });
    pressureEngineRef.current = engine;
    engine.start();
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(pressureCanvasRef.current);
    return () => { engine.stop(); ro.disconnect(); };
  }, []);

  // Initialize audio engine — deferred until first user interaction or auto-start
  useEffect(() => {
    const engine = new CinematicAudioEngine();
    audioRef.current = engine;

    // Attempt auto-start (works if user has already interacted with the page)
    const tryStart = () => {
      if (audioStartedRef.current) return;
      audioStartedRef.current = true;
      engine.start(0.5);
      engine.playFaultlinePhase();
    };

    // Try immediately — may succeed if AudioContext is already unlocked
    setTimeout(tryStart, 420);

    // Also listen for first interaction as a fallback
    const onInteract = () => {
      tryStart();
      window.removeEventListener("click", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
    window.addEventListener("click", onInteract);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("touchstart", onInteract);

    return () => {
      window.removeEventListener("click", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("touchstart", onInteract);
      engine.stop(0.4);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase sequencer
  useEffect(() => {
    const t = timersRef.current;
    t.push(setTimeout(() => {
      setPhase("faultline");
      setTimeout(() => pressureEngineRef.current?.triggerShockwave(), 300);
    }, 400));
    t.push(setTimeout(() => {
      setPhase("converge");
      pressureEngineRef.current?.setIntensity(1.1);
      pressureEngineRef.current?.triggerShockwave();
      // Audio: begin energy swell, seismic fades
      audioRef.current?.playConvergePhase();
    }, 3000));
    t.push(setTimeout(() => {
      setPhase("transform");
      // Audio: swell peaks, atmospheric drone fades
      audioRef.current?.playTransformPhase();
    }, 3800));
    t.push(setTimeout(() => {
      setPhase("asha");
      pressureEngineRef.current?.stop();
      ashaStartRef.current = performance.now();
      // Audio: intelligence drone + holographic shimmer + system online tone
      audioRef.current?.playAshaPhase();
    }, 5600));
    // Auto-complete after ~6.8s of ASHA showcase
    t.push(setTimeout(() => triggerExit(), 12400));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track elapsed time within asha phase for text reveals
  useEffect(() => {
    if (phase !== "asha") return;
    function tick() {
      setAshaElapsed((performance.now() - ashaStartRef.current) / 1000);
      ashaRafRef.current = requestAnimationFrame(tick);
    }
    ashaRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ashaRafRef.current);
  }, [phase]);

  const triggerExit = useCallback(() => {
    if (phase === "exiting") return;
    setPhase("exiting");
    cancelAnimationFrame(ashaRafRef.current);
    // Audio: fade out
    audioRef.current?.stop(1.2);
    // Tell canvas to dissolve; onDissolveComplete fires ~1.4s later
    ashaCanvasRef.current?.dissolve();
  }, [phase]);

  const handleSkip = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    cancelAnimationFrame(ashaRafRef.current);
    pressureEngineRef.current?.stop();
    audioRef.current?.stop(0.35);
    setPhase("exiting");
    // If in asha phase, dissolve the canvas; otherwise just complete immediately
    if (phase === "asha") {
      ashaCanvasRef.current?.dissolve();
    } else {
      setTimeout(onComplete, 400);
    }
  }, [phase, onComplete]);

  const handleDissolveComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Tagline typewriter during FAULTLINE phase
  const tagline = "DETECTING HIDDEN SYSTEMIC PRESSURE IN REAL TIME";
  const { displayed: taglineText, done: taglineDone } = useTypewriter(
    tagline, 30,
    phase === "faultline" || phase === "converge"
  );

  const showPressureCanvas = phase !== "asha" && phase !== "exiting";
  const showLogo           = phase === "faultline" || phase === "converge" || phase === "transform";
  const logoDissolving     = phase === "transform";
  const logoConverging     = phase === "converge";
  const showSeismo         = phase === "faultline" || phase === "converge";
  const showAshaCanvas     = phase === "asha" || phase === "exiting";

  // Text reveal within asha phase
  const showAshaName     = ashaElapsed >= ASHA_TEXT_DELAYS.name;
  const showAshaSubtitle = ashaElapsed >= ASHA_TEXT_DELAYS.subtitle;
  const showAshaTagline  = ashaElapsed >= ASHA_TEXT_DELAYS.tagline;

  // Fire chimes when text reveals become visible (once each)
  useEffect(() => {
    if (showAshaName && !chimesFiredRef.current.name) {
      chimesFiredRef.current.name = true;
      audioRef.current?.playChime(0);
    }
  }, [showAshaName]);
  useEffect(() => {
    if (showAshaSubtitle && !chimesFiredRef.current.subtitle) {
      chimesFiredRef.current.subtitle = true;
      audioRef.current?.playChime(1);
    }
  }, [showAshaSubtitle]);
  useEffect(() => {
    if (showAshaTagline && !chimesFiredRef.current.tagline) {
      chimesFiredRef.current.tagline = true;
      audioRef.current?.playChime(2);
    }
  }, [showAshaTagline]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FAULTLINE Intelligence Opening"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#020305",
        overflow: "hidden",
      }}
    >
      {/* ── PressureEngine canvas (FAULTLINE phases) ── */}
      <canvas
        ref={pressureCanvasRef}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          opacity: showPressureCanvas ? 1 : 0,
          transition: "opacity 1.2s ease",
        }}
      />

      {/* ── ASHA Intelligence Canvas (full screen, asha + exiting phases) ── */}
      {showAshaCanvas && (
        <AshaIntelligenceCanvas
          ref={ashaCanvasRef}
          onDissolveComplete={handleDissolveComplete}
          speed={1}
        />
      )}

      {/* ── CRT scanlines ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.009) 2px, rgba(0,212,255,0.009) 4px)",
        opacity: phase === "black" ? 0 : 0.5,
        transition: "opacity 1.2s",
      }} />

      {/* ── Vignette ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 11,
        background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)",
      }} />

      {/* ── Corner brackets ── */}
      <CornerBracket pos="tl" visible={showLogo || showAshaCanvas} />
      <CornerBracket pos="tr" visible={showLogo || showAshaCanvas} />
      <CornerBracket pos="bl" visible={showLogo || showAshaCanvas} />
      <CornerBracket pos="br" visible={showLogo || showAshaCanvas} />

      {/* ── Seismograph line ── */}
      {showSeismo && (
        <div style={{
          position: "absolute", bottom: "16%", left: 0, right: 0,
          height: "60px", pointerEvents: "none", zIndex: 12,
          animation: logoConverging ? "ci-seismo-fade 1.2s ease-out forwards" : undefined,
          opacity: 0.2,
        }}>
          <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none">
            <path
              d="M0,30 C20,30 25,10 50,30 S75,50 100,30 S125,10 150,30 S175,50 200,30 S225,10 250,30 S275,50 300,30 S325,10 350,30 S375,50 400,30"
              fill="none" stroke="#00D4FF" strokeWidth="0.9" />
          </svg>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          FAULTLINE IDENTITY CONTENT (phases: faultline, converge, transform)
          ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 20,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "0 24px",
        pointerEvents: "none",
        opacity: showLogo ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        {showLogo && (
          <div style={{
            animation: logoDissolving
              ? "ci-logo-dissolve 1.8s cubic-bezier(0.23,1,0.32,1) forwards"
              : "ci-scanline-reveal 1.2s cubic-bezier(0.23,1,0.32,1) forwards",
            marginBottom: "8px",
            filter: logoConverging ? "brightness(0.82)" : undefined,
            transition: logoConverging ? "filter 0.9s ease" : undefined,
          }}>
            {/* Wordmark */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(52px, 10.5vw, 100px)",
              letterSpacing: "0.18em",
              color: "#F0F4FF",
              lineHeight: 1,
              animation: logoDissolving
                ? undefined
                : "ci-glow-pulse 3s ease-in-out 1.2s infinite, ci-flicker 9s ease-in-out 3s infinite",
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
              animation: "ci-fade-up 0.8s ease-out 1.1s both",
            }}>
              MACROECONOMIC RISK INTELLIGENCE
            </div>
          </div>
        )}

        {/* Tagline */}
        {(phase === "faultline" || phase === "converge") && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(9px, 1.6vw, 12px)",
            letterSpacing: "0.22em",
            color: "rgba(148,163,184,0.72)",
            marginTop: "20px",
            minHeight: "18px",
            animation: "ci-fade-up 0.6s ease-out 1.4s both",
            opacity: logoConverging ? 0 : undefined,
            transition: logoConverging ? "opacity 0.7s ease" : undefined,
          }}>
            {taglineText}
            {!taglineDone && (
              <span style={{ animation: "ci-char-blink 0.7s step-end infinite", color: "#00D4FF" }}>▌</span>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ASHA TEXT OVERLAYS (phase: asha, exiting)
          Positioned in the lower third so they don't obscure the orb.
          ═══════════════════════════════════════════════════════ */}
      {showAshaCanvas && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 25,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "0 24px",
          pointerEvents: "none",
        }}>
          {/* Spacer — push text below the orb */}
          <div style={{ flex: "0 0 52%" }} />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            {/* ASHA */}
            {showAshaName && (
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(32px, 5.5vw, 58px)",
                letterSpacing: "0.45em",
                color: "#00D4FF",
                lineHeight: 1,
                textShadow: "0 0 30px rgba(0,212,255,0.55), 0 0 80px rgba(0,212,255,0.18)",
                animation: "ci-asha-name 1.4s cubic-bezier(0.23,1,0.32,1) forwards",
              }}>
                ASHA
              </div>
            )}

            {/* SPIRIT OF FAULTLINE */}
            {showAshaSubtitle && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "clamp(9px, 1.4vw, 12px)",
                letterSpacing: "0.35em",
                color: "rgba(255,215,0,0.78)",
                animation: "ci-asha-sub 0.9s ease-out forwards",
              }}>
                SPIRIT OF FAULTLINE
              </div>
            )}

            {/* Tagline */}
            {showAshaTagline && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "clamp(8px, 1.15vw, 11px)",
                letterSpacing: "0.16em",
                color: "rgba(148,163,184,0.52)",
                marginTop: "2px",
                animation: "ci-asha-tag 1.2s ease-out forwards",
              }}>
                THE INTELLIGENCE BENEATH THE SURFACE
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Skip button ── */}
      <button
        onClick={handleSkip}
        aria-label="Skip introduction"
        style={{
          position: "absolute", top: "20px", right: "20px", zIndex: 40,
          background: "rgba(0,0,0,0.32)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "4px",
          padding: "8px 18px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px", letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.28)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          animation: "ci-fade-up 0.5s ease-out 1.2s both",
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = "rgba(0,212,255,0.75)";
          b.style.borderColor = "rgba(0,212,255,0.28)";
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = "rgba(255,255,255,0.28)";
          b.style.borderColor = "rgba(255,255,255,0.09)";
        }}
      >
        SKIP INTRO
      </button>

      {/* Version tag */}
      <div style={{
        position: "absolute", bottom: "22px", left: "22px", zIndex: 40,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "8px", letterSpacing: "0.15em",
        color: "rgba(55,65,81,0.5)",
        animation: "ci-fade-up 0.5s ease-out 1.6s both",
      }}>
        FAULTLINE v1.0 — BETA
      </div>
    </div>
  );
}
