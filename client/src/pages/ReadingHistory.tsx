/**
 * FAULTLINE Reading History
 *
 * Shows daily reading snapshots across Today / This Week / This Month / This Year
 * and the Outcome Support Engine (scenario support scoring).
 *
 * Rules:
 * - No buy/sell/hold language
 * - No predictions
 * - Scenario-based language only
 * - Data clearly labelled: live | fallback | stale | demo
 * - All disclaimers present
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { PreflightTrigger } from "@/components/MarketPreflight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEngine } from "@/contexts/EngineContext";
import {
  TrendingUp, TrendingDown, Minus, Info, AlertCircle,
  Calendar, BarChart2, Target, Eye, ChevronDown, ChevronUp,
  RefreshCw,
} from "lucide-react";

// ── Types (mirrors server/readingHistory.ts) ───────────────────────────────────

interface ScenarioSupport {
  scenario: string;
  label: string;
  supportScore: number;
  confidence: "Low" | "Moderate" | "Elevated" | "High";
  supportingEvidence: string[];
  weakeningEvidence: string[];
  confirmationSignals: string[];
  invalidatingSignals: string[];
  watchNext: string[];
}

interface TimeframeReading {
  timeframe: string;
  label: string;
  available: boolean;
  scoreStart: number | null;
  scoreEnd: number | null;
  scoreDelta: number | null;
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  directionLabel: string;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  regimeChanges: string[];
  mainDriver: string | null;
  mostSupportedScenario: string | null;
  watchNext: string[];
  dataNote: string | null;
  snapshots: Array<{
    readingDate: string;
    faultlineScore: number;
    stressLevel: string;
    regime: string;
    pressureDrivers: Array<{ name: string; score: number; trend: string }>;
    activeAlerts: Array<{ level: string; message: string }>;
    dataStatus: { source: string; label: string; note?: string };
    scenarioSupport: ScenarioSupport[];
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function directionIcon(direction: string) {
  if (direction === "improving") return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  if (direction === "deteriorating") return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (direction === "stable") return <Minus className="w-4 h-4 text-yellow-400" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function directionColor(direction: string) {
  if (direction === "improving") return "text-emerald-400";
  if (direction === "deteriorating") return "text-red-400";
  if (direction === "stable") return "text-yellow-400";
  return "text-muted-foreground";
}

function stressLevelColor(level: string) {
  const l = level.toLowerCase();
  if (l === "critical") return "text-red-400 border-red-400/30 bg-red-400/10";
  if (l === "high") return "text-orange-400 border-orange-400/30 bg-orange-400/10";
  if (l === "elevated") return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
  if (l === "moderate") return "text-blue-400 border-blue-400/30 bg-blue-400/10";
  return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
}

function confidenceColor(confidence: string) {
  if (confidence === "High") return "text-red-400";
  if (confidence === "Elevated") return "text-orange-400";
  if (confidence === "Moderate") return "text-yellow-400";
  return "text-muted-foreground";
}

function scoreBar(score: number) {
  const color = score >= 65 ? "bg-red-500" : score >= 45 ? "bg-orange-500" : score >= 25 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DataNote({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 text-xs text-yellow-300/80">
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{note}</span>
    </div>
  );
}

function ScenarioCard({ scenario, isTop }: { scenario: ScenarioSupport; isTop: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={`border ${isTop ? "border-primary/30 bg-primary/5" : "border-border/50"}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">{scenario.label}</span>
            {isTop && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary shrink-0">Most Supported</Badge>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-mono ${confidenceColor(scenario.confidence)}`}>{scenario.confidence}</span>
            <span className="text-sm font-semibold tabular-nums">{scenario.supportScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="mt-2">{scoreBar(scenario.supportScore)}</div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {scenario.supportingEvidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Supporting</p>
            {scenario.supportingEvidence.map((e, i) => (
              <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5">+</span>{e}
              </p>
            ))}
          </div>
        )}
        {scenario.weakeningEvidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Weakening</p>
            {scenario.weakeningEvidence.map((e, i) => (
              <p key={i} className="text-xs text-foreground/60 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5">−</span>{e}
              </p>
            ))}
          </div>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide signals" : "Show confirmation & invalidating signals"}
        </button>
        {expanded && (
          <div className="space-y-2 pt-1 border-t border-border/30">
            {scenario.confirmationSignals.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirmation signals</p>
                {scenario.confirmationSignals.map((s, i) => (
                  <p key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <span className="text-blue-400 mt-0.5">→</span>{s}
                  </p>
                ))}
              </div>
            )}
            {scenario.invalidatingSignals.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invalidating signals</p>
                {scenario.invalidatingSignals.map((s, i) => (
                  <p key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <span className="text-orange-400 mt-0.5">✕</span>{s}
                  </p>
                ))}
              </div>
            )}
            {scenario.watchNext.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Watch next</p>
                {scenario.watchNext.map((s, i) => (
                  <p key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <Eye className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />{s}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimeframePanel({ timeframe }: { timeframe: "today" | "week" | "month" | "year" }) {
  const { data, isLoading, error } = trpc.readingHistory.getTimeframeAnalysis.useQuery({ timeframe });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load timeframe data. Please try again.
      </div>
    );
  }

  const reading = data as TimeframeReading;
  const latestSnapshot = reading.snapshots[reading.snapshots.length - 1] ?? reading.snapshots[0];
  const topScenario = latestSnapshot?.scenarioSupport?.sort((a, b) => b.supportScore - a.supportScore)[0];
  const allScenarios = latestSnapshot?.scenarioSupport?.sort((a, b) => b.supportScore - a.supportScore) ?? [];

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {timeframe === "today" ? "Current Score" : "Score Change"}
            </p>
            {reading.available ? (
              <div className="flex items-center gap-2">
                {timeframe !== "today" && directionIcon(reading.direction)}
                <span className={`text-2xl font-bold tabular-nums ${directionColor(reading.direction)}`}>
                  {timeframe === "today"
                    ? reading.scoreEnd ?? "—"
                    : reading.scoreDelta !== null
                      ? `${reading.scoreDelta > 0 ? "+" : ""}${reading.scoreDelta}`
                      : "—"}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">No data</span>
            )}
            {reading.available && timeframe !== "today" && (
              <p className={`text-xs mt-0.5 ${directionColor(reading.direction)}`}>{reading.directionLabel}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {timeframe === "today" ? "Stress Level" : "Average Score"}
            </p>
            {reading.available ? (
              timeframe === "today" && latestSnapshot ? (
                <Badge variant="outline" className={`text-xs ${stressLevelColor(latestSnapshot.stressLevel)}`}>
                  {latestSnapshot.stressLevel}
                </Badge>
              ) : (
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {reading.averageScore ?? "—"}
                </span>
              )
            ) : (
              <span className="text-muted-foreground text-sm">No data</span>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Main Driver</p>
            {reading.available && reading.mainDriver ? (
              <p className="text-sm font-medium text-foreground leading-tight">{reading.mainDriver}</p>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Most Supported Scenario</p>
            {reading.available && reading.mostSupportedScenario ? (
              <p className="text-sm font-medium text-foreground leading-tight">{reading.mostSupportedScenario}</p>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data note */}
      {reading.dataNote && <DataNote note={reading.dataNote} />}

      {/* Regime changes */}
      {reading.regimeChanges.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Regime Changes This Period
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {reading.regimeChanges.map((change, i) => (
              <p key={i} className="text-xs text-foreground/80 font-mono">{change}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Watch next */}
      {reading.watchNext.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              What to Watch Next
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {reading.watchNext.map((item, i) => (
              <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                <span className="text-primary mt-0.5">→</span>{item}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scenario support */}
      {allScenarios.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Scenario Support</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Scenario support scores reflect how current FAULTLINE readings align with each possible market scenario. Higher scores indicate stronger alignment with available data. This is not a prediction.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allScenarios.map((s, i) => (
              <ScenarioCard key={s.scenario} scenario={s} isTop={i === 0} />
            ))}
          </div>
        </div>
      )}

      {/* Snapshot history table (week/month/year) */}
      {timeframe !== "today" && reading.snapshots.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Daily Readings ({reading.snapshots.length} day{reading.snapshots.length !== 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {reading.snapshots.slice().reverse().map(snap => (
                <div key={snap.readingDate} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground font-mono w-24 shrink-0">{snap.readingDate}</span>
                  <div className="flex-1 min-w-0">
                    {scoreBar(snap.faultlineScore)}
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-8 text-right">{snap.faultlineScore}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${stressLevelColor(snap.stressLevel)}`}>
                    {snap.stressLevel}
                  </Badge>
                  {snap.dataStatus.source !== "live" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        {snap.dataStatus.label}{snap.dataStatus.note ? ` — ${snap.dataStatus.note}` : ""}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!reading.available && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center space-y-2">
            <BarChart2 className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">No reading history yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Reading history builds automatically as daily snapshots are generated. Check back after the first snapshot is created.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Reading history reflects FAULTLINE platform data and calculations only. It does not constitute investment advice, predict future market conditions, or guarantee any outcome. Past readings do not indicate future results.
      </p>
    </div>
  );
}

function OutcomeSupportPanel() {
  const { data, isLoading, error, refetch, isFetching } = trpc.readingHistory.getOutcomeSupport.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load outcome support data. Please try again.
      </div>
    );
  }

  const result = data as { scenarios: ScenarioSupport[]; generatedAt: string; dataSource: string; disclaimer: string };
  const sorted = [...result.scenarios].sort((a, b) => b.supportScore - a.supportScore);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Outcome Support Engine</h3>
          <p className="text-xs text-muted-foreground">
            How current FAULTLINE readings align with four possible market scenarios. Updated from live engine data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {result.dataSource !== "live" && (
        <DataNote note="Outcome support is based on fallback data. Live market data was unavailable at time of calculation." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((s, i) => (
          <ScenarioCard key={s.scenario} scenario={s} isTop={i === 0} />
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground/60 space-y-1">
        <p>Generated: {new Date(result.generatedAt).toLocaleString()}</p>
        <p>{result.disclaimer}</p>
      </div>
    </div>
  );
}

function SummaryPanel() {
  const { data, isLoading } = trpc.readingHistory.getSummary.useQuery();

  if (isLoading || !data) return null;

  const s = data as {
    totalSnapshots: number;
    oldestDate: string | null;
    newestDate: string | null;
    averageScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    elevatedDays: number;
    highDays: number;
    criticalDays: number;
    mostFrequentRegime: string | null;
  };

  if (s.totalSnapshots === 0) return null;

  return (
    <Card className="border-border/50 mb-4">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{s.totalSnapshots}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Total Days</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{s.averageScore ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Avg Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-red-400">{s.highestScore ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Peak Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{s.lowestScore ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Lowest Score</p>
          </div>
        </div>
        {s.mostFrequentRegime && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Most frequent regime: <span className="text-foreground font-medium">{s.mostFrequentRegime}</span>
            {s.oldestDate && s.newestDate && (
              <span className="ml-2 text-muted-foreground/60">
                ({s.oldestDate} → {s.newestDate})
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReadingHistory() {
  const { user } = useAuth();
  const { output } = useEngine();
  const regimeLabel = output?.regime?.label;
  const [activeTab, setActiveTab] = useState<"today" | "week" | "month" | "year" | "outcomes">("today");

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Reading History"
        subtitle="Daily FAULTLINE readings across timeframes"
        rightSlot={
          <PreflightTrigger
            currentPage="reading-history"
            regimeLabel={regimeLabel}
          />
        }
      />

      <div className="flex-1 container py-6 space-y-5 max-w-5xl">
        {/* Intro copy */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A single reading shows current conditions.{" "}
            <strong className="text-foreground">Timeframe Awareness</strong> helps users understand whether market pressure is temporary, building, or becoming structural.
          </p>
        </div>

        {/* Summary stats */}
        <SummaryPanel />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-5 mb-5">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <div className="space-y-2 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Current Reading Across Timeframes — Today</h2>
              <p className="text-xs text-muted-foreground">
                Today's FAULTLINE reading: current score, stress level, main driver, and scenario support.
              </p>
            </div>
            <TimeframePanel timeframe="today" />
          </TabsContent>

          <TabsContent value="week">
            <div className="space-y-2 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Current Reading Across Timeframes — This Week</h2>
              <p className="text-xs text-muted-foreground">
                How pressure has moved over the past 7 days. Whether conditions are improving, stable, or deteriorating.
              </p>
            </div>
            <TimeframePanel timeframe="week" />
          </TabsContent>

          <TabsContent value="month">
            <div className="space-y-2 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Current Reading Across Timeframes — This Month</h2>
              <p className="text-xs text-muted-foreground">
                30-day view. Useful for identifying whether pressure is temporary or building into a structural shift.
              </p>
            </div>
            <TimeframePanel timeframe="month" />
          </TabsContent>

          <TabsContent value="year">
            <div className="space-y-2 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Current Reading Across Timeframes — This Year</h2>
              <p className="text-xs text-muted-foreground">
                365-day view. Shows regime changes, peak stress periods, and the overall pressure trajectory for the year.
              </p>
            </div>
            <TimeframePanel timeframe="year" />
          </TabsContent>

          <TabsContent value="outcomes">
            <div className="space-y-2 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Outcome Support Engine</h2>
              <p className="text-xs text-muted-foreground">
                How current FAULTLINE readings align with four possible market scenarios. Not a prediction — scenario-based analysis only.
              </p>
            </div>
            <OutcomeSupportPanel />
          </TabsContent>
        </Tabs>

        {/* Page-level disclaimer */}
        <div className="border-t border-border/30 pt-4">
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
            FAULTLINE Reading History is for informational and educational purposes only. It does not constitute investment advice, financial guidance, or a recommendation to buy, sell, or hold any security. Past readings do not predict future market conditions. Always conduct your own research and consult a qualified financial professional before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
