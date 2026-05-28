/**
 * PULSE MODE — "What matters right now?"
 * Fast market interpretation. Emotional anchor of FAULTLINE.
 * Calm · Clean · Fast · Mobile-friendly
 */
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Helpers ────────────────────────────────────────────────────────────────────
function riskLabel(level: string): string {
  const map: Record<string, string> = {
    low: "STABLE", moderate: "BUILDING", elevated: "ELEVATED",
    high: "ACCELERATING", critical: "CRITICAL",
  };
  return map[level] ?? "STABLE";
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0.1) return <TrendingUp size={12} className="inline" style={{ color: "#FF2D55" }} />;
  if (delta < -0.1) return <TrendingDown size={12} className="inline" style={{ color: "#00FF88" }} />;
  return <Minus size={12} className="inline" style={{ color: "#94A3B8" }} />;
}

// ── Pressure Index Hero ────────────────────────────────────────────────────────
function PressureHero() {
  const { output, isLive, isLoading } = useEngine();
  const { overall, regime, probability, domains } = output;
  const color = regime.color;

  const volatilityDomain = domains.find(d => d.id === "volatility-vix");
  const liquidityDomain = domains.find(d => d.id === "liquidity");

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #070910 0%, #0A0D14 60%, #050608 100%)`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 40px ${color}10, inset 0 1px 0 ${color}15`,
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)",
          width: "300px", height: "200px",
          background: `radial-gradient(ellipse, ${color}18 0%, transparent 70%)`,
          pointerEvents: "none", transition: "background 2s ease",
        }}
      />

      <div className="relative z-10 p-5">
        {/* Live badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isLive ? "#00FF88" : "#FF9500",
                boxShadow: `0 0 8px ${isLive ? "#00FF88" : "#FF9500"}`,
                animation: "blink-alert 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.25em", color: "rgba(100,116,139,0.7)" }}>
              {isLive ? "LIVE FEED" : "CACHED DATA"}
            </span>
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.2em",
              color: color, background: `${color}12`, border: `1px solid ${color}30`,
              borderRadius: 12, padding: "3px 10px",
            }}
          >
            {regime.label}
          </div>
        </div>

        {/* Score centerpiece */}
        <div className="text-center mb-5">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.5)", marginBottom: 4 }}>
            PRESSURE INDEX™
          </div>
          {isLoading ? (
            <div style={{ fontSize: 72, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "rgba(100,116,139,0.3)" }}>—</div>
          ) : (
            <div
              style={{
                fontSize: 72, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
                color, textShadow: `0 0 40px ${color}60, 0 0 80px ${color}20`,
                lineHeight: 1,
              }}
            >
              {overall.score.toFixed(1)}
            </div>
          )}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginTop: 2 }}>
            / 10.0
          </div>
        </div>

        {/* 4-stat grid: Bull · Crash · Volatility · Liquidity */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "BULL PROB", value: `${probability.bullProbability}%`, color: "#00FF88" },
            { label: "CRASH PROB", value: `${probability.crashProbability}%`, color: "#FF2D55" },
            {
              label: "VOLATILITY",
              value: volatilityDomain ? riskLabel(volatilityDomain.riskLevel) : "—",
              color: volatilityDomain ? getRiskColor(volatilityDomain.riskLevel) : "#94A3B8",
            },
            {
              label: "LIQUIDITY",
              value: liquidityDomain ? riskLabel(liquidityDomain.riskLevel) : "—",
              color: liquidityDomain ? getRiskColor(liquidityDomain.riskLevel) : "#94A3B8",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Regime description */}
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "rgba(148,163,184,0.8)", lineHeight: 1.6, textAlign: "center" }}>
          {regime.description}
        </p>
      </div>
    </div>
  );
}

// ── What Changed Today ─────────────────────────────────────────────────────────
function WhatChangedToday() {
  const { output } = useEngine();
  const { domains, overall } = output;

  const updates = useMemo(() => {
    const sorted = [...domains].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return sorted.slice(0, 5).map((d) => {
      const c = getRiskColor(d.riskLevel);
      const direction = d.delta > 0.05 ? "rising" : d.delta < -0.05 ? "easing" : "stable";
      const directionLabel = direction === "rising" ? "↑ Rising" : direction === "easing" ? "↓ Easing" : "→ Stable";
      const directionColor = direction === "rising" ? "#FF2D55" : direction === "easing" ? "#00FF88" : "#94A3B8";
      return { label: d.label, riskLevel: d.riskLevel, delta: d.delta, color: c, directionLabel, directionColor, score: d.score };
    });
  }, [domains]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          WHAT CHANGED TODAY
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.4)" }}>
          LIVE INTELLIGENCE
        </div>
      </div>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {updates.map((u) => (
          <div
            key={u.label}
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: u.color, flexShrink: 0, boxShadow: `0 0 6px ${u.color}60` }} />
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.label}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: u.directionColor }}>
                {u.directionLabel}
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.1em",
                  color: u.color, background: `${u.color}12`, border: `1px solid ${u.color}25`,
                  borderRadius: 4, padding: "1px 5px",
                }}
              >
                {riskLabel(u.riskLevel)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Market Risk Card ───────────────────────────────────────────────────────
function TopRiskCard() {
  const { output } = useEngine();
  const topThreat = useMemo(() => [...output.domains].sort((a, b) => b.score - a.score)[0], [output.domains]);
  if (!topThreat) return null;
  const color = getRiskColor(topThreat.riskLevel);

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, rgba(7,9,16,0.9) 100%)`,
        border: `1px solid ${color}25`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: "blink-alert 2s ease-in-out infinite" }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          TOP MARKET RISK
        </span>
      </div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 18, color, marginBottom: 4 }}>
        {topThreat.label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700, color, marginBottom: 6 }}>
        {topThreat.score.toFixed(1)}<span style={{ fontSize: 11, color: "rgba(100,116,139,0.5)" }}>/10</span>
      </div>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "rgba(148,163,184,0.8)", lineHeight: 1.6 }}>
        {topThreat.description}
      </p>
    </div>
  );
}

// ── Daily Brief Summary ────────────────────────────────────────────────────────
function DailyBriefSummary() {
  const { output } = useEngine();
  const { narrative, regime, overall, analogs } = output;
  const color = regime.color;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          DAILY BRIEF
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.4)" }}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
        </span>
      </div>

      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "rgba(203,213,225,0.9)", lineHeight: 1.7, marginBottom: 12 }}>
        {narrative.summary}
      </p>

      {analogs.length > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: `${color}08`, border: `1px solid ${color}20` }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "rgba(100,116,139,0.6)" }}>
            CLOSEST ANALOG
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color, fontWeight: 600 }}>
            {analogs[0].era}
          </span>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.7)" }}>
            — {analogs[0].matchReasons[0] ?? `${analogs[0].similarity}% match`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Compact Signal Footer ──────────────────────────────────────────────────────
function CompactSignalFooter() {
  const [, navigate] = useLocation();
  const { data: cryptoData } = trpc.crypto.getTopMarkets.useQuery(
    { limit: 3 },
    { staleTime: 5 * 60 * 1000 }
  );

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          TOP MOVERS
        </span>
        <button
          onClick={() => navigate("/app/signals")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00D4FF", letterSpacing: "0.1em" }}
        >
          VIEW ALL <ArrowRight size={10} />
        </button>
      </div>

      {cryptoData ? (
        <div className="flex flex-col gap-1.5">
          {cryptoData.slice(0, 3).map((coin) => {
            const change = coin.priceChangePercent24h ?? 0;
            const changeColor = change >= 0 ? "#00FF88" : "#FF2D55";
            return (
              <div key={coin.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#E2E8F0", fontWeight: 600 }}>
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, color: "rgba(100,116,139,0.6)" }}>
                    {coin.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#CBD5E1" }}>
                    ${coin.currentPrice.toLocaleString()}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: changeColor, fontWeight: 600 }}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(100,116,139,0.4)" }}>
          Loading market data...
        </div>
      )}
    </div>
  );
}

// ── PULSE MODE ROOT ────────────────────────────────────────────────────────────
export default function PulseMode() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <PressureHero />
      <WhatChangedToday />
      <TopRiskCard />
      <DailyBriefSummary />
      <CompactSignalFooter />
    </div>
  );
}
