/* ============================================================
   PressureGauge — FAULTLINE Signature Visual
   Arc meter with 5 pressure zones, animated sweep, glowing needle.
   Designed to be instantly interpretable: one glance = full context.
   ============================================================ */
import { useEffect, useRef, useState } from "react";

// ── Pressure zone definitions ─────────────────────────────────
const ZONES = [
  { min: 0,  max: 20,  label: "Very Low",  sublabel: "Stable / Recovery",     color: "#00C896", glow: "rgba(0,200,150,0.5)" },
  { min: 20, max: 40,  label: "Low",        sublabel: "Constructive",           color: "#4ADE80", glow: "rgba(74,222,128,0.4)" },
  { min: 40, max: 60,  label: "Moderate",   sublabel: "Neutral / Caution",      color: "#FFAA00", glow: "rgba(255,170,0,0.5)" },
  { min: 60, max: 80,  label: "High",       sublabel: "Elevated Risk",          color: "#FF6B35", glow: "rgba(255,107,53,0.5)" },
  { min: 80, max: 100, label: "Extreme",    sublabel: "Crisis Conditions",      color: "#FF2D55", glow: "rgba(255,45,85,0.6)" },
] as const;

function getZone(score: number) {
  return ZONES.find(z => score >= z.min && score <= z.max) ?? ZONES[4];
}

// ── SVG arc helpers ───────────────────────────────────────────
const CX = 120;
const CY = 120;
const R = 90;
// Arc spans from 210° to 330° (240° sweep, opening at bottom)
const START_DEG = 210;
const SWEEP_DEG = 240;
const END_DEG = START_DEG + SWEEP_DEG; // 450 = 90

function degToRad(deg: number) { return (deg * Math.PI) / 180; }

function polarToXY(deg: number, r: number) {
  const rad = degToRad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, r: number, innerR: number) {
  const s = polarToXY(startDeg, r);
  const e = polarToXY(endDeg, r);
  const si = polarToXY(endDeg, innerR);
  const ei = polarToXY(startDeg, innerR);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${s.x} ${s.y}`,
    `A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${si.x} ${si.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ei.x} ${ei.y}`,
    "Z",
  ].join(" ");
}

function scoreToAngle(score: number) {
  return START_DEG + (Math.min(Math.max(score, 0), 100) / 100) * SWEEP_DEG;
}

interface PressureGaugeProps {
  /** 0–100 pressure score */
  score: number;
  /** Historical percentile 0–100 or null if unavailable */
  historicalPercentile?: number | null;
  /** Closest historical analog label */
  analogLabel?: string | null;
  /** Analog period string e.g. "Jan 2019 – Jul 2019" */
  analogPeriod?: string | null;
  /** Compact mode: smaller size, no labels below */
  compact?: boolean;
}

export default function PressureGauge({
  score,
  historicalPercentile = null,
  analogLabel = null,
  analogPeriod = null,
  compact = false,
}: PressureGaugeProps) {
  const zone = getZone(score);
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 1400; // ms

  // Animate the needle sweep on mount
  useEffect(() => {
    const target = score;
    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(eased * target);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [score]);

  const needleAngle = scoreToAngle(animatedScore);
  const needleTip = polarToXY(needleAngle, R - 6);
  const needleBase1 = polarToXY(needleAngle + 90, 8);
  const needleBase2 = polarToXY(needleAngle - 90, 8);

  const outerR = 90;
  const innerR = 66;
  const tickR = outerR + 4;
  const tickInnerR = outerR + 1;

  const size = compact ? 200 : 240;
  const viewBox = `0 0 240 240`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? '8px' : '14px' }}>
      {/* SVG Arc Gauge */}
      <div style={{ position: 'relative', width: size, height: compact ? size * 0.7 : size * 0.75 }}>
        <svg
          width={size}
          height={compact ? size * 0.7 : size * 0.75}
          viewBox={viewBox}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Glow filter for needle */}
            <filter id="needle-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Zone glow filters */}
            {ZONES.map((z, i) => (
              <filter key={i} id={`zone-glow-${i}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* ── Background track ── */}
          <path
            d={arcPath(START_DEG, END_DEG, outerR, innerR)}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />

          {/* ── Zone segments ── */}
          {ZONES.map((z, i) => {
            const segStart = START_DEG + (z.min / 100) * SWEEP_DEG;
            const segEnd = START_DEG + (z.max / 100) * SWEEP_DEG;
            const isActive = animatedScore >= z.min && animatedScore <= z.max;
            return (
              <path
                key={i}
                d={arcPath(segStart + 0.8, segEnd - 0.8, outerR, innerR)}
                fill={isActive ? z.color : z.color + "40"}
                style={{ transition: 'fill 0.3s ease' }}
              />
            );
          })}

          {/* ── Tick marks at zone boundaries ── */}
          {[0, 20, 40, 60, 80, 100].map((pct, i) => {
            const deg = scoreToAngle(pct);
            const outer = polarToXY(deg, tickR + 2);
            const inner = polarToXY(deg, tickInnerR - 2);
            return (
              <line
                key={i}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* ── Zone labels (0, 20, 40, 60, 80, 100) ── */}
          {[0, 20, 40, 60, 80, 100].map((pct, i) => {
            const deg = scoreToAngle(pct);
            const pos = polarToXY(deg, tickR + 10);
            return (
              <text
                key={i}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.35)"
                fontSize="8"
                fontFamily="'IBM Plex Mono', monospace"
              >
                {pct}
              </text>
            );
          })}

          {/* ── Needle ── */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
            fill={zone.color}
            filter="url(#needle-glow)"
            style={{ transition: 'none' }}
          />

          {/* ── Needle pivot dot ── */}
          <circle
            cx={CX}
            cy={CY}
            r="7"
            fill="#0A0D14"
            stroke={zone.color}
            strokeWidth="2"
            filter="url(#needle-glow)"
          />

          {/* ── Center score display ── */}
          <text
            x={CX}
            y={CY + 28}
            textAnchor="middle"
            fill={zone.color}
            fontSize={compact ? "22" : "26"}
            fontFamily="'Rajdhani', sans-serif"
            fontWeight="700"
            style={{ filter: `drop-shadow(0 0 6px ${zone.glow})` }}
          >
            {Math.round(animatedScore)}
          </text>
          <text
            x={CX}
            y={CY + 42}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="7"
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing="0.12em"
          >
            / 100
          </text>
        </svg>

        {/* ── Zone label overlay (bottom center) ── */}
        <div style={{
          position: 'absolute',
          bottom: compact ? 0 : 4,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: compact ? '9px' : '10px',
            fontWeight: '600',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: zone.color,
            textShadow: `0 0 8px ${zone.glow}`,
          }}>
            {zone.label} Pressure
          </div>
          {!compact && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '8px',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '2px',
            }}>
              {zone.sublabel}
            </div>
          )}
        </div>
      </div>

      {/* ── Historical context strip ── */}
      {!compact && (historicalPercentile !== null || analogLabel) && (
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: '12px',
          width: '100%',
        }}>
          {historicalPercentile !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}>
                Historical Percentile
              </div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '18px',
                fontWeight: '700',
                color: zone.color,
                lineHeight: 1.2,
                marginTop: '3px',
              }}>
                {Math.round(historicalPercentile)}th
              </div>
            </div>
          )}
          {analogLabel && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}>
                Closest Analog
              </div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '14px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.3,
                marginTop: '3px',
                maxWidth: '140px',
              }}>
                {analogLabel}
              </div>
              {analogPeriod && (
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '8px',
                  color: 'rgba(255,255,255,0.3)',
                  marginTop: '2px',
                }}>
                  {analogPeriod}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
