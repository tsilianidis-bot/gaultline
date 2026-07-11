/**
 * Seismograph Intelligence — FAULTLINE Market Operating System
 *
 * Displays:
 * - Current pressure reading with historical percentile
 * - Regime transition probability matrix
 * - Active pattern detection with analog matches
 * - 30-day pressure timeline
 * - Market Memory feed
 * - Evolution analysis (7-day / 30-day trends)
 *
 * Design: Palantir Noir — void black, neon accents, institutional tone
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, Info,
  Clock, BarChart3, Zap, Brain, History, ChevronRight, RefreshCw,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPressureColor(score: number): string {
  if (score >= 80) return "#ff4444";
  if (score >= 65) return "#ff8c00";
  if (score >= 50) return "#ffd700";
  if (score >= 35) return "#7ecf7e";
  return "#00ffc8";
}

function getPressureBg(score: number): string {
  if (score >= 80) return "rgba(255,68,68,0.08)";
  if (score >= 65) return "rgba(255,140,0,0.08)";
  if (score >= 50) return "rgba(255,215,0,0.08)";
  if (score >= 35) return "rgba(126,207,126,0.08)";
  return "rgba(0,255,200,0.06)";
}

function getDirectionIcon(direction: string) {
  if (direction === "rising") return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (direction === "falling") return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function ProbabilityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MiniSparkline({ readings }: { readings: Array<{ pressureScore: number }> }) {
  const scores = readings.slice(0, 30).reverse().map(r => r.pressureScore);
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 240;
  const h = 48;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <polyline
        points={pts}
        fill="none"
        stroke="rgba(0,255,200,0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Threshold lines */}
      {[35, 50, 65, 80].map(threshold => {
        const y = h - ((threshold - min) / range) * (h - 4) - 2;
        if (y < 0 || y > h) return null;
        return (
          <line
            key={threshold}
            x1={0} y1={y} x2={w} y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        );
      })}
    </svg>
  );
}

// ─── Section: Today's Reading ─────────────────────────────────────────────────

function TodayReadingSection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { today } = state;
  const color = getPressureColor(today.pressureScore);
  const bg = getPressureBg(today.pressureScore);

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Today's Reading
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              The Seismograph records every daily pressure reading and builds a persistent dataset over time. Accuracy improves as more observations accumulate.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          {/* Score */}
          <div
            className="rounded-xl px-6 py-4 flex flex-col items-center min-w-[120px]"
            style={{ backgroundColor: bg, border: `1px solid ${color}22` }}
          >
            <span className="text-5xl font-mono font-black" style={{ color }}>
              {today.pressureScore}
            </span>
            <span className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider">
              Pressure Index
            </span>
            <span className="text-[11px] font-mono mt-1" style={{ color }}>
              {today.stressLevel}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              {getDirectionIcon(today.direction)}
              <span className="text-[11px] font-mono text-gray-300">
                {today.direction === "rising" ? "Rising" : today.direction === "falling" ? "Declining" : "Stable"}
                {" "}
                <span className="text-gray-500">for</span>
                {" "}
                <span className="text-white font-bold">{today.streakDays}</span>
                {" "}
                <span className="text-gray-500">consecutive days</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] font-mono text-gray-300">
                <span className="text-white font-bold">{today.historicalPercentile}th</span>
                {" "}
                <span className="text-gray-500">historical percentile</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] font-mono text-gray-500">
                {formatDate(today.date)}
              </span>
            </div>
            {today.deltaFromPrior !== 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-400">
                  Change from prior:{" "}
                  <span
                    className="font-bold"
                    style={{ color: today.deltaFromPrior > 0 ? "#ff8c00" : "#7ecf7e" }}
                  >
                    {today.deltaFromPrior > 0 ? "+" : ""}{today.deltaFromPrior} pts
                  </span>
                </span>
              </div>
            )}
            <div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-white/10 text-gray-300"
              >
                {today.regime}
              </Badge>
            </div>
          </div>
        </div>

        {/* Pressure drivers */}
        {today.pressureDrivers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Active Pressure Drivers</p>
            <div className="space-y-1">
              {today.pressureDrivers.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] font-mono text-gray-300">{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Transition Probabilities ───────────────────────────────────────

function TransitionProbSection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { transitionProbabilities: tp } = state;

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Regime Transition Probabilities
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              These are historical base rates derived from similar past conditions — not predictions. Confidence reflects dataset size. Always distinguish between base rate and current evidence.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <ProbabilityBar label="Remain in current regime" value={tp.remainInRegime} color="#00ffc8" />
          <ProbabilityBar label="Transition → elevated stress" value={tp.transitionToElevated} color="#ffd700" />
          <ProbabilityBar label="Transition → low stress" value={tp.transitionToLow} color="#7ecf7e" />
          <ProbabilityBar label="Transition → crisis" value={tp.transitionToCrisis} color="#ff4444" />
        </div>

        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Confidence</span>
            <span className="text-[11px] font-mono text-gray-300">{tp.confidence}%</span>
          </div>
          <p className="text-[10px] font-mono text-gray-500 leading-relaxed">{tp.historicalBasis}</p>
        </div>

        {tp.currentEvidence.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Current Evidence</p>
            {tp.currentEvidence.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                <span className="text-[11px] font-mono text-gray-300">{e}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Active Patterns ─────────────────────────────────────────────────

function ActivePatternsSection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { activePatterns } = state;
  const [expanded, setExpanded] = useState<number | null>(null);

  if (activePatterns.length === 0) {
    return (
      <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" />
            Active Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] font-mono text-gray-500">
            No significant patterns currently active. The Seismograph will detect patterns as more observations accumulate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Brain className="w-3.5 h-3.5" />
          Active Patterns
          <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/30 text-cyan-400">
            {activePatterns.length} detected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activePatterns.map((p, i) => (
          <div
            key={i}
            className="border border-white/6 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/3 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-1.5 h-8 rounded-full"
                  style={{ backgroundColor: getPressureColor(p.confidence) }}
                />
                <div>
                  <p className="text-[12px] font-mono font-semibold text-white">{p.patternName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono border-white/10 text-gray-400 px-1.5 py-0"
                    >
                      {p.frequency}
                    </Badge>
                    <span className="text-[10px] font-mono text-gray-500">
                      {p.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-gray-500 transition-transform ${expanded === i ? "rotate-90" : ""}`}
              />
            </button>

            {expanded === i && (
              <div className="px-3 pb-3 space-y-3 border-t border-white/5">
                <p className="text-[11px] font-mono text-gray-300 leading-relaxed pt-2">
                  {p.description}
                </p>

                {/* Outcome distribution */}
                {p.outcomeDistribution && p.outcomeDistribution.sampleSize > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                      Historical Outcome Distribution (n={p.outcomeDistribution.sampleSize})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Bullish", value: p.outcomeDistribution.bullishContinuation, color: "#7ecf7e" },
                        { label: "Sideways", value: p.outcomeDistribution.sideways, color: "#ffd700" },
                        { label: "Correction", value: p.outcomeDistribution.correction, color: "#ff4444" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <p className="text-[14px] font-mono font-bold" style={{ color }}>{value}%</p>
                          <p className="text-[9px] font-mono text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-white/5">
                      {[
                        { label: "1W Avg", value: p.outcomeDistribution.avgReturn1w },
                        { label: "1M Avg", value: p.outcomeDistribution.avgReturn1m },
                        { label: "3M Avg", value: p.outcomeDistribution.avgReturn3m },
                        { label: "6M Avg", value: p.outcomeDistribution.avgReturn6m },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p
                            className="text-[11px] font-mono font-semibold"
                            style={{ color: value >= 0 ? "#7ecf7e" : "#ff4444" }}
                          >
                            {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                          </p>
                          <p className="text-[9px] font-mono text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analog matches */}
                {p.analogs && p.analogs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                      Historical Analogs
                    </p>
                    {p.analogs.slice(0, 3).map((a, ai) => (
                      <div key={ai} className="flex items-center justify-between bg-white/3 rounded px-2 py-1.5">
                        <div>
                          <span className="text-[10px] font-mono text-gray-400">{formatDate(a.date)}</span>
                          <span className="text-[10px] font-mono text-gray-500 ml-2">Score: {a.pressureScore}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-cyan-400">{a.similarityScore}% similar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invalidation */}
                {p.invalidationConditions && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded p-2">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Invalidation</p>
                    <p className="text-[11px] font-mono text-gray-400">{p.invalidationConditions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Section: Pressure Timeline ───────────────────────────────────────────────

function PressureTimelineSection({ readings }: { readings: Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }> }) {
  if (readings.length === 0) {
    return (
      <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Pressure Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] font-mono text-gray-500">
            No readings recorded yet. The timeline will populate as the Seismograph accumulates daily observations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const recent = readings.slice(0, 30).reverse();

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Pressure Timeline
          <span className="text-gray-600 font-normal">({recent.length} days)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sparkline */}
        <div className="bg-black/30 rounded-lg p-3">
          <MiniSparkline readings={readings} />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-gray-600">
              {formatDate(recent[0]?.readingDate ?? "")}
            </span>
            <span className="text-[9px] font-mono text-gray-600">Today</span>
          </div>
        </div>

        {/* Recent readings list */}
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {readings.slice(0, 14).map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getPressureColor(r.pressureScore) }}
                />
                <span className="text-[10px] font-mono text-gray-500 w-20">
                  {formatDate(r.readingDate)}
                </span>
                <span className="text-[10px] font-mono text-gray-400">{r.regime}</span>
              </div>
              <div className="flex items-center gap-2">
                {getDirectionIcon(r.direction)}
                <span
                  className="text-[12px] font-mono font-bold w-8 text-right"
                  style={{ color: getPressureColor(r.pressureScore) }}
                >
                  {r.pressureScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section: Evolution Analysis ─────────────────────────────────────────────

function EvolutionSection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { evolution } = state;

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Evolution Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/3 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">7-Day Trend</p>
            <p className="text-[12px] font-mono text-white">{evolution.sevenDayTrend}</p>
          </div>
          <div className="bg-white/3 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">30-Day Trend</p>
            <p className="text-[12px] font-mono text-white">{evolution.thirtyDayTrend}</p>
          </div>
        </div>

        {evolution.accelerating && (
          <div className="flex items-center gap-2 bg-orange-500/8 border border-orange-500/15 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-[11px] font-mono text-orange-300">Pressure is accelerating</span>
          </div>
        )}

        {evolution.buildingPressure && evolution.buildingDuration > 3 && (
          <div className="flex items-center gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-lg px-3 py-2">
            <Activity className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-[11px] font-mono text-yellow-300">
              Building pressure for {evolution.buildingDuration} days
            </span>
          </div>
        )}

        {evolution.whatChanged.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">What Changed</p>
            {evolution.whatChanged.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                <span className="text-[11px] font-mono text-gray-300">{c}</span>
              </div>
            ))}
          </div>
        )}

        {evolution.whatToWatch.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">What to Watch</p>
            {evolution.whatToWatch.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 mt-1.5 shrink-0" />
                <span className="text-[11px] font-mono text-gray-300">{w}</span>
              </div>
            ))}
          </div>
        )}

        {evolution.invalidationConditions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Invalidation Conditions</p>
            {evolution.invalidationConditions.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 mt-1.5 shrink-0" />
                <span className="text-[11px] font-mono text-gray-400">{c}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Market Memory ───────────────────────────────────────────────────

function MarketMemorySection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { marketMemorySummary: mem } = state;

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <History className="w-3.5 h-3.5" />
          Market Memory
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Market Memory is a persistent record of every observation, streak, threshold crossing, and regime shift. It becomes more valuable as the dataset grows.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/3 rounded-lg p-3 text-center">
            <p className="text-2xl font-mono font-black text-cyan-400">{mem.observationCount}</p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">Days Recorded</p>
          </div>
          <div className="bg-white/3 rounded-lg p-3 text-center">
            <p className="text-2xl font-mono font-black text-yellow-400">{mem.longestStreakInDataset}</p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">Longest Streak</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Current Streak</p>
          <p className="text-[11px] font-mono text-gray-300 leading-relaxed">{mem.currentStreakDescription}</p>
        </div>

        {mem.lastMajorShift && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Last Major Shift</p>
            <p className="text-[11px] font-mono text-gray-300">{mem.lastMajorShift}</p>
          </div>
        )}

        {mem.regimeHistory.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Regime History (30 days)</p>
            <div className="flex flex-wrap gap-1.5">
              {mem.regimeHistory.map((r, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] font-mono border-white/10 text-gray-400"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {mem.keyThresholdsCrossed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Key Thresholds Crossed</p>
            {mem.keyThresholdsCrossed.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60 shrink-0" />
                <span className="text-[11px] font-mono text-gray-300">{t}</span>
              </div>
            ))}
          </div>
        )}

        {mem.observationCount < 14 && (
          <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3">
            <p className="text-[11px] font-mono text-cyan-300/80 leading-relaxed">
              The Seismograph is in its early accumulation phase. Pattern detection accuracy improves significantly after 30 observations and continues improving as the dataset grows.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Recent Transitions ─────────────────────────────────────────────

function RecentTransitionsSection({ state }: { state: NonNullable<ReturnType<typeof useSeismographState>["data"]> }) {
  const { recentTransitions } = state;

  if (recentTransitions.length === 0) {
    return null;
  }

  return (
    <Card className="border-white/8 bg-black/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Recent Regime Transitions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentTransitions.map((t, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/3 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 w-20">{formatDate(t.date)}</span>
              <span className="text-[11px] font-mono text-gray-400">{t.fromRegime}</span>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className="text-[11px] font-mono text-white">{t.toRegime}</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">{t.confidence}% conf.</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Custom hook ─────────────────────────────────────────────────────────────

function useSeismographState() {
  return trpc.seismograph.getState.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    staleTime: 3 * 60 * 1000,
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SeismographIntelligence() {
  const { data: state, isLoading, error, refetch } = useSeismographState();
  const { data: readings = [] } = trpc.seismograph.getReadingHistory.useQuery(
    { days: 30 },
    { staleTime: 3 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-cyan-400/40 mx-auto animate-pulse" />
          <p className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">
            Loading Seismograph…
          </p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <Card className="border-white/8 bg-black/40 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Activity className="w-8 h-8 text-gray-600 mx-auto" />
            <div>
              <p className="text-[13px] font-mono text-gray-300 font-semibold">
                No Seismograph Data Yet
              </p>
              <p className="text-[11px] font-mono text-gray-500 mt-2 leading-relaxed">
                The Seismograph records daily pressure readings automatically after market close. The first reading will appear after the daily Heartbeat job runs.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 mx-auto text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Header */}
      <div className="border-b border-white/6 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div>
              <h1 className="text-[13px] font-mono font-bold text-white uppercase tracking-widest">
                Seismograph Intelligence
              </h1>
              <p className="text-[10px] font-mono text-gray-500">
                FAULTLINE Market Operating System · {state.marketMemorySummary.observationCount} observations
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <TodayReadingSection state={state} />
            <ActivePatternsSection state={state} />
            <PressureTimelineSection readings={readings as Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }>} />
            <RecentTransitionsSection state={state} />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <TransitionProbSection state={state} />
            <EvolutionSection state={state} />
            <MarketMemorySection state={state} />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 border-t border-white/5 pt-4">
          <p className="text-[10px] font-mono text-gray-600 leading-relaxed max-w-4xl">
            <strong className="text-gray-500">Important:</strong> Seismograph probabilities are historical base rates derived from similar past conditions — not predictions or guarantees. The system distinguishes between historical frequency, current evidence, and confidence level. Past patterns do not guarantee future outcomes. This is an analytical tool, not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
