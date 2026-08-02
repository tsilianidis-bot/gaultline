/**
 * FAULTLINE TIME MACHINE™ — Historical Truth Engine
 *
 * Choose any market period. Travel back to that moment.
 * See what FAULTLINE would have known using only the information available at the time.
 * Watch pressure build. See when the regime changed. Compare the warning with what happened next.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  BarChart3,
  Zap,
  ArrowRight,
  Info,
  Calendar,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function regimeBg(regime: string): string {
  if (regime.includes("CRITICAL")) return "bg-red-950/60 border-red-500/40";
  if (regime.includes("HIGH")) return "bg-orange-950/60 border-orange-500/40";
  if (regime.includes("ELEVATED")) return "bg-yellow-950/60 border-yellow-500/40";
  if (regime.includes("MODERATE")) return "bg-cyan-950/60 border-cyan-500/40";
  return "bg-emerald-950/60 border-emerald-500/40";
}

function regimeTextColor(regime: string): string {
  if (regime.includes("CRITICAL")) return "text-red-400";
  if (regime.includes("HIGH")) return "text-orange-400";
  if (regime.includes("ELEVATED")) return "text-yellow-400";
  if (regime.includes("MODERATE")) return "text-cyan-400";
  return "text-emerald-400";
}

function regimeHex(regime: string): string {
  if (regime.includes("CRITICAL")) return "#FF3B30";
  if (regime.includes("HIGH")) return "#FF6B35";
  if (regime.includes("ELEVATED")) return "#FFB800";
  if (regime.includes("MODERATE")) return "#00E5FF";
  return "#00FF88";
}

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function pressureLabel(score: number): string {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH RISK";
  if (score >= 55) return "ELEVATED";
  if (score >= 40) return "MODERATE";
  return "LOW RISK";
}

const CATEGORY_COLORS: Record<string, string> = {
  "Equity Crash": "#FF3B30",
  "Credit Cycle": "#FF6B35",
  "Systemic Crisis": "#FF0000",
  "Exogenous Shock": "#FFB800",
  "Monetary Tightening": "#FF6B35",
  "Structural Risk": "#00E5FF",
  "Custom": "#888888",
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function PressureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0A0E1A] border border-white/10 rounded-lg p-3 shadow-xl text-xs">
      <div className="font-bold text-white mb-1">{formatMonth(d.month)}</div>
      <div className={`font-bold text-lg ${regimeTextColor(d.regime)}`}>{d.overallPressure}</div>
      <div className={`text-xs ${regimeTextColor(d.regime)} mb-2`}>{d.regime}</div>
      {d.liquidityStress != null && (
        <div className="text-white/50">Liquidity Stress: <span className="text-white/80">{d.liquidityStress}</span></div>
      )}
      {d.creditContagion != null && (
        <div className="text-white/50">Credit Contagion: <span className="text-white/80">{d.creditContagion}</span></div>
      )}
      {d.volatilityRegime != null && (
        <div className="text-white/50">Volatility: <span className="text-white/80">{d.volatilityRegime}</span></div>
      )}
    </div>
  );
}

// ── Period Card ───────────────────────────────────────────────────────────────

function PeriodCard({
  period,
  selected,
  onSelect,
}: {
  period: { id: string; label: string; description: string; category: string; startMonth: string; endMonth: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const catColor = CATEGORY_COLORS[period.category] ?? "#888";
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? "border-[#FFB800]/60 bg-[#FFB800]/8 shadow-[0_0_20px_rgba(255,184,0,0.08)]"
          : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-bold text-white">{period.label}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ color: catColor, background: `${catColor}18`, border: `1px solid ${catColor}40` }}
        >
          {period.category}
        </span>
      </div>
      <div className="text-[11px] text-white/50 leading-relaxed">{period.description}</div>
      <div className="text-[10px] text-white/30 mt-2">
        {formatMonth(period.startMonth)} — {formatMonth(period.endMonth)}
      </div>
    </button>
  );
}

// ── Regime Change Badge ───────────────────────────────────────────────────────

function RegimeChangeBadge({ change }: { change: { month: string; from: string; to: string } }) {
  const isEscalation = change.to.includes("CRITICAL") || change.to.includes("HIGH") ||
    (change.to.includes("ELEVATED") && !change.from.includes("CRITICAL") && !change.from.includes("HIGH"));
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
      isEscalation ? "border-red-500/30 bg-red-950/30" : "border-emerald-500/30 bg-emerald-950/30"
    }`}>
      {isEscalation ? (
        <TrendingUp className="w-3 h-3 text-red-400 shrink-0" />
      ) : (
        <TrendingDown className="w-3 h-3 text-emerald-400 shrink-0" />
      )}
      <span className="text-white/60">{formatMonth(change.month)}:</span>
      <span className={regimeTextColor(change.from)}>{change.from}</span>
      <ArrowRight className="w-3 h-3 text-white/30" />
      <span className={regimeTextColor(change.to)}>{change.to}</span>
    </div>
  );
}

// ── Domain Score Bar ──────────────────────────────────────────────────────────

function DomainBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-white/50">{label}</span>
        <span className="font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TimeMachine() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("gfc-collapse");

  const { data: periods, isLoading: periodsLoading } = trpc.timeMachine.getPeriods.useQuery();
  const { data: periodData, isLoading: dataLoading } = trpc.timeMachine.getPeriodData.useQuery(
    { periodId: selectedPeriodId },
    { enabled: !!selectedPeriodId }
  );

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId);

  // Find the "peak month" index in the timeline for the reference line
  const peakMonthIndex = useMemo(() => {
    if (!periodData?.timeline || !selectedPeriod) return -1;
    return periodData.timeline.findIndex(r => r.month === selectedPeriod.peakMonth);
  }, [periodData, selectedPeriod]);

  // Compute the "first warning" narrative
  const firstWarningNarrative = useMemo(() => {
    if (!periodData?.firstWarningMonth || !selectedPeriod) return null;
    const warningDate = new Date(periodData.firstWarningMonth + "-01");
    const peakDate = new Date(selectedPeriod.peakMonth + "-01");
    const monthsDiff = (peakDate.getFullYear() - warningDate.getFullYear()) * 12 +
      (peakDate.getMonth() - warningDate.getMonth());
    return { month: periodData.firstWarningMonth, monthsBefore: monthsDiff };
  }, [periodData, selectedPeriod]);

  const isLoading = periodsLoading || dataLoading;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#060912] text-white">
        {/* ── Header ── */}
        <div className="border-b border-white/6 bg-[#060912]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FFB800]/15 border border-[#FFB800]/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#FFB800]" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-widest text-white uppercase">
                  FAULTLINE TIME MACHINE™
                </h1>
                <p className="text-xs text-white/40 tracking-wider uppercase">
                  Historical Truth Engine · 2000–Present · {periodData?.stats?.totalMonths ?? 317} Monthly Readings
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* ── Hero Intro ── */}
          <div className="mb-8 p-6 rounded-2xl border border-[#FFB800]/20 bg-[#FFB800]/4">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-black text-white mb-3 leading-tight">
                Choose any market period you know.
              </h2>
              <p className="text-white/60 leading-relaxed mb-4">
                Travel back to that moment and see what FAULTLINE would have known using only the information available at the time.
                Watch pressure build. See when the regime changed. Examine the evidence. Compare the warning with what happened next.
              </p>
              <p className="text-[#FFB800] font-bold text-sm tracking-wider uppercase">
                You choose the period. You judge the result.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* ── Period Picker ── */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-white/40 tracking-widest uppercase mb-4">
                Select a Period
              </div>
              {periodsLoading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-white/3 animate-pulse" />
                  ))}
                </div>
              ) : (
                periods?.map(period => (
                  <PeriodCard
                    key={period.id}
                    period={period}
                    selected={selectedPeriodId === period.id}
                    onSelect={() => setSelectedPeriodId(period.id)}
                  />
                ))
              )}

              {/* Disclaimer */}
              <div className="p-3 rounded-lg border border-white/6 bg-white/2 mt-4">
                <div className="flex gap-2">
                  <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    Historical pressure readings are computed from FRED macroeconomic data using the same methodology as the live Pressure Index.
                    Past performance does not guarantee future results. Not investment advice.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Main Panel ── */}
            <div className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="h-64 rounded-2xl bg-white/3 animate-pulse" />
                  <div className="h-32 rounded-2xl bg-white/3 animate-pulse" />
                </div>
              ) : periodData && selectedPeriod ? (
                <>
                  {/* Period Header */}
                  <div className={`p-5 rounded-2xl border ${regimeBg(periodData.peakReading?.regime ?? "LOW RISK")}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: CATEGORY_COLORS[selectedPeriod.category] ?? "#888",
                              background: `${CATEGORY_COLORS[selectedPeriod.category] ?? "#888"}18`,
                              border: `1px solid ${CATEGORY_COLORS[selectedPeriod.category] ?? "#888"}40`,
                            }}
                          >
                            {selectedPeriod.category}
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-white">{selectedPeriod.label}</h2>
                        <p className="text-sm text-white/50 mt-1 max-w-xl">{selectedPeriod.description}</p>
                      </div>
                      {periodData.peakReading && (
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Peak Pressure</div>
                          <div
                            className="text-4xl font-black"
                            style={{ color: regimeHex(periodData.peakReading.regime) }}
                          >
                            {periodData.peakReading.overallPressure}
                          </div>
                          <div className={`text-xs font-bold ${regimeTextColor(periodData.peakReading.regime)}`}>
                            {periodData.peakReading.regime}
                          </div>
                          <div className="text-[10px] text-white/30 mt-1">{formatMonth(periodData.peakReading.month)}</div>
                        </div>
                      )}
                    </div>

                    {/* First Warning */}
                    {firstWarningNarrative && (
                      <div className="mt-4 pt-4 border-t border-white/8">
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-[#FFB800]" />
                          <span className="text-white/70">
                            FAULTLINE first crossed into{" "}
                            <span className="text-[#FFB800] font-bold">ELEVATED RISK</span>{" "}
                            in{" "}
                            <span className="text-white font-bold">{formatMonth(firstWarningNarrative.month)}</span>
                            {firstWarningNarrative.monthsBefore > 0 && (
                              <span className="text-white/50">
                                {" "}— {firstWarningNarrative.monthsBefore} month{firstWarningNarrative.monthsBefore !== 1 ? "s" : ""} before the peak
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pressure Timeline Chart */}
                  <div className="p-5 rounded-2xl border border-white/8 bg-white/2">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">
                          Pressure Index Timeline
                        </div>
                        <div className="text-sm text-white/60">
                          {formatMonth(selectedPeriod.startMonth)} — {formatMonth(selectedPeriod.endMonth)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-white/30">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-0.5 bg-red-500 inline-block" />
                          Critical (85+)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-0.5 bg-yellow-500 inline-block" />
                          Elevated (55+)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-0.5 bg-emerald-500 inline-block" />
                          Low (&lt;40)
                        </span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={periodData.timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFB800" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                          tickFormatter={m => {
                            const [y, mo] = m.split("-");
                            return mo === "01" ? y : "";
                          }}
                          interval={0}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                          ticks={[0, 25, 40, 55, 70, 85, 100]}
                        />
                        <Tooltip content={<PressureTooltip />} />
                        {/* Threshold bands */}
                        <ReferenceLine y={85} stroke="#FF3B30" strokeDasharray="4 4" strokeOpacity={0.4} />
                        <ReferenceLine y={70} stroke="#FF6B35" strokeDasharray="4 4" strokeOpacity={0.3} />
                        <ReferenceLine y={55} stroke="#FFB800" strokeDasharray="4 4" strokeOpacity={0.3} />
                        <ReferenceLine y={40} stroke="#00E5FF" strokeDasharray="4 4" strokeOpacity={0.2} />
                        {/* Peak month reference */}
                        {selectedPeriod.peakMonth && (
                          <ReferenceLine
                            x={selectedPeriod.peakMonth}
                            stroke="#FF3B30"
                            strokeDasharray="6 3"
                            strokeOpacity={0.6}
                            label={{ value: "PEAK", position: "top", fill: "#FF3B30", fontSize: 9 }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="overallPressure"
                          stroke="#FFB800"
                          strokeWidth={2}
                          fill="url(#pressureGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: "#FFB800", stroke: "#000", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stats Row */}
                  {periodData.stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Peak Pressure", value: periodData.stats.maxPressure, color: "#FF3B30" },
                        { label: "Avg Pressure", value: periodData.stats.avgPressure, color: "#FFB800" },
                        { label: "Months ≥ 60", value: periodData.stats.monthsAbove60, color: "#FF6B35", suffix: " mo" },
                        { label: "Months ≥ 80", value: periodData.stats.monthsAbove80, color: "#FF3B30", suffix: " mo" },
                      ].map(s => (
                        <div key={s.label} className="p-3 rounded-xl border border-white/8 bg-white/2 text-center">
                          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{s.label}</div>
                          <div className="text-2xl font-black" style={{ color: s.color }}>
                            {s.value}{s.suffix ?? ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Regime Changes */}
                  {periodData.regimeChanges.length > 0 && (
                    <div className="p-5 rounded-2xl border border-white/8 bg-white/2">
                      <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                        Regime Transitions ({periodData.regimeChanges.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {periodData.regimeChanges.map((change, i) => (
                          <RegimeChangeBadge key={i} change={change} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Domain Scores at Peak */}
                  {periodData.peakReading && (
                    <div className="p-5 rounded-2xl border border-white/8 bg-white/2">
                      <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                        Domain Scores at Peak — {formatMonth(periodData.peakReading.month)}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DomainBar label="Liquidity Stress" value={periodData.peakReading.liquidityStress} color="#FF3B30" />
                        <DomainBar label="Credit Contagion" value={periodData.peakReading.creditContagion} color="#FF6B35" />
                        <DomainBar label="Volatility Regime" value={periodData.peakReading.volatilityRegime} color="#FFB800" />
                        <DomainBar label="Macro Sensitivity" value={periodData.peakReading.macroSensitivity} color="#00E5FF" />
                        <DomainBar label="Market Breadth" value={periodData.peakReading.marketBreadth} color="#A855F7" />
                      </div>
                    </div>
                  )}

                  {/* Outcome Reveal */}
                  <div className="p-5 rounded-2xl border border-white/15 bg-white/3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-[#FFB800]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                          What Happened Next
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">{selectedPeriod.outcome}</p>
                      </div>
                    </div>
                  </div>

                  {/* Raw Macro Indicators at Peak */}
                  {periodData.peakReading && (
                    <div className="p-5 rounded-2xl border border-white/8 bg-white/2">
                      <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                        Raw Macro Indicators at Peak
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "BAA Spread", value: periodData.peakReading.baaSpread, suffix: "%" },
                          { label: "10Y Yield", value: periodData.peakReading.tsy10y, suffix: "%" },
                          { label: "2Y Yield", value: periodData.peakReading.tsy2y, suffix: "%" },
                          { label: "Fed Funds", value: periodData.peakReading.fedfunds, suffix: "%" },
                          { label: "CPI YoY", value: periodData.peakReading.cpiYoy, suffix: "%" },
                          { label: "Unemployment", value: periodData.peakReading.unemployment, suffix: "%" },
                          { label: "S&P 500", value: periodData.peakReading.sp500, prefix: "" },
                          { label: "HY Spread", value: periodData.peakReading.hySpreadProxy, suffix: "%" },
                        ].filter(i => i.value != null).map(item => (
                          <div key={item.label} className="p-3 rounded-xl border border-white/6 bg-white/2">
                            <div className="text-[10px] text-white/40 mb-1">{item.label}</div>
                            <div className="text-sm font-bold text-white">
                              {item.prefix}{typeof item.value === "number" ? item.value.toFixed(2) : item.value}{item.suffix}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* ── Challenge FAULTLINE CTA ── */}
          <div className="mt-12 p-8 rounded-2xl border border-[#FFB800]/20 bg-gradient-to-br from-[#FFB800]/6 to-[#FF6B35]/4 text-center">
            <div className="text-[10px] font-bold text-[#FFB800]/60 tracking-widest uppercase mb-3">
              The Live Pressure Index
            </div>
            <h3 className="text-2xl font-black text-white mb-3">
              See What FAULTLINE Is Reading Right Now
            </h3>
            <p className="text-white/50 max-w-xl mx-auto mb-6 text-sm leading-relaxed">
              The same methodology that identified these historical regimes is running live today.
              The current Pressure Index is updated continuously using real-time FRED data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="bg-[#FFB800] hover:bg-[#FFB800]/90 text-black font-bold px-8 py-3 h-auto"
                onClick={() => window.location.href = "/app/now/deep"}
              >
                View Live Pressure Index
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white/70 hover:text-white hover:border-white/40 px-8 py-3 h-auto"
                onClick={() => window.location.href = "/app/track-record"}
              >
                View Full Track Record
              </Button>
            </div>
          </div>

          {/* ── Methodology Note ── */}
          <div className="mt-6 p-4 rounded-xl border border-white/6 bg-white/2">
            <div className="flex gap-3">
              <Shield className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
              <div className="text-xs text-white/30 leading-relaxed">
                <span className="font-bold text-white/50">Methodology:</span>{" "}
                Historical pressure readings are computed from Federal Reserve Economic Data (FRED) using the same 8-domain methodology as the live Pressure Index:
                Liquidity Stress, Credit Contagion, Volatility Regime, Macro Sensitivity, Market Breadth, Systemic Risk, Funding Stress, and Cross-Asset Correlation.
                All readings use only data that would have been available at the time — no look-ahead bias.
                Readings are not investment advice. Past regimes do not guarantee future outcomes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
