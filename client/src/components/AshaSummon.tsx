/* ============================================================
   ASHA — Summon Experience (v2)
   Reference: sphere expands to fill ~80% of viewport.
   ASHA label, subtitle, suggestion cards, and input field
   all live INSIDE the sphere. Background remains visible
   through translucent sphere walls.

   5-step sequence (matching reference):
   1. Background dims — interface recedes
   2. Small orb lifts from dock with intention
   3. Orb ascends to viewport center, chimes begin
   4. Sphere expands to fill screen — transformation
   5. Content fades in inside sphere — ready for directive

   Colors: FAULTLINE cyan (#00D4FF) / amber (#FFAA00) / red (#FF3B5C)
   Motion: Apple VisionOS quality — heavy, deliberate, premium
   ============================================================ */
import { useEffect, useRef, useState, useCallback } from "react";
import AshaOrb, { AshaRegimeState } from "./AshaOrb";

export interface AshaSummonProps {
  visible: boolean;
  regimeState: AshaRegimeState;
  suggestions: string[];
  onSubmit: (question: string) => void;
  onDismiss: () => void;
  dockBottom?: number;
  dockRight?: number;
}

type SummonPhase =
  | "idle"
  | "dimming"
  | "lifting"
  | "ascending"
  | "transforming"   // sphere expands to fill screen
  | "revealing"      // content fades in inside sphere
  | "ready";

// ── Signature chime ───────────────────────────────────────────
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
  } catch { return null; }
}

function playAshaSummonChime() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.16, now);
  master.connect(ctx.destination);

  const delay = ctx.createDelay(0.08);
  delay.delayTime.setValueAtTime(0.06, now);
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0.10, now);
  delay.connect(dg); dg.connect(master);

  [[432, 0, 1.0, 2.8], [648, 0.04, 0.50, 2.2], [864, 0.09, 0.24, 1.6], [216, 0, 0.28, 1.2]].forEach(([freq, start, vol, end]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, now + start);
    g.gain.setValueAtTime(0, now + start);
    g.gain.linearRampToValueAtTime(vol, now + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + end);
    o.connect(g); g.connect(master);
    if (freq === 432) o.connect(delay);
    o.start(now + start); o.stop(now + end + 0.1);
  });
}

// ── Color helpers ─────────────────────────────────────────────
function regimeColor(r: AshaRegimeState) {
  return r === "calm" ? "#00D4FF" : r === "rising" ? "#FFAA00" : "#FF3B5C";
}
function regimeGlow(r: AshaRegimeState, alpha = 0.22) {
  const [R, G, B] = r === "calm" ? [0, 212, 255] : r === "rising" ? [255, 170, 0] : [255, 59, 92];
  return `rgba(${R},${G},${B},${alpha})`;
}

// ── Full-viewport sphere SVG ──────────────────────────────────
// The sphere is a large translucent shell — background shows through.
// Multiple layered gradients create depth, rim lighting, and internal glow.
function FullSphere({ size, regimeState, opacity }: {
  size: number;
  regimeState: AshaRegimeState;
  opacity: number;
}) {
  const color = regimeColor(regimeState);
  const id = useRef(`fs-${Math.random().toString(36).slice(2, 7)}`).current;
  const r = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Outer ambient glow — very soft, wide */}
        <radialGradient id={`${id}-ambient`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="72%"  stopColor={color} stopOpacity="0" />
          <stop offset="86%"  stopColor={color} stopOpacity="0.06" />
          <stop offset="94%"  stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </radialGradient>

        {/* Sphere shell — translucent, shows background through center */}
        <radialGradient id={`${id}-shell`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="60%"  stopColor={color} stopOpacity="0" />
          <stop offset="78%"  stopColor={color} stopOpacity="0.04" />
          <stop offset="88%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="94%"  stopColor={color} stopOpacity="0.32" />
          <stop offset="98%"  stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </radialGradient>

        {/* Top-left specular highlight — premium glass feel */}
        <radialGradient id={`${id}-spec`} cx="32%" cy="28%" r="28%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="50%"  stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Bottom rim light — warm internal glow */}
        <radialGradient id={`${id}-rim`} cx="50%" cy="82%" r="38%">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* Inner edge ring — subtle depth */}
        <radialGradient id={`${id}-edge`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="82%"  stopColor={color} stopOpacity="0" />
          <stop offset="90%"  stopColor={color} stopOpacity="0.08" />
          <stop offset="96%"  stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0.08" />
        </radialGradient>

        <clipPath id={`${id}-clip`}>
          <circle cx={r} cy={r} r={r * 0.97} />
        </clipPath>
      </defs>

      {/* Outer ambient glow */}
      <circle cx={r} cy={r} r={r * 0.98} fill={`url(#${id}-ambient)`}>
        <animate attributeName="r"
          values={`${r * 0.96};${r * 1.00};${r * 0.96}`}
          dur="5s" repeatCount="indefinite" />
      </circle>

      {/* Sphere shell */}
      <circle cx={r} cy={r} r={r * 0.92} fill={`url(#${id}-shell)`}>
        <animate attributeName="r"
          values={`${r * 0.90};${r * 0.94};${r * 0.90}`}
          dur="4.2s" repeatCount="indefinite" />
      </circle>

      {/* Edge ring */}
      <circle cx={r} cy={r} r={r * 0.92} fill={`url(#${id}-edge)`}
        clipPath={`url(#${id}-clip)`}>
        <animate attributeName="opacity"
          values="0.7;1.0;0.7" dur="4.2s" repeatCount="indefinite" />
      </circle>

      {/* Bottom rim glow */}
      <circle cx={r} cy={r} r={r * 0.92} fill={`url(#${id}-rim)`}
        clipPath={`url(#${id}-clip)`} />

      {/* Top-left specular */}
      <circle cx={r} cy={r} r={r * 0.92} fill={`url(#${id}-spec)`}
        clipPath={`url(#${id}-clip)`}>
        <animate attributeName="opacity"
          values="0.6;1.0;0.6" dur="6s" repeatCount="indefinite" />
      </circle>

      {/* Subtle equatorial ring line */}
      <ellipse cx={r} cy={r} rx={r * 0.88} ry={r * 0.88 * 0.12}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.12"
        clipPath={`url(#${id}-clip)`}>
        <animate attributeName="stroke-opacity"
          values="0.06;0.16;0.06" dur="4.2s" repeatCount="indefinite" />
      </ellipse>
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
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const after = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    if (!visible) {
      clearTimers();
      setPhase("idle");
      setInput("");
      setVisibleCards(0);
      return;
    }

    getAudioCtx(); // unlock audio context

    let t = 0;
    setPhase("dimming");

    after(() => setPhase("lifting"), t += 160);
    after(() => setPhase("ascending"), t += 280);
    after(() => {
      setPhase("transforming");
      after(() => playAshaSummonChime(), 120); // chime as sphere expands
    }, t += 500);
    after(() => {
      setPhase("revealing");
      suggestions.forEach((_, i) => after(() => setVisibleCards(i + 1), i * 100));
    }, t += 520);
    after(() => {
      setPhase("ready");
      setTimeout(() => inputRef.current?.focus(), 60);
    }, t += 400 + suggestions.length * 100);

    return clearTimers;
  }, [visible, suggestions, after, clearTimers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && visible) onDismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onDismiss]);

  if (!visible && phase === "idle") return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  // Dock center (bottom-right trigger)
  const dockX = vw - dockRight - 22;
  const dockY = vh - dockBottom - 22;

  // Sphere target: ~80% of the smaller viewport dimension, centered
  const sphereDiameter = Math.min(vw, vh) * 0.82;

  // Phase-driven small orb position (before sphere expands)
  const isLifting    = phase === "lifting";
  const isAscending  = phase === "ascending";
  const hasSphere    = phase === "transforming" || phase === "revealing" || phase === "ready";
  const showContent  = phase === "revealing" || phase === "ready";

  // Small orb travels from dock to center
  const smallOrbX = isAscending || hasSphere ? vw / 2 : isLifting ? dockX : dockX;
  const smallOrbY = isAscending || hasSphere ? vh / 2 : isLifting ? dockY - 16 : dockY;
  const smallOrbSize = isAscending ? 44 : 28;

  // Sphere scale: 0 → 1 during transforming
  const sphereScale = hasSphere ? 1 : 0;
  const sphereOpacity = hasSphere ? 1 : 0;

  // Backdrop dim
  const backdropOpacity = phase === "idle" ? 0 : hasSphere ? 0.55 : 0.18;

  const color = regimeColor(regimeState);

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────── */}
      <div
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1010,
          background: "rgba(0,0,0,0.60)",
          opacity: backdropOpacity,
          transition: "opacity 400ms ease",
          pointerEvents: showContent ? "auto" : "none",
        }}
      />

      {/* ── Full-viewport sphere ───────────────────────────── */}
      <div
        style={{
          position: "fixed",
          zIndex: 1015,
          left: vw / 2,
          top: vh / 2,
          width: sphereDiameter,
          height: sphereDiameter,
          transform: `translate(-50%, -50%) scale(${sphereScale})`,
          transition: sphereScale === 1
            ? "transform 520ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease"
            : "none",
          opacity: sphereOpacity,
          pointerEvents: "none",
        }}
      >
        <FullSphere size={sphereDiameter} regimeState={regimeState} opacity={1} />
      </div>

      {/* ── Small orb during travel phases ────────────────── */}
      {!hasSphere && (
        <div
          style={{
            position: "fixed",
            zIndex: 1020,
            left: smallOrbX,
            top: smallOrbY,
            transform: "translate(-50%, -50%)",
            transition: isAscending
              ? "left 500ms cubic-bezier(0.16,1,0.3,1), top 500ms cubic-bezier(0.16,1,0.3,1), width 500ms ease, height 500ms ease"
              : isLifting
              ? "top 280ms cubic-bezier(0.16,1,0.3,1)"
              : "none",
            pointerEvents: "none",
          }}
        >
          <AshaOrb regimeState={regimeState} size={smallOrbSize} isListening={false} />
        </div>
      )}

      {/* ── Content inside sphere ──────────────────────────── */}
      {hasSphere && (
        <div
          style={{
            position: "fixed",
            zIndex: 1025,
            left: vw / 2,
            top: vh / 2,
            transform: "translate(-50%, -50%)",
            width: Math.min(sphereDiameter * 0.72, 560),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            opacity: showContent ? 1 : 0,
            transition: "opacity 360ms ease 80ms",
            pointerEvents: showContent ? "auto" : "none",
          }}
        >
          {/* ASHA title */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 44px)",
              letterSpacing: "0.30em",
              color,
              textTransform: "uppercase",
              textShadow: `0 0 40px ${regimeGlow(regimeState, 0.6)}`,
            }}>
              ASHA
            </div>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "clamp(12px, 1.4vw, 15px)",
              color: "rgba(226,232,240,0.65)",
              textAlign: "center",
              letterSpacing: "0.02em",
              lineHeight: 1.4,
            }}>
              How can I help you understand the markets today?
            </div>
          </div>

          {/* Suggestion cards — 2-column grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            width: "100%",
          }}>
            {suggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => onSubmit(s)}
                style={{
                  padding: "11px 14px",
                  background: "rgba(4,8,18,0.72)",
                  border: `1px solid ${regimeGlow(regimeState, 0.20)}`,
                  borderRadius: "8px",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "clamp(10px, 1.1vw, 12px)",
                  color: "rgba(148,163,184,0.80)",
                  cursor: "pointer",
                  backdropFilter: "blur(16px)",
                  textAlign: "left",
                  lineHeight: 1.35,
                  opacity: i < visibleCards ? 1 : 0,
                  transform: i < visibleCards ? "translateY(0) scale(1)" : "translateY(8px) scale(0.97)",
                  transitionProperty: "opacity, transform, background, color, border-color",
                  transitionDuration: "0.24s",
                  transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = regimeGlow(regimeState, 0.16);
                  el.style.color = "#E2E8F0";
                  el.style.borderColor = regimeGlow(regimeState, 0.45);
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(4,8,18,0.72)";
                  el.style.color = "rgba(148,163,184,0.80)";
                  el.style.borderColor = regimeGlow(regimeState, 0.20);
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div style={{
            width: "100%",
            opacity: phase === "revealing" ? 0 : 1,
            transition: "opacity 300ms ease 200ms",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(4,8,18,0.85)",
              border: `1px solid ${regimeGlow(regimeState, 0.35)}`,
              borderRadius: "8px",
              backdropFilter: "blur(24px)",
              boxShadow: `0 8px 40px rgba(0,0,0,0.60), 0 0 0 1px ${regimeGlow(regimeState, 0.08)}`,
              overflow: "hidden",
            }}>
              <div style={{ padding: "0 10px 0 14px", flexShrink: 0 }}>
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
                placeholder="Ask ASHA anything..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "14px 8px",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "13px",
                  color: "#E2E8F0",
                  caretColor: color,
                }}
              />
              <button
                onClick={() => { if (input.trim()) onSubmit(input.trim()); }}
                disabled={!input.trim()}
                style={{
                  width: "40px",
                  height: "40px",
                  margin: "4px",
                  borderRadius: "6px",
                  background: input.trim() ? regimeGlow(regimeState, 0.22) : "transparent",
                  border: `1px solid ${input.trim() ? regimeGlow(regimeState, 0.40) : "rgba(100,116,139,0.15)"}`,
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  color: input.trim() ? color : "rgba(100,116,139,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.16s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!input.trim()) return;
                  (e.currentTarget as HTMLButtonElement).style.background = regimeGlow(regimeState, 0.35);
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = input.trim() ? regimeGlow(regimeState, 0.22) : "transparent";
                }}
              >
                {/* Up-arrow icon */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M7 2L3 6M7 2L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Connection status */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "10px",
            }}>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: color,
                boxShadow: `0 0 6px ${color}`,
                animation: "ashaPulse 2s ease infinite",
              }} />
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px",
                letterSpacing: "0.12em",
                color: "rgba(148,163,184,0.35)",
                textTransform: "uppercase",
              }}>
                ASHA is connected to all core intelligence systems
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Dismiss hint ───────────────────────────────────── */}
      {showContent && (
        <div style={{
          position: "fixed",
          zIndex: 1026,
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px",
          letterSpacing: "0.12em",
          color: "rgba(100,116,139,0.28)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}>
          Press Esc to dismiss
        </div>
      )}

      {/* ── Keyframe for pulse dot ─────────────────────────── */}
      <style>{`
        @keyframes ashaPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </>
  );
}
