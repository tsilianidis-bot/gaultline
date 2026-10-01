import { invokeLLM, type InvokeParams, type InvokeResult } from "./_core/llm";
import { log } from "./logger";

/**
 * Same id as DEFAULT_CHAT_MODEL in ./_core/llm.ts.
 * Inlined so suites that mock ./_core/llm without importOriginal still load.
 */
export const INTERACTIVE_LLM_MODEL = "gemini-3-flash-preview";

/**
 * Interactive PLATO and background jobs share one provider account.
 * When they also share a model, background work stops once its daily
 * allowance is spent so a reserve remains for a person asking PLATO.
 * FAULTLINE_BACKGROUND_LLM_MODEL can point background jobs at a different
 * model id on the same OpenAI-compatible gateway. Blank keeps the
 * interactive default, so configuration can restore the previous model
 * without a code change.
 */
export const SHARED_DAILY_REQUEST_BUDGET = 20;
export const INTERACTIVE_RESERVED_REQUESTS = 12;
const BACKGROUND_CONCURRENCY = 2;
const RATE_LIMIT_PAUSE_MS = 15 * 60 * 1000;

export class BackgroundLlmBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundLlmBudgetError";
  }
}

export function resolveBackgroundLlmModel(): string {
  const configured = process.env.FAULTLINE_BACKGROUND_LLM_MODEL?.trim();
  return configured ? configured : INTERACTIVE_LLM_MODEL;
}

export function backgroundSharesInteractiveModel(model = resolveBackgroundLlmModel()): boolean {
  return model === INTERACTIVE_LLM_MODEL;
}

export function backgroundDailyBudget(model = resolveBackgroundLlmModel()): number {
  return backgroundSharesInteractiveModel(model)
    ? SHARED_DAILY_REQUEST_BUDGET - INTERACTIVE_RESERVED_REQUESTS
    : SHARED_DAILY_REQUEST_BUDGET;
}

export const DEFAULT_OWNERSIM_LLM_MAX_CALLS = 4;

let budgetDay = "";
let budgetUsed = 0;
let ownerSimDay = "";
let ownerSimUsed = 0;
let pausedUntilMs = 0;
let inFlight = 0;
const waiters: Array<() => void> = [];

export function resetBackgroundLlmCapacityForTests(): void {
  budgetDay = "";
  budgetUsed = 0;
  ownerSimDay = "";
  ownerSimUsed = 0;
  pausedUntilMs = 0;
  inFlight = 0;
  waiters.length = 0;
}

/** Daily OwnerSim LLM cap. FAULTLINE_OWNERSIM_LLM_MAX_CALLS overrides it. 0 disables OwnerSim LLM calls. */
export function ownerSimLlmMaxCalls(): number {
  const raw = process.env.FAULTLINE_OWNERSIM_LLM_MAX_CALLS?.trim();
  if (!raw) return DEFAULT_OWNERSIM_LLM_MAX_CALLS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_OWNERSIM_LLM_MAX_CALLS;
  return Math.floor(parsed);
}

export function claimOwnerSimLlmCall(nowMs = Date.now()): boolean {
  const max = ownerSimLlmMaxCalls();
  if (max <= 0) return false;
  const key = dayKey(nowMs);
  if (key !== ownerSimDay) {
    ownerSimDay = key;
    ownerSimUsed = 0;
  }
  if (ownerSimUsed >= max) return false;
  ownerSimUsed += 1;
  return true;
}

function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function isRateLimit(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\b429\b/.test(error.message) || /RESOURCE_EXHAUSTED/i.test(error.message);
}

function claimBudget(nowMs: number): boolean {
  const key = dayKey(nowMs);
  if (key !== budgetDay) {
    budgetDay = key;
    budgetUsed = 0;
  }
  if (budgetUsed >= backgroundDailyBudget()) return false;
  budgetUsed += 1;
  return true;
}

async function acquireSlot(): Promise<void> {
  if (inFlight < BACKGROUND_CONCURRENCY) {
    inFlight += 1;
    return;
  }
  await new Promise<void>(resolve => {
    waiters.push(() => {
      inFlight += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waiters.shift();
  if (next) next();
}

export async function invokeBackgroundLLM(
  params: InvokeParams,
  now: () => number = Date.now,
): Promise<InvokeResult> {
  const nowMs = now();
  if (nowMs < pausedUntilMs) {
    throw new BackgroundLlmBudgetError(
      "Background LLM calls are paused after a provider rate limit so interactive PLATO keeps capacity.",
    );
  }
  if (!claimBudget(nowMs)) {
    log.warn("[LLM] background call skipped; interactive reserve preserved", {
      model: resolveBackgroundLlmModel(),
      backgroundDailyBudget: backgroundDailyBudget(),
      interactiveReservedRequests: backgroundSharesInteractiveModel() ? INTERACTIVE_RESERVED_REQUESTS : 0,
    });
    throw new BackgroundLlmBudgetError(
      "Background LLM budget is reserved for interactive PLATO. Set FAULTLINE_BACKGROUND_LLM_MODEL to a different model to give background jobs their own allowance.",
    );
  }

  await acquireSlot();
  try {
    return await invokeLLM({
      ...params,
      model: params.model ?? resolveBackgroundLlmModel(),
    });
  } catch (error) {
    if (isRateLimit(error)) {
      pausedUntilMs = nowMs + RATE_LIMIT_PAUSE_MS;
      log.warn("[LLM] pausing background model calls after provider rate limit", {
        model: resolveBackgroundLlmModel(),
        pausedUntil: new Date(pausedUntilMs).toISOString(),
      });
    }
    throw error;
  } finally {
    releaseSlot();
  }
}
