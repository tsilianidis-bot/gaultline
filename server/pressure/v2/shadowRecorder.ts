// v2 SHADOW recorder — called ONLY by the scheduled/admin Seismograph pipeline
// (server/pressure/scheduledPersistence.ts). Never by a public request. Append-only.
import { fetchFredBulk } from "../../fredClient";
import { getDb } from "../../db";
import { pressureV2ShadowObservations } from "../../../drizzle/schema";
import { log } from "../../logger";
import { computeV2At } from "./engine";
import { loadV2Reference } from "./reference";
import { assembleLiveV2Data } from "./liveInputs";
import { V2_IMPLEMENTATION_VERSION, V2_SPEC_ID, V2_SPEC_SHA256 } from "./spec";
import type { FaultlinePressureOutput } from "../engine";

export const V2_LIVE_FRED_SERIES = [
  { id: "BAA10Y", limit: 400 },
  { id: "VIXCLS", limit: 400 },
  { id: "SP500", limit: 400 },
  { id: "UNRATE", limit: 30 },
];

export function easternDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function buildV2ShadowObservation(now: Date = new Date()) {
  const { ref, sha256 } = await loadV2Reference();
  if (ref.specSha256 !== V2_SPEC_SHA256 || ref.specId !== V2_SPEC_ID) throw new Error("v2 reference/spec mismatch");
  const bulk = await fetchFredBulk(V2_LIVE_FRED_SERIES);
  const fred = Object.fromEntries(Object.entries(bulk.results).map(([k, v]) => [k, v.error ? [] : v.observations]));
  const asOfDate = easternDate(now);
  const { data, provenance } = assembleLiveV2Data(ref, fred, asOfDate);
  const obs = computeV2At(data, asOfDate);
  const fredErrors = Object.entries(bulk.results).filter(([, v]) => v.error).map(([k, v]) => `${k}: ${v.error}`);
  return { obs, provenance, referenceSha256: sha256, fredErrors, onSpecGrid: new Date(`${asOfDate}T12:00:00Z`).getUTCDay() === 5 };
}

export async function recordPressureV2ShadowObservation(args: { trigger: string; v1?: FaultlinePressureOutput | null; now?: Date }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  let row: typeof pressureV2ShadowObservations.$inferInsert;
  try {
    const { obs, provenance, referenceSha256, fredErrors, onSpecGrid } = await buildV2ShadowObservation(args.now);
    row = {
      asOfDate: obs.asOfDate, onSpecGrid, recordClass: "FORWARD_LIVE",
      specId: obs.specId, specSha256: obs.specSha256, implementationVersion: obs.implementationVersion,
      referenceSha256, runTrigger: args.trigger, status: obs.status,
      v2Score: obs.v2 === null ? null : obs.v2.toFixed(2), band: obs.band, nPillars: obs.nPillars,
      pillarsJson: JSON.stringify(obs.pillars), benchmarksJson: JSON.stringify(obs.benchmarks),
      inputProvenanceJson: JSON.stringify({ inputs: provenance, fredErrors }),
      unavailableReason: obs.unavailableReason ?? null,
      v1Pressure: args.v1?.overallPressure ?? null,
      v1MethodologyVersion: args.v1?.verification?.methodologyVersion ?? null,
    };
  } catch (err) {
    // Failures are recorded too (spec: record all observations, including failures).
    row = {
      asOfDate: easternDate(args.now ?? new Date()), onSpecGrid: false, recordClass: "FORWARD_LIVE",
      specId: V2_SPEC_ID, specSha256: V2_SPEC_SHA256, implementationVersion: V2_IMPLEMENTATION_VERSION,
      referenceSha256: "unavailable", runTrigger: args.trigger, status: "unavailable",
      v2Score: null, band: null, nPillars: 0, pillarsJson: "[]", benchmarksJson: "{}",
      inputProvenanceJson: "{}", unavailableReason: `recorder error: ${(err as Error)?.message ?? String(err)}`,
      v1Pressure: args.v1?.overallPressure ?? null, v1MethodologyVersion: args.v1?.verification?.methodologyVersion ?? null,
    };
  }
  try {
    await db.insert(pressureV2ShadowObservations).values(row);
    log.info(`[Pressure v2 shadow] recorded ${row.asOfDate} status=${row.status} v2=${row.v2Score ?? "—"}`);
  } catch (err) {
    // Table absent until migration 0073 is applied (founder approval) — never breaks v1.
    log.warn("[Pressure v2 shadow] insert failed (migration 0073 applied?)", { err: err as Error });
  }
}
