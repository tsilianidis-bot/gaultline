/* ============================================================
   FAULTLINE — Regime Shift Alert System v2
   Live threshold detection, directional change alerts,
   regime transition events, alert history, and pressure gauges.
   ============================================================ */
import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Bell, BellOff, Shield, TrendingUp, TrendingDown, X, CheckCheck, Trash2, Activity } from 'lucide-react';
import { useEngine } from '@/contexts/EngineContext';
import { getRiskColor } from '@/components/RiskBadge';
import {
  RegimeAlert, generateAlerts, loadAlertHistory, saveAlertHistory,
  mergeAlerts, acknowledgeAlert, clearAcknowledged,
  severityColor, severityLabel, categoryLabel, THRESHOLD_RULES,
} from '@/lib/regimeAlerts';
import { PremiumGateFull } from "@/components/PremiumGate";

// ── Pressure gauge ─────────────────────────────────────────────
function PressureGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 10));
  const angle = -135 + (pct / 100) * 270;
  const r = 28;
  const cx = 36, cy = 36;
  const arcStart = polarToCartesian(cx, cy, r, -135);
  const arcEnd = polarToCartesian(cx, cy, r, 135);
  const needleEnd = polarToCartesian(cx, cy, r - 6, angle);

  function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width="72" height="52" viewBox="0 0 72 52">
        {/* Background arc */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 188} 188`}
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.5" fill={color} />
        {/* Value */}
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontFamily="'Rajdhani', sans-serif" fontWeight="700" fontSize="11" fill="#F0F4FF">
          {value.toFixed(1)}
        </text>
      </svg>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </div>
    </div>
  );
}

// ── Alert card ─────────────────────────────────────────────────
function AlertCard({
  alert, onAcknowledge, index,
}: {
  alert: RegimeAlert;
  onAcknowledge: (id: string) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const sColor = severityColor(alert.severity);
  const isNew = Date.now() - alert.timestamp < 60000;

  return (
    <div
      style={{
        background: alert.acknowledged ? 'rgba(10,12,16,0.5)' : 'rgba(10,12,16,0.9)',
        border: `1px solid ${sColor}${alert.acknowledged ? '15' : '30'}`,
        borderLeft: `3px solid ${sColor}${alert.acknowledged ? '40' : ''}`,
        borderRadius: '6px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        animation: `fade-slide-up 0.4s cubic-bezier(0.23, 1, 0.32, 1) ${index * 40}ms both`,
        opacity: alert.acknowledged ? 0.55 : 1,
        boxShadow: !alert.acknowledged && alert.severity === 'critical' ? `0 0 20px ${sColor}10` : 'none',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Severity dot */}
        <div style={{ paddingTop: '3px', flexShrink: 0 }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: sColor,
            boxShadow: `0 0 ${!alert.acknowledged && (alert.severity === 'critical' || alert.severity === 'high') ? '10px' : '4px'} ${sColor}80`,
            animation: !alert.acknowledged && alert.severity === 'critical' ? 'blink-alert 1.2s ease-in-out infinite' : 'none',
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              color: sColor, background: `${sColor}15`,
              border: `1px solid ${sColor}30`,
              borderRadius: '2px', padding: '1px 5px', letterSpacing: '0.1em',
            }}>
              {severityLabel(alert.severity)}
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
              color: '#4B5563', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px', padding: '1px 5px', letterSpacing: '0.08em',
            }}>
              {categoryLabel(alert.category)}
            </span>
            {isNew && !alert.acknowledged && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
                color: '#00FF88', background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.2)',
                borderRadius: '2px', padding: '1px 5px',
              }}>
                NEW
              </span>
            )}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', marginLeft: 'auto' }}>
              {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Title */}
          <div style={{
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '13px',
            color: alert.acknowledged ? '#6B7280' : '#E2E8F0',
            marginBottom: '2px',
          }}>
            {alert.title}
          </div>

          {/* Body (expanded) */}
          {expanded && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
              color: '#9CA3AF', lineHeight: 1.5, marginTop: '6px',
              paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {alert.body}
              {alert.value && alert.threshold && (
                <div style={{ marginTop: '6px', display: 'flex', gap: '12px' }}>
                  <span style={{ color: sColor }}>VALUE: {alert.value}</span>
                  <span style={{ color: '#4B5563' }}>THRESHOLD: {alert.threshold}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acknowledge button */}
        {!alert.acknowledged && (
          <button
            onClick={e => { e.stopPropagation(); onAcknowledge(alert.id); }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '4px 6px', cursor: 'pointer',
              color: '#4B5563', flexShrink: 0,
              transition: 'all 0.15s',
            }}
            title="Acknowledge"
          >
            <CheckCheck size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Threshold rule card ────────────────────────────────────────
function ThresholdCard({ rule, indicators }: { rule: typeof THRESHOLD_RULES[0]; indicators: Record<string, number> }) {
  const value = indicators[rule.metric] ?? null;
  const breached = value !== null && (rule.direction === 'above' ? value > rule.threshold : value < rule.threshold);
  const proximity = value !== null
    ? rule.direction === 'above'
      ? Math.min(100, (value / rule.threshold) * 100)
      : Math.min(100, (rule.threshold / Math.max(0.01, value)) * 100)
    : 0;

  return (
    <div style={{
      background: breached ? `${rule.color}08` : 'rgba(10,12,16,0.7)',
      border: `1px solid ${breached ? rule.color + '30' : 'rgba(255,255,255,0.06)'}`,
      borderLeft: `2px solid ${breached ? rule.color : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '4px', padding: '10px',
      transition: 'all 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '11px', color: breached ? rule.color : '#9CA3AF' }}>
          {rule.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {value !== null && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: breached ? rule.color : '#6B7280' }}>
              {value.toFixed(rule.metric === 'auctionBidCover' ? 2 : 1)}
            </span>
          )}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px',
            color: breached ? rule.color : '#374151',
            background: breached ? `${rule.color}15` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${breached ? rule.color + '30' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '2px', padding: '1px 5px',
          }}>
            {breached ? 'BREACHED' : 'WATCHING'}
          </span>
        </div>
      </div>
      {/* Proximity bar */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${proximity}%`,
          background: breached ? rule.color : `${rule.color}60`,
          borderRadius: '2px',
          boxShadow: breached ? `0 0 6px ${rule.color}60` : 'none',
          transition: 'width 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
        }} />
      </div>
    </div>
  );
}

// ── Main Alerts page ──────────────────────────────────────────
function AlertsInner() {
  const { output, indicators, isLive } = useEngine();
  const { overall, domains, regime, alertPressure } = output;

  // Alert history state
  const [alertHistory, setAlertHistory] = useState<RegimeAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'elevated' | 'unread'>('all');
  const [showThresholds, setShowThresholds] = useState(false);

  // Track previous state for change detection
  const prevRegimeCode = useRef<string | null>(null);
  const prevDomainScores = useRef<Record<string, number>>({});
  const initialized = useRef(false);

  // Load persisted alerts on mount
  useEffect(() => {
    setAlertHistory(loadAlertHistory());
  }, []);

  // Generate alerts when engine output changes
  useEffect(() => {
    if (!initialized.current) {
      // On first load, just record baseline state without generating alerts
      prevRegimeCode.current = output.regime.code;
      prevDomainScores.current = Object.fromEntries(output.domains.map(d => [d.id, d.score]));
      initialized.current = true;
      return;
    }

    const newAlerts = generateAlerts(
      output,
      indicators,
      prevRegimeCode.current,
      prevDomainScores.current,
    );

    if (newAlerts.length > 0) {
      setAlertHistory(prev => {
        const merged = mergeAlerts(prev, newAlerts);
        saveAlertHistory(merged);
        return merged;
      });
    }

    prevRegimeCode.current = output.regime.code;
    prevDomainScores.current = Object.fromEntries(output.domains.map(d => [d.id, d.score]));
  }, [output, indicators]);

  const handleAcknowledge = (id: string) => {
    setAlertHistory(prev => {
      const updated = acknowledgeAlert(prev, id);
      saveAlertHistory(updated);
      return updated;
    });
  };

  const handleClearAcknowledged = () => {
    setAlertHistory(prev => {
      const updated = clearAcknowledged(prev);
      saveAlertHistory(updated);
      return updated;
    });
  };

  const handleClearAll = () => {
    setAlertHistory([]);
    saveAlertHistory([]);
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alertHistory.filter(a => {
      if (filter === 'unread') return !a.acknowledged;
      if (filter === 'all') return true;
      return a.severity === filter;
    });
  }, [alertHistory, filter]);

  const unreadCount = alertHistory.filter(a => !a.acknowledged).length;
  const criticalCount = alertHistory.filter(a => a.severity === 'critical' && !a.acknowledged).length;

  // Pressure gauge colors
  const gaugeColor = (v: number) => v >= 7 ? '#FF2D55' : v >= 5 ? '#FF9500' : v >= 3 ? '#FFD700' : '#00D4FF';

  // Indicators as plain object for threshold cards
  const indicatorMap = indicators as unknown as Record<string, number>;

  return (
    <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto', paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', letterSpacing: '0.15em' }}>
            REGIME SHIFT ALERT SYSTEM · {isLive ? 'LIVE' : 'SIM'}
          </div>
          {unreadCount > 0 && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
              color: criticalCount > 0 ? '#FF2D55' : '#FF9500',
              background: criticalCount > 0 ? 'rgba(255,45,85,0.1)' : 'rgba(255,149,0,0.1)',
              border: `1px solid ${criticalCount > 0 ? 'rgba(255,45,85,0.3)' : 'rgba(255,149,0,0.3)'}`,
              borderRadius: '4px', padding: '3px 8px',
              animation: criticalCount > 0 ? 'blink-alert 1.5s ease-in-out infinite' : 'none',
            }}>
              {unreadCount} UNREAD {criticalCount > 0 ? `· ${criticalCount} CRITICAL` : ''}
            </div>
          )}
        </div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F0F4FF', margin: 0 }}>
          Alert Monitor
        </h1>
      </div>

      {/* Regime status banner */}
      <div style={{
        background: `linear-gradient(135deg, ${regime.color}12, rgba(10,12,16,0.95))`,
        border: `1px solid ${regime.color}30`,
        borderRadius: '8px', padding: '12px 14px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: regime.color, letterSpacing: '0.15em', marginBottom: '2px' }}>
            CURRENT MACRO REGIME
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: '#F0F4FF' }}>
            {regime.label}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#6B7280', marginTop: '2px' }}>
            {regime.sublabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: getRiskColor(overall.riskLevel) }}>
              {overall.score.toFixed(1)}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563' }}>OVERALL</div>
          </div>
        </div>
      </div>

      {/* Pressure gauges */}
      <div style={{ background: 'rgba(10,12,16,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', letterSpacing: '0.1em', marginBottom: '12px' }}>
          LIVE PRESSURE GAUGES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
          <PressureGauge label="Treasury" value={alertPressure.treasury} color={gaugeColor(alertPressure.treasury)} />
          <PressureGauge label="Credit" value={alertPressure.credit} color={gaugeColor(alertPressure.credit)} />
          <PressureGauge label="AI Risk" value={alertPressure.aiRisk} color={gaugeColor(alertPressure.aiRisk)} />
          <PressureGauge label="Liquidity" value={alertPressure.liquidity} color={gaugeColor(alertPressure.liquidity)} />
          {domains.slice(0, 4).map(d => (
            <PressureGauge key={d.id} label={d.label.split(' ')[0]} value={d.score} color={gaugeColor(d.score)} />
          ))}
        </div>
      </div>

      {/* Threshold watchlist toggle */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowThresholds(!showThresholds)}
          style={{
            width: '100%', background: 'rgba(10,12,16,0.8)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
            padding: '10px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#9CA3AF', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
            letterSpacing: '0.1em', transition: 'all 0.2s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={12} />
            THRESHOLD WATCHLIST ({THRESHOLD_RULES.length} TRIGGERS)
          </span>
          <span>{showThresholds ? '▲' : '▼'}</span>
        </button>
        {showThresholds && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {THRESHOLD_RULES.map(rule => (
              <ThresholdCard key={rule.id} rule={rule} indicators={indicatorMap} />
            ))}
          </div>
        )}
      </div>

      {/* Alert history */}
      <div>
        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['all', 'unread', 'critical', 'high', 'elevated'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', border: 'none',
                  background: filter === f ? (f === 'critical' ? '#FF2D55' : f === 'high' ? '#FF9500' : f === 'elevated' ? '#FFD700' : '#00D4FF') : 'rgba(255,255,255,0.06)',
                  color: filter === f ? '#050608' : '#6B7280',
                  fontWeight: filter === f ? 700 : 400,
                  textTransform: 'uppercase',
                  transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                onClick={handleClearAcknowledged}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  padding: '4px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)',
                  color: '#00FF88', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <CheckCheck size={10} /> CLEAR READ
              </button>
            )}
            {alertHistory.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  padding: '4px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#4B5563', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Trash2 size={10} /> CLEAR ALL
              </button>
            )}
          </div>
        </div>

        {/* Alert list */}
        {filteredAlerts.length === 0 ? (
          <div style={{
            background: 'rgba(10,12,16,0.7)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px', padding: '32px', textAlign: 'center',
          }}>
            <Shield size={28} style={{ color: '#1F2937', marginBottom: '10px' }} />
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
              {filter === 'unread' ? 'No Unread Alerts' : 'No Alerts'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#1F2937' }}>
              {filter === 'all'
                ? 'Alert engine is monitoring all thresholds. Events will appear here when triggered.'
                : `No ${filter} alerts in history.`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredAlerts.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{
        textAlign: 'center', padding: '16px',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151',
        borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '24px',
      }}>
        PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE · ALERTS ARE INFORMATIONAL ONLY
      </div>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function Alerts() {
  return (
    <PremiumGateFull variant="risk">
      <AlertsInner />
    </PremiumGateFull>
  );
}
