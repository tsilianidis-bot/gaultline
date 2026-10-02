export const ASHA_UNAVAILABLE_TITLE = "PLATO is temporarily unavailable";

export type AshaAskFailureKind = "unauthorized" | "rate_limit" | "unavailable";

export interface AshaAskFailureState {
  panelState: "unavailable";
  kind: AshaAskFailureKind;
  title: string;
  detail: string;
  showSignIn: boolean;
  showRetry: boolean;
}

function readTrpcCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { code?: unknown } }).data;
  return data && typeof data.code === "string" ? data.code : null;
}

/**
 * A failed PLATO ask stays on an unavailable panel with the question intact.
 * It never returns to the summon intro.
 */
export function reduceAshaAskFailure(error: unknown): AshaAskFailureState {
  const code = readTrpcCode(error);
  if (code === "UNAUTHORIZED") {
    return {
      panelState: "unavailable",
      kind: "unauthorized",
      title: ASHA_UNAVAILABLE_TITLE,
      detail: "Sign in to ask PLATO, then retry your question.",
      showSignIn: true,
      showRetry: true,
    };
  }
  if (code === "TOO_MANY_REQUESTS") {
    return {
      panelState: "unavailable",
      kind: "rate_limit",
      title: ASHA_UNAVAILABLE_TITLE,
      detail: "PLATO is at capacity right now. Your question is kept here so you can retry.",
      showSignIn: false,
      showRetry: true,
    };
  }
  return {
    panelState: "unavailable",
    kind: "unavailable",
    title: ASHA_UNAVAILABLE_TITLE,
    detail: "PLATO could not answer just now. Your question is kept here so you can retry.",
    showSignIn: false,
    showRetry: true,
  };
}
