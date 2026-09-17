import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Pentagonal Thesis canonical identity", () => {
  it("answers What / Why / Next / Watch / Do from the same canonicalCurrent authority", () => {
    const surfaces = [
      ["NOW", "client/src/pages/Now.tsx"],
      ["WHY", "client/src/pages/Why.tsx"],
      ["OUTLOOK", "client/src/pages/Outlook.tsx"],
      ["WATCH", "client/src/pages/Watch.tsx"],
      ["ACT", "client/src/pages/Act.tsx"],
    ] as const;

    const engine = source("client/src/contexts/EngineContext.tsx");
    expect(engine).toContain("marketState.canonicalCurrent");
    expect(engine).toContain("canonicalEnvelope");

    for (const [name, path] of surfaces) {
      const text = source(path);
      expect(text, `${name} must consume EngineContext canonical authority`).toContain("useEngine()");
    }
  });

  it("does not present PLATO as a separate implemented product", () => {
    const marketing = source("client/src/pages/MarketingSite.tsx");
    expect(marketing).toContain("Pentagonal Thesis");
    expect(marketing).not.toContain("PLATO");
  });
});
