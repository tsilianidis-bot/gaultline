/* ============================================================
   FAULTLINE Core — Signals Tab
   Limited stock + crypto signals. Locked Pro cards for advanced.
   Uses /api/signals/quotes for live data + trpc.signals.getTradingSignals
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Minus, Lock, RefreshCw, ChevronRight } from "lucide-react";

// ── Core-visible tickers (limited set) ───────────────────────
const CORE_TICKERS = ["NVDA", "MSFT", "META", "AMZN", "TSLA"];
const LOCKED_TICKERS = ["PLTR", "QUBT", "IONQ", "AMD", "JPM", "XLF", "SPY", "QQQ"];

// ── Core-visible crypto ───────────────────────────────────────
const CORE_CRYPTO = ["bitcoin", "ethereum"];
const LOCKED_CRYPTO = ["solana", "chainlink", "render-token"];

// ── Helpers ───────────────────────────────────────────────────
type SignalLabel = "BUY" | "SELL" | "HOLD" | "WATCH" | "AVOID";

function getSignalColor(signal: SignalLabel | string): string {
  switch (signal) {
    case "BUY": return "#34D399";
    case "SELL": return "#FF2D55";
    case "HOLD": return "#FFD700";
    case "WATCH": return "#00D4FF";
    case "AVOID": return "#FF9500";
    default: return "#64748B";
  }
}

function getSignalIcon(signal: string) {
  if (signal === "BUY") return <TrendingUp size={12} />;
  if (signal === "SELL") return <TrendingDown size={12} />;
  return <Minus size={12} />;
}

function formatChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

// ── Signal card ───────────────────────────────────────────────
interface SignalCardProps {
  ticker: string;
  price?: number;
  changePercent?: number;
  signal?: string;
  riskLabel?: string;
  momentum?: string;
  loading?: boolean;
}

function SignalCard({ ticker, price, changePercent, signal, riskLabel, momentum, loading }: SignalCardProps) {
  const signalColor = getSignalColor(signal ?? "HOLD");
  const changeColor = (changePercent ?? 0) >= 0 ? "#34D399" : "#FF2D55";

  if (loading) {
    return (
      <div
        className="rounded-xl p-3 flex items-center gap-3 animate-pulse"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.06)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 bg-[rgba(255,255,255,0.06)] rounded" />
          <div className="h-2 w-24 bg-[rgba(255,255,255,0.04)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Ticker badge */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${signalColor}15`, border: `1px solid ${signalColor}30` }}
      >
        <span className="text-[9px] font-mono font-bold" style={{ color: signalColor }}>
          {ticker.slice(0, 4)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-white">{ticker}</span>
          {signal && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
              style={{ background: `${signalColor}15`, color: signalColor }}
            >
              {getSignalIcon(signal)}
              {signal}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {price !== undefined && (
            <span className="text-[11px] font-mono text-[#A8B8CC]">${price.toFixed(2)}</span>
          )}
          {changePercent !== undefined && (
            <span className="text-[10px] font-mono font-bold" style={{ color: changeColor }}>
              {formatChange(changePercent)}
            </span>
          )}
          {riskLabel && (
            <span className="text-[9px] font-mono text-[#64748B]">{riskLabel}</span>
          )}
        </div>
      </div>

      {/* Momentum */}
      {momentum && (
        <div className="text-[9px] font-mono text-[#64748B] flex-shrink-0">{momentum}</div>
      )}
    </div>
  );
}

// ── Locked card ───────────────────────────────────────────────
function LockedCard({ ticker }: { ticker: string }) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3 relative overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[rgba(255,255,255,0.04)]">
        <Lock size={14} className="text-[#64748B]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-[#64748B] blur-[2px] select-none">{ticker}</span>
          <div className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-[rgba(255,255,255,0.06)] text-[#64748B]">
            PRO
          </div>
        </div>
        <span className="text-[10px] font-mono text-[#3D4F63]">Advanced signal locked</span>
      </div>
      <a
        href="/app/account"
        className="text-[9px] font-mono tracking-widest flex-shrink-0 flex items-center gap-1"
        style={{ color: "#00D4FF" }}
      >
        UNLOCK <ChevronRight size={10} />
      </a>
    </div>
  );
}

// ── Crypto signal card ────────────────────────────────────────
interface CryptoSignalCardProps {
  id: string;
  name: string;
  price?: number;
  changePercent?: number;
  signal?: string;
  loading?: boolean;
}

function CryptoSignalCard({ id, name, price, changePercent, signal, loading }: CryptoSignalCardProps) {
  const signalColor = getSignalColor(signal ?? "HOLD");
  const changeColor = (changePercent ?? 0) >= 0 ? "#34D399" : "#FF2D55";
  const symbol = id.slice(0, 3).toUpperCase();

  if (loading) {
    return (
      <div
        className="rounded-xl p-3 flex items-center gap-3 animate-pulse"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.06)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 bg-[rgba(255,255,255,0.06)] rounded" />
          <div className="h-2 w-24 bg-[rgba(255,255,255,0.04)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${signalColor}15`, border: `1px solid ${signalColor}30` }}
      >
        <span className="text-[9px] font-mono font-bold" style={{ color: signalColor }}>{symbol}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-white capitalize">{name}</span>
          {signal && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold"
              style={{ background: `${signalColor}15`, color: signalColor }}
            >
              {getSignalIcon(signal)}
              {signal}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {price !== undefined && (
            <span className="text-[11px] font-mono text-[#A8B8CC]">${price.toLocaleString()}</span>
          )}
          {changePercent !== undefined && (
            <span className="text-[10px] font-mono font-bold" style={{ color: changeColor }}>
              {formatChange(changePercent)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MobileSignals() {
  const [tab, setTab] = useState<"stocks" | "crypto">("stocks");
  const [quotes, setQuotes] = useState<Record<string, { price: number; changePercent: number; open: number; high: number; low: number; volumeMillions: number; avgVolume: number; sparkline: number[] }>>({});
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [cryptoData, setCryptoData] = useState<Record<string, { price: number; changePercent: number }>>({});

  // Fetch stock quotes from the signals proxy
  useEffect(() => {
    setQuotesLoading(true);
    fetch("/api/signals/quotes")
      .then(r => r.json())
      .then((data: { quotes?: { ticker: string; price: number; changePercent: number; open: number; high: number; low: number; volumeMillions: number; avgVolume: number; sparkline: number[] }[] }) => {
        const map: Record<string, { price: number; changePercent: number; open: number; high: number; low: number; volumeMillions: number; avgVolume: number; sparkline: number[] }> = {};
        (data.quotes ?? []).forEach(q => { map[q.ticker] = q; });
        setQuotes(map);
      })
      .catch(() => {})
      .finally(() => setQuotesLoading(false));
  }, []);

  // Fetch crypto prices from CoinGecko via existing endpoint
  const { data: globalStats } = trpc.crypto.getGlobalStats.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const { data: pressureData } = trpc.pressure.getCurrentPressure.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Compute trading signals for core tickers
  const coreQuoteInputs = useMemo(() => {
    return CORE_TICKERS
      .filter(t => quotes[t])
      .map(t => {
        const q = quotes[t];
        return {
          ticker: t,
          price: q.price,
          open: q.open,
          high: q.high,
          low: q.low,
          changePercent: q.changePercent,
          volumeMillions: q.volumeMillions,
          avgVolume: q.avgVolume,
          sparkline: q.sparkline,
          relativeStrength: 50, // default for core tier
        };
      });
  }, [quotes]);

  const regime = useMemo(() => ({
    label: pressureData?.regime ?? "MODERATE RISK",
    score: pressureData?.overallPressure ?? 40,
  }), [pressureData]);

  const tradingSignalsQuery = trpc.signals.getTradingSignals.useMutation();

  const [computedSignals, setComputedSignals] = useState<Record<string, { signal: string; riskLabel: string; momentum: string }>>({});

  useEffect(() => {
    if (coreQuoteInputs.length === 0) return;
    tradingSignalsQuery.mutateAsync({
      tickers: coreQuoteInputs,
      regime,
    }).then(results => {
      const map: Record<string, { signal: string; riskLabel: string; momentum: string }> = {};
      results.forEach((r) => {
        const action = r.action ?? "HOLD";
        const strength = r.strength ?? "";
        const trend = r.technicals?.trend ?? "";
        map[r.ticker] = {
          signal: action,
          riskLabel: strength,
          momentum: trend,
        };
      });
      setComputedSignals(map);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreQuoteInputs.length, regime.label]);

  return (
    <div className="px-4 py-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-0.5">FAULTLINE SIGNALS™</div>
          <div className="text-xs font-mono text-[#64748B]">Core — Limited Access</div>
        </div>
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["stocks", "crypto"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 text-[9px] font-mono tracking-widest transition-colors"
              style={{
                background: tab === t ? "rgba(0,212,255,0.15)" : "transparent",
                color: tab === t ? "#00D4FF" : "#64748B",
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {tab === "stocks" && (
        <>
          {/* Core signals */}
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#A8B8CC]/60 mb-2 flex items-center gap-2">
              <span>CORE ACCESS</span>
              <span className="text-[#22D3EE] bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.2)] px-1.5 py-0.5 rounded-full">5 TICKERS</span>
            </div>
            <div className="space-y-2">
              {CORE_TICKERS.map(ticker => (
                <SignalCard
                  key={ticker}
                  ticker={ticker}
                  price={quotes[ticker]?.price}
                  changePercent={quotes[ticker]?.changePercent}
                  signal={computedSignals[ticker]?.signal}
                  riskLabel={computedSignals[ticker]?.riskLabel}
                  momentum={computedSignals[ticker]?.momentum}
                  loading={quotesLoading}
                />
              ))}
            </div>
          </div>

          {/* Locked Pro signals */}
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#64748B]/60 mb-2 flex items-center gap-2">
              <Lock size={10} className="text-[#64748B]" />
              <span>PRO REQUIRED</span>
              <span className="text-[#64748B] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded-full">{LOCKED_TICKERS.length} MORE</span>
            </div>
            <div className="space-y-2">
              {LOCKED_TICKERS.map(ticker => (
                <LockedCard key={ticker} ticker={ticker} />
              ))}
            </div>
          </div>

          {/* Upgrade CTA */}
          <a
            href="/app/account"
            className="flex items-center justify-between rounded-xl p-4"
            style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}
          >
            <div>
              <div className="text-xs font-mono font-bold text-white">Unlock Full Intelligence</div>
              <div className="text-[10px] font-mono text-[#64748B] mt-0.5">19 tickers + AI classification + alerts</div>
            </div>
            <div className="text-[10px] font-mono text-[#00D4FF] flex items-center gap-1">
              PRO <ChevronRight size={12} />
            </div>
          </a>
        </>
      )}

      {tab === "crypto" && (
        <>
          {/* Core crypto */}
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#A8B8CC]/60 mb-2 flex items-center gap-2">
              <span>CORE ACCESS</span>
              <span className="text-[#22D3EE] bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.2)] px-1.5 py-0.5 rounded-full">2 ASSETS</span>
            </div>
            <div className="space-y-2">
              {CORE_CRYPTO.map(id => {
                const name = id === "bitcoin" ? "Bitcoin" : "Ethereum";
                const btcDom = globalStats?.btcDominance;
                // Simple signal based on pressure
                const score = pressureData?.overallPressure ?? 40;
                const signal = score >= 65 ? "AVOID" : score >= 45 ? "HOLD" : "WATCH";
                return (
                  <CryptoSignalCard
                    key={id}
                    id={id}
                    name={name}
                    signal={signal}
                    loading={!globalStats && !pressureData}
                  />
                );
              })}
            </div>
          </div>

          {/* BTC dominance */}
          {globalStats?.btcDominance !== undefined && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="text-[9px] font-mono tracking-widest text-[#64748B] mb-2">BTC DOMINANCE</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono text-[#F59E0B]">{globalStats.btcDominance.toFixed(1)}%</span>
                <span className="text-[10px] font-mono text-[#64748B]">
                  {globalStats.btcDominance > 55 ? "Bitcoin Dominance Regime" : globalStats.btcDominance > 45 ? "Early Rotation Watch" : "Alt Expansion Phase"}
                </span>
              </div>
            </div>
          )}

          {/* Locked crypto */}
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#64748B]/60 mb-2 flex items-center gap-2">
              <Lock size={10} className="text-[#64748B]" />
              <span>PRO REQUIRED</span>
            </div>
            <div className="space-y-2">
              {LOCKED_CRYPTO.map(id => (
                <LockedCard key={id} ticker={id.toUpperCase().slice(0, 8)} />
              ))}
            </div>
          </div>

          {/* Upgrade CTA */}
          <a
            href="/app/account"
            className="flex items-center justify-between rounded-xl p-4"
            style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}
          >
            <div>
              <div className="text-xs font-mono font-bold text-white">Full Crypto Intelligence™</div>
              <div className="text-[10px] font-mono text-[#64748B] mt-0.5">50+ assets + systemic risk + heatmap</div>
            </div>
            <div className="text-[10px] font-mono text-[#00D4FF] flex items-center gap-1">
              PRO <ChevronRight size={12} />
            </div>
          </a>
        </>
      )}
    </div>
  );
}
