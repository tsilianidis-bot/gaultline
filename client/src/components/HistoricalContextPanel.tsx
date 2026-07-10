/**
 * HistoricalContextPanel
 *
 * Displays the Historical Intelligence Engine output alongside every AI response
 * in the SmartDiscovery (Ask Intelligence) page.
 *
 * Sections:
 *   1. Historical Percentile Gauge
 *   2. Top Analog Cards (similarity %, outcome, why similar)
 *   3. Pressure Timeline (30d / 14d / 7d / yesterday / today)
 *   4. Outcome Distribution bar chart
 *   5. Regime Comparison
 *   6. Market Evolution narrative
 *
 * Design: FAULTLINE dark theme — gold/cyan/orange accents, institutional tone.
 */

import React, { useState } from "react";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
  GitCompare,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

// ── Types (mirrors server/historicalIntelligenceEngine.ts) ─────────────────────

interface TimelinePoint {
  label: string;
  pressure: number;
  regime: string;
  delta: number | null;
  highlight: string;
}

interface HistoricalAnalogEnriched {
  rank: number;
  year: number;
  label: string;
  period: string;
  similarity: number;
  description: string;
  outcome: string;
  whySimilar: string;
  typicalDuration: string;
  estimatedDrawdown: string | null;
  estimatedRecovery: string | null;
}

interface OutcomeDistribution {
  bullishContinuation: number;
  sideways: number;
  correction: number;
  sampleSize: number;
  confidence: "high" | "medium" | "low" | "insufficient";
  disclaimer: string;
}

interface FrequencyAnalysis {
  label: "Rare" | "Uncommon" | "Typical" | "Frequent";
  historicalPct: number;
  description: string;
  monthsInRegime: number;
  totalMonths: number;
}

interface RegimeComparison {
  resembles: string[];
  doesNotResemble: string[];
  regimeLabel: string;
  regimeDescription: string;
}

interface MarketEvolution {
  whatIsBuilding: string;
  howLong: string;
  whyItMatters: string;
  whatAccelerated: string;
  whatWouldInvalidate: string;
}

export interface HistoricalIntelligenceData {
  currentPressure: number;
  currentRegime: string;
  historicalPercentile: number;
  historicalN: number;
  dataRange: string;
  rarityStatement: string;
  analogs: HistoricalAnalogEnriched[];
  timeline: TimelinePoint[];
  frequency: FrequencyAnalysis;
  outcomeDistribution: OutcomeDistribution;
  regimeComparison: RegimeComparison;
  marketEvolution: MarketEvolution;
  computedAt: string;
  dataSource: "live" | "fallback";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPressureColor(pressure: number): string {
  if (pressure >= 80) return "text-red-400";
  if (pressure >= 65) return "text-orange-400";
  if (pressure >= 45) return "text-yellow-400";
  if (pressure >= 25) return "text-blue-400";
  return "text-emerald-400";
}

function getPressureBg(pressure: number): string {
  if (pressure >= 80) return "bg-red-500/20 border-red-500/30";
  if (pressure >= 65) return "bg-orange-500/20 border-orange-500/30";
  if (pressure >= 45) return "bg-yellow-500/20 border-yellow-500/30";
  if (pressure >= 25) return "bg-blue-500/20 border-blue-500/30";
  return "bg-emerald-500/20 border-emerald-500/30";
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 80) return "text-amber-400";
  if (similarity >= 65) return "text-yellow-400";
  if (similarity >= 50) return "text-blue-400";
  return "text-slate-400";
}

function getConfidenceColor(confidence: string): string {
  if (confidence === "high") return "text-emerald-400";
  if (confidence === "medium") return "text-yellow-400";
  if (confidence === "low") return "text-orange-400";
  return "text-slate-500";
}

function formatDelta(delta: number | null): React.ReactNode {
  if (delta === null) return null;
  if (delta > 0) return <span className="text-red-400 text-xs">+{delta}</span>;
  if (delta < 0) return <span className="text-emerald-400 text-xs">{delta}</span>;
  return <span className="text-slate-500 text-xs">0</span>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-amber-400/80">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-slate-200 uppercase tracking-widest">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function PercentileGauge({ percentile, pressure, regime, N, dataRange, rarityStatement }: {
  percentile: number;
  pressure: number;
  regime: string;
  N: number;
  dataRange: string;
  rarityStatement: string;
}) {
  const gaugeWidth = Math.min(100, Math.max(0, percentile));
  const pressureColor = getPressureColor(pressure);
  const pressureBg = getPressureBg(pressure);

  return (
    <div className={`rounded-lg border p-4 ${pressureBg}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className={`text-2xl font-bold tabular-nums ${pressureColor}`}>
            {percentile}<span className="text-sm font-normal text-slate-400">th</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Historical Percentile</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold tabular-nums ${pressureColor}`}>{pressure}/100</div>
          <div className="text-xs text-slate-400">Pressure Index</div>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2 bg-slate-700/60 rounded-full overflow-hidden mb-3">
        {/* Gradient track */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/40 via-yellow-500/40 to-red-500/40" />
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-400 rounded-full transition-all duration-700"
          style={{ width: `${gaugeWidth}%` }}
        />
        {/* Needle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-full shadow-lg transition-all duration-700"
          style={{ left: `calc(${gaugeWidth}% - 2px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500 mb-3">
        <span>0th — Low Risk</span>
        <span>50th — Median</span>
        <span>100th — Critical</span>
      </div>

      <div className="text-xs text-slate-300 leading-relaxed">{rarityStatement}</div>

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Info size={10} />
          N={N} months | {dataRange}
        </span>
        <span className="text-slate-600">·</span>
        <span className={`font-medium ${pressureColor}`}>{regime}</span>
      </div>
    </div>
  );
}

function FrequencyBadge({ frequency }: { frequency: FrequencyAnalysis }) {
  const colors: Record<string, string> = {
    Rare: "bg-red-500/20 text-red-400 border-red-500/30",
    Uncommon: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Typical: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Frequent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const color = colors[frequency.label] ?? colors.Typical;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${color}`}>
          {frequency.label.toUpperCase()}
        </span>
        <span className="text-xs text-slate-400 tabular-nums">
          {frequency.historicalPct}% of historical months
        </span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{frequency.description}</p>
      <div className="mt-2 text-xs text-slate-500">
        {frequency.monthsInRegime} of {frequency.totalMonths} months in this regime
      </div>
    </div>
  );
}

function AnalogCard({ analog, isExpanded, onToggle }: {
  analog: HistoricalAnalogEnriched;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const simColor = getSimilarityColor(analog.similarity);
  const isHighSim = analog.similarity >= 70;

  return (
    <div className={`rounded-lg border transition-all duration-200 ${isHighSim ? "border-amber-500/30 bg-amber-500/5" : "border-slate-700/50 bg-slate-800/30"}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-3 flex items-start justify-between gap-2"
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Rank badge */}
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isHighSim ? "bg-amber-500/20 text-amber-400" : "bg-slate-700/50 text-slate-400"}`}>
            {analog.rank}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">{analog.label}</span>
              <span className="text-xs text-slate-500">{analog.period}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold tabular-nums ${simColor}`}>{analog.similarity}%</span>
              <span className="text-xs text-slate-500">similarity</span>
              {analog.estimatedDrawdown && (
                <span className="text-xs text-red-400/80">{analog.estimatedDrawdown} est. drawdown</span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-slate-500 mt-0.5">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-700/30 pt-2 space-y-2">
          <div>
            <div className="text-xs font-medium text-amber-400/80 mb-1">Why Similar</div>
            <p className="text-xs text-slate-300 leading-relaxed">{analog.whySimilar}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-blue-400/80 mb-1">Historical Outcome</div>
            <p className="text-xs text-slate-300 leading-relaxed">{analog.outcome}</p>
          </div>
          {analog.estimatedRecovery && (
            <div className="text-xs text-slate-400">
              Recovery: <span className="text-emerald-400">{analog.estimatedRecovery}</span>
            </div>
          )}
          <div className="text-xs text-slate-500">Typical duration: {analog.typicalDuration}</div>
        </div>
      )}
    </div>
  );
}

function TimelineBar({ timeline }: { timeline: TimelinePoint[] }) {
  const pressures = timeline.map(t => t.pressure);
  const minP = Math.min(...pressures);
  const maxP = Math.max(...pressures);
  const range = maxP - minP || 1;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      {/* Sparkline */}
      <div className="flex items-end gap-1 h-12 mb-3">
        {timeline.map((point, i) => {
          const height = Math.max(15, ((point.pressure - minP) / range) * 100);
          const isToday = i === timeline.length - 1;
          const pressureColor = point.pressure >= 65 ? "bg-red-400" : point.pressure >= 45 ? "bg-yellow-400" : "bg-emerald-400";
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t transition-all duration-500 ${isToday ? pressureColor : pressureColor + "/40"}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Data rows */}
      <div className="space-y-1.5">
        {timeline.map((point, i) => {
          const isToday = i === timeline.length - 1;
          const TrendIcon = point.delta && point.delta > 3 ? TrendingUp : point.delta && point.delta < -3 ? TrendingDown : Minus;
          const trendColor = point.delta && point.delta > 3 ? "text-red-400" : point.delta && point.delta < -3 ? "text-emerald-400" : "text-slate-500";

          return (
            <div key={i} className={`flex items-center justify-between text-xs ${isToday ? "text-slate-200" : "text-slate-400"}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-20 shrink-0 ${isToday ? "font-semibold text-amber-400" : ""}`}>{point.label}</span>
                <TrendIcon size={10} className={trendColor} />
                <span className="truncate text-slate-500">{point.highlight}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {formatDelta(point.delta)}
                <span className={`font-semibold tabular-nums ${getPressureColor(point.pressure)}`}>{point.pressure}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutcomeDistributionBar({ dist }: { dist: OutcomeDistribution }) {
  if (dist.confidence === "insufficient") {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <AlertCircle size={12} />
          <span>Insufficient historical data for outcome distribution (N={dist.sampleSize}). Minimum 3 analogs required.</span>
        </div>
      </div>
    );
  }

  const bars = [
    { label: "Bullish", pct: dist.bullishContinuation, color: "bg-emerald-400" },
    { label: "Sideways", pct: dist.sideways, color: "bg-yellow-400" },
    { label: "Correction", pct: dist.correction, color: "bg-red-400" },
  ];

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <div className="space-y-2 mb-3">
        {bars.map(bar => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">{bar.label} Continuation</span>
              <span className="font-semibold tabular-nums text-slate-200">{bar.pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${bar.color} rounded-full transition-all duration-700`}
                style={{ width: `${bar.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>N={dist.sampleSize} analogs</span>
        <span className={`font-medium ${getConfidenceColor(dist.confidence)}`}>
          {dist.confidence.toUpperCase()} confidence
        </span>
      </div>
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{dist.disclaimer}</p>
    </div>
  );
}

function RegimeComparisonBlock({ comparison }: { comparison: RegimeComparison }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
      <div className="text-xs text-slate-300 leading-relaxed">{comparison.regimeDescription}</div>
      {comparison.resembles.length > 0 && (
        <div>
          <div className="text-xs font-medium text-amber-400/80 mb-1">Resembles</div>
          <div className="flex flex-wrap gap-1">
            {comparison.resembles.map(r => (
              <span key={r} className="text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300/80">{r}</span>
            ))}
          </div>
        </div>
      )}
      {comparison.doesNotResemble.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">Does Not Resemble</div>
          <div className="flex flex-wrap gap-1">
            {comparison.doesNotResemble.map(r => (
              <span key={r} className="text-xs px-2 py-0.5 rounded bg-slate-700/30 border border-slate-600/30 text-slate-400">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketEvolutionBlock({ evolution }: { evolution: MarketEvolution }) {
  const items = [
    { label: "What Is Building", value: evolution.whatIsBuilding, color: "text-amber-400/80" },
    { label: "Duration", value: evolution.howLong, color: "text-blue-400/80" },
    { label: "Why It Matters", value: evolution.whyItMatters, color: "text-slate-300" },
    { label: "What Accelerated", value: evolution.whatAccelerated, color: "text-orange-400/80" },
    { label: "What Would Invalidate", value: evolution.whatWouldInvalidate, color: "text-emerald-400/80" },
  ];

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2.5">
      {items.map(item => (
        <div key={item.label}>
          <div className={`text-xs font-medium mb-0.5 ${item.color}`}>{item.label}</div>
          <p className="text-xs text-slate-300 leading-relaxed">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface HistoricalContextPanelProps {
  data: HistoricalIntelligenceData;
  defaultExpanded?: boolean;
}

export function HistoricalContextPanel({ data, defaultExpanded = false }: HistoricalContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedAnalogs, setExpandedAnalogs] = useState<Set<number>>(new Set([0]));

  const toggleAnalog = (rank: number) => {
    setExpandedAnalogs(prev => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  };

  const refreshTime = data.computedAt
    ? new Date(data.computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "N/A";

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Historical Intelligence</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`font-medium ${getPressureColor(data.currentPressure)}`}>
              {data.historicalPercentile}th percentile
            </span>
            <span>·</span>
            <span>{data.frequency.label}</span>
            <span>·</span>
            <span>{data.analogs.length} analogs</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{refreshTime}</span>
          {data.dataSource === "fallback" && (
            <span className="text-xs text-orange-400/70 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
              Fallback
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </div>
      </button>

      {/* Collapsed preview */}
      {!isExpanded && (
        <div className="px-4 pb-3 border-t border-slate-700/30">
          <p className="text-xs text-slate-400 leading-relaxed mt-2">{data.rarityStatement}</p>
          {data.analogs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.analogs.slice(0, 3).map(a => (
                <span key={a.rank} className="text-xs px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-400">
                  {a.label} <span className={getSimilarityColor(a.similarity)}>{a.similarity}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-700/30 p-4 space-y-5">
          {/* Section 1: Percentile Gauge */}
          <div>
            <SectionHeader
              icon={<BarChart2 size={14} />}
              title="Historical Percentile"
              subtitle={`N=${data.historicalN} months | ${data.dataRange}`}
            />
            <PercentileGauge
              percentile={data.historicalPercentile}
              pressure={data.currentPressure}
              regime={data.currentRegime}
              N={data.historicalN}
              dataRange={data.dataRange}
              rarityStatement={data.rarityStatement}
            />
            <div className="mt-2">
              <FrequencyBadge frequency={data.frequency} />
            </div>
          </div>

          {/* Section 2: Historical Analogs */}
          {data.analogs.length > 0 && (
            <div>
              <SectionHeader
                icon={<GitCompare size={14} />}
                title="Historical Analogs"
                subtitle={`${data.analogs.length} closest matches from historical database`}
              />
              <div className="space-y-2">
                {data.analogs.map(analog => (
                  <AnalogCard
                    key={analog.rank}
                    analog={analog}
                    isExpanded={expandedAnalogs.has(analog.rank)}
                    onToggle={() => toggleAnalog(analog.rank)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Pressure Timeline */}
          {data.timeline.length > 0 && (
            <div>
              <SectionHeader
                icon={<Clock size={14} />}
                title="Pressure Timeline"
                subtitle="Last 30 days — how conditions developed"
              />
              <TimelineBar timeline={data.timeline} />
            </div>
          )}

          {/* Section 4: Outcome Distribution */}
          <div>
            <SectionHeader
              icon={<BarChart2 size={14} />}
              title="Historical Outcome Distribution"
              subtitle="What happened after similar setups"
            />
            <OutcomeDistributionBar dist={data.outcomeDistribution} />
          </div>

          {/* Section 5: Regime Comparison */}
          <div>
            <SectionHeader
              icon={<GitCompare size={14} />}
              title="Regime Comparison"
              subtitle={data.regimeComparison.regimeLabel}
            />
            <RegimeComparisonBlock comparison={data.regimeComparison} />
          </div>

          {/* Section 6: Market Evolution */}
          <div>
            <SectionHeader
              icon={<TrendingUp size={14} />}
              title="Market Evolution"
              subtitle="What is building and what would change it"
            />
            <MarketEvolutionBlock evolution={data.marketEvolution} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <CheckCircle2 size={10} className="text-emerald-500/60" />
              <span>All data computed from pressureHistory DB (2000–present)</span>
            </div>
            <div className="text-xs text-slate-600">
              Refreshed {refreshTime}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoricalContextPanel;
