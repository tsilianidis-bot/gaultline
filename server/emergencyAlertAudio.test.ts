import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

describe("emergency-only ASHA audio boundaries", () => {
  it("does not auto-start ambient sound in the normal Smart Discovery workspace", () => {
    const source = readFileSync(resolve(root, "client/src/pages/SmartDiscovery.tsx"), "utf8");
    expect(source).not.toContain("new AshaAmbientEngine");
    expect(source).not.toContain("engine.start(0.42)");
  });

  it("requires exact EMERGENCY severity and has retrigger protection", async () => {
    const source = readFileSync(resolve(root, "client/src/lib/EmergencyAlertAudio.ts"), "utf8");
    expect(source).toContain('severity !== "EMERGENCY"');
    expect(source).toContain("cooldownMs = 30_000");
    expect(source).toContain("oscillator.stop(start + 0.8)");
    expect(source).not.toContain("loop = true");
  });
});
