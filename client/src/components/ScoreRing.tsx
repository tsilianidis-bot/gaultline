/* FAULTLINE — ScoreRing animated SVG gauge */
import { useEffect, useState } from "react";
import { RiskLevel } from "@/lib/data";

const riskColors: Record<RiskLevel, string> = {
  critical: '#FF2D55',
  high: '#FF9500',
  elevated: '#FFD700',
  moderate: '#00D4FF',
  low: '#00FF88',
};

interface ScoreRingProps {
  score: number;
  maxScore: number;
  riskLevel: RiskLevel;
  label: string;
  delta?: number;
  size?: number;
  showLabel?: boolean;
}

export default function ScoreRing({ score, maxScore, riskLevel, label, delta, size = 80, showLabel = true }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = riskColors[riskLevel];
  const radius = (size / 2) - 8;
  const circumference = 2 * Math.PI * radius;
  const progress = animatedScore / maxScore;
  const dashOffset = circumference * (1 - progress);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 200);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="5"
          />
          {/* Progress ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.23, 1, 0.32, 1)',
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
          />
          {/* Glow ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.23, 1, 0.32, 1)',
              opacity: 0.3,
              filter: `blur(3px)`,
            }}
          />
        </svg>
        {/* Center score */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: size > 60 ? '20px' : '14px',
            color,
            textShadow: `0 0 12px ${color}80`,
            lineHeight: 1,
          }}>
            {score.toFixed(1)}
          </span>
          {delta !== undefined && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '8px',
              color: delta > 0 ? '#FF9500' : '#00FF88',
              lineHeight: 1,
            }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {showLabel && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          color: '#6B7280',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: size + 16,
          lineHeight: 1.3,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
