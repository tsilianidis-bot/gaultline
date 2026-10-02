export const ASHA_UNAVAILABLE_TITLE = "PLATO is temporarily unavailable";
/** Same wording as the /app/asha guest gate (#55, AshaIntelligenceCenter). */
export const ASHA_SIGN_IN_TITLE = "Sign in to use PLATO";
export const ASHA_SIGN_IN_DETAIL = "PLATO conversations, memory and thesis history are tied to your account. Guest access does not include PLATO.";

/** Server copy for the app-side daily caps (server/plato/limits.ts). Shared so the client can recognise it. */
export const PLATO_DAILY_LIMIT_MESSAGE = "PLATO has reached today's limit. Please try again tomorrow.";
export const PLATO_USER_DAILY_LIMIT_MESSAGE = "You have reached today's PLATO question limit. Please try again tomorrow.";

export type AshaAskFailureKind = "unauthorized" | "rate_limit" | "daily_limit" | "capacity" | "unavailable";

export interface AshaAskFailureState {
  panelState: "unavailable";
  kind: AshaAskFailureKind;
  title: string;
  detail: string;
  /** Retry only makes sense when the provider may recover. Never for sign-in. */
  showRetry: boolean;
  /** Sign in button that redirects only when clicked. */
  showSignIn: boolean;
}

function readTrpcMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function readTrpcCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { code?: unknown } }).data;
  return data && typeof data.code === "string" ? data.code : null;
}

/** Shown before any request when the visitor is not signed in, and for a server UNAUTHORIZED. */
export function ashaSignInRequiredState(): AshaAskFailureState {
  return {
    panelState: "unavailable",
    kind: "unauthorized",
    title: ASHA_SIGN_IN_TITLE,
    detail: ASHA_SIGN_IN_DETAIL,
    showRetry: false,
    showSignIn: true,
  };
}

/**
 * A failed PLATO ask stays on a card with the question intact.
 * It never returns to the summon intro and never shows a synthetic answer.
 * Codes come from server/ashaProcedureError.ts.
 */
export function reduceAshaAskFailure(error: unknown): AshaAskFailureState {
  const code = readTrpcCode(error);
  if (code === "UNAUTHORIZED") return ashaSignInRequiredState();
  if (code === "TOO_MANY_REQUESTS") {
    const message = readTrpcMessage(error);
    if (message === PLATO_DAILY_LIMIT_MESSAGE || message === PLATO_USER_DAILY_LIMIT_MESSAGE) {
      // A daily cap does not lift on retry: say so, keep the question, offer no Retry.
      return {
        panelState: "unavailable",
        kind: "daily_limit",
        title: message === PLATO_USER_DAILY_LIMIT_MESSAGE ? "Today's PLATO question limit reached" : "PLATO has reached today's limit",
        detail: `${message} Your question is kept here.`,
        showRetry: false,
        showSignIn: false,
      };
    }
    return {
      panelState: "unavailable",
      kind: "rate_limit",
      title: ASHA_UNAVAILABLE_TITLE,
      detail: "PLATO's language model has reached its usage limit for now. Your question is kept here so you can retry later.",
      showRetry: true,
      showSignIn: false,
    };
  }
  if (code === "SERVICE_UNAVAILABLE") {
    return {
      panelState: "unavailable",
      kind: "capacity",
      title: ASHA_UNAVAILABLE_TITLE,
      detail: "PLATO's language model is under high demand or did not return a usable answer. Your question is kept here so you can retry in a few minutes.",
      showRetry: true,
      showSignIn: false,
    };
  }
  return {
    panelState: "unavailable",
    kind: "unavailable",
    title: ASHA_UNAVAILABLE_TITLE,
    detail: "PLATO could not answer just now. Your question is kept here so you can retry.",
    showRetry: true,
    showSignIn: false,
  };
}
