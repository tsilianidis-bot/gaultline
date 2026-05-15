// ============================================================
// FAULTLINE — Regime Shift Alert Engine
// Detects threshold breaches, directional changes, and regime
// transitions from live engine output. Persists alert history
// to localStorage with deduplication and severity escalation.
// ============================================================

import { EngineOutput, RawIndicators } from './engine';

// ── Alert types ───────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'high' | 'elevated' | 'moderate';
export type AlertCategory = 'regime_shift' | 'threshold_breach' | 'directional_change' | 'analog_match';

export interface RegimeAlert {
  id: string;
  timestamp: number;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  body: string;
  metric?: string;
  value?: string;
  threshold?: string;
  direction?: 'up' | 'down';
  acknowledged: boolean;
  color: string;
}

// ── Threshold definitions ─────────────────────────────────────
export interface ThresholdRule {
  id: string;
  label: string;
  metric: keyof RawIndicators | string;
  threshold: number;
  direction: 'above' | 'below';
  severity: AlertSeverity;
  category: AlertCategory;
  message: (value: number) => string;
  color: string;
}

export const THRESHOLD_RULES: ThresholdRule[] = [
  {
    id: 'hy-spread-500',
    label: 'HY Credit Spread > 500bps',
    metric: 'hySpread',
    threshold: 500,
    direction: 'above',
    severity: 'critical',
    category: 'threshold_breach',
    message: (v) => `HY credit spreads have widened to ${v.toFixed(0)}bps, exceeding the 500bps critical threshold. This level historically precedes credit market seizure.`,
    color: '#FF2D55',
  },
  {
    id: 'hy-spread-400',
    label: 'HY Credit Spread > 400bps',
    metric: 'hySpread',
    threshold: 400,
    direction: 'above',
    severity: 'high',
    category: 'threshold_breach',
    message: (v) => `HY credit spreads at ${v.toFixed(0)}bps — approaching stress territory. Monitor for further widening toward 500bps critical level.`,
    color: '#FF9500',
  },
  {
    id: 'vix-35',
    label: 'VIX > 35 — Volatility Spike',
    metric: 'vix',
    threshold: 35,
    direction: 'above',
    severity: 'critical',
    category: 'threshold_breach',
    message: (v) => `VIX has spiked to ${v.toFixed(1)}, indicating extreme fear. Levels above 35 historically coincide with acute market stress events.`,
    color: '#FF2D55',
  },
  {
    id: 'vix-25',
    label: 'VIX > 25 — Elevated Volatility',
    metric: 'vix',
    threshold: 25,
    direction: 'above',
    severity: 'elevated',
    category: 'threshold_breach',
    message: (v) => `VIX at ${v.toFixed(1)} — volatility elevated above long-run average. Risk-off positioning increasing.`,
    color: '#FFD700',
  },
  {
    id: 'yield-curve-inversion-50',
    label: 'Yield Curve Inverted > 50bps',
    metric: 'yieldCurveSpread',
    threshold: -50,
    direction: 'below',
    severity: 'high',
    category: 'threshold_breach',
    message: (v) => `10Y-2Y yield curve at ${v.toFixed(0)}bps — deep inversion. 12-month recession probability elevated significantly.`,
    color: '#FF9500',
  },
  {
    id: 'cpi-above-4',
    label: 'CPI > 4% — Inflation Re-acceleration',
    metric: 'cpi',
    threshold: 4.0,
    direction: 'above',
    severity: 'high',
    category: 'threshold_breach',
    message: (v) => `CPI at ${v.toFixed(1)}% — inflation re-accelerating above 4%. Fed rate cut expectations should be repriced.`,
    color: '#FF9500',
  },
  {
    id: 'unemployment-rise-5',
    label: 'Unemployment > 5%',
    metric: 'unemployment',
    threshold: 5.0,
    direction: 'above',
    severity: 'elevated',
    category: 'threshold_breach',
    message: (v) => `Unemployment at ${v.toFixed(1)}% — rising above 5% threshold. Labor market deterioration accelerating.`,
    color: '#FFD700',
  },
  {
    id: 'auction-bid-cover-low',
    label: 'Treasury Auction Demand Weak',
    metric: 'auctionBidCover',
    threshold: 2.2,
    direction: 'below',
    severity: 'high',
    category: 'threshold_breach',
    message: (v) => `Treasury auction bid-to-cover at ${v.toFixed(2)}x — below 2.2x warning level. Foreign demand for US debt declining.`,
    color: '#FF9500',
  },
];

// ── Regime transition detection ───────────────────────────────
export interface RegimeTransition {
  from: string;
  to: string;
  severity: AlertSeverity;
  message: string;
}

export function detectRegimeTransition(
  prevCode: string | null,
  currentCode: string,
  currentLabel: string,
): RegimeTransition | null {
  if (!prevCode || prevCode === currentCode) return null;

  const regimeOrder = ['LOW_RISK', 'MODERATE_RISK', 'ELEVATED_STRESS', 'LATE_CYCLE_FRAGILITY', 'CRITICAL_SYSTEMIC'];
  const prevIdx = regimeOrder.indexOf(prevCode);
  const currIdx = regimeOrder.indexOf(currentCode);

  if (prevIdx === -1 || currIdx === -1) return null;

  const escalating = currIdx > prevIdx;
  const severity: AlertSeverity = currIdx >= 4 ? 'critical' : currIdx >= 3 ? 'high' : 'elevated';

  return {
    from: prevCode,
    to: currentCode,
    severity,
    message: escalating
      ? `Macro regime has escalated to ${currentLabel}. Risk posture should be reviewed immediately.`
      : `Macro regime has de-escalated to ${currentLabel}. Systemic pressure easing.`,
  };
}

// ── Score directional change detection ───────────────────────
export function detectDirectionalChanges(
  prevScores: Record<string, number>,
  currentScores: Record<string, number>,
  threshold = 0.8,
): { domainId: string; label: string; delta: number; direction: 'up' | 'down'; severity: AlertSeverity }[] {
  const changes: { domainId: string; label: string; delta: number; direction: 'up' | 'down'; severity: AlertSeverity }[] = [];

  for (const [id, currentScore] of Object.entries(currentScores)) {
    const prev = prevScores[id];
    if (prev === undefined) continue;
    const delta = currentScore - prev;
    if (Math.abs(delta) < threshold) continue;

    const severity: AlertSeverity = Math.abs(delta) >= 2.0 ? 'critical'
      : Math.abs(delta) >= 1.5 ? 'high'
      : Math.abs(delta) >= 1.0 ? 'elevated'
      : 'moderate';

    changes.push({
      domainId: id,
      label: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      delta,
      direction: delta > 0 ? 'up' : 'down',
      severity,
    });
  }

  return changes;
}

// ── Alert generation from engine output ──────────────────────
export function generateAlerts(
  output: EngineOutput,
  indicators: RawIndicators,
  prevRegimeCode: string | null,
  prevDomainScores: Record<string, number>,
): RegimeAlert[] {
  const alerts: RegimeAlert[] = [];
  const now = Date.now();

  // 1. Regime transition
  const transition = detectRegimeTransition(prevRegimeCode, output.regime.code, output.regime.label);
  if (transition) {
    alerts.push({
      id: `regime-${output.regime.code}-${now}`,
      timestamp: now,
      category: 'regime_shift',
      severity: transition.severity,
      title: `Regime Shift: ${output.regime.label}`,
      body: transition.message,
      acknowledged: false,
      color: output.regime.color,
    });
  }

  // 2. Threshold breaches
  for (const rule of THRESHOLD_RULES) {
    const value = indicators[rule.metric as keyof RawIndicators];
    if (typeof value !== 'number') continue;

    const breached = rule.direction === 'above' ? value > rule.threshold : value < rule.threshold;
    if (!breached) continue;

    alerts.push({
      id: `${rule.id}-${Math.floor(now / 300000)}`, // deduplicate within 5-min windows
      timestamp: now,
      category: rule.category,
      severity: rule.severity,
      title: rule.label,
      body: rule.message(value),
      metric: rule.metric,
      value: value.toFixed(rule.metric === 'auctionBidCover' ? 2 : 1),
      threshold: rule.threshold.toString(),
      direction: rule.direction === 'above' ? 'up' : 'down',
      acknowledged: false,
      color: rule.color,
    });
  }

  // 3. High domain scores (≥ 7.5)
  for (const domain of output.domains) {
    if (domain.score < 7.5) continue;
    const severity: AlertSeverity = domain.score >= 9 ? 'critical' : domain.score >= 8 ? 'high' : 'elevated';
    alerts.push({
      id: `domain-${domain.id}-${Math.floor(now / 600000)}`, // deduplicate within 10-min windows
      timestamp: now,
      category: 'threshold_breach',
      severity,
      title: `${domain.label} at ${domain.score.toFixed(1)}/10`,
      body: `${domain.label} score has reached ${domain.score.toFixed(1)}/10. ${domain.drivers.slice(0, 2).join('. ')}.`,
      metric: domain.id,
      value: domain.score.toFixed(1),
      threshold: '7.5',
      acknowledged: false,
      color: domain.score >= 9 ? '#FF2D55' : domain.score >= 8 ? '#FF9500' : '#FFD700',
    });
  }

  // 4. Directional changes
  const currentScores = Object.fromEntries(output.domains.map(d => [d.id, d.score]));
  const changes = detectDirectionalChanges(prevDomainScores, currentScores, 1.0);
  for (const change of changes) {
    alerts.push({
      id: `delta-${change.domainId}-${Math.floor(now / 300000)}`,
      timestamp: now,
      category: 'directional_change',
      severity: change.severity,
      title: `${change.label} ${change.direction === 'up' ? 'Escalating' : 'Easing'} (${change.delta > 0 ? '+' : ''}${change.delta.toFixed(1)})`,
      body: `${change.label} has ${change.direction === 'up' ? 'increased' : 'decreased'} by ${Math.abs(change.delta).toFixed(1)} points. ${change.direction === 'up' ? 'Risk escalation detected.' : 'Pressure easing.'}`,
      metric: change.domainId,
      direction: change.direction,
      acknowledged: false,
      color: change.direction === 'up' ? '#FF2D55' : '#00FF88',
    });
  }

  return alerts;
}

// ── localStorage persistence ──────────────────────────────────
const STORAGE_KEY = 'faultline_regime_alerts_v1';
const MAX_ALERTS = 50;

export function loadAlertHistory(): RegimeAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RegimeAlert[];
  } catch {
    return [];
  }
}

export function saveAlertHistory(alerts: RegimeAlert[]): void {
  try {
    // Keep only the most recent MAX_ALERTS
    const trimmed = [...alerts].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ALERTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota exceeded — ignore
  }
}

export function mergeAlerts(existing: RegimeAlert[], incoming: RegimeAlert[]): RegimeAlert[] {
  const existingIds = new Set(existing.map(a => a.id));
  const newAlerts = incoming.filter(a => !existingIds.has(a.id));
  return [...newAlerts, ...existing].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ALERTS);
}

export function acknowledgeAlert(alerts: RegimeAlert[], id: string): RegimeAlert[] {
  return alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a);
}

export function clearAcknowledged(alerts: RegimeAlert[]): RegimeAlert[] {
  return alerts.filter(a => !a.acknowledged);
}

// ── Severity color map ────────────────────────────────────────
export function severityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return '#FF2D55';
    case 'high': return '#FF9500';
    case 'elevated': return '#FFD700';
    case 'moderate': return '#00D4FF';
  }
}

export function severityLabel(severity: AlertSeverity): string {
  return severity.toUpperCase();
}

export function categoryLabel(category: AlertCategory): string {
  switch (category) {
    case 'regime_shift': return 'REGIME SHIFT';
    case 'threshold_breach': return 'THRESHOLD BREACH';
    case 'directional_change': return 'DIRECTIONAL CHANGE';
    case 'analog_match': return 'ANALOG MATCH';
  }
}
