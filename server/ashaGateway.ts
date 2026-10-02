import type { InvokeParams, InvokeResult } from "./_core/llm";
import {
  CANONICAL_DESTINATION_BY_ID,
  resolveCanonicalDestination,
  type CanonicalDestinationId,
} from "../shared/routeRegistry";
import type {
  AshaContextProvenance,
  AshaGatewayContext,
  AshaModelTrace,
  AshaPageContext,
} from "../shared/ashaContext";
import type { AshaQuestionAnalysis } from "../shared/ashaQuestionAnalysis";
import type { CanonicalMarketState } from "../shared/marketState";
import { evidenceNarrativePromptContract } from "../shared/evidenceContract";
import { getCanonicalMarketState } from "./marketStateService";
import type { PlatoConfig } from "./plato/config";
import { routePlatoCompletion, type PlatoBudget, type PlatoResponseValidator, type RouteDependencies } from "./plato/router";

type InvokeGatewayModel = (params: InvokeParams) => Promise<InvokeResult>;

const destinationIds = new Set<CanonicalDestinationId>([
  "now",
  "why",
  "outlook",
  "watch",
  "act",
]);

function resolvePageDestination(page: string): CanonicalDestinationId | null {
  const normalized = page.trim().toLowerCase();
  if (destinationIds.has(normalized as CanonicalDestinationId)) {
    return normalized as CanonicalDestinationId;
  }

  const route = normalized === "dashboard" ? "/app/now" : normalized;
  return resolveCanonicalDestination(route)?.id ?? null;
}

export async function createAshaGatewayContext(
  page: AshaPageContext,
  dependencies: {
    getMarketState?: () => Promise<CanonicalMarketState>;
  } = {},
): Promise<AshaGatewayContext> {
  const marketState = await (dependencies.getMarketState ?? getCanonicalMarketState)();
  return {
    version: "1.1",
    destination: resolvePageDestination(page.page),
    page,
    marketState,
  };
}

export function getAshaContextProvenance(
  context: AshaGatewayContext,
): AshaContextProvenance {
  const { marketState } = context;
  return {
    contextVersion: context.version,
    marketStateVersion: marketState.version,
    generatedAt: marketState.generatedAt,
    sourceUpdatedAt: marketState.sourceUpdatedAt,
    freshness: marketState.freshness,
    cacheStatus: marketState.cache.status,
    sourceHealth: marketState.sourceHealth,
    warnings: marketState.warnings,
  };
}

/** What the model is told in place of any scenario or probability percent. */
export const PLATO_SCENARIO_WITHHELD = "Uncalibrated";

/**
 * Outlook as sent to PLATO: no scenario, regime or transition percent and no confidence number.
 * Owner rule: a scenario/probability % may be shown only when its contract status is AVAILABLE,
 * and none is today, so the model gets the status text and the non-numeric evidence only.
 */
/**
 * Outlook prose can embed a scenario/transition percent (e.g. "(60% historical frequency)").
 * Every percent is replaced with the withheld status, except an analog similarity, which is
 * regime resemblance, not a probability.
 */
export function withholdScenarioPercents(text: string): string {
  return text
    .replace(/\(\s*\d+(?:\.\d+)?\s*%(?!\s*similarity)[^)]*\)/gi, `(${PLATO_SCENARIO_WITHHELD})`)
    .replace(/\d+(?:\.\d+)?\s*%(?!\s*similarity)(?:\s+(?:historical frequency|probability|chance|likelihood|odds))?/gi, PLATO_SCENARIO_WITHHELD);
}

export function outlookForModel(outlook: CanonicalMarketState["outlook"]): Record<string, unknown> {
  const probabilities = outlook.probabilities;
  const transitions = outlook.transitionProbabilities;
  return {
    scenarioProbabilities: PLATO_SCENARIO_WITHHELD,
    scenarioBasis: {
      primaryDriver: probabilities?.primaryDriver,
      evidenceBasis: probabilities?.evidenceBasis,
      historicalBasis: probabilities?.historicalBasis,
    },
    transitionProbabilities: PLATO_SCENARIO_WITHHELD,
    transitionBasis: {
      historicalBasis: transitions?.historicalBasis,
      currentEvidence: transitions?.currentEvidence,
    },
    highestProbabilityPath: typeof outlook.highestProbabilityPath === "string"
      ? withholdScenarioPercents(outlook.highestProbabilityPath)
      : outlook.highestProbabilityPath,
    invalidationConditions: outlook.invalidationConditions,
    topAnalog: outlook.topAnalog,
  };
}

/** Client page supplement without any probability number. */
function pageSupplementForModel(page: AshaPageContext): AshaPageContext {
  const { transitionProbability: _withheld, ...rest } = page;
  return rest;
}

export function buildAshaCanonicalContextBlock(context: AshaGatewayContext): string {
  const { marketState } = context;
  const destination = context.destination
    ? CANONICAL_DESTINATION_BY_ID[context.destination]
    : null;

  const boundedContext = {
    contractVersion: context.version,
    currentPage: context.page.page,
    destination: destination
      ? { id: destination.id, question: destination.question, view: destination.defaultView }
      : null,
    freshness: marketState.freshness,
    generatedAt: marketState.generatedAt,
    sourceUpdatedAt: marketState.sourceUpdatedAt,
    cache: marketState.cache,
    warnings: marketState.warnings,
    sourceHealth: marketState.sourceHealth,
    now: marketState.now,
    why: {
      story: marketState.why.story,
      narrative: marketState.why.narrative,
      keyDevelopments: marketState.why.keyDevelopments.slice(0, 6),
      evidenceConsensus: marketState.why.evidenceConsensus,
      evidenceFamilies: marketState.why.evidenceFamilies.slice(0, 10),
    },
    outlook: outlookForModel(marketState.outlook),
    watch: {
      developingConditions: marketState.watch.developingConditions.slice(0, 6),
      activePatterns: marketState.watch.activePatterns.slice(0, 6),
      whatChanged: marketState.watch.whatChanged.slice(0, 6),
      whatToWatch: marketState.watch.whatToWatch.slice(0, 6),
      accelerating: marketState.watch.accelerating,
      buildingPressure: marketState.watch.buildingPressure,
    },
    act: marketState.act,
    history: marketState.history,
    questionAnalysis: context.questionAnalysis ?? null,
    pageSupplement: pageSupplementForModel(context.page),
  };

  const scopeRule = context.questionAnalysis?.analysisScope === "MARKET"
    ? "QUESTION SCOPE IS MARKET. Do not retrieve, infer from, or mention active-ticker/company fundamentals, price levels, technicals, catalysts, LEAP commentary, or ticker invalidation conditions."
    : context.questionAnalysis?.analysisScope === "TICKER"
      ? "QUESTION SCOPE IS TICKER. Use ticker-specific evidence only when it is present in the sanitized page supplement and relevant to the user’s question."
      : "QUESTION SCOPE IS MARKET_TICKER_RELATIONSHIP. Separate broad-market evidence from the ticker-specific transmission analysis.";

  return `\n\nCANONICAL FAULTLINE MARKETSTATE (SERVER-GENERATED):\n${JSON.stringify(boundedContext)}\n\nSCOPE RULE: ${scopeRule}\n\nPROVENANCE RULES: Treat this MarketState as the authoritative current context. Distinguish current observations, model estimates, inferences, and historical relationships. Never claim a source or engine is available when sourceHealth marks it unavailable. If freshness is stale, cache status is stale-if-error, or warnings are present, disclose that limitation in the answer. Do not invent missing values. Historical analog similarity is evidence of regime resemblance, never forecast probability. Use questionAnalysis probability only when its availability is CALIBRATED; never convert a similarity score or generic bear scenario into an unsupported event probability.\n\n${evidenceNarrativePromptContract()}`;
}

/**
 * Every PLATO model call goes through the PLATO router: the approved
 * OpenAI-compatible provider, an explicit chat-model chain, bounded retries,
 * per-attempt and total deadlines. On total failure this throws a typed
 * `PlatoUnavailableError` (see server/plato/errors.ts); it never returns a
 * synthetic answer.
 */
export async function invokeAshaGateway(
  params: Omit<InvokeParams, "model" | "signal">,
  dependencies: {
    invokeModel?: InvokeGatewayModel;
    config?: PlatoConfig;
    sleep?: RouteDependencies["sleep"];
    /** Shared per-question budget (answer + correction share one 4-call / 100 s budget). */
    budget?: PlatoBudget;
    validateResponse?: PlatoResponseValidator;
  } = {},
): Promise<{ response: InvokeResult; trace: AshaModelTrace }> {
  const routed = await routePlatoCompletion(
    {
      messages: params.messages,
      tools: params.tools,
      toolChoice: params.toolChoice,
      tool_choice: params.tool_choice,
      maxTokens: params.maxTokens,
      max_tokens: params.max_tokens,
      outputSchema: params.outputSchema,
      output_schema: params.output_schema,
      responseFormat: params.responseFormat,
      response_format: params.response_format,
    },
    {
      invoke: dependencies.invokeModel,
      config: dependencies.config,
      sleep: dependencies.sleep,
      budget: dependencies.budget,
      validateResponse: dependencies.validateResponse,
    },
  );
  return {
    response: routed.response,
    trace: {
      selectedModel: routed.trace.selectedModel,
      attemptedModels: routed.trace.attemptedModels,
      resolutionSource: routed.trace.resolutionSource,
      resolvedAt: routed.trace.resolvedAt,
    },
  };
}
