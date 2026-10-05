/**
 * SIGNALS MODE — "Where is movement happening?"
 * Information hierarchy (answer immediately):
 *   1. What is moving?
 *   2. How strong?
 *   3. Why?
 *   4. Is data current enough?
 *   5. What to watch next? — not shown per row: no engine-backed, signal-specific
 *      prompt exists here, so none is invented (see DEEP SCAN / Signal Outlook).
 * Signal content first; Pre-Flight / integrity are compact secondary.
 * Display-only — does not change signal calculations or methodology.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { change24hColor, change24hText, displayChange24h } from "@/lib/change24h";
import { formatEt } from "@shared/credibilityLabels";
import { deltaDirection, vsBaselineText } from "@/lib/deltaAvailability";
import { AwarenessDashboardCard, MarketPreflightModal } from "@/components/MarketPreflight";
import DataIntegrity from "@/components/DataIntegrity";

type FilterTab = "crypto" | "stocks" | "rotation";

const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Momentum shown as the provider's own 7D % change — no new bands or thresholds. */
function momentumText(change7d: number | null | undefined): string {
  return typeof change7d === "number" && Number.isFinite(change7d)
    ? `7D ${change24hText(change7d)}`
    : "7D —";
}

/** Direction from the sign of the provider 24h change only (no threshold band). */
function directionLabel(change24h: number | null): { text: string; color: string } {
  if (change24h === null) return { text: "UNKNOWN", color: "#64748B" };
  if (change24h > 0) return { text: "UP", color: "#00FF88" };
  if (change24h < 0) return { text: "DOWN", color: "#FF2D55" };
  return { text: "FLAT", color: "#94A3B8" };
}

/** Turnover = 24h volume / market cap (%). Not relative volume (no trailing-average baseline). */
function turnoverPct(totalVolume: number | null | undefined, marketCap: number | null | undefined): number | null {
  if (typeof totalVolume !== "number" || typeof marketCap !== "number") return null;
  if (!Number.isFinite(totalVolume) || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  return (totalVolume / marketCap) * 100;
}

function ageLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────
function FilterBar({ active, onChange }: { active: FilterTab; onChange: (t: FilterTab) => void }) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: "crypto", label: "CRYPTO" },
    { id: "stocks", label: "STOCKS" },
    { id: "rotation", label: "ROTATION" },
  ];

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: "rgba(5,6,8,0.9)", border: "1px solid rgba(255,255,255,0.12)" }}
      data-signals-hierarchy="tabs"
    >
      {tabs.map((tab) => {
        const active_ = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 py-2 rounded-lg transition-all duration-200 active:scale-[0.97]"
            style={{
              background: active_ ? "rgba(0,229,255,0.20)" : "transparent",
              border: active_ ? "1px solid rgba(0,229,255,0.38)" : "1px solid transparent",
              color: active_ ? "#00E5FF" : "rgba(100,116,139,0.7)",
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.2em",
              fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function RegimeContextChip({ regime }: { regime: string | null | undefined }) {
  if (!regime) {
    return (
      <span style={{ fontFamily: MONO, fontSize: 9, color: "rgba(148,163,184,0.55)", letterSpacing: "0.08em" }}>
        REGIME CONTEXT UNAVAILABLE
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em",
        color: "#00E5FF", background: "rgba(0,229,255,0.08)",
        border: "1px solid rgba(0,229,255,0.28)", borderRadius: 3, padding: "2px 7px",
      }}
      data-signals-field="regime-context"
    >
      REGIME · {regime}
    </span>
  );
}

// ── Crypto Signal Cards ────────────────────────────────────────────────────────
function CryptoSignalGrid({ regime }: { regime: string | null | undefined }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // Query options unchanged from base (display-only PR): same limit, staleTime, auth gating.
  const { data, isLoading, isError, dataUpdatedAt } = trpc.crypto.getTopMarkets.useQuery(
    { limit: 12 },
    { staleTime: 3 * 60 * 1000, enabled: !!user }
  );

  const asOfFeed = dataUpdatedAt ? formatEt(dataUpdatedAt) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" data-signals-hierarchy="movers" data-signals-tab="crypto">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.14)" }} />
        ))}
      </div>
    );
  }

  const coins = data ?? [];

  return (
    <div data-signals-hierarchy="movers" data-signals-tab="crypto">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          TOP CRYPTO BY VOLUME
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <RegimeContextChip regime={regime} />
          {asOfFeed && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: "rgba(148,163,184,0.55)", letterSpacing: "0.06em" }} data-signals-field="feed-asof">
              AS OF {asOfFeed}
            </span>
          )}
          <button
            onClick={() => navigate("/app/crypto-signals")}
            className="flex items-center gap-1"
            style={{ fontFamily: MONO, fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
          >
            DEEP SCAN <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {isError && (
        <div
          className="rounded-xl px-3 py-3 mb-2"
          style={{ background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.25)" }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#FF9500", letterSpacing: "0.08em" }}>
            CRYPTO MARKETS UNAVAILABLE
          </div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: "rgba(148,163,184,0.75)", marginTop: 4 }}>
            Top movers could not be loaded. Signal cards are withheld — not shown as current.
          </div>
        </div>
      )}

      {!isError && coins.length === 0 && (
        <div
          className="rounded-xl px-3 py-3 mb-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(148,163,184,0.7)" }}>NO VOLUME LEADERS AVAILABLE</div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {coins.slice(0, 8).map((coin) => {
          const change = displayChange24h(coin);
          const changeColor = change24hColor(change);
          const dir = directionLabel(change);
          const changeIcon = change === null ? <Minus size={10} /> : change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />;
          const turnover = turnoverPct(coin.totalVolume, coin.marketCap);
          const mom = momentumText(coin.priceChangePercent7d);
          const asOf = formatEt(coin.lastUpdated) ?? ageLabel(coin.lastUpdated);

          return (
            <div
              key={coin.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.14)" }}
              data-signals-row={coin.symbol.toUpperCase()}
            >
              {/* 1–2: What is moving? How strong? */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {coin.image && (
                    <img src={coin.image} alt={coin.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>
                        {coin.symbol.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em",
                          color: dir.color, background: `${dir.color}14`,
                          border: `1px solid ${dir.color}30`, borderRadius: 3, padding: "1px 5px",
                        }}
                        data-signals-field="direction"
                      >
                        {dir.text}
                      </span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: 10, color: "rgba(100,116,139,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {coin.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div style={{ fontFamily: MONO, fontSize: 12, color: "#CBD5E1" }} data-signals-field="price">
                      {formatUsd(coin.currentPrice)}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: "rgba(100,116,139,0.55)" }} data-signals-field="volume">
                      VOL {formatUsd(coin.totalVolume)}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-lg px-2 py-1"
                    style={{ background: `${changeColor}10`, border: `1px solid ${changeColor}20`, color: changeColor, minWidth: 64, justifyContent: "center" }}
                    data-signals-field="pct-move"
                  >
                    {changeIcon}
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600 }}>
                      {change24hText(change)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2–4: strength detail, why, freshness */}
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 8, fontFamily: MONO, fontSize: 8, letterSpacing: "0.06em", color: "rgba(148,163,184,0.65)" }}>
                <span data-signals-field="turnover">
                  TURNOVER {turnover === null ? "—" : `${turnover.toFixed(1)}%`} (VOL/MCAP)
                </span>
                <span data-signals-field="momentum" style={{ color: change24hColor(coin.priceChangePercent7d ?? null) }}>
                  {mom}
                </span>
                <span data-signals-field="catalyst" style={{ color: "rgba(250,204,21,0.75)" }}>
                  CATALYST UNCLEAR
                </span>
                <span data-signals-field="freshness">
                  {asOf ? `AS OF ${asOf}` : "AS OF UNAVAILABLE"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stocks Section ─────────────────────────────────────────────────────────────
function StocksSection({ regime }: { regime: string | null | undefined }) {
  const [, navigate] = useLocation();
  const { output, lastUpdated, integrityLabel } = useEngine();
  const { domains } = output;

  const topDomains = useMemo(() => [...domains].sort((a, b) => b.score - a.score).slice(0, 5), [domains]);
  const asOf = lastUpdated ? formatEt(lastUpdated.getTime()) : null;

  return (
    <div data-signals-hierarchy="movers" data-signals-tab="stocks">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          MACRO DOMAIN SIGNALS
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <RegimeContextChip regime={regime} />
          {asOf && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: "rgba(148,163,184,0.55)" }} data-signals-field="feed-asof">
              AS OF {asOf}
            </span>
          )}
          <button
            onClick={() => navigate("/app/signals")}
            className="flex items-center gap-1"
            style={{ fontFamily: MONO, fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
          >
            STOCK SCREENER <ArrowRight size={10} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        {topDomains.map((d) => {
          const color = getRiskColor(d.riskLevel);
          const pct = Math.min(100, d.score * 10);
          // Existing engine fields only (no new thresholds): delta trend, riskLevel, drivers, dataStatus.
          const dir = deltaDirection(d).toUpperCase();
          const move = vsBaselineText(d);
          const why = d.drivers?.[0] ?? null;
          const domainState = (d.dataStatus ?? "").toUpperCase();
          return (
            <div
              key={d.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.14)" }}
              data-signals-row={d.id}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: SANS, fontSize: 12, color: "#CBD5E1" }}>{d.label}</span>
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em",
                      color, background: `${color}12`, border: `1px solid ${color}25`,
                      borderRadius: 3, padding: "1px 5px",
                    }}
                    data-signals-field="direction"
                  >
                    {dir}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: MONO, fontSize: 11, color, fontWeight: 600 }} data-signals-field="pct-move">
                    {d.score.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em",
                      color, background: `${color}12`, border: `1px solid ${color}25`,
                      borderRadius: 3, padding: "1px 5px",
                    }}
                    data-signals-field="momentum"
                  >
                    {d.riskLevel.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.09)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}60, ${color})`,
                    boxShadow: `0 0 6px ${color}40`,
                    transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 8, fontFamily: MONO, fontSize: 8, letterSpacing: "0.06em", color: "rgba(148,163,184,0.65)" }}>
                <span data-signals-field="baseline-move">{move.toUpperCase()}</span>
                <span data-signals-field="catalyst" style={{ color: "rgba(250,204,21,0.75)" }}>
                  {why ? `WHY · ${why}` : "CATALYST UNCLEAR"}
                </span>
                <span data-signals-field="freshness">
                  {asOf ? `AS OF ${asOf}` : "AS OF UNAVAILABLE"} · {domainState && domainState !== "LIVE" ? domainState : integrityLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/app/signals")}
        className="w-full rounded-xl py-3 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
        style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.32)", color: "#00E5FF" }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em" }}>
          OPEN STOCK SCREENER
        </span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ── Rotation Tracker ───────────────────────────────────────────────────────────
function RotationTracker({ regime }: { regime: string | null | undefined }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data, isLoading, dataUpdatedAt } = trpc.altRotation.getData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  const asOf = dataUpdatedAt ? formatEt(dataUpdatedAt) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" data-signals-hierarchy="movers" data-signals-tab="rotation">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.14)" }} />
        ))}
      </div>
    );
  }

  const btcDom = data?.btcDominance;
  const regimeColor = data
    ? data.regimeKey === "broad_altseason" || data.regimeKey === "speculative_mania"
      ? "#00FF88"
      : data.regimeKey === "early_rotation"
      ? "#FB923C"
      : "#00E5FF"
    : "#94A3B8";

  return (
    <div data-signals-hierarchy="movers" data-signals-tab="rotation">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          ROTATION TRACKER
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <RegimeContextChip regime={regime ?? (data ? data.regimeKey.replace(/_/g, " ").toUpperCase() : null)} />
          {asOf && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: "rgba(148,163,184,0.55)" }} data-signals-field="feed-asof">
              AS OF {asOf}
            </span>
          )}
          <button
            onClick={() => navigate("/app/alt-rotation")}
            className="flex items-center gap-1"
            style={{ fontFamily: MONO, fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
          >
            FULL ENGINE <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {data ? (
        <div className="flex flex-col gap-2">
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.11)" }}
            data-signals-row="btc-dominance"
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,116,139,0.6)" }}>
                BTC DOMINANCE
              </span>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: "#F59E0B" }} data-signals-field="pct-move">
                {btcDom?.current.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, fontFamily: MONO, fontSize: 8, letterSpacing: "0.06em", color: "rgba(148,163,184,0.7)" }}>
              <span data-signals-field="direction" style={{ color: regimeColor }}>
                {(btcDom?.trend ?? "unknown").toUpperCase()}
              </span>
              <span data-signals-field="momentum">{(btcDom?.pressure ?? "—").toUpperCase()} PRESSURE</span>
              <span data-signals-field="catalyst" style={{ color: "rgba(250,204,21,0.75)" }}>CATALYST UNCLEAR</span>
              <span data-signals-field="freshness">{asOf ? `AS OF ${asOf}` : "AS OF UNAVAILABLE"}</span>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: `${regimeColor}08`, border: `1px solid ${regimeColor}25` }}
            data-signals-row="rotation-regime"
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,116,139,0.6)" }}>
                ROTATION REGIME
              </span>
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: regimeColor }} data-signals-field="direction">
              {data.regimeKey.replace(/_/g, " ").toUpperCase()}
            </div>
            <p style={{ fontFamily: SANS, fontSize: 11, color: "rgba(148,163,184,0.7)", marginTop: 4, lineHeight: 1.5 }}>
              {data.aiCommentary?.slice(0, 140)}{data.aiCommentary && data.aiCommentary.length > 140 ? "..." : ""}
            </p>
          </div>

          {data.sectors?.slice(0, 3).map((sector) => {
            const sColor = sector.color ?? "#00E5FF";
            return (
              <div
                key={sector.name}
                className="rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)" }}
                data-signals-row={sector.name}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: SANS, fontSize: 12, color: "#CBD5E1" }}>{sector.name}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: MONO, fontSize: 10, color: sColor, fontWeight: 600 }} data-signals-field="momentum">
                      {sector.momentum}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: sColor }} data-signals-field="pct-move">
                      {sector.score}/100
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 4, fontFamily: MONO, fontSize: 8, color: "rgba(148,163,184,0.6)" }}>
                  <span data-signals-field="catalyst" style={{ color: "rgba(250,204,21,0.75)" }}>CATALYST UNCLEAR</span>
                  <span data-signals-field="freshness">{asOf ? `AS OF ${asOf}` : "AS OF UNAVAILABLE"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.11)" }}
        >
          <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(100,116,139,0.5)" }}>
            Rotation data unavailable
          </p>
          <button
            onClick={() => navigate("/app/alt-rotation")}
            className="mt-2 flex items-center gap-1 mx-auto"
            style={{ fontFamily: MONO, fontSize: 9, color: "#00E5FF" }}
          >
            OPEN ALT ROTATION ENGINE <ArrowRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact Pre-Flight secondary — never dominates signal movers. */
function SignalsPreflightSecondary() {
  const [open, setOpen] = useState(false);
  const { output } = useEngine();
  const regimeLabel = output?.regime?.label ?? "Unknown";
  return (
    <div data-signals-hierarchy="preflight">
      <AwarenessDashboardCard variant="compact" onOpen={() => setOpen(true)} />
      <MarketPreflightModal
        open={open}
        onClose={() => setOpen(false)}
        currentPage="signals"
        regimeLabel={regimeLabel}
      />
    </div>
  );
}

// ── SIGNALS MODE ROOT ──────────────────────────────────────────────────────────
export default function SignalsMode() {
  // Hooks must run unconditionally (no early return before useState).
  const [activeTab, setActiveTab] = useState<FilterTab>("crypto");
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const regime = canonicalState?.regime ?? null;

  return (
    <div className="flex flex-col gap-4 pb-8" data-signals-mode="root">
      <FilterBar active={activeTab} onChange={setActiveTab} />

      {/* 1–3 / 5: actual signal content FIRST */}
      {activeTab === "crypto" && <CryptoSignalGrid regime={regime} />}
      {activeTab === "stocks" && <StocksSection regime={regime} />}
      {activeTab === "rotation" && <RotationTracker regime={regime} />}

      {/* 4: data current enough? — compact secondary */}
      <div data-signals-hierarchy="integrity">
        <DataIntegrity variant="signals" />
      </div>

      {/* Pre-Flight: compact secondary, never Pressure Index */}
      <SignalsPreflightSecondary />
    </div>
  );
}
