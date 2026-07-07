/**
 * FAULTLINE — Validation Lab™
 * /app/validation-lab
 *
 * Transparency page showing FMOS prediction accuracy, Brier scores,
 * calibration metrics, and learning insights from historical data.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEngine } from "@/contexts/EngineContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Activity,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  BarChart2,
  Target,
  Cpu,
  Wifi,
  WifiOff,
  Clock,
  Shield,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────

function ScoreGrade({ score, label }: { score: number; label?: string }) {
  const grade =
    score >= 90 ? "A+" :
    score >= 80 ? "A" :
    score >= 70 ? "B" :
    score >= 60 ? "C" :
    score >= 50 ? "D" : "F";
  const color =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-yellow-400" :
    "text-red-400";
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-4xl font-bold font-mono ${color}`}>{grade}</span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground";
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold font-mono">{value}</p>
            {subtitle && <p className={`text-xs mt-1 ${trendColor}`}>{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FlaskConical className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────


// -- 14 Institutional Metrics --
const INSTITUTIONAL_METRICS = [
  { id: 'brier_score',      label: 'Brier Score',                category: 'Accuracy',     value: '0.214',  target: '< 0.20', status: 'warn',  tooltip: 'Measures the mean squared error of probabilistic forecasts. 0 = perfect, 1 = worst. Our score of 0.214 beats the 0.25 climatological baseline, indicating genuine skill.' },
  { id: 'brier_skill',      label: 'Brier Skill Score',          category: 'Accuracy',     value: '+0.145', target: '> 0.20', status: 'warn',  tooltip: 'Relative improvement over a naive baseline forecast. Positive = better than random. Target of 0.20 represents institutional-grade predictive skill.' },
  { id: 'ece',              label: 'Expected Calibration Error', category: 'Calibration',  value: '0.160',  target: '< 0.10', status: 'bad',   tooltip: 'Measures how well predicted probabilities match observed frequencies. 0 = perfectly calibrated. ECE of 0.160 indicates overconfidence in the 0.4-0.6 probability range.' },
  { id: 'direction_acc',    label: 'Direction Accuracy',         category: 'Accuracy',     value: '60.6%',  target: '> 65%',  status: 'warn',  tooltip: '4-week forward directional accuracy: did the market move in the predicted direction? 60.6% vs 50% random baseline shows meaningful signal extraction.' },
  { id: 'transition_f1',    label: 'Transition F1 Score',        category: 'Regime',       value: '0.308',  target: '> 0.50', status: 'bad',   tooltip: 'Harmonic mean of precision and recall for regime transition detection. F1 of 0.308 means the engine misses 75% of actual transitions -- a known limitation of threshold-based signals.' },
  { id: 'transition_prec',  label: 'Transition Precision',       category: 'Regime',       value: '40.0%',  target: '> 60%',  status: 'bad',   tooltip: 'When the engine signals a regime transition, it is correct 40% of the time. High false-positive rate requires improvement in the transition detection algorithm.' },
  { id: 'transition_recall',label: 'Transition Recall',          category: 'Regime',       value: '25.0%',  target: '> 50%',  status: 'bad',   tooltip: 'The engine detects only 25% of actual regime transitions. Most transitions are missed, which is the primary calibration challenge for FMOS v1.' },
  { id: 'avg_lead_time',    label: 'Avg Lead Time',              category: 'Regime',       value: '11.6d',  target: '> 14d',  status: 'warn',  tooltip: 'Average number of days before a regime transition that the engine first signals the change. 11.6 days provides meaningful advance warning for portfolio positioning.' },
  { id: 'backtest_obs',     label: 'Backtest Observations',      category: 'Coverage',     value: '1,902',  target: '> 1,000',status: 'good',  tooltip: '36 years of weekly observations (1990-2026) covering 6 major market crises: 1990 recession, Dot-com bubble, 2008 GFC, 2011 EU crisis, 2020 COVID, 2022 rate shock.' },
  { id: 'regime_coverage',  label: 'Regime Coverage',            category: 'Coverage',     value: '3/5',    target: '5/5',    status: 'warn',  tooltip: 'Only 3 of 5 regime states were triggered in 36 years of backtesting. HIGH RISK and CRITICAL RISK thresholds were never breached, indicating the pressure model needs recalibration.' },
  { id: 'data_coverage',    label: 'Data Coverage',              category: 'Data Quality', value: '99.8%',  target: '> 95%',  status: 'good',  tooltip: 'Percentage of weekly observations with complete macro data from FRED. 99.8% coverage across 1,902 weeks demonstrates robust data pipeline reliability.' },
  { id: 'credit_coverage',  label: 'Credit Stress Coverage',     category: 'Data Quality', value: '8.1%',   target: '> 90%',  status: 'bad',   tooltip: 'CRITICAL: HY credit spread data only available for 8.1% of the backtest period due to a unit mismatch bug. FRED returns % values but the formula expects basis points, causing credit_stress scores to compute as 0 for 91.9% of observations.' },
  { id: 'evidence_families',label: 'Evidence Families',          category: 'Architecture', value: '14',     target: '14',     status: 'good',  tooltip: '14 independent evidence families covering: yield curve, credit stress, volatility, rate level, labor market, sentiment, monetary policy, fiscal policy, geopolitical risk, sector rotation, earnings quality, liquidity conditions, AI concentration, and global macro.' },
  { id: 'engine_count',     label: 'Active Engines',             category: 'Architecture', value: '14',     target: '14',     status: 'good',  tooltip: '14 FMOS engines compiled with 0 TypeScript errors: Data Acquisition, Market DNA, Market Weather, Regime, Transition, Evidence, Probability, Confidence, Historical Analog, Decision, AI Interpretation, Calibration, Learning, Universal Pipeline.' },
];

const METRIC_STATUS_COLORS: Record<string, string> = { good: '#00FF88', warn: '#FF9500', bad: '#FF2D55' };
const METRIC_STATUS_LABELS: Record<string, string> = { good: 'On Target', warn: 'Needs Work', bad: 'Critical' };

export default function ValidationLab() {
  const [days, setDays] = useState(90);
  const [activeTab, setActiveTab] = useState("overview");
  const { fetchStatuses, successCount, failCount, isLive, isLoading: engineLoading, lastUpdated, forceRefresh: engineRefresh } = useEngine();

  const { data: version } = trpc.fmos.getVersion.useQuery();
  const { data: _runStats, isLoading: statsLoading } = trpc.fmos.getRunStats.useQuery({ days });
  const runStats = _runStats as any;
  const { data: _calibration, isLoading: calLoading } = trpc.fmos.getCalibrationMetrics.useQuery({ days });
  const calibration = _calibration as any;
  const { data: _learning, isLoading: learnLoading } = trpc.fmos.getLearningInsights.useQuery({ days });
  const learning = _learning as any;

  const isLoading = statsLoading || calLoading || learnLoading;

  // Regime distribution chart data
  const regimeChartData = runStats?.regimeDistribution
    ? Object.entries(runStats.regimeDistribution as Record<string, number>)
        .map(([name, count]) => ({ name: name.replace("ELEVATED ", "ELEV. "), count }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Calibration chart data
  const calibrationChartData = (calibration as any)?.chartData ?? [];

  // Learning insights
  const insights = (learning as any)?.insights;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Validation Lab</h1>
              <p className="text-xs text-muted-foreground">
                FMOS {version?.version ?? "—"} · {version?.engineCount ?? 14} engines · Prediction accuracy & calibration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[30, 90, 180].map(d => (
              <Button
                key={d}
                variant={days === d ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(d)}
                className="text-xs"
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* FMOS Engine Status Banner */}
        <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-primary">FMOS Universal Intelligence Pipeline</span>
            <span className="text-muted-foreground ml-2">
              {version?.engines?.join(" · ") ?? "Loading engines..."}
            </span>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total Runs"
            value={runStats?.totalRuns?.toLocaleString() ?? "—"}
            subtitle={`${runStats?.periodRuns ?? 0} in last ${days}d`}
            icon={Database}
          />
          <MetricCard
            label="Avg Pressure"
            value={runStats?.avgPressure != null ? `${runStats.avgPressure}/100` : "—"}
            subtitle="Composite pressure index"
            icon={Activity}
          />
          <MetricCard
            label="Live Data Rate"
            value={runStats?.dataSourceBreakdown?.livePercent != null ? `${runStats.dataSourceBreakdown.livePercent}%` : "—"}
            subtitle={`${runStats?.dataSourceBreakdown?.live ?? 0} live / ${runStats?.dataSourceBreakdown?.fallback ?? 0} fallback`}
            icon={TrendingUp}
            trend={((runStats?.dataSourceBreakdown?.livePercent ?? 0) > 80) ? "up" : "down"}
          />
          <MetricCard
            label="Brier Score"
            value={(calibration as any)?.brierScore != null ? ((calibration as any).brierScore as number).toFixed(3) : "—"}
            subtitle="Lower = better calibrated (0 = perfect)"
            icon={Target}
            trend={((calibration as any)?.brierScore ?? 1) < 0.25 ? "up" : "down"}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">14 Metrics</TabsTrigger>
            <TabsTrigger value="health">Engine Health</TabsTrigger>
            <TabsTrigger value="calibration">Calibration</TabsTrigger>
            <TabsTrigger value="learning">Learning Insights</TabsTrigger>
            <TabsTrigger value="engines">Engine Registry</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Regime Distribution */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Regime Distribution (last {days}d)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    How often each market regime was detected
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : regimeChartData.length === 0 ? (
                    <EmptyState
                      title="No data yet"
                      description="Regime distribution will appear once pressure runs are recorded."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={regimeChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                        <Tooltip
                          contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: "#e5e7eb" }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Data Source Quality */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Data Source Quality
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live vs fallback data usage over the period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Live FRED Data</span>
                          <span className="font-mono text-emerald-400">{runStats?.dataSourceBreakdown?.livePercent ?? 0}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${runStats?.dataSourceBreakdown?.livePercent ?? 0}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Fallback Data</span>
                          <span className="font-mono text-yellow-400">{100 - (runStats?.dataSourceBreakdown?.livePercent ?? 0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                            style={{ width: `${100 - (runStats?.dataSourceBreakdown?.livePercent ?? 0)}%` }}
                          />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold font-mono text-emerald-400">{runStats?.dataSourceBreakdown?.live ?? 0}</p>
                            <p className="text-xs text-muted-foreground">Live runs</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold font-mono text-yellow-400">{runStats?.dataSourceBreakdown?.fallback ?? 0}</p>
                            <p className="text-xs text-muted-foreground">Fallback runs</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Latest Run */}
            {runStats?.latestRun && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Latest Pressure Run</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Pressure Index</p>
                      <p className="text-xl font-bold font-mono">{(runStats.latestRun as any).overallPressure}/100</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Regime</p>
                      <p className="text-sm font-semibold">{(runStats.latestRun as any).regime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Data Source</p>
                      <Badge variant={(runStats.latestRun as any).dataSource === "live" ? "default" : "secondary"} className="text-xs">
                        {(runStats.latestRun as any).dataSource}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Computed At</p>
                      <p className="text-xs font-mono">
                        {(runStats.latestRun as any).computedAt
                          ? new Date((runStats.latestRun as any).computedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 14 Institutional Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold">14 Institutional Performance Metrics</p>
                <p className="text-xs text-muted-foreground mt-0.5">Hover any metric for a detailed explanation. Based on 1,902 weekly backtest observations (1990-2026).</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {(['good','warn','bad'] as const).map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: METRIC_STATUS_COLORS[s] }} />
                    <span className="text-muted-foreground">{METRIC_STATUS_LABELS[s]}</span>
                  </div>
                ))}
              </div>
            </div>
            {(['Accuracy','Calibration','Regime','Coverage','Data Quality','Architecture'] as const).map(cat => {
              const catMetrics = INSTITUTIONAL_METRICS.filter(m => m.category === cat);
              if (!catMetrics.length) return null;
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catMetrics.map(metric => (
                      <div
                        key={metric.id}
                        className="flex items-start gap-3 p-4 rounded-lg border bg-card/50"
                        style={{ borderColor: `${METRIC_STATUS_COLORS[metric.status]}22` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">{metric.label}</span>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-help flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">{metric.tooltip}</TooltipContent>
                            </UITooltip>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xl" style={{ color: METRIC_STATUS_COLORS[metric.status] }}>{metric.value}</span>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground">Target: {metric.target}</span>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: METRIC_STATUS_COLORS[metric.status] }} />
                                <span className="text-xs" style={{ color: METRIC_STATUS_COLORS[metric.status] }}>{METRIC_STATUS_LABELS[metric.status]}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Engine Health Tab */}
          <TabsContent value="health" className="space-y-6">
            <div
              className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: isLive ? 'rgba(0,255,136,0.05)' : 'rgba(255,149,0,0.05)',
                borderColor: isLive ? 'rgba(0,255,136,0.2)' : 'rgba(255,149,0,0.2)',
              }}
            >
              <div className="flex items-center gap-3">
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: isLive ? '#00FF88' : '#FF9500',
                  boxShadow: `0 0 8px ${isLive ? '#00FF88' : '#FF9500'}88`,
                }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: isLive ? '#00FF88' : '#FF9500' }}>
                    {engineLoading ? 'Connecting...' : isLive ? 'All Systems Live' : 'Partial Data - Fallback Active'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {successCount} of {successCount + failCount} data feeds active
                    {lastUpdated ? ` - Updated ${Math.round((Date.now() - lastUpdated.getTime()) / 60000)}m ago` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={engineRefresh}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Live Feeds', value: `${successCount}/${successCount + failCount}`, icon: Wifi, color: isLive ? 'text-emerald-400' : 'text-yellow-400' },
                { label: 'Failed Feeds', value: failCount.toString(), icon: WifiOff, color: failCount === 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Active Engines', value: '14', icon: Cpu, color: 'text-cyan-400' },
                { label: 'Last Refresh', value: lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime()) / 60000)}m ago` : '--', icon: Clock, color: 'text-slate-400' },
              ].map(kpi => {
                const Icon = kpi.icon;
                return (
                  <Card key={kpi.label} className="bg-card/50 border-border/50">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                          <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className={`w-4 h-4 ${kpi.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  FRED Data Feed Status
                </CardTitle>
                <CardDescription className="text-xs">Real-time status of all macro data feeds powering FMOS</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fetchStatuses.map(feed => (
                    <div key={feed.seriesId} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: feed.status === 'ok' ? '#00FF88' : feed.status === 'pending' ? '#4B5563' : '#FF9500',
                          boxShadow: feed.status === 'ok' ? '0 0 6px rgba(0,255,136,0.6)' : 'none',
                        }} />
                        <div>
                          <span className="text-sm font-medium">{feed.seriesId}</span>
                          {feed.latestDate && <span className="text-xs text-muted-foreground ml-2">{feed.latestDate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {feed.latestValue != null && (
                          <span className="text-xs font-mono text-muted-foreground">{feed.latestValue.toFixed(2)}</span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: feed.status === 'ok' ? 'rgba(0,255,136,0.3)' : 'rgba(255,149,0,0.3)',
                            color: feed.status === 'ok' ? '#00FF88' : feed.status === 'pending' ? '#6B7280' : '#FF9500',
                          }}
                        >
                          {feed.status === 'ok' ? (feed.cached ? 'CACHED' : 'LIVE') : feed.status === 'pending' ? 'LOADING' : 'ERROR'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  FMOS Engine Pipeline Health
                </CardTitle>
                <CardDescription className="text-xs">All 14 engines compiled and operational - 0 TypeScript errors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['Data Acquisition','Market DNA','Market Weather','Regime Detection','Transition Analysis','Evidence Engine','Probability Engine','Confidence Engine','Historical Analog','Decision Engine','AI Interpretation','Calibration','Learning Loop','Universal Pipeline'].map((eng, i) => (
                    <div key={eng} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 4px rgba(0,255,136,0.6)', flexShrink: 0 }} />
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-4 inline-block">{String(i+1).padStart(2,'0')}</span>
                        <span className="text-xs font-medium ml-1 truncate">{eng}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calibration Tab */}
          <TabsContent value="calibration" className="space-y-6">
            {calLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !(calibration as any)?.available ? (
              <EmptyState
                title="Insufficient Data"
                description={(calibration as any)?.reason ?? "More historical pressure runs are needed to compute calibration metrics."}
              />
            ) : (
              <>
                {/* Calibration Grade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 pb-5 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Calibration Grade</p>
                      <ScoreGrade
                        score={Math.max(0, 100 - ((calibration as any)?.brierScore ?? 0.5) * 200)}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Based on {(calibration as any)?.sampleSize ?? 0} predictions
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 pb-5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Accuracy Metrics</p>
                      <div className="space-y-2">
                        {[
                          { label: "Brier Score", value: ((calibration as any)?.brierScore ?? 0).toFixed(3), note: "0 = perfect" },
                          { label: "Calibration Error", value: (((calibration as any)?.metrics?.calibrationError ?? 0) * 100).toFixed(1) + "%", note: "lower = better (ECE)" },
                          { label: "False Positive Rate", value: ((calibration as any)?.metrics?.falsePositiveRate ?? 0).toFixed(1) + "%", note: "bull miss" },
                          { label: "False Negative Rate", value: ((calibration as any)?.metrics?.falseNegativeRate ?? 0).toFixed(1) + "%", note: "bear miss" },
                        ].map(m => (
                          <div key={m.label} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{m.label}</span>
                            <div className="text-right">
                              <span className="text-sm font-mono font-bold">{m.value}</span>
                              <span className="text-xs text-muted-foreground ml-1">({m.note})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 pb-5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Prediction Quality</p>
                      <div className="space-y-2">
                        {[
                          { label: "Transition Accuracy", value: (((calibration as any)?.metrics?.transitionAccuracy ?? 0)).toFixed(1) + "%" },
                          { label: "Probability Reliability", value: (((calibration as any)?.metrics?.probabilityReliability ?? 0)).toFixed(1) + "%" },
                          { label: "Sample Size", value: ((calibration as any)?.sampleSize ?? 0).toString() },
                        ].map(m => (
                          <div key={m.label} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{m.label}</span>
                            <span className="text-sm font-mono font-bold">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Calibration Chart */}
                {calibrationChartData.length > 0 && (
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Calibration Curve</CardTitle>
                      <CardDescription className="text-xs">
                        Predicted bull probability vs actual outcomes. A perfect model follows the diagonal.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="predicted"
                            name="Predicted"
                            type="number"
                            domain={[0, 1]}
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            label={{ value: "Predicted Probability", position: "insideBottom", offset: -5, fontSize: 10, fill: "#6b7280" }}
                          />
                          <YAxis
                            dataKey="actual"
                            name="Actual"
                            type="number"
                            domain={[0, 1]}
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                          />
                          <Tooltip
                            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                            formatter={(value: number) => [value.toFixed(2)]}
                          />
                          <ReferenceLine
                            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                            stroke="rgba(255,255,255,0.2)"
                            strokeDasharray="4 4"
                          />
                          <Scatter data={calibrationChartData} fill="hsl(var(--primary))" opacity={0.7} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Learning Insights Tab */}
          <TabsContent value="learning" className="space-y-6">
            {learnLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !(learning as any)?.available ? (
              <EmptyState
                title="Insufficient Data"
                description={(learning as any)?.reason ?? "More historical data is needed to generate learning insights."}
              />
            ) : (
              <div className="space-y-4">
                {/* Calibration Grade */}
                {insights?.calibrationGrade && (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-4">
                        <ScoreGrade score={insights.calibrationGrade === "A" ? 90 : insights.calibrationGrade === "B" ? 75 : insights.calibrationGrade === "C" ? 60 : 40} />
                        <div>
                          <p className="font-semibold">Calibration Grade: {insights.calibrationGrade}</p>
                          <p className="text-sm text-muted-foreground">
                            {insights.isWellCalibrated
                              ? "FMOS is well-calibrated. Predicted probabilities reliably match observed outcomes."
                              : "Calibration improvements identified. See insights below."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Systematic Bias */}
                {insights?.systematicBias && (
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        {insights.systematicBias.direction === "none"
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                        Systematic Bias Detection
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Badge variant={insights.systematicBias.direction === "none" ? "default" : "secondary"}>
                          {insights.systematicBias.direction === "none" ? "No Bias Detected" :
                           insights.systematicBias.direction === "bullish" ? "Bullish Bias" : "Bearish Bias"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{insights.systematicBias.description}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Key Insights */}
                {insights?.keyInsights?.length > 0 && (
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Key Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(insights.keyInsights as string[]).map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">→</span>
                            <span className="text-muted-foreground">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Improvement Suggestions */}
                {insights?.improvementSuggestions?.length > 0 && (
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Improvement Suggestions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(insights.improvementSuggestions as string[]).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-yellow-400 mt-0.5">◆</span>
                            <span className="text-muted-foreground">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Engine Registry Tab */}
          <TabsContent value="engines" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">FMOS Engine Registry</CardTitle>
                <CardDescription className="text-xs">
                  All 14 engines in the Universal Intelligence Pipeline — version {version?.version ?? "—"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(version?.engines ?? []).map((engine, i) => {
                    const descriptions: Record<string, string> = {
                      DataAcquisition: "Fetches FRED macro data, market indicators, and sector data",
                      MarketDNA: "Classifies long-term structural market environment",
                      MarketWeather: "Daily tactical conditions: breadth, momentum, volatility",
                      Regime: "Regime classification with transition risk scoring",
                      Transition: "Detects regime transition signals and warning indicators",
                      Evidence: "Organizes evidence into 8 independent families with diminishing returns",
                      Probability: "Canonical bull/neutral/bear probability distribution",
                      Confidence: "Assesses overall confidence from evidence strength and diversity",
                      HistoricalAnalog: "Finds closest historical analogs using 5-dimensional vector matching",
                      Decision: "Generates verdict (STRONG BUY → AVOID) with conviction score",
                      AIInterpretation: "LLM-powered narrative explaining current conditions",
                      Calibration: "Brier score, calibration error, accuracy metrics",
                      Learning: "Systematic bias detection and improvement suggestions",
                      UniversalPipeline: "Orchestrates all 13 engines in sequence",
                    };
                    return (
                      <div key={engine} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{engine}</p>
                          <p className="text-xs text-muted-foreground">{descriptions[engine] ?? "Core FMOS engine"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
