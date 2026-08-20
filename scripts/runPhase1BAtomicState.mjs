import { getLatestSeismographOutput, runSeismographPipeline } from "../server/scheduledSeismograph.ts";
import { calculateFaultlinePressure } from "../server/pressure/engine.ts";
import { buildAtomicIntelligenceStateManifest, persistAtomicIntelligenceStateManifest } from "../server/intelligenceGovernance.ts";

const mode = process.argv[2] ?? "pipeline";

if (mode === "pipeline") {
  const output = await runSeismographPipeline();
  console.log(JSON.stringify({
    mode,
    pressureIndex: output.pressureScore,
    regime: output.regime,
    computedAt: new Date(output.computedAt).toISOString(),
    note: "The scheduled pipeline persisted its append-only governance manifest during this coherent run.",
  }, null, 2));
} else if (mode === "latest") {
  const [pressure, seismograph] = await Promise.all([calculateFaultlinePressure(), getLatestSeismographOutput()]);
  const result = buildAtomicIntelligenceStateManifest({ pressure, seismograph, generatedAt: new Date().toISOString() });
  const persisted = await persistAtomicIntelligenceStateManifest(result);
  console.log(JSON.stringify({
    mode,
    stateId: persisted.stateId,
    created: persisted.created,
    coherenceStatus: result.manifest.coherenceStatus,
    coherenceNotes: result.manifest.coherenceNotes,
    dataQualitySummary: result.manifest.dataQualitySummary,
  }, null, 2));
} else {
  throw new Error("Usage: node scripts/runPhase1BAtomicState.mjs [pipeline|latest]");
}
