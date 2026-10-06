import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { landingFromSnapshot } from "../client/src/components/landing/landingPressure";
import { selectPressureSnapshot } from "../client/src/lib/pressureSnapshot";
import * as inventory from "../client/src/content/methodologyInventory";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ThesisSection from "../client/src/components/landing/thesis/ThesisSection";
import WorkedExampleView from "../client/src/components/landing/thesis/WorkedExampleView";
import { THESIS_CLOSING, THESIS_INTRO, THESIS_QUESTIONS } from "../client/src/components/landing/thesis/thesisContent";
import { buildWorkedExample, ILLUSTRATIVE, ILLUSTRATIVE_LABEL } from "../client/src/components/landing/thesis/workedExample";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const page = read("client/src/pages/MarketingSite.tsx");
const landingComponents = [
  "client/src/components/landing/HeroProof.tsx",
  "client/src/components/landing/PentagonalThesis.tsx",
  "client/src/components/landing/thesis/thesisContent.ts",
  "client/src/components/landing/thesis/ThesisSection.tsx",
  "client/src/components/landing/thesis/workedExample.ts",
  "client/src/components/landing/thesis/WorkedExampleView.tsx",
  "client/src/components/landing/thesis/WorkedExample.tsx",
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
    expect(page).toContain("See the pressure before the break.");
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

  it("leads with the Case File while keeping Market Tools as a secondary capability layer", () => {
    expect(page).toContain("FAULTLINE CASE FILE");
    expect(page).toContain("One market state. Five questions. One evidence trail.");
    expect(page).toContain("The Case File is the primary FAULTLINE experience.");
    expect(page).toContain('title: "Market Tools"');
    expect(page).toContain("Symbol Intelligence");
    expect(page).toContain("Day Trade Intelligence");
    expect(page).toContain("Rising Stars");
    expect(page).toContain("watchlists, alerts, and trade-journal workflows");
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
    const order = ["<Hero />", "<CaseFilePositioning />", "<PentagonalThesis />", "<Pressure />", "<HistoricalContext />", "<Plato />", "<Capabilities />", "<TrustTeaser />", "<FinalCta />"];
    const positions = order.map((tag) => main.indexOf(tag));
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect((main.match(/<[A-Z][A-Za-z]+ \/>/g) ?? [])).toHaveLength(order.length);
  });

  it("keeps the landing-section ids used by App.tsx placements", () => {
    for (const id of ["case-file", "methodology", "pressure", "plato", "analogs", "stack", "access", "thesis"]) {
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
  const section = read("client/src/components/landing/thesis/ThesisSection.tsx");
  const composition = read("client/src/components/landing/PentagonalThesis.tsx");
  const html = renderToStaticMarkup(createElement(ThesisSection));
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

  it("uses James's intro, five headings with their taglines, and the closing line", () => {
    expect(THESIS_INTRO.heading).toBe("Five questions. A clearer way to read the market.");
    expect(THESIS_INTRO.body).toBe("Market data tells you what moved. FAULTLINE connects the conditions, drivers, possible outcomes, and signals that matter—so you can make a more informed decision.");
    expect(THESIS_QUESTIONS.map((q) => [q.question, q.tagline])).toEqual([
      ["What's happening?", "Understand the market you're in."],
      ["Why?", "Understand what's driving it."],
      ["What's next?", "Understand the possible paths ahead."],
      ["What should I watch?", "Know what would change the outlook."],
      ["What should I do?", "Turn the outlook into a risk-aware decision."],
    ]);
    expect(THESIS_CLOSING).toBe("Each answer informs the next. Together, they form the Pentagonal Thesis™—FAULTLINE's framework for connecting market pressure to informed decisions.");
    expect(landing).not.toMatch(/four questions|four-question|4 questions/i);
  });

  it("renders every heading, tagline, body, mapping, option and note as visible text", () => {
    expect(text).toContain(THESIS_INTRO.heading);
    expect(text).toContain(THESIS_INTRO.body);
    expect(text).toContain(THESIS_CLOSING);
    for (const q of THESIS_QUESTIONS) {
      expect(text, q.id).toContain(q.question);
      expect(text, q.id).toContain(q.tagline);
      expect(text, q.id).toContain(q.body);
      for (const line of q.shows) expect(text, line).toContain(line);
      for (const option of q.options ?? []) expect(text).toContain(option.tradeoff);
      if (q.note) expect(text).toContain(q.note);
    }
    expect((html.match(/<h3\b/g) ?? [])).toHaveLength(5);
    expect(html).toContain('id="thesis"');
  });

  it("hides no core copy behind tooltips, accordions or disclosure widgets", () => {
    for (const source of [section, composition, read("client/src/components/landing/thesis/WorkedExampleView.tsx")]) {
      expect(source).not.toMatch(/<details|<summary|Tooltip|Popover|Accordion|Collapsible|HoverCard|aria-expanded|data-state=|line-clamp|truncate\b/);
    }
    // No title-attribute tooltips in the rendered markup (the SVG <title> element is the graphic's accessible name).
    const exampleHtml = renderToStaticMarkup(createElement(WorkedExampleView, { model: buildWorkedExample({ status: "loading" }, { status: "loading" }, { status: "loading" }) }));
    for (const markup of [html, exampleHtml]) expect(markup).not.toMatch(/\stitle="/);
    // Hover only highlights the pentagon; it never gates copy.
    expect(section).not.toMatch(/active\s*&&\s*\(?\s*<p|active\s*\?\s*<p/);
  });

  it("matches product claims to what the code implements", () => {
    const all = THESIS_QUESTIONS.map((q) => [q.body, ...q.shows, q.note ?? ""].join(" ")).join(" ");
    // No positioning input exists (Why.tsx states it); it is replaced by real inputs.
    expect(all).not.toMatch(/investor positioning/i);
    expect(THESIS_QUESTIONS[1].body).toContain("liquidity, funding rates, interest rates, credit stress, inflation, or the labor market");
    // Scenario scores are arithmetic; HMM probabilities are labelled as model-internal.
    expect(all).toContain("not calibrated probabilities");
    expect(all).toContain("They describe the model, not the odds of a crash.");
    expect(all).not.toMatch(/evidence-backed scenarios|crash probability/i);
    expect(all).toContain("sre-hmm2");
    // ACT options and boundaries.
    expect(THESIS_QUESTIONS[4].body).toContain("maintaining exposure, keeping participation conditional, reducing risk, or waiting for confirmation");
    expect(all).toContain("DEFENSIVE, BALANCED or OPPORTUNISTIC");
    expect(all).toContain("Not investment advice.");
    expect(all).toMatch(/does not give personalised recommendations/);
  });

  it("keeps the pentagon, accessibly labelled", () => {
    expect(section).toMatch(/role="img"/);
    expect(section).toContain("<title id={titleId}>The Pentagonal Thesis™</title>");
    expect(section).toContain("<desc id={descId}>");
    expect(html).toContain('data-pentagon="full"');
    expect(html).toContain('data-pentagon="compact"');
  });

  it("is self-contained and leaves the seismic underlay to the page", () => {
    expect(composition).toContain('import ThesisSection from "./thesis/ThesisSection"');
    expect(composition).toContain('import WorkedExample from "./thesis/WorkedExample"');
    expect(landingComponents.slice(1, 7).join("\n")).not.toContain("SeismicUnderlay");
    expect(page).toContain("<SeismicUnderlay");
  });
});

describe("Worked example: live where public, illustrative where not", () => {
  const view = read("client/src/components/landing/thesis/WorkedExampleView.tsx");
  const state = {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: "state:example-test",
    stateHash: "hash:example-test",
    generatedAt: "2026-09-30T08:05:00.000Z",
    effectiveAt: "2026-09-30T08:00:00.000Z",
    pressureIndex: 51,
    regime: "ELEVATED RISK",
    confidenceOrEvidenceQuality: "HEALTHY",
    provenance: { coherenceStatus: "COHERENT" },
    dataQualitySummary: { status: "HEALTHY", fallbackInputCount: 0, staleInputCount: 1, delayedInputCount: 0, unavailableInputCount: 0 },
    staleInputs: ["x"], delayedInputs: [], fallbackInputs: [], unavailableInputs: [], warnings: [], conflicts: [],
    engines: [
      ["liquidity-stress", 48], ["credit-contagion", 44], ["volatility-regime", 57],
      ["macro-sensitivity", 55], ["market-breadth", 41], ["ai-bubble", 62],
    ].map(([engineId, value]) => ({ engineId, value, qualityStatus: "HEALTHY", direction: "Improving", sourceInputIds: engineId === "ai-bubble" ? ["ai_concentration_static_baseline"] : [] })),
  };
  const snap = (data: unknown, isLoading = false, error: unknown = null) => selectPressureSnapshot({ data: data as any, isLoading, error });
  const hmm = { currentRegime: "NORMAL", regimeConfidence: 0.91, transitionProbability: 0.02, freshnessStatus: "CURRENT", dataAsOf: "2026-09-29", modelVersion: "sre-hmm2-v1.0.0" } as any;
  const analog = (canonicalStateId: string) => ({ status: "available" as const, canonicalStateId, timestamp: "2026-09-30T08:00:00.000Z", matches: [{ year: "2022", label: "Rates Shock", similarity: 71.4 }] });

  it("fills live blocks from the one snapshot and derives only arithmetic", () => {
    const model = buildWorkedExample(snap(state), analog("state:example-test"), { status: "available", reading: hmm });
    expect(model.status).toBe("ready");
    expect(model.happening).toMatchObject({ score: 51, band: "ELEVATED RISK", bandRange: "45–64", regime: "ELEVATED RISK" });
    // value × fixed weight reconciles with the published score.
    expect(model.why?.reconciles).toBe(true);
    expect(model.why?.contributors[0]).toMatchObject({ id: "macro-sensitivity", points: 11 });
    expect(model.why?.contributors.find((c) => c.id === "ai-bubble")?.staticBaseline).toBe(true);
    expect(model.why?.staleInputs).toBe(1);
    expect(model.watch?.up).toEqual({ regime: "HIGH STRESS", threshold: 65, distance: 14 });
    expect(model.watch?.down).toEqual({ regime: "MODERATE RISK", threshold: 45, distance: 6 });
    expect(model.next.analog).toMatchObject({ status: "ready", match: { period: "2022", label: "Rates Shock", similarity: 71 } });
    expect(model.next.model).toMatchObject({ status: "ready", regime: "NORMAL", stateProbability: 0.91, leaveProbability: 0.02 });
  });

  it("does not publish the snapshot's vector direction field", () => {
    expect(JSON.stringify(buildWorkedExample(snap(state), { status: "unavailable" }, { status: "unavailable" }))).not.toContain("Improving");
    expect(view).not.toMatch(/\.direction\b/);
  });

  it("drops analog output that belongs to a different state, and withholds an empty model reading", () => {
    const model = buildWorkedExample(snap(state), analog("state:other"), { status: "available", reading: { ...hmm, freshnessStatus: "UNAVAILABLE" } });
    expect(model.next.analog.status).toBe("unavailable");
    expect(model.next.model.status).toBe("unavailable");
    expect(model.next.model.stateProbability).toBeNull();
  });

  it("never renders the uncalibrated HMM as a % (ECE 0.515, SYSTEMIC_REGIME_CALIBRATION)", () => {
    expect(view).toContain('<Stat label="PROBABILITY OF THAT STATE" value={PROBABILITY_DISPLAY_TEXT.UNCALIBRATED} />');
    expect(view).toContain('<Stat label="CHANCE OF LEAVING IT" value={PROBABILITY_DISPLAY_TEXT.UNCALIBRATED} />');
    expect(view).not.toMatch(/stateProbability|leaveProbability|\bpct\(/);
    expect(view).not.toMatch(/Math\.round\([^)]*\* ?100\)/);
    // Rendered: QA's prod reading (100% / 3%) and this fixture (91% / 2%) never appear.
    for (const reading of [hmm, { ...hmm, regimeConfidence: 1, transitionProbability: 0.03 }]) {
      const model = buildWorkedExample(snap(state), analog("state:example-test"), { status: "available", reading });
      const html = renderToStaticMarkup(createElement(WorkedExampleView, { model }));
      const text = html.replace(/<[^>]+>/g, " ");
      expect(text).toMatch(/PROBABILITY OF THAT STATE\s+Uncalibrated/);
      expect(text).toMatch(/CHANCE OF LEAVING IT\s+Uncalibrated/);
      expect(text).not.toMatch(/\b(?:100|91|3|2)%/);
      expect(text).toContain("are shown as Uncalibrated");
      expect(text).not.toContain("The first figure is");
    }
  });

  it("withholds the breakdown when vector values do not reconcile with the score", () => {
    const model = buildWorkedExample(snap({ ...state, pressureIndex: 80 }), { status: "unavailable" }, { status: "unavailable" });
    expect(model.why?.reconciles).toBe(false);
    expect(model.why?.contributors.every((c) => c.points === null)).toBe(true);
  });

  it("shows unavailable states, never numbers, when there is no reading", () => {
    for (const s of [snap(null), snap(undefined, false, new Error("down")), snap({ ...state, pressureIndex: null })]) {
      const model = buildWorkedExample(s, { status: "unavailable" }, { status: "unavailable" });
      expect(model.status).toBe("unavailable");
      expect(model.happening).toBeNull();
      expect(model.why).toBeNull();
      expect(model.watch).toBeNull();
      const html = renderToStaticMarkup(createElement(WorkedExampleView, { model }));
      expect(html).toContain('data-example-status="unavailable"');
      expect(html).not.toMatch(/\/ 100|pts<|points up/);
      expect((html.match(/data-live-status="unavailable"/g) ?? []).length).toBe(5);
    }
    expect(buildWorkedExample(snap(undefined, true), { status: "loading" }, { status: "loading" }).status).toBe("loading");
  });

  it("labels every illustrative block and keeps numbers out of them", () => {
    expect(ILLUSTRATIVE_LABEL).toBe("Illustrative example — not live output");
    const illustrative = JSON.stringify(ILLUSTRATIVE);
    expect(illustrative).not.toMatch(/\d/);
    const model = buildWorkedExample(snap(state), analog("state:example-test"), { status: "available", reading: hmm });
    const html = renderToStaticMarkup(createElement(WorkedExampleView, { model }));
    const blocks = [...html.matchAll(/data-example-illustrative="([a-z]+)"[^>]*>([\s\S]*?)<\/div><\/div>/g)];
    expect(blocks.map((b) => b[1])).toEqual(["why", "next", "watch", "do"]);
    for (const [, , inner] of blocks) {
      expect(inner).toContain("ILLUSTRATIVE EXAMPLE — NOT LIVE OUTPUT");
      expect(inner.replace(/<[^>]+>/g, "")).not.toMatch(/\d/);
    }
    // PLATO output is not public, so the example never presents text as PLATO's.
    expect(illustrative).not.toMatch(/PLATO/);
    expect(html).toContain("marketState.canonicalCurrent");
    expect(html).toContain("systemicRegime.current");
    expect(html).toContain("Neither is the chance of a crash.");
    expect(html).toContain("NOT INVESTMENT ADVICE");
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
