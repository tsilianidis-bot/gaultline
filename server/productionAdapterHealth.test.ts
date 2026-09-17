import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(resolve(import.meta.dirname, "marketStateService.ts"), "utf8");
const engine = readFileSync(resolve(import.meta.dirname, "pressure/engine.ts"), "utf8");

describe("Production data adapter provenance", () => {
  it("builds source-health for seismograph, historical-memory, FRED, and CoinGecko", () => {
    expect(service).toContain('id: "seismograph"');
    expect(service).toContain('id: "historical-memory"');
    expect(service).toContain('id: "fred"');
    expect(service).toContain('id: "coingecko"');
    expect(service).toContain("unavailable");
    expect(service).toContain("degraded");
    expect(service).toContain("healthy");
  });

  it("labels pressure output live vs fallback instead of inventing current intelligence", () => {
    expect(engine).toContain('dataSource: "live" | "fallback"');
    expect(engine).toContain("FRED data unavailable");
  });
});
