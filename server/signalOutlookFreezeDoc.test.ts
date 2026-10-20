/**
 * server/signalOutlook.ts stays frozen.
 *
 * scoreRisingStar multiplies a numeric social sentiment
 * (`social!.sentimentScore * 30`) and stores
 * `sentimentScore: social?.sentimentScore ?? 0`.
 * That 0 is only the frozen rising-star input when the verified snapshot
 * has no composite. The social page keeps overallSentimentScore nullable and
 * withholds the missing composite. Replacing the 0 with null would change the
 * multiplier input, so this file is not edited.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const freezeBase = "1cfa1299f6644a7eb9a60246330c7b9a13ccc433";
const source = readFileSync(new URL("./signalOutlook.ts", import.meta.url), "utf8");

describe("signalOutlook.ts remains frozen", () => {
  it("matches the freeze base and the working tree", () => {
    expect(execSync("git diff -- server/signalOutlook.ts", { encoding: "utf8" })).toBe("");
    expect(execSync(`git diff ${freezeBase} -- server/signalOutlook.ts`, { encoding: "utf8" }).trim()).toBe("");
  });

  it("keeps the numeric rising-star sentiment input", () => {
    expect(source).toContain("sentimentScore: social?.sentimentScore ?? 0");
    expect(source).toContain("social!.sentimentScore * 30");
  });
});
