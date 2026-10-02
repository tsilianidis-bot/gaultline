/* ============================================================
   Data-integrity readouts (display only, Oct 2 2026).

   1. canonicalFreshnessReadout — the "Freshness" card on WATCH / ACT. It
      follows the same customer integrity label as the page header chip
      (LIVE / CACHED / DELAYED / STALE / FALLBACK / UNAVAILABLE) and the
      canonical snapshot's own input lists. It never repeats the legacy
      marketState.freshness ("live" = cache age), which said
      "Canonical source state is live." beside DELAYED inputs.

   2. Evidence basis — the NOW / WATCH / ACT domain readings
      (marketState.why.evidenceFamilies) come from the latest MONTHLY
      pressure-history record, while the Pressure Engine vectors and the
      header strip come from the current canonical run (canonicalCurrent.engines).
      The two can differ under the same label (e.g. Labor & Rates 45 vs 28),
      so each surface states which basis it shows.

   Nothing here calculates a score, a weight or a probability.
   ============================================================ */
import type { CustomerIntegrityLabel } from "./customerIntegrityLabels";
import { snapshotEvidenceCounts, type EvidenceSnapshotLike } from "./snapshotEvidence";
import { formatEt } from "./credibilityLabels";

export interface FreshnessReadout {
  /** Same label as the page header integrity chip. */
  label: CustomerIntegrityLabel;
  detail: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function canonicalFreshnessReadout(input: {
  integrityLabel: CustomerIntegrityLabel;
  canonical: (EvidenceSnapshotLike & { generatedAt?: string | null; confidenceOrEvidenceQuality?: string | null }) | null | undefined;
}): FreshnessReadout {
  const { integrityLabel: label, canonical } = input;
  if (!canonical || label === "UNAVAILABLE") {
    return { label: "UNAVAILABLE", detail: "No canonical state is available; nothing current is shown." };
  }
  const counts = snapshotEvidenceCounts(canonical);
  const run = formatEt(canonical.generatedAt ?? null);
  const runText = run ? `Canonical run ${run}.` : "Canonical run time unavailable.";
  const parts: string[] = [];
  if (counts.delayed > 0) parts.push(`${plural(counts.delayed, "input")} delayed (publication lag)`);
  if (counts.stale > 0) parts.push(`${plural(counts.stale, "input")} stale`);
  if (counts.fallback > 0) parts.push(`${plural(counts.fallback, "input")} on fallback`);
  if (counts.unavailable > 0) parts.push(`${plural(counts.unavailable, "input")} unavailable`);
  const inputs = parts.length ? `${parts.join(", ")}.` : "No delayed, stale, fallback or unavailable inputs.";
  // The snapshot's own evidence-quality grade (e.g. PARTIAL), stated beside the inputs.
  const grade = typeof canonical.confidenceOrEvidenceQuality === "string" && canonical.confidenceOrEvidenceQuality.trim()
    ? ` Evidence quality: ${canonical.confidenceOrEvidenceQuality.trim().toUpperCase()}.`
    : "";
  return { label, detail: `${runText}${grade} ${inputs}` };
}

/** "Sep 2026" for "2026-09" / "2026-09-30"; null when not a month. */
export function formatRecordMonth(month: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(month ?? "");
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[monthIndex]} ${match[1]}`;
}

/** Caption for domain readings taken from marketState.why.evidenceFamilies. */
export function monthlyRecordBasisNote(month: string | null | undefined): string {
  const label = formatRecordMonth(month);
  return `Domain readings: latest monthly pressure-history record${label ? ` (${label})` : ""}. ` +
    "The Pressure Engine vectors are the current canonical run and can differ under the same name.";
}

/** Caption for the canonical-run vectors (Pressure Engine, header strip). */
export function canonicalRunBasisNote(generatedAt: string | null | undefined): string {
  const run = formatEt(generatedAt ?? null);
  return `Vectors: current canonical run${run ? ` (${run})` : ""}. ` +
    "NOW, WATCH and ACT domain readings use the latest monthly pressure-history record and can differ under the same name.";
}
