import { fetchFredBulk, type FredObservation } from "../../fredClient";
import type { RawDraft } from "./types";

/** Fetch plan for an isolated research tick. Nothing in the public server calls this module. */
export const DAILY_FETCH_PLAN = [
  { id: "BAA10Y", role: "pillar", coverageLabel: "FULL_PUBLIC" },
  { id: "TEDRATE", role: "pillar", coverageLabel: "TED_ENDED_2022_01_21" },
  { id: "VIXCLS", role: "pillar", coverageLabel: "FULL_PUBLIC" },
  { id: "SP500", role: "pillar", coverageLabel: "FULL_PUBLIC" },
  { id: "UNRATE", role: "current_vintage_forward_only", coverageLabel: "CURRENT_VINTAGE_FORWARD_ONLY" },
  { id: "BAMLH0A0HYM2", role: "non_composite_window", coverageLabel: "FRED_WINDOW_FROM_2023_10_16" },
] as const;

export function mapFredObservations(args: {
  seriesId: string;
  observations: FredObservation[];
  ingestionTime: string;
  ingestionDate: string;
  coverageLabel: string;
  inComposite: boolean;
  vintageId: string;
  realtimeStart: string | null;
  provider: string;
}): RawDraft[] {
  const drafts: RawDraft[] = [];
  for (const observation of args.observations) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) continue;
    if (observation.date > args.ingestionDate) continue;
    if (observation.value === "." || observation.value === "") continue;
    if (!/^-?\d+(\.\d+)?$/.test(observation.value)) continue;
    drafts.push({
      seriesId: args.seriesId,
      observationDate: observation.date,
      valueText: observation.value,
      releaseTime: args.seriesId === "UNRATE" ? null : `${observation.date}T21:00:00.000Z`,
      realtimeStart: args.realtimeStart ?? observation.date,
      vintageId: args.vintageId,
      provider: args.provider,
      coverageLabel: args.coverageLabel,
      inComposite: args.inComposite,
    });
  }
  return drafts;
}

/**
 * Network fetch used only when an operator later runs an enabled research tick.
 * UNRATE rows from this adapter are the current FRED vintage at ingestion time.
 * They do not reconstruct ALFRED history, so the unemployment pillar stays unavailable
 * until a real-time vintage path covering five years is loaded.
 */
export async function fetchDailyResearchDrafts(ingestionTime: string, ingestionDate: string): Promise<RawDraft[]> {
  const bulk = await fetchFredBulk(DAILY_FETCH_PLAN.map(series => ({ id: series.id, limit: 100000, sortOrder: "asc" })));
  const drafts: RawDraft[] = [];
  for (const series of DAILY_FETCH_PLAN) {
    const observations = bulk.results[series.id]?.observations ?? [];
    const unemployment = series.id === "UNRATE";
    drafts.push(...mapFredObservations({
      seriesId: series.id,
      observations,
      ingestionTime,
      ingestionDate,
      coverageLabel: series.coverageLabel,
      inComposite: series.role !== "non_composite_window",
      vintageId: unemployment ? `FRED_CURRENT_${ingestionDate}` : "UNREVISED",
      realtimeStart: unemployment ? ingestionDate : null,
      provider: unemployment ? "FRED_CURRENT_VINTAGE" : "FRED",
    }));
  }
  return drafts;
}
