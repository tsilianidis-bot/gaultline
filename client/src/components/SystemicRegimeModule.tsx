import type { FactorArrow, SignalConvergenceSnapshot, SystemicRegimeReading } from "@shared/systemicRegime";

function regimeColor(regime: string | null | undefined) {
  if (!regime) return "#64748b";
  if (regime === "CRISIS" || regime === "STRESS") return "#ff4d6d";
  if (regime === "STRESS BUILDING" || regime === "TRANSITION") return "#ffaa00";
  return "#00e599";
}

function arrowGlyph(arrow: FactorArrow) {
  if (arrow === "up") return "↑";
  if (arrow === "down") return "↓";
  return "→";
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function SystemicRegimeModule({
  reading,
  convergence,
}: {
  reading: SystemicRegimeReading | null | undefined;
  convergence: SignalConvergenceSnapshot | null | undefined;
}) {
  const unavailable = !reading || reading.freshnessStatus === "UNAVAILABLE" || !reading.currentRegime;
  const accent = unavailable ? "#64748b" : regimeColor(reading.currentRegime);
  return (
    <div className="mt-5 rounded border border-white/10 bg-white/[0.03] p-4" data-testid="systemic-regime-module">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Systemic Regime · statistical PCA + HMM</p>
          <p className="mt-2 font-['Rajdhani'] text-2xl font-semibold tracking-wide" style={{ color: accent }}>
            {unavailable ? "UNAVAILABLE" : reading.currentRegime}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            Independent of Pressure Index · not a Pressure weight · not AI
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Stress</p>
            <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : `${reading.systemicRiskScore ?? "—"}%`}</p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Crisis p</p>
            <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : pct(reading.crisisProbability)}</p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : pct(reading.regimeConfidence)}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
        {(["credit", "vol", "rates"] as const).map(factor => (
          <span key={factor} className="rounded border border-white/10 bg-black/20 px-2 py-1">
            {factor} {unavailable ? "—" : arrowGlyph(reading.factorArrows[factor])}
          </span>
        ))}
        <span className="rounded border border-white/10 bg-black/20 px-2 py-1">
          data-through {unavailable ? "—" : reading.dataAsOf ?? "—"}
        </span>
        <span className="rounded border border-white/10 bg-black/20 px-2 py-1">{unavailable ? "no live inference" : reading.freshnessStatus}</span>
      </div>
      {convergence && (
        <p className="mt-3 border-l-2 border-cyan-300/40 bg-cyan-300/[0.04] px-3 py-2 font-mono text-[10px] leading-5 text-slate-300">
          Signal Convergence {convergence.level}: {convergence.summary}
        </p>
      )}
    </div>
  );
}
