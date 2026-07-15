/* ============================================================
   ASHA — Spirit of FAULTLINE
   Visual orb: regime-reactive animated pulse / waveform.
   Communicates intelligence and awareness, not fear.
   ============================================================ */
import { useMemo } from "react";

export type AshaRegimeState = "calm" | "rising" | "critical";

interface AshaOrbProps {
  regimeState?: AshaRegimeState;
  size?: number;
  interactive?: boolean;
  onClick?: () => void;
  label?: string;
  className?: string;
}

function getOrbColors(state: AshaRegimeState) {
  switch (state) {
    case "critical":
      return { core: "#FF6B35", ring1: "#FF6B3540", ring2: "#FF6B3520", glow: "#FF6B3560" };
    case "rising":
      return { core: "#FFB347", ring1: "#FFB34740", ring2: "#FFB34720", glow: "#FFB34750" };
    default:
      return { core: "#00D4FF", ring1: "#00D4FF40", ring2: "#00D4FF20", glow: "#00D4FF50" };
  }
}

function getAnimationSpeed(state: AshaRegimeState) {
  switch (state) {
    case "critical": return { pulse: "1.4s", orbit: "6s", wave: "1.8s" };
    case "rising": return { pulse: "2s", orbit: "9s", wave: "2.4s" };
    default: return { pulse: "3s", orbit: "14s", wave: "3.5s" };
  }
}

export default function AshaOrb({
  regimeState = "calm",
  size = 48,
  interactive = false,
  onClick,
  label,
}: AshaOrbProps) {
  const colors = useMemo(() => getOrbColors(regimeState), [regimeState]);
  const speed = useMemo(() => getAnimationSpeed(regimeState), [regimeState]);
  const id = useMemo(() => `asha-orb-${Math.random().toString(36).slice(2, 8)}`, []);

  const r = size / 2;
  const innerR = r * 0.28;
  const ring1R = r * 0.48;
  const ring2R = r * 0.68;
  const orbitR = r * 0.58;

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
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          overflow: "visible",
          filter: `drop-shadow(0 0 ${size * 0.18}px ${colors.glow})`,
          transition: "filter 0.6s ease",
        }}
      >
        <defs>
          <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.core} stopOpacity="0.9" />
            <stop offset="60%" stopColor={colors.core} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors.core} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-inner`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%" stopColor={colors.core} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.core} stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {/* Outer ambient glow */}
        <circle cx={r} cy={r} r={ring2R} fill={colors.ring2}>
          <animate
            attributeName="r"
            values={`${ring2R * 0.92};${ring2R * 1.08};${ring2R * 0.92}`}
            dur={speed.pulse}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0.7;0.4"
            dur={speed.pulse}
            repeatCount="indefinite"
          />
        </circle>

        {/* Middle ring */}
        <circle cx={r} cy={r} r={ring1R} fill={colors.ring1}>
          <animate
            attributeName="r"
            values={`${ring1R * 0.94};${ring1R * 1.06};${ring1R * 0.94}`}
            dur={speed.pulse}
            begin="0.3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0.85;0.5"
            dur={speed.pulse}
            begin="0.3s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Core gradient fill */}
        <circle cx={r} cy={r} r={innerR * 1.6} fill={`url(#${id}-core)`}>
          <animate
            attributeName="r"
            values={`${innerR * 1.5};${innerR * 1.7};${innerR * 1.5}`}
            dur={speed.pulse}
            begin="0.15s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Bright inner core */}
        <circle cx={r} cy={r} r={innerR} fill={`url(#${id}-inner)`}>
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur={speed.wave}
            repeatCount="indefinite"
          />
        </circle>

        {/* Orbiting particle */}
        <circle r={size * 0.04} fill={colors.core} opacity="0.7">
          <animateMotion
            dur={speed.orbit}
            repeatCount="indefinite"
            path={`M ${r} ${r - orbitR} A ${orbitR} ${orbitR} 0 1 1 ${r - 0.001} ${r - orbitR}`}
          />
        </circle>

        {/* Second orbiting particle (offset) */}
        <circle r={size * 0.025} fill={colors.core} opacity="0.4">
          <animateMotion
            dur={speed.orbit}
            begin={`-${parseFloat(speed.orbit) * 0.5}s`}
            repeatCount="indefinite"
            path={`M ${r} ${r - orbitR * 0.75} A ${orbitR * 0.75} ${orbitR * 0.75} 0 1 0 ${r - 0.001} ${r - orbitR * 0.75}`}
          />
        </circle>
      </svg>

      {label && (
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "7px",
          letterSpacing: "0.2em",
          color: colors.core,
          textTransform: "uppercase",
          opacity: 0.7,
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
