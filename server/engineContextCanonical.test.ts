import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/contexts/EngineContext.tsx"),
  "utf8",
);

describe("EngineContext Phase 2D canonical transport", () => {
  it("uses canonical state as the upstream current-state authority", () => {
    expect(source).toContain("trpc.marketState.canonicalCurrent.useQuery");
    expect(source).toContain("enabled: Boolean(canonicalStateQuery.data)");
    expect(source).toContain("if (!canonicalState) return null;");
    expect(source).toContain("const canonicalState = canonicalStateQuery.data ?? null");
  });

  it("exposes canonical identity and projects core score/regime from that state", () => {
    expect(source).toContain("canonicalState: PublicCanonicalIntelligenceState | null");
    expect(source).toContain("pressureScore = canonicalState.pressureIndex");
    expect(source).toContain("regime = canonicalState.regime");
    expect(source).toContain("canonicalState,");
  });

  it("exposes a reusable canonical consumer envelope around compatibility data", () => {
    expect(source).toContain("createCanonicalConsumerEnvelope");
    expect(source).toContain("canonicalEnvelope: CanonicalConsumerEnvelope<CanonicalMarketState> | null");
    expect(source).toContain("if (!canonicalState || !marketState) return null;");
    expect(source).toContain("canonicalEnvelope,");
  });

  it("does not silently return a legacy-shaped current state when canonical state is unavailable", () => {
    const canonicalGuard = source.indexOf("if (!canonicalState) return null;");
    const legacyProjectionRead = source.indexOf("const legacy = legacyProjectionQuery.data;");
    expect(canonicalGuard).toBeGreaterThan(-1);
    expect(legacyProjectionRead).toBeGreaterThan(canonicalGuard);
  });
});
