/**
 * FAULTLINE V3-H Shadow Engine
 * Runs alongside V1 on every pressure engine call.
 * NO-TUNING RULE: Do not adjust parameters during shadow period (2026-08-09 to 2026-11-07).
 */
import { log } from "../logger";
import { fetchFredBulk } from "../fredClient";
import { getDb } from "../db";
import { shadowModelReadings, shadowForwardOutcomes } from "../../drizzle/schema";
import type { FaultlinePressureOutput } from "./engine";

const STLFSI4_MEAN = -0.17;
const STLFSI4_STD  =  0.80;
const STLFSI4_Z_MIN = -1.0;
const STLFSI4_Z_MAX =  4.0;
const STLFSI4_SPIKE_Z = 2.0;

function scoreStlfsi(raw: number): { score: number; z: number } {
  const z = (raw - STLFSI4_MEAN) / STLFSI4_STD;
  const score = Math.round(Math.max(0, Math.min(100,
    ((z - STLFSI4_Z_MIN) / (STLFSI4_Z_MAX - STLFSI4_Z_MIN)) * 100
  )));
  return { score, z };
}

function classifyV3HRegime(pressure: number): string {
  if (pressure >= 80) return "SYSTEMIC RISK";
  if (pressure >= 65) return "HIGH STRESS";
  if (pressure >= 45) return "ELEVATED RISK";
  if (pressure >= 25) return "MODERATE RISK";
  return "MINIMAL PRESSURE";
}

export async function runV3HShadow(v1Result: FaultlinePressureOutput): Promise<void> {
  try {
    const getScore = (id: string): number => {
      const v = v1Result.vectors.find(vec => vec.id === id);
      return v?.score ?? 50;
    };

    const liquidityScore  = getScore("liquidity-stress");
    const creditScore     = getScore("credit-contagion");
    const volatilityScore = getScore("volatility-regime");
    const macroScore      = getScore("macro-sensitivity");
    const breadthScore    = getScore("market-breadth");
    const aiBubbleScore   = getScore("ai-bubble");

    let stlfsiRaw: number | null = null;
    let stlfsiZ: number | null = null;
    let stlfsiScore: number | null = null;
    let flagStaleStlfsi = false;
    let flagFallback = v1Result.dataSource !== "live";

    try {
      const bulk = await fetchFredBulk([{ id: "STLFSI4", limit: 2 }]);
      const obs = bulk.results["STLFSI4"]?.observations ?? [];
      if (obs.length > 0) {
        const raw = parseFloat(obs[0]?.value ?? "");
        if (!isNaN(raw)) {
          stlfsiRaw = raw;
          const { score, z } = scoreStlfsi(raw);
          stlfsiScore = score;
          stlfsiZ = z;
        }
      }
    } catch {
      flagStaleStlfsi = true;
      flagFallback = true;
      const { score, z } = scoreStlfsi(STLFSI4_MEAN);
      stlfsiScore = score;
      stlfsiZ = z;
      stlfsiRaw = STLFSI4_MEAN;
    }

    const stlfsiForComposite = stlfsiScore ?? 20;
    const structuralScore = Math.round(macroScore * 0.40 + breadthScore * 0.30 + aiBubbleScore * 0.30);
    const acuteScore = Math.round(creditScore * 0.35 + liquidityScore * 0.35 + volatilityScore * 0.15 + stlfsiForComposite * 0.15);
    const v3hPressure = Math.round(structuralScore * 0.35 + acuteScore * 0.65);
    const v3hRegime = classifyV3HRegime(v3hPressure);

    const v1Pressure = v1Result.overallPressure;
    const scoreDiff = v3hPressure - v1Pressure;
    const absScoreDiff = Math.abs(scoreDiff);
    const regimeAgreement = v3hRegime === v1Result.regime;
    const flagDivergence5  = absScoreDiff >= 5;
    const flagDivergence10 = absScoreDiff >= 10;
    const flagRegimeDisagreement = !regimeAgreement;
    const flagStlfsiSpike = stlfsiZ !== null && stlfsiZ >= STLFSI4_SPIKE_Z;

    if (flagDivergence10) {
      log.warn(`[V3-H Shadow] Large divergence: V1=${v1Pressure} V3-H=${v3hPressure} diff=${scoreDiff}`);
    } else {
      log.info(`[V3-H Shadow] V1=${v1Pressure} V3-H=${v3hPressure} diff=${scoreDiff} STLFSI4=${stlfsiRaw?.toFixed(3) ?? "n/a"}`);
    }

    const db = await getDb();
    if (!db) return;

    const [inserted] = await db.insert(shadowModelReadings).values({
      v1Pressure,
      v3hPressure,
      scoreDiff,
      absScoreDiff,
      v1Regime: v1Result.regime,
      v3hRegime,
      regimeAgreement,
      v3hLiquidityScore:  liquidityScore,
      v3hCreditScore:     creditScore,
      v3hVolatilityScore: volatilityScore,
      v3hMacroScore:      macroScore,
      v3hBreadthScore:    breadthScore,
      v3hAiBubbleScore:   aiBubbleScore,
      v3hStlfsiScore:     stlfsiScore,
      stlfsiRaw:          stlfsiRaw !== null ? stlfsiRaw.toString() : null,
      stlfsiZ:            stlfsiZ !== null ? stlfsiZ.toString() : null,
      flagDivergence5,
      flagDivergence10,
      flagRegimeDisagreement,
      flagStlfsiSpike,
      flagStaleStlfsi,
      flagFallback,
      engineVersion: "v3h-1.0.0",
    }).$returningId();

    const readingId = (inserted as { id: number } | undefined)?.id;
    if (!readingId) return;

    const now = new Date();
    for (const [horizon, days] of [["1d", 1], ["5d", 5], ["20d", 20]] as const) {
      const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      await db.insert(shadowForwardOutcomes).values({ shadowReadingId: readingId, horizon, dueAt });
    }
  } catch (err) {
    log.warn("[V3-H Shadow] runV3HShadow failed (non-fatal)", { err: err as Error });
  }
}
