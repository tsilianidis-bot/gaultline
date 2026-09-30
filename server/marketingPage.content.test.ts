import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { landingFromSnapshot } from "../client/src/components/landing/landingPressure";
import { selectPressureSnapshot } from "../client/src/lib/pressureSnapshot";
import * as inventory from "../client/src/content/methodologyInventory";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const page = read("client/src/pages/MarketingSite.tsx");
const landingComponents = [
  "client/src/components/landing/HeroProof.tsx",
  "client/src/components/landing/PentagonalThesis.tsx",
  "client/src/components/landing/HistoricalContext.tsx",
  "client/src/components/landing/landingPressure.ts",
  "client/src/components/landing/useLandingPressure.ts",
].map(read);
/** Everything a visitor can read on the landing page. */
const landing = [page, ...landingComponents].join("\n");
const methodology = read("client/src/pages/Methodology.tsx");
const fullInventory = read("client/src/components/methodology/FullInventory.tsx");
const inventorySource = read("client/src/content/methodologyInventory.ts");
const app = read("client/src/App.tsx");

describe("Marketing page positioning guardrails", () => {
  it("contains one canonical hero and the systemic-risk positioning", () => {
    expect((page.match(/function Hero\(/g) ?? [])).toHaveLength(1);
    expect((landing.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect(page).toContain("See the fault before the break.");
    expect(page).toContain("EXPLORE FAULTLINE");
    expect(page).toContain("VIEW METHODOLOGY");
    expect(page).toContain('const EXPLORE_HREF = "/pressure-index"');
    expect(page).toContain('const METHOD_HREF = "/methodology"');
  });

  it("does not present unsupported historical warnings or competing score claims", () => {
    expect(landing).toContain("NOT A RETROSPECTIVE RECONSTRUCTION OF LIVE WARNINGS");
    expect(landing).not.toMatch(/funds with the pressure read|top funds were already positioned|the read was there before the headlines/i);
    expect(landing).not.toMatch(/Lehman Collapse|COVID Crash|94\s*\/\s*100|82\s*\/\s*100|91\s*\/\s*100|72\s*\/\s*100/);
    expect(landing).not.toMatch(/back-tested for 25 years|predicted the/i);
  });

  it("keeps checkout off the landing page and avoids a fake live score", () => {
    expect(page).toContain('id="access"');
    expect(page).toContain("Checkout is not offered on this page.");
    expect(landing).not.toContain("MARKETING_TIER_CARDS");
    expect(landing).not.toMatch(/SIGNALS ACTIVE|TREASURY STRESS: ELEVATED/);
    expect(landing).not.toMatch(/\$299|\$59|\$99|\$49/);
    // No hard-coded score: every number shown comes from the canonical reading.
    expect(landing).not.toMatch(/pressureIndex\s*\?\?\s*\d/);
    expect(landing).not.toMatch(/score\s*\?\?\s*\d/);
  });

  it("uses PLATO as the customer-facing interpreter and does not name ASHA", () => {
    expect(page).toContain("PLATO market explanation");
    expect(landing).not.toContain("ASHA");
  });

  it("keeps the founder note verbatim and points both CTAs at public destinations", () => {
    expect(page).toContain("A NOTE FROM THE FOUNDER");
    expect(page).toContain("— JT");
    expect(page).toContain("The goal isn't to tell you what to buy or sell.");
    expect(page).toContain('["Future intelligence", "/methodology#future"]');
  });
});

describe("Landing page structure", () => {
  it("renders the sections in the agreed order", () => {
    const main = page.slice(page.indexOf('<main id="main">'), page.indexOf("</main>"));
    const order = ["<Hero />", "<PentagonalThesis />", "<Pressure />", "<HistoricalContext />", "<Plato />", "<Capabilities />", "<TrustTeaser />", "<FinalCta />"];
    const positions = order.map((tag) => main.indexOf(tag));
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect((main.match(/<[A-Z][A-Za-z]+ \/>/g) ?? [])).toHaveLength(order.length);
  });

  it("keeps the landing-section ids used by App.tsx placements", () => {
    for (const id of ["methodology", "pressure", "plato", "analogs", "stack", "access", "thesis"]) {
      expect(landing, id).toContain(`id="${id}"`);
    }
  });

  it("links the Blog and Daily Brief to routes that exist", () => {
    expect(page).toContain('const DAILY_BRIEF_HREF = "/daily-brief"');
    expect(page).toContain('const BLOG_HREF = "/blog"');
    expect(app).toContain('<Route path="/daily-brief">');
    expect(app).toContain('<Route path="/blog">');
    expect(app).toContain('<Route path="/methodology">');
    expect(app).toContain('<Route path="/pressure-index">');
    expect(app).toContain('<Route path="/trust">');
  });

  it("keeps sign-in secondary to the public Pressure Index", () => {
    expect(page).toContain("function SignInCta");
    expect(page).toContain("handleLoginCtaClick");
    expect(page).not.toMatch(/href=\{getLoginUrl\(\)\}/);
  });
});

describe("Pentagonal Thesis section", () => {
  const thesis = read("client/src/components/landing/PentagonalThesis.tsx");

  it("asks exactly the five questions, in order", () => {
    const questions = [...thesis.matchAll(/question: "([^"]+)"/g)].map((m) => m[1]);
    expect(questions).toEqual([
      "What's happening?",
      "Why is it happening?",
      "What's next?",
      "What should I watch?",
      "What should I do?",
    ]);
    expect(landing).not.toMatch(/four questions|four-question|4 questions/i);
    expect(thesis).toContain("THE PENTAGONAL THESIS™");
  });

  it("ties each question to implemented capabilities", () => {
    expect(thesis).toContain("Faultline Pressure Index™: a 0–100 composite");
    expect(thesis).toContain("sre-hmm2");
    expect(thesis).toContain("Vector drivers");
    expect(thesis).toContain("PLATO interpretation");
    expect(thesis).toContain("Regime transitions");
    expect(thesis).toContain("Aftershock and contagion map");
    expect(thesis).toContain("Development timelines");
    expect(thesis).toContain("Cross-market alignment: equity regime versus crypto regime.");
    expect(thesis).toContain("watchlist and the daily intelligence brief");
    expect(thesis).toContain("A decision framework");
  });

  it("frames 'what next' as scenario context and 'what to do' as not advice", () => {
    expect(thesis).toContain("scenario context, not a forecast or a probability");
    expect(thesis).toContain("Not investment advice.");
    expect(thesis).toMatch(/does not give personalised recommendations/);
  });

  it("is accessible: the SVG has a title and description and the questions are real text", () => {
    expect(thesis).toMatch(/role="img"/);
    expect(thesis).toContain("<title id={titleId}>The Pentagonal Thesis™</title>");
    expect(thesis).toContain("<desc id={descId}>");
    expect(thesis).toContain('<h3 className="text-xl font-semibold text-white">{item.question}</h3>');
  });
});

describe("Hero product proof", () => {
  const hero = read("client/src/components/landing/HeroProof.tsx");
  const derive = (data: unknown, isLoading = false, error: unknown = null) =>
    landingFromSnapshot(selectPressureSnapshot({ data: data as any, isLoading, error }));
  const baseState = {
    stateId: "state:landing-test",
    stateHash: "hash:landing-test",
    generatedAt: "2026-09-30T08:05:00.000Z",
    effectiveAt: "2026-09-30T08:00:00.000Z",
    pressureIndex: 47,
    regime: "ELEVATED RISK",
    confidenceOrEvidenceQuality: "HEALTHY",
    provenance: { coherenceStatus: "COHERENT" },
    dataQualitySummary: { fallbackInputCount: 0, staleInputCount: 0 },
    engines: [{ engineId: "liquidity-stress", value: 52, qualityStatus: "HEALTHY", sourceInputIds: [] }],
  };

  it("reads one snapshot from the same public query as /pressure-index (PR #40)", () => {
    expect(read("client/src/components/landing/useLandingPressure.ts")).toContain("usePressureSnapshot()");
    expect(read("client/src/hooks/usePressureSnapshot.ts")).toContain("trpc.marketState.canonicalCurrent.useQuery");
    expect(landing).not.toContain("marketState.canonicalCurrent.useQuery");
  });

  it("does not animate a ring or counter from 0", () => {
    expect(hero).not.toMatch(/requestAnimationFrame|AnimatedNumber|useState\(0\)|strokeDashoffset/);
  });

  it("has explicit loading and unavailable states and shows the as-of time", () => {
    expect(hero).toContain("Loading the latest reading…");
    expect(hero).toContain("Reading unavailable");
    expect(hero).toContain("withholds the score instead of showing a placeholder");
    expect(hero).toContain("<time dateTime={reading.asOf}>");
  });

  it("never turns a missing reading into a number", () => {
    expect(derive(undefined, true)).toEqual({ status: "loading" });
    expect(derive(null).status).toBe("unavailable");
    expect(derive(undefined, false, new Error("offline")).status).toBe("unavailable");
    expect(derive({ ...baseState, pressureIndex: null }).status).toBe("unavailable");
    expect(derive({ ...baseState, confidenceOrEvidenceQuality: "UNAVAILABLE" }).status).toBe("unavailable");
  });

  it("uses engine band labels, the as-of time and an honest freshness label", () => {
    const result = derive(baseState);
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.score).toBe(47);
    expect(result.band).toBe("ELEVATED RISK");
    expect(result.bandRange).toBe("45–64");
    expect(result.asOf).toBe("2026-09-30T08:00:00.000Z");
    // LIVE is reserved for truly live evidence; a persisted snapshot is not.
    expect(result.integrity).not.toBe("LIVE");
    expect(result.vectors.find((v) => v.id === "liquidity-stress")?.value).toBe(52);
    expect(result.vectors.find((v) => v.id === "credit-contagion")?.value).toBeNull();
    const top = derive({ ...baseState, pressureIndex: 83, regime: "SYSTEMIC CRISIS" });
    expect(top.status === "available" && top.band).toBe("SYSTEMIC CRISIS");
    const high = derive({ ...baseState, pressureIndex: 70, regime: "HIGH STRESS" });
    expect(high.status === "available" && high.band).toBe("HIGH STRESS");
    expect(landing).not.toMatch(/"(High|Critical)"/);
  });
});

describe("Historical context and PLATO example use real data or say so", () => {
  const history = read("client/src/components/landing/HistoricalContext.tsx");

  it("describes analogs as resemblance tests against hand-set reference profiles", () => {
    for (const year of ["1973", "1998", "2000", "2008", "2020", "2022"]) expect(history).toContain(`["${year}",`);
    expect(history).toContain("hand-set reference profiles");
    expect(history).toContain("It is a resemblance test, not a forecast");
    expect(history).toContain("trpc.pressure.getHistoricalContext.useQuery");
    expect(history).toContain("Current analog output unavailable");
  });

  it("shows no fabricated PLATO output", () => {
    expect(page).toContain("STATIC DESCRIPTION · NOT LIVE PLATO OUTPUT");
    expect(page).toContain("No public endpoint publishes PLATO output, so this page shows no PLATO text.");
    expect(page).not.toMatch(/PLATO says|“[^”]{20,}”\s*—\s*PLATO/);
  });
});

describe("Moved disclosures stay public on /methodology", () => {
  it("renders the full inventory on the methodology page", () => {
    expect(methodology).toContain('import FullInventory from "@/components/methodology/FullInventory"');
    expect(methodology).toContain("<FullInventory />");
    for (const name of [
      "pipeline", "stack", "futureItems", "experiences", "weights", "sources", "analogs", "researchWindows",
      "faqs", "crossMarket", "methodologyNotes", "analogMethod", "sourcesIntro", "validationParagraphs",
      "validationClosing", "limitations", "NOT_LIVE_WARNINGS_LABEL",
    ]) {
      expect(inventory, name).toHaveProperty(name);
      expect(fullInventory, name).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("keeps every inventory entry that used to be on the landing page", () => {
    expect(inventory.pipeline).toHaveLength(8);
    expect(inventory.stack.map((g) => g.label)).toEqual([
      "Core risk engine", "Macro intelligence", "Credit intelligence", "Equity and market structure",
      "Rates and fixed income", "Crypto intelligence", "Historical intelligence", "Interpretation",
    ]);
    expect(inventory.futureItems).toHaveLength(13);
    expect(inventory.experiences).toHaveLength(7);
    expect(inventory.weights).toHaveLength(6);
    expect(inventory.sources.map((s) => s[0])).toEqual(["Federal Reserve / FRED", "Polygon", "Yahoo quotes", "CoinGecko"]);
    expect(inventory.analogs).toHaveLength(10);
    expect(inventory.researchWindows).toHaveLength(6);
    expect(inventory.limitations).toHaveLength(7);
    expect(inventory.faqs).toHaveLength(3);
    expect(inventorySource).toContain("A 2024–2025 analog period. It is not in the fingerprint library.");
    expect(inventorySource).toContain("Calibrated crash probabilities.");
    expect(inventorySource).toContain("The code marks that case raw recreation not defensible.");
    expect(inventorySource).toContain("Nothing on this page is a solicitation or a personal recommendation.");
    expect(inventorySource).toContain("FAULTLINE does not call BLS, BEA, or Treasury.gov directly.");
  });

  it("no longer carries the exhaustive inventories on the landing page", () => {
    expect(landing).not.toContain("const futureItems");
    expect(landing).not.toContain("const sources");
    expect(landing).not.toContain("const stack");
    expect(landing).not.toContain("Cached in the crypto engine");
    expect(landing).toContain("/methodology#sources");
    expect(landing).toContain("/methodology#limitations");
  });
});
