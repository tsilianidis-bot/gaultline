/* ============================================================
   FAULTLINE — Signals Tab
   Macro-regime-aware market scanner with live Polygon.io data.
   ============================================================ */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useEngine } from '@/contexts/EngineContext';
import { TickerSearch } from '@/components/TickerSearch';
import {
  SIGNAL_STOCKS, SIGNAL_COLORS, CATEGORY_META, ALL_SECTORS, ALL_MARKET_CAPS, ALL_CATEGORIES,
  DEFAULT_FILTERS, filterStocks, scoreStockForRegime, getTodaysTopSignals,
  mapRegimeToCode, REGIME_CONTEXT, REGIME_PRIORITY_CATEGORIES,
  type SignalStock, type FaultlineSignal, type ScreeningCategory, type SignalFilters,
} from '@/lib/signalsData';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';

// ── Live Quote Types ──────────────────────────────────────────
interface LiveQuote {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  volume: number;
  volumeMillions: number;
  timestamp: number;
  marketStatus: 'open' | 'closed' | 'extended' | 'unknown';
  isLive: boolean;
  sparkline: number[];
}

interface QuotesResponse {
  quotes: LiveQuote[];
  timestamp: string;
  marketStatus: string;
  tradeDate?: string;
  source: 'live' | 'stale' | 'fallback';
  cached?: boolean;
  count?: number;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}
function fmtCap(billions: number) {
  if (billions >= 1000) return `$${(billions / 1000).toFixed(1)}T`;
  if (billions >= 1) return `$${billions.toFixed(1)}B`;
  return `$${(billions * 1000).toFixed(0)}M`;
}
function volumeSurge(s: SignalStock, liveVol?: number) {
  const vol = liveVol !== undefined ? liveVol : s.volume;
  return (vol / s.avgVolume).toFixed(1);
}
function fmtTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

// ── Signal Tag ────────────────────────────────────────────────
function SignalTag({ signal }: { signal: FaultlineSignal }) {
  const c = SIGNAL_COLORS[signal];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '2px',
      fontSize: '9px',
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: '0.08em',
      fontWeight: 700,
      textTransform: 'uppercase',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.text}30`,
      boxShadow: `0 0 6px ${c.glow}`,
      whiteSpace: 'nowrap',
    }}>
      {signal}
    </span>
  );
}

// ── Mini Sparkline ────────────────────────────────────────────
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const pts = data.map((v, i) => ({ i, v }));
  const color = positive ? '#00D4FF' : '#FF2D55';
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone" dataKey="v" dot={false}
          stroke={color} strokeWidth={1.5}
          isAnimationActive={false}
        />
        <RTooltip
          contentStyle={{ display: 'none' }}
          cursor={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(8,10,14,0.9)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '4px',
      padding: '12px',
      animation: 'fl-pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ width: '60px', height: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '4px' }} />
          <div style={{ width: '100px', height: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ width: '70px', height: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '4px' }} />
          <div style={{ width: '50px', height: '11px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
        </div>
      </div>
      <div style={{ height: '36px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginBottom: '8px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px' }} />
        ))}
      </div>
    </div>
  );
}

// ── Stock Card ────────────────────────────────────────────────
function StockCard({ stock, regimeScore, liveQuote }: { stock: SignalStock; regimeScore: number; liveQuote?: LiveQuote }) {
  const [expanded, setExpanded] = useState(false);

  // Use live data if available, fall back to catalog data
  const price = liveQuote?.price && liveQuote.price > 0 ? liveQuote.price : stock.price;
  const changePercent = liveQuote?.price && liveQuote.price > 0 ? liveQuote.changePercent : stock.changePercent;
  const volumeMillions = liveQuote?.volumeMillions ?? stock.volume;
  const sparklineData = liveQuote?.sparkline && liveQuote.sparkline.length > 0 ? liveQuote.sparkline : stock.sparkline;
  const isLiveData = !!(liveQuote?.price && liveQuote.price > 0);

  const positive = changePercent >= 0;
  const surge = parseFloat(volumeSurge(stock, liveQuote?.volumeMillions));
  const highSurge = surge >= 1.5;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'rgba(8,10,14,0.9)',
        border: `1px solid ${positive ? 'rgba(0,212,255,0.12)' : 'rgba(255,45,85,0.12)'}`,
        borderRadius: '4px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.23,1,0.32,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = positive ? 'rgba(0,212,255,0.3)' : 'rgba(255,45,85,0.3)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(12,15,20,0.95)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = positive ? 'rgba(0,212,255,0.12)' : 'rgba(255,45,85,0.12)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(8,10,14,0.9)';
      }}
    >
      {/* Regime score bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        height: '2px',
        width: `${regimeScore}%`,
        background: `linear-gradient(90deg, #00D4FF, #FFD700)`,
        opacity: 0.6,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700, fontSize: '16px',
              color: '#F0F4FF', letterSpacing: '0.05em',
            }}>{stock.ticker}</span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '8px', letterSpacing: '0.1em',
              color: 'rgba(100,116,139,0.8)',
              background: 'rgba(255,255,255,0.04)',
              padding: '1px 5px', borderRadius: '2px',
            }}>{stock.marketCap}</span>
            {/* Live data badge */}
            {isLiveData && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '7px', letterSpacing: '0.08em',
                color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                padding: '1px 4px', borderRadius: '2px',
                border: '1px solid rgba(0,212,255,0.15)',
              }}>LIVE</span>
            )}
            {stock.earningsDaysAway !== undefined && stock.earningsDaysAway <= 14 && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px', letterSpacing: '0.08em',
                color: '#FFD700', background: 'rgba(255,215,0,0.1)',
                padding: '1px 5px', borderRadius: '2px',
                border: '1px solid rgba(255,215,0,0.2)',
              }}>EARN {stock.earningsDaysAway}d</span>
            )}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px', color: 'rgba(100,116,139,0.7)',
            marginTop: '2px', maxWidth: '140px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{stock.name}</div>
        </div>

        {/* Price + change */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700, fontSize: '14px',
            color: '#F0F4FF',
          }}>${fmt(price)}</div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px', fontWeight: 700,
            color: positive ? '#00D4FF' : '#FF2D55',
          }}>{positive ? '+' : ''}{fmt(changePercent)}%</div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: '8px' }}>
        <MiniSparkline data={sparklineData} positive={positive} />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px', marginBottom: '8px',
      }}>
        {[
          { label: 'RS', value: stock.relativeStrength.toString(), color: stock.relativeStrength > 70 ? '#00D4FF' : stock.relativeStrength < 40 ? '#FF2D55' : '#94A3B8' },
          { label: 'VOL', value: `${surge}x`, color: highSurge ? '#FFD700' : '#94A3B8' },
          { label: 'SECTOR', value: stock.sector.split(' ')[0], color: '#94A3B8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '2px', padding: '4px 6px',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.1em' }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Signal tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: expanded ? '8px' : 0 }}>
        {stock.signals.slice(0, 2).map(sig => (
          <SignalTag key={sig} signal={sig} />
        ))}
        {stock.signals.length > 2 && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px', color: 'rgba(100,116,139,0.6)',
            padding: '2px 6px',
          }}>+{stock.signals.length - 2}</span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '8px', marginTop: '4px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            {[
              { label: 'Market Cap', value: fmtCap(stock.marketCapValue) },
              { label: 'Short Interest', value: stock.shortInterest ? `${stock.shortInterest}%` : 'N/A' },
              { label: 'Debt/Equity', value: stock.debtToEquity !== undefined ? stock.debtToEquity.toFixed(1) : 'N/A' },
              { label: 'Avg Volume', value: `${stock.avgVolume.toFixed(1)}M` },
              { label: 'AI Exposure', value: stock.aiExposure },
              { label: 'Recession Sens.', value: stock.recessionSensitivity },
              ...(liveQuote?.price && liveQuote.price > 0 ? [
                { label: 'Day Open', value: `$${fmt(liveQuote.open)}` },
                { label: 'Day High/Low', value: `$${fmt(liveQuote.high)} / $${fmt(liveQuote.low)}` },
              ] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.1em' }}>{label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#94A3B8' }}>{value}</div>
              </div>
            ))}
          </div>
          {/* All signals */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {stock.signals.map(sig => <SignalTag key={sig} signal={sig} />)}
          </div>
          {/* Data source */}
          <div style={{
            marginTop: '8px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '7px', color: 'rgba(55,65,81,0.6)',
            letterSpacing: '0.08em',
          }}>
            {isLiveData ? 'SOURCE: POLYGON.IO · /api/signals/quotes' : `API: ${stock.apiSources.quote}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Top Signal Card ───────────────────────────────────────────
function TopSignalCard({ label, stock, color, icon, liveQuote }: { label: string; stock: SignalStock; color: string; icon: string; liveQuote?: LiveQuote }) {
  const changePercent = liveQuote?.price && liveQuote.price > 0 ? liveQuote.changePercent : stock.changePercent;
  const positive = changePercent >= 0;
  return (
    <div style={{
      background: 'rgba(8,10,14,0.9)',
      border: `1px solid ${color}25`,
      borderRadius: '4px',
      padding: '12px',
      flex: '1 1 160px',
      minWidth: '140px',
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '8px', letterSpacing: '0.12em',
        color: 'rgba(100,116,139,0.6)',
        marginBottom: '6px', textTransform: 'uppercase',
      }}>{icon} {label}</div>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: '18px',
        color: '#F0F4FF', letterSpacing: '0.05em',
        marginBottom: '2px',
      }}>{stock.ticker}</div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px', color: 'rgba(100,116,139,0.7)',
        marginBottom: '4px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{stock.name}</div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '12px', fontWeight: 700,
        color: positive ? '#00D4FF' : '#FF2D55',
      }}>{positive ? '+' : ''}{fmt(changePercent)}%</div>
      <div style={{ marginTop: '6px' }}>
        <MiniSparkline data={liveQuote?.sparkline?.length ? liveQuote.sparkline : stock.sparkline} positive={positive} />
      </div>
    </div>
  );
}

// ── API Health Badge ──────────────────────────────────────────
function ApiHealthBadge({ source, tradeDate, lastUpdated, isLoading }: {
  source: 'live' | 'stale' | 'fallback' | null;
  tradeDate?: string;
  lastUpdated: string | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '8px', letterSpacing: '0.1em',
        color: 'rgba(100,116,139,0.5)',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: '#FFD700',
          animation: 'fl-pulse 1s ease-in-out infinite',
        }} />
        FETCHING MARKET DATA...
      </div>
    );
  }

  const isLive = source === 'live';
  const isStale = source === 'stale';
  const isFallback = source === 'fallback' || source === null;

  const color = isLive ? '#00D4FF' : isStale ? '#FFD700' : '#FF2D55';
  const label = isLive ? 'POLYGON.IO LIVE' : isStale ? 'STALE CACHE' : 'FALLBACK MODE';
  const dot = isLive ? 'fl-pulse 2s ease-in-out infinite' : 'none';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '8px', letterSpacing: '0.1em',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: dot,
        }} />
        <span style={{ color }}>{label}</span>
      </div>
      {tradeDate && (
        <span style={{ color: 'rgba(100,116,139,0.5)' }}>
          SESSION: {tradeDate}
        </span>
      )}
      {lastUpdated && (
        <span style={{ color: 'rgba(100,116,139,0.4)' }}>
          UPDATED: {fmtTimestamp(lastUpdated)}
        </span>
      )}
      {isFallback && (
        <span style={{ color: '#FF2D55' }}>· MARKET DATA UNAVAILABLE</span>
      )}
    </div>
  );
}

// ── Main Signals Page ─────────────────────────────────────────
export default function Signals() {
  const engine = useEngine();

  // ── Live Polygon.io data state ─────────────────────────────
  const [quotesData, setQuotesData] = useState<QuotesResponse | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const fetchQuotes = useCallback(async () => {
    const myCount = ++fetchCountRef.current;
    setQuotesLoading(true);
    setQuotesError(null);
    try {
      const res = await fetch('/api/signals/quotes', {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as QuotesResponse;
      if (myCount === fetchCountRef.current) {
        setQuotesData(data);
      }
    } catch (err) {
      if (myCount === fetchCountRef.current) {
        setQuotesError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (myCount === fetchCountRef.current) {
        setQuotesLoading(false);
      }
    }
  }, []);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // Build a map of ticker → live quote for fast lookup
  const quoteMap = useMemo(() => {
    const map = new Map<string, LiveQuote>();
    for (const q of quotesData?.quotes ?? []) {
      map.set(q.ticker, q);
    }
    return map;
  }, [quotesData]);

  // Merge live quotes into SIGNAL_STOCKS for use in scoring/filtering
  const enrichedStocks = useMemo((): SignalStock[] => {
    return SIGNAL_STOCKS.map(s => {
      const q = quoteMap.get(s.ticker);
      if (!q || q.price === 0) return s;
      return {
        ...s,
        price: q.price,
        changePercent: q.changePercent,
        volume: q.volumeMillions,
        sparkline: q.sparkline.length > 0 ? q.sparkline : s.sparkline,
      };
    });
  }, [quoteMap]);

  // Derive regime code from engine
  const regimeCode = useMemo(() => mapRegimeToCode(engine?.output?.regime?.label ?? 'MODERATE RISK'), [engine?.output?.regime?.label]);
  const regimeCtx = REGIME_CONTEXT[regimeCode];
  const priorityCats = REGIME_PRIORITY_CATEGORIES[regimeCode];

  // Filters state
  const [filters, setFilters] = useState<SignalFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ScreeningCategory | 'All'>('All');

  const updateFilter = useCallback(<K extends keyof SignalFilters>(key: K, value: SignalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Scored and filtered stocks (using enriched data)
  const displayedStocks = useMemo(() => {
    const filtersWithCat: SignalFilters = { ...filters, category: activeCategory };
    const filtered = filterStocks(enrichedStocks, filtersWithCat);
    return filtered.map(s => ({
      stock: s,
      score: scoreStockForRegime(s, regimeCode),
    })).sort((a, b) => b.score - a.score);
  }, [filters, activeCategory, regimeCode, enrichedStocks]);

  // Today's top signals (using enriched data when available)
  const topSignals = useMemo(() => getTodaysTopSignals(regimeCode, enrichedStocks.length > 0 ? enrichedStocks : undefined), [regimeCode, enrichedStocks]);

  // Regime color
  const regimeColor = useMemo(() => {
    if (!engine?.output?.regime) return '#00D4FF';
    return engine.output.regime.color ?? '#00D4FF';
  }, [engine?.output?.regime]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020305',
      padding: '0 0 120px 0',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>

      {/* ── Regime Context Banner ─────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(8,10,14,0.98), rgba(12,16,22,0.95))`,
        borderBottom: `1px solid ${regimeColor}20`,
        padding: '16px 16px 14px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '200px', height: '200px',
          background: `radial-gradient(circle, ${regimeColor}08 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: regimeColor,
                boxShadow: `0 0 8px ${regimeColor}`,
                animation: 'fl-pulse 2s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700, fontSize: '13px',
                color: regimeColor, letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>SIGNALS — {regimeCtx.headline}</span>
            </div>
            <p style={{
              fontSize: '10px', color: 'rgba(100,116,139,0.8)',
              lineHeight: 1.5, margin: 0, maxWidth: '500px',
            }}>{regimeCtx.description}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '8px', color: 'rgba(100,116,139,0.5)', marginBottom: '2px' }}>REGIME SCORE</div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700, fontSize: '22px',
              color: regimeColor,
            }}>{engine?.output?.overall?.score?.toFixed(1) ?? '—'}<span style={{ fontSize: '12px', color: 'rgba(100,116,139,0.5)' }}>/10</span></div>
          </div>
        </div>

        {/* Bullish/Bearish context */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '8px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.1em' }}>FAVORS:</span>
            <span style={{ fontSize: '9px', color: '#00D4FF' }}>{regimeCtx.bullish}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '8px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.1em' }}>AVOIDS:</span>
            <span style={{ fontSize: '9px', color: '#FF2D55' }}>{regimeCtx.bearish}</span>
          </div>
        </div>

        {/* API Health Monitor */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <ApiHealthBadge
            source={quotesData?.source ?? null}
            tradeDate={quotesData?.tradeDate}
            lastUpdated={quotesData?.timestamp ?? null}
            isLoading={quotesLoading}
          />
        </div>
      </div>

      {/* ── Ticker Intelligence Search ──────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        <TickerSearch
          regime={{
            label: engine?.output?.regime?.label ?? 'MODERATE RISK',
            score: engine?.output?.overall?.score ?? 5,
            description: engine?.output?.regime?.description,
          }}
        />
      </div>

      {/* ── Divider ──────────────────────────────────────── */}
      <div style={{ margin: '4px 16px 0', height: '1px', background: 'rgba(255,255,255,0.04)' }} />

      {/* ── Today's Top Signals ───────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px', letterSpacing: '0.2em',
          color: 'rgba(100,116,139,0.5)',
          textTransform: 'uppercase', marginBottom: '10px',
        }}>TODAY'S TOP SIGNALS</div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <TopSignalCard label="Top Bullish" stock={topSignals.topBullish} color="#00D4FF" icon="▲" liveQuote={quoteMap.get(topSignals.topBullish.ticker)} />
          <TopSignalCard label="Top Bearish" stock={topSignals.topBearish} color="#FF2D55" icon="▼" liveQuote={quoteMap.get(topSignals.topBearish.ticker)} />
          <TopSignalCard label="Volume Breakout" stock={topSignals.highestVolume} color="#FFD700" icon="⚡" liveQuote={quoteMap.get(topSignals.highestVolume.ticker)} />
          <TopSignalCard label="Macro Risk" stock={topSignals.highestMacroRisk} color="#FF9500" icon="⚠" liveQuote={quoteMap.get(topSignals.highestMacroRisk.ticker)} />
          <TopSignalCard label="AI Momentum" stock={topSignals.strongestAI} color="#A855F7" icon="◈" liveQuote={quoteMap.get(topSignals.strongestAI.ticker)} />
        </div>
      </div>

      {/* ── Category Filter Tabs ──────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          display: 'flex', gap: '6px',
          overflowX: 'auto', paddingBottom: '4px',
        }}>
          {ALL_CATEGORIES.map(cat => {
            const isPriority = cat !== 'All' && priorityCats.includes(cat as ScreeningCategory);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '9px', letterSpacing: '0.08em',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  border: isActive
                    ? `1px solid ${regimeColor}60`
                    : isPriority
                      ? '1px solid rgba(255,215,0,0.2)'
                      : '1px solid rgba(255,255,255,0.06)',
                  background: isActive
                    ? `${regimeColor}15`
                    : isPriority
                      ? 'rgba(255,215,0,0.04)'
                      : 'rgba(255,255,255,0.02)',
                  color: isActive ? regimeColor : isPriority ? '#FFD700' : 'rgba(100,116,139,0.7)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {cat === 'All' ? 'ALL' : (CATEGORY_META[cat as ScreeningCategory]?.icon ?? '') + ' ' + cat.replace(/-/g, ' ')}
                {isPriority && <span style={{ marginLeft: '4px', color: '#FFD700', fontSize: '7px' }}>★</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Panel Toggle ───────────────────────────── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '9px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.1em' }}>
          {quotesLoading ? 'LOADING...' : `${displayedStocks.length} SIGNALS FOUND`}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Manual refresh button */}
          <button
            onClick={fetchQuotes}
            disabled={quotesLoading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '8px', letterSpacing: '0.1em',
              padding: '4px 8px',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '2px',
              background: 'rgba(0,212,255,0.05)',
              color: quotesLoading ? 'rgba(100,116,139,0.3)' : '#00D4FF',
              cursor: quotesLoading ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >↻ REFRESH</button>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '9px', letterSpacing: '0.1em',
              padding: '5px 12px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2px',
              background: showFilters ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
              color: showFilters ? '#00D4FF' : 'rgba(100,116,139,0.7)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {showFilters ? '▲ FILTERS' : '▼ FILTERS'}
          </button>
        </div>
      </div>

      {/* ── Filter Panel ─────────────────────────────────── */}
      {showFilters && (
        <div style={{
          margin: '10px 16px',
          background: 'rgba(8,10,14,0.95)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '4px',
          padding: '14px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            <FilterSelect label="SECTOR" value={filters.sector} onChange={v => updateFilter('sector', v)} options={ALL_SECTORS} />
            <FilterSelect label="MARKET CAP" value={filters.marketCap} onChange={v => updateFilter('marketCap', v)} options={ALL_MARKET_CAPS} />
            <FilterSelect label="AI EXPOSURE" value={filters.aiExposure} onChange={v => updateFilter('aiExposure', v)} options={['All', 'High', 'Medium', 'Low', 'None']} />
            <FilterSelect label="RECESSION SENS." value={filters.recessionSensitivity} onChange={v => updateFilter('recessionSensitivity', v)} options={['All', 'High', 'Medium', 'Low']} />
            <FilterSelect label="DEBT SENS." value={filters.debtSensitivity} onChange={v => updateFilter('debtSensitivity', v)} options={['All', 'High', 'Medium', 'Low']} />
            <FilterRange label="MIN RS" value={filters.minRS} min={0} max={100} step={5} onChange={v => updateFilter('minRS', v)} />
            <FilterRange label="MIN VOL SURGE" value={filters.minVolumeSurge} min={0} max={5} step={0.5} onChange={v => updateFilter('minVolumeSurge', v)} suffix="x" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
            <FilterToggle label="EARNINGS SOON" value={filters.hasEarnings} onChange={v => updateFilter('hasEarnings', v)} />
            <FilterToggle label="HIGH SHORT INT." value={filters.hasShortInterest} onChange={v => updateFilter('hasShortInterest', v)} />
          </div>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            style={{
              marginTop: '10px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '8px', letterSpacing: '0.1em',
              padding: '4px 10px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px',
              background: 'transparent',
              color: 'rgba(100,116,139,0.5)',
              cursor: 'pointer',
            }}
          >RESET FILTERS</button>
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────── */}
      {quotesError && !quotesLoading && (
        <div style={{
          margin: '10px 16px',
          padding: '10px 12px',
          background: 'rgba(255,45,85,0.06)',
          border: '1px solid rgba(255,45,85,0.15)',
          borderRadius: '4px',
          fontSize: '9px', color: 'rgba(255,45,85,0.8)',
          letterSpacing: '0.08em',
        }}>
          ⚠ MARKET DATA ERROR: {quotesError} — Showing catalog data
        </div>
      )}

      {/* ── Stock Grid ────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0' }}>
        {quotesLoading && displayedStocks.length === 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px',
          }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayedStocks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            color: 'rgba(100,116,139,0.4)',
            fontSize: '11px', letterSpacing: '0.1em',
          }}>NO SIGNALS MATCH CURRENT FILTERS</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px',
          }}>
            {displayedStocks.map(({ stock, score }) => (
              <StockCard
                key={stock.ticker}
                stock={stock}
                regimeScore={score}
                liveQuote={quoteMap.get(stock.ticker)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Data Source Panel ─────────────────────────────── */}
      <div style={{
        margin: '24px 16px 0',
        padding: '12px',
        background: quotesData?.source === 'live' ? 'rgba(0,212,255,0.03)' : 'rgba(255,45,85,0.03)',
        border: `1px solid ${quotesData?.source === 'live' ? 'rgba(0,212,255,0.08)' : 'rgba(255,45,85,0.08)'}`,
        borderRadius: '4px',
      }}>
        <div style={{
          fontSize: '8px', letterSpacing: '0.12em',
          color: 'rgba(100,116,139,0.5)',
          lineHeight: 1.6,
        }}>
          {quotesData?.source === 'live' ? (
            <>
              <span style={{ color: '#00D4FF' }}>LIVE DATA</span> — Polygon.io market data via secure backend proxy.
              Session: <span style={{ color: 'rgba(100,116,139,0.7)' }}>{quotesData.tradeDate ?? '—'}</span> ·
              Quotes: <span style={{ color: 'rgba(100,116,139,0.7)' }}>{quotesData.count ?? 0}/19 tickers</span> ·
              Refreshes every 5 minutes.
            </>
          ) : (
            <>
              <span style={{ color: '#FF2D55' }}>CATALOG DATA</span> — Live market data unavailable.
              Showing static catalog prices. Connect Polygon.io for live quotes.
            </>
          )}
        </div>
      </div>

      {/* ── Disclaimer ────────────────────────────────────── */}
      <div style={{
        margin: '16px 16px 0',
        fontSize: '8px', letterSpacing: '0.08em',
        color: 'rgba(55,65,81,0.5)',
        textAlign: 'center', lineHeight: 1.5,
      }}>
        Probabilistic macro-regime intelligence. Not financial advice. Past performance does not guarantee future results.
      </div>
    </div>
  );
}

// ── Filter helper components ──────────────────────────────────
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.5)', marginBottom: '4px' }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '2px',
          color: '#94A3B8',
          padding: '4px 6px',
          cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o} value={o} style={{ background: '#050608' }}>{o}</option>)}
      </select>
    </div>
  );
}

function FilterRange({ label, value, min, max, step, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.5)', marginBottom: '4px' }}>
        {label}: <span style={{ color: '#00D4FF' }}>{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#00D4FF', cursor: 'pointer' }}
      />
    </div>
  );
}

function FilterToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '8px', letterSpacing: '0.08em',
        padding: '4px 10px',
        border: `1px solid ${value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '2px',
        background: value ? 'rgba(0,212,255,0.1)' : 'transparent',
        color: value ? '#00D4FF' : 'rgba(100,116,139,0.5)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {value ? '✓ ' : ''}{label}
    </button>
  );
}
