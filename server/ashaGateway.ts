import {
  invokeLLM,
  type InvokeParams,
  type InvokeResult,
} from "./_core/llm";
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
import type { CanonicalMarketState } from "../shared/marketState";
import { getCanonicalMarketState } from "./marketStateService";
import {
  resolveAshaModelCandidates,
  type AshaModelResolution,
} from "./ashaModelPolicy";

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
    version: "1.0",
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
    outlook: marketState.outlook,
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
    pageSupplement: context.page,
  };

  return `\n\nCANONICAL FAULTLINE MARKETSTATE (SERVER-GENERATED):\n${JSON.stringify(boundedContext)}\n\nPROVENANCE RULES: Treat this MarketState as the authoritative current context. Distinguish current observations, model estimates, inferences, and historical relationships. Never claim a source or engine is available when sourceHealth marks it unavailable. If freshness is stale, cache status is stale-if-error, or warnings are present, disclose that limitation in the answer. Do not invent missing values.`;
}

export async function invokeAshaGateway(
  params: Omit<InvokeParams, "model">,
  dependencies: {
    resolveModels?: () => Promise<AshaModelResolution>;
    invokeModel?: InvokeGatewayModel;
  } = {},
): Promise<{ response: InvokeResult; trace: AshaModelTrace }> {
  const resolution = await (dependencies.resolveModels ?? resolveAshaModelCandidates)();
  const invokeModel = dependencies.invokeModel ?? invokeLLM;
  const attemptedModels: string[] = [];
  let lastError: unknown;

  for (const model of resolution.candidates) {
    attemptedModels.push(model);
    try {
      const response = await invokeModel({ ...params, model });
      return {
        response,
        trace: {
          selectedModel: model,
          attemptedModels,
          resolutionSource: resolution.source,
          resolvedAt: resolution.resolvedAt,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "unknown model failure";
  throw new Error(`ASHA model gateway failed after ${attemptedModels.length} attempt(s): ${reason}`);
}
