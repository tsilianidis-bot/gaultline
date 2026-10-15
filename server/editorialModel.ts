import { canonicalChatModelId, isKnownNonChatModel } from "./ashaModelPolicy";

/**
 * Editorial generation is kept on a distinct, explicitly configurable model
 * from interactive PLATO. Both defaults remain within the already configured
 * Gemini-compatible gateway; this module never introduces another credential
 * or provider.
 */
export const DEFAULT_EDITORIAL_MODEL = "gemini-3.5-flash-lite";

export function editorialModel(env: NodeJS.ProcessEnv = process.env): string {
  const requested = canonicalChatModelId(env.FAULTLINE_EDITORIAL_MODEL ?? "");
  return requested && !isKnownNonChatModel(requested) ? requested : DEFAULT_EDITORIAL_MODEL;
}
