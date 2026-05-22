/* ============================================================
   FAULTLINE — Ticker Search & Stock Intelligence Card
   
   On-demand stock intelligence for any ticker symbol.
   Fetches live data via secure backend proxy, classifies
   with LLM + regime context, and renders a cinematic card.
   ============================================================ */
import {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import { trpc } from '@/lib/trpc';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

// ── Types ─────────────────────────────────────────────────────
interface TickerProfile {
  ticker: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  volume: number;
  volumeMillions: number;
  avgVolume: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  sparkline: number[];
  tradeDate: string;
  marketStatus: 'open' | 'closed' | 'extended' | 'unknown';
  isLive: boolean;
  source: 'live' | 'stale' | 'fallback';
  cached?: boolean;
  error?: string;
}

interface ClassificationResult {
  ticker: string;
  signals: string[];
  primarySignal: string;
  bullishFactors: string[];
  bearishFactors: string[];
  whyThisSignal: string;
  regimeFit: number;
  regimeFitLabel: string;
  aiExposure: 'High' | 'Medium' | 'Low' | 'None';
  debtRisk: 'High' | 'Medium' | 'Low' | 'None';
  recessionSensitivity: 'High' | 'Medium' | 'Low';
  liquidityRisk: 'High' | 'Medium' | 'Low' | 'None';
  momentumScore: number;
  volatilityLabel: 'Very High' | 'High' | 'Moderate' | 'Low';
  macroSensitivity: string;
  cached?: boolean;
}

interface RegimeContext {
  label: string;
  score: number;
  description?: string;
}

interface SearchHistoryItem {
  ticker: string;
  name: string;
  timestamp: number;
}

interface WatchlistItem {
  ticker: string;
  name: string;
  addedAt: number;
}

// ── Local Storage helpers ─────────────────────────────────────
const HISTORY_KEY = 'faultline_ticker_history_v1';
const WATCHLIST_KEY = 'faultline_ticker_watchlist_v1';

function loadHistory(): SearchHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch { return []; }
}
function saveHistory(items: SearchHistoryItem[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12))); } catch {}
}
function loadWatchlist(): WatchlistItem[] {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
  } catch { return []; }
}
function saveWatchlist(items: WatchlistItem[]) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items)); } catch {}
}

// ── Signal color map ──────────────────────────────────────────
const SIGNAL_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  'Momentum Breakout':        { bg: 'rgba(0,212,255,0.12)',   text: '#00D4FF', glow: '#00D4FF40' },
  'AI Bubble Exposure':       { bg: 'rgba(168,85,247,0.12)',  text: '#A855F7', glow: '#A855F740' },
  'Speculative Acceleration': { bg: 'rgba(255,149,0,0.12)',   text: '#FF9500', glow: '#FF950040' },
  'Liquidity Sensitive':      { bg: 'rgba(255,215,0,0.12)',   text: '#FFD700', glow: '#FFD70040' },
  'Debt Stress Risk':         { bg: 'rgba(255,45,85,0.12)',   text: '#FF2D55', glow: '#FF2D5540' },
  'Recession Defensive':      { bg: 'rgba(52,211,153,0.12)',  text: '#34D399', glow: '#34D39940' },
  'Macro Beneficiary':        { bg: 'rgba(0,212,255,0.08)',   text: '#67E8F9', glow: '#67E8F940' },
  'Macro Vulnerable':         { bg: 'rgba(255,45,85,0.08)',   text: '#FB7185', glow: '#FB718540' },
  'Rate Sensitive':           { bg: 'rgba(251,191,36,0.12)',  text: '#FBBF24', glow: '#FBBF2440' },
  'Short Squeeze Candidate':  { bg: 'rgba(168,85,247,0.08)',  text: '#C084FC', glow: '#C084FC40' },
  'Volume Surge':             { bg: 'rgba(255,215,0,0.08)',   text: '#FDE68A', glow: '#FDE68A40' },
  'Earnings Catalyst':        { bg: 'rgba(52,211,153,0.08)',  text: '#6EE7B7', glow: '#6EE7B740' },
  'Neutral / Watch':          { bg: 'rgba(100,116,139,0.08)', text: '#94A3B8', glow: '#94A3B840' },
};

function getSignalColor(signal: string) {
  return SIGNAL_COLORS[signal] ?? SIGNAL_COLORS['Neutral / Watch'];
}

// ── Regime fit color ──────────────────────────────────────────
function regimeFitColor(label: string): string {
  if (label === 'Strong Fit') return '#00D4FF';
  if (label === 'Moderate Fit') return '#FFD700';
  if (label === 'Poor Fit') return '#FF9500';
  if (label === 'Headwind') return '#FF2D55';
  return '#94A3B8';
}

// ── Risk level color ──────────────────────────────────────────
function riskColor(level: string): string {
  if (level === 'High' || level === 'Very High') return '#FF2D55';
  if (level === 'Medium' || level === 'Moderate') return '#FF9500';
  if (level === 'Low') return '#34D399';
  return '#94A3B8';
}

// ── Format helpers ────────────────────────────────────────────
function fmtCap(millions: number): string {
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(1)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(0)}M`;
}

// ── Signal Tag ────────────────────────────────────────────────
function SignalBadge({ signal, size = 'sm' }: { signal: string; size?: 'sm' | 'lg' }) {
  const c = getSignalColor(signal);
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'lg' ? '4px 10px' : '2px 7px',
      borderRadius: '2px',
      fontSize: size === 'lg' ? '10px' : '8px',
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: '0.06em',
      fontWeight: 700,
      textTransform: 'uppercase',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.text}25`,
      boxShadow: `0 0 8px ${c.glow}`,
      whiteSpace: 'nowrap',
    }}>
      {signal}
    </span>
  );
}

// ── Chip (small metadata tag) ─────────────────────────────────
function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '5px 8px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '3px',
    }}>
      <span style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.5)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: color ?? '#94A3B8', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Mini Sparkline ────────────────────────────────────────────
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const pts = data.map((v, i) => ({ i, v }));
  const color = positive ? '#00D4FF' : '#FF2D55';
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={pts} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
        <Line type="monotone" dataKey="v" dot={false} stroke={color} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Momentum Bar ──────────────────────────────────────────────
function MomentumBar({ score }: { score: number }) {
  const color = score >= 70 ? '#00D4FF' : score >= 40 ? '#FFD700' : '#FF2D55';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)' }} />
      </div>
      <span style={{ fontSize: '9px', fontFamily: "'IBM Plex Mono', monospace", color, minWidth: '28px', textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ── Regime Fit Gauge ──────────────────────────────────────────
function RegimeFitGauge({ score, label }: { score: number; label: string }) {
  const color = regimeFitColor(label);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.5)', textTransform: 'uppercase' }}>Regime Fit</span>
        <span style={{ fontSize: '9px', fontFamily: "'IBM Plex Mono', monospace", color, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${score * 10}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)' }} />
      </div>
    </div>
  );
}

// ── Stock Intelligence Card ───────────────────────────────────
function StockIntelligenceCard({
  profile,
  classification,
  classLoading,
  classError,
  onSave,
  isSaved,
  regime,
}: {
  profile: TickerProfile;
  classification: ClassificationResult | null;
  classLoading: boolean;
  classError: string | null;
  onSave: () => void;
  isSaved: boolean;
  regime: RegimeContext;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const positive = profile.changePercent >= 0;
  const accentColor = positive ? '#00D4FF' : '#FF2D55';
  const primarySignal = classification?.primarySignal ?? 'Neutral / Watch';
  const signalColor = getSignalColor(primarySignal);

  return (
    <div style={{
      background: 'rgba(6,8,12,0.98)',
      border: `1px solid ${signalColor.text}20`,
      borderRadius: '6px',
      overflow: 'hidden',
      position: 'relative',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Top accent bar */}
      <div style={{
        height: '2px',
        background: `linear-gradient(90deg, ${signalColor.text}80, ${accentColor}40, transparent)`,
      }} />

      {/* Glow overlay */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '200px', height: '200px',
        background: `radial-gradient(circle at top right, ${signalColor.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '16px' }}>
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700, fontSize: '22px',
                color: '#F0F4FF', letterSpacing: '0.06em',
              }}>{profile.ticker}</span>
              {profile.isLive && (
                <span style={{
                  fontSize: '7px', letterSpacing: '0.1em',
                  color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                  padding: '2px 5px', borderRadius: '2px',
                  border: '1px solid rgba(0,212,255,0.15)',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>LIVE</span>
              )}
              {profile.source === 'stale' && (
                <span style={{
                  fontSize: '7px', letterSpacing: '0.1em',
                  color: '#FF9500', background: 'rgba(255,149,0,0.08)',
                  padding: '2px 5px', borderRadius: '2px',
                  border: '1px solid rgba(255,149,0,0.15)',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>STALE</span>
              )}
              <span style={{
                fontSize: '7px', letterSpacing: '0.08em',
                color: 'rgba(100,116,139,0.5)',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>{profile.tradeDate}</span>
            </div>
            <div style={{
              fontSize: '11px', color: 'rgba(148,163,184,0.8)',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.02em', maxWidth: '260px',
            }}>{profile.name}</div>
            {profile.sector && (
              <div style={{
                fontSize: '9px', color: 'rgba(100,116,139,0.5)',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.06em', marginTop: '2px',
              }}>{profile.sector}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700, fontSize: '24px',
              color: '#F0F4FF',
            }}>${profile.price.toFixed(2)}</div>
            <div style={{
              fontSize: '13px', fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              color: accentColor,
            }}>
              {positive ? '+' : ''}{profile.changePercent.toFixed(2)}%
            </div>
            {/* Save button */}
            <button
              onClick={onSave}
              style={{
                marginTop: '6px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px', letterSpacing: '0.08em',
                padding: '3px 8px',
                border: isSaved ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px',
                background: isSaved ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: isSaved ? '#00D4FF' : 'rgba(100,116,139,0.5)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >{isSaved ? '★ SAVED' : '☆ SAVE'}</button>
          </div>
        </div>

        {/* ── Sparkline ──────────────────────────────────── */}
        {profile.sparkline.length >= 2 && (
          <div style={{ marginBottom: '12px' }}>
            <Sparkline data={profile.sparkline} positive={positive} />
          </div>
        )}

        {/* ── Metrics Row ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
          <Chip label="Open" value={`$${profile.open.toFixed(2)}`} />
          <Chip label="High" value={`$${profile.high.toFixed(2)}`} color="#34D399" />
          <Chip label="Low" value={`$${profile.low.toFixed(2)}`} color="#FF2D55" />
          <Chip label="Volume" value={`${profile.volumeMillions.toFixed(1)}M`} />
          {profile.marketCap && (
            <Chip label="Mkt Cap" value={fmtCap(profile.marketCap)} color="#FFD700" />
          )}
          <Chip label="Market" value={profile.marketStatus.toUpperCase()} color={profile.marketStatus === 'open' ? '#34D399' : '#94A3B8'} />
        </div>

        {/* ── Signal Labels ──────────────────────────────── */}
        {classLoading ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {[1,2].map(i => (
                <div key={i} style={{ height: '22px', width: '120px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', animation: 'fl-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
            <div style={{ height: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', animation: 'fl-pulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : classification ? (
          <div style={{ marginBottom: '12px' }}>
            {/* Signal badges */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {classification.signals.map(s => (
                <SignalBadge key={s} signal={s} size="lg" />
              ))}
            </div>

            {/* Regime Fit */}
            <div style={{ marginBottom: '10px' }}>
              <RegimeFitGauge score={classification.regimeFit} label={classification.regimeFitLabel} />
            </div>

            {/* Momentum */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.5)', marginBottom: '4px', textTransform: 'uppercase' }}>Momentum Score</div>
              <MomentumBar score={classification.momentumScore} />
            </div>

            {/* Risk Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '10px' }}>
              <Chip label="AI Exposure" value={classification.aiExposure} color={riskColor(classification.aiExposure)} />
              <Chip label="Debt Risk" value={classification.debtRisk} color={riskColor(classification.debtRisk)} />
              <Chip label="Recession Sens." value={classification.recessionSensitivity} color={riskColor(classification.recessionSensitivity)} />
              <Chip label="Volatility" value={classification.volatilityLabel} color={riskColor(classification.volatilityLabel)} />
            </div>

            {/* Bullish / Bearish Factors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)', borderRadius: '3px', padding: '8px' }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: '#00D4FF', marginBottom: '6px', textTransform: 'uppercase' }}>▲ Bullish Factors</div>
                {classification.bullishFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginBottom: '3px', display: 'flex', gap: '5px' }}>
                    <span style={{ color: '#00D4FF', flexShrink: 0 }}>·</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,45,85,0.03)', border: '1px solid rgba(255,45,85,0.08)', borderRadius: '3px', padding: '8px' }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: '#FF2D55', marginBottom: '6px', textTransform: 'uppercase' }}>▼ Bearish Factors</div>
                {classification.bearishFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginBottom: '3px', display: 'flex', gap: '5px' }}>
                    <span style={{ color: '#FF2D55', flexShrink: 0 }}>·</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro Sensitivity */}
            {classification.macroSensitivity && (
              <div style={{
                padding: '7px 10px', marginBottom: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '3px',
                fontSize: '9px', color: 'rgba(148,163,184,0.7)',
                lineHeight: 1.5, fontStyle: 'italic',
              }}>
                {classification.macroSensitivity}
              </div>
            )}

            {/* Why This Signal toggle */}
            <button
              onClick={() => setShowWhy(w => !w)}
              style={{
                width: '100%',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px', letterSpacing: '0.1em',
                padding: '7px 10px',
                border: `1px solid ${showWhy ? signalColor.text + '30' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '3px',
                background: showWhy ? signalColor.bg : 'rgba(255,255,255,0.02)',
                color: showWhy ? signalColor.text : 'rgba(100,116,139,0.6)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>WHY THIS SIGNAL?</span>
              <span style={{ fontSize: '10px' }}>{showWhy ? '▲' : '▼'}</span>
            </button>

            {showWhy && (
              <div style={{
                marginTop: '6px',
                padding: '10px 12px',
                background: signalColor.bg,
                border: `1px solid ${signalColor.text}20`,
                borderRadius: '3px',
                fontSize: '10px',
                color: 'rgba(148,163,184,0.9)',
                lineHeight: 1.7,
                fontFamily: "'IBM Plex Mono', monospace",
                animation: 'fl-fade-in 0.2s ease',
              }}>
                <div style={{ fontSize: '7px', letterSpacing: '0.1em', color: signalColor.text, marginBottom: '6px', textTransform: 'uppercase' }}>
                  FAULTLINE ANALYSIS — {regime.label}
                </div>
                {classification.whyThisSignal}
              </div>
            )}
          </div>
        ) : classError ? (
          <div style={{
            marginBottom: '12px', padding: '8px 10px',
            background: 'rgba(255,45,85,0.05)',
            border: '1px solid rgba(255,45,85,0.12)',
            borderRadius: '3px',
            fontSize: '9px', color: 'rgba(255,45,85,0.7)',
            letterSpacing: '0.06em',
          }}>
            ⚠ CLASSIFICATION UNAVAILABLE — {classError}
          </div>
        ) : null}

        {/* ── Company Description ─────────────────────────── */}
        {profile.description && (
          <div>
            <button
              onClick={() => setShowDesc(d => !d)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px', letterSpacing: '0.1em',
                padding: '0', border: 'none', background: 'transparent',
                color: 'rgba(100,116,139,0.4)', cursor: 'pointer',
                marginBottom: '4px',
              }}
            >{showDesc ? '▲ HIDE DESCRIPTION' : '▼ COMPANY OVERVIEW'}</button>
            {showDesc && (
              <div style={{
                fontSize: '9px', color: 'rgba(100,116,139,0.6)',
                lineHeight: 1.6, padding: '8px 0',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                animation: 'fl-fade-in 0.2s ease',
              }}>
                {profile.description.slice(0, 400)}{profile.description.length > 400 ? '…' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Search History Quick Chips ────────────────────────────────
function QuickChips({
  history,
  watchlist,
  onSelect,
  onRemoveHistory,
  onRemoveWatchlist,
}: {
  history: SearchHistoryItem[];
  watchlist: WatchlistItem[];
  onSelect: (ticker: string) => void;
  onRemoveHistory: (ticker: string) => void;
  onRemoveWatchlist: (ticker: string) => void;
}) {
  if (history.length === 0 && watchlist.length === 0) return null;

  return (
    <div style={{ marginTop: '10px' }}>
      {watchlist.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '7px', letterSpacing: '0.12em', color: 'rgba(100,116,139,0.4)', marginBottom: '5px', textTransform: 'uppercase' }}>
            ★ WATCHLIST
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {watchlist.map(item => (
              <div key={item.ticker} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                <button
                  onClick={() => onSelect(item.ticker)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '9px', letterSpacing: '0.06em',
                    padding: '4px 8px 4px 8px',
                    border: '1px solid rgba(0,212,255,0.2)',
                    borderRight: 'none',
                    borderRadius: '2px 0 0 2px',
                    background: 'rgba(0,212,255,0.05)',
                    color: '#00D4FF',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >{item.ticker}</button>
                <button
                  onClick={() => onRemoveWatchlist(item.ticker)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '8px',
                    padding: '4px 5px',
                    border: '1px solid rgba(0,212,255,0.2)',
                    borderRadius: '0 2px 2px 0',
                    background: 'rgba(0,212,255,0.03)',
                    color: 'rgba(0,212,255,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '7px', letterSpacing: '0.12em', color: 'rgba(100,116,139,0.4)', marginBottom: '5px', textTransform: 'uppercase' }}>
            ↺ RECENT
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {history.slice(0, 8).map(item => (
              <div key={item.ticker} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => onSelect(item.ticker)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '9px', letterSpacing: '0.06em',
                    padding: '4px 8px 4px 8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRight: 'none',
                    borderRadius: '2px 0 0 2px',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'rgba(148,163,184,0.7)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >{item.ticker}</button>
                <button
                  onClick={() => onRemoveHistory(item.ticker)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '8px',
                    padding: '4px 5px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '0 2px 2px 0',
                    background: 'rgba(255,255,255,0.01)',
                    color: 'rgba(100,116,139,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TickerSearch Component ───────────────────────────────
export function TickerSearch({ regime }: { regime: RegimeContext }) {
  const [inputValue, setInputValue] = useState('');
  const [searchedTicker, setSearchedTicker] = useState<string | null>(null);
  const [profile, setProfile] = useState<TickerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadHistory());
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => loadWatchlist());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tRPC classifier mutation
  const classifyMutation = trpc.signals.classifyTicker.useMutation();

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch ticker profile from backend
  const fetchProfile = useCallback(async (ticker: string) => {
    const t = ticker.toUpperCase().trim();
    if (!t || !/^[A-Z]{1,5}$/.test(t)) {
      setProfileError(`"${ticker}" is not a valid ticker symbol. Use 1–5 letters (e.g. NVDA, TSLA, AAPL).`);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    setProfile(null);
    setSearchedTicker(t);
    classifyMutation.reset();

    try {
      const res = await fetch(`/api/signals/ticker/${t}`, {
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json() as TickerProfile & { error?: string };

      if (!res.ok) {
        setProfileError(data.error ?? `No data found for ${t}`);
        setProfileLoading(false);
        return;
      }

      setProfile(data);

      // Add to history
      const newHistory: SearchHistoryItem[] = [
        { ticker: t, name: data.name, timestamp: Date.now() },
        ...history.filter(h => h.ticker !== t),
      ].slice(0, 12);
      setHistory(newHistory);
      saveHistory(newHistory);

      // Trigger LLM classification
      classifyMutation.mutate({
        ticker: t,
        regime,
        profile: {
          ticker: data.ticker,
          name: data.name,
          price: data.price,
          open: data.open,
          high: data.high,
          low: data.low,
          changePercent: data.changePercent,
          volume: data.volume,
          volumeMillions: data.volumeMillions,
          avgVolume: data.avgVolume,
          marketCap: data.marketCap,
          sector: data.sector,
          industry: data.industry,
          description: data.description,
          sparkline: data.sparkline,
          tradeDate: data.tradeDate,
          marketStatus: data.marketStatus,
          isLive: data.isLive,
          source: data.source,
        },
      });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  }, [history, regime, classifyMutation]);

  // Debounced search on Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fetchProfile(inputValue);
    }
  }, [inputValue, fetchProfile]);

  const handleSearchClick = useCallback(() => {
    fetchProfile(inputValue);
  }, [inputValue, fetchProfile]);

  const handleQuickSelect = useCallback((ticker: string) => {
    setInputValue(ticker);
    fetchProfile(ticker);
  }, [fetchProfile]);

  const handleRemoveHistory = useCallback((ticker: string) => {
    const updated = history.filter(h => h.ticker !== ticker);
    setHistory(updated);
    saveHistory(updated);
  }, [history]);

  const handleSaveToWatchlist = useCallback(() => {
    if (!profile) return;
    const isAlreadySaved = watchlist.some(w => w.ticker === profile.ticker);
    if (isAlreadySaved) {
      const updated = watchlist.filter(w => w.ticker !== profile.ticker);
      setWatchlist(updated);
      saveWatchlist(updated);
    } else {
      const updated: WatchlistItem[] = [
        { ticker: profile.ticker, name: profile.name, addedAt: Date.now() },
        ...watchlist.filter(w => w.ticker !== profile.ticker),
      ];
      setWatchlist(updated);
      saveWatchlist(updated);
    }
  }, [profile, watchlist]);

  const handleRemoveWatchlist = useCallback((ticker: string) => {
    const updated = watchlist.filter(w => w.ticker !== ticker);
    setWatchlist(updated);
    saveWatchlist(updated);
  }, [watchlist]);

  const isSaved = useMemo(() => profile ? watchlist.some(w => w.ticker === profile.ticker) : false, [profile, watchlist]);

  return (
    <div style={{ padding: '0 16px', marginBottom: '8px' }}>
      {/* ── Section Header ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '12px',
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px', letterSpacing: '0.2em',
          color: 'rgba(100,116,139,0.5)',
          textTransform: 'uppercase',
        }}>STOCK INTELLIGENCE SEARCH</div>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{
          fontSize: '7px', letterSpacing: '0.1em',
          color: 'rgba(100,116,139,0.3)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>PRESS / TO FOCUS</div>
      </div>

      {/* ── Search Bar ──────────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
        <div style={{
          flex: 1, position: 'relative',
          background: 'rgba(8,10,14,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px',
          transition: 'border-color 0.2s ease',
        }}
          onFocus={() => {}}
        >
          {/* Search icon */}
          <div style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(100,116,139,0.4)', fontSize: '13px', pointerEvents: 'none',
          }}>⌕</div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Enter any ticker — NVDA, TSLA, PLTR, QUBT…"
            maxLength={5}
            style={{
              width: '100%',
              padding: '13px 12px 13px 34px',
              background: 'transparent',
              border: 'none', outline: 'none',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '13px', letterSpacing: '0.08em',
              color: '#F0F4FF',
              caretColor: '#00D4FF',
            }}
            onFocus={e => {
              (e.target.parentElement as HTMLDivElement).style.borderColor = 'rgba(0,212,255,0.3)';
              (e.target.parentElement as HTMLDivElement).style.boxShadow = '0 0 0 1px rgba(0,212,255,0.1)';
            }}
            onBlur={e => {
              (e.target.parentElement as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
              (e.target.parentElement as HTMLDivElement).style.boxShadow = 'none';
            }}
          />
          {profileLoading && (
            <div style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              width: '14px', height: '14px',
              border: '2px solid rgba(0,212,255,0.2)',
              borderTopColor: '#00D4FF',
              borderRadius: '50%',
              animation: 'fl-spin 0.8s linear infinite',
            }} />
          )}
        </div>
        <button
          onClick={handleSearchClick}
          disabled={profileLoading || !inputValue.trim()}
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700, fontSize: '12px', letterSpacing: '0.1em',
            padding: '0 18px',
            border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: '4px',
            background: profileLoading || !inputValue.trim()
              ? 'rgba(0,212,255,0.04)'
              : 'rgba(0,212,255,0.1)',
            color: profileLoading || !inputValue.trim() ? 'rgba(0,212,255,0.3)' : '#00D4FF',
            cursor: profileLoading || !inputValue.trim() ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >ANALYZE</button>
      </div>

      {/* ── Quick Chips ─────────────────────────────────── */}
      <QuickChips
        history={history}
        watchlist={watchlist}
        onSelect={handleQuickSelect}
        onRemoveHistory={handleRemoveHistory}
        onRemoveWatchlist={handleRemoveWatchlist}
      />

      {/* ── Error State ─────────────────────────────────── */}
      {profileError && !profileLoading && (
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          background: 'rgba(255,45,85,0.05)',
          border: '1px solid rgba(255,45,85,0.15)',
          borderRadius: '4px',
          fontSize: '10px', color: 'rgba(255,45,85,0.8)',
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '14px' }}>⚠</span>
          <span style={{ flex: 1 }}>{profileError}</span>
          {searchedTicker && (
            <button
              onClick={() => fetchProfile(searchedTicker)}
              style={{
                background: 'rgba(255,45,85,0.15)',
                border: '1px solid rgba(255,45,85,0.3)',
                borderRadius: '3px',
                color: 'rgba(255,45,85,0.9)',
                fontSize: '9px',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.08em',
                padding: '3px 8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >RETRY</button>
          )}
        </div>
      )}

      {/* ── Profile Loading Skeleton ─────────────────────── */}
      {profileLoading && (
        <div style={{
          marginTop: '12px',
          background: 'rgba(6,8,12,0.98)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px',
          padding: '16px',
          animation: 'fl-pulse 1.5s ease-in-out infinite',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ width: '80px', height: '22px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginBottom: '6px' }} />
              <div style={{ width: '160px', height: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: '90px', height: '24px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginBottom: '4px' }} />
              <div style={{ width: '60px', height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
            </div>
          </div>
          <div style={{ height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginBottom: '10px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: '38px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }} />)}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[0,1].map(i => <div key={i} style={{ height: '22px', width: '130px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />)}
          </div>
          <div style={{ fontSize: '8px', letterSpacing: '0.1em', color: 'rgba(100,116,139,0.4)', textAlign: 'center', paddingTop: '4px' }}>
            FETCHING {searchedTicker} FROM POLYGON.IO…
          </div>
        </div>
      )}

      {/* ── Stock Intelligence Card ──────────────────────── */}
      {profile && !profileLoading && (
        <div style={{ marginTop: '12px' }}>
          <StockIntelligenceCard
            profile={profile}
            classification={classifyMutation.data ?? null}
            classLoading={classifyMutation.isPending}
            classError={classifyMutation.error?.message ?? null}
            onSave={handleSaveToWatchlist}
            isSaved={isSaved}
            regime={regime}
          />
        </div>
      )}
    </div>
  );
}
