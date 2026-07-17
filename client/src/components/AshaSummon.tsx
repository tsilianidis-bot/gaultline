/* ============================================================
   ASHA — Summon Experience
   The signature brand moment that activates every time ASHA
   is called from the floating orb.

   7-step sequence:
   1. Background dims (10–15%)
   2. Orb lifts from dock position
   3. Orb ascends to center, enlarging
   4. Orb expands into illuminated intelligence sphere
   5. Signature chime plays
   6. Context-aware suggestion cards stagger in
   7. Elegant input panel fades up, cursor active

   Motion philosophy: Apple VisionOS / luxury automotive.
   Heavy, deliberate, premium. No bouncing, no particles,
   no neon glow, no gaming effects.
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";

// ── Types ─────────────────────────────────────────────────────
export interface AshaSummonProps {
  visible: boolean;
  regimeState: AshaRegimeState;
  suggestions: string[];
  onSubmit: (question: string) => void;
  onDismiss: () => void;
  /** Bottom-right dock position of the trigger orb in viewport coords */
  dockBottom?: number;
  dockRight?: number;
}

// ── Summon phases ─────────────────────────────────────────────
type SummonPhase =
  | "idle"
  | "dimming"       // background dims
  | "lifting"       // orb rises from dock
  | "ascending"     // orb travels to center
  | "expanding"     // orb becomes sphere
  | "settled"       // sphere at rest, chime played
  | "revealing"     // suggestions + input fade in
  | "ready";        // fully interactive

// ── Phase durations (ms) ──────────────────────────────────────
const PHASE_MS: Record<string, number> = {
  dimming:   180,
  lifting:   260,
  ascending: 480,
  expanding: 380,
  settled:   120,  // brief pause before reveal
  revealing: 320,
};

// ── Signature chime ───────────────────────────────────────────
// Warm, elegant, memorable — 432 Hz fundamental + overtones.
// Designed to feel like a luxury vehicle welcome sound.
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playAshaSummonChime() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;

  // Master gain — soft overall level
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.18, now);
  master.connect(ctx.destination);

  // Slight reverb via convolver simulation using a delay node
  const delay = ctx.createDelay(0.08);
  delay.delayTime.setValueAtTime(0.06, now);
  const delayGain = ctx.createGain();
  delayGain.gain.setValueAtTime(0.12, now);
  delay.connect(delayGain);
  delayGain.connect(master);

  // Note 1: 432 Hz fundamental — warm, grounding
  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.type = "sine";
  o1.frequency.setValueAtTime(432, now);
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(1.0, now + 0.018);
  g1.gain.setValueAtTime(1.0, now + 0.06);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
  o1.connect(g1); g1.connect(master); o1.connect(delay);
  o1.start(now); o1.stop(now + 2.9);

  // Note 2: 648 Hz (3/2 × 432) — perfect fifth, harmonious
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = "sine";
  o2.frequency.setValueAtTime(648, now + 0.04);
  g2.gain.setValueAtTime(0, now + 0.04);
  g2.gain.linearRampToValueAtTime(0.55, now + 0.07);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
  o2.connect(g2); g2.connect(master);
  o2.start(now + 0.04); o2.stop(now + 2.3);

  // Note 3: 864 Hz (2× 432) — octave, clarity
  const o3 = ctx.createOscillator();
  const g3 = ctx.createGain();
  o3.type = "sine";
  o3.frequency.setValueAtTime(864, now + 0.09);
  g3.gain.setValueAtTime(0, now + 0.09);
  g3.gain.linearRampToValueAtTime(0.28, now + 0.12);
  g3.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  o3.connect(g3); g3.connect(master);
  o3.start(now + 0.09); o3.stop(now + 1.7);

  // Sub note: 216 Hz (432/2) — warmth and body
  const o4 = ctx.createOscillator();
  const g4 = ctx.createGain();
  o4.type = "sine";
  o4.frequency.setValueAtTime(216, now);
  g4.gain.setValueAtTime(0, now);
  g4.gain.linearRampToValueAtTime(0.30, now + 0.025);
  g4.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  o4.connect(g4); g4.connect(master);
  o4.start(now); o4.stop(now + 1.3);
}

// ── Sphere visual component ───────────────────────────────────
// A premium illuminated sphere — subtle depth, soft reflections,
// restrained internal movement. Not a neon orb.
function IntelligenceSphere({ size, regimeState }: { size: number; regimeState: AshaRegimeState }) {
  const coreColor = regimeState === "calm" ? "#00D4FF"
    : regimeState === "rising" ? "#FFAA00"
    : "#FF3B5C";

  const glowColor = regimeState === "calm" ? "rgba(0,212,255,0.22)"
    : regimeState === "rising" ? "rgba(255,170,0,0.22)"
    : "rgba(255,59,92,0.22)";

  const id = `sphere-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        overflow: "visible",
        filter: `drop-shadow(0 0 ${size * 0.18}px ${glowColor}) drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.45))`,
      }}
    >
      <defs>
        {/* Main sphere gradient — deep center, soft edge */}
        <radialGradient id={`${id}-sphere`} cx="42%" cy="38%" r="58%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="18%"  stopColor={coreColor} stopOpacity="0.82" />
          <stop offset="55%"  stopColor={coreColor} stopOpacity="0.52" />
          <stop offset="100%" stopColor={coreColor} stopOpacity="0.08" />
        </radialGradient>
        {/* Specular highlight — top-left */}
        <radialGradient id={`${id}-spec`} cx="35%" cy="30%" r="35%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="60%"  stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* Ambient fill — bottom warmth */}
        <radialGradient id={`${id}-ambient`} cx="58%" cy="72%" r="45%">
          <stop offset="0%"   stopColor={coreColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
        </radialGradient>
        {/* Outer glow ring */}
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="70%"  stopColor={coreColor} stopOpacity="0" />
          <stop offset="88%"  stopColor={coreColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={size/2} cy={size/2} r={size/2 * 0.88} />
        </clipPath>
      </defs>

      {/* Outer glow ring */}
      <circle cx={size/2} cy={size/2} r={size/2 * 0.96} fill={`url(#${id}-glow)`}>
        <animate attributeName="r"
          values={`${size/2 * 0.93};${size/2 * 0.99};${size/2 * 0.93}`}
          dur="4.2s" repeatCount="indefinite" />
        <animate attributeName="opacity"
          values="0.7;1.0;0.7" dur="4.2s" repeatCount="indefinite" />
      </circle>

      {/* Main sphere body */}
      <circle cx={size/2} cy={size/2} r={size/2 * 0.88}
        fill={`url(#${id}-sphere)`}>
        <animate attributeName="r"
          values={`${size/2 * 0.86};${size/2 * 0.90};${size/2 * 0.86}`}
          dur="3.6s" repeatCount="indefinite" />
      </circle>

      {/* Ambient bottom warmth */}
      <circle cx={size/2} cy={size/2} r={size/2 * 0.88}
        fill={`url(#${id}-ambient)`}
        clipPath={`url(#${id}-clip)`} />

      {/* Specular highlight */}
      <circle cx={size/2} cy={size/2} r={size/2 * 0.88}
        fill={`url(#${id}-spec)`}
        clipPath={`url(#${id}-clip)`}>
        <animate attributeName="opacity"
          values="0.75;1.0;0.75" dur="5.0s" repeatCount="indefinite" />
      </circle>

      {/* Subtle inner ring — depth */}
      <circle cx={size/2} cy={size/2} r={size/2 * 0.58}
        fill="none"
        stroke={coreColor}
        strokeWidth="0.6"
        strokeOpacity="0.18">
        <animate attributeName="r"
          values={`${size/2 * 0.55};${size/2 * 0.61};${size/2 * 0.55}`}
          dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity"
          values="0.10;0.22;0.10" dur="3.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AshaSummon({
  visible,
  regimeState,
  suggestions,
  onSubmit,
  onDismiss,
  dockBottom = 20,
  dockRight = 20,
}: AshaSummonProps) {
  const [phase, setPhase] = useState<SummonPhase>("idle");
  const [input, setInput] = useState("");
  const [visibleCards, setVisibleCards] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    phaseTimers.current.push(t);
    return t;
  }, []);

  // ── Advance through phases when visible ──────────────────
  useEffect(() => {
    if (!visible) {
      clearTimers();
      setPhase("idle");
      setInput("");
      setVisibleCards(0);
      return;
    }

    // Unlock audio context on first interaction
    getAudioCtx();

    let elapsed = 0;

    setPhase("dimming");
    elapsed += PHASE_MS.dimming;

    addTimer(() => setPhase("lifting"), elapsed);
    elapsed += PHASE_MS.lifting;

    addTimer(() => setPhase("ascending"), elapsed);
    elapsed += PHASE_MS.ascending;

    addTimer(() => {
      setPhase("expanding");
      // Chime fires as sphere expands
      addTimer(() => playAshaSummonChime(), 80);
    }, elapsed);
    elapsed += PHASE_MS.expanding;

    addTimer(() => setPhase("settled"), elapsed);
    elapsed += PHASE_MS.settled;

    addTimer(() => {
      setPhase("revealing");
      // Stagger suggestion cards
      suggestions.forEach((_, i) => {
        addTimer(() => setVisibleCards(i + 1), i * 90);
      });
    }, elapsed);
    elapsed += PHASE_MS.revealing + suggestions.length * 90;

    addTimer(() => {
      setPhase("ready");
      setTimeout(() => inputRef.current?.focus(), 60);
    }, elapsed);

    return clearTimers;
  }, [visible, suggestions, addTimer, clearTimers]);

  // ── Dismiss on Escape ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onDismiss]);

  if (!visible && phase === "idle") return null;

  // ── Viewport center ───────────────────────────────────────
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  // Dock position (bottom-right of trigger button)
  const dockX = vw - dockRight - 22; // center of the ~44px trigger
  const dockY = vh - dockBottom - 22;

  // Target center
  const centerX = vw / 2;
  const centerY = vh / 2;

  // ── Phase-driven orb position ─────────────────────────────
  const isLifting   = phase === "lifting";
  const isAscending = phase === "ascending";
  const isExpanding = phase === "expanding" || phase === "settled" || phase === "revealing" || phase === "ready";

  // Orb starts at dock, lifts slightly, then travels to center
  const orbX = isExpanding ? centerX
    : isAscending ? centerX
    : isLifting ? dockX
    : dockX;

  const orbY = isExpanding ? centerY
    : isAscending ? centerY
    : isLifting ? dockY - 18  // slight lift before travel
    : dockY;

  const orbSize = isExpanding ? 160
    : isAscending ? 80
    : isLifting ? 32
    : 32;

  // ── Overlay opacity ───────────────────────────────────────
  const overlayOpacity = phase === "idle" ? 0
    : phase === "dimming" ? 0.12
    : 0.14;

  // ── Transition strings ────────────────────────────────────
  const orbTransition = isAscending
    ? "all 480ms cubic-bezier(0.16, 1, 0.3, 1)"
    : isExpanding
    ? "all 380ms cubic-bezier(0.16, 1, 0.3, 1)"
    : isLifting
    ? "all 260ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "none";

  const showSphere = phase === "expanding" || phase === "settled" || phase === "revealing" || phase === "ready";
  const showInput  = phase === "revealing" || phase === "ready";

  return (
    <>
      {/* ── Backdrop dim ──────────────────────────────────── */}
      <div
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1010,
          background: "rgba(0,0,0,0.14)",
          opacity: overlayOpacity,
          transition: "opacity 180ms ease",
          pointerEvents: phase === "ready" || phase === "revealing" ? "auto" : "none",
        }}
      />

      {/* ── Orb / Sphere container ─────────────────────────── */}
      <div
        style={{
          position: "fixed",
          zIndex: 1020,
          left: orbX,
          top: orbY,
          width: orbSize,
          height: orbSize,
          transform: "translate(-50%, -50%)",
          transition: orbTransition,
          pointerEvents: "none",
        }}
      >
        {/* Small orb during travel phases */}
        {!showSphere && (
          <AshaOrb
            regimeState={regimeState}
            size={orbSize}
            isListening={false}
          />
        )}

        {/* Intelligence sphere — expands in place */}
        {showSphere && (
          <div style={{
            opacity: phase === "expanding" ? 0 : 1,
            transform: phase === "expanding" ? "scale(0.72)" : "scale(1)",
            transition: "opacity 340ms cubic-bezier(0.16,1,0.3,1), transform 380ms cubic-bezier(0.16,1,0.3,1)",
          }}>
            <IntelligenceSphere size={orbSize} regimeState={regimeState} />
          </div>
        )}
      </div>

      {/* ── Content column: label + suggestions + input ──── */}
      {showSphere && (
        <div style={{
          position: "fixed",
          zIndex: 1021,
          left: centerX,
          // Sit below the settled sphere (center + half of 160px sphere + 24px gap)
          top: centerY + 80 + 24,
          transform: "translateX(-50%)",
          width: "min(520px, calc(100vw - 40px))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          opacity: phase === "expanding" ? 0 : 1,
          transition: "opacity 400ms ease 100ms",
          pointerEvents: showInput ? "auto" : "none",
        }}>

          {/* ASHA identity label */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            pointerEvents: "none",
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "18px",
              letterSpacing: "0.25em",
              color: regimeState === "calm" ? "#00D4FF"
                : regimeState === "rising" ? "#FFAA00"
                : "#FF3B5C",
              textTransform: "uppercase",
            }}>
              ASHA
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px",
              letterSpacing: "0.18em",
              color: "rgba(148,163,184,0.45)",
              textTransform: "uppercase",
            }}>
              Intelligence Engine Active
            </div>
          </div>

          {/* Suggestion cards */}
          {showInput && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "7px",
              justifyContent: "center",
              width: "100%",
            }}>
              {suggestions.slice(0, 6).map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSubmit(s)}
                  style={{
                    padding: "7px 13px",
                    background: "rgba(4,8,18,0.88)",
                    border: "1px solid rgba(0,212,255,0.22)",
                    borderRadius: "20px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "11px",
                    color: "rgba(148,163,184,0.75)",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                    opacity: i < visibleCards ? 1 : 0,
                    transform: i < visibleCards ? "translateY(0)" : "translateY(6px)",
                    transitionProperty: "opacity, transform, background, color, border-color",
                    transitionDuration: "0.22s",
                    transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(0,212,255,0.14)";
                    el.style.color = "#E2E8F0";
                    el.style.borderColor = "rgba(0,212,255,0.40)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(4,8,18,0.88)";
                    el.style.color = "rgba(148,163,184,0.75)";
                    el.style.borderColor = "rgba(0,212,255,0.22)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input panel */}
          {showInput && (
            <div style={{
              width: "100%",
              opacity: phase === "revealing" ? 0 : 1,
              transition: "opacity 320ms ease 120ms",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(4,8,18,0.94)",
                border: "1px solid rgba(0,212,255,0.28)",
                borderRadius: "8px",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,212,255,0.06)",
                overflow: "hidden",
              }}>
                <div style={{ padding: "0 10px 0 12px", flexShrink: 0 }}>
                  <AshaOrb regimeState={regimeState} size={18} isListening={!!input} />
                </div>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                      e.preventDefault();
                      onSubmit(input.trim());
                    }
                  }}
                  placeholder="Ask ASHA anything about the markets..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: "14px 8px",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "13px",
                    color: "#E2E8F0",
                    caretColor: regimeState === "calm" ? "#00D4FF"
                      : regimeState === "rising" ? "#FFAA00"
                      : "#FF3B5C",
                  }}
                />
                <button
                  onClick={() => { if (input.trim()) onSubmit(input.trim()); }}
                  disabled={!input.trim()}
                  style={{
                    padding: "0 16px",
                    height: "100%",
                    background: input.trim()
                      ? (regimeState === "calm" ? "rgba(0,212,255,0.18)"
                        : regimeState === "rising" ? "rgba(255,170,0,0.18)"
                        : "rgba(255,59,92,0.18)")
                      : "transparent",
                    border: "none",
                    borderLeft: "1px solid rgba(0,212,255,0.14)",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    color: input.trim()
                      ? (regimeState === "calm" ? "#00D4FF"
                        : regimeState === "rising" ? "#FFAA00"
                        : "#FF3B5C")
                      : "rgba(100,116,139,0.3)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    transition: "all 0.16s ease",
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Analyze
                </button>
              </div>
              <div style={{
                textAlign: "center",
                marginTop: "10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px",
                letterSpacing: "0.12em",
                color: "rgba(100,116,139,0.30)",
              }}>
                Press Esc to dismiss
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
