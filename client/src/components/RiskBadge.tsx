/* FAULTLINE — RiskBadge component */
import { RiskLevel } from "@/lib/data";

const riskConfig: Record<RiskLevel, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.12)', label: 'CRITICAL' },
  high: { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)', label: 'HIGH' },
  elevated: { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.1)', label: 'ELEVATED' },
  moderate: { color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.1)', label: 'MODERATE' },
  low: { color: '#00FF88', bg: 'rgba(0, 255, 136, 0.1)', label: 'LOW' },
};

export function getRiskColor(level: RiskLevel): string {
  return riskConfig[level].color;
}

export default function RiskBadge({ level, size = 'sm' }: { level: RiskLevel; size?: 'xs' | 'sm' | 'md' }) {
  const config = riskConfig[level];
  const fontSize = size === 'xs' ? '8px' : size === 'sm' ? '9px' : '10px';
  const padding = size === 'xs' ? '2px 5px' : size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: config.color,
      background: config.bg,
      border: `1px solid ${config.color}30`,
      borderRadius: '2px',
      padding,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span style={{
        width: '4px', height: '4px', borderRadius: '50%',
        background: config.color,
        boxShadow: `0 0 6px ${config.color}`,
        flexShrink: 0,
      }} />
      {config.label}
    </span>
  );
}
