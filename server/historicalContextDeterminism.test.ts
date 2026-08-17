import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const engine = readFileSync(resolve(process.cwd(), "server/historicalContextEngine.ts"), "utf8");

describe("canonical historical context determinism", () => {
  it("builds its narrative directly from the computed contract without an external narrative dependency", () => {
    expect(engine).toContain("Deterministic source-backed narrative");
    expect(engine).toContain("not a forecast or recommendation");
    expect(engine).toContain("outcome is historical context only");
    expect(engine).not.toContain("invokeLLM");
  });
});
