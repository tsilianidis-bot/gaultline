import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Time Machine retrospective claims", () => {
  it("does not publish a first-warning lead-time field or claim a contemporaneous replay", () => {
    const page = read("client/src/pages/TimeMachine.tsx");
    const router = read("server/routers/timeMachine.ts");
    const combined = `${page}\n${router}`.toLowerCase();

    expect(combined).not.toContain("firstwarningmonth");
    expect(combined).not.toContain("would have known");
    expect(combined).not.toContain("same methodology");
    expect(combined).not.toContain("no look-ahead bias");
    expect(combined).toContain("retrospective reconstruction");
    expect(combined).toContain("not a point-in-time replay");
    expect(combined).toContain("not a record of contemporaneous");
    expect(combined).not.toContain("view live pressure index");
    expect(combined).not.toContain("view full track record");
    expect(page).toContain("Open Pressure Index");
    expect(page).toContain("Open Observed History");
  });
});
