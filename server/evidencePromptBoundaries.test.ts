import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sources = [
  "server/ashaEngine.ts",
  "server/ashaGateway.ts",
  "server/routers/smartDiscovery.ts",
  "server/routers/outlook.ts",
  "server/autonomousPublishing.ts",
];

describe("Phase 3 evidence-integrity prompt boundaries", () => {
  it("applies the shared evidence prompt contract at every audited current narrative boundary", () => {
    for (const relativePath of sources) {
      const source = fs.readFileSync(path.join(root, relativePath), "utf8");
      expect(source, relativePath).toContain("evidenceNarrativePromptContract");
    }
  });

  it("makes material forbidden transformations explicit in the shared instruction", () => {
    const contract = fs.readFileSync(path.join(root, "shared/evidenceContract.ts"), "utf8");
    expect(contract).toContain("Historical frequency is not current model probability");
    expect(contract).toContain("Analog similarity is not recurrence probability");
    expect(contract).toContain("No governed forecast available");
    expect(contract).toContain("Do not mix evidence from another state");
  });
});
