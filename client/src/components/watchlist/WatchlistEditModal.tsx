import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  INDICATOR_CATALOG,
  INDICATOR_MAP,
  type AlertCondition,
  type AlertSeverity,
  type WatchlistItem,
} from '@/lib/watchlist';
import { buildWatchlistItem } from './WatchlistEditModel';
import { CATEGORY_COLORS, SEVERITY_CONFIG } from './watchlistPresentation';

export interface WatchlistEditModalProps {
  item?: WatchlistItem | null;
  onSave: (item: WatchlistItem) => void;
  onClose: () => void;
  liveValues: Record<string, number | null>;
}

export function WatchlistEditModal({ item, onSave, onClose, liveValues }: WatchlistEditModalProps) {
  const [indicatorKey, setIndicatorKey] = useState(item?.indicatorKey ?? 'score_overall');
  const [condition, setCondition] = useState<AlertCondition>(item?.condition ?? 'above');
  const [threshold, setThreshold] = useState(item?.thresholdValue ?? 7.0);
  const [severity, setSeverity] = useState<AlertSeverity>(item?.severity ?? 'high');
  const [note, setNote] = useState(item?.note ?? '');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const def = INDICATOR_MAP[indicatorKey];

  useEffect(() => {
    if (!item) {
      const nextDefinition = INDICATOR_MAP[indicatorKey];
      if (nextDefinition) {
        setThreshold(nextDefinition.defaultThreshold);
        setCondition(nextDefinition.defaultCondition);
      }
    }
  }, [indicatorKey, item]);

  const categories = useMemo(() => {
    const catalogCategories = new Set(INDICATOR_CATALOG.map(definition => definition.category));
    return ['all', ...Array.from(catalogCategories)];
  }, []);

  const filteredCatalog = useMemo(
    () => INDICATOR_CATALOG.filter(definition => categoryFilter === 'all' || definition.category === categoryFilter),
    [categoryFilter],
  );

  const handleSave = () => {
    if (!def) return;
    onSave(buildWatchlistItem({
      indicatorKey,
      thresholdValue: threshold,
      condition,
      severity,
      note,
    }, item));
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
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Select Indicator</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {categories.map(category => (
                <button key={category} onClick={() => setCategoryFilter(category)} style={{
                  padding: '3px 10px', borderRadius: '3px', cursor: 'pointer', minHeight: '28px',
                  background: categoryFilter === category ? `${CATEGORY_COLORS[category] ?? '#00D4FF'}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${categoryFilter === category ? (CATEGORY_COLORS[category] ?? '#00D4FF') + '40' : 'rgba(255,255,255,0.06)'}`,
                  color: categoryFilter === category ? (CATEGORY_COLORS[category] ?? '#00D4FF') : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {category}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
              {filteredCatalog.map(definition => {
                const liveValue = liveValues[definition.key];
                const isSelected = indicatorKey === definition.key;
                const categoryColor = CATEGORY_COLORS[definition.category] ?? '#00D4FF';
                return (
                  <button key={definition.key} onClick={() => setIndicatorKey(definition.key)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left',
                    background: isSelected ? `${categoryColor}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? categoryColor + '35' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.15s ease', minHeight: '40px',
                  }}>
                    <div style={{ width: '3px', height: '28px', background: isSelected ? categoryColor : 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: '13px', color: isSelected ? '#F0F4FF' : '#94A3B8' }}>{definition.label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563' }}>{definition.sublabel}</div>
                    </div>
                    {liveValue != null && (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: isSelected ? categoryColor : '#6B7280', flexShrink: 0 }}>
                        {definition.format(liveValue)}
                      </div>
                    )}
                    {isSelected && <Check size={12} style={{ color: categoryColor, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

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

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Alert Condition</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {(['above', 'below'] as AlertCondition[]).map(nextCondition => (
                <button key={nextCondition} onClick={() => setCondition(nextCondition)} style={{
                  flex: 1, padding: '10px', borderRadius: '4px', cursor: 'pointer', minHeight: '44px',
                  background: condition === nextCondition ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${condition === nextCondition ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  color: condition === nextCondition ? '#00D4FF' : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                  {nextCondition === 'above' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {nextCondition === 'above' ? 'Alert when ABOVE' : 'Alert when BELOW'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="range"
                  min={def?.min ?? 0}
                  max={def?.max ?? 10}
                  step={def?.step ?? 0.1}
                  value={threshold}
                  onChange={event => setThreshold(parseFloat(event.target.value))}
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

            {def && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: '#374151', alignSelf: 'center', marginRight: '3px' }}>QUICK:</span>
                {[
                  { label: 'Default', value: def.defaultThreshold },
                  { label: 'Stress', value: def.stressLevel },
                  { label: 'Normal Lo', value: def.normalRange[0] },
                  { label: 'Normal Hi', value: def.normalRange[1] },
                ].map(preset => (
                  <button key={preset.label} onClick={() => setThreshold(preset.value)} style={{
                    padding: '3px 8px', borderRadius: '2px', cursor: 'pointer', minHeight: '24px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  }}>
                    {preset.label} ({def.format(preset.value)})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Alert Severity</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(Object.entries(SEVERITY_CONFIG) as [AlertSeverity, typeof SEVERITY_CONFIG[AlertSeverity]][]).map(([nextSeverity, config]) => (
                <button key={nextSeverity} onClick={() => setSeverity(nextSeverity)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: '4px', cursor: 'pointer', minHeight: '44px',
                  background: severity === nextSeverity ? config.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${severity === nextSeverity ? config.color + '40' : 'rgba(255,255,255,0.05)'}`,
                  color: severity === nextSeverity ? config.color : '#6B7280',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Note (optional)</div>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
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
