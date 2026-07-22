/**
 * SIGNALS MODE — "Where is movement happening?"
 * Tactical movement tracking. Market radar.
 * Dynamic · Tactical · Responsive · Movement-oriented
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type FilterTab = "crypto" | "stocks" | "rotation";

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
              fontFamily: "'IBM Plex Mono', monospace",
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

// ── Crypto Signal Cards ────────────────────────────────────────────────────────
function CryptoSignalGrid() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data, isLoading } = trpc.crypto.getTopMarkets.useQuery(
    { limit: 12 },
    { staleTime: 3 * 60 * 1000, enabled: !!user }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.14)" }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          TOP CRYPTO BY VOLUME
        </span>
        <button
          onClick={() => navigate("/app/crypto-signals")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
        >
          DEEP SCAN <ArrowRight size={10} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {(data ?? []).slice(0, 8).map((coin) => {
          const change = coin.priceChangePercent24h ?? 0;
          const changeColor = change >= 0 ? "#00FF88" : "#FF2D55";
          const changeIcon = change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />;

          return (
            <div
              key={coin.id}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.14)" }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {coin.image && (
                  <img src={coin.image} alt={coin.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>
                    {coin.symbol.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, color: "rgba(100,116,139,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {coin.name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#CBD5E1" }}>
                    ${coin.currentPrice < 1 ? coin.currentPrice.toFixed(4) : coin.currentPrice.toLocaleString()}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 rounded-lg px-2 py-1"
                  style={{ background: `${changeColor}10`, border: `1px solid ${changeColor}20`, color: changeColor, minWidth: 60, justifyContent: "center" }}
                >
                  {changeIcon}
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600 }}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stocks Section ─────────────────────────────────────────────────────────────
function StocksSection() {
  const [, navigate] = useLocation();
  const { output } = useEngine();
  const { domains } = output;

  const topDomains = useMemo(() => [...domains].sort((a, b) => b.score - a.score).slice(0, 5), [domains]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          MACRO DOMAIN SIGNALS
        </span>
        <button
          onClick={() => navigate("/app/signals")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
        >
          STOCK SCREENER <ArrowRight size={10} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        {topDomains.map((d) => {
          const color = getRiskColor(d.riskLevel);
          const pct = Math.min(100, d.score * 10);
          return (
            <div
              key={d.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.14)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#CBD5E1" }}>
                  {d.label}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color, fontWeight: 600 }}>
                    {d.score.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.1em",
                      color, background: `${color}12`, border: `1px solid ${color}25`,
                      borderRadius: 3, padding: "1px 5px",
                    }}
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
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/app/signals")}
        className="w-full rounded-xl py-3 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
        style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.32)", color: "#00E5FF" }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.2em" }}>
          OPEN STOCK SCREENER
        </span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ── Rotation Tracker ───────────────────────────────────────────────────────────
function RotationTracker() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data, isLoading } = trpc.altRotation.getData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          ROTATION TRACKER
        </span>
        <button
          onClick={() => navigate("/app/alt-rotation")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
        >
          FULL ENGINE <ArrowRight size={10} />
        </button>
      </div>

      {data ? (
        <div className="flex flex-col gap-2">
          {/* BTC Dominance */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.11)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,116,139,0.6)" }}>
                BTC DOMINANCE
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
                {btcDom?.current.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "capitalize" }}>
                {btcDom?.trend} — {btcDom?.pressure} pressure
              </span>
            </div>
          </div>

          {/* Regime */}
          <div
            className="rounded-xl p-3"
            style={{
              background: `${regimeColor}08`,
              border: `1px solid ${regimeColor}25`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(100,116,139,0.6)" }}>
                ROTATION REGIME
              </span>
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: regimeColor }}>
              {data.regimeKey.replace(/_/g, " ").toUpperCase()}
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.7)", marginTop: 4, lineHeight: 1.5 }}>
              {data.aiCommentary?.slice(0, 140)}{data.aiCommentary && data.aiCommentary.length > 140 ? "..." : ""}
            </p>
          </div>

          {/* Sector momentum — top 3 */}
          {data.sectors?.slice(0, 3).map((sector) => {
            const sColor = sector.color ?? "#00E5FF";
            return (
              <div
                key={sector.name}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)" }}
              >
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#CBD5E1" }}>
                  {sector.name}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: sColor, fontWeight: 600 }}>
                    {sector.momentum}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: sColor }}>
                    {sector.score}/100
                  </span>
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
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(100,116,139,0.5)" }}>
            Rotation data unavailable
          </p>
          <button
            onClick={() => navigate("/app/alt-rotation")}
            className="mt-2 flex items-center gap-1 mx-auto"
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00E5FF" }}
          >
            OPEN ALT ROTATION ENGINE <ArrowRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── SIGNALS MODE ROOT ──────────────────────────────────────────────────────────
export default function SignalsMode() {
  const [activeTab, setActiveTab] = useState<FilterTab>("crypto");
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <FilterBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "crypto" && <CryptoSignalGrid />}
      {activeTab === "stocks" && <StocksSection />}
      {activeTab === "rotation" && <RotationTracker />}
    </div>
  );
}
