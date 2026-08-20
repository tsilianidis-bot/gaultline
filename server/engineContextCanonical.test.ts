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
  });

  it("exposes canonical identity and projects core score/regime from that state", () => {
    expect(source).toContain("canonicalState: PublicCanonicalIntelligenceState | null");
    expect(source).toContain("pressureScore = canonicalState.pressureIndex");
    expect(source).toContain("regime = canonicalState.regime");
    expect(source).toContain("canonicalState,");
  });
});
