import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers/institutionalMemory.ts"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Alerts.tsx"), "utf8");

describe("evidence-first Alerts Archive", () => {
  it("supports canonical event-type filtering at the server boundary", () => {
    expect(routerSource).toContain("eventType: z.string().max(96).optional()");
    expect(routerSource).toContain("eq(institutionalEvents.eventType, input.eventType)");
  });

  it("provides search, source/type filtering, and stable selected-event deep links without mutating events", () => {
    expect(pageSource).toContain('new URLSearchParams(window.location.search).get("event")');
    expect(pageSource).toContain('params.set("event", String(id))');
    expect(pageSource).toContain('aria-label="Search immutable archive"');
    expect(pageSource).toContain('aria-label="Filter immutable archive by source"');
    expect(pageSource).toContain('aria-label="Filter immutable archive by event type"');
    expect(pageSource).toContain("Original observation preserved at source time");
  });
});
