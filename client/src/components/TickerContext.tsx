/* ============================================================
 * TickerContext.tsx
 * Whenever a user enters a ticker, automatically load:
 *   - Live price, change %, volume
 *   - Sector, market cap
 *   - Regime alignment score
 *   - Compact bar with color-coded sentiment
 *
 *   <TickerContext ticker="NVDA" regime={regime} />
 * ============================================================ */
import { useState, useEffect } from "react";

interface TickerProfile {
  ticker: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  sector: string | null;
  exchange: string | null;
  regimeAlignmentScore: number | null;
}

interface TickerContextProps {
  ticker: string;
  regime?: { label: string; score: number } | null;
  className?: string;
  compact?: boolean;
}
function formatMarketCap(val: number | null): string {
  if (!val) return "—";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}
function formatVolume(val: number | null): string {
  if (!val) return "—";
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return val.toString();
}

export function TickerContext({ ticker, regime, className = "", compact = false }: TickerContextProps) {
  const [profile, setProfile] = useState<TickerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker || ticker.length < 1) return;
    setLoading(true);
    setError(null);
    setProfile(null);

    fetch(`/api/signals/ticker/${encodeURIComponent(ticker.toUpperCase())}`, {
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        setProfile({
          ticker: data.symbol ?? ticker.toUpperCase(),
          name: data.name ?? ticker.toUpperCase(),
          price: data.price ?? null,
          changePercent: data.changePercent ?? null,
          volume: data.volume ?? null,
          marketCap: data.marketCap ?? null,
          sector: data.sector ?? null,
          exchange: data.exchange ?? null,
          regimeAlignmentScore: data.regimeAlignmentScore ?? null,
        });
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load ticker data");
        setLoading(false);
      });
  }, [ticker]);

  if (!ticker) return null;

  const changeColor = profile?.changePercent == null
    ? "#6B7280"
    : profile.changePercent >= 0 ? "#00FF88" : "#FF2D55";

  const regimeScore = profile?.regimeAlignmentScore;
  const regimeColor = regimeScore == null
    ? "#6B7280"
    : regimeScore >= 70 ? "#00FF88"
    : regimeScore >= 50 ? "#00D4FF"
    : regimeScore >= 35 ? "#FF9500"
    : "#FF2D55";

  return (
    <div
      className={className}
      style={{
        background: "rgba(8,10,14,0.95)",
        border: "1px solid rgba(0,212,255,0.12)",
        borderLeft: "3px solid rgba(0,212,255,0.4)",
        borderRadius: "4px",
        padding: compact ? "8px 12px" : "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(90deg, rgba(0,212,255,0.03) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {loading && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em", animation: "pulse 1.5s ease-in-out infinite" }}>
          LOADING {ticker.toUpperCase()}...
        </div>
      )}

      {error && !loading && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(255,45,85,0.6)", letterSpacing: "0.08em" }}>
          ⚠ {error}
        </div>
      )}

      {profile && !loading && (
        <>
          {/* Ticker + Name */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: compact ? "15px" : "18px", color: "#F0F4FF", letterSpacing: "0.06em" }}>
              {profile.ticker}
            </span>
            {!compact && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.name}
              </span>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* Price */}
          {profile.price != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>PRICE</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: compact ? "14px" : "16px", color: "#F0F4FF", lineHeight: 1 }}>
                ${profile.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Change % */}
          {profile.changePercent != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>CHG</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: compact ? "14px" : "16px", color: changeColor, lineHeight: 1, textShadow: `0 0 10px ${changeColor}60` }}>
                {profile.changePercent >= 0 ? "+" : ""}{profile.changePercent.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Volume */}
          {!compact && profile.volume != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>VOL</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#94A3B8", lineHeight: 1 }}>
                {formatVolume(profile.volume)}
              </span>
            </div>
          )}

          {/* Market Cap */}
          {!compact && profile.marketCap != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>MCAP</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#94A3B8", lineHeight: 1 }}>
                {formatMarketCap(profile.marketCap)}
              </span>
            </div>
          )}

          {/* Sector */}
          {!compact && profile.sector && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>SECTOR</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1, maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.sector}
              </span>
            </div>
          )}

          {/* Regime Alignment Score */}
          {regimeScore != null && (
            <>
              <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", marginBottom: "1px" }}>REGIME ALIGN</span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: compact ? "14px" : "16px", color: regimeColor, lineHeight: 1, textShadow: `0 0 10px ${regimeColor}50` }}>
                  {regimeScore.toFixed(0)}
                </span>
              </div>
            </>
          )}

          {/* Regime label from prop */}
          {regime && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 6px #00D4FF" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00D4FF", letterSpacing: "0.1em" }}>
                {regime.label}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
