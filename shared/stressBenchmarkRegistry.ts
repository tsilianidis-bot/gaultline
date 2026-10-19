/**
 * Append-only registry of preregistered stress events and benchmarks.
 * Version 1 is empty on purpose: no historical event is added after the fact.
 * A change requires a new versionId. Existing versions are not edited.
 */
export interface PreregisteredStressEvent {
  id: string;
  occurredAt: string;
  label: string;
}

export interface PreregisteredBenchmark {
  id: string;
  label: string;
}

export interface StressBenchmarkRegistry {
  versionId: string;
  /** sha256 of registryCanonicalJson, without this field. */
  contentHash: string;
  events: readonly PreregisteredStressEvent[];
  benchmarks: readonly PreregisteredBenchmark[];
}

export const STRESS_BENCHMARK_REGISTRY_V1_HASH = "593b36b087080b50eb31598e1a2e2facf3ce5bf27316c7b387b48d9abfedbe6e" as const;

export const STRESS_BENCHMARK_REGISTRY_V1: StressBenchmarkRegistry = Object.freeze({
  versionId: "stress-benchmark-registry-v1",
  contentHash: STRESS_BENCHMARK_REGISTRY_V1_HASH,
  events: Object.freeze([] as readonly PreregisteredStressEvent[]),
  benchmarks: Object.freeze([] as readonly PreregisteredBenchmark[]),
});

/** Published versions. New versions are appended. None of these objects are updated in place. */
export const PUBLISHED_STRESS_BENCHMARK_REGISTRIES: readonly StressBenchmarkRegistry[] = Object.freeze([
  STRESS_BENCHMARK_REGISTRY_V1,
]);

export function activeStressBenchmarkRegistry(): StressBenchmarkRegistry {
  return PUBLISHED_STRESS_BENCHMARK_REGISTRIES[PUBLISHED_STRESS_BENCHMARK_REGISTRIES.length - 1]!;
}

export function registryCanonicalJson(registry: Pick<StressBenchmarkRegistry, "versionId" | "events" | "benchmarks">): string {
  const events = [...registry.events]
    .map(event => ({ id: event.id, occurredAt: event.occurredAt, label: event.label }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const benchmarks = [...registry.benchmarks]
    .map(benchmark => ({ id: benchmark.id, label: benchmark.label }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ benchmarks, events, versionId: registry.versionId });
}
