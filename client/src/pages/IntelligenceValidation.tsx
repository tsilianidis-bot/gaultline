/**
 * FAULTLINE — Intelligence Validation Center
 * client/src/pages/IntelligenceValidation.tsx
 *
 * Phase 7: 14-part institutional-grade analytics dashboard.
 * Measures, audits, and surfaces the accuracy and improvement
 * patterns of every FAULTLINE recommendation.
 *
 * Sections:
 *  1. Headline KPI Row (win rate, total, pending, avg return, avg time)
 *  2. 30-Day Trend vs Prior Period
 *  3. Accuracy by Asset Class
 *  4. Accuracy by Sector
 *  5. Accuracy by Recommendation Type
 *  6. Engine Scorecards (grade per intelligence engine)
 *  7. Confidence Calibration Chart
 *  8. Performance Over Time (weekly trend)
 *  9. Market Regime Analysis
 * 10. Symbol Leaderboard (best & worst)
 * 11. Improvement Lessons Feed
 * 12. Pattern Tag Frequency
 * 13. Weekly AI Improvement Reports
 * 14. Methodology & Disclaimer
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle, Clock, Target, BarChart3, Award, Zap, BookOpen, RefreshCw, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Helpers ───────────────────────────────────────────────────────────────────

function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-zinc-500 text-sm">N/A</span>;
  const color = rate >= 70 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={`font-mono font-bold text-2xl ${color}`}>{rate}%</span>;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    C: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    D: "bg-red-500/20 text-red-400 border-red-500/30",
    "N/A": "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded border font-bold text-sm ${colors[grade] ?? colors["N/A"]}`}>
      {grade}
    </span>
  );
}

function OutcomeBar({ correct, partial, incorrect, stillActive, total }: {
  correct: number; partial: number; incorrect: number; stillActive: number; total: number;
}) {
  if (total === 0) return <div className="h-2 bg-zinc-800 rounded-full" />;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {correct > 0 && <div className="bg-emerald-500" style={{ width: pct(correct) }} />}
      {partial > 0 && <div className="bg-amber-400" style={{ width: pct(partial) }} />}
      {stillActive > 0 && <div className="bg-blue-400" style={{ width: pct(stillActive) }} />}
      {incorrect > 0 && <div className="bg-red-500" style={{ width: pct(incorrect) }} />}
    </div>
  );
}

function TrendArrow({ trend }: { trend: number | null }) {
  if (trend === null) return <Minus className="w-4 h-4 text-zinc-500" />;
  if (trend > 0) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-zinc-500" />;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3.5 h-3.5 text-zinc-500 cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-violet-400" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntelligenceValidation() {
  const { user } = useAuth();
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  // Fetch all data in parallel
  const { data: stats, isLoading: statsLoading } = trpc.intelligenceValidation.validationStats.useQuery(undefined, { enabled: !!user });
  const { data: byAsset } = trpc.intelligenceValidation.breakdownByAssetClass.useQuery(undefined, { enabled: !!user });
  const { data: bySector } = trpc.intelligenceValidation.breakdownBySector.useQuery(undefined, { enabled: !!user });
  const { data: byType } = trpc.intelligenceValidation.breakdownByRecommendationType.useQuery(undefined, { enabled: !!user });
  const { data: engines } = trpc.intelligenceValidation.engineScorecards.useQuery(undefined, { enabled: !!user });
  const { data: calibration } = trpc.intelligenceValidation.confidenceCalibration.useQuery(undefined, { enabled: !!user });
  const { data: perfOverTime } = trpc.intelligenceValidation.performanceOverTime.useQuery({ weeks: 12 }, { enabled: !!user });
  const { data: regimeAnalysis } = trpc.intelligenceValidation.marketRegimeAnalysis.useQuery(undefined, { enabled: !!user });
  const { data: leaderboard } = trpc.intelligenceValidation.symbolLeaderboard.useQuery(undefined, { enabled: !!user });
  const { data: lessons } = trpc.intelligenceValidation.getImprovementLessons.useQuery({ limit: 20 }, { enabled: !!user });
  const { data: patternTags } = trpc.intelligenceValidation.getPatternTagFrequency.useQuery(undefined, { enabled: !!user });
  const { data: reports } = trpc.intelligenceValidation.getAiImprovementReports.useQuery({ limit: 8 }, { enabled: !!user });

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Brain className="w-12 h-12 text-violet-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-100 mb-2">Intelligence Validation Center</h2>
          <p className="text-zinc-400 text-sm mb-6">Sign in to access your recommendation accuracy analytics and self-improvement reports.</p>
          <a href={getLoginUrl()} className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            Sign In to Access
          </a>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Brain className="w-6 h-6 text-violet-400 animate-pulse" />
            <span className="text-zinc-400 text-sm">Loading Intelligence Validation Center…</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-zinc-900 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasData = (stats?.total ?? 0) > 0;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Brain className="w-6 h-6 text-violet-400" />
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Intelligence Validation Center</h1>
              <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">Phase 7</Badge>
            </div>
            <p className="text-sm text-zinc-500">Institutional-grade accuracy measurement, audit, and self-improvement analytics for every FAULTLINE recommendation.</p>
          </div>
        </div>

        {/* ── No Data State ────────────────────────────────────── */}
        {!hasData && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-8 text-center">
              <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-zinc-300 font-medium mb-2">No Recommendations Tracked Yet</h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                Start asking FAULTLINE questions about specific assets. Each recommendation is automatically logged to the Decision Ledger and tracked here once resolved.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Section 1: Headline KPIs ─────────────────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="Headline Metrics" subtitle="Overall recommendation accuracy across all resolved entries" icon={Target} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center">
                    Win Rate
                    <InfoTooltip text="Correct = 1pt, Partially Correct = 0.5pt, Incorrect = 0pt. Win rate = points / resolved entries." />
                  </div>
                  <WinRateBadge rate={stats?.winRate ?? null} />
                  {stats?.sampleSufficient === false && (
                    <div className="text-xs text-amber-500/70 mt-1">Low sample</div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 mb-1">Total Logged</div>
                  <div className="font-mono font-bold text-2xl text-zinc-100">{stats?.total ?? 0}</div>
                  <div className="text-xs text-zinc-600 mt-1">{stats?.resolved ?? 0} resolved · {stats?.pending ?? 0} pending</div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center">
                    Strict Accuracy
                    <InfoTooltip text="Strict accuracy counts only 'correct' outcomes, not partial." />
                  </div>
                  <WinRateBadge rate={stats?.strictAccuracy ?? null} />
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center">
                    Avg Return
                    <InfoTooltip text="Average % return for resolved entries with price data. Positive = recommendations moved in the right direction." />
                  </div>
                  <div className={`font-mono font-bold text-2xl ${(stats?.avgReturn ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {stats?.avgReturn !== null && stats?.avgReturn !== undefined ? `${stats.avgReturn > 0 ? "+" : ""}${stats.avgReturn}%` : "—"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 mb-1 flex items-center">
                    Avg Time to Resolve
                    <InfoTooltip text="Average hours from recommendation to resolution." />
                  </div>
                  <div className="font-mono font-bold text-2xl text-zinc-100">
                    {stats?.avgElapsedHours !== null && stats?.avgElapsedHours !== undefined ? `${stats.avgElapsedHours}h` : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ── Section 2: 30-Day Trend ──────────────────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="30-Day Trend" subtitle="Recent performance vs prior 30-day period" icon={TrendingUp} />
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Recent 30 Days</div>
                    <WinRateBadge rate={stats?.recentWinRate ?? null} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Prior 30 Days</div>
                    <WinRateBadge rate={stats?.priorWinRate ?? null} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1 flex items-center">
                      Trend
                      <InfoTooltip text="Positive = improving accuracy. Negative = declining accuracy." />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <TrendArrow trend={stats?.trend ?? null} />
                      <span className={`font-mono font-bold text-lg ${
                        (stats?.trend ?? 0) > 0 ? "text-emerald-400" : (stats?.trend ?? 0) < 0 ? "text-red-400" : "text-zinc-400"
                      }`}>
                        {stats?.trend !== null && stats?.trend !== undefined
                          ? `${stats.trend > 0 ? "+" : ""}${stats.trend}pp`
                          : "—"}
                      </span>
                      {stats?.trendLabel && (
                        <Badge variant="outline" className={`text-xs capitalize ${
                          stats.trendLabel === "improving" ? "border-emerald-500/30 text-emerald-400" :
                          stats.trendLabel === "declining" ? "border-red-500/30 text-red-400" :
                          "border-zinc-700 text-zinc-500"
                        }`}>
                          {stats.trendLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Sections 3–5: Breakdown tabs ────────────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="Accuracy Breakdowns" subtitle="Performance segmented by asset class, sector, and recommendation type" icon={BarChart3} />
            <Tabs defaultValue="asset">
              <TabsList className="bg-zinc-900 border border-zinc-800 mb-4">
                <TabsTrigger value="asset" className="text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">By Asset Class</TabsTrigger>
                <TabsTrigger value="sector" className="text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">By Sector</TabsTrigger>
                <TabsTrigger value="type" className="text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">By Rec. Type</TabsTrigger>
              </TabsList>

              <TabsContent value="asset">
                <div className="space-y-3">
                  {(byAsset ?? []).map(row => (
                    <Card key={row.assetClass} className="bg-zinc-900/60 border-zinc-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-200 capitalize">{row.assetClass}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500">{row.resolved}/{row.total} resolved</span>
                            <WinRateBadge rate={row.winRate} />
                          </div>
                        </div>
                        <OutcomeBar correct={row.correct} partial={row.partial} incorrect={row.incorrect} stillActive={row.stillActive} total={row.total} />
                        <div className="flex gap-4 mt-2 text-xs text-zinc-600">
                          <span className="text-emerald-500">✓ {row.correct}</span>
                          <span className="text-amber-400">~ {row.partial}</span>
                          <span className="text-blue-400">⟳ {row.stillActive}</span>
                          <span className="text-red-500">✗ {row.incorrect}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!byAsset || byAsset.length === 0) && <p className="text-zinc-500 text-sm text-center py-4">No data yet</p>}
                </div>
              </TabsContent>

              <TabsContent value="sector">
                <div className="space-y-3">
                  {(bySector ?? []).slice(0, 12).map(row => (
                    <Card key={row.sector} className="bg-zinc-900/60 border-zinc-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-200">{row.sector}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500">{row.resolved}/{row.total}</span>
                            <WinRateBadge rate={row.winRate} />
                          </div>
                        </div>
                        <OutcomeBar correct={row.correct} partial={row.partial} incorrect={row.incorrect} stillActive={row.stillActive} total={row.total} />
                      </CardContent>
                    </Card>
                  ))}
                  {(!bySector || bySector.length === 0) && <p className="text-zinc-500 text-sm text-center py-4">No sector data yet. Sector classification requires enriched ledger entries.</p>}
                </div>
              </TabsContent>

              <TabsContent value="type">
                <div className="space-y-3">
                  {(byType ?? []).slice(0, 12).map(row => (
                    <Card key={row.recommendationType} className="bg-zinc-900/60 border-zinc-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-zinc-200">{row.recommendationType}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500">{row.resolved}/{row.total}</span>
                            <WinRateBadge rate={row.winRate} />
                          </div>
                        </div>
                        <OutcomeBar correct={row.correct} partial={row.partial} incorrect={row.incorrect} stillActive={row.stillActive} total={row.total} />
                      </CardContent>
                    </Card>
                  ))}
                  {(!byType || byType.length === 0) && <p className="text-zinc-500 text-sm text-center py-4">No data yet</p>}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        )}

        {/* ── Section 6: Engine Scorecards ─────────────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="Engine Scorecards" subtitle="Accuracy grade per intelligence engine" icon={Zap} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(engines ?? []).map(eng => (
                <Card key={eng.engine} className="bg-zinc-900/60 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-200">{eng.engine}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{eng.total} total · {eng.resolved} resolved</div>
                      </div>
                      <GradeBadge grade={eng.grade} />
                    </div>
                    <OutcomeBar correct={eng.correct} partial={eng.partial} incorrect={eng.incorrect} stillActive={eng.stillActive} total={eng.total} />
                    <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                      <span>Win Rate: <span className={eng.winRate !== null && eng.winRate >= 60 ? "text-emerald-400" : "text-amber-400"}>{eng.winRate !== null ? `${eng.winRate}%` : "N/A"}</span></span>
                      {eng.avgConfidence !== null && <span>Avg Conf: {eng.avgConfidence}%</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!engines || engines.length === 0) && (
                <div className="col-span-3 text-zinc-500 text-sm text-center py-4">No engine data yet</div>
              )}
            </div>
          </section>
        )}

        {/* ── Section 7: Confidence Calibration ───────────────── */}
        {hasData && (
          <section>
            <SectionHeader
              title="Confidence Calibration"
              subtitle="Is FAULTLINE's stated confidence aligned with actual accuracy? Well-calibrated = within ±10pp of stated confidence."
              icon={Target}
            />
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {(calibration ?? []).map(band => (
                    <div key={band.band} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-zinc-400 font-mono flex-shrink-0">{band.band}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-500">{band.total} entries</span>
                          <div className="flex items-center gap-2">
                            {band.isCalibrated !== null && (
                              band.isCalibrated
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                : <XCircle className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <span className={`text-xs font-mono ${
                              band.winRate !== null && band.winRate >= band.midpoint - 10 && band.winRate <= band.midpoint + 10
                                ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {band.winRate !== null ? `${band.winRate}% actual` : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          {band.winRate !== null && (
                            <div
                              className={`h-full rounded-full ${band.isCalibrated ? "bg-emerald-500" : "bg-amber-500"}`}
                              style={{ width: `${band.winRate}%` }}
                            />
                          )}
                        </div>
                        {band.calibrationDelta !== null && (
                          <div className="text-xs text-zinc-600 mt-0.5">
                            {band.calibrationDelta > 0 ? "+" : ""}{Math.round(band.calibrationDelta)}pp vs stated midpoint ({band.midpoint}%)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!calibration || calibration.every(b => b.total === 0)) && (
                    <p className="text-zinc-500 text-sm text-center py-4">No resolved entries yet for calibration analysis</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Section 8: Performance Over Time ────────────────── */}
        {hasData && (perfOverTime ?? []).length > 0 && (
          <section>
            <SectionHeader title="Performance Over Time" subtitle="Weekly win rate trend (last 12 weeks)" icon={TrendingUp} />
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {(perfOverTime ?? []).map(week => (
                    <div key={week.week} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-zinc-500 font-mono flex-shrink-0">{week.week}</div>
                      <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                        {week.winRate !== null && (
                          <div
                            className={`h-full rounded ${week.winRate >= 70 ? "bg-emerald-500" : week.winRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${week.winRate}%` }}
                          />
                        )}
                      </div>
                      <div className="w-16 text-right">
                        <WinRateBadge rate={week.winRate} />
                      </div>
                      <div className="w-12 text-xs text-zinc-600">{week.resolved}r</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Section 9: Market Regime Analysis ───────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="Market Regime Analysis" subtitle="Accuracy by stock, crypto, and macro regime at time of recommendation" icon={BarChart3} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(regimeAnalysis ?? []).slice(0, 12).map(row => {
                const regimeType = (row as typeof row & { regimeType?: string }).regimeType ?? "macro";
                const badgeColor = regimeType === "stock" ? "text-blue-400 border-blue-800 bg-blue-950/40" : regimeType === "crypto" ? "text-amber-400 border-amber-800 bg-amber-950/40" : "text-zinc-400 border-zinc-700 bg-zinc-900/40";
                return (
                  <Card key={row.regime} className="bg-zinc-900/60 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColor} shrink-0`}>{regimeType}</span>
                          <span className="text-sm font-medium text-zinc-200 truncate">{row.regime.replace(/^(Stock|Crypto|Macro): /, "")}</span>
                        </div>
                        <WinRateBadge rate={row.winRate} />
                      </div>
                      <OutcomeBar correct={row.correct} partial={row.partial} incorrect={row.incorrect} stillActive={row.stillActive} total={row.total} />
                      <div className="text-xs text-zinc-600 mt-1">{row.resolved} resolved of {row.total}</div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!regimeAnalysis || regimeAnalysis.length === 0) && (
                <div className="col-span-2 text-zinc-500 text-sm text-center py-4">No regime data yet. Log recommendations via Ask Intelligence to populate regime analysis.</div>
              )}
            </div>
          </section>
        )}

        {/* ── Section 10: Symbol Leaderboard ──────────────────── */}
        {hasData && (
          <section>
            <SectionHeader title="Symbol Leaderboard" subtitle="Best and worst predicted assets (min. 3 resolved entries)" icon={Award} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Best Predicted
                </h3>
                <div className="space-y-2">
                  {(leaderboard?.best ?? []).slice(0, 5).map((s, i) => (
                    <div key={s.ticker} className="flex items-center gap-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                      <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                      <span className="font-mono text-sm font-bold text-zinc-100 w-16">{s.ticker}</span>
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{s.assetType ?? "?"}</Badge>
                      <div className="flex-1">
                        <OutcomeBar correct={s.correct} partial={s.partial} incorrect={s.incorrect} stillActive={s.stillActive} total={s.total} />
                      </div>
                      <WinRateBadge rate={s.winRate} />
                    </div>
                  ))}
                  {(!leaderboard?.best || leaderboard.best.length === 0) && (
                    <p className="text-zinc-500 text-sm text-center py-4">Need ≥3 resolved entries per symbol</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5" /> Needs Improvement
                </h3>
                <div className="space-y-2">
                  {(leaderboard?.worst ?? []).slice(0, 5).map((s, i) => (
                    <div key={s.ticker} className="flex items-center gap-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                      <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                      <span className="font-mono text-sm font-bold text-zinc-100 w-16">{s.ticker}</span>
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">{s.assetType ?? "?"}</Badge>
                      <div className="flex-1">
                        <OutcomeBar correct={s.correct} partial={s.partial} incorrect={s.incorrect} stillActive={s.stillActive} total={s.total} />
                      </div>
                      <WinRateBadge rate={s.winRate} />
                    </div>
                  ))}
                  {(!leaderboard?.worst || leaderboard.worst.length === 0) && (
                    <p className="text-zinc-500 text-sm text-center py-4">Need ≥3 resolved entries per symbol</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Section 11: Improvement Lessons Feed ────────────── */}
        <section>
          <SectionHeader title="Improvement Lessons" subtitle="AI-extracted lessons from each resolved recommendation" icon={BookOpen} />
          <div className="space-y-3">
            {(lessons ?? []).length > 0 ? (lessons ?? []).map((lesson, i) => (
              <Card key={lesson.id} className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {lesson.patternTag && (
                          <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
                            {lesson.patternTag}
                          </Badge>
                        )}
                        {lesson.ticker && (
                          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 font-mono">
                            {lesson.ticker}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${
                          lesson.outcome === "correct" ? "border-emerald-500/30 text-emerald-400" :
                          lesson.outcome === "incorrect" ? "border-red-500/30 text-red-400" :
                          "border-amber-500/30 text-amber-400"
                        }`}>
                          {lesson.outcome?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className={`text-sm text-zinc-300 leading-relaxed ${expandedLesson === i ? "" : "line-clamp-2"}`}>
                        {lesson.lessonText}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedLesson(expandedLesson === i ? null : i)}
                      className="text-zinc-600 hover:text-zinc-400 flex-shrink-0 mt-1"
                    >
                      {expandedLesson === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {expandedLesson === i && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500 flex gap-4 flex-wrap">
                      {lesson.engineSource && <span>Engine: {lesson.engineSource}</span>}
                      {lesson.regimeAtTime && <span>Regime: {lesson.regimeAtTime}</span>}
                      {lesson.confidence !== null && <span>Confidence: {lesson.confidence}%</span>}
                      <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Lessons are automatically extracted after each recommendation is resolved by the evaluation engine.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ── Section 12: Pattern Tag Frequency ───────────────── */}
        {(patternTags ?? []).length > 0 && (
          <section>
            <SectionHeader title="Recurring Patterns" subtitle="Most frequent lesson patterns identified across all recommendations" icon={RefreshCw} />
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {(patternTags ?? []).map(tag => (
                    <div key={tag.tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 rounded-full border border-zinc-700">
                      <span className="text-xs text-zinc-300">{tag.tag}</span>
                      <span className="text-xs font-mono font-bold text-violet-400">{tag.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Section 13: Weekly AI Improvement Reports ───────── */}
        <section>
          <SectionHeader title="Weekly AI Improvement Reports" subtitle="LLM-synthesized weekly performance analysis and recommendations" icon={Brain} />
          <div className="space-y-3">
            {(reports ?? []).length > 0 ? (reports ?? []).map((report, i) => (
              <Card key={report.id} className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-zinc-200">{report.weekOf}</span>
                      {report.accuracyRate !== null && (
                        <Badge variant="outline" className={`text-xs ${
                          (report.accuracyRate ?? 0) >= 70 ? "border-emerald-500/30 text-emerald-400" :
                          (report.accuracyRate ?? 0) >= 50 ? "border-amber-500/30 text-amber-400" :
                          "border-red-500/30 text-red-400"
                        }`}>
                          {report.accuracyRate}% accuracy
                        </Badge>
                      )}
                      <span className="text-xs text-zinc-600">{report.totalAnalyzed} analyzed</span>
                    </div>
                    <button
                      onClick={() => setExpandedReport(expandedReport === i ? null : i)}
                      className="text-zinc-600 hover:text-zinc-400"
                    >
                      {expandedReport === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {expandedReport === i && report.reportText && (
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 text-sm leading-relaxed border-t border-zinc-800 pt-3">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 bg-transparent p-0">{report.reportText}</pre>
                    </div>
                  )}
                  {expandedReport !== i && (
                    <p className="text-xs text-zinc-500 line-clamp-2">{report.reportText?.split("\n").find(l => l.trim() && !l.startsWith("#")) ?? "Click to expand"}</p>
                  )}
                </CardContent>
              </Card>
            )) : (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardContent className="p-6 text-center">
                  <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Weekly AI improvement reports are generated every Monday at 06:00 UTC after the site is deployed.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ── Section 14: Methodology & Disclaimer ────────────── */}
        <section>
          <SectionHeader title="Methodology & Disclaimer" subtitle="How accuracy is measured and what these metrics mean" icon={Info} />
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-4 space-y-3 text-xs text-zinc-500 leading-relaxed">
              <p><span className="text-zinc-300 font-medium">Win Rate:</span> Correct outcomes score 1 point, Partially Correct score 0.5 points, Incorrect and Still Active score 0 points. Win Rate = total points / resolved entries × 100.</p>
              <p><span className="text-zinc-300 font-medium">Conservative Scoring:</span> Auto-evaluation only marks "Correct" if price moved ≥60% toward the target. "Incorrect" requires ≥50% adverse move. Ambiguous outcomes are marked "Still Active" for manual review.</p>
              <p><span className="text-zinc-300 font-medium">Confidence Calibration:</span> A well-calibrated system at 80% stated confidence should achieve ~80% actual accuracy. Deviations beyond ±10pp indicate systematic over- or under-confidence.</p>
              <p><span className="text-zinc-300 font-medium">Sample Size:</span> Metrics with fewer than 10 resolved entries are flagged as low-sample and should be interpreted with caution.</p>
              <p><span className="text-zinc-300 font-medium">Not Financial Advice:</span> All recommendations and accuracy metrics are for informational and research purposes only. Past accuracy does not guarantee future performance. FAULTLINE is an intelligence tool, not a financial advisor.</p>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
