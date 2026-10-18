/**
 * End-to-end (mocked provider) checks that PLATO never fabricates an answer.
 * Real askAsha → invokeAshaGateway → PLATO router → adapter; only invokeLLM
 * (the HTTP call) and canonical acquisition adapters are mocked; unmocked
 * gateway, packet, router, and integrity helpers remain real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AshaContextProvenance, AshaGatewayContext, AshaPageContext } from "../shared/ashaContext";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import type { LiveInputQualityManifestEntry } from "./intelligenceGovernance";

const llm = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./_core/llm", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/llm")>()),
	invokeLLM: llm.invoke,
}));

const gateway = vi.hoisted(() => ({ createContext: vi.fn(), getProvenance: vi.fn() }));
vi.mock("./ashaGateway", async importOriginal => ({
	...(await importOriginal<typeof import("./ashaGateway")>()),
	createAshaGatewayContext: gateway.createContext,
	getAshaContextProvenance: gateway.getProvenance,
}));

const canonical = vi.hoisted(() => ({ getAuthoritative: vi.fn() }));
vi.mock("./canonicalIntelligenceState", async importOriginal => ({
	...(await importOriginal<typeof import("./canonicalIntelligenceState")>()),
	getAuthoritativeCanonicalIntelligenceState: canonical.getAuthoritative,
}));

import { inspect } from "node:util";
import { log } from "./logger";
import { askAsha, generateAshaDailyGreeting } from "./ashaEngine";
import { mapAshaProcedureError } from "./ashaProcedureError";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { PlatoUnavailableError } from "./plato/errors";

const OBSERVED_AT = "2026-10-01T16:00:00.000Z";
const GENERATED_AT = "2026-10-01T18:00:00.000Z";
const STATE_ID = "state:asha-no-fabrication-mock";
const INPUT_SNAPSHOT_ID = "input:asha-no-fabrication-mock";
const STATE_HASH = "sha256:asha-no-fabrication-mock";

// Fixture provenance only. These are recorded mock observations, never provider calls or live-data proof.
const MOCK_PROVIDER = {
	fixture: "MOCK", provider: "Federal Reserve Economic Data", observedAt: OBSERVED_AT, fetchedAt: GENERATED_AT,
} as const;

function observedInput(
	inputId: string,
	metric: string,
	sourceSeriesId: string,
	value: number,
	contributesTo: string[],
): LiveInputQualityManifestEntry & { fixtureProvenance: typeof MOCK_PROVIDER } {
	return {
		inputId, metric, source: "FRED", provider: MOCK_PROVIDER.provider, sourceSeriesId,
		observedAt: MOCK_PROVIDER.observedAt, fetchedAt: MOCK_PROVIDER.fetchedAt,
		expectedUpdateFrequency: "daily", maxAgeHours: 36, freshnessStatus: "LIVE",
		availabilityStatus: "AVAILABLE", fallbackUsed: false, fallbackType: null,
		revisionStatus: "MOCK_RECORDED_OBSERVATION", qualityStatus: "MOCK_PROVIDER_OBSERVATION",
		contributesTo, value, confidenceImpact: "NONE", publicClaimEligible: false,
		fixtureProvenance: MOCK_PROVIDER,
	};
}

const inputQuality = [
	observedInput("hy_credit_spread", "ICE BofA US High Yield Option-Adjusted Spread", "BAMLH0A0HYM2", 3.22, ["credit-contagion"]),
	observedInput("secured_overnight_financing_rate", "Secured Overnight Financing Rate", "SOFR", 4.33, ["liquidity-stress"]),
	observedInput("ten_year_treasury_yield", "10-Year Treasury Constant Maturity Rate", "DGS10", 3.79, ["volatility-regime", "macro-sensitivity"]),
	observedInput("two_year_treasury_yield", "2-Year Treasury Constant Maturity Rate", "DGS2", 3.11, ["volatility-regime", "macro-sensitivity"]),
	observedInput("consumer_price_index_yoy", "Consumer Price Index YoY", "CPIAUCSL", 2.4, ["macro-sensitivity"]),
	{
		inputId: "ai_concentration_static_baseline", metric: "AI / speculation concentration baseline", source: "Frozen Champion V1 configuration", provider: "FAULTLINE",
		sourceSeriesId: null, observedAt: null, fetchedAt: GENERATED_AT, expectedUpdateFrequency: "static" as const, maxAgeHours: null,
		freshnessStatus: "CURRENT" as const, availabilityStatus: "STATIC_MODEL_INPUT" as const, fallbackUsed: false, fallbackType: null,
		revisionStatus: "FROZEN_STATIC_MODEL_ASSUMPTION", qualityStatus: "STATIC_MODEL_ESTIMATE", contributesTo: ["ai-bubble"], value: 65,
		confidenceImpact: "QUALIFIED" as const, publicClaimEligible: false,
		fixtureProvenance: { fixture: "MOCK", provider: "FAULTLINE", observedAt: null, fetchedAt: GENERATED_AT },
	},
] satisfies Array<LiveInputQualityManifestEntry & { fixtureProvenance: { fixture: "MOCK"; provider: string; observedAt: string | null; fetchedAt: string } }>;

const authoritativeState = buildCanonicalIntelligenceState({
	stateId: STATE_ID, originatingRunId: "run:asha-no-fabrication-mock", generatedAt: GENERATED_AT,
	championVersion: "champion-v1-frozen", modelVersion: "canonical-model-v1", scoringVersion: "faultline-pressure-v1-frozen",
	configurationVersion: "phase1b-governance-v1", inputSnapshotId: INPUT_SNAPSHOT_ID, stateHash: STATE_HASH,
	pressureIndex: 33, regime: "MODERATE RISK",
	// All frozen Pressure v1 vectors are present; this fixture does not recalculate or alter their weights/history.
	engineValues: { "liquidity-stress": 29, "credit-contagion": 35, "volatility-regime": 31, "macro-sensitivity": 34, "market-breadth": 28, "ai-bubble": 65 },
	engineDirections: { "liquidity-stress": "improving", "credit-contagion": "deteriorating", "volatility-regime": "stable", "macro-sensitivity": "stable", "market-breadth": "improving", "ai-bubble": "secular" },
	domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: [],
	historicalDatasetVersion: "fixture-history-v1", researchDatasetVersion: "fixture-research-v1",
	coherenceStatus: "COHERENT", coherenceNotes: [],
	dataQualitySummary: { totalInputs: inputQuality.length, liveInputs: 5, delayedInputs: 0, staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: ["ai_concentration_static_baseline"], publicClaimEligible: false },
	staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality,
});

const sourceHealth = [
	{ id: "seismograph" as const, label: "Canonical Seismograph", status: "healthy" as const, required: true, asOf: GENERATED_AT, detail: "MOCK fixture derived from the immutable canonical state." },
	{ id: "historical-memory" as const, label: "Historical Market Memory", status: "healthy" as const, required: true, asOf: GENERATED_AT, detail: "MOCK fixture only; no historical claim is supplied." },
	{ id: "fred" as const, label: "Federal Reserve Economic Data", status: "healthy" as const, required: true, asOf: OBSERVED_AT, detail: "MOCK recorded provider observations; no network call." },
	{ id: "coingecko" as const, label: "Crypto Market Overlay", status: "unavailable" as const, required: false, asOf: GENERATED_AT, detail: "Unavailable in this fixture." },
];

const gatewayContext = {
	version: "1.1",
	destination: "why",
	page: { page: "/app/why" },
	marketState: {
		version: "1.0", canonicalStateId: STATE_ID, stateHash: STATE_HASH, inputSnapshotId: INPUT_SNAPSHOT_ID,
		generatedAt: GENERATED_AT, sourceUpdatedAt: OBSERVED_AT, freshness: "live",
		cache: { status: "fresh-cache", ageMs: 0, staleReason: null }, sourceHealth, warnings: [],
		now: { pressureScore: 33, regime: "MODERATE RISK", stressLevel: "Moderate", direction: "Stable", historicalPercentile: 44, headline: "Canonical fixture has moderate pressure.", topDrivers: ["Credit", "Liquidity"], threats: ["Credit"], supports: ["Liquidity"] },
		why: {
			story: "Fixture state has mixed derived vectors.", whyThisScore: "Derived from the fixed canonical mock vectors.", whyThisRegime: "Fixture classification only.", keyDevelopments: ["Credit vector is deteriorating."],
			narrative: { whatIsHappening: "Moderate pressure.", whyIsItHappening: "Derived mock vectors.", whatHasChanged: "No provider change is asserted.", whatIsBuildingBeneathSurface: "No additional fact is established." },
			evidenceFamilies: [
				{ name: "Liquidity", signal: "recovering", strength: 29, trend: "improving", currentValue: "Derived score 29", historicalContext: "Not asserted", whyItMatters: "Fixture context only" },
				{ name: "Credit", signal: "stressed", strength: 35, trend: "deteriorating", currentValue: "Derived score 35", historicalContext: "Not asserted", whyItMatters: "Fixture context only" },
			], evidenceConsensus: "divergent", evidenceAsOfMonth: null,
		},
		outlook: {
			probabilities: { bull: Number.NaN, neutral: Number.NaN, bear: Number.NaN, confidence: Number.NaN, primaryDriver: "No governed forecast", evidenceBasis: "No authorized forecast claim", historicalBasis: "Not established" },
			regimeProbabilities: { bull: Number.NaN, softLanding: Number.NaN, stagflation: Number.NaN, recession: Number.NaN, crash: Number.NaN },
			transitionProbabilities: { remainInRegime: Number.NaN, transitionToElevated: Number.NaN, transitionToLow: Number.NaN, transitionToCrisis: Number.NaN, confidence: Number.NaN, historicalBasis: "Not established", currentEvidence: [] },
			highestProbabilityPath: "No governed forecast available.", invalidationConditions: [], topAnalog: null,
		},
		watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false },
		act: { marketPosture: "balanced", decisionSummary: "No client-authored advice is authoritative.", whatWouldInvalidate: "No governed invalidation condition is currently defined.", riskControls: [] },
		history: { observationCount: 0, datasetSpan: "Unavailable", currentStreakDescription: "Unavailable", lastMajorShift: null, analogSummary: "No governed historical analog." },
	},
} satisfies AshaGatewayContext;

const provenance = {
	contextVersion: "1.1", marketStateVersion: "1.0", generatedAt: GENERATED_AT, sourceUpdatedAt: OBSERVED_AT,
	freshness: "live", cacheStatus: "fresh-cache", sourceHealth, warnings: [],
} satisfies AshaContextProvenance;

type Step = InvokeResult | Error;
function result(content: unknown, finish: string | null = "stop", choices = true): InvokeResult {
  return {
    id: "r", created: 1, model: "m",
    choices: choices ? [{ index: 0, message: { role: "assistant", content: content as string }, finish_reason: finish }] : [],
  } as InvokeResult;
}
const fullBriefing = (reply: string) => JSON.stringify({
  reply, directAnswer: "Pressure is moderate.", executiveSummary: "Pressure is moderate. Credit is calm.", coreThesis: "Credit is calm.",
  keyFindings: ["a", "b", "c"], riskFactors: ["x", "y", "z"], invalidationConditions: ["i1", "i2"],
});
const replyOnly = (reply: string) => JSON.stringify({ reply });
const http = (status: number, body: string) => new Error(`LLM invoke failed: ${status} Status – ${body}`);

function script(steps: Step[]) {
  const models: string[] = [];
  llm.invoke.mockImplementation(async (params: InvokeParams) => {
    models.push(params.model ?? "");
    const next = steps.shift() ?? http(503, "UNAVAILABLE");
    if (next instanceof Error) throw next;
    return next;
  });
  return models;
}

const ask = () => askAsha({ userMessage: "Is credit stress building?", history: [], pageContext: { page: "/app/why" } });

beforeEach(() => {
  vi.clearAllMocks();
  canonical.getAuthoritative.mockResolvedValue(authoritativeState);
  gateway.createContext.mockImplementation(async (page: AshaPageContext): Promise<AshaGatewayContext> => ({
    ...gatewayContext,
    destination: page.page === "/app/why" ? "why" : null,
    page,
  }));
  gateway.getProvenance.mockReturnValue(provenance);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function expectTypedUnavailable(promise: Promise<unknown>, errorClass: string) {
  const failure = await promise.catch(error => error);
  expect(failure).toBeInstanceOf(PlatoUnavailableError);
  expect((failure as PlatoUnavailableError).attempts.every(attempt => attempt.errorClass === errorClass)).toBe(true);
  const mapped = mapAshaProcedureError(failure);
  expect(mapped.code).toBe("SERVICE_UNAVAILABLE");
  expect(mapped.message).toMatch(/^PLATO is temporarily unavailable/);
  return failure as PlatoUnavailableError;
}

describe("PLATO never fabricates an answer from an answerless 200", () => {
  it("no choices on every model: typed unavailable after trying each model once", async () => {
    const models = script([result(null, "stop", false), result(null, "stop", false), result(null, "stop", false)]);
    await expectTypedUnavailable(ask(), "empty_response");
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
  });

  it("empty content with a safety / content_filter stop: typed unavailable", async () => {
    script([result("", "content_filter"), result("", "safety"), result("", "content_filter")]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("null content: typed unavailable", async () => {
    script([result(null), result(null), result(null)]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("prose instead of the briefing JSON is never shown as the answer", async () => {
    script([result("Credit stress looks fine to me."), result("Still prose."), result("More prose.")]);
    const failure = await expectTypedUnavailable(ask(), "malformed_response");
    expect(JSON.stringify(failure)).not.toContain("Credit stress looks fine");
  });

  it("truncated JSON (finish_reason=length) is a failure, not an answer", async () => {
    script([result('{"reply":"Credit stress is', "length"), result('{"reply":"Credit', "length"), result('{"re', "length")]);
    await expectTypedUnavailable(ask(), "malformed_response");
  });

  it("JSON with an empty reply is a failure", async () => {
    script([result(replyOnly("")), result(replyOnly("  ")), result(JSON.stringify({ directAnswer: "x" }))]);
    await expectTypedUnavailable(ask(), "empty_response");
  });

  it("an answerless primary falls back to the next model and returns only what the model said", async () => {
    const models = script([result(null, "stop", false), result(fullBriefing("Credit is calm and stable."))]);
    const response = await ask();
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(response.modelTrace.selectedModel).toBe("gemini-3.1-flash-lite");
    expect(response.reply).not.toContain("I was unable to generate a response");
    // Fields the model did not supply stay undefined: no invented ELEVATED / Moderate / NEUTRAL / WATCH.
    expect(response.threatLevel).toBeUndefined();
    expect(response.riskLevel).toBeUndefined();
    expect(response.marketBias).toBeUndefined();
    expect(response.finalVerdictAction).toBeUndefined();
  });
});

describe("one question, one budget", () => {
  it("the correction retry shares the answer's 4-call budget", async () => {
    // Answer succeeds on call 1 but fails structural validation (reply only) → correction.
    // Correction: 503, same-model retry 503, next model 503 → cap of 4 reached → keep the first answer.
    const models = script([result(replyOnly("Credit is calm.")), http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), result(fullBriefing("never reached"))]);
	    const response = await ask();
	    expect(models).toHaveLength(4);
	    // The server-owned packet remains bound to the fixed mock state; the point is that the fifth response is never requested.
	    expect(response.reply).not.toContain("never reached");
	  });

  it("an answer that used 3 calls leaves exactly 1 for the correction", async () => {
    const models = script([result(null, "stop", false), result("prose"), result(replyOnly("Credit is calm.")), http(503, "UNAVAILABLE"), result(fullBriefing("never reached"))]);
    const response = await ask();
    expect(models).toHaveLength(4);
    expect(response.reply).not.toContain("never reached");
  });

  it("skips the correction entirely when the answer used the whole budget", async () => {
    const models = script([http(503, "UNAVAILABLE"), http(503, "UNAVAILABLE"), result(null, "stop", false), result(replyOnly("Credit is calm.")), result(fullBriefing("never reached"))]);
    const response = await ask();
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
    expect(response.reply).not.toContain("never reached");
    expect(JSON.stringify((console.warn as any).mock.calls)).toContain("Correction skipped");
  });

  it("a failed correction logs only class and status, never the upstream body", async () => {
    const spies = [
      ...(["log", "info", "warn", "error"] as const).map(level => vi.spyOn(console, level).mockImplementation(() => {})),
      ...(["info", "warn", "error", "debug"] as const).map(level => vi.spyOn(log, level).mockImplementation(() => {})),
    ];
    script([result(replyOnly("Credit is calm.")), http(400, "SECRET-UPSTREAM-BODY prompt echo")]);
    await ask();
    // util.inspect expands Error objects (message and stack), so logging the raw error would be caught;
    // JSON.stringify alone would print "{}" for an Error and miss it.
    const logged = inspect(spies.map(spy => spy.mock.calls), { depth: 10 });
    expect(logged).toContain("Correction failed");
    expect(logged).toContain("bad_request");
    expect(logged).not.toContain("SECRET-UPSTREAM-BODY");
    expect(logged).not.toContain("prompt echo");
  });
});

describe("response confidence", () => {
	it("is never keyword-guessed or defaulted to moderate", async () => {
		script([result(fullBriefing("Credit is calm. This clearly suggests stability with high confidence."))]);
    const response = await ask();
    expect(response.confidence).toBeUndefined();
    script([result(fullBriefing("Credit is calm."))]);
    expect((await ask()).confidence).toBeUndefined();
	});
});

describe("server-owned canonical packet", () => {
	it("binds Oracle facts and citations to one immutable mock state while withholding model-invented forecast fields", async () => {
		script([result(JSON.stringify({
			...JSON.parse(fullBriefing("The supplied canonical packet is limited to derived readings.")),
			pressureIndex: 99,
			bullProbability: 88,
			bearProbability: 12,
			expectedTimeframe: "tomorrow",
			invalidationConditions: ["Invented 99-point threshold"],
			sourceCitations: [{ name: "Invented provider", claim: "Fabricated market observation", observedAt: "2026-01-01T00:00:00.000Z", freshness: "LIVE" }],
		}))]);

		const response = await ask();
		expect(authoritativeState).toMatchObject({ stateId: STATE_ID, stateHash: STATE_HASH, inputSnapshotId: INPUT_SNAPSHOT_ID });
		expect(response.integrity.transaction).toMatchObject({
			originatingStateId: STATE_ID,
			originatingEffectiveAt: GENERATED_AT,
			originatingGeneratedAt: GENERATED_AT,
		});
		expect(response.integrity.transaction.evidenceClaimIds).toEqual(expect.arrayContaining([
			`${STATE_ID}:derived:pressure-index`,
			`${STATE_ID}:derived:engine:credit-contagion`,
		]));
		expect(response.pressureIndex).toBe(33);
		expect(response.bullProbability).toBeUndefined();
		expect(response.bearProbability).toBeUndefined();
		expect(response.expectedTimeframe).toBe("Not established");
		expect(response.invalidationConditions).toEqual(["No governed invalidation condition is currently defined."]);
		expect(response.sourceCitations).toEqual(expect.arrayContaining([
			expect.objectContaining({ claimId: `${STATE_ID}:derived:pressure-index`, evidenceClass: "DERIVED", observedAt: GENERATED_AT }),
		]));
		expect(response.sourceCitations?.every(citation => citation.claimId?.startsWith(`${STATE_ID}:derived:`) && citation.evidenceClass === "DERIVED")).toBe(true);
		expect(response.sourceCitations).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "Invented provider" })]));
		expect(response.sources).toEqual(expect.arrayContaining(["hy_credit_spread", "secured_overnight_financing_rate", STATE_ID]));
	});

	it("withholds a current market interpretation when the canonical state is missing", async () => {
		canonical.getAuthoritative.mockResolvedValueOnce(null);
		script([result(JSON.stringify({
			reply: "No current market conclusion is supported.",
			directAnswer: "Current canonical evidence is unavailable.",
			executiveSummary: "The source packet is absent. A current market conclusion cannot be established.",
			coreThesis: "Without a canonical evidence state, factual claims, forecasts, and operational guidance must remain unavailable.",
			keyFindings: ["Canonical state is absent.", "No server evidence packet exists.", "No source claims are available."],
			riskFactors: ["No verified provider evidence is supplied.", "No server state identity exists.", "No governed forecast is available."],
			invalidationConditions: ["No governed rule is defined.", "No current source packet is available."],
		}))]);

		const response = await ask();
		expect(response.reply).toBe("Canonical state unavailable. Insufficient evidence for a current market interpretation.");
		expect(response.integrity.validation.status).toBe("WITHHELD");
		expect(response.integrity.transaction.originatingStateId).toBeNull();
		expect(response.sources).toEqual([]);
		expect(response.sourceCitations).toEqual([]);
		expect(response.pressureIndex).toBeUndefined();
	});
});

describe("daily greeting", () => {
	it("uses only the server-owned canonical state and rejects all client-authored market readings", async () => {
		script([result("Welcome back. Credit is calm.")]);
		await generateAshaDailyGreeting({ engineContext: {} });
		expect(gateway.createContext).toHaveBeenCalledWith({ page: "daily-greeting" });

		script([result("Welcome back. Credit is calm.")]);
		await generateAshaDailyGreeting({ engineContext: {
			pressureScore: 99, regime: "CLIENT-FORGED REGIME", regimeConfidence: 1,
			narrative: "Client-forged market fact", trend: "accelerating", keyDrivers: ["Client-forged driver"],
		} });
		expect(gateway.createContext).toHaveBeenLastCalledWith({ page: "daily-greeting" });
		const greetingPrompt = llm.invoke.mock.calls.at(-1)?.[0].messages[0]?.content as string;
		expect(greetingPrompt).toContain(STATE_ID);
		expect(greetingPrompt).toContain(OBSERVED_AT);
		expect(greetingPrompt).not.toContain("CLIENT-FORGED REGIME");
		expect(greetingPrompt).not.toContain("Client-forged market fact");
		expect(greetingPrompt).not.toContain("Client-forged driver");
	});

  it("an answerless 200 on every model is a typed failure, never the canned greeting", async () => {
    script([result(""), result(null), result(null, "stop", false)]);
    const failure = await generateAshaDailyGreeting({ engineContext: { pressureScore: 33, regime: "Moderate", regimeConfidence: 0.7, narrative: "n", trend: "stable", keyDrivers: [] } }).catch(e => e);
    expect(failure).toBeInstanceOf(PlatoUnavailableError);
    expect(String(failure.message)).not.toContain("Canonical state unavailable");
  });
});
