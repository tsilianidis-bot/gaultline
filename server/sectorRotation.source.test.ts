/** Source checks: where the Sector Rotation layer renders, and what it may not depend on. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_DESTINATIONS } from "../shared/routeRegistry";

const root = resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(resolve(root, p), "utf8");
const MODULE = "client/src/components/sectorRotation/SectorRotationModule.tsx";
const SERVER_FILES = ["server/sectorRotation/calc.ts", "server/sectorRotation/service.ts", "server/sectorRotation/collector.ts", "server/sectorRotation/snapshotStore.ts", "server/sectorRotation/universe.ts", "server/routers/sectorRotation.ts", "shared/sectorRotation.ts"];

describe("Sector Rotation renders inside the Pentagonal Thesis (no sixth question)", () => {
  it("keeps exactly the five canonical questions", () => {
    expect(CANONICAL_DESTINATIONS.map(d => d.id)).toEqual(["now", "why", "outlook", "watch", "act"]);
  });
  it("NOW renders the Map immediately beneath the hero command center, after the fail-closed guard", () => {
    const now = src("client/src/pages/Now.tsx");
    const map = now.indexOf("<SectorRotationMap />");
    expect(map).toBeGreaterThan(now.indexOf('data-now-section="verdict"'));
    expect(map).toBeGreaterThan(now.indexOf("if (!marketState || !canonicalState)"));
    expect(map).toBeLessThan(now.indexOf("<WhatChangedPanel"));
    expect(now.slice(now.lastIndexOf("</section>", map), map)).not.toMatch(/<section|<Section /);
  });
  it.each([
    ["client/src/pages/Why.tsx", "why"], ["client/src/pages/Outlook.tsx", "outlook"],
    ["client/src/pages/Watch.tsx", "watch"], ["client/src/pages/Act.tsx", "act"],
  ])("%s renders its question slice before section 01", (path, q) => {
    const page = src(path);
    const at = page.indexOf(`<SectorRotationQuestion question="${q}" />`);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(page.indexOf('index="01"'));
    expect(page).toContain('from "@/components/sectorRotation/SectorRotationModule"');
  });
  it("the Map module carries the four quadrants, arrows, WHY IT MATTERS and the movers panel beneath the Map", () => {
    const m = src(MODULE);
    expect(m).toContain("FAULTLINE Sector Rotation Map™");
    for (const q of ['"LEADING"', '"IMPROVING"', '"LOSING MOMENTUM"', '"LAGGING"']) expect(m).toContain(q);
    expect(m).toContain("ARROW_GLYPH");
    expect(m).toContain("Why it matters: ");
    const mapFn = m.slice(m.indexOf("export function SectorRotationMap"));
    expect(mapFn.indexOf("<RotationMap")).toBeLessThan(mapFn.indexOf("data-why-it-matters"));
    expect(mapFn.indexOf("data-why-it-matters")).toBeLessThan(mapFn.indexOf("<MoversPanel"));
    expect(m).toContain("lg:grid-cols-2"); // two-column movers on desktop, stacked on mobile
    expect(m).toContain("Today's Top 5 Winners / Top 5 Losers");
  });
});

describe("Sector Rotation is data-first and has no demo / fallback / LLM path", () => {
  it("the client module only renders server data (allowlisted imports, no computation sources)", () => {
    const m = src(MODULE);
    const imports = Array.from(m.matchAll(/from "([^"]+)"/g)).map(x => x[1]);
    expect(imports.sort()).toEqual(["@/lib/trpc", "@shared/credibilityLabels", "@shared/routeRegistry", "@shared/sectorRotation", "lucide-react", "react", "wouter"].sort());
    expect(m).not.toMatch(/Math\.random|DEFAULT_INDICATORS|useDemo|\.probabilities|scenarioOutputs|probabilityContract/);
  });
  it("server code imports no LLM, demo universe, email, shadow or ledger module; the only DB write is the snapshot INSERT", () => {
    for (const f of SERVER_FILES) {
      const s = src(f);
      expect(s, f).not.toMatch(/_core\/llm|invokeLLM|signalOutlook|tradePreflight|altRotationEngine|signalsProxy|DemoContext|client\/src\/lib|\.\/email|scheduledShadowModel|recordShadow|shadowModel|decisionLedger|governedIntelligence/);
      expect(s.replace('createHash("sha256").update(', ""), f).not.toMatch(/\.update\(|\.delete\(|onDuplicateKeyUpdate|\.replace\(marketMemory|Math\.random/);
      if (f !== "server/sectorRotation/snapshotStore.ts") expect(s, f).not.toMatch(/(?<!store)\.insert\(|getDb|from "\.\.\/db"|drizzle/);
    }
    const store = src("server/sectorRotation/snapshotStore.ts");
    expect(Array.from(store.matchAll(/\.insert\(/g))).toHaveLength(1);
    expect(store).toContain(".insert(marketMemory)");
  });
  it("B1: the query reads only the saved snapshot; page loads cannot reach the collector or providers", () => {
    const r = src("server/routers/sectorRotation.ts");
    expect(r).toMatch(/import \{ getServedSectorRotation \} from "\.\.\/sectorRotation\/service"/);
    const code = r.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/collect|buildSectorRotationReading|tick\(|fetch\(|getDailyChart/);
    expect(code).toContain("current: publicProcedure.query(() => getServedSectorRotation())");
    const svc = src("server/sectorRotation/service.ts");
    const served = svc.slice(svc.indexOf("export function getServedSectorRotation"));
    expect(served.slice(0, served.indexOf("}") + 1)).toMatch(/sectorRotationCollector\.served\(\)/);
    const col = src("server/sectorRotation/collector.ts");
    const servedFn = col.slice(col.indexOf("async served("), col.indexOf("\n  }\n", col.indexOf("async served(")));
    expect(servedFn).not.toMatch(/tick\(|collect\(|build\(|runBuild|insert\(/);
    expect(src("server/_core/index.ts")).toMatch(/startSectorRotationCollector\(\)/);
  });
  it("B1: the sector query is its own (non-batched) request so it can never stall the page's other queries", () => {
    const main = src("client/src/main.tsx");
    expect(main).toMatch(/splitLink\(/);
    expect(main).toMatch(/op\.context\.skipBatch === true/);
    expect(main).toMatch(/true: httpLink\(/);
    expect(src(MODULE)).toMatch(/context: \{ skipBatch: true \}/);
  });
  it("calc is pure: no fetch, no clock reads", () => {
    const calc = src("server/sectorRotation/calc.ts");
    expect(calc).not.toMatch(/\bfetch\(|Date\.now\(|new Date\(\)/);
  });
  it("adds no env var or secret (only the existing POLYGON_API_KEY is read)", () => {
    for (const f of SERVER_FILES) {
      const envs = Array.from(src(f).matchAll(/process\.env\.([A-Z_]+)/g)).map(x => x[1]);
      expect(envs.every(e => e === "POLYGON_API_KEY"), f).toBe(true);
    }
  });
  it("the Yahoo daily chart adapter has no Polygon or placeholder fallback", () => {
    const y = src("server/yahooProxy.ts");
    const fn = y.slice(y.indexOf("export async function getDailyChart"), y.indexOf("// ── Yahoo fetcher"));
    expect(fn).not.toMatch(/polygon|getQuote|fetchQuoteWithFallback/i);
    expect(fn).toContain("error: message");
  });
  it("ships no migration for sector rotation (snapshots use the existing marketMemory table)", () => {
    const files = readdirSync(resolve(root, "drizzle"), { recursive: true }).map(String);
    for (const f of files.filter(f => /\.(sql|ts|json)$/.test(f))) expect(src(`drizzle/${f}`), f).not.toMatch(/sector_rotation|sectorRotation/i);
    expect(src("docs/sector-rotation/STORAGE_PROPOSAL.md")).toMatch(/append-only/i);
    expect(src("server/routers/seismograph.ts")).toMatch(/notLike\(marketMemory\.memoryKey, "sector-rotation:%"\)/);
  });
});
