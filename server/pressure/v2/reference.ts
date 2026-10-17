// Loads the frozen v2 reference dataset (see scripts/pressure-v2/build_reference.py).
// Bundled into the server build via a static-path dynamic import (the runtime
// image ships only dist/), loaded lazily on first use by the scheduled recorder.
import { createHash } from "node:crypto";
import type { DatedSeries, V2Data, WeeklyPanel } from "./engine";

export interface V2Reference {
  specId: string;
  specSha256: string;
  cutoff: string;
  sources: Record<string, string>;
  daily: Record<"credit" | "funding" | "vol" | "mkt", DatedSeries>;
  spxClose: DatedSeries;
  weekly: WeeklyPanel & { v2: (number | null)[] };
}

let cached: { ref: V2Reference; sha256: string } | null = null;

/** sha256 of JSON.stringify(reference) — a stable content fingerprint recorded with each observation. */
export function fingerprintReference(ref: V2Reference): string {
  return createHash("sha256").update(JSON.stringify(ref)).digest("hex");
}

export async function loadV2Reference(): Promise<{ ref: V2Reference; sha256: string }> {
  if (cached) return cached;
  const mod: any = await import("./reference/v2-reference-2026-09-11.json");
  const ref = (mod.default ?? mod) as V2Reference;
  cached = { ref, sha256: fingerprintReference(ref) };
  return cached;
}

/** Point-in-time weekly Sahm values from the reference (non-null only). */
export function referenceMacroWeekly(ref: V2Reference): DatedSeries {
  const dates: string[] = [], values: number[] = [];
  ref.weekly.date.forEach((d, i) => { const v = ref.weekly.macro_raw[i]; if (v !== null) { dates.push(d); values.push(v); } });
  return { dates, values };
}

export function referenceV2Data(ref: V2Reference): V2Data {
  return { daily: ref.daily, macroWeekly: referenceMacroWeekly(ref), weekly: ref.weekly };
}
