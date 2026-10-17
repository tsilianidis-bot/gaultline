// HISTORICAL_BACKTEST of FL-PI-v2-research-0 vs benchmarks (VIX, S&P drawdown, EW-z).
// In-sample and hindsight-informed design: NOT evidence of predictive validity.
// Usage: npx tsx scripts/pressure-v2/run_backtest.ts > docs/pressure/v2/BACKTEST_HISTORICAL.json
import { loadV2Reference, referenceV2Data } from "../../server/pressure/v2/reference";
import { computeV2At } from "../../server/pressure/v2/engine";
import { detectDrawdownEvents, evaluateSignal, forwardOutcome, outcomesByBand, rankAuc } from "../../server/pressure/v2/benchmarkHarness";
import { V2_BENCHMARK_THRESHOLDS, V2_SPEC_ID, V2_SPEC_SHA256 } from "../../server/pressure/v2/spec";

const END = "2026-09-14";
(async () => {
  const { ref, sha256 } = await loadV2Reference();
  const data = referenceV2Data(ref);
  const sp = ref.spxClose;
  const rows = ref.weekly.date.filter(d => d >= "2000-01-01" && d <= END).map(d => {
    const o = computeV2At(data, d);
    return { date: d, signals: { v2: o.v2, vix: o.benchmarks.vix, drawdown: o.benchmarks.spDrawdownPct, ewz: o.benchmarks.ewz } };
  });
  const events = detectDrawdownEvents(sp.dates, sp.values, "2000-01-01", END);
  // Drawdown benchmark threshold: not pre-specified in PRESPEC_V2 → reported as AUC only (no threshold invented).
  const evals = [
    evaluateSignal(rows, events, "v2", V2_BENCHMARK_THRESHOLDS.v2, sp.dates),
    evaluateSignal(rows, events, "vix", V2_BENCHMARK_THRESHOLDS.vix, sp.dates),
    evaluateSignal(rows, events, "ewz", V2_BENCHMARK_THRESHOLDS.ewz, sp.dates),
  ];
  const lab = rows.map(r => ({ ...r, fwd: forwardOutcome(sp.dates, sp.values, r.date, END) })).filter(r => r.fwd);
  const common = lab.filter(r => ["v2", "vix", "drawdown", "ewz"].every(k => (r.signals as any)[k] !== null));
  const auc = (k: string, xs = common) => { const a = rankAuc(xs.map(r => [(r.signals as any)[k], r.fwd!.y])); return a === null ? null : Math.round(a * 1000) / 1000; };
  const split = (k: string) => ({
    full: auc(k), "2000_2012": auc(k, common.filter(r => r.date <= "2012-12-31")), "2013_2026": auc(k, common.filter(r => r.date >= "2013-01-01")),
    "VIX<25": auc(k, common.filter(r => (r.signals.vix ?? 0) < 25)), "VIX>=25": auc(k, common.filter(r => (r.signals.vix ?? 0) >= 25)),
  });
  console.log(JSON.stringify({
    recordClass: "HISTORICAL_BACKTEST", caveat: "In-sample; hindsight-informed design; not a forward test. Uses the frozen reference (cutoff 2026-09-11; outcomes end 2026-09-14).",
    specId: V2_SPEC_ID, specSha256: V2_SPEC_SHA256, referenceFingerprint: sha256,
    nWeeks: rows.length, nEvents: events.length, events,
    signalEvaluations: evals,
    auc: { n: common.length, positives: common.filter(r => r.fwd!.y === 1).length, v2: split("v2"), vix: split("vix"), drawdown: split("drawdown"), ewz: split("ewz") },
    v2OutcomesByBand: outcomesByBand(lab.map(r => ({ v2: r.signals.v2, fwd: r.fwd }))),
  }, null, 1));
})();
