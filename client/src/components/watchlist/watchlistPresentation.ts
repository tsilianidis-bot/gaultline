import type { AlertSeverity } from '@/lib/watchlist';

export const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; label: string; bg: string }> = {
  critical: { color: '#FF2D55', label: 'CRITICAL', bg: 'rgba(255,45,85,0.08)' },
  high: { color: '#FF9500', label: 'HIGH', bg: 'rgba(255,149,0,0.08)' },
  moderate: { color: '#FFD700', label: 'MODERATE', bg: 'rgba(255,215,0,0.06)' },
};

export const CATEGORY_COLORS: Record<string, string> = {
  rates: '#00D4FF',
  credit: '#FF9500',
  inflation: '#FFD700',
  speculation: '#C084FC',
  liquidity: '#FF9500',
  economy: '#00FF88',
  score: '#00D4FF',
};
