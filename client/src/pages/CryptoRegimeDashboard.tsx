/**
 * Crypto Market Regime Dashboard
 * Dedicated page exposing the full CryptoMarketRegime engine output:
 *  1. Regime Card (headline + confidence + trend + risk + forward bias)
 *  2. Why This Regime? (indicator breakdown)
 *  3. Historical Context
 *  4. Transition Probabilities
 *  5. Actionable Interpretation
 *  6. Cross-Market Comparison
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bitcoin, TrendingUp, TrendingDown, Minus, RefreshCw,
  BarChart3, Activity, AlertTriangle, Clock, Target,
  ArrowRight, Info, Zap,
} from "lucide-react";
import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────
function SignalDot({ signal }: { signal: string }) {
  const color =
    signal === "Bullish" ? "#00FF88" :
    signal === "Bearish" ? "#EF4444" :
    "#F59E0B";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
      style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
    />
  );
}

function ContributionPill({ level }: { level: string }) {
  const cls =
    level === "High"   ? "bg-red-500/20 text-red-300 border-red-500/30" :
    level === "Medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                         "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  );
}

function AlignmentBadge({ status, score }: { status: string; score: number }) {
  const color =
    score > 65 ? "#00FF88" :
    score < 35 ? "#EF4444" :
    "#F59E0B";
  return (
    <span
      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
      style={{
        color,
        borderColor: `${color}40`,
        background: `${color}15`,
      }}
    >
      {status}
    </span>
  );
}

function ProbBar({ probability, color }: { probability: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${probability}%`, background: color }}
      />
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-white/5 ${className ?? ""}`} />
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CryptoRegimeDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error, refetch } = trpc.marketIntelligence.getCryptoRegimeDashboard.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  const regimeColor = data?.color ?? "#8B5CF6";
  const confidence  = data?.confidence ?? 0;
  const trend       = data?.trend ?? "Stable";

  const TrendIcon = trend === "Improving" ? TrendingUp : trend === "Deteriorating" ? TrendingDown : Minus;
  const trendColor = trend === "Improving" ? "#00FF88" : trend === "Deteriorating" ? "#EF4444" : "#F59E0B";

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)" }}
    >
      {/* Header */}
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: `${regimeColor}20`, background: `${regimeColor}06` }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${regimeColor}20`, border: `1px solid ${regimeColor}40` }}
            >
              <Bitcoin className="w-5 h-5" style={{ color: regimeColor }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                CRYPTO MARKET REGIME
              </h1>
              <p className="text-xs text-white/40 font-mono">
                FAULTLINE Intelligence Engine · Macro-driven cycle classification
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Section 1: Regime Card ─────────────────────────────── */}
        <div
          className="rounded-xl border p-6"
          style={{
            borderColor: `${regimeColor}30`,
            background: `linear-gradient(135deg, ${regimeColor}08 0%, transparent 60%)`,
          }}
        >
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Regime headline */}
            <div className="flex-1">
              <p className="text-xs font-mono text-white/40 mb-2 tracking-widest">CRYPTO MARKET REGIME</p>
              {isLoading ? (
                <Skeleton className="h-10 w-64 mb-3" />
              ) : (
                <h2
                  className="text-3xl font-bold mb-3 leading-tight"
                  style={{ color: regimeColor, fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {data?.regime ?? "—"}
                </h2>
              )}
              {isLoading ? (
                <Skeleton className="h-4 w-full mb-2" />
              ) : (
                <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                  {data?.explanation ?? ""}
                </p>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 md:w-72">
              {/* Confidence */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-mono text-white/40 mb-1">CONFIDENCE</p>
                {isLoading ? <Skeleton className="h-6 w-16" /> : (
                  <>
                    <p className="text-2xl font-bold" style={{ color: regimeColor }}>{confidence}%</p>
                    <ScoreBar value={confidence} color={regimeColor} />
                  </>
                )}
              </div>
              {/* Trend */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-mono text-white/40 mb-1">TREND</p>
                {isLoading ? <Skeleton className="h-6 w-20" /> : (
                  <div className="flex items-center gap-1.5">
                    <TrendIcon className="w-4 h-4" style={{ color: trendColor }} />
                    <span className="text-sm font-bold" style={{ color: trendColor }}>{trend}</span>
                  </div>
                )}
              </div>
              {/* Risk Level */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-mono text-white/40 mb-1">RISK LEVEL</p>
                {isLoading ? <Skeleton className="h-6 w-20" /> : (
                  <p className="text-sm font-bold text-white">{data?.riskLevel ?? "—"}</p>
                )}
              </div>
              {/* Cycle Phase */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-mono text-white/40 mb-1">CYCLE PHASE</p>
                {isLoading ? <Skeleton className="h-6 w-24" /> : (
                  <p className="text-xs font-bold text-purple-300 leading-tight">{data?.cyclePhase ?? "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Strategy */}
          {!isLoading && data?.strategy && (
            <div
              className="mt-4 rounded-lg border px-4 py-3 flex items-start gap-2"
              style={{ borderColor: `${regimeColor}25`, background: `${regimeColor}08` }}
            >
              <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: regimeColor }} />
              <div>
                <p className="text-[10px] font-mono text-white/40 mb-0.5">STRATEGY GUIDANCE</p>
                <p className="text-sm text-white/80">{data.strategy}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Why This Regime? (Indicator Breakdown) ─── */}
        <Card className="border-white/10 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Why This Regime?
              <span className="text-xs font-normal text-white/40 ml-1">Indicators driving the classification</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.indicators ?? []).map((ind, i) => {
                  const indColor =
                    ind.signal === "Bullish" ? "#00FF88" :
                    ind.signal === "Bearish" ? "#EF4444" :
                    "#F59E0B";
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-white/8 bg-white/4 px-4 py-3 flex items-center gap-4"
                    >
                      <div className="flex items-center gap-1.5 w-44 flex-shrink-0">
                        <SignalDot signal={ind.signal} />
                        <span className="text-xs font-medium text-white/80">{ind.name}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/60">{ind.reading}</span>
                          <span className="text-xs font-mono" style={{ color: indColor }}>{ind.score}/100</span>
                        </div>
                        <ScoreBar value={ind.score} color={indColor} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ContributionPill level={ind.contribution} />
                        <span className="text-[10px] font-mono text-white/30">{ind.confidence}% conf.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Historical Context ─────────────────────── */}
        <Card className="border-white/10 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Clock className="w-4 h-4 text-amber-400" />
              Historical Context
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1">AVG DURATION</p>
                    <p className="text-lg font-bold text-amber-300">
                      {data?.historicalContext?.avgDurationWeeks ?? "—"} weeks
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1">PREVIOUS OCCURRENCE</p>
                    <p className="text-sm font-bold text-white/80">
                      {data?.historicalContext?.previousOccurrence ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1">BTC AVG RETURN</p>
                    <p className="text-sm font-bold text-green-400">
                      {data?.historicalContext?.btcAvgReturn ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1">ETH AVG RETURN</p>
                    <p className="text-sm font-bold text-blue-400">
                      {data?.historicalContext?.ethAvgReturn ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 col-span-2 p-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1">TYPICAL ALTCOIN BEHAVIOR</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {data?.historicalContext?.altcoinBehavior ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Transition Probabilities ───────────────── */}
        <Card className="border-white/10 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Activity className="w-4 h-4 text-purple-400" />
              Probability of Transition
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.transitionProbabilities ?? []).map((tp, i) => {
                  const isStay = tp.regime.startsWith("Remain");
                  const barColor =
                    isStay ? "#8B5CF6" :
                    tp.probability > 30 ? "#F59E0B" :
                    "#94A3B8";
                  return (
                    <div key={i} className="rounded-lg border border-white/8 bg-white/4 px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {isStay ? (
                            <span className="text-[9px] font-mono text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">CURRENT</span>
                          ) : (
                            <ArrowRight className="w-3 h-3 text-white/30" />
                          )}
                          <span className="text-sm font-medium text-white/80">{tp.regime}</span>
                        </div>
                        <span className="text-lg font-bold font-mono" style={{ color: barColor }}>
                          {tp.probability}%
                        </span>
                      </div>
                      <ProbBar probability={tp.probability} color={barColor} />
                      <p className="text-[10px] text-white/35 mt-1.5">{tp.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 5: Actionable Interpretation ──────────────── */}
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "#8B5CF640", background: "linear-gradient(135deg, #8B5CF608 0%, transparent 60%)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-white/40 mb-2 tracking-widest">ACTIONABLE INTERPRETATION</p>
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </>
              ) : (
                <blockquote className="text-sm text-white/80 leading-relaxed border-l-2 border-purple-500/50 pl-4 italic">
                  "{data?.actionableInterpretation ?? ""}"
                </blockquote>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 6: Cross-Market Comparison ────────────────── */}
        <Card className="border-white/10 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Cross-Market Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Side-by-side regime pills */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 p-3 text-center">
                    <p className="text-[10px] font-mono text-white/40 mb-1">STOCKS</p>
                    <p className="text-sm font-bold text-blue-300">{data?.stockRegimeLabel ?? "—"}</p>
                  </div>
                  <div
                    className="rounded-lg border p-3 text-center"
                    style={{ borderColor: `${regimeColor}30`, background: `${regimeColor}08` }}
                  >
                    <p className="text-[10px] font-mono text-white/40 mb-1">CRYPTO</p>
                    <p className="text-sm font-bold" style={{ color: regimeColor }}>{data?.regime ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                    <p className="text-[10px] font-mono text-white/40 mb-1">ALIGNMENT</p>
                    {data?.alignmentStatus && (
                      <AlignmentBadge status={data.alignmentStatus} score={data.alignmentScore ?? 50} />
                    )}
                  </div>
                </div>

                {/* Alignment score bar */}
                {data?.alignmentScore != null && (
                  <div className="rounded-lg border border-white/8 bg-white/4 px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/50">Alignment Score</span>
                      <span className="text-xs font-mono text-white/70">{data.alignmentScore}/100</span>
                    </div>
                    <ScoreBar
                      value={data.alignmentScore}
                      color={data.alignmentScore > 65 ? "#00FF88" : data.alignmentScore < 35 ? "#EF4444" : "#F59E0B"}
                    />
                  </div>
                )}

                {/* Historical interpretation */}
                {data?.crossMarketInterpretation && (
                  <div className="rounded-lg border border-white/8 bg-white/4 px-4 py-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1.5">HISTORICAL INTERPRETATION</p>
                    <p className="text-sm text-white/70 leading-relaxed">{data.crossMarketInterpretation}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Key Factors ───────────────────────────────────────── */}
        {!isLoading && (data?.keyFactors?.length ?? 0) > 0 && (
          <Card className="border-white/10 bg-white/3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Info className="w-4 h-4 text-cyan-400" />
                Key Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.keyFactors ?? []).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-white/65">
                    <span className="text-cyan-500 mt-0.5 flex-shrink-0">›</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Error state ───────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">Failed to load regime data. Please try refreshing.</p>
          </div>
        )}

        {/* ── Disclaimer ────────────────────────────────────────── */}
        <p className="text-[10px] text-white/20 text-center leading-relaxed pb-4">
          FAULTLINE Crypto Market Regime is derived from macro pressure indicators, not on-chain data.
          All classifications reflect current signal conditions and do not predict future outcomes.
          This is not financial advice.
        </p>
      </div>
    </div>
  );
}
