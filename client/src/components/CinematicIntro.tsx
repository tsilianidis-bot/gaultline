/* ============================================================
   FAULTLINE — Intelligence Opening v3.0
   Creative direction: evolve the original FAULTLINE intro
   atmosphere into ASHA's intelligence space.

   Phase flow (single continuous transformation, no scene cuts):
     0–400ms    : Black. PressureEngine canvas warms up.
     400–1600ms : FAULTLINE wordmark scanline reveal (original identity)
     1600–2800ms: Tagline typewrite + loading sequence begins
     2800–5200ms: Loading bar fills, data streams appear (original)
     5200–7000ms: LOGO TRANSFORMATION — wordmark dissolves into
                  light particles / neural connections / data streams
     7000–9000ms: ASHA MATERIALIZES — orb converges from the network.
                  She has been working. She is already present.
     9000–10500ms: One concise live market sentence from ASHA.
     10500ms+   : Immediate dashboard entry. No button required.
                  (Skip always available top-right)
   ============================================================ */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PressureEngine } from "@/lib/pressureEngine";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEngine } from "@/contexts/EngineContext";
import AshaOrb from "./AshaOrb";

// ── Types ─────────────────────────────────────────────────────
type Phase =
  | "black"
  | "logo-reveal"
  | "loading"
  | "transform"
  | "asha-materialize"
  | "asha-speaks"
  | "exiting";

export interface SceneHookPayload {
  scene: number;
  pressureScore: number;
  regime: string;
}

interface CinematicIntroProps {
  onComplete: () => void;
  onSceneEnter?: (payload: SceneHookPayload) => void;
  onSceneExit?: (payload: SceneHookPayload) => void;
}

// ── Keyframes injected once ────────────────────────────────────
const STYLES = `
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
@keyframes fl-corner-draw {
  from { stroke-dashoffset: 60; }
  to   { stroke-dashoffset: 0; }
}
@keyframes fl-logo-dissolve {
  0%   { opacity: 1; filter: blur(0px) brightness(1); transform: scale(1); }
  40%  { opacity: 0.6; filter: blur(2px) brightness(1.8); transform: scale(1.04); }
  100% { opacity: 0; filter: blur(12px) brightness(3); transform: scale(1.12); }
}
@keyframes fl-particle-converge {
  0%   { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
  30%  { opacity: 1; }
  100% { opacity: 0.7; transform: translate(0, 0) scale(1); }
}
@keyframes fl-neural-pulse {
  0%, 100% { opacity: 0.15; stroke-dashoffset: 200; }
  50%       { opacity: 0.5; stroke-dashoffset: 0; }
}
@keyframes fl-orb-emerge {
  0%   { opacity: 0; transform: scale(0.4); filter: blur(16px); }
  60%  { opacity: 0.8; filter: blur(4px); }
  100% { opacity: 1; transform: scale(1); filter: blur(0px); }
}
@keyframes fl-sentence-appear {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fl-network-line {
  0%   { stroke-dashoffset: 300; opacity: 0; }
  20%  { opacity: 0.4; }
  80%  { opacity: 0.4; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes fl-dot-pulse {
  0%, 100% { r: 2; opacity: 0.3; }
  50%       { r: 4; opacity: 0.8; }
}
`;

// ── Loading messages ───────────────────────────────────────────
const LOAD_MESSAGES = [
  "INITIALIZING PRESSURE ENGINE...",
  "LOADING FRED MACROECONOMIC FEEDS...",
  "CALIBRATING SYSTEMIC RISK DOMAINS...",
  "COMPUTING SCENARIO PROBABILITIES...",
  "ANALYZING HISTORICAL ANALOGS...",
  "DETECTING REGIME SIGNALS...",
  "SYNCHRONIZING NEURAL INDICATORS...",
  "SYSTEM READY.",
];

const DATA_ROWS = [
  { label: "DGS10",        color: "#00D4FF" },
  { label: "T10Y2Y",       color: "#00FF88" },
  { label: "BAMLH0A0HYM2", color: "#FF9500" },
  { label: "NFCI",         color: "#00D4FF" },
  { label: "UNRATE",       color: "#FFD700" },
  { label: "SOFR",         color: "#00FF88" },
];

// ── Typewriter hook ────────────────────────────────────────────
function useTypewriter(text: string, speed: number, active: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); idxRef.current = 0; return; }
    idxRef.current = 0;
    setDisplayed("");
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

// ── Corner bracket ─────────────────────────────────────────────
function CornerBracket({ position, visible }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right"; visible: boolean }) {
  const transforms: Record<string, string> = {
    "top-left": "none", "top-right": "scaleX(-1)",
    "bottom-left": "scaleY(-1)", "bottom-right": "scale(-1,-1)",
  };
  const positions: Record<string, React.CSSProperties> = {
    "top-left": { top: 20, left: 20 }, "top-right": { top: 20, right: 20 },
    "bottom-left": { bottom: 20, left: 20 }, "bottom-right": { bottom: 20, right: 20 },
  };
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" style={{
      position: "absolute", ...positions[position],
      opacity: visible ? 0.4 : 0,
      transform: transforms[position],
      transition: "opacity 1s ease",
      filter: "drop-shadow(0 0 4px rgba(0,212,255,0.5))",
    }}>
      <path d="M2 26 L2 2 L26 2" fill="none" stroke="#00D4FF" strokeWidth="1.5"
        strokeLinecap="square" strokeDasharray="60" strokeDashoffset="0"
        style={{ animation: visible ? "fl-corner-draw 0.8s ease-out forwards" : undefined }} />
    </svg>
  );
}

// ── Neural network overlay (transform + asha phases) ──────────
function NeuralNetwork({ visible, intensity }: { visible: boolean; intensity: number }) {
  const lines = useMemo(() => {
    const pts = Array.from({ length: 18 }, (_, i) => ({
      x: 10 + (i * 37 + Math.sin(i * 1.3) * 80) % 80,
      y: 10 + (i * 29 + Math.cos(i * 0.9) * 70) % 80,
    }));
    const connections: Array<{ x1: number; y1: number; x2: number; y2: number; delay: number }> = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < 28) {
          connections.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, delay: (i + j) * 0.08 });
        }
      }
    }
    return { pts, connections };
  }, []);

  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
      opacity: visible ? intensity : 0,
      transition: "opacity 1.5s cubic-bezier(0.23,1,0.32,1)",
    }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}>
        {lines.connections.map((l, i) => (
          <line key={i} x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke="rgba(0,212,255,0.35)" strokeWidth="0.15"
            strokeDasharray="300" strokeDashoffset="300"
            style={{ animation: `fl-network-line 3s ease-in-out ${l.delay}s infinite` }} />
        ))}
        {lines.pts.map((p, i) => (
          <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="2" fill="rgba(0,212,255,0.5)"
            style={{ animation: `fl-dot-pulse 2s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </svg>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export const CINEMATIC_SEEN_KEY = "fl_cinematic_intro_v1";

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PressureEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("black");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState(LOAD_MESSAGES[0]);
  const [loadMsgIdx, setLoadMsgIdx] = useState(0);
  const [stylesInjected, setStylesInjected] = useState(false);
  const [ashaGreeting, setAshaGreeting] = useState("");
  const [greetingReady, setGreetingReady] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { user } = useAuth();
  const { output, isLoading: engineLoading } = useEngine();

  // Inject styles once
  useEffect(() => {
    if (stylesInjected) return;
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    setStylesInjected(true);
    return () => { try { document.head.removeChild(el); } catch {} };
  }, [stylesInjected]);

  // Start PressureEngine canvas (same engine as original intro)
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
    const t = timersRef.current;
    t.push(setTimeout(() => setPhase("logo-reveal"), 400));
    t.push(setTimeout(() => setPhase("loading"), 1600));
    t.push(setTimeout(() => {
      setPhase("transform");
      engineRef.current?.setIntensity(1.2);
      engineRef.current?.triggerShockwave();
    }, 5200));
    t.push(setTimeout(() => {
      setPhase("asha-materialize");
      engineRef.current?.setIntensity(0.9);
    }, 7000));
    t.push(setTimeout(() => setPhase("asha-speaks"), 9000));
    return () => t.forEach(clearTimeout);
  }, []);

  // Loading bar progress
  useEffect(() => {
    if (phase !== "loading") return;
    let progress = 0;
    const iv = setInterval(() => {
      progress = Math.min(100, progress + (100 / (3600 / 40)) * (0.8 + Math.random() * 0.4));
      setLoadProgress(progress);
      if (progress >= 100) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [phase]);

  // Loading message cycling
  useEffect(() => {
    if (phase !== "loading") return;
    const iv = setInterval(() => {
      setLoadMsgIdx(i => {
        const next = Math.min(i + 1, LOAD_MESSAGES.length - 1);
        setLoadMessage(LOAD_MESSAGES[next]);
        return next;
      });
    }, 450);
    return () => clearInterval(iv);
  }, [phase]);

  // Trigger shockwave on logo reveal
  useEffect(() => {
    if (phase === "logo-reveal") setTimeout(() => engineRef.current?.triggerShockwave(), 200);
  }, [phase]);

  // Fetch ASHA greeting early (during loading phase) so it's ready when needed
  const greetingMutation = trpc.asha.dailyGreeting.useMutation();
  const greetingFetched = useRef(false);

  useEffect(() => {
    if (phase !== "loading" || greetingFetched.current || engineLoading) return;
    greetingFetched.current = true;
    const name = user?.name?.split(" ")[0] || undefined;
    const ctx = {
      pressureScore: output.overall.score,
      regime: output.regime.label,
      regimeConfidence: 85,
      narrative: output.narrative.summary,
      trend: output.overall.score > 5 ? "rising" : "stable",
      keyDrivers: output.domains.slice(0, 3).map(d => d.label),
    };
    const fallback = `Welcome. I've been monitoring today's market. Here's what's building beneath the surface.`;
    greetingMutation.mutateAsync({ userName: name, engineContext: ctx })
      .then(res => {
        // Trim to one concise sentence
        const full = res.greeting || fallback;
        const firstSentence = full.split(/[.!?]/)[0].trim();
        setAshaGreeting(firstSentence.length > 20 ? firstSentence + "." : fallback);
        setGreetingReady(true);
      })
      .catch(() => {
        setAshaGreeting(fallback);
        setGreetingReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, engineLoading]);

  // Auto-complete after asha-speaks phase (brief pause then enter)
  useEffect(() => {
    if (phase !== "asha-speaks") return;
    // Wait for greeting to be ready (max 3s), then auto-complete after 2.5s display
    const maxWait = setTimeout(() => {
      if (!greetingReady) {
        setAshaGreeting("Welcome. I've been monitoring today's market. Here's what's building beneath the surface.");
        setGreetingReady(true);
      }
    }, 3000);
    return () => clearTimeout(maxWait);
  }, [phase, greetingReady]);

  useEffect(() => {
    if (phase !== "asha-speaks" || !greetingReady) return;
    const t = setTimeout(() => handleComplete(), 3500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, greetingReady]);

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

  // Typewriter for tagline
  const tagline = "DETECTING HIDDEN SYSTEMIC PRESSURE IN REAL TIME";
  const { displayed: taglineText, done: taglineDone } = useTypewriter(
    tagline, 28,
    phase === "loading" || phase === "transform" || phase === "asha-materialize" || phase === "asha-speaks"
  );

  // Typewriter for ASHA sentence
  const { displayed: ashaText } = useTypewriter(
    ashaGreeting, 32,
    phase === "asha-speaks" && greetingReady
  );

  const isExiting = phase === "exiting";
  const showLogo = phase !== "black";
  const showLoading = phase === "loading" || phase === "transform";
  const showTransform = phase === "transform" || phase === "asha-materialize" || phase === "asha-speaks";
  const showAsha = phase === "asha-materialize" || phase === "asha-speaks";
  const showSentence = phase === "asha-speaks" && greetingReady;

  const pressureColor = output.overall.riskLevel === "critical" ? "#FF3B5C"
    : output.overall.riskLevel === "high" ? "#FF6B35"
    : output.overall.riskLevel === "elevated" ? "#FFAA00"
    : "#00D4FF";

  const regimeState = (output.overall.riskLevel === "critical" || output.overall.riskLevel === "high")
    ? "critical" as const
    : (output.overall.riskLevel === "elevated" || output.overall.riskLevel === "moderate")
    ? "rising" as const
    : "calm" as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FAULTLINE Intelligence Opening"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#020305",
        animation: isExiting ? "fl-exit-dissolve 0.7s cubic-bezier(0.23,1,0.32,1) forwards" : undefined,
        overflow: "hidden",
      }}
    >
      {/* PressureEngine canvas — same as original intro */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* Neural network overlay — fades in during transform phase */}
      <NeuralNetwork visible={showTransform} intensity={showAsha ? 0.6 : 0.35} />

      {/* CRT scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 4px)",
        opacity: phase === "black" ? 0 : 0.6,
        transition: "opacity 1.2s",
      }} />

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 11,
        background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)",
      }} />

      {/* Corner brackets */}
      <CornerBracket position="top-left" visible={showLogo} />
      <CornerBracket position="top-right" visible={showLogo} />
      <CornerBracket position="bottom-left" visible={showLogo} />
      <CornerBracket position="bottom-right" visible={showLogo} />

      {/* Content layer */}
      <div style={{
        position: "relative", zIndex: 20,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100%", padding: "0 24px",
        textAlign: "center",
      }}>

        {/* ── PHASE 1–2: FAULTLINE wordmark (original identity) ── */}
        {showLogo && (
          <div style={{
            animation: showTransform
              ? "fl-logo-dissolve 1.8s cubic-bezier(0.23,1,0.32,1) forwards"
              : "fl-scanline-reveal 1.2s cubic-bezier(0.23,1,0.32,1) forwards, fl-flicker 8s ease-in-out 2s infinite",
            marginBottom: "8px",
            pointerEvents: "none",
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(48px, 10vw, 96px)",
              letterSpacing: "0.18em",
              color: "#F0F4FF",
              lineHeight: 1,
              animation: showTransform ? undefined : "fl-glow-pulse 3s ease-in-out 1.2s infinite",
              textShadow: `0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)`,
            }}>
              FAULT<span style={{ color: "#00D4FF" }}>LINE</span>
            </div>
            <div style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(255,215,0,0.4), transparent)",
              margin: "10px auto", width: "80%",
              animation: "fl-fade-up 0.8s ease-out 0.8s both",
            }} />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(9px, 1.5vw, 12px)",
              letterSpacing: "0.35em",
              color: "rgba(0,212,255,0.7)",
              animation: "fl-fade-up 0.8s ease-out 1s both",
            }}>
              MACROECONOMIC RISK INTELLIGENCE
            </div>
          </div>
        )}

        {/* ── Tagline typewriter ── */}
        {(phase === "loading" || showTransform) && !showAsha && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(9px, 1.8vw, 13px)",
            letterSpacing: "0.2em",
            color: "rgba(148,163,184,0.8)",
            marginTop: "24px", marginBottom: "32px",
            minHeight: "20px",
            animation: "fl-fade-up 0.6s ease-out both",
            opacity: showTransform ? 0 : 1,
            transition: "opacity 1s ease",
          }}>
            {taglineText}
            {!taglineDone && (
              <span style={{ animation: "fl-char-blink 0.7s step-end infinite", color: "#00D4FF" }}>▌</span>
            )}
          </div>
        )}

        {/* ── Loading bar + data rows ── */}
        {showLoading && !showTransform && (
          <div style={{
            width: "100%", maxWidth: "420px",
            animation: "fl-fade-up 0.6s ease-out both",
          }}>
            <div style={{
              height: "2px", background: "rgba(255,255,255,0.06)",
              borderRadius: "1px", overflow: "hidden",
              marginBottom: "10px", position: "relative",
            }}>
              <div style={{
                height: "100%", width: `${loadProgress}%`,
                background: "linear-gradient(90deg, #00D4FF, #FFD700)",
                borderRadius: "1px",
                boxShadow: "0 0 8px rgba(0,212,255,0.6)",
                transition: "width 0.08s linear",
              }} />
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "clamp(8px, 1.2vw, 10px)",
              letterSpacing: "0.15em",
              color: loadProgress >= 100 ? "#00FF88" : "rgba(0,212,255,0.6)",
              textAlign: "left", minHeight: "14px",
              transition: "color 0.3s",
            }}>
              {loadMessage}
            </div>
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {DATA_ROWS.map((row, i) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 10px",
                  background: "rgba(0,212,255,0.03)",
                  border: "1px solid rgba(0,212,255,0.06)",
                  borderRadius: "2px",
                  animation: `fl-data-stream 2.4s ease-in-out ${i * 0.12}s infinite`,
                  opacity: 0,
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px", letterSpacing: "0.1em",
                    color: "rgba(107,114,128,0.8)",
                  }}>{row.label}</span>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "10px", fontWeight: 700,
                    color: row.color,
                    textShadow: `0 0 8px ${row.color}50`,
                  }}>LIVE</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PHASE 3–4: ASHA materializes from the network ── */}
        {showAsha && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "28px",
            animation: "fl-orb-emerge 1.8s cubic-bezier(0.23,1,0.32,1) forwards",
          }}>
            {/* ASHA Orb — already present, converging from the network */}
            <AshaOrb
              regimeState={regimeState}
              size={72}
              isListening={phase === "asha-speaks"}
              label="ASHA · INTELLIGENCE LAYER"
            />

            {/* Live pressure context */}
            <div style={{
              display: "flex", gap: "24px",
              opacity: phase === "asha-speaks" ? 1 : 0,
              transition: "opacity 0.8s ease 0.4s",
            }}>
              {[
                { label: "PRESSURE", value: output.overall.score.toFixed(1), color: pressureColor },
                { label: "REGIME", value: output.regime.label.toUpperCase().slice(0, 8), color: "rgba(0,212,255,0.8)" },
                { label: "BULL %", value: `${output.probability.bullProbability}%`, color: "#00FF88" },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: "20px", fontWeight: 700,
                    color: stat.color, letterSpacing: "0.05em",
                  }}>{stat.value}</div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "8px", letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.3)", marginTop: "2px",
                  }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ASHA's one live sentence */}
            {showSentence && (
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "clamp(14px, 2.2vw, 17px)",
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.88)",
                textAlign: "center",
                maxWidth: "min(520px, 88vw)",
                animation: "fl-sentence-appear 0.6s ease-out forwards",
              }}>
                {ashaText}
                {ashaText.length < ashaGreeting.length && (
                  <span style={{
                    display: "inline-block", width: "2px", height: "1em",
                    background: pressureColor, marginLeft: "2px",
                    verticalAlign: "text-bottom",
                    animation: "fl-char-blink 0.7s step-end infinite",
                  }} aria-hidden="true" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Skip button — always visible ── */}
      <button
        onClick={handleSkip}
        aria-label="Skip introduction"
        style={{
          position: "absolute", top: "20px", right: "20px", zIndex: 30,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          padding: "8px 16px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px", letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.35)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          animation: "fl-fade-up 0.5s ease-out 1s both",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,212,255,0.8)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.35)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
        }}
      >
        SKIP INTRO
      </button>

      {/* Version tag */}
      {showLogo && (
        <div style={{
          position: "absolute", bottom: "28px", left: "28px", zIndex: 30,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px", letterSpacing: "0.15em",
          color: "rgba(55,65,81,0.6)",
          animation: "fl-fade-up 0.5s ease-out 1.5s both",
        }}>
          FAULTLINE v1.0 — BETA
        </div>
      )}
    </div>
  );
}
