/* ============================================================
   FAULTLINE — Signals Tab
   Macro-regime-aware market scanner with live Yahoo Finance + Polygon.io data
   + actionable BUY / SELL / HOLD trading signals.
   ============================================================ */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useEngine } from '@/contexts/EngineContext';
import { trpc } from '@/lib/trpc';
import { TickerSearch } from '@/components/TickerSearch';
import {
  SIGNAL_STOCKS, SIGNAL_COLORS, CATEGORY_META, ALL_SECTORS, ALL_MARKET_CAPS, ALL_CATEGORIES,
  DEFAULT_FILTERS, filterStocks, scoreStockForRegime, getTodaysTopSignals,
  mapRegimeToCode, REGIME_CONTEXT, REGIME_PRIORITY_CATEGORIES,
  type SignalStock, type FaultlineSignal, type ScreeningCategory, type SignalFilters,
} from '@/lib/signalsData';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { Link } from 'wouter';
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";

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

// ── Trading Signal Types (mirror server/tradingSignals.ts) ────
type TradingAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

interface DailyBar {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

interface TradingSignalResult {
  ticker: string;
  action: TradingAction;
  confidence: number;
  strength: 'Strong' | 'Moderate' | 'Weak';
  timeframe: 'Short-Term' | 'Swing' | 'Watch';
  rationale: string;
  technicals: {
    rsiEstimate: number;
    rsiIsTrue?: boolean;          // true = real Wilder's RSI from daily bars
    rsiLabel: 'Overbought' | 'Neutral' | 'Oversold';
    trend: 'Uptrend' | 'Downtrend' | 'Sideways';
    volumeSignal: 'Surge' | 'Normal' | 'Low';
    momentumScore: number;
    smaSignal: 'Golden Cross' | 'Death Cross' | 'Neutral';
    smaIsTrue?: boolean;          // true = real 50/200-day SMA from daily bars
    macd?: {
      macdLine: number;    // EMA(12) - EMA(26)
      signalLine: number;  // EMA(9) of macdLine
      histogram: number;   // macdLine - signalLine
      signal: 'Bullish' | 'Bearish' | 'Neutral';
    } | null;
  };
  priceLevels: {
    support: number;
    resistance: number;
    entryZone: number;
    stopLoss: number;
    targetPrice: number;
    riskReward: number;
    atr: number;
  };
  regimeAlignment: 'Aligned' | 'Neutral' | 'Counter-Trend';
  regimeAlignmentScore: number;
  computedAt: number;
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

// ── Trading Action Colors ─────────────────────────────────────
const ACTION_COLORS: Record<TradingAction, { bg: string; text: string; glow: string; border: string }> = {
  BUY:   { bg: 'rgba(0,212,255,0.15)',  text: '#00D4FF', glow: 'rgba(0,212,255,0.5)',  border: 'rgba(0,212,255,0.4)' },
  SELL:  { bg: 'rgba(255,45,85,0.15)',  text: '#FF2D55', glow: 'rgba(255,45,85,0.5)',  border: 'rgba(255,45,85,0.4)' },
  HOLD:  { bg: 'rgba(255,215,0,0.12)',  text: '#FFD700', glow: 'rgba(255,215,0,0.4)',  border: 'rgba(255,215,0,0.3)' },
  WATCH: { bg: 'rgba(100,116,139,0.1)', text: '#64748B', glow: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.2)' },
};

// ── Trading Signal Badge ──────────────────────────────────────
function TradingSignalBadge({ action, confidence, strength }: {
  action: TradingAction;
  confidence: number;
  strength: 'Strong' | 'Moderate' | 'Weak';
}) {
  const c = ACTION_COLORS[action];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px',
        borderRadius: '2px',
        fontSize: '10px',
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.12em',
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 8px ${c.glow}`,
        whiteSpace: 'nowrap',
      }}>
        {action === 'BUY' && '▲ '}
        {action === 'SELL' && '▼ '}
        {action === 'HOLD' && '◆ '}
        {action === 'WATCH' && '◎ '}
        {action}
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '12px', color: 'rgba(100,116,139,0.6)',
        letterSpacing: '0.06em',
      }}>{strength.toUpperCase()}</span>
    </div>
  );
}

// ── Confidence Bar ────────────────────────────────────────────
function ConfidenceBar({ confidence, action }: { confidence: number; action: TradingAction }) {
  const c = ACTION_COLORS[action];
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '3px',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em',
        }}>CONFIDENCE</span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '12px', fontWeight: 700, color: c.text,
        }}>{confidence}%</span>
      </div>
      <div style={{
        height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${confidence}%`,
          background: `linear-gradient(90deg, ${c.text}80, ${c.text})`,
          boxShadow: `0 0 6px ${c.glow}`,
          borderRadius: '2px',
          transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
        }} />
      </div>
    </div>
  );
}

// ── Regime Alignment Badge ────────────────────────────────────
function RegimeAlignmentBadge({ alignment, score }: {
  alignment: 'Aligned' | 'Neutral' | 'Counter-Trend';
  score: number;
}) {
  const color = alignment === 'Aligned' ? '#00D4FF'
    : alignment === 'Counter-Trend' ? '#FF2D55'
    : '#FFD700';
  const icon = alignment === 'Aligned' ? '✓' : alignment === 'Counter-Trend' ? '✗' : '~';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '11px', letterSpacing: '0.08em',
      color, padding: '1px 5px',
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: '2px',
    }}>
      {icon} {alignment === 'Counter-Trend' ? 'COUNTER' : alignment.toUpperCase()} {score.toFixed(0)}/10
    </span>
  );
}

// ── Signal Tag ────────────────────────────────────────────────
function SignalTag({ signal }: { signal: FaultlineSignal }) {
  const c = SIGNAL_COLORS[signal];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '2px',
      fontSize: '13px',
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
        <RTooltip contentStyle={{ display: 'none' }} cursor={false} />
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
function StockCard({ stock, regimeScore, liveQuote, tradingSignal, signalBlocked }: {
  stock: SignalStock;
  regimeScore: number;
  liveQuote?: LiveQuote;
  tradingSignal?: TradingSignalResult;
  signalBlocked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Lazy-load stock info only when the INFO panel is opened
  const { data: stockInfo, isFetching: infoLoading } = trpc.signals.getStockInfo.useQuery(
    { ticker: stock.ticker },
    { enabled: infoOpen, staleTime: 30 * 60 * 1000 }
  );

  const price = liveQuote?.price && liveQuote.price > 0 ? liveQuote.price : stock.price;
  const changePercent = liveQuote?.price && liveQuote.price > 0 ? liveQuote.changePercent : stock.changePercent;
  const volumeMillions = liveQuote?.volumeMillions ?? stock.volume;
  const sparklineData = liveQuote?.sparkline && liveQuote.sparkline.length > 0 ? liveQuote.sparkline : stock.sparkline;
  const isLiveData = !!(liveQuote?.price && liveQuote.price > 0);

  const positive = changePercent >= 0;
  const surge = parseFloat(volumeSurge(stock, liveQuote?.volumeMillions));
  const highSurge = surge >= 1.5;

  // Trading signal colors for card border
  const actionColor = tradingSignal
    ? ACTION_COLORS[tradingSignal.action].text
    : positive ? '#00D4FF' : '#FF2D55';
  const actionBorderOpacity = tradingSignal ? '0.25' : '0.12';

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'rgba(8,10,14,0.9)',
        border: `1px solid ${actionColor}${actionBorderOpacity}`,
        borderRadius: '4px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.23,1,0.32,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${actionColor}45`;
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(12,15,20,0.95)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${actionColor}${actionBorderOpacity}`;
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(8,10,14,0.9)';
      }}
    >
      {/* Regime score bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        height: '2px',
        width: `${regimeScore}%`,
        background: tradingSignal
          ? `linear-gradient(90deg, ${ACTION_COLORS[tradingSignal.action].text}, ${ACTION_COLORS[tradingSignal.action].glow})`
          : `linear-gradient(90deg, #00D4FF, #FFD700)`,
        opacity: 0.7,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700, fontSize: '16px',
              color: '#F0F4FF', letterSpacing: '0.05em',
            }}>{stock.ticker}</span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px', letterSpacing: '0.1em',
              color: 'rgba(100,116,139,0.8)',
              background: 'rgba(255,255,255,0.04)',
              padding: '1px 5px', borderRadius: '2px',
            }}>{stock.marketCap}</span>
            {isLiveData && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.08em',
                color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                padding: '1px 4px', borderRadius: '2px',
                border: '1px solid rgba(0,212,255,0.15)',
              }}>LIVE</span>
            )}
            {stock.earningsDaysAway !== undefined && stock.earningsDaysAway <= 14 && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '12px', letterSpacing: '0.08em',
                color: '#FFD700', background: 'rgba(255,215,0,0.1)',
                padding: '1px 5px', borderRadius: '2px',
                border: '1px solid rgba(255,215,0,0.2)',
              }}>EARN {stock.earningsDaysAway}d</span>
            )}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '13px', color: 'rgba(100,116,139,0.7)',
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

      {/* ── Trading Signal Row ─────────────────────────────── */}
      {tradingSignal && (
        <div style={{
          marginBottom: '8px',
          padding: '7px 8px',
          background: `${ACTION_COLORS[tradingSignal.action].text}08`,
          border: `1px solid ${ACTION_COLORS[tradingSignal.action].text}18`,
          borderRadius: '3px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <TradingSignalBadge
              action={tradingSignal.action}
              confidence={tradingSignal.confidence}
              strength={tradingSignal.strength}
            />
            <RegimeAlignmentBadge
              alignment={tradingSignal.regimeAlignment}
              score={tradingSignal.regimeAlignmentScore}
            />
          </div>
          <ConfidenceBar confidence={tradingSignal.confidence} action={tradingSignal.action} />
          <div style={{
            marginTop: '5px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px', color: 'rgba(100,116,139,0.6)',
            lineHeight: 1.4,
          }}>{tradingSignal.rationale}</div>
        </div>
      )}

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
          { label: tradingSignal?.technicals.rsiIsTrue ? 'RSI(14)' : 'RSI~', value: tradingSignal ? tradingSignal.technicals.rsiEstimate.toFixed(0) : stock.relativeStrength.toString(), color: (tradingSignal?.technicals.rsiEstimate ?? stock.relativeStrength) > 70 ? '#FF2D55' : (tradingSignal?.technicals.rsiEstimate ?? stock.relativeStrength) < 30 ? '#00D4FF' : '#94A3B8' },
          { label: 'VOL', value: `${surge}x`, color: highSurge ? '#FFD700' : '#94A3B8' },
          { label: tradingSignal ? 'TREND' : 'SECTOR', value: tradingSignal ? tradingSignal.technicals.trend.split('trend')[0].toUpperCase() || tradingSignal.technicals.trend.toUpperCase() : stock.sector.split(' ')[0], color: tradingSignal?.technicals.trend === 'Uptrend' ? '#00D4FF' : tradingSignal?.technicals.trend === 'Downtrend' ? '#FF2D55' : '#94A3B8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '2px', padding: '4px 6px',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.6)', letterSpacing: '0.1em' }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Inline Entry / Stop / Target (collapsed view) ─── */}
      {tradingSignal && (tradingSignal.action === 'BUY' || tradingSignal.action === 'SELL') && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px', marginBottom: '8px',
        }}>
          {[
            { label: 'ENTRY', value: `$${tradingSignal.priceLevels.entryZone.toFixed(2)}`, color: ACTION_COLORS[tradingSignal.action].text },
            { label: 'STOP', value: `$${tradingSignal.priceLevels.stopLoss.toFixed(2)}`, color: '#FF2D55' },
            { label: 'TARGET', value: `$${tradingSignal.priceLevels.targetPrice.toFixed(2)}`, color: '#00D4FF' },
            { label: 'R:R', value: `${tradingSignal.priceLevels.riskReward}:1`, color: tradingSignal.priceLevels.riskReward >= 2 ? '#22C55E' : tradingSignal.priceLevels.riskReward >= 1.5 ? '#FFD700' : '#FF9500' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '2px', padding: '4px 6px',
              borderTop: `2px solid ${color}30`,
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signal tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: expanded ? '8px' : 0 }}>
        {stock.signals.slice(0, 2).map(sig => (
          <SignalTag key={sig} signal={sig} />
        ))}
        {stock.signals.length > 2 && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '13px', color: 'rgba(100,116,139,0.6)',
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
          {/* Upgrade prompt when tier gate blocks signals */}
          {!tradingSignal && signalBlocked && (
            <div style={{
              marginBottom: '10px',
              padding: '12px 10px',
              background: 'rgba(255,153,0,0.04)',
              border: '1px solid rgba(255,153,0,0.18)',
              borderRadius: '3px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#FF9500' }}>⚠</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', color: 'rgba(255,153,0,0.7)' }}>PRO INTELLIGENCE LOCKED</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: 'rgba(148,163,184,0.85)', lineHeight: 1.5 }}>
                Stop loss, resistance, support, entry zone, and target price require a <span style={{ color: '#FF9500' }}>Premium or Founding</span> membership.
              </div>
              {/* Blurred placeholder grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', opacity: 0.25, pointerEvents: 'none', filter: 'blur(2px)' }}>
                {['ENTRY', 'STOP LOSS', 'TARGET', 'R:R'].map(lbl => (
                  <div key={lbl} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', padding: '5px 4px', borderTop: '2px solid rgba(255,153,0,0.2)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.08em', marginBottom: '2px' }}>{lbl}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color: '#FF9500' }}>———</div>
                  </div>
                ))}
              </div>
              <a
                href="/app/account"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: '5px', padding: '6px 12px',
                  background: 'rgba(255,153,0,0.12)',
                  border: '1px solid rgba(255,153,0,0.35)',
                  borderRadius: '3px',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '12px', letterSpacing: '0.12em',
                  color: '#FF9500', textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,153,0,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,153,0,0.12)')}
              >
                ⚡ UPGRADE TO PRO — UNLOCK PRICE LEVELS
              </a>
            </div>
          )}
          {/* Key Price Levels (only when trading signal available) */}
          {tradingSignal && (
            <div style={{
              marginBottom: '10px',
              padding: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '3px',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.15em',
                color: 'rgba(100,116,139,0.75)',
                marginBottom: '6px',
              }}>KEY PRICE LEVELS</div>
              {/* Top row: entry/stop/target/R:R */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '6px' }}>
                {[
                  { label: 'ENTRY', value: `$${tradingSignal.priceLevels.entryZone.toFixed(2)}`, color: ACTION_COLORS[tradingSignal.action].text, sub: tradingSignal.action === 'BUY' ? 'BUY ZONE' : tradingSignal.action === 'SELL' ? 'SHORT ZONE' : 'LEVEL' },
                  { label: 'STOP LOSS', value: `$${tradingSignal.priceLevels.stopLoss.toFixed(2)}`, color: '#FF2D55', sub: `ATR ×1.5` },
                  { label: 'TARGET', value: `$${tradingSignal.priceLevels.targetPrice.toFixed(2)}`, color: '#00D4FF', sub: '2:1 R:R' },
                  { label: 'RISK/REWARD', value: `${tradingSignal.priceLevels.riskReward}:1`, color: tradingSignal.priceLevels.riskReward >= 2 ? '#22C55E' : tradingSignal.priceLevels.riskReward >= 1.5 ? '#FFD700' : '#FF9500', sub: `ATR $${tradingSignal.priceLevels.atr.toFixed(2)}` },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', padding: '5px 4px', borderTop: `2px solid ${color}30` }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.08em', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.65)', marginTop: '1px' }}>{sub}</div>
                  </div>
                ))}
              </div>
              {/* Bottom row: support/resistance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {[
                  { label: 'SUPPORT', value: tradingSignal.priceLevels.support, color: '#22C55E' },
                  { label: 'RESISTANCE', value: tradingSignal.priceLevels.resistance, color: '#FF9500' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', padding: '4px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.08em', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700, color }}>${value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical indicators */}
          {tradingSignal && (
            <div style={{
              marginBottom: '10px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
            }}>
              {[
                { label: tradingSignal.technicals.rsiIsTrue ? 'RSI(14)' : 'RSI~', value: `${tradingSignal.technicals.rsiEstimate.toFixed(0)} ${tradingSignal.technicals.rsiLabel.toUpperCase()}`, color: tradingSignal.technicals.rsiLabel === 'Overbought' ? '#FF2D55' : tradingSignal.technicals.rsiLabel === 'Oversold' ? '#00D4FF' : '#94A3B8', badge: tradingSignal.technicals.rsiIsTrue ? 'TRUE' : undefined },
                { label: tradingSignal.technicals.smaIsTrue ? 'SMA(50/200)' : 'SMA~', value: tradingSignal.technicals.smaSignal.toUpperCase(), color: tradingSignal.technicals.smaSignal === 'Golden Cross' ? '#00D4FF' : tradingSignal.technicals.smaSignal === 'Death Cross' ? '#FF2D55' : '#94A3B8', badge: tradingSignal.technicals.smaIsTrue ? 'TRUE' : undefined },
                { label: 'VOLUME', value: tradingSignal.technicals.volumeSignal.toUpperCase(), color: tradingSignal.technicals.volumeSignal === 'Surge' ? '#FFD700' : tradingSignal.technicals.volumeSignal === 'Low' ? '#FF2D55' : '#94A3B8', badge: undefined },
              ].map(({ label, value, color, badge }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '2px', padding: '4px 6px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {label}
                    {badge && <span style={{ fontSize: '13px', color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '0 3px', borderRadius: '2px' }}>{badge}</span>}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
              {/* MACD row — only shown when real daily bars are available */}
              {tradingSignal.technicals.macd && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '2px', padding: '4px 6px', gridColumn: '1 / -1' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                    MACD (12/26/9)
                    <span style={{ fontSize: '13px', color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '0 3px', borderRadius: '2px' }}>TRUE</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[
                      { label: 'MACD', value: tradingSignal.technicals.macd.macdLine.toFixed(3) },
                      { label: 'SIGNAL', value: tradingSignal.technicals.macd.signalLine.toFixed(3) },
                      { label: 'HIST', value: tradingSignal.technicals.macd.histogram.toFixed(3), color: tradingSignal.technicals.macd.histogram > 0 ? '#00D4FF' : '#FF2D55' },
                      { label: 'TREND', value: tradingSignal.technicals.macd.signal.toUpperCase(), color: tradingSignal.technicals.macd.signal === 'Bullish' ? '#00D4FF' : tradingSignal.technicals.macd.signal === 'Bearish' ? '#FF2D55' : '#94A3B8' },
                    ].map(({ label, value, color: c }) => (
                      <div key={label}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.65)' }}>{label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700, color: c ?? '#94A3B8' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fundamentals grid */}
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
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em' }}>{label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#94A3B8' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── ASSET INFO PANEL ─────────────────────────────── */}
          <div
            onClick={e => { e.stopPropagation(); setInfoOpen(o => !o); }}
            style={{
              marginBottom: '8px',
              padding: '6px 8px',
              background: infoOpen ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${infoOpen ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', color: infoOpen ? '#00D4FF' : 'rgba(100,116,139,0.65)' }}>
                ℹ ASSET INFO
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(100,116,139,0.4)' }}>
                {infoOpen ? '▲' : '▼'}
              </span>
            </div>
            {infoOpen && (
              <div style={{ marginTop: '8px' }}>
                {infoLoading ? (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.4)', letterSpacing: '0.08em' }}>LOADING...</div>
                ) : (
                  <>
                    {/* Sector + Industry badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {(stockInfo?.sector || stock.sector) && (
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '9px', letterSpacing: '0.1em',
                          color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                          padding: '2px 6px', borderRadius: '2px',
                          border: '1px solid rgba(0,212,255,0.2)',
                        }}>{stockInfo?.sector || stock.sector}</span>
                      )}
                      {stockInfo?.industry && (
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '9px', letterSpacing: '0.1em',
                          color: '#94A3B8', background: 'rgba(148,163,184,0.06)',
                          padding: '2px 6px', borderRadius: '2px',
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}>{stockInfo.industry}</span>
                      )}
                    </div>
                    {/* Description */}
                    {stockInfo?.description ? (
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11px', color: 'rgba(100,116,139,0.75)',
                        lineHeight: 1.6,
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        paddingTop: '6px',
                      }}>
                        {stockInfo.description.slice(0, 420)}{stockInfo.description.length > 420 ? '…' : ''}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(100,116,139,0.35)', letterSpacing: '0.08em' }}>
                        {stock.name} · {stock.sector}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* All signals */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {stock.signals.map(sig => <SignalTag key={sig} signal={sig} />)}
          </div>

          {/* Cross-link to Portfolio */}
          <Link
            href={`/app/portfolio`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginTop: '8px',
              borderRadius: '4px',
              background: 'rgba(0,255,136,0.04)',
              border: '1px solid rgba(0,255,136,0.12)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.08)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,255,136,0.25)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.04)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,255,136,0.12)';
            }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#00FF88', letterSpacing: '0.1em' }}>
              ADD TO PORTFOLIO — {stock.ticker}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#00FF88' }}>→</span>
          </Link>
          {/* Data source */}
          <div style={{
            marginTop: '8px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px', color: 'rgba(55,65,81,0.6)',
            letterSpacing: '0.08em',
          }}>
            {isLiveData ? 'SOURCE: YAHOO FINANCE · /api/signals/quotes' : `API: ${stock.apiSources.quote}`}
            {tradingSignal && ' · SIGNALS: FAULTLINE ENGINE'}
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
        fontSize: '12px', letterSpacing: '0.12em',
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
        fontSize: '13px', color: 'rgba(100,116,139,0.7)',
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
        fontSize: '12px', letterSpacing: '0.1em',
        color: 'rgba(100,116,139,0.75)',
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
  const label = isLive ? 'YAHOO FINANCE LIVE' : isStale ? 'STALE CACHE' : 'FALLBACK MODE';
  const dot = isLive ? 'fl-pulse 2s ease-in-out infinite' : 'none';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '12px', letterSpacing: '0.1em',
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
        <span style={{ color: 'rgba(100,116,139,0.75)' }}>
          SESSION: {tradeDate}
        </span>
      )}
      {lastUpdated && (
        <span style={{ color: 'rgba(100,116,139,0.65)' }}>
          UPDATED: {fmtTimestamp(lastUpdated)}
        </span>
      )}
      {isFallback && (
        <span style={{ color: '#FF2D55' }}>· MARKET DATA UNAVAILABLE</span>
      )}
    </div>
  );
}

// ── Trading Signals Aggregate Bar ─────────────────────────────
function TradingSignalsSummaryBar({ signals }: { signals: TradingSignalResult[] }) {
  const counts = useMemo(() => {
    const c = { BUY: 0, SELL: 0, HOLD: 0, WATCH: 0 };
    for (const s of signals) c[s.action]++;
    return c;
  }, [signals]);

  const total = signals.length;
  if (total === 0) return null;

  const strongBuys = signals.filter(s => s.action === 'BUY' && s.strength === 'Strong').length;
  const strongSells = signals.filter(s => s.action === 'SELL' && s.strength === 'Strong').length;
  const avgConf = signals.length > 0
    ? Math.round(signals.reduce((s, v) => s + v.confidence, 0) / signals.length)
    : 0;

  const sentiment = counts.BUY > counts.SELL + counts.HOLD
    ? { label: 'BULLISH BIAS', color: '#00D4FF' }
    : counts.SELL > counts.BUY + counts.HOLD
    ? { label: 'BEARISH BIAS', color: '#FF2D55' }
    : { label: 'MIXED / NEUTRAL', color: '#FFD700' };

  return (
    <div style={{
      margin: '12px 16px 0',
      padding: '12px 14px',
      background: 'rgba(8,10,14,0.95)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Corner brackets */}
      <div style={{ position: 'absolute', top: '4px', left: '4px', width: '8px', height: '8px', borderTop: '1px solid rgba(0,212,255,0.3)', borderLeft: '1px solid rgba(0,212,255,0.3)' }} />
      <div style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderTop: '1px solid rgba(0,212,255,0.3)', borderRight: '1px solid rgba(0,212,255,0.3)' }} />
      <div style={{ position: 'absolute', bottom: '4px', left: '4px', width: '8px', height: '8px', borderBottom: '1px solid rgba(0,212,255,0.3)', borderLeft: '1px solid rgba(0,212,255,0.3)' }} />
      <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: '8px', height: '8px', borderBottom: '1px solid rgba(0,212,255,0.3)', borderRight: '1px solid rgba(0,212,255,0.3)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '13px', letterSpacing: '0.2em',
            color: 'rgba(100,116,139,0.75)',
          }}>TRADING SIGNALS</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '13px', fontWeight: 700,
            color: sentiment.color, letterSpacing: '0.1em',
          }}>{sentiment.label}</span>
        </div>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '12px', color: 'rgba(100,116,139,0.65)',
        }}>AVG CONFIDENCE: <span style={{ color: '#94A3B8' }}>{avgConf}%</span></span>
      </div>

      {/* Signal count row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {(['BUY', 'SELL', 'HOLD', 'WATCH'] as TradingAction[]).map(action => {
          const c = ACTION_COLORS[action];
          const count = counts[action];
          const strong = action === 'BUY' ? strongBuys : action === 'SELL' ? strongSells : 0;
          return (
            <div key={action} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px',
              background: count > 0 ? `${c.text}10` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${count > 0 ? c.border : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '3px',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '13px', fontWeight: 700,
                color: count > 0 ? c.text : 'rgba(100,116,139,0.3)',
                letterSpacing: '0.1em',
              }}>{action}</span>
              <span style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '18px', fontWeight: 700,
                color: count > 0 ? c.text : 'rgba(100,116,139,0.2)',
                lineHeight: 1,
              }}>{count}</span>
              {strong > 0 && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '11px', color: c.text,
                  background: `${c.text}15`,
                  padding: '1px 4px', borderRadius: '2px',
                }}>{strong} STRONG</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stacked bar */}
      <div style={{ height: '4px', display: 'flex', borderRadius: '2px', overflow: 'hidden', gap: '1px' }}>
        {(['BUY', 'SELL', 'HOLD', 'WATCH'] as TradingAction[]).map(action => {
          const pct = total > 0 ? (counts[action] / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div key={action} style={{
              height: '100%', width: `${pct}%`,
              background: ACTION_COLORS[action].text,
              opacity: 0.8,
              transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Main Signals Page ─────────────────────────────────────────
function SignalsInner() {
  useSEO(PAGE_SEO.signals);
  const engine = useEngine();

  // ── Live Yahoo Finance data state ─────────────────────────────
  const [quotesData, setQuotesData] = useState<QuotesResponse | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  const [signalsRefreshCounter, setSignalsRefreshCounter] = useState(0);

  // ── Daily bars state (for true RSI/SMA/MACD) ──────────────
  const [dailyBarsMap, setDailyBarsMap] = useState<Record<string, DailyBar[]>>({});
  const dailyBarsFetchedRef = useRef(false);

  const fetchDailyBars = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    try {
      const tickerParam = tickers.slice(0, 20).join(',');
      const res = await fetch(`/api/signals/daily-bars?tickers=${encodeURIComponent(tickerParam)}&days=200`, {
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) return; // graceful — signal engine falls back to sparkline
      const data = await res.json() as { bars: Record<string, DailyBar[]> };
      if (data.bars) setDailyBarsMap(prev => ({ ...prev, ...data.bars }));
    } catch {
      // silent — free tier may not support this endpoint; engine falls back gracefully
    }
  }, []);

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

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(() => {
      fetchQuotes();
      setSignalsRefreshCounter(c => c + 1); // force signals re-run even if prices unchanged
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // Fetch daily bars once after quotes load (server caches for 1 hour)
  useEffect(() => {
    if (!quotesData || dailyBarsFetchedRef.current) return;
    dailyBarsFetchedRef.current = true;
    const tickers = (quotesData.quotes ?? []).map(q => q.ticker).filter(Boolean);
    if (tickers.length > 0) fetchDailyBars(tickers);
  }, [quotesData, fetchDailyBars]);

  const quoteMap = useMemo(() => {
    const map = new Map<string, LiveQuote>();
    for (const q of quotesData?.quotes ?? []) {
      map.set(q.ticker, q);
    }
    return map;
  }, [quotesData]);

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

  // ── Regime context ─────────────────────────────────────────
  const regimeCode = useMemo(() => mapRegimeToCode(engine?.output?.regime?.label ?? 'MODERATE RISK'), [engine?.output?.regime?.label]);
  const regimeCtx = REGIME_CONTEXT[regimeCode];
  const priorityCats = REGIME_PRIORITY_CATEGORIES[regimeCode];

  const regimeForSignals = useMemo(() => ({
    label: engine?.output?.regime?.label ?? 'MODERATE RISK',
    score: engine?.output?.overall?.score ?? 5,
  }), [engine?.output?.regime?.label, engine?.output?.overall?.score]);

  // ── Filters state ──────────────────────────────────────────
  const [filters, setFilters] = useState<SignalFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ScreeningCategory | 'All'>('All');

  const updateFilter = useCallback(<K extends keyof SignalFilters>(key: K, value: SignalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Scored and filtered stocks ─────────────────────────────
  const displayedStocks = useMemo(() => {
    const filtersWithCat: SignalFilters = { ...filters, category: activeCategory };
    const filtered = filterStocks(enrichedStocks, filtersWithCat);
    return filtered.map(s => ({
      stock: s,
      score: scoreStockForRegime(s, regimeCode),
    })).sort((a, b) => b.score - a.score);
  }, [filters, activeCategory, regimeCode, enrichedStocks]);

  // ── Trading signals query ──────────────────────────────────
  // Build input for tRPC query — stable reference via useMemo
  // Use real OHLC from live quote map when available; fall back to catalog estimates
  const tradingSignalsInput = useMemo(() => ({
    tickers: displayedStocks.map(({ stock }) => {
      const lq = quoteMap.get(stock.ticker);
      const hasLive = !!(lq && lq.price > 0);
      return {
        ticker: stock.ticker,
        price: hasLive ? lq!.price : stock.price,
        open: hasLive ? lq!.open : stock.price * 0.995,
        high: hasLive ? lq!.high : stock.price * 1.02,
        low: hasLive ? lq!.low : stock.price * 0.98,
        changePercent: hasLive ? lq!.changePercent : stock.changePercent,
        volumeMillions: hasLive ? lq!.volumeMillions : stock.volume,
        avgVolume: stock.avgVolume,
        sparkline: (hasLive && lq!.sparkline.length > 0) ? lq!.sparkline : stock.sparkline,
        relativeStrength: stock.relativeStrength,
        // Pass real daily bars when available — engine uses them for true RSI/SMA/MACD
        ...(dailyBarsMap[stock.ticker]?.length >= 14 ? { dailyBars: dailyBarsMap[stock.ticker] } : {}),
      };
    }),
    regime: regimeForSignals,
  }), [displayedStocks, quoteMap, dailyBarsMap, regimeForSignals]);

  const [tradingSignalsData, setTradingSignalsData] = useState<TradingSignalResult[]>([]);
  const [signalBlocked, setSignalBlocked] = useState(false);
  const computeSignalsMutation = trpc.signals.getTradingSignals.useMutation({
    onSuccess: (data) => {
      setTradingSignalsData(data);
      setSignalBlocked(false);
    },
    onError: (err) => {
      // FORBIDDEN = user is logged in but not premium; UNAUTHORIZED = not logged in
      const code = (err as { data?: { code?: string } }).data?.code;
      if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED') {
        setSignalBlocked(true);
      }
    },
  });

  // Re-run the mutation whenever the input changes OR a manual/periodic refresh is triggered
  const signalsInputRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify(tradingSignalsInput) + ':' + signalsRefreshCounter;
    if (key === signalsInputRef.current) return;
    signalsInputRef.current = key;
    computeSignalsMutation.mutate(tradingSignalsInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradingSignalsInput, signalsRefreshCounter]);

  // Build a map of ticker → trading signal
  const tradingSignalMap = useMemo(() => {
    const map = new Map<string, TradingSignalResult>();
    for (const sig of tradingSignalsData) {
      map.set(sig.ticker, sig);
    }
    return map;
  }, [tradingSignalsData]);

  // ── Today's top signals ────────────────────────────────────
  const topSignals = useMemo(() => getTodaysTopSignals(regimeCode, enrichedStocks.length > 0 ? enrichedStocks : undefined), [regimeCode, enrichedStocks]);

  // ── Regime color ───────────────────────────────────────────
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

      <PageHeader
        title="Signals"
        subtitle="Macro-regime-aware market scanner — live prices, trading signals, and regime-fit scores for 30+ tickers."
        badge="LIVE PRICES"
        badgeColor="green"
      />

      {/* ── Regime Context Banner ─────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(8,10,14,0.98), rgba(12,16,22,0.95))`,
        borderBottom: `1px solid ${regimeColor}20`,
        padding: '16px 16px 14px',
        position: 'relative', overflow: 'hidden',
      }}>
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
            <div style={{ fontSize: '12px', color: 'rgba(100,116,139,0.75)', marginBottom: '2px' }}>REGIME SCORE</div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700, fontSize: '22px',
              color: regimeColor,
            }}>{engine?.output?.overall?.score?.toFixed(1) ?? '—'}<span style={{ fontSize: '12px', color: 'rgba(100,116,139,0.75)' }}>/10</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em' }}>FAVORS:</span>
            <span style={{ fontSize: '13px', color: '#00D4FF' }}>{regimeCtx.bullish}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em' }}>AVOIDS:</span>
            <span style={{ fontSize: '13px', color: '#FF2D55' }}>{regimeCtx.bearish}</span>
          </div>
        </div>

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

      <div style={{ margin: '4px 16px 0', height: '1px', background: 'rgba(255,255,255,0.04)' }} />

      {/* ── Today's Top Signals ───────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '13px', letterSpacing: '0.2em',
          color: 'rgba(100,116,139,0.75)',
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

      {/* ── Trading Signals Summary Bar ───────────────────── */}
      {tradingSignalsData && tradingSignalsData.length > 0 && (
        <TradingSignalsSummaryBar signals={tradingSignalsData} />
      )}

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
                  fontSize: '13px', letterSpacing: '0.08em',
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
                {isPriority && <span style={{ marginLeft: '4px', color: '#FFD700', fontSize: '11px' }}>★</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Panel Toggle ───────────────────────────── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'rgba(100,116,139,0.75)', letterSpacing: '0.1em' }}>
          {quotesLoading ? 'LOADING...' : `${displayedStocks.length} SIGNALS FOUND`}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={fetchQuotes}
            disabled={quotesLoading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px', letterSpacing: '0.1em',
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
            onClick={() => { fetchQuotes(); setSignalsRefreshCounter(c => c + 1); }}
            disabled={computeSignalsMutation.isPending}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px', letterSpacing: '0.1em',
              padding: '4px 8px',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '2px',
              background: 'rgba(0,212,255,0.05)',
              color: computeSignalsMutation.isPending ? 'rgba(100,116,139,0.3)' : '#00D4FF',
              cursor: computeSignalsMutation.isPending ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >⚡ SIGNALS</button>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '13px', letterSpacing: '0.1em',
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
              fontSize: '12px', letterSpacing: '0.1em',
              padding: '4px 10px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px',
              background: 'transparent',
              color: 'rgba(100,116,139,0.75)',
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
          fontSize: '13px', color: 'rgba(255,45,85,0.8)',
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
          }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayedStocks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            color: 'rgba(100,116,139,0.65)',
            fontSize: '11px', letterSpacing: '0.1em',
          }}>NO SIGNALS MATCH CURRENT FILTERS</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
          }}>
            {displayedStocks.map(({ stock, score }) => (
              <StockCard
                key={stock.ticker}
                stock={stock}
                regimeScore={score}
                liveQuote={quoteMap.get(stock.ticker)}
                tradingSignal={tradingSignalMap.get(stock.ticker)}
                signalBlocked={signalBlocked}
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
          fontSize: '12px', letterSpacing: '0.12em',
          color: 'rgba(100,116,139,0.75)',
          lineHeight: 1.6,
        }}>
          {quotesData?.source === 'live' ? (
            <>
              <span style={{ color: '#00D4FF' }}>LIVE DATA</span> — Yahoo Finance intraday prices (market hours) · Polygon.io sparklines via secure backend proxy.
              Session: <span style={{ color: 'rgba(100,116,139,0.7)' }}>{quotesData.tradeDate ?? '—'}</span> ·
              Quotes: <span style={{ color: 'rgba(100,116,139,0.7)' }}>{quotesData.count ?? 0}/42 tickers</span> ·
              Refreshes every 5 minutes.
            </>
          ) : (
            <>
              <span style={{ color: '#FF2D55' }}>CATALOG DATA</span> — Live market data unavailable.
              Showing static catalog prices. Live prices load automatically during market hours.
            </>
          )}
          {tradingSignalsData && (
            <> · <span style={{ color: '#00D4FF' }}>TRADING SIGNALS</span> — FAULTLINE Engine · {tradingSignalsData.length} signals computed.</>
          )}
        </div>
      </div>

      {/* ── Disclaimer ────────────────────────────────────── */}
      <div style={{
        margin: '16px 16px 0',
        fontSize: '12px', letterSpacing: '0.08em',
        color: 'rgba(55,65,81,0.5)',
        textAlign: 'center', lineHeight: 1.5,
      }}>
        Probabilistic macro-regime intelligence. Not financial advice. Trading signals are algorithmic estimates only — not investment recommendations. Past performance does not guarantee future results.
      </div>
    </div>
  );
}

// ── Filter helper components ──────────────────────────────────
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.75)', marginBottom: '4px' }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '13px',
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
      <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.75)', marginBottom: '4px' }}>
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
        fontSize: '12px', letterSpacing: '0.08em',
        padding: '4px 10px',
        border: `1px solid ${value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '2px',
        background: value ? 'rgba(0,212,255,0.1)' : 'transparent',
        color: value ? '#00D4FF' : 'rgba(100,116,139,0.75)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {value ? '✓ ' : ''}{label}
    </button>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function Signals() {
  return (
    <PremiumGateFull variant="signals">
      <SignalsInner />
    </PremiumGateFull>
  );
}
