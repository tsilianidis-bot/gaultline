/**
 * FAULTLINE — Global Markets Page
 * /app/markets
 *
 * 7 sections:
 *   1. Global Market Snapshot (summary bar)
 *   2. U.S. Markets
 *   3. Global Markets (Europe / Asia)
 *   4. Macro Markets (VIX, DXY, Rates, Commodities, Crypto)
 *   5. Strongest / Weakest Today
 *   6. Market Breadth / Risk Context
 *   7. FAULTLINE Market Read (ASHA interpretation)
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import type { MarketQuoteItem, GlobalMarketSnapshot } from "../../../server/routers/markets";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG       = "#050608";
const CARD_BG  = "rgba(10, 14, 20, 0.95)";
const BORDER   = "rgba(0, 212, 255, 0.08)";
const BORDER_H = "rgba(0, 212, 255, 0.18)";
const CYAN     = "#00D4FF";
const GREEN    = "#00FF88";
const RED      = "#FF4D6A";
const AMBER    = "#FFAA00";
const MUTED    = "#6B7A8D";
const TEXT     = "#E8EDF5";
const MONO     = "'IBM Plex Mono', monospace";
const SANS     = "'IBM Plex Sans', 'Space Grotesk', system-ui, sans-serif";
const HEADING  = "'Rajdhani', 'Space Grotesk', sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctColor(v: number | null): string {
  if (v === null) return MUTED;
  if (v > 0.05) return GREEN;
  if (v < -0.05) return RED;
  return MUTED;
}
function pctGlyph(v: number | null): string {
  if (v === null) return "—";
  if (v > 0.05) return "▲";
  if (v < -0.05) return "▼";
  return "—";
}
function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtPrice(v: number | null, symbol?: string): string {
  if (v === null) return "—";
  // Rates are in tenths of a percent from Yahoo (^TNX = 44.6 = 4.46%)
  if (symbol && ["^TNX","^FVX","^IRX","^TYX"].includes(symbol)) {
    return `${(v / 10).toFixed(2)}%`;
  }
  if (v >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 100) return v.toFixed(2);
  return v.toFixed(4);
}
function marketStatusLabel(state: MarketQuoteItem["marketState"]): { label: string; color: string } {
  switch (state) {
    case "REGULAR": return { label: "OPEN", color: GREEN };
    case "PRE":     return { label: "PRE-MKT", color: AMBER };
    case "POST":    return { label: "AFTER HRS", color: AMBER };
    case "CLOSED":  return { label: "CLOSED", color: MUTED };
    default:        return { label: "—", color: MUTED };
  }
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em",
      color: CYAN, textTransform: "uppercase", marginBottom: "12px",
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      <span style={{ display: "inline-block", width: "20px", height: "1px", background: CYAN, opacity: 0.5 }} />
      {children}
    </div>
  );
}

// ── Market card ───────────────────────────────────────────────────────────────
function MarketCard({ item, onClick }: { item: MarketQuoteItem; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const status = marketStatusLabel(item.marketState);
  const pct = item.changePercent;
  const color = pctColor(pct);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(0,212,255,0.04)" : CARD_BG,
        border: `1px solid ${hovered ? BORDER_H : BORDER}`,
        borderRadius: "6px",
        padding: "12px 14px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
        minWidth: "140px",
        flex: "1 1 140px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: "11px", color: CYAN, letterSpacing: "0.06em" }}>
            {item.shortLabel}
          </div>
          <div style={{ fontFamily: SANS, fontSize: "10px", color: MUTED, marginTop: "1px" }}>
            {item.label}
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: "8px", color: status.color, letterSpacing: "0.08em" }}>
          {status.label}
        </span>
      </div>
      {/* Price */}
      <div style={{ fontFamily: MONO, fontSize: "16px", color: TEXT, fontWeight: 600, letterSpacing: "0.02em" }}>
        {fmtPrice(item.price, item.symbol)}
      </div>
      {/* Change */}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: "11px", color }}>
          {pctGlyph(pct)} {fmtPct(pct)}
        </span>
        {item.change !== null && (
          <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED }}>
            {item.change >= 0 ? "+" : ""}{item.change.toFixed(item.change >= 100 ? 0 : 2)}
          </span>
        )}
      </div>
      {/* Hi/Lo */}
      {(item.high !== null || item.low !== null) && (
        <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
          {item.high !== null && (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>
              H {fmtPrice(item.high, item.symbol)}
            </span>
          )}
          {item.low !== null && (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>
              L {fmtPrice(item.low, item.symbol)}
            </span>
          )}
        </div>
      )}
      {item.isDelayed && (
        <div style={{ fontFamily: MONO, fontSize: "8px", color: MUTED, marginTop: "4px", opacity: 0.6 }}>
          15-min delayed
        </div>
      )}
    </div>
  );
}

// ── Summary pill ──────────────────────────────────────────────────────────────
function SummaryPill({ label, value }: { label: string; value: string }) {
  const color =
    value.includes("risk-on") || value.includes("positive") || value.includes("low") ? GREEN :
    value.includes("risk-off") || value.includes("negative") || value.includes("elevated") || value.includes("weakening") ? RED :
    value.includes("rising") || value.includes("strengthening") ? AMBER :
    value.includes("unavailable") ? MUTED : TEXT;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "2px",
      padding: "10px 14px",
      background: CARD_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: "6px",
      flex: "1 1 120px",
      minWidth: "110px",
    }}>
      <span style={{ fontFamily: MONO, fontSize: "8px", color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontFamily: SANS, fontSize: "12px", color, fontWeight: 600, textTransform: "capitalize" }}>
        {value === "unavailable" ? "—" : value.replace(/-/g, " ")}
      </span>
    </div>
  );
}

// ── Rank row ──────────────────────────────────────────────────────────────────
function RankRow({ item, rank, direction }: { item: MarketQuoteItem; rank: number; direction: "up" | "down" }) {
  const color = direction === "up" ? GREEN : RED;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 12px",
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: "10px", color: MUTED, width: "16px" }}>#{rank}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: "11px", color: CYAN }}>{item.shortLabel}</div>
        <div style={{ fontFamily: SANS, fontSize: "9px", color: MUTED }}>{item.label}</div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: "12px", color, fontWeight: 600 }}>
        {direction === "up" ? "▲" : "▼"} {Math.abs(item.changePercent ?? 0).toFixed(2)}%
      </span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`,
      borderRadius: "6px", padding: "12px 14px",
      minWidth: "140px", flex: "1 1 140px", height: "90px",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── FAULTLINE Market Read ─────────────────────────────────────────────────────
function MarketRead({ snapshot }: { snapshot: GlobalMarketSnapshot | undefined }) {
  const [interpretation, setInterpretation] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!snapshot) return;
    setLoading(true);
    // Build a concise context string from the snapshot summary
    const s = snapshot.summary;
    const items = snapshot.items;
    const spx = items.find(i => i.symbol === "^GSPC");
    const vix = items.find(i => i.symbol === "^VIX");
    const t10 = items.find(i => i.symbol === "^TNX");
    const dxy = items.find(i => i.symbol === "DX-Y.NYB");
    const btc = items.find(i => i.symbol === "BTC-USD");

    const parts: string[] = [];
    if (spx?.changePercent !== null) parts.push(`S&P 500 ${fmtPct(spx?.changePercent ?? null)}`);
    if (vix?.price !== null) parts.push(`VIX ${vix?.price?.toFixed(1)}`);
    if (t10?.price !== null) parts.push(`10Y ${fmtPrice(t10?.price ?? null, "^TNX")}`);
    if (dxy?.changePercent !== null) parts.push(`DXY ${fmtPct(dxy?.changePercent ?? null)}`);
    if (btc?.changePercent !== null) parts.push(`BTC ${fmtPct(btc?.changePercent ?? null)}`);

    // Generate interpretation using rule-based approach
    // (ASHA integration would require a tRPC mutation — using local logic for now)
    const text = generateLocalInterpretation(s, spx, vix, t10, dxy);
    setInterpretation(text);
    setLoading(false);
  }, [snapshot]);

  return (
    <div style={{
      background: "rgba(0,212,255,0.03)",
      border: `1px solid rgba(0,212,255,0.12)`,
      borderRadius: "8px",
      padding: "18px 20px",
    }}>
      <div style={{ fontFamily: MONO, fontSize: "9px", color: CYAN, letterSpacing: "0.14em", marginBottom: "10px" }}>
        FAULTLINE MARKET READ
      </div>
      {loading ? (
        <div style={{ fontFamily: SANS, fontSize: "13px", color: MUTED }}>Analyzing market conditions...</div>
      ) : (
        <p style={{ fontFamily: SANS, fontSize: "13px", color: TEXT, lineHeight: "1.7", margin: 0 }}>
          {interpretation || "Market data is loading. Interpretation will appear shortly."}
        </p>
      )}
    </div>
  );
}

function generateLocalInterpretation(
  s: GlobalMarketSnapshot["summary"],
  spx: MarketQuoteItem | undefined,
  vix: MarketQuoteItem | undefined,
  t10: MarketQuoteItem | undefined,
  dxy: MarketQuoteItem | undefined,
): string {
  const parts: string[] = [];

  // US equities tone
  if (s.usEquities === "risk-on") parts.push("U.S. equity markets are broadly positive, with most major indices advancing.");
  else if (s.usEquities === "risk-off") parts.push("U.S. equity markets are under pressure, with broad-based selling across major indices.");
  else parts.push("U.S. equity markets are mixed, with no clear directional conviction across major indices.");

  // Volatility context
  if (s.volatility === "elevated" && vix?.price) {
    parts.push(`Volatility is elevated — VIX at ${vix.price.toFixed(1)} — signaling that options markets are pricing in meaningful near-term uncertainty.`);
  } else if (s.volatility === "low" && vix?.price) {
    parts.push(`Volatility is suppressed — VIX at ${vix.price.toFixed(1)} — consistent with low near-term fear in options markets.`);
  }

  // Rates and dollar cross-market pressure
  const ratesRising = s.rates === "rising";
  const dollarStrong = s.dollar === "strengthening";
  if (ratesRising && dollarStrong) {
    parts.push("Rising Treasury yields and a firmer dollar are creating cross-market headwinds, particularly for rate-sensitive and international assets.");
  } else if (ratesRising) {
    parts.push("Rising Treasury yields are adding pressure to rate-sensitive sectors and extending the duration risk environment.");
  } else if (dollarStrong) {
    parts.push("A strengthening dollar is creating headwinds for commodities and international equity markets.");
  } else if (s.rates === "falling") {
    parts.push("Declining Treasury yields are providing a tailwind for rate-sensitive assets and growth equities.");
  }

  // Global context
  if (s.europe === "negative" || s.asia === "negative") {
    parts.push(`International markets are showing weakness — ${s.europe === "negative" ? "European" : "Asian"} indices are broadly lower, suggesting the risk-off tone extends beyond U.S. borders.`);
  } else if (s.europe === "positive" && s.asia === "positive") {
    parts.push("Global equity markets are broadly positive, with European and Asian indices participating in the risk-on tone.");
  }

  if (parts.length === 0) return "Market data is loading. Interpretation will appear shortly.";
  return parts.join(" ");
}

// ── Breadth proxy row ─────────────────────────────────────────────────────────
function BreadthRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontFamily: SANS, fontSize: "11px", color: TEXT }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: "11px", color }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Markets() {
  const { data: snapshot, isLoading, error, refetch } = trpc.markets.getGlobalSnapshot.useQuery(undefined, {
    refetchInterval: 90_000, // 90s — matches server cache TTL
    retry: 3,
    retryDelay: (n) => Math.min(500 * 2 ** n, 4000),
    staleTime: 60_000,
  });

  const byCategory = useCallback((cat: MarketQuoteItem["category"]) =>
    snapshot?.items.filter(i => i.category === cat) ?? [], [snapshot]);

  const usItems     = byCategory("us_equity");
  const vixItems    = byCategory("volatility");
  const euItems     = byCategory("europe");
  const asiaItems   = byCategory("asia");
  const ratesItems  = byCategory("rates");
  const dollarItems = byCategory("dollar");
  const commItems   = byCategory("commodity");
  const cryptoItems = byCategory("crypto");

  // Breadth proxy from US equity performance
  const usLive = usItems.filter(i => i.changePercent !== null);
  const advancingPct = usLive.length > 0
    ? (usLive.filter(i => (i.changePercent ?? 0) > 0).length / usLive.length) * 100
    : 0;
  const spxPct = usItems.find(i => i.symbol === "^GSPC")?.changePercent ?? 0;
  const rutPct = usItems.find(i => i.symbol === "^RUT")?.changePercent ?? 0;
  const smallVsLarge = (rutPct - spxPct).toFixed(2);
  const vixPrice = vixItems.find(i => i.symbol === "^VIX")?.price ?? null;

  const lastUpdated = snapshot
    ? new Date(snapshot.fetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <AppLayout>
      <div style={{ minHeight: "100vh", background: BG, fontFamily: SANS, paddingBottom: "60px" }}>
        {/* ── Page header ── */}
        <div style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: "20px 20px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
        }}>
          <div>
            <h1 style={{ fontFamily: HEADING, fontSize: "22px", fontWeight: 700, color: TEXT, margin: 0, letterSpacing: "0.04em" }}>
              GLOBAL MARKETS
            </h1>
            <p style={{ fontFamily: SANS, fontSize: "11px", color: MUTED, margin: "2px 0 0" }}>
              Live market context across equities, rates, currencies, commodities, and crypto
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {lastUpdated && (
              <span style={{ fontFamily: MONO, fontSize: "9px", color: MUTED }}>
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={() => refetch()}
              style={{
                fontFamily: MONO, fontSize: "9px", color: CYAN, letterSpacing: "0.1em",
                background: "rgba(0,212,255,0.06)", border: `1px solid rgba(0,212,255,0.15)`,
                borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
              }}
            >
              REFRESH
            </button>
          </div>
        </div>

        <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>

          {/* ── SECTION 1: Global Market Snapshot ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>Global Market Snapshot</SectionLabel>
            {isLoading ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ flex: "1 1 110px", minWidth: "100px", height: "52px", background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: "6px" }} />
                ))}
              </div>
            ) : snapshot ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <SummaryPill label="U.S. Equities" value={snapshot.summary.usEquities} />
                <SummaryPill label="Europe" value={snapshot.summary.europe} />
                <SummaryPill label="Asia" value={snapshot.summary.asia} />
                <SummaryPill label="Volatility" value={snapshot.summary.volatility} />
                <SummaryPill label="Dollar" value={snapshot.summary.dollar} />
                <SummaryPill label="Rates" value={snapshot.summary.rates} />
                <SummaryPill label="Commodities" value={snapshot.summary.commodities} />
                <SummaryPill label="Crypto" value={snapshot.summary.crypto} />
              </div>
            ) : (
              <div style={{ fontFamily: SANS, fontSize: "12px", color: MUTED }}>
                Market snapshot temporarily unavailable.{" "}
                <button onClick={() => refetch()} style={{ color: CYAN, background: "none", border: "none", cursor: "pointer", fontFamily: MONO, fontSize: "11px" }}>
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* ── SECTION 2: U.S. Markets ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>U.S. Markets</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                : [...usItems, ...vixItems].map(item => (
                    <MarketCard key={item.symbol} item={item} />
                  ))
              }
            </div>
          </div>

          {/* ── SECTION 3: Global Markets ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>Global Markets</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Europe */}
              <div>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, letterSpacing: "0.1em", marginBottom: "8px" }}>
                  EUROPE
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
                    : euItems.map(item => <MarketCard key={item.symbol} item={item} />)
                  }
                </div>
              </div>
              {/* Asia */}
              <div>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, letterSpacing: "0.1em", marginBottom: "8px" }}>
                  ASIA
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
                    : asiaItems.map(item => <MarketCard key={item.symbol} item={item} />)
                  }
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Macro Markets ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>Macro Markets</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
              {isLoading
                ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
                : [...ratesItems, ...dollarItems, ...commItems, ...cryptoItems].map(item => (
                    <MarketCard key={item.symbol} item={item} />
                  ))
              }
            </div>
          </div>

          {/* ── SECTION 5: Strongest / Weakest ── */}
          {snapshot && (snapshot.strongest.length > 0 || snapshot.weakest.length > 0) && (
            <div style={{ marginBottom: "28px" }}>
              <SectionLabel>Strongest / Weakest Today</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Strongest */}
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{
                    padding: "10px 14px", borderBottom: `1px solid ${BORDER}`,
                    fontFamily: MONO, fontSize: "9px", color: GREEN, letterSpacing: "0.1em",
                  }}>
                    ▲ STRONGEST TODAY
                  </div>
                  {snapshot.strongest.map((item, i) => (
                    <RankRow key={item.symbol} item={item} rank={i + 1} direction="up" />
                  ))}
                </div>
                {/* Weakest */}
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{
                    padding: "10px 14px", borderBottom: `1px solid ${BORDER}`,
                    fontFamily: MONO, fontSize: "9px", color: RED, letterSpacing: "0.1em",
                  }}>
                    ▼ WEAKEST TODAY
                  </div>
                  {snapshot.weakest.map((item, i) => (
                    <RankRow key={item.symbol} item={item} rank={i + 1} direction="down" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 6: Market Breadth / Risk Context ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>Market Breadth / Risk Context</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Breadth proxies */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, letterSpacing: "0.1em", marginBottom: "14px" }}>
                  BREADTH PROXIES
                </div>
                <BreadthRow
                  label="U.S. Indices Advancing"
                  value={advancingPct}
                  max={100}
                  color={advancingPct >= 60 ? GREEN : advancingPct <= 40 ? RED : AMBER}
                />
                {vixPrice !== null && (
                  <BreadthRow
                    label="VIX (fear gauge)"
                    value={vixPrice}
                    max={50}
                    color={vixPrice > 25 ? RED : vixPrice < 15 ? GREEN : AMBER}
                  />
                )}
                <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
                  <div style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, marginBottom: "4px" }}>
                    SMALL CAP vs LARGE CAP
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: "12px", color: parseFloat(smallVsLarge) > 0 ? GREEN : parseFloat(smallVsLarge) < 0 ? RED : MUTED }}>
                    RUT vs SPX: {parseFloat(smallVsLarge) >= 0 ? "+" : ""}{smallVsLarge}% spread
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: "10px", color: MUTED, marginTop: "3px" }}>
                    {parseFloat(smallVsLarge) > 0.3
                      ? "Small caps outperforming — broad participation"
                      : parseFloat(smallVsLarge) < -0.3
                      ? "Large caps leading — narrow rally"
                      : "Small and large caps roughly in line"}
                  </div>
                </div>
              </div>
              {/* Risk indicators */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, letterSpacing: "0.1em", marginBottom: "14px" }}>
                  CROSS-ASSET RISK SIGNALS
                </div>
                {[
                  {
                    label: "Dollar / Equity Relationship",
                    value: snapshot?.summary.dollar === "strengthening" && snapshot?.summary.usEquities === "risk-on"
                      ? "Divergence — watch for reversal"
                      : snapshot?.summary.dollar === "weakening" && snapshot?.summary.usEquities === "risk-on"
                      ? "Aligned — dollar weakness supporting equities"
                      : "Neutral",
                    color: snapshot?.summary.dollar === "strengthening" && snapshot?.summary.usEquities === "risk-on" ? AMBER : TEXT,
                  },
                  {
                    label: "Rate / Equity Relationship",
                    value: snapshot?.summary.rates === "rising" && snapshot?.summary.usEquities === "risk-on"
                      ? "Tension — rising yields pressuring valuations"
                      : snapshot?.summary.rates === "falling" && snapshot?.summary.usEquities === "risk-on"
                      ? "Supportive — falling yields tailwind for equities"
                      : "Neutral",
                    color: snapshot?.summary.rates === "rising" && snapshot?.summary.usEquities === "risk-on" ? AMBER : TEXT,
                  },
                  {
                    label: "Crypto / Risk Appetite",
                    value: snapshot?.summary.crypto === "positive" && snapshot?.summary.usEquities === "risk-on"
                      ? "Aligned — risk appetite broad"
                      : snapshot?.summary.crypto === "negative" && snapshot?.summary.usEquities === "risk-on"
                      ? "Divergence — crypto not confirming equity strength"
                      : "Mixed",
                    color: TEXT,
                  },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: "12px" }}>
                    <div style={{ fontFamily: SANS, fontSize: "10px", color: MUTED }}>{row.label}</div>
                    <div style={{ fontFamily: SANS, fontSize: "12px", color: row.color, marginTop: "2px" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── SECTION 7: FAULTLINE Market Read ── */}
          <div style={{ marginBottom: "28px" }}>
            <SectionLabel>Market Interpretation</SectionLabel>
            <MarketRead snapshot={snapshot} />
          </div>

          {/* Data attribution */}
          <div style={{ fontFamily: MONO, fontSize: "8px", color: MUTED, opacity: 0.5, textAlign: "center", paddingTop: "8px" }}>
            Market data via Yahoo Finance (15-min delayed) · Polygon.io fallback · Crypto via Yahoo Finance
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
