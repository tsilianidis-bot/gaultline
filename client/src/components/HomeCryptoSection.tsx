/* ============================================================
   FAULTLINE — HomeCryptoSection
   Institutional Digital Asset & Crypto Intelligence section
   for the main Dashboard. Matches Palantir Noir aesthetic.
   ============================================================ */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { TickerChip } from "@/components/TickerActionMenu";

// ── Types (mirrored from server/cryptoEngine.ts) ─────────────
type CryptoSignalLabel =
  | "Speculative Acceleration" | "Liquidity Fragile" | "Momentum Breakout"
  | "AI Narrative Exposure" | "Macro Sensitive" | "Stablecoin Stress"
  | "Deleveraging Risk" | "Risk-Off Vulnerable" | "Neutral / Watch";

type CryptoRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

interface CryptoAssetIntelligence {
  id: string; symbol: string; name: string; image: string;
  currentPrice: number; priceChangePercent24h: number;
  marketCap: number; totalVolume: number;
  signalBias: "Bullish" | "Neutral" | "Bearish";
  signalScore: number; riskLevel: CryptoRiskLevel; riskScore: number;
  momentum: "Accelerating" | "Stable" | "Decelerating" | "Reversing";
  primaryLabel: CryptoSignalLabel; secondaryLabels: CryptoSignalLabel[];
  liquiditySensitivity: "Low" | "Moderate" | "High" | "Extreme";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  macroAlignment: "Aligned" | "Diverging" | "Neutral";
  keyInsights: string[]; generatedAt: number;
}

interface CryptoSystemicRisk {
  score: number; level: CryptoRiskLevel; btcDominance: number;
  stablecoinLiquidity: "Expanding" | "Stable" | "Tightening" | "Contracting";
  volatilityRegime: "Low" | "Normal" | "Elevated" | "Extreme";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  regime: string; regimeColor: string; summary: string;
}

// ── Style constants ───────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const RAJDHANI = "'Rajdhani', sans-serif";

const RISK_COLORS: Record<CryptoRiskLevel, string> = {
  Low: "#00FF88", Moderate: "#00D4FF", Elevated: "#FFD700", High: "#FF9500", Critical: "#FF2D55",
};
const BIAS_COLORS = { Bullish: "#00FF88", Neutral: "#00D4FF", Bearish: "#FF2D55" };
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

const EXAMPLE_SYMBOLS = ["BTC", "ETH", "SOL", "RNDR", "SEI", "HYPE"];

const FEATURE_BLOCKS = [
  { icon: "⬡", label: "Search Any Cryptocurrency", desc: "Analyze any digital asset through FAULTLINE's systemic-risk framework." },
  { icon: "◈", label: "Crypto Systemic Risk Engine", desc: "0–10 risk score derived from stablecoin liquidity, leverage, breadth, and macro conditions." },
  { icon: "◉", label: "Stablecoin Liquidity Monitoring", desc: "Track USDT/USDC supply expansion and contraction as a leading liquidity signal." },
  { icon: "◆", label: "Bitcoin Macro Correlation", desc: "Connect BTC price action to Fed policy, DXY strength, and Treasury yield regimes." },
  { icon: "◇", label: "AI Token Speculation Monitoring", desc: "Identify elevated speculative intensity in AI-narrative tokens before conditions shift." },
  { icon: "◎", label: "Crypto Volatility Regimes", desc: "Classify current volatility as Low / Normal / Elevated / Extreme for risk-sizing." },
  { icon: "◐", label: "Exchange Liquidity & Flow Analysis", desc: "Monitor exchange inflows, outflows, and order-book depth as early warning signals." },
  { icon: "◑", label: "Digital Asset Momentum Signals", desc: "Identify momentum breakouts, decelerations, and reversals across the asset class." },
  { icon: "◒", label: "Risk-On / Risk-Off Conditions", desc: "Determine whether macro conditions favor or disfavor risk-asset exposure." },
];

// ── Sub-components ────────────────────────────────────────────
function LabelBadge({ label }: { label: CryptoSignalLabel }) {
  const color = LABEL_COLORS[label] ?? "#64748B";
  return (
    <span style={{
      fontFamily: MONO, fontSize: '11px', color, letterSpacing: '0.12em',
      border: `1px solid ${color}40`, borderRadius: '2px', padding: '2px 5px',
      background: `${color}10`, textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}

function MiniAssetCard({ asset }: { asset: CryptoAssetIntelligence }) {
  const biasColor = BIAS_COLORS[asset.signalBias];
  const riskColor = RISK_COLORS[asset.riskLevel];
  const priceUp = asset.priceChangePercent24h >= 0;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(0,212,255,0.12)',
      borderRadius: '4px', padding: '12px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.12)')}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${biasColor}60, transparent)`,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <TickerChip ticker={asset.symbol} name={asset.name} assetType="crypto" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#E2E8F0' }}>
            ${asset.currentPrice >= 1000
              ? asset.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
              : asset.currentPrice >= 1
                ? asset.currentPrice.toFixed(2)
                : asset.currentPrice.toFixed(4)}
          </div>
          <div style={{ fontFamily: MONO, fontSize: '13px', color: priceUp ? '#00FF88' : '#FF2D55' }}>
            {priceUp ? '+' : ''}{asset.priceChangePercent24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Signal bias */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          fontFamily: MONO, fontSize: '11px', color: biasColor, letterSpacing: '0.12em',
          border: `1px solid ${biasColor}50`, borderRadius: '2px', padding: '2px 5px',
          background: `${biasColor}15`, textTransform: 'uppercase',
        }}>
          {asset.signalBias}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: '11px', color: riskColor, letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {asset.riskLevel} RISK
        </span>
      </div>

      {/* Primary label */}
      <div style={{ marginBottom: '6px' }}>
        <LabelBadge label={asset.primaryLabel} />
      </div>

      {/* Signal score bar */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Signal</span>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: biasColor }}>{asset.signalScore}</span>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${asset.signalScore}%`,
            background: `linear-gradient(90deg, ${biasColor}80, ${biasColor})`,
            boxShadow: `0 0 6px ${biasColor}60`,
            transition: 'width 1.2s cubic-bezier(0.23,1,0.32,1)',
          }} />
        </div>
      </div>

      {/* Momentum */}
      <div style={{ fontFamily: MONO, fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Momentum: <span style={{ color: asset.momentum === 'Accelerating' ? '#00FF88' : asset.momentum === 'Reversing' ? '#FF2D55' : '#94A3B8' }}>{asset.momentum}</span>
      </div>
    </div>
  );
}

function SystemicRiskMini({ risk }: { risk: CryptoSystemicRisk }) {
  const color = RISK_COLORS[risk.level];
  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}30`,
      borderRadius: '4px', padding: '14px',
    }}>
      <div style={{ fontFamily: MONO, fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>
        Live Crypto Metrics
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
        <span style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: '28px', color, textShadow: `0 0 16px ${color}60` }}>
          {risk.score.toFixed(1)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#4B5563' }}>/10</span>
        <span style={{ fontFamily: MONO, fontSize: '13px', color, marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {risk.level}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { label: "Crypto Risk Score", value: `${risk.score.toFixed(1)} / 10` },
          { label: "BTC Dominance", value: `${risk.btcDominance.toFixed(1)}%` },
          { label: "Stablecoin Liquidity", value: risk.stablecoinLiquidity },
          { label: "AI Token Speculation", value: risk.speculativeIntensity },
          { label: "Volatility Regime", value: risk.volatilityRegime },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '12px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
            <span style={{ fontFamily: MONO, fontSize: '12px', color: '#94A3B8' }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '10px', fontFamily: SANS, fontSize: '13px', color: 'rgba(100,116,139,0.7)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
        {risk.summary}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function HomeCryptoSection() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [searchSymbol, setSearchSymbol] = useState<string | null>(null);

  // Fetch systemic risk
  const { data: sysRisk } = trpc.crypto.getSystemicRisk.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch asset intelligence when user searches
  const { data: assetIntelResult, isLoading: assetLoading } = trpc.crypto.getAssetIntelligence.useQuery(
    { idOrSymbol: searchSymbol ?? "" },
    { enabled: !!searchSymbol, staleTime: 2 * 60 * 1000, retry: 1 }
  );
  const assetIntel = assetIntelResult?.asset ?? null;

  // Fetch top markets for the heatmap strip
  const { data: topMarkets } = trpc.crypto.getTopMarkets.useQuery(
    { limit: 6 },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const handleSearch = useCallback(() => {
    const sym = searchInput.trim().toUpperCase();
    if (sym.length > 0) setSearchSymbol(sym);
  }, [searchInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  return (
    <div
      className="intel-module"
      style={{
        padding: '20px', marginBottom: '10px',
        animation: 'cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 760ms both',
        borderLeft: '3px solid rgba(0,212,255,0.4)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '300px', height: '300px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Section header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            fontFamily: MONO, fontSize: '11px', color: '#00D4FF',
            textTransform: 'uppercase', letterSpacing: '0.2em',
            border: '1px solid rgba(0,212,255,0.25)', borderRadius: '2px',
            padding: '2px 6px', background: 'rgba(0,212,255,0.06)',
          }}>
            ◈ DIGITAL ASSET INTELLIGENCE
          </div>
        </div>
        <div style={{
          fontFamily: RAJDHANI, fontWeight: 700, fontSize: '18px',
          color: '#E2E8F0', letterSpacing: '0.03em', marginBottom: '6px',
          lineHeight: 1.2,
        }}>
          Digital Asset & Crypto Intelligence
        </div>
        <div style={{ fontFamily: SANS, fontSize: '11px', color: '#64748B', lineHeight: 1.55, maxWidth: '680px' }}>
          Analyze cryptocurrencies through the lens of liquidity, volatility, speculative pressure,
          AI narrative exposure, macroeconomic conditions, and systemic market risk.
        </div>
      </div>

      {/* Headline quote */}
      <div style={{
        fontFamily: MONO, fontSize: '13px', color: 'rgba(0,212,255,0.7)',
        letterSpacing: '0.08em', lineHeight: 1.6, marginBottom: '16px',
        borderLeft: '2px solid rgba(0,212,255,0.3)', paddingLeft: '10px',
        fontStyle: 'italic',
      }}>
        "Crypto moves first when liquidity changes. FAULTLINE is built to detect the shift."
      </div>

      {/* Search module */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: MONO, fontSize: '11px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
          Crypto Intelligence Search
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="BTC · ETH · SOL · RNDR · SEI · HYPE"
              style={{
                width: '100%', background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(0,212,255,0.2)', borderRadius: '3px',
                padding: '8px 12px', fontFamily: MONO, fontSize: '11px',
                color: '#E2E8F0', outline: 'none', letterSpacing: '0.08em',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(0,212,255,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(0,212,255,0.2)')}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={assetLoading}
            style={{
              fontFamily: MONO, fontSize: '13px', color: '#000', letterSpacing: '0.12em',
              background: assetLoading ? 'rgba(0,212,255,0.3)' : '#00D4FF',
              border: 'none', borderRadius: '3px', padding: '8px 14px',
              cursor: assetLoading ? 'wait' : 'pointer', textTransform: 'uppercase',
              transition: 'all 0.15s ease', fontWeight: 700,
            }}
          >
            {assetLoading ? "…" : "ANALYZE"}
          </button>
        </div>

        {/* Example chips */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {EXAMPLE_SYMBOLS.map(sym => (
            <button
              key={sym}
              onClick={() => { setSearchInput(sym); setSearchSymbol(sym); }}
              style={{
                fontFamily: MONO, fontSize: '12px', color: '#64748B',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px', padding: '3px 7px', cursor: 'pointer',
                transition: 'all 0.15s ease', letterSpacing: '0.1em',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#00D4FF'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Asset intelligence card (when searched) */}
      {assetIntel && (
        <div style={{ marginBottom: '14px' }}>
          <MiniAssetCard asset={assetIntel as unknown as CryptoAssetIntelligence} />
        </div>
      )}

      {/* Two-column layout: heatmap strip + systemic risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '16px' }}>
        {/* Top assets heatmap */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>
            Top Digital Assets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
            {(topMarkets ?? []).slice(0, 6).map((coin: { id: string; symbol: string; name: string; priceChangePercent24h: number }) => {
              const pct = coin.priceChangePercent24h;
              const up = pct >= 0;
              const intensity = Math.min(Math.abs(pct) / 10, 1);
              const bg = up
                ? `rgba(0,255,136,${0.06 + intensity * 0.18})`
                : `rgba(255,45,85,${0.06 + intensity * 0.18})`;
              const border = up ? `rgba(0,255,136,${0.15 + intensity * 0.25})` : `rgba(255,45,85,${0.15 + intensity * 0.25})`;
              return (
                <div
                  key={coin.id}
                  style={{
                    background: bg, border: `1px solid ${border}`,
                    borderRadius: '3px', padding: '6px 8px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => { setSearchInput(coin.symbol); setSearchSymbol(coin.symbol); }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <div style={{ fontFamily: RAJDHANI, fontWeight: 700, fontSize: '11px', color: '#D1D5DB' }}>{coin.symbol}</div>
                  <div style={{ fontFamily: MONO, fontSize: '12px', color: up ? '#00FF88' : '#FF2D55' }}>
                    {up ? '+' : ''}{pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
            {(!topMarkets || topMarkets.length === 0) && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '6px 8px', height: '38px' }} />
            ))}
          </div>
        </div>

        {/* Systemic risk mini panel */}
        <div style={{ minWidth: '180px' }}>
          {sysRisk ? (
            <SystemicRiskMini risk={sysRisk as CryptoSystemicRisk} />
          ) : (
            <div style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: '4px', padding: '14px', minWidth: '180px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: '11px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>
                Live Crypto Metrics
              </div>
              {["Crypto Risk Score", "BTC Dominance", "Stablecoin Liquidity", "AI Token Speculation", "Volatility Regime"].map(label => (
                <div key={label} style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', marginBottom: '8px' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature blocks grid */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: MONO, fontSize: '11px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px' }}>
          Intelligence Capabilities
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
          {FEATURE_BLOCKS.map(({ icon, label, desc }) => (
            <div
              key={label}
              style={{
                background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '3px', padding: '10px', transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#00D4FF' }}>{icon}</span>
                <span style={{ fontFamily: RAJDHANI, fontWeight: 600, fontSize: '11px', color: '#D1D5DB', letterSpacing: '0.03em' }}>{label}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: '13px', color: '#4B5563', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Supporting text */}
      <div style={{
        fontFamily: SANS, fontSize: '10px', color: '#475569', lineHeight: 1.6,
        borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px', marginBottom: '14px',
      }}>
        FAULTLINE integrates digital assets into its broader market intelligence framework, allowing users
        to monitor crypto conditions alongside stocks, liquidity, macroeconomic pressure, volatility,
        and systemic risk. Signals may indicate conditions worth monitoring — not financial advice.
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/crypto-search')}
          style={{
            fontFamily: MONO, fontSize: '13px', color: '#000', letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
            border: 'none', borderRadius: '3px', padding: '9px 16px',
            cursor: 'pointer', textTransform: 'uppercase', fontWeight: 700,
            boxShadow: '0 0 16px rgba(0,212,255,0.25)',
            transition: 'all 0.2s cubic-bezier(0.23,1,0.32,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,255,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(0,212,255,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Open Crypto Intelligence →
        </button>
        <span style={{ fontFamily: SANS, fontSize: '13px', color: '#4B5563', lineHeight: 1.5 }}>
          Join early access and track crypto, stocks, macro risk, and systemic pressure from one intelligence dashboard.
        </span>
      </div>
    </div>
  );
}
