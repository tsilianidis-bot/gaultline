/**
 * Daily-brief engine snapshot (recordVisit / getChanges / generateBrief) and the
 * SmartDiscovery market-snapshot pressure, fail-closed.
 *
 * Only a canonical market state yields a pressure reading. In
 * deterministic-fallback mode (e.g. canonical endpoint 503) the browser engine
 * runs on DEFAULT_INDICATORS demo inputs (pressure ≈ 45), so no pressure is
 * shown and no snapshot is sent. Domain readings that are absent are null —
 * never the former 50/30/32/40 defaults.
 */
import type { EngineOutput } from "./engine";
import type { BrowserMarketMode } from "./marketStateProjection";
import { finiteOrNull } from "./displayFallbacks";

export interface EngineSnapshotPayload {
  overallPressure: number;
  regime: string;
  liquidity: number | null;
  credit: number | null;
  breadth: number;
  aiConcentration: number | null;
  volatility: number | null;
  bullProbability: number | null;
  timestamp: number;
}

/**
 * Domain lookup by family. The deterministic engine names domains by engine id
 * ("liquidity", "credit-stress"); the canonical projection names them
 * `canonical-<n>-<family slug>` with the evidence-family name as the label
 * ("Liquidity Conditions", "Credit Markets"). Exact id or exact family name
 * only — no fuzzy match, so a mixed family (e.g. "Credit and Liquidity") is
 * not read as either. Lookup only: the formulas using the score are unchanged.
 */
export type SnapshotDomainFamily = "liquidity" | "credit";
const DOMAIN_FAMILY_MATCH: Record<SnapshotDomainFamily, { engineId: string; familyNames: string[] }> = {
  liquidity: { engineId: "liquidity", familyNames: ["Liquidity Conditions"] },
  credit: { engineId: "credit-stress", familyNames: ["Credit Markets"] },
};
const familySlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function findDomainByFamily<D extends { id: string; label?: string }>(
  domains: readonly D[] | null | undefined,
  family: SnapshotDomainFamily,
): D | undefined {
  if (!domains) return undefined;
  const { engineId, familyNames } = DOMAIN_FAMILY_MATCH[family];
  const names = familyNames.map(n => n.toLowerCase());
  const slugs = familyNames.map(familySlug);
  return (
    domains.find(d => d.id === engineId) ??
    domains.find(d => {
      const m = /^canonical-\d+-(.+)$/.exec(d.id);
      return (m !== null && slugs.includes(m[1])) || (typeof d.label === "string" && names.includes(d.label.trim().toLowerCase()));
    })
  );
}

/** Canonical 0–100 pressure, or null when it is not an authoritative reading. */
export function canonicalPressure100(output: EngineOutput, marketMode: BrowserMarketMode): number | null {
  if (marketMode !== "canonical") return null;
  const score = finiteOrNull(output.overall?.score);
  return score === null ? null : Math.round(score * 10);
}

/** The snapshot to send, or null (send nothing) when pressure is unavailable. */
export function buildEngineSnapshot(
  output: EngineOutput,
  marketMode: BrowserMarketMode,
  now: number = Date.now(),
): EngineSnapshotPayload | null {
  const overallPressure = canonicalPressure100(output, marketMode);
  if (overallPressure === null) return null;
  const liquidityScore = finiteOrNull(findDomainByFamily(output.domains, "liquidity")?.score);
  const creditScore = finiteOrNull(findDomainByFamily(output.domains, "credit")?.score);
  return {
    overallPressure,
    regime: output.regime.label,
    liquidity: liquidityScore === null ? null : Math.round((10 - liquidityScore) * 10),
    credit: creditScore === null ? null : Math.round(creditScore * 10),
    breadth: Math.max(0, Math.min(100, 100 - overallPressure)),
    aiConcentration: null,
    volatility: null,
    // Withheld (NaN) → null; zod rejects NaN.
    bullProbability: finiteOrNull(output.probability?.bullProbability),
    timestamp: now,
  };
}
