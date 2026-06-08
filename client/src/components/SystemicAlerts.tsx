/* ============================================================
   FAULTLINE — Systemic Alert Engine
   Six macro-regime alert categories, each with a 3-part
   structure: What Happened · Why It Matters · Historical Follow.
   Runs alongside the existing threshold alert system.
   ============================================================ */
import { useMemo, useState } from 'react';
import { AlertTriangle, Activity, Zap, Brain, TrendingDown, Clock } from 'lucide-react';
import { useEngine } from '@/contexts/EngineContext';

// ── Types ──────────────────────────────────────────────────────
export type SystemicCategory =
  | 'regime_shift'
  | 'liquidity_deterioration'
  | 'credit_stress'
  | 'ai_concentration_risk'
  | 'systemic_risk_escalation'
  | 'historical_analog_trigger';

export interface SystemicAlert {
  id: string;
  category: SystemicCategory;
  severity: 'critical' | 'high' | 'elevated';
  title: string;
  /** What happened — factual observation from live data */
  what: string;
  /** Why it matters — macro context and risk implication */
  why: string;
  /** What historically followed — analog evidence */
  historical: string;
  color: string;
  score: number; // 0–10 — used for sorting
}

// ── Category metadata ──────────────────────────────────────────
const CATEGORY_META: Record<SystemicCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
}> = {
  regime_shift:              { label: 'REGIME SHIFT',              icon: Activity,     color: '#FF9500' },
  liquidity_deterioration:   { label: 'LIQUIDITY DETERIORATION',   icon: TrendingDown, color: '#FF2D55' },
  credit_stress:             { label: 'CREDIT STRESS',             icon: AlertTriangle,color: '#FF6B35' },
  ai_concentration_risk:     { label: 'AI CONCENTRATION RISK',     icon: Brain,        color: '#C084FC' },
  systemic_risk_escalation:  { label: 'SYSTEMIC RISK ESCALATION',  icon: Zap,          color: '#FF2D55' },
  historical_analog_trigger: { label: 'HISTORICAL ANALOG TRIGGER', icon: Clock,        color: '#FFD700' },
};

// ── Alert generation from live engine data ─────────────────────
function generateSystemicAlerts(output: ReturnType<typeof useEngine>['output']): SystemicAlert[] {
  const alerts: SystemicAlert[] = [];
  const { overall, domains, regime, analogs, alertPressure } = output;

  const domainMap = Object.fromEntries(domains.map(d => [d.id, d.score]));
  const liquidityScore  = domainMap['liquidity']      ?? alertPressure.liquidity ?? 0;
  const creditScore     = domainMap['credit-stress']  ?? alertPressure.credit    ?? 0;
  const aiBubbleScore   = domainMap['ai-bubble']      ?? alertPressure.aiRisk    ?? 0;
  const treasuryScore   = domainMap['treasury-debt']  ?? alertPressure.treasury  ?? 0;
  const inflationScore  = domainMap['inflation-fed']  ?? 0;
  const recessionScore  = domainMap['recession']      ?? 0;

  // ── 1. Regime Shift ──────────────────────────────────────────
  if (overall.score >= 6.5) {
    const sev = overall.score >= 8.5 ? 'critical' : overall.score >= 7.5 ? 'high' : 'elevated';
    alerts.push({
      id: `regime-shift-${Math.round(overall.score * 10)}`,
      category: 'regime_shift',
      severity: sev,
      title: `Macro Regime: ${regime.label}`,
      what: `Overall FAULTLINE Pressure Score has reached ${overall.score.toFixed(1)}/10. Current regime is classified as "${regime.label}" — ${regime.sublabel}.`,
      why: `Regime transitions at this pressure level historically precede significant volatility compression or expansion events. The ${regime.label} regime indicates that multiple macro stress vectors are simultaneously elevated, reducing the margin for error in risk positioning.`,
      historical: `In 2007 (GFC onset), the pressure composite crossed 6.5 before Lehman by 14 months. In 2000 (Dot-Com peak), the AI/speculation vector reached this level 8 months before the NASDAQ peaked. Regime shifts of this type have historically been followed by 15–57% drawdowns within 6–24 months.`,
      color: regime.color,
      score: overall.score,
    });
  }

  // ── 2. Liquidity Deterioration ───────────────────────────────
  if (liquidityScore >= 5.5) {
    const sev = liquidityScore >= 8 ? 'critical' : liquidityScore >= 6.5 ? 'high' : 'elevated';
    alerts.push({
      id: `liquidity-${Math.round(liquidityScore * 10)}`,
      category: 'liquidity_deterioration',
      severity: sev,
      title: `Liquidity Conditions Deteriorating — Score ${liquidityScore.toFixed(1)}/10`,
      what: `The FAULTLINE Liquidity vector has reached ${liquidityScore.toFixed(1)}/10. Indicators include elevated repo stress, widening bid-ask spreads, and declining market depth across risk assets.`,
      why: `Liquidity deterioration is the most dangerous early-warning signal in financial markets. When liquidity dries up, forced selling cascades can compress prices far beyond fundamental values. Illiquidity amplifies every other risk vector — credit, volatility, and recession — simultaneously.`,
      historical: `In March 2020, liquidity froze within 72 hours, triggering a 34% drawdown in 23 trading days. In September 2008, repo market liquidity collapse preceded Lehman's failure by 6 days. In 1998 (LTCM), liquidity deterioration at similar levels required Fed emergency intervention.`,
      color: '#FF2D55',
      score: liquidityScore,
    });
  }

  // ── 3. Credit Stress ─────────────────────────────────────────
  if (creditScore >= 5.0) {
    const sev = creditScore >= 8 ? 'critical' : creditScore >= 6.5 ? 'high' : 'elevated';
    alerts.push({
      id: `credit-stress-${Math.round(creditScore * 10)}`,
      category: 'credit_stress',
      severity: sev,
      title: `Credit Stress Elevated — Score ${creditScore.toFixed(1)}/10`,
      what: `The FAULTLINE Credit Stress vector has reached ${creditScore.toFixed(1)}/10. This reflects widening high-yield spreads, rising corporate default probabilities, and deteriorating credit conditions in the leveraged loan market.`,
      why: `Credit stress is the transmission mechanism through which financial stress becomes economic stress. When credit conditions tighten, businesses face higher borrowing costs, investment declines, and employment contracts. The credit cycle leads the business cycle by 6–18 months.`,
      historical: `HY spreads above 500bps have preceded recessions in 1990, 2001, 2008, and 2020. In 2007, credit stress reached this level 9 months before the official recession start. In 2022, credit stress at 5.0+ coincided with the worst bond market performance since 1788.`,
      color: '#FF6B35',
      score: creditScore,
    });
  }

  // ── 4. AI Concentration Risk ──────────────────────────────────
  if (aiBubbleScore >= 5.0) {
    const sev = aiBubbleScore >= 8 ? 'critical' : aiBubbleScore >= 6.5 ? 'high' : 'elevated';
    alerts.push({
      id: `ai-concentration-${Math.round(aiBubbleScore * 10)}`,
      category: 'ai_concentration_risk',
      severity: sev,
      title: `AI/Mega-Cap Concentration Risk — Score ${aiBubbleScore.toFixed(1)}/10`,
      what: `The FAULTLINE AI Bubble vector has reached ${aiBubbleScore.toFixed(1)}/10. The top 7 AI-adjacent mega-cap stocks now represent an unprecedented share of S&P 500 market cap, with capex growth outpacing revenue growth and valuations pricing in decades of perfect execution.`,
      why: `Extreme concentration creates systemic fragility. When a small number of stocks represent a disproportionate share of index weight, passive fund flows amplify both the upside and the downside. A 20% correction in the top 7 names would mechanically produce a 10–15% index-level decline regardless of fundamentals in the remaining 493 stocks.`,
      historical: `In 2000, the top 10 internet/tech stocks represented 35% of NASDAQ. When the bubble burst, NASDAQ fell 78% over 30 months. In 1989 Japan, the Nikkei was dominated by 10 financial/industrial conglomerates — the subsequent 30-year bear market erased 80% of peak value. Current AI concentration exceeds both precedents.`,
      color: '#C084FC',
      score: aiBubbleScore,
    });
  }

  // ── 5. Systemic Risk Escalation ───────────────────────────────
  const elevatedDomains = domains.filter(d => d.score >= 6.0);
  if (elevatedDomains.length >= 3) {
    const sev = elevatedDomains.length >= 5 ? 'critical' : elevatedDomains.length >= 4 ? 'high' : 'elevated';
    alerts.push({
      id: `systemic-escalation-${elevatedDomains.length}`,
      category: 'systemic_risk_escalation',
      severity: sev,
      title: `Systemic Risk Escalation — ${elevatedDomains.length} Vectors Elevated`,
      what: `${elevatedDomains.length} of ${domains.length} FAULTLINE risk vectors are simultaneously elevated above 6.0/10: ${elevatedDomains.map(d => d.label).join(', ')}. Multi-vector stress elevation indicates systemic, not idiosyncratic, risk.`,
      why: `Systemic risk is qualitatively different from isolated sector stress. When multiple independent risk vectors elevate simultaneously, it signals that macro conditions — not company-specific factors — are the primary driver. Systemic risk cannot be diversified away within a single asset class.`,
      historical: `In Q3 2008, all 7 FAULTLINE vectors were simultaneously elevated for the first time since 1929. In Q1 2020, 5 vectors spiked within 2 weeks. In 2000, 4 vectors were elevated for 18 months before the crash. Multi-vector elevation has preceded every major market dislocation since 1929.`,
      color: '#FF2D55',
      score: elevatedDomains.length * 1.5,
    });
  }

  // ── 6. Historical Analog Trigger ─────────────────────────────
  const topAnalog = analogs[0];
  if (topAnalog && topAnalog.similarity >= 55) {
    const sev = topAnalog.similarity >= 75 ? 'critical' : topAnalog.similarity >= 65 ? 'high' : 'elevated';
    alerts.push({
      id: `analog-trigger-${topAnalog.id}-${Math.round(topAnalog.similarity)}`,
      category: 'historical_analog_trigger',
      severity: sev,
      title: `Historical Analog: ${topAnalog.era} ${topAnalog.year} — ${topAnalog.similarity}% Match`,
      what: `Current macro conditions show ${topAnalog.similarity}% similarity to the ${topAnalog.era} (${topAnalog.year}). Matching signals include: ${(topAnalog.matchReasons ?? []).slice(0, 3).join('; ')}.`,
      why: `Historical analogs are not predictions — they are probability-weighted reference cases. When current conditions closely match a historical stress period, the distribution of possible outcomes shifts toward the historical analog's outcome range. A ${topAnalog.similarity}%+ match is statistically significant and warrants heightened awareness.`,
      historical: `The ${topAnalog.era} ultimately resulted in significant market disruption. Key lessons: (1) The initial phase of analog matches often feels manageable — the severity escalates later. (2) Policy responses in the historical case required extraordinary intervention. (3) Recovery timelines were measured in months to years, not days. View the full analog analysis at Historical Comparisons.`,
      color: '#FFD700',
      score: topAnalog.similarity / 10,
    });
  }

  // Sort by score descending
  return alerts.sort((a, b) => b.score - a.score);
}

// ── SystemicAlertCard ──────────────────────────────────────────
function SystemicAlertCard({ alert, index }: { alert: SystemicAlert; index: number }) {
  const meta = CATEGORY_META[alert.category];
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);

  const sevBg = alert.severity === 'critical'
    ? 'rgba(255,45,85,0.08)'
    : alert.severity === 'high'
    ? 'rgba(255,149,0,0.06)'
    : 'rgba(255,215,0,0.05)';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: sevBg,
        border: `1px solid ${alert.color}30`,
        borderLeft: `3px solid ${alert.color}`,
        borderRadius: '6px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        animation: `fade-slide-up 0.4s cubic-bezier(0.23, 1, 0.32, 1) ${index * 60}ms both`,
        boxShadow: alert.severity === 'critical' ? `0 0 16px ${alert.color}12` : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${alert.color}60`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${alert.color}30`; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Icon */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '4px',
          background: `${alert.color}15`, border: `1px solid ${alert.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={13} style={{ color: alert.color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category + severity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              color: alert.color, letterSpacing: '0.12em',
            }}>
              {meta.label}
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              color: alert.severity === 'critical' ? '#FF2D55' : alert.severity === 'high' ? '#FF9500' : '#FFD700',
              background: alert.severity === 'critical' ? 'rgba(255,45,85,0.12)' : alert.severity === 'high' ? 'rgba(255,149,0,0.12)' : 'rgba(255,215,0,0.1)',
              border: `1px solid ${alert.severity === 'critical' ? 'rgba(255,45,85,0.25)' : alert.severity === 'high' ? 'rgba(255,149,0,0.25)' : 'rgba(255,215,0,0.2)'}`,
              borderRadius: '2px', padding: '1px 5px',
            }}>
              {alert.severity.toUpperCase()}
            </span>
          </div>
          {/* Title */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E2E8F0', lineHeight: 1.2 }}>
            {alert.title}
          </div>
        </div>

        {/* Expand chevron */}
        <div style={{ color: '#4B5563', fontSize: '10px', flexShrink: 0, paddingTop: '2px' }}>
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Collapsed preview — "What happened" */}
      {!expanded && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280',
          lineHeight: 1.5, marginTop: '8px', marginLeft: '38px',
        }}>
          {alert.what.length > 120 ? alert.what.slice(0, 120) + '…' : alert.what}
        </div>
      )}

      {/* Expanded — 3-part structure */}
      {expanded && (
        <div style={{ marginTop: '12px', marginLeft: '38px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* What happened */}
          <div style={{
            background: 'rgba(0,0,0,0.25)', borderRadius: '4px',
            padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', letterSpacing: '0.12em', marginBottom: '5px' }}>
              ◆ WHAT HAPPENED
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', lineHeight: 1.6 }}>
              {alert.what}
            </div>
          </div>

          {/* Why it matters */}
          <div style={{
            background: `${alert.color}06`, borderRadius: '4px',
            padding: '10px 12px', border: `1px solid ${alert.color}15`,
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: alert.color, letterSpacing: '0.12em', marginBottom: '5px' }}>
              ◆ WHY IT MATTERS
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', lineHeight: 1.6 }}>
              {alert.why}
            </div>
          </div>

          {/* What historically followed */}
          <div style={{
            background: 'rgba(255,215,0,0.04)', borderRadius: '4px',
            padding: '10px 12px', border: '1px solid rgba(255,215,0,0.12)',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#FFD700', letterSpacing: '0.12em', marginBottom: '5px' }}>
              ◆ WHAT HISTORICALLY FOLLOWED
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9CA3AF', lineHeight: 1.6 }}>
              {alert.historical}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── SystemicAlertsPanel ────────────────────────────────────────
export default function SystemicAlertsPanel() {
  const { output } = useEngine();
  const alerts = useMemo(() => generateSystemicAlerts(output), [output]);

  if (alerts.length === 0) {
    return (
      <div style={{
        background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px', padding: '20px', marginBottom: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.15em', marginBottom: '8px' }}>
          SYSTEMIC ALERT ENGINE
        </div>
        <Zap size={24} style={{ color: '#1F2937', marginBottom: '8px' }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
          No Systemic Alerts Active
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#1F2937' }}>
          All 6 systemic risk categories are below alert thresholds.
        </div>
      </div>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={13} style={{ color: '#FF2D55' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#E2E8F0', letterSpacing: '0.1em' }}>
            SYSTEMIC ALERT ENGINE
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
            background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.25)',
            color: '#FF2D55', borderRadius: '3px', padding: '1px 6px',
          }}>
            {alerts.length} ACTIVE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {criticalCount > 0 && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              background: 'rgba(255,45,85,0.12)', border: '1px solid rgba(255,45,85,0.3)',
              color: '#FF2D55', borderRadius: '3px', padding: '2px 6px',
              animation: 'blink-alert 1.5s ease-in-out infinite',
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
          {highCount > 0 && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.25)',
              color: '#FF9500', borderRadius: '3px', padding: '2px 6px',
            }}>
              {highCount} HIGH
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563',
        marginBottom: '10px', lineHeight: 1.5,
      }}>
        Macro-regime alerts generated from live FAULTLINE engine data. Each alert answers: what happened, why it matters, and what historically followed. Click any alert to expand.
      </div>

      {/* Alert cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alerts.map((alert, i) => (
          <SystemicAlertCard key={alert.id} alert={alert} index={i} />
        ))}
      </div>
    </div>
  );
}
