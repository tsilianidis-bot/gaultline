export type StripeRuntimeMode = "test" | "live" | "unavailable";

/** Live Stripe is disabled unless this exact explicit launch authorization is set. */
export function isStripeLaunchAuthorized(): boolean {
  return process.env.FAULTLINE_STRIPE_LAUNCH_AUTHORIZED === "true";
}

export function resolveStripeRuntimeMode(secretKey: string | null | undefined): StripeRuntimeMode {
  const key = secretKey?.trim() ?? "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unavailable";
}

/**
 * Permits test keys by default. Live keys are fail-closed until explicit launch
 * authorization is present; unknown key formats are never initialized.
 */
export function permittedStripeSecretKey(secretKey: string | null | undefined): string | null {
  const key = secretKey?.trim() ?? "";
  const mode = resolveStripeRuntimeMode(key);
  if (mode === "test") return key;
  if (mode === "live" && isStripeLaunchAuthorized()) return key;
  return null;
}
