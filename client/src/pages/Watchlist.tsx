/* ============================================================
   FAULTLINE — Watchlist Tab
   Pin specific macro indicators, set custom alert thresholds
   with above/below conditions, and receive live visual alerts
   when thresholds are crossed. Persisted to localStorage.

   Design: Palantir Noir — void-black, neon accents, scanlines.
   ============================================================ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Bell, BellOff, Edit3,
  ChevronDown, ChevronUp, AlertTriangle,
  Minus, BookOpen, Zap, Info, Bitcoin, Target,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useEngine } from '@/contexts/EngineContext';
import { getRiskColor } from '@/components/RiskBadge';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import {
  WatchlistItem, IndicatorDef, INDICATOR_CATALOG, INDICATOR_MAP,
  loadWatchlist, saveWatchlist, evaluateBreach, getBreachDistance,
  AlertSeverity,
} from '@/lib/watchlist';
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { PreflightTrigger } from "@/components/MarketPreflight";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { WatchlistEditModal } from '@/components/watchlist/WatchlistEditModal';
import { CATEGORY_COLORS, SEVERITY_CONFIG } from '@/components/watchlist/watchlistPresentation';

// ── Watchlist tab type ─────────────────────────────────────────
type WatchlistTab = 'macro' | 'crypto' | 'daytrade';
const WATCHLIST_TABS: { id: WatchlistTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'macro',    label: 'Macro Alerts',  icon: Bell,    desc: 'FRED indicators & pressure scores' },
  { id: 'crypto',   label: 'Crypto',        icon: Bitcoin, desc: 'Saved crypto tokens with signals' },
  { id: 'daytrade', label: 'Day Trade',     icon: Target,  desc: 'Day trade setups & watchlist' },
];

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
// ── Tab navigation bar component ─────────────────────────────
function WatchlistTabBar({ active, onChange }: { active: WatchlistTab; onChange: (t: WatchlistTab) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '0 16px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {WATCHLIST_TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 14px', cursor: 'pointer', border: 'none',
              background: 'transparent',
              borderBottom: isActive ? '2px solid #00D4FF' : '2px solid transparent',
              color: isActive ? '#00D4FF' : '#4B5563',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              transition: 'color 0.15s ease',
              marginBottom: '-1px',
            }}
          >
            <Icon size={12} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const FREE_WATCHLIST_LIMIT = 3;

export default function Watchlist() {
  useSEO(PAGE_SEO.watchlist);
  const { user } = useAuth();
  const { indicators, output } = useEngine();
  const isFreeUser = !user || ((user as { accessTier?: string }).accessTier ?? 'free') === 'free';
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
        // Editing existing item — always allowed
        const next = [...prev];
        next[idx] = newItem;
        return next;
      }
      // Adding new item — check free tier cap
      if (isFreeUser && prev.length >= FREE_WATCHLIST_LIMIT) {
        toast.error(`Observer limit reached`, {
          description: `Observer accounts can track up to ${FREE_WATCHLIST_LIMIT} indicators. Upgrade to Core ($9.99/mo) for unlimited watchlists.`,
          duration: 5000,
        });
        return prev;
      }
      return [...prev, newItem];
    });
    setEditingItem(undefined);
  }, [isFreeUser]);

  const handleDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<WatchlistTab>('macro');

  return (
    <div style={{ background: '#050608', minHeight: '100vh', padding: '0 0 80px' }}>
      {/* Edit/Add modal */}
      {editingItem !== undefined && activeTab === 'macro' && (
        <WatchlistEditModal
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PreflightTrigger
              currentPage="watchlist"
              actionKey="viewed_watchlist"
              regimeLabel={output?.regime?.label}
            />
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
          </div>
        }
      />

      {/* Tab navigation */}
      <WatchlistTabBar active={activeTab} onChange={setActiveTab} />

      {/* Crypto tab — redirect to Crypto Watchlist page */}
      {activeTab === 'crypto' && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Bitcoin size={24} style={{ color: '#FF9500' }} />
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#94A3B8', marginBottom: '8px' }}>Crypto Watchlist</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#4B5563', marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>Track crypto tokens with live signals, risk levels, and momentum analysis.</div>
          <button onClick={() => navigate('/app/crypto-watchlist')} style={{ padding: '10px 20px', background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: '5px', color: '#FF9500', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Open Crypto Watchlist →</button>
        </div>
      )}

      {/* Day Trade tab — redirect to Day Trade Intelligence page */}
      {activeTab === 'daytrade' && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Target size={24} style={{ color: '#00D4FF' }} />
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#94A3B8', marginBottom: '8px' }}>Day Trade Watchlist</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#4B5563', marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>Save symbols for intraday setups. Managed inside Day Trade Intelligence™.</div>
          <button onClick={() => navigate('/app/day-trade-intelligence')} style={{ padding: '10px 20px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '5px', color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Open Day Trade Intelligence →</button>
        </div>
      )}

      {/* Macro Alerts tab */}
      {activeTab === 'macro' && (
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
      )}
    </div>
  );
}
