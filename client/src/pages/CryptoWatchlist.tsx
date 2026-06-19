/* ============================================================
   FAULTLINE — CryptoWatchlist
   Saved crypto tokens with live signal labels and
   side-by-side comparison panel (up to 4 tokens).
   ============================================================ */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { TickerChip } from "@/components/TickerActionMenu";

// ── Style constants ───────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const RAJDHANI = "'Rajdhani', sans-serif";

type CryptoRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
type CryptoSignalBias = "Bullish" | "Neutral" | "Bearish";
type MomentumDir = "Accelerating" | "Stable" | "Decelerating" | "Reversing";
type CryptoSignalLabel =
  | "Speculative Acceleration" | "Liquidity Fragile" | "Momentum Breakout"
  | "AI Narrative Exposure" | "Macro Sensitive" | "Stablecoin Stress"
  | "Deleveraging Risk" | "Risk-Off Vulnerable" | "Neutral / Watch";

interface CryptoAssetIntelligence {
  id: string; symbol: string; name: string; image: string;
  currentPrice: number; priceChangePercent24h: number;
  marketCap: number; totalVolume: number;
  signalBias: CryptoSignalBias; signalScore: number;
  riskLevel: CryptoRiskLevel; riskScore: number;
  momentum: MomentumDir;
  primaryLabel: CryptoSignalLabel; secondaryLabels: CryptoSignalLabel[];
  liquiditySensitivity: string; speculativeIntensity: string;
  macroAlignment: string; keyInsights: string[];
}

const RISK_COLORS: Record<CryptoRiskLevel, string> = {
  Low: "#00FF88", Moderate: "#00D4FF", Elevated: "#FFD700", High: "#FF9500", Critical: "#FF2D55",
};
const BIAS_COLORS: Record<CryptoSignalBias, string> = {
  Bullish: "#00FF88", Neutral: "#00D4FF", Bearish: "#FF2D55",
};
const LABEL_COLORS: Partial<Record<CryptoSignalLabel, string>> = {
  "Speculative Acceleration": "#FF9500",
  "Liquidity Fragile": "#FF2D55",
  "Momentum Breakout": "#00FF88",
  "AI Narrative Exposure": "#C084FC",
  "Macro Sensitive": "#00D4FF",
  "Stablecoin Stress": "#FFD700",
  "Deleveraging Risk": "#FF2D55",
  "Risk-Off Vulnerable": "#FF9500",
  "Neutral / Watch": "#64748B",
};
const MOMENTUM_COLORS: Record<MomentumDir, string> = {
  Accelerating: "#00FF88", Stable: "#94A3B8", Decelerating: "#FF9500", Reversing: "#FF2D55",
};

function LabelBadge({ label }: { label: CryptoSignalLabel }) {
  const c = LABEL_COLORS[label] ?? "#64748B";
  return (
    <span style={{
      fontFamily: MONO, fontSize: '7px', color: c, letterSpacing: '0.1em',
      border: `1px solid ${c}40`, borderRadius: '2px', padding: '2px 5px',
      background: `${c}10`, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${value}%`,
        background: `linear-gradient(90deg, ${color}70, ${color})`,
        boxShadow: `0 0 6px ${color}50`,
        transition: 'width 1s cubic-bezier(0.23,1,0.32,1)',
      }} />
    </div>
  );
}

// ── Watchlist row card ────────────────────────────────────────
function WatchlistRow({
  symbol, name, isSelected, onToggleCompare, onRemove, onNavigate,
}: {
  symbol: string; name: string;
  isSelected: boolean;
  onToggleCompare: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const { data: intelResult, isLoading, isError } = trpc.crypto.getAssetIntelligence.useQuery(
    { idOrSymbol: symbol },
    { staleTime: 3 * 60 * 1000, retry: 1 }
  );
  const asset = intelResult?.asset as CryptoAssetIntelligence | undefined;

  const biasColor = asset ? BIAS_COLORS[asset.signalBias] : "#64748B";
  const riskColor = asset ? RISK_COLORS[asset.riskLevel] : "#64748B";
  const priceUp = (asset?.priceChangePercent24h ?? 0) >= 0;

  return (
    <div style={{
      background: isSelected ? 'rgba(0,212,255,0.06)' : 'rgba(0,0,0,0.45)',
      border: `1px solid ${isSelected ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '4px', padding: '12px 14px',
      display: 'grid',
      gridTemplateColumns: '80px 1fr 1fr 1fr auto auto auto',
      alignItems: 'center', gap: '12px',
      transition: 'all 0.2s ease',
    }}>
      {/* Symbol + name */}
      <div>
        <TickerChip ticker={symbol} name={name} assetType="crypto" />
      </div>

      {/* Price */}
      <div>
        {isLoading ? (
          <div style={{ height: '14px', width: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }} />
        ) : isError ? (
          <span style={{ fontFamily: MONO, fontSize: '9px', color: '#4B5563' }}>—</span>
        ) : asset ? (
          <>
            <div style={{ fontFamily: MONO, fontSize: '12px', color: '#E2E8F0' }}>
              ${asset.currentPrice >= 1000
                ? asset.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
                : asset.currentPrice >= 1
                  ? asset.currentPrice.toFixed(2)
                  : asset.currentPrice.toFixed(4)}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: priceUp ? '#00FF88' : '#FF2D55' }}>
              {priceUp ? '+' : ''}{asset.priceChangePercent24h.toFixed(2)}%
            </div>
          </>
        ) : null}
      </div>

      {/* Signal */}
      <div>
        {asset ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
              <span style={{
                fontFamily: MONO, fontSize: '8px', color: biasColor, letterSpacing: '0.1em',
                border: `1px solid ${biasColor}40`, borderRadius: '2px', padding: '1px 4px',
                background: `${biasColor}10`, textTransform: 'uppercase',
              }}>{asset.signalBias}</span>
              <span style={{ fontFamily: MONO, fontSize: '8px', color: riskColor, textTransform: 'uppercase' }}>{asset.riskLevel}</span>
            </div>
            <ScoreBar value={asset.signalScore} color={biasColor} />
          </>
        ) : isLoading ? (
          <div style={{ height: '20px', width: '80px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
        ) : null}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {asset ? (
          <>
            <LabelBadge label={asset.primaryLabel} />
            {asset.secondaryLabels.slice(0, 1).map(l => <LabelBadge key={l} label={l} />)}
          </>
        ) : null}
      </div>

      {/* Compare toggle */}
      <button
        onClick={onToggleCompare}
        title={isSelected ? "Remove from comparison" : "Add to comparison"}
        style={{
          fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em',
          color: isSelected ? '#000' : '#00D4FF',
          background: isSelected ? '#00D4FF' : 'transparent',
          border: `1px solid ${isSelected ? '#00D4FF' : 'rgba(0,212,255,0.3)'}`,
          borderRadius: '2px', padding: '4px 8px', cursor: 'pointer',
          textTransform: 'uppercase', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
        }}
      >
        {isSelected ? '✓ COMPARE' : '+ COMPARE'}
      </button>

      {/* Navigate to full analysis */}
      <button
        onClick={onNavigate}
        title="Full analysis"
        style={{
          fontFamily: MONO, fontSize: '8px', color: '#64748B',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '2px', padding: '4px 8px', cursor: 'pointer',
          textTransform: 'uppercase', transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
      >
        ANALYZE →
      </button>

      {/* Remove */}
      <button
        onClick={onRemove}
        title="Remove from watchlist"
        style={{
          fontFamily: MONO, fontSize: '10px', color: '#4B5563',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '2px', padding: '4px 7px', cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FF2D55'; e.currentTarget.style.borderColor = 'rgba(255,45,85,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Comparison column ─────────────────────────────────────────
function CompareColumn({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
  const { data: intelResult, isLoading } = trpc.crypto.getAssetIntelligence.useQuery(
    { idOrSymbol: symbol },
    { staleTime: 3 * 60 * 1000, retry: 1 }
  );
  const asset = intelResult?.asset as CryptoAssetIntelligence | undefined;
  const biasColor = asset ? BIAS_COLORS[asset.signalBias] : "#64748B";
  const riskColor = asset ? RISK_COLORS[asset.riskLevel] : "#64748B";
  const priceUp = (asset?.priceChangePercent24h ?? 0) >= 0;

  const ROWS = [
    { label: "Signal Bias",        value: asset?.signalBias,           color: biasColor },
    { label: "Signal Score",       value: asset ? `${asset.signalScore}/100` : undefined, color: biasColor },
    { label: "Risk Level",         value: asset?.riskLevel,            color: riskColor },
    { label: "Risk Score",         value: asset ? `${asset.riskScore.toFixed(1)}/10` : undefined, color: riskColor },
    { label: "Momentum",           value: asset?.momentum,             color: asset ? MOMENTUM_COLORS[asset.momentum] : "#64748B" },
    { label: "Liquidity Sensitivity", value: asset?.liquiditySensitivity, color: "#00D4FF" },
    { label: "Speculative Intensity", value: asset?.speculativeIntensity, color: "#FF9500" },
    { label: "Macro Alignment",    value: asset?.macroAlignment,       color: "#C084FC" },
  ];

  return (
    <div style={{
      background: 'rgba(0,0,0,0.5)', border: `1px solid ${biasColor}25`,
      borderRadius: '4px', overflow: 'hidden', flex: '1 1 0', minWidth: 0,
      position: 'relative',
    }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${biasColor}60, transparent)`,
      }} />

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <TickerChip ticker={symbol} name={asset?.name} assetType="crypto" />
          </div>
          <button
            onClick={onRemove}
            style={{
              fontFamily: MONO, fontSize: '9px', color: '#4B5563',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF2D55')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}
          >✕</button>
        </div>
        {isLoading ? (
          <div style={{ height: '24px', width: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '6px' }} />
        ) : asset ? (
          <div style={{ marginTop: '6px' }}>
            <span style={{ fontFamily: MONO, fontSize: '14px', color: '#E2E8F0' }}>
              ${asset.currentPrice >= 1000
                ? asset.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
                : asset.currentPrice >= 1 ? asset.currentPrice.toFixed(2) : asset.currentPrice.toFixed(4)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: priceUp ? '#00FF88' : '#FF2D55', marginLeft: '6px' }}>
              {priceUp ? '+' : ''}{asset.priceChangePercent24h.toFixed(2)}%
            </span>
          </div>
        ) : null}
      </div>

      {/* Signal labels */}
      {asset && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <LabelBadge label={asset.primaryLabel} />
          {asset.secondaryLabels.slice(0, 2).map(l => <LabelBadge key={l} label={l} />)}
        </div>
      )}

      {/* Metric rows */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ROWS.map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '2px' }}>{label}</div>
            {isLoading ? (
              <div style={{ height: '10px', width: '60px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }} />
            ) : value ? (
              <div style={{ fontFamily: MONO, fontSize: '10px', color, letterSpacing: '0.05em' }}>{value}</div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: '10px', color: '#4B5563' }}>—</div>
            )}
          </div>
        ))}
      </div>

      {/* Key insights */}
      {asset && asset.keyInsights.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontFamily: MONO, fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Key Insights</div>
          {asset.keyInsights.slice(0, 3).map((insight, i) => (
            <div key={i} style={{ fontFamily: SANS, fontSize: '9px', color: '#475569', lineHeight: 1.5, marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid rgba(0,212,255,0.2)' }}>
              {insight}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
function CryptoWatchlistInner() {
  useSEO(PAGE_SEO.cryptoWatchlist);
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const utils = trpc.useUtils();

  const { data: watchlist, isLoading: listLoading } = trpc.crypto.watchlist.list.useQuery(
    undefined,
    { enabled: !!user, staleTime: 30 * 1000 }
  );

  const removeMutation = trpc.crypto.watchlist.remove.useMutation({
    onSuccess: () => utils.crypto.watchlist.list.invalidate(),
  });

  const compareSymbols = useMemo(() => Array.from(compareSet), [compareSet]);

  function toggleCompare(symbol: string) {
    setCompareSet(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else if (next.size < 4) {
        next.add(symbol);
      }
      return next;
    });
  }

  // ── Not logged in ─────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050508',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', fontFamily: MONO,
      }}>
        <div style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '16px' }}>
          ◈ CRYPTO WATCHLIST
        </div>
        <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: '22px', color: '#E2E8F0', marginBottom: '8px', textAlign: 'center' }}>
          Sign in to access your watchlist
        </div>
        <div style={{ fontFamily: SANS, fontSize: '11px', color: '#64748B', marginBottom: '24px', textAlign: 'center', maxWidth: '360px', lineHeight: 1.6 }}>
          Save crypto tokens, monitor live signal labels, and compare assets side-by-side.
        </div>
        <a
          href={getLoginUrl()}
          style={{
            fontFamily: MONO, fontSize: '9px', color: '#000', letterSpacing: '0.12em',
            background: '#00D4FF', border: 'none', borderRadius: '3px', padding: '10px 20px',
            cursor: 'pointer', textTransform: 'uppercase', fontWeight: 700,
            textDecoration: 'none', display: 'inline-block',
          }}
        >
          Sign In →
        </a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050508', padding: '0' }}>
      {/* Page header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '16px 20px 14px',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                onClick={() => navigate('/crypto-search')}
                style={{
                  fontFamily: MONO, fontSize: '7px', color: '#4B5563', letterSpacing: '0.12em',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                  textTransform: 'uppercase',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}
              >
                ← Crypto Intel
              </button>
              <span style={{ fontFamily: MONO, fontSize: '7px', color: '#1E293B' }}>/</span>
              <span style={{ fontFamily: MONO, fontSize: '7px', color: '#00D4FF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Watchlist</span>
            </div>
            <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: '20px', color: '#E2E8F0', letterSpacing: '0.03em' }}>
              Crypto Watchlist
            </div>
            <div style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', marginTop: '2px' }}>
              {watchlist?.length ?? 0} saved token{watchlist?.length !== 1 ? 's' : ''} · Live signal labels · Up to 4 in comparison
            </div>
          </div>
          <button
            onClick={() => navigate('/crypto-search')}
            style={{
              fontFamily: MONO, fontSize: '8px', color: '#00D4FF', letterSpacing: '0.12em',
              background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: '3px', padding: '7px 14px', cursor: 'pointer',
              textTransform: 'uppercase', transition: 'all 0.15s ease',
            }}
          >
            + Add Tokens
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* Comparison panel */}
        {compareSymbols.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: '7px', color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                ◈ Side-by-Side Comparison — {compareSymbols.length} of 4 selected
              </div>
              <button
                onClick={() => setCompareSet(new Set())}
                style={{
                  fontFamily: MONO, fontSize: '7px', color: '#4B5563', letterSpacing: '0.1em',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '2px', padding: '3px 8px', cursor: 'pointer',
                  textTransform: 'uppercase', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FF2D55')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}
              >
                Clear All
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              {compareSymbols.map(sym => (
                <CompareColumn
                  key={sym}
                  symbol={sym}
                  onRemove={() => toggleCompare(sym)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Watchlist table */}
        <div>
          {/* Column headers */}
          {(watchlist?.length ?? 0) > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 1fr 1fr auto auto auto',
              gap: '12px', padding: '0 14px 6px',
              alignItems: 'center',
            }}>
              {['Asset', 'Price', 'Signal', 'Labels', '', '', ''].map((h, i) => (
                <div key={i} style={{ fontFamily: MONO, fontSize: '7px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{h}</div>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {(listLoading || authLoading) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  height: '52px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)', borderRadius: '4px',
                  animation: `pulse ${1.2 + i * 0.15}s ease-in-out infinite alternate`,
                }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!listLoading && !authLoading && (watchlist?.length ?? 0) === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '4px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: '28px', color: '#1E293B', marginBottom: '12px' }}>◈</div>
              <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: '16px', color: '#64748B', marginBottom: '6px' }}>
                No tokens saved yet
              </div>
              <div style={{ fontFamily: SANS, fontSize: '10px', color: '#4B5563', marginBottom: '20px', lineHeight: 1.6 }}>
                Search for any crypto asset and click <strong style={{ color: '#94A3B8' }}>Save to Watchlist</strong> to track its live signal labels here.
              </div>
              <button
                onClick={() => navigate('/crypto-search')}
                style={{
                  fontFamily: MONO, fontSize: '8px', color: '#000', letterSpacing: '0.12em',
                  background: '#00D4FF', border: 'none', borderRadius: '3px',
                  padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                Search Crypto Assets →
              </button>
            </div>
          )}

          {/* Watchlist rows */}
          {!listLoading && (watchlist ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(watchlist ?? []).map(item => (
                <WatchlistRow
                  key={item.id}
                  symbol={item.symbol}
                  name={item.name}
                  isSelected={compareSet.has(item.symbol)}
                  onToggleCompare={() => toggleCompare(item.symbol)}
                  onRemove={() => removeMutation.mutate({ symbol: item.symbol })}
                  onNavigate={() => navigate(`/crypto-search?q=${item.symbol}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hint */}
        {(watchlist?.length ?? 0) > 0 && compareSet.size === 0 && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '8px', color: '#1E293B', letterSpacing: '0.1em' }}>
              SELECT UP TO 4 TOKENS WITH + COMPARE TO SEE SIDE-BY-SIDE ANALYSIS
            </span>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: '7px', color: '#1E293B', letterSpacing: '0.1em' }}>
            PROBABILISTIC RISK INTELLIGENCE · NOT FINANCIAL ADVICE
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function CryptoWatchlist() {
  return (
    <PremiumGateFull variant="watchlist">
      <CryptoWatchlistInner />
    </PremiumGateFull>
  );
}
