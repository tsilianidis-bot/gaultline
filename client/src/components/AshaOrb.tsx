/* ============================================================
   ASHA — Spirit of FAULTLINE
   Visual orb: 3-state regime-reactive animated pulse.
   States: calm (stable intelligence) / elevated (signals emerging) /
           critical (urgent but professional — no panic design)
   Communicates market conditions before the user reads anything.

   isListening: when true, orb pulses faster and glows brighter —
   the signature "ASHA is listening" interaction.
   ============================================================ */
import { useMemo } from "react";

export type AshaRegimeState = "calm" | "rising" | "critical";

interface AshaOrbProps {
  regimeState?: AshaRegimeState;
  size?: number;
  interactive?: boolean;
  isListening?: boolean;
  onClick?: () => void;
  label?: string;
  className?: string;
}

// ── State configurations ──────────────────────────────────────
const STATE_CONFIG = {
  calm: {
    core:    "#00E5FF",
    ring1:   "rgba(0,229,255,0.30)",
    ring2:   "rgba(0,229,255,0.12)",
    glow:    "rgba(0,229,255,0.45)",
    glowListening: "rgba(0,229,255,0.85)",
    pulse:   "3.2s",
    pulseListening: "0.9s",
    orbit:   "14s",
    orbitListening: "4s",
    wave:    "3.8s",
    waveListening: "0.7s",
    label:   "CALM",
    labelColor: "rgba(0,229,255,0.55)",
  },
  rising: {
    core:    "#FFAA00",
    ring1:   "rgba(255,170,0,0.35)",
    ring2:   "rgba(255,170,0,0.14)",
    glow:    "rgba(255,170,0,0.50)",
    glowListening: "rgba(255,170,0,0.90)",
    pulse:   "2.0s",
    pulseListening: "0.8s",
    orbit:   "8s",
    orbitListening: "3s",
    wave:    "2.4s",
    waveListening: "0.6s",
    label:   "ELEVATED",
    labelColor: "rgba(255,170,0,0.65)",
  },
  critical: {
    core:    "#FF3B5C",
    ring1:   "rgba(255,59,92,0.35)",
    ring2:   "rgba(255,59,92,0.14)",
    glow:    "rgba(255,59,92,0.50)",
    glowListening: "rgba(255,59,92,0.90)",
    pulse:   "1.3s",
    pulseListening: "0.6s",
    orbit:   "5s",
    orbitListening: "2s",
    wave:    "1.6s",
    waveListening: "0.5s",
    label:   "CRITICAL",
    labelColor: "rgba(255,59,92,0.70)",
  },
} as const;

export default function AshaOrb({
  regimeState = "calm",
  size = 48,
  interactive = false,
  isListening = false,
  onClick,
  label,
}: AshaOrbProps) {
  const cfg = STATE_CONFIG[regimeState];
  const id = useMemo(() => `asha-orb-${Math.random().toString(36).slice(2, 8)}`, []);

  const r = size / 2;
  const innerR  = r * 0.27;
  const coreR   = r * 0.46;
  const ring1R  = r * 0.64;
  const ring2R  = r * 0.84;
  const orbitR  = r * 0.56;

  // When listening, use faster animation timings and brighter glow
  const activePulse = isListening ? cfg.pulseListening : cfg.pulse;
  const activeOrbit = isListening ? cfg.orbitListening : cfg.orbit;
  const activeWave  = isListening ? cfg.waveListening  : cfg.wave;
  const activeGlow  = isListening ? cfg.glowListening  : cfg.glow;

  // Listening state: outer ring expands more dramatically
  const ring2Min = isListening ? 0.82 : 0.90;
  const ring2Max = isListening ? 1.18 : 1.10;
  const ring1Min = isListening ? 0.87 : 0.93;
  const ring1Max = isListening ? 1.13 : 1.07;

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        cursor: interactive ? "pointer" : "default",
        userSelect: "none",
        transition: "transform 0.2s cubic-bezier(0.23,1,0.32,1)",
      }}
      onMouseEnter={e => {
        if (interactive) (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
      }}
      onMouseLeave={e => {
        if (interactive) (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          overflow: "visible",
          filter: `drop-shadow(0 0 ${size * (isListening ? 0.35 : 0.20)}px ${activeGlow})`,
          transition: "filter 0.4s ease",
          transform: isListening ? "scale(1.06)" : "scale(1)",
        }}
      >
        <defs>
          <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={cfg.core} stopOpacity="0.95" />
            <stop offset="55%"  stopColor={cfg.core} stopOpacity="0.45" />
            <stop offset="100%" stopColor={cfg.core} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-inner`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFFFFF"  stopOpacity="1.0" />
            <stop offset="35%"  stopColor={cfg.core} stopOpacity="0.85" />
            <stop offset="100%" stopColor={cfg.core} stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Outermost ambient ring — slow breathe / fast pulse when listening */}
        <circle cx={r} cy={r} r={ring2R} fill={cfg.ring2}>
          <animate
            attributeName="r"
            values={`${ring2R * ring2Min};${ring2R * ring2Max};${ring2R * ring2Min}`}
            dur={activePulse}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={isListening ? "0.50;0.90;0.50" : "0.35;0.65;0.35"}
            dur={activePulse}
            repeatCount="indefinite"
          />
        </circle>

        {/* Middle ring — offset phase */}
        <circle cx={r} cy={r} r={ring1R} fill={cfg.ring1}>
          <animate
            attributeName="r"
            values={`${ring1R * ring1Min};${ring1R * ring1Max};${ring1R * ring1Min}`}
            dur={activePulse}
            begin="0.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={isListening ? "0.65;1.00;0.65" : "0.45;0.80;0.45"}
            dur={activePulse}
            begin="0.4s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Core gradient fill */}
        <circle cx={r} cy={r} r={coreR} fill={`url(#${id}-core)`}>
          <animate
            attributeName="r"
            values={`${coreR * 0.94};${coreR * 1.06};${coreR * 0.94}`}
            dur={activePulse}
            begin="0.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Bright inner core */}
        <circle cx={r} cy={r} r={innerR} fill={`url(#${id}-inner)`}>
          <animate
            attributeName="opacity"
            values={isListening ? "0.90;1.0;0.90" : "0.80;1.0;0.80"}
            dur={activeWave}
            repeatCount="indefinite"
          />
        </circle>

        {/* Primary orbiting particle */}
        <circle r={size * 0.042} fill={cfg.core} opacity="0.75">
          <animateMotion
            dur={activeOrbit}
            repeatCount="indefinite"
            path={`M ${r} ${r - orbitR} A ${orbitR} ${orbitR} 0 1 1 ${r - 0.001} ${r - orbitR}`}
          />
        </circle>

        {/* Secondary orbiting particle — counter-orbit, smaller */}
        <circle r={size * 0.026} fill={cfg.core} opacity="0.40">
          <animateMotion
            dur={activeOrbit}
            begin={`-${parseFloat(activeOrbit) * 0.5}s`}
            repeatCount="indefinite"
            path={`M ${r} ${r - orbitR * 0.72} A ${orbitR * 0.72} ${orbitR * 0.72} 0 1 0 ${r - 0.001} ${r - orbitR * 0.72}`}
          />
        </circle>
      </svg>

      {label && (
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "7px",
          letterSpacing: "0.20em",
          color: isListening ? cfg.core : cfg.labelColor,
          textTransform: "uppercase",
          transition: "color 0.4s ease",
        }}>
          {isListening ? "LISTENING" : label}
        </span>
      )}
    </div>
  );
}
