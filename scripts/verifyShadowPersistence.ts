import { desc } from "drizzle-orm";
import { calculateFaultlinePressure } from "../server/pressure/engine";
import { getDb } from "../server/db";
import { shadowModelReadings } from "../drizzle/schema";

async function main() {
  const result = await calculateFaultlinePressure();

  // The canonical engine deliberately writes V3-H in the background. Allow the
  // observed-data enrichment and append-only insert to finish before inspection.
  await new Promise(resolve => setTimeout(resolve, 4_000));

  const db = await getDb();
  if (!db) {
    throw new Error("Database connection is unavailable for shadow persistence verification.");
  }

  const [latest] = await db
    .select({
      id: shadowModelReadings.id,
      readingAt: shadowModelReadings.readingAt,
      v1Pressure: shadowModelReadings.v1Pressure,
      v3hPressure: shadowModelReadings.v3hPressure,
      engineVersion: shadowModelReadings.engineVersion,
    })
    .from(shadowModelReadings)
    .orderBy(desc(shadowModelReadings.readingAt), desc(shadowModelReadings.id))
    .limit(1);

  if (!latest || latest.engineVersion !== "v3h-1.0.0") {
    throw new Error("No persisted V3-H shadow reading with the expected engine version was found.");
  }

  console.log(JSON.stringify({
    pressureResult: { pressure: result.overallPressure, regime: result.regime, source: result.dataSource },
    persistedShadowReading: latest,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
