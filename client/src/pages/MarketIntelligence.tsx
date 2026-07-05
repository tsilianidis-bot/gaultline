/**
 * Market Intelligence Dashboard
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, ArrowRight, BarChart3, Bitcoin, Activity,
  Shield, Zap, Info, ChevronRight, Clock, Eye, Bell
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "Improving")     return <TrendingUp   className="w-4 h-4 text-green-400" />;
  if (trend === "Deteriorating") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    "Low":      "bg-green-500/20 text-green-300 border-green-500/30",
    "Moderate": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "Elevated": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "High":     "bg-red-500/20 text-red-300 border-red-500/30",
    "Critical": "bg-red-700/30 text-red-200 border-red-600/50",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-semibold border", colors[level] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30")}>
      {level}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "#00FF88" : value >= 50 ? "#FACC15" : "#FB923C";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-white/60 w-8 text-right">{value}%</span>
    </div>
  );
}

function AlignmentBanner({ status, score }: { status: string; score: number }) {
  const isRiskOn  = status.includes("Risk On");
  const isRiskOff = status.includes("Risk Off");
  const isDiverge = status.includes("Diverging");
  const cls = isRiskOn && status.includes("Strongly") ? "bg-green-500/20 border-green-500/40 text-green-300"
    : isRiskOn  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
    : isRiskOff && status.includes("Strongly") ? "bg-red-600/25 border-red-600/40 text-red-200"
    : isRiskOff ? "bg-red-500/15 border-red-500/30 text-red-300"
    : isDiverge ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
    : "bg-slate-500/15 border-slate-500/30 text-slate-300";
  const Icon = isRiskOn ? CheckCircle : isRiskOff ? XCircle : isDiverge ? AlertTriangle : Minus;
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium", cls)}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{status}</span>
      <span className="ml-auto font-mono text-xs opacity-70">Alignment Score: {score}/100</span>
    </div>
  );
}

function RegimeCard({ title, icon: Icon, regime, riskLevel, trend, confidence, explanation, keyFactors, strategy, color, isLoading }: {
  title: string; icon: React.ElementType; regime: string; riskLevel: string;
  trend: string; confidence: number; explanation: string; keyFactors: string[];
  strategy: string; color: string; isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="bg-black/40 border-white/10 animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-4 bg-white/10 rounded w-32 mb-2" />
          <div className="h-6 bg-white/10 rounded w-48" />
        </CardHeader>
        <CardContent><div className="space-y-2"><div className="h-3 bg-white/10 rounded w-full" /><div className="h-3 bg-white/10 rounded w-4/5" /></div></CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-black/40 border-white/10 hover:border-white/20 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5" />{title}
          </div>
          <div className="flex items-center gap-2"><TrendIcon trend={trend} /><RiskBadge level={riskLevel} /></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
          <CardTitle className="text-lg font-bold text-white leading-tight">{regime}</CardTitle>
        </div>
        <ConfidenceBar value={confidence} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/70 leading-relaxed">{explanation}</p>
        <Separator className="bg-white/10" />
        <div>
          <p className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">Key Factors</p>
          <ul className="space-y-1.5">
            {keyFactors.slice(0, 4).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-white/30" />{f}
              </li>
            ))}
          </ul>
        </div>
        <Separator className="bg-white/10" />
        <div>
          <p className="text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Strategy</p>
          <p className="text-xs text-white/70 leading-relaxed">{strategy}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetBadge({ asset }: { asset: string }) {
  const isStock  = asset === "Stock";
  const isCrypto = asset === "Crypto";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold border",
      isStock  ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
      isCrypto ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                 "bg-slate-500/20 text-slate-300 border-slate-500/30"
    )}>
      {isStock ? <BarChart3 className="w-3 h-3" /> : isCrypto ? <Bitcoin className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
      {asset}
    </span>
  );
}

export default function MarketIntelligence() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = trpc.marketIntelligence.getAll.useQuery(
    undefined,
    { refetchInterval: 10 * 60 * 1000 }
  );
  const { data: persistedAlerts, isLoading: alertsLoading } = trpc.marketIntelligence.getRecentAlerts.useQuery(
    { limit: 10 },
    { refetchInterval: 5 * 60 * 1000 }
  );
  const clearCache = trpc.marketIntelligence.clearCache.useMutation({ onSuccess: () => refetch() });

  const stock  = data?.stockRegime;
  const crypto = data?.cryptoRegime;
  const alerts = data?.regimeChangeAlerts ?? [];

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Activity className="w-4 h-4 text-[#00FF88]" />
              <h1 className="text-lg font-bold tracking-tight">Market Intelligence</h1>
            </div>
            <p className="text-xs text-white/40 font-mono">Stock Regime · Crypto Regime · Cross-Market Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            {data?.fetchedAt && (
              <span className="text-xs text-white/30 font-mono hidden sm:flex items-center gap-1">
                <Clock className="w-3 h-3" />{new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            {user && (
              <Button variant="outline" size="sm" onClick={() => clearCache.mutate()}
                disabled={clearCache.isPending || isFetching}
                className="h-7 px-2 text-xs border-white/20 bg-transparent hover:bg-white/10">
                <RefreshCw className={cn("w-3 h-3", (clearCache.isPending || isFetching) && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Failed to load market intelligence data.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto h-7 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10">Retry</Button>
          </div>
        )}

        {/* Regime Change Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">{alert.asset} Regime Change</span>
                  <p className="text-amber-200/70 text-xs mt-0.5">{alert.message}</p>
                </div>
                <span className="ml-auto text-xs text-amber-400/50 font-mono flex-shrink-0">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Alignment Banner */}
        {isLoading ? (
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ) : data ? (
          <AlignmentBanner status={data.alignmentStatus} score={data.alignmentScore} />
        ) : null}

        {/* Two Regime Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RegimeCard title="US Stock Market" icon={BarChart3}
            regime={stock?.regime ?? "—"} riskLevel={stock?.riskLevel ?? "Moderate"}
            trend={stock?.trend ?? "Stable"} confidence={stock?.confidence ?? 0}
            explanation={stock?.explanation ?? ""} keyFactors={stock?.keyFactors ?? []}
            strategy={stock?.strategy ?? ""} color={stock?.color ?? "#94A3B8"} isLoading={isLoading} />
          <RegimeCard title="Crypto Market" icon={Bitcoin}
            regime={crypto?.regime ?? "—"} riskLevel={crypto?.riskLevel ?? "Moderate"}
            trend={crypto?.trend ?? "Stable"} confidence={crypto?.confidence ?? 0}
            explanation={crypto?.explanation ?? ""} keyFactors={crypto?.keyFactors ?? []}
            strategy={crypto?.strategy ?? ""} color={crypto?.color ?? "#94A3B8"} isLoading={isLoading} />
        </div>

        {/* Plain English Summary */}
        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
              <Info className="w-3.5 h-3.5" />Plain English Summary
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-full" /><div className="h-4 bg-white/10 rounded w-4/5" /><div className="h-4 bg-white/10 rounded w-3/5" />
              </div>
            ) : <p className="text-sm text-white/80 leading-relaxed">{data?.plainEnglishSummary}</p>}
          </CardContent>
        </Card>

        {/* Key Insights + Forward Bias */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="bg-black/40 border-white/10 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />Key Insights
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />)}</div>
                ) : (
                  <ul className="space-y-3">
                    {(data?.keyInsights ?? []).map((insight, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <ArrowRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#00FF88]" />
                        <span className="text-sm text-white/75 leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <div>
            <Card className="bg-black/40 border-white/10 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" />Forward Bias
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="h-20 bg-white/5 rounded animate-pulse" /> : (
                  <div className="space-y-4">
                    <p className="text-sm text-white/80 leading-relaxed">{data?.forwardBias}</p>
                    {stock && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-white/40">
                          <span>Pressure Index</span>
                          <span className="font-mono">{Math.round(stock.pressureScore)}/100</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${stock.pressureScore}%`,
                            backgroundColor: stock.pressureScore >= 70 ? "#EF4444" : stock.pressureScore >= 50 ? "#F97316" : stock.pressureScore >= 35 ? "#FACC15" : "#00FF88"
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* BTC Accumulation Analysis (conditional) */}
        {crypto?.accumulationAnalysis && (
          <Card className="bg-black/40 border-purple-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-purple-400/70 text-xs font-mono uppercase tracking-wider">
                <Bitcoin className="w-3.5 h-3.5" />Bitcoin Accumulation Phase Analysis
              </div>
              <CardTitle className="text-base font-bold text-purple-200">{crypto.accumulationAnalysis.directAnswer}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-purple-300/70">{crypto.accumulationAnalysis.confidenceLabel}</span>
                <ConfidenceBar value={crypto.accumulationAnalysis.confidenceLevel} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-mono text-amber-400/70 uppercase tracking-wider mb-2">Key Evidence</p>
                  <ul className="space-y-1.5">
                    {crypto.accumulationAnalysis.keyEvidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-200/70">
                        <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500/50" />{e}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-mono text-green-400/70 uppercase tracking-wider mb-2">Bull Cycle Confirmation</p>
                  <ul className="space-y-1.5">
                    {crypto.accumulationAnalysis.bullCycleConfirmation.map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-green-200/70">
                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-500/50" />{e}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-mono text-red-400/70 uppercase tracking-wider mb-2">Invalidation Signals</p>
                  <ul className="space-y-1.5">
                    {crypto.accumulationAnalysis.invalidationSignals.map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-red-200/70">
                        <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-500/50" />{e}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Separator className="bg-purple-500/20 my-3" />
              <div className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-purple-400/70 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-200/70">{crypto.accumulationAnalysis.tradingBias}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Regime Change Alerts — persisted from DB */}
        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
                <Bell className="w-3.5 h-3.5" />Recent Regime Change Alerts
              </div>
              {persistedAlerts && persistedAlerts.length > 0 && (
                <span className="text-xs text-white/30 font-mono">{persistedAlerts.length} alert{persistedAlerts.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />)}
              </div>
            ) : !persistedAlerts || persistedAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-400/40 mb-3" />
                <p className="text-sm text-white/40">No regime changes detected recently.</p>
                <p className="text-xs text-white/25 mt-1">Alerts appear here when market regimes shift.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {persistedAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-white/10 bg-white/3 overflow-hidden">
                    {/* Alert header */}
                    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/8">
                      <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <AssetBadge asset={alert.asset} />
                          <span className="text-xs text-white/40 font-mono">{alert.previous}</span>
                          <ArrowRight className="w-3 h-3 text-white/30" />
                          <span className="text-xs text-amber-300 font-mono font-semibold">{alert.current}</span>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">{alert.message}</p>
                      </div>
                      <span className="text-xs text-white/25 font-mono flex-shrink-0 mt-0.5">
                        {new Date(Number(alert.detectedAt)).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {/* Why it matters */}
                    {alert.whyItMatters && (
                      <div className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/10">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-mono text-amber-400/70 uppercase tracking-wider mb-0.5">Why It Matters</p>
                          <p className="text-xs text-amber-200/70 leading-relaxed">{alert.whyItMatters}</p>
                        </div>
                      </div>
                    )}
                    {/* What to watch next */}
                    {alert.whatToWatchNext && (
                      <div className="flex items-start gap-2.5 px-4 py-2.5 bg-blue-500/5">
                        <Eye className="w-3.5 h-3.5 text-blue-400/70 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-mono text-blue-400/70 uppercase tracking-wider mb-0.5">What to Watch Next</p>
                          <p className="text-xs text-blue-200/70 leading-relaxed">{alert.whatToWatchNext}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-white/20 font-mono pb-4">
          Data refreshes every 10 minutes · FAULTLINE Market Intelligence Engine v1.0
        </div>
      </div>
    </div>
  );
}
