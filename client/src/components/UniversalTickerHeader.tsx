/**
 * UniversalTickerHeader
 * ─────────────────────
 * Security-first context bar. Accepts a ticker symbol + assetType and renders:
 *   - Live price + change%
 *   - Market state badge (LIVE / PRE / POST / CLOSED)
 *   - Volume
 *   - Sector / Industry
 *   - Market cap
 *   - Opportunity Score (from FAULTLINE engine)
 *   - Direction badge (Bullish / Bearish / Neutral)
 *   - Risk Level
 *   - Confidence
 *
 * Usage:
 *   <UniversalTickerHeader symbol="NVDA" assetType="stock" />
 *   <UniversalTickerHeader symbol="BTC" assetType="crypto" />
 */

import { trpc } from "@/lib/trpc";

interface Props {
  symbol: string;
  assetType?: "stock" | "crypto";
  className?: string;
}

const DIRECTION_STYLE: Record<string, { color: string; bg: string }> = {
  Bullish:       { color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  "Very Bullish":{ color: "#00FF88", bg: "rgba(0,255,136,0.12)" },
  Bearish:       { color: "#FF2D55", bg: "rgba(255,45,85,0.12)" },
  "Very Bearish":{ color: "#FF0040", bg: "rgba(255,0,64,0.12)" },
  Neutral:       { color: "#FFD700", bg: "rgba(255,215,0,0.12)" },
};

const RISK_STYLE: Record<string, { color: string }> = {
  Low:      { color: "#22C55E" },
  Moderate: { color: "#FFD700" },
  High:     { color: "#FF9500" },
  Extreme:  { color: "#FF2D55" },
};

const MARKET_STATE_LABEL: Record<string, { label: string; color: string }> = {
  REGULAR:   { label: "LIVE",   color: "#22C55E" },
  PRE:       { label: "PRE",    color: "#FFD700" },
  POST:      { label: "POST",   color: "#FF9500" },
  CLOSED:    { label: "CLOSED", color: "#888" },
  PREPRE:    { label: "PRE",    color: "#FFD700" },
  POSTPOST:  { label: "POST",   color: "#FF9500" },
  UNKNOWN:   { label: "—",      color: "#888" },
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtMktCap(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000)     return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)         return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export function UniversalTickerHeader({ symbol, assetType = "stock", className = "" }: Props) {
  const { data, isLoading, isError } = trpc.outlook.getSecurityContext.useQuery(
    { symbol, assetType },
    { enabled: !!symbol, staleTime: 60_000, refetchInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: 10,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      >
        <div style={{ width: 80, height: 20, background: "rgba(255,255,255,0.06)", borderRadius: 4 }} />
        <div style={{ width: 60, height: 16, background: "rgba(255,255,255,0.04)", borderRadius: 4 }} />
        <div style={{ width: 100, height: 16, background: "rgba(255,255,255,0.04)", borderRadius: 4 }} />
      </div>
    );
  }

  if (isError || !data) return null;

  const chgColor = (data.changePercent ?? 0) >= 0 ? "#22C55E" : "#FF2D55";
  const chgSign  = (data.changePercent ?? 0) >= 0 ? "+" : "";
  const mktState = MARKET_STATE_LABEL[data.marketState ?? "UNKNOWN"] ?? MARKET_STATE_LABEL["UNKNOWN"];
  const dirStyle = DIRECTION_STYLE[data.direction ?? ""] ?? { color: "#888", bg: "rgba(136,136,136,0.1)" };
  const riskStyle = RISK_STYLE[data.riskLevel ?? ""] ?? { color: "#888" };

  return (
    <div
      className={className}
      style={{
        background: "rgba(0,212,255,0.04)",
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 10,
        padding: "12px 20px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 24px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
      }}
    >
      {/* Ticker + Market State */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>
          {data.symbol}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: mktState.color,
            background: `${mktState.color}1A`,
            padding: "2px 6px",
            borderRadius: 4,
            border: `1px solid ${mktState.color}44`,
          }}
        >
          {mktState.label}
        </span>
      </div>

      {/* Price + Change */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color: "#E8F4FD", fontWeight: 700, fontSize: 16 }}>
          {data.price != null ? `$${fmt(data.price)}` : "—"}
        </span>
        <span style={{ color: chgColor, fontWeight: 600, fontSize: 13 }}>
          {data.changePercent != null
            ? `${chgSign}${fmt(data.changePercent, 2)}%`
            : "—"}
        </span>
        {data.change != null && (
          <span style={{ color: chgColor, fontSize: 11, opacity: 0.8 }}>
            ({chgSign}{fmt(data.change, 2)})
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

      {/* Volume */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>VOLUME</span>
        <span style={{ color: "#B0C4D8", fontWeight: 600 }}>{fmtVol(data.volume)}</span>
      </div>

      {/* Market Cap */}
      {data.marketCap != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>MKT CAP</span>
          <span style={{ color: "#B0C4D8", fontWeight: 600 }}>{fmtMktCap(data.marketCap)}</span>
        </div>
      )}

      {/* Sector */}
      {data.sector && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>SECTOR</span>
          <span style={{ color: "#B0C4D8", fontWeight: 600 }}>{data.sector}</span>
        </div>
      )}

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

      {/* Opportunity Score */}
      {data.opportunityScore != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>OPP SCORE</span>
          <span
            style={{
              color: data.opportunityScore >= 70 ? "#22C55E"
                   : data.opportunityScore >= 50 ? "#FFD700"
                   : "#FF2D55",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {data.opportunityScore}
          </span>
        </div>
      )}

      {/* Direction */}
      {data.direction && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: dirStyle.color,
            background: dirStyle.bg,
            padding: "3px 8px",
            borderRadius: 5,
            border: `1px solid ${dirStyle.color}44`,
          }}
        >
          {data.direction.toUpperCase()}
        </span>
      )}

      {/* Risk Level */}
      {data.riskLevel && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>RISK</span>
          <span style={{ color: riskStyle.color, fontWeight: 600 }}>{data.riskLevel}</span>
        </div>
      )}

      {/* Confidence */}
      {data.confidence != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 10, letterSpacing: 0.5 }}>CONFIDENCE</span>
          <span style={{ color: "#B0C4D8", fontWeight: 600 }}>{data.confidence}%</span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Cross-page quick actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a
          href={`/app/symbol-intelligence?symbol=${data.symbol}&type=${assetType}`}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#00D4FF',
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 4,
            padding: '3px 8px',
            textDecoration: 'none',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.08)'; }}
        >
          SYMBOL INTEL →
        </a>
        <a
          href={`/app/signal-outlook?symbol=${data.symbol}&type=${assetType}`}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#00FF88',
            background: 'rgba(0,255,136,0.06)',
            border: '1px solid rgba(0,255,136,0.18)',
            borderRadius: 4,
            padding: '3px 8px',
            textDecoration: 'none',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,255,136,0.06)'; }}
        >
          SIGNAL OUTLOOK →
        </a>
        <a
          href={`/app/decision-engine?ticker=${data.symbol}`}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#C084FC',
            background: 'rgba(192,132,252,0.06)',
            border: '1px solid rgba(192,132,252,0.18)',
            borderRadius: 4,
            padding: '3px 8px',
            textDecoration: 'none',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(192,132,252,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(192,132,252,0.06)'; }}
        >
          DECISION ENGINE →
        </a>
      </div>
    </div>
  );
}

export default UniversalTickerHeader;
