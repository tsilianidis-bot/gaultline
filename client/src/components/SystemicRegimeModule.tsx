import type { FactorArrow, SignalConvergenceSnapshot, SystemicRegimeReading } from "@shared/systemicRegime";
import {
  SYSTEMIC_REGIME_INDEPENDENT_CAPTION,
  SYSTEMIC_REGIME_PROBABILITY_WITHHELD_TEXT,
  systemicRegimeProbabilityOutputsWithheld,
} from "@shared/credibilityLabels";
import { SYSTEMIC_REGIME_CALIBRATION, probabilityText, systemicRegimeProbabilityClaims } from "@shared/probabilityContract";

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

export default function SystemicRegimeModule({
  reading,
  convergence,
}: {
  reading: SystemicRegimeReading | null | undefined;
  convergence: SignalConvergenceSnapshot | null | undefined;
}) {
  const unavailable = !reading || reading.freshnessStatus === "UNAVAILABLE" || !reading.currentRegime;
  const accent = unavailable ? "#64748b" : regimeColor(reading.currentRegime);
  const withholdProbabilities = systemicRegimeProbabilityOutputsWithheld(SYSTEMIC_REGIME_CALIBRATION);
  // Only used when calibration is validated; otherwise the three fields are not rendered.
  const claims = withholdProbabilities ? null : systemicRegimeProbabilityClaims(reading);
  const regimeLabel = unavailable ? "UNAVAILABLE" : reading.currentRegime;

  return (
    <div className="mt-5 rounded border border-white/10 bg-white/[0.03] p-4" data-testid="systemic-regime-module">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Systemic Regime · statistical PCA + HMM</p>
          <p className="mt-2 font-['Rajdhani'] text-2xl font-semibold tracking-wide" style={{ color: accent }} data-systemic-regime-label>
            {regimeLabel}
          </p>
          <p className="mt-1 max-w-xl text-[11px] leading-4 text-slate-400" data-systemic-regime-caption>
            {SYSTEMIC_REGIME_INDEPENDENT_CAPTION}
          </p>
        </div>
        {withholdProbabilities ? (
          <div
            className="max-w-sm rounded border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-left"
            data-testid="systemic-regime-probability-withheld"
            data-systemic-regime-prob-withheld="true"
          >
            <p className="font-mono text-[10px] leading-4 text-amber-100/90">{SYSTEMIC_REGIME_PROBABILITY_WITHHELD_TEXT}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center" data-testid="systemic-regime-probability-fields" data-systemic-regime-prob-withheld="false">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Stress</p>
              <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : probabilityText(claims?.stressScore)}</p>
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Crisis p</p>
              <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : probabilityText(claims?.crisis)}</p>
            </div>
            <div data-testid="systemic-regime-model-score">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Model score</p>
              <p className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{unavailable ? "—" : probabilityText(claims?.regimeConfidence)}</p>
            </div>
          </div>
        )}
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
