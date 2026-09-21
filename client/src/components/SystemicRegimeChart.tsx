import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StressPeriodBand, SystemicRegimeHistoryPoint } from "@shared/systemicRegime";

const REGIME_FILL: Record<string, string> = {
  CRISIS: "rgba(255,77,109,0.16)",
  STRESS: "rgba(255,77,109,0.12)",
  "STRESS BUILDING": "rgba(255,170,0,0.12)",
  TRANSITION: "rgba(255,170,0,0.10)",
  NORMAL: "rgba(0,229,153,0.05)",
  "RISK ON": "rgba(0,229,153,0.04)",
};

function regimeRuns(points: SystemicRegimeHistoryPoint[]) {
  const runs: Array<{ start: string; end: string; regime: string }> = [];
  for (const point of points) {
    const last = runs.at(-1);
    if (!last || last.regime !== point.currentRegime) {
      runs.push({ start: point.date, end: point.date, regime: String(point.currentRegime) });
    } else {
      last.end = point.date;
    }
  }
  return runs.filter(run => run.regime !== "NORMAL" && run.regime !== "RISK ON");
}

export default function SystemicRegimeChart({
  points,
  stressPeriods,
  warningDates = [],
}: {
  points: SystemicRegimeHistoryPoint[];
  stressPeriods: readonly StressPeriodBand[];
  warningDates?: string[];
}) {
  const data = useMemo(
    () => points.map(point => ({
      date: point.date,
      spx: point.spx,
      pressure: point.pressureIndex,
      score: point.systemicRiskScore,
      regime: point.currentRegime,
    })),
    [points],
  );
  const bands = useMemo(() => regimeRuns(points), [points]);
  if (!points.length) {
    return (
      <div className="rounded border border-white/10 bg-[#060a10] p-6 font-mono text-[11px] text-slate-400">
        Systemic Regime history is unavailable until an expanding-window OOS artifact or live inference exists. This chart does not reconstruct Pressure Index history.
      </div>
    );
  }
  return (
    <div className="rounded border border-white/10 bg-[#060a10] p-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
        SPX · regime bands · pressure overlay when present · research OOS path
      </p>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} minTickGap={28} />
            <YAxis yAxisId="spx" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
            {bands.map(band => (
              <ReferenceArea key={`${band.regime}-${band.start}`} x1={band.start} x2={band.end} yAxisId="spx" fill={REGIME_FILL[band.regime] ?? "rgba(255,255,255,0.04)"} fillOpacity={1} />
            ))}
            {stressPeriods.map(period => (
              <ReferenceArea key={period.id} x1={period.start} x2={period.end} yAxisId="spx" fill="rgba(250,204,21,0.05)" stroke="rgba(250,204,21,0.25)" strokeDasharray="3 3" />
            ))}
            <Tooltip
              contentStyle={{ background: "#071019", border: "1px solid rgba(0,212,255,.3)", fontSize: 11 }}
              formatter={(value: number, name: string) => [value == null ? "—" : Number(value).toFixed(2), name]}
            />
            <Line yAxisId="spx" type="monotone" dataKey="spx" name="SPX" stroke="#00d4ff" dot={false} strokeWidth={1.6} connectNulls />
            <Line yAxisId="score" type="monotone" dataKey="pressure" name="Pressure" stroke="#a78bfa" dot={false} strokeWidth={1.2} connectNulls />
            <Area yAxisId="score" type="monotone" dataKey="score" name="Systemic score" stroke="#ff4d6d" fill="rgba(255,77,109,0.08)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
        {stressPeriods.map(period => (
          <span key={period.id} className="rounded border border-yellow-300/20 px-2 py-1 text-yellow-200/80">{period.label}</span>
        ))}
        {warningDates.map(date => (
          <span key={date} className="rounded border border-cyan-300/20 px-2 py-1 text-cyan-200/80">FAULTLINE {date}</span>
        ))}
      </div>
    </div>
  );
}
