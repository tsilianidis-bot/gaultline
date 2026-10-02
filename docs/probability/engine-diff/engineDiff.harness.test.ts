/* Engine-output diff harness (not committed). Run from a tree's server/ dir:
   ED_TREE=<name> vitest run server/engineDiff.harness.test.ts */
import { test, vi } from "vitest";
import fs from "fs";
const FX = JSON.parse(fs.readFileSync("/workspace/probability/engine-diff/fixtures.json", "utf8"));
const state: { history: any[]; assembled: any; pressure: any } = { history: [], assembled: null, pressure: null };

vi.mock("./db", () => {
  const chain = (table: any) => {
    const rowsFor = () => {
      const name = table?.[Symbol.for("drizzle:Name")] ?? "";
      return name === "pressureHistory" ? state.history.map((r, i) => ({ id: i + 1, createdAt: new Date(0), ...r })) : [];
    };
    const c: any = { orderBy: () => c, limit: () => c, where: () => c, then: (res: any, rej: any) => Promise.resolve(rowsFor()).then(res, rej) };
    return c;
  };
  return { getDb: async () => ({ select: () => ({ from: (t: any) => chain(t) }) }) };
});
vi.mock("./scheduledSeismograph", () => ({ getLatestSeismographOutput: async () => state.assembled }));
vi.mock("./pressure/engine", async (orig) => ({ ...(await orig() as any), calculateFaultlinePressure: async () => state.pressure }));
vi.mock("./_core/llm", () => ({ invokeLLM: async () => { throw new Error("stub: no LLM"); } }));

const typeOf: Record<string, string> = { "Historical Context": "historical_analog", "Cross-Market": "cross_market_alignment", "Probability": "probability_distribution", "Market Regime": "regime_classification", "Macro Pressure": "macro_pressure", "Regime Transition": "transition_signal", "Breakdown Signals": "breakdown_signals" };
const strip = (o: any) => JSON.parse(JSON.stringify(o, (k, v) => (k === "computedAt" || k === "lastUpdated" || k === "generatedAt" || k === "timestamp") ? undefined : (typeof v === "number" && Number.isNaN(v) ? "NaN" : v)));

test("dump engine outputs", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T18:01:25.427Z"));
  const { assembleSeismographOutput } = await import("./seismographCore");
  const { fmosToEvidencePackets } = await import("./seismographAdapters");
  const { buildCanonicalIntelligenceState } = await import("./canonicalIntelligenceState");
  const { buildGovernedClaims, buildAtomicIntelligenceStateManifest } = await import("./intelligenceGovernance");
  const { getUnifiedSeismographIntelligence } = await import("./seismographUnified");
  const { getPreFlightData } = await import("./preFlight");
  const { assembleCanonicalMarketState } = await import("./marketStateService");
  const { calculateFrozenChampionV1 } = await import("./verifiedHistoricalValidation");
  const out: any = { tree: process.env.ED_TREE, fixtures: {} };

  for (const name of ["oct01", "oct02_1401"]) {
    const { assembled: A, canonical: C, unified: U } = FX[name];
    const r: any = {};
    // 1. Seismograph assembly: same evidence packets; the analog packet comes from the tree's FMOS adapter.
    const fmos: any = { regime: { pressureLevel: "Moderate", confidence: 50, currentRegime: A.regime, description: "" }, confidence: { score: 67 }, probability: { bull: 62, neutral: 10, bear: 28, confidence: 67, primaryDriver: "x", bullEvidence: [], bearEvidence: [] }, analogs: (A.analogMatches ?? []).map((a: any) => ({ ...a, era: a.label })), transition: { transitionProbability: 0, transitionDirection: "stable", estimatedTimeToTransition: "n/a", fromRegime: "x", toRegime: "x", triggers: [] }, alignmentScore: 90, forwardBias: "neutral", crossMarket: { alignment: 90 } };
    const analogPkt = fmosToEvidencePackets(fmos).find((p: any) => p.evidenceType === "historical_analog");
    const packets: any[] = A.evidenceFamilies.map((f: any) => ({ source: f.contributors?.[0] ?? f.name, timestamp: 0, evidenceType: typeOf[f.name] ?? "macro_pressure", signal: f.name === "Historical Context" && analogPkt ? analogPkt.signal : f.signal, strength: f.strength, confidence: 67, primaryReading: "", humanReadable: f.summary ?? "" }));
    const seis: any = assembleSeismographOutput({ pressureScore: A.pressureScore, regime: A.regime, stressLevel: A.stressLevel, direction: A.direction, historicalPercentile: A.historicalPercentile, analogMatches: A.analogMatches, activePatterns: A.activePatterns, transitionProbabilities: A.transitionProbabilities, marketMemory: A.marketMemory, providerProvenance: A.providerProvenance } as any, packets as any);
    r.seismograph = strip({ version: seis.version, pressureScore: seis.pressureScore, regime: seis.regime, stressLevel: seis.stressLevel, direction: seis.direction, historicalPercentile: seis.historicalPercentile, evidenceConsensus: seis.evidenceConsensus, analogPacketSignal: analogPkt?.signal ?? null, probabilities: seis.probabilities, transitionProbabilities: seis.transitionProbabilities, families: (seis.evidenceFamilies ?? []).map((f: any) => `${f.name}:${f.signal}:${f.strength}`) });
    // 2. Pressure output (from the canonical engines) -> atomic manifest + governed claims.
    const vec = (e: any) => ({ id: e.engineId, name: e.engineId, label: e.engineId, score: e.value, trend: "Stable", weight: 1, level: "Moderate", drivers: [], description: "", rawInputs: {}, dataStatus: "LIVE" });
    state.pressure = { overallPressure: C.pressureIndex, regime: C.regime, level: "Moderate", dataSource: "fixture", alerts: [], timestamp: 0, vectors: C.engines.map(vec) };
    try {
      const atomic: any = buildAtomicIntelligenceStateManifest({ pressure: state.pressure, seismograph: seis, originatingRunId: "fixture-run", generatedAt: "2026-10-02T18:01:25.427Z" } as any);
      const m = atomic.manifest ?? atomic;
      r.manifest = strip({ stateHash: m.stateHash, modelVersion: m.modelVersion, scoringVersion: m.scoringVersion, pressureIndex: m.pressureIndex, regime: m.regime, engineValues: m.engineValues, scenarioOutputs: m.scenarioOutputs });
      r.claims = strip((atomic.claims ?? buildGovernedClaims(seis, "2026-10-02T18:01:25.427Z")).map((c: any) => `${c.claimId}=${c.value}@${c.modelVersion}`));
    } catch (e: any) { r.manifestErr = e.message; }
    // 3. Canonical state from the production manifest.
    const engineValues = Object.fromEntries(C.engines.map((e: any) => [e.engineId, e.value]));
    const engineDirections = Object.fromEntries(C.engines.map((e: any) => [e.engineId, e.direction]));
    const st: any = buildCanonicalIntelligenceState({ ...C, engineValues, engineDirections, coherenceStatus: C.provenance?.coherenceStatus ?? "COHERENT", inputQuality: [], domainValues: {} }, { priorPressureIndex: 33 });
    r.canonical = strip({ pressureIndex: st.pressureIndex, regime: st.regime, pressureDirection: st.pressureDirection, engines: st.engines.map((e: any) => `${e.engineId}=${e.value}`), scenarioOutputs: st.scenarioOutputs, modelVersion: st.modelVersion, contractScenarioText: st.probabilityContract?.scenarioSet?.display?.text ?? null });
    // 4. MarketState assembly from the production unified payload.
    const ms: any = assembleCanonicalMarketState(U, { generatedAt: "2026-10-02T18:05:00.000Z", cacheStatus: "fresh-cache", cacheAgeMs: 0, probabilityContract: st.probabilityContract } as any);
    r.marketState = strip({ pressureScore: ms.now?.pressureScore, percentile: ms.now?.historicalPercentile ?? ms.now?.percentile, regime: ms.now?.regime, posture: ms.act?.marketPosture, displayedProbabilities: ms.outlook?.probabilities, displayed5way: ms.outlook?.regimeProbabilities, displayedTransitions: ms.outlook?.transitionProbabilities });
    // 5. preFlight from the same pressure output.
    const pf: any = await getPreFlightData();
    r.preflight = strip({ awarenessScore: pf.awarenessScore, marketStatus: pf.marketStatus, pressureIndex: pf.pressureIndex,
      conditions: ["creditCondition", "liquidityCondition", "aiBubbleRisk", "recessionRisk", "volatilityCondition", "macroCondition"].map(k => pf[k] ? `${k}:${pf[k].level}:${pf[k].score}` : `${k}:absent`),
      macroDrivers: (pf.macroDrivers ?? []).map((d: any) => `${d.direction}:${d.impact}:${d.value}`), keyRisks: (pf.keyRisks ?? []).map((k: any) => `${k.id}:${k.severity}`), threats: (pf.threatBoard ?? pf.threats ?? []).map((t: any) => `${t.severity}`), awarenessChecks: (pf.awarenessChecks ?? []).map((a: any) => `${a.id}:${a.status}`),
      displayedProbabilities: { bull: pf.bullProbability, bear: pf.bearProbability, recession: pf.recessionProbability, crash: pf.crashProbability } });
    out.fixtures[name] = r;
  }
  // 6. Unified seismograph on the pressureHistory fixtures (latest assembled = 2 PM run).
  state.assembled = FX.oct02_1401.assembled;
  for (const variant of ["complete", "sentinel"]) {
    state.history = FX.history[variant];
    const u: any = await getUnifiedSeismographIntelligence();
    out.fixtures[`unified_${variant}`] = strip({ currentScore: u.currentScore, currentPercentile: u.currentPercentile, currentRegime: u.currentRegime, currentStressLevel: u.currentStressLevel, currentDirection: u.currentDirection,
      evidenceFamilies: u.evidenceFamilies.map((f: any) => `${f.name}:${f.signal}:${f.strength}:${f.trend} | ${String(f.historicalContext).slice(0, 40)}`), evidenceConsensus: u.evidenceConsensus,
      analogs: u.analogs.map((a: any) => `${a.period ?? a.month}:${a.similarity}`), topAnalog: u.topAnalog ? `${u.topAnalog.period ?? u.topAnalog.label}:${u.topAnalog.similarity}` : null,
      probabilities: u.probabilities, regimeProbabilities5way: u.regimeProbabilities5way, transitionProbabilities: { ...u.transitionProbabilities, currentEvidence: undefined },
      activePatterns: u.activePatterns.map((p: any) => p.name), engineContributions: u.engineContributions.map((e: any) => `${e.engine}:${e.contributionWeight}:${e.direction}`) });
  }
  // 7. Frozen champion pressure formula (pressure score + six sub-scores).
  const inputs = [
    { label: "oct02-like", hySpreadBps: 290, sofr: 4.1, tsy10y: 4.1, tsy2y: 3.6, unemployment: 4.3, cpiYoy: 2.9, ppiYoy: 2.6, fedFunds: 4.1 },
    { label: "deep-inversion-high-10y", hySpreadBps: 450, sofr: 5.3, tsy10y: 6.2, tsy2y: 7.4, unemployment: 4.0, cpiYoy: 4.5, ppiYoy: 5.0, fedFunds: 5.3 },
    { label: "steep-curve", hySpreadBps: 600, sofr: 0.1, tsy10y: 2.9, tsy2y: 0.2, unemployment: 8.5, cpiYoy: 1.2, ppiYoy: 0.5, fedFunds: 0.1 },
  ];
  out.frozenChampion = inputs.map(({ label, ...i }) => { const res: any = calculateFrozenChampionV1(i as any); return { label, overallPressure: res.overallPressure, vectorScores: res.vectorScores }; });
  fs.mkdirSync("/workspace/probability/engine-diff/out", { recursive: true });
  fs.writeFileSync(`/workspace/probability/engine-diff/out/${process.env.ED_TREE}.json`, JSON.stringify(out, null, 1));
});
