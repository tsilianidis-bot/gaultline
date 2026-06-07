/* ============================================================
   FAULTLINE — Watchlist Tab
   Pin specific macro indicators, set custom alert thresholds
   with above/below conditions, and receive live visual alerts
   when thresholds are crossed. Persisted to localStorage.

   Design: Palantir Noir — void-black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Bell, BellOff, Edit3, Check, X,
  ChevronDown, ChevronUp, AlertTriangle, TrendingUp,
  TrendingDown, Minus, BookOpen, Zap, Info,
} from 'lucide-react';
import { useEngine } from '@/contexts/EngineContext';
import { getRiskColor } from '@/components/RiskBadge';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import {
  WatchlistItem, IndicatorDef, INDICATOR_CATALOG, INDICATOR_MAP,
  loadWatchlist, saveWatchlist, evaluateBreach, getBreachDistance, nanoid8,
  AlertCondition, AlertSeverity,
} from '@/lib/watchlist';
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";

// ── Helpers ───────────────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildSparkline(seed: number, n: number, base: number, vol: number) {
  const r = seededRand(seed);
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v + (r() - 0.48) * vol);
    return { i, v: parseFloat(v.toFixed(3)) };
  });
}

function getLiveValue(
  indicatorKey: string,
  indicators: Record<string, number>,
  output: { overall: { score: number }; domains: { id: string; score: number }[] }
): number | null {
  // Domain scores
  if (indicatorKey === 'score_overall') return output.overall.score;
  if (indicatorKey === 'score_credit') return output.domains.find(d => d.id === 'credit-stress')?.score ?? null;
  if (indicatorKey === 'score_ai') return output.domains.find(d => d.id === 'ai-bubble')?.score ?? null;
  if (indicatorKey === 'score_treasury') return output.domains.find(d => d.id === 'treasury-debt')?.score ?? null;
  if (indicatorKey === 'score_recession') return output.domains.find(d => d.id === 'recession')?.score ?? null;
  // Raw indicators
  const v = indicators[indicatorKey as keyof typeof indicators];
  return typeof v === 'number' ? v : null;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; label: string; bg: string }> = {
  critical: { color: '#FF2D55', label: 'CRITICAL', bg: 'rgba(255,45,85,0.08)' },
  high:     { color: '#FF9500', label: 'HIGH',     bg: 'rgba(255,149,0,0.08)' },
  moderate: { color: '#FFD700', label: 'MODERATE', bg: 'rgba(255,215,0,0.06)' },
};

const CATEGORY_COLORS: Record<string, string> = {
  rates: '#00D4FF', credit: '#FF9500', inflation: '#FFD700',
  speculation: '#C084FC', liquidity: '#FF9500', economy: '#00FF88', score: '#00D4FF',
};

// ── Add / Edit modal ──────────────────────────────────────────
interface EditModalProps {
  item?: WatchlistItem | null;
  onSave: (item: WatchlistItem) => void;
  onClose: () => void;
  liveValues: Record<string, number | null>;
}

function EditModal({ item, onSave, onClose, liveValues }: EditModalProps) {
  const [indicatorKey, setIndicatorKey] = useState(item?.indicatorKey ?? 'score_overall');
  const [condition, setCondition] = useState<AlertCondition>(item?.condition ?? 'above');
  const [threshold, setThreshold] = useState(item?.thresholdValue ?? 7.0);
  const [severity, setSeverity] = useState<AlertSeverity>(item?.severity ?? 'high');
  const [note, setNote] = useState(item?.note ?? '');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const def = INDICATOR_MAP[indicatorKey];
  const liveVal = liveValues[indicatorKey];

  // Update threshold when indicator changes
  useEffect(() => {
    if (!item) {
      const d = INDICATOR_MAP[indicatorKey];
      if (d) {
        setThreshold(d.defaultThreshold);
        setCondition(d.defaultCondition);
      }
    }
  }, [indicatorKey, item]);

  const categories = useMemo(() => {
    const cats = new Set(INDICATOR_CATALOG.map(d => d.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredCatalog = useMemo(() =>
    INDICATOR_CATALOG.filter(d => categoryFilter === 'all' || d.category === categoryFilter),
    [categoryFilter]
  );

  const handleSave = () => {
    if (!def) return;
    const newItem: WatchlistItem = {
      id: item?.id ?? nanoid8(),
      indicatorKey,
      thresholdValue: threshold,
      condition,
      severity,
      note: note.trim() || undefined,
      createdAt: item?.createdAt ?? Date.now(),
      breachCount: item?.breachCount ?? 0,
      lastBreached: item?.lastBreached,
    };
    onSave(newItem);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(5,6,8,0.9)', backdropFilter: 'blur(10px)',
      animation: 'fade-in 0.2s ease both',
    }}>
      <div style={{
        width: '100%', maxWidth: '520px',
        background: '#0A0C10',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none',
        borderRadius: '12px 12px 0 0',
        maxHeight: '90vh',
        overflow: 'auto',
        animation: 'onboard-slide 0.3s cubic-bezier(0.23,1,0.32,1) both',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#0A0C10', zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#F0F4FF' }}>
              {item ? 'Edit Alert' : 'Add to Watchlist'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', letterSpacing: '0.1em', marginTop: '2px' }}>
              SET THRESHOLD · CONDITION · SEVERITY
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', minHeight: 'unset' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 20px 24px' }}>
          {/* Indicator selector */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Select Indicator</div>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
                  padding: '3px 10px', borderRadius: '3px', cursor: 'pointer', minHeight: '28px',
                  background: categoryFilter === cat ? `${CATEGORY_COLORS[cat] ?? '#00D4FF'}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${categoryFilter === cat ? (CATEGORY_COLORS[cat] ?? '#00D4FF') + '40' : 'rgba(255,255,255,0.06)'}`,
                  color: categoryFilter === cat ? (CATEGORY_COLORS[cat] ?? '#00D4FF') : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {cat}
                </button>
              ))}
            </div>
            {/* Indicator list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
              {filteredCatalog.map(d => {
                const lv = liveValues[d.key];
                const isSelected = indicatorKey === d.key;
                const catColor = CATEGORY_COLORS[d.category] ?? '#00D4FF';
                return (
                  <button key={d.key} onClick={() => setIndicatorKey(d.key)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left',
                    background: isSelected ? `${catColor}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? catColor + '35' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.15s ease', minHeight: '40px',
                  }}>
                    <div style={{ width: '3px', height: '28px', background: isSelected ? catColor : 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: isSelected ? '#F0F4FF' : '#94A3B8' }}>{d.label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{d.sublabel}</div>
                    </div>
                    {lv != null && (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: isSelected ? catColor : '#6B7280', flexShrink: 0 }}>
                        {d.format(lv)}
                      </div>
                    )}
                    {isSelected && <Check size={12} style={{ color: catColor, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected indicator info */}
          {def && (
            <div style={{ padding: '10px 12px', background: `${CATEGORY_COLORS[def.category] ?? '#00D4FF'}08`, border: `1px solid ${CATEGORY_COLORS[def.category] ?? '#00D4FF'}18`, borderRadius: '4px', marginBottom: '16px' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', lineHeight: 1.55 }}>{def.description}</div>
              {def.apiSource && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', marginTop: '5px' }}>Source: {def.apiSource}</div>
              )}
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', marginTop: '3px' }}>
                Normal range: {def.format(def.normalRange[0])} – {def.format(def.normalRange[1])}
              </div>
            </div>
          )}

          {/* Condition + Threshold */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Alert Condition</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {(['above', 'below'] as AlertCondition[]).map(cond => (
                <button key={cond} onClick={() => setCondition(cond)} style={{
                  flex: 1, padding: '10px', borderRadius: '4px', cursor: 'pointer', minHeight: '44px',
                  background: condition === cond ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${condition === cond ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  color: condition === cond ? '#00D4FF' : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                  {cond === 'above' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {cond === 'above' ? 'Alert when ABOVE' : 'Alert when BELOW'}
                </button>
              ))}
            </div>

            {/* Threshold input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="range"
                  min={def?.min ?? 0}
                  max={def?.max ?? 10}
                  step={def?.step ?? 0.1}
                  value={threshold}
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#00D4FF', cursor: 'pointer' }}
                />
              </div>
              <div style={{
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: '4px', padding: '8px 12px', minWidth: '70px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '16px', color: '#00D4FF', fontWeight: 700, lineHeight: 1 }}>
                  {def ? def.format(threshold) : threshold.toFixed(1)}
                </div>
                {def && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#4B5563', marginTop: '2px' }}>{def.unit || 'value'}</div>}
              </div>
            </div>

            {/* Quick presets */}
            {def && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', alignSelf: 'center', marginRight: '3px' }}>QUICK:</span>
                {[
                  { label: 'Default', val: def.defaultThreshold },
                  { label: 'Stress', val: def.stressLevel },
                  { label: 'Normal Lo', val: def.normalRange[0] },
                  { label: 'Normal Hi', val: def.normalRange[1] },
                ].map(p => (
                  <button key={p.label} onClick={() => setThreshold(p.val)} style={{
                    padding: '3px 8px', borderRadius: '2px', cursor: 'pointer', minHeight: '24px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  }}>
                    {p.label} ({def.format(p.val)})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Severity */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Alert Severity</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(Object.entries(SEVERITY_CONFIG) as [AlertSeverity, typeof SEVERITY_CONFIG[AlertSeverity]][]).map(([sev, cfg]) => (
                <button key={sev} onClick={() => setSeverity(sev)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: '4px', cursor: 'pointer', minHeight: '44px',
                  background: severity === sev ? cfg.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${severity === sev ? cfg.color + '40' : 'rgba(255,255,255,0.05)'}`,
                  color: severity === sev ? cfg.color : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Note (optional)</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Credit crunch threshold — 2008 analog"
              maxLength={120}
              rows={2}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '4px', padding: '10px 12px', color: '#94A3B8', resize: 'none',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', lineHeight: 1.5,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Save */}
          <button onClick={handleSave} style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))',
            border: '1px solid rgba(0,212,255,0.35)',
            borderRadius: '6px', color: '#00D4FF',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: 'pointer', boxShadow: '0 0 20px rgba(0,212,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            minHeight: '52px',
          }}>
            <Bell size={15} />
            {item ? 'Update Alert' : 'Add to Watchlist'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Watchlist card ────────────────────────────────────────────
interface WatchlistCardProps {
  item: WatchlistItem;
  liveValue: number | null;
  def: IndicatorDef;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

function WatchlistCard({ item, liveValue, def, onEdit, onDelete, index }: WatchlistCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const isBreached = liveValue != null && evaluateBreach(item, liveValue);
  const proximity = liveValue != null ? getBreachDistance(item, liveValue, def) : 0;
  const sevCfg = SEVERITY_CONFIG[item.severity];
  const catColor = CATEGORY_COLORS[def.category] ?? '#00D4FF';

  // Sparkline — stable seed from item id
  const seed = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const sparkBase = liveValue ?? def.defaultThreshold;
  const sparkData = useMemo(() => buildSparkline(seed, 28, sparkBase, sparkBase * 0.04), [seed, sparkBase]);

  const borderColor = isBreached ? sevCfg.color : proximity > 0.6 ? sevCfg.color + '60' : 'rgba(255,255,255,0.06)';
  const bgColor = isBreached ? sevCfg.bg : proximity > 0.6 ? `${sevCfg.color}04` : 'rgba(10,12,16,0.9)';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${isBreached ? sevCfg.color : catColor}`,
      borderRadius: '6px',
      overflow: 'hidden',
      animation: `fade-slide-up 0.45s cubic-bezier(0.23,1,0.32,1) ${index * 55}ms both`,
      boxShadow: isBreached ? `0 0 24px ${sevCfg.color}18, 0 0 8px ${sevCfg.color}10` : 'none',
      transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
    }}>
      {/* Breach banner */}
      {isBreached && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 14px',
          background: `${sevCfg.color}12`,
          borderBottom: `1px solid ${sevCfg.color}25`,
        }}>
          <AlertTriangle size={11} style={{ color: sevCfg.color, flexShrink: 0, animation: 'blink-alert 1.5s ease-in-out infinite' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: sevCfg.color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            THRESHOLD BREACHED — {item.condition.toUpperCase()} {def.format(item.thresholdValue)}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: sevCfg.color + '80', marginLeft: 'auto' }}>
            {sevCfg.label}
          </span>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Left: info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: catColor, textTransform: 'uppercase', letterSpacing: '0.1em', background: `${catColor}12`, border: `1px solid ${catColor}25`, borderRadius: '2px', padding: '1px 5px' }}>
                {def.category}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: sevCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em', background: sevCfg.bg, border: `1px solid ${sevCfg.color}25`, borderRadius: '2px', padding: '1px 5px' }}>
                {sevCfg.label}
              </span>
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '15px', color: '#E2E8F0', marginBottom: '2px' }}>
              {item.label ?? def.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563' }}>
                {item.condition === 'above' ? '▲ ALERT ABOVE' : '▼ ALERT BELOW'}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: sevCfg.color, fontWeight: 600 }}>
                {def.format(item.thresholdValue)}
              </span>
            </div>
            {item.note && (
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.note}
              </div>
            )}
          </div>

          {/* Right: live value + sparkline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '26px', color: isBreached ? sevCfg.color : catColor, textShadow: isBreached ? `0 0 20px ${sevCfg.color}80` : `0 0 12px ${catColor}60`, lineHeight: 1 }}>
              {liveValue != null ? def.format(liveValue) : '—'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>LIVE</div>
            <div style={{ width: '70px', height: '24px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
                  <Line type="monotone" dataKey="v" stroke={isBreached ? sevCfg.color : catColor} strokeWidth={1.5} dot={false} style={{ filter: `drop-shadow(0 0 3px ${isBreached ? sevCfg.color : catColor}60)` }} />
                  <ReferenceLine y={item.thresholdValue} stroke={sevCfg.color} strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.6} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Proximity bar */}
        {!isBreached && proximity > 0.2 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proximity to threshold</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: sevCfg.color }}>{Math.round(proximity * 100)}%</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${proximity * 100}%`, background: `linear-gradient(90deg, ${sevCfg.color}60, ${sevCfg.color})`, borderRadius: '2px', transition: 'width 0.8s cubic-bezier(0.23,1,0.32,1)', boxShadow: `0 0 6px ${sevCfg.color}60` }} />
            </div>
          </div>
        )}

        {/* Expand detail */}
        <button onClick={() => setShowDetail(!showDetail)} style={{
          width: '100%', marginTop: '10px', padding: '6px 0',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          color: '#374151', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
          letterSpacing: '0.08em', textTransform: 'uppercase', minHeight: '28px',
        }}>
          {showDetail ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showDetail ? 'Less' : 'Details'}
        </button>

        {showDetail && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', animation: 'fade-slide-up 0.2s ease both' }}>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#6B7280', lineHeight: 1.6, marginBottom: '8px' }}>
              {def.description}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              {[
                { label: 'Normal Range', val: `${def.format(def.normalRange[0])} – ${def.format(def.normalRange[1])}` },
                { label: 'Stress Level', val: def.format(def.stressLevel) },
                { label: 'Breach Count', val: item.breachCount.toString() },
                { label: 'Added', val: new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
              ].map(r => (
                <div key={r.label} style={{ padding: '7px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>{r.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#94A3B8' }}>{r.val}</div>
                </div>
              ))}
            </div>
            {def.apiSource && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151' }}>
                API Source: {def.apiSource}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>
          <button onClick={onEdit} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '4px', color: '#6B7280', cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
            minHeight: '36px',
          }}>
            <Edit3 size={11} /> Edit
          </button>
          <button onClick={onDelete} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '8px 14px', background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.15)',
            borderRadius: '4px', color: '#FF2D55', cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
            minHeight: '36px',
          }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary stats bar ─────────────────────────────────────────
function SummaryBar({ items, liveValues }: { items: WatchlistItem[]; liveValues: Record<string, number | null> }) {
  const breached = items.filter(item => {
    const lv = liveValues[item.indicatorKey];
    return lv != null && evaluateBreach(item, lv);
  });
  const critical = breached.filter(i => i.severity === 'critical').length;
  const high = breached.filter(i => i.severity === 'high').length;
  const moderate = breached.filter(i => i.severity === 'moderate').length;

  return (
    <div style={{
      display: 'flex', gap: '8px', flexWrap: 'wrap',
      padding: '12px 14px',
      background: breached.length > 0 ? 'rgba(255,45,85,0.05)' : 'rgba(10,12,16,0.9)',
      border: `1px solid ${breached.length > 0 ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '6px',
      marginBottom: '10px',
      animation: 'fade-slide-up 0.4s cubic-bezier(0.23,1,0.32,1) both',
    }}>
      <div style={{ flex: 1, minWidth: '100px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Watching</div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#00D4FF', lineHeight: 1 }}>{items.length}</div>
      </div>
      <div style={{ flex: 1, minWidth: '80px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Breached</div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: breached.length > 0 ? '#FF2D55' : '#374151', lineHeight: 1, textShadow: breached.length > 0 ? '0 0 16px rgba(255,45,85,0.6)' : 'none' }}>{breached.length}</div>
      </div>
      {critical > 0 && (
        <div style={{ flex: 1, minWidth: '80px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF2D55', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Critical</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#FF2D55', lineHeight: 1, animation: 'blink-alert 2s ease-in-out infinite' }}>{critical}</div>
        </div>
      )}
      {high > 0 && (
        <div style={{ flex: 1, minWidth: '80px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>High</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#FF9500', lineHeight: 1 }}>{high}</div>
        </div>
      )}
      {moderate > 0 && (
        <div style={{ flex: 1, minWidth: '80px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Moderate</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '22px', color: '#FFD700', lineHeight: 1 }}>{moderate}</div>
        </div>
      )}
      {breached.length === 0 && items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '3px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00FF88', letterSpacing: '0.1em' }}>ALL CLEAR</span>
        </div>
      )}
    </div>
  );
}

// ── Main Watchlist page ───────────────────────────────────────
export default function Watchlist() {
  useSEO(PAGE_SEO.watchlist);
  const { indicators, output } = useEngine();
  const [items, setItems] = useState<WatchlistItem[]>(() => loadWatchlist());
  const [editingItem, setEditingItem] = useState<WatchlistItem | null | undefined>(undefined);
  const [filterBreached, setFilterBreached] = useState(false);
  const [sortBy, setSortBy] = useState<'severity' | 'breach' | 'added'>('breach');

  // Persist on change
  useEffect(() => { saveWatchlist(items); }, [items]);

  // Build live values map
  const liveValues = useMemo<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    INDICATOR_CATALOG.forEach(def => {
      map[def.key] = getLiveValue(def.key, indicators as unknown as Record<string, number>, output);
    });
    return map;
  }, [indicators, output]);

  // Update breach counts when values change
  useEffect(() => {
    setItems(prev => prev.map(item => {
      const lv = liveValues[item.indicatorKey];
      if (lv != null && evaluateBreach(item, lv)) {
        return { ...item, lastBreached: Date.now(), breachCount: item.breachCount + 1 };
      }
      return item;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValues]);

  // Sort + filter
  const displayItems = useMemo(() => {
    let list = [...items];
    if (filterBreached) {
      list = list.filter(item => {
        const lv = liveValues[item.indicatorKey];
        return lv != null && evaluateBreach(item, lv);
      });
    }
    const sevOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, moderate: 2 };
    if (sortBy === 'severity') list.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
    else if (sortBy === 'breach') {
      list.sort((a, b) => {
        const aB = liveValues[a.indicatorKey] != null && evaluateBreach(a, liveValues[a.indicatorKey]!) ? 0 : 1;
        const bB = liveValues[b.indicatorKey] != null && evaluateBreach(b, liveValues[b.indicatorKey]!) ? 0 : 1;
        return aB - bB || sevOrder[a.severity] - sevOrder[b.severity];
      });
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [items, filterBreached, sortBy, liveValues]);

  const handleSave = useCallback((newItem: WatchlistItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === newItem.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
    setEditingItem(undefined);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <div style={{ background: '#050608', minHeight: '100vh', padding: '0 0 80px' }}>
      {/* Edit/Add modal */}
      {editingItem !== undefined && (
        <EditModal
          item={editingItem}
          onSave={handleSave}
          onClose={() => setEditingItem(undefined)}
          liveValues={liveValues}
        />
      )}

      <PageHeader
        title="Watchlist"
        subtitle="Pin any macro indicator, set a custom threshold, and get a live visual alert when it’s breached."
        badge="LIVE"
        badgeColor="green"
        rightSlot={
          <button
            onClick={() => setEditingItem(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))',
              border: '1px solid rgba(0,212,255,0.35)',
              borderRadius: '5px', color: '#00D4FF',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', boxShadow: '0 0 16px rgba(0,212,255,0.1)',
              minHeight: '44px', flexShrink: 0,
            }}
          >
            <Plus size={13} />
            Add
          </button>
        }
      />

      {/* Content */}
      <div style={{ padding: '14px 16px 0', maxWidth: '800px', margin: '0 auto' }}>

        {/* Summary bar */}
        <SummaryBar items={items} liveValues={liveValues} />

        {/* Controls */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Breached filter */}
            <button
              onClick={() => setFilterBreached(!filterBreached)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', minHeight: '34px',
                background: filterBreached ? 'rgba(255,45,85,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterBreached ? 'rgba(255,45,85,0.35)' : 'rgba(255,255,255,0.07)'}`,
                color: filterBreached ? '#FF2D55' : '#6B7280',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            >
              <AlertTriangle size={10} />
              Breached only
            </button>

            {/* Sort */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', alignSelf: 'center', marginRight: '3px' }}>SORT:</span>
              {(['breach', 'severity', 'added'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  padding: '4px 9px', borderRadius: '2px', cursor: 'pointer', minHeight: '28px',
                  background: sortBy === s ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${sortBy === s ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  color: sortBy === s ? '#00D4FF' : '#4B5563',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', textTransform: 'capitalize',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) both',
          }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bell size={24} style={{ color: '#00D4FF', opacity: 0.6 }} />
            </div>
            <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#6B7280', marginBottom: '8px' }}>No indicators pinned</h3>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto 20px' }}>
              Add indicators from the catalog and set custom thresholds to receive live alerts when conditions are breached.
            </p>
            <button
              onClick={() => setEditingItem(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: '5px', color: '#00D4FF',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer', minHeight: '44px',
              }}
            >
              <Plus size={13} />
              Add First Indicator
            </button>
          </div>
        )}

        {/* No results after filter */}
        {items.length > 0 && displayItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#374151' }}>
              No breached thresholds — all indicators within range.
            </div>
          </div>
        )}

        {/* Watchlist cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayItems.map((item, i) => {
            const def = INDICATOR_MAP[item.indicatorKey];
            if (!def) return null;
            return (
              <WatchlistCard
                key={item.id}
                item={item}
                liveValue={liveValues[item.indicatorKey]}
                def={def}
                onEdit={() => setEditingItem(item)}
                onDelete={() => handleDelete(item.id)}
                index={i}
              />
            );
          })}
        </div>

        {/* How it works */}
        {items.length > 0 && (
          <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(10,12,16,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', animation: 'fade-slide-up 0.5s cubic-bezier(0.23,1,0.32,1) 400ms both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
              <Info size={11} style={{ color: '#374151', flexShrink: 0 }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em' }}>How Watchlist Works</span>
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#374151', lineHeight: 1.6, margin: 0 }}>
              Thresholds are evaluated against live FRED data (refreshed every 15 minutes) and the reactive engine scores. Breached alerts are highlighted with a severity-colored banner. Sparklines show the last 28 data points with a dashed reference line at your threshold. All settings are saved locally to your device.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#374151', letterSpacing: '0.1em' }}>
            PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE
          </span>
        </div>
      </div>
    </div>
  );
}
