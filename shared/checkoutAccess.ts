/**
 * Request-time checkout gates. Pure: callers pass the environment they just read.
 * CHECKOUT_ENABLED in shared/tiers.ts is compiled into the bundle. These helpers
 * are what let an operator stop or allowlist checkout without a rebuild.
 */

export type CheckoutBuyer = {
  id: number | string;
  email?: string | null;
};

export type CheckoutBlockReason = "runtime_off" | "allowlist" | "not_for_sale" | "unconfigured";

export const CHECKOUT_RUNTIME_ENABLED_ENV = "CHECKOUT_RUNTIME_ENABLED";
export const CHECKOUT_ALLOWLIST_ONLY_ENV = "CHECKOUT_ALLOWLIST_ONLY";
export const CHECKOUT_ALLOWLIST_USER_IDS_ENV = "CHECKOUT_ALLOWLIST_USER_IDS";
export const CHECKOUT_ALLOWLIST_EMAILS_ENV = "CHECKOUT_ALLOWLIST_EMAILS";

export const CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY = "Checkout is temporarily unavailable.";
export const CHECKOUT_ALLOWLIST_COPY = "Checkout is limited to approved accounts.";

export type CheckoutEnv = Record<string, string | undefined>;

function flagOn(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "on" || value === "yes";
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? "").split(/[,;\s]+/).map(part => part.trim()).filter(Boolean);
}

/**
 * Compiled true is not enough. Checkout runs only when CHECKOUT_RUNTIME_ENABLED
 * is explicitly true. Unset, empty, or false keeps checkout closed (kill switch).
 * A compiled false build stays closed even if the variable is true.
 */
export function isCheckoutRuntimeEnabled(env: CheckoutEnv, compiledEnabled: boolean): boolean {
  if (!compiledEnabled) return false;
  return flagOn(env[CHECKOUT_RUNTIME_ENABLED_ENV]);
}

/** Allowlist mode is off unless CHECKOUT_ALLOWLIST_ONLY is explicitly true. */
export function isCheckoutAllowlistOnly(env: CheckoutEnv): boolean {
  return flagOn(env[CHECKOUT_ALLOWLIST_ONLY_ENV]);
}

/**
 * When allowlist mode is off, every buyer (including anonymous plan listing) passes.
 * When allowlist mode is on, deny unless the user id or email is listed.
 * An empty allowlist denies everyone.
 */
export function isCheckoutBuyerAllowed(env: CheckoutEnv, buyer: CheckoutBuyer | null): boolean {
  if (!isCheckoutAllowlistOnly(env)) return true;
  const userIds = splitList(env[CHECKOUT_ALLOWLIST_USER_IDS_ENV]);
  const emails = splitList(env[CHECKOUT_ALLOWLIST_EMAILS_ENV]).map(email => email.toLowerCase());
  if (userIds.length === 0 && emails.length === 0) return false;
  if (!buyer) return false;
  if (userIds.includes(String(buyer.id))) return true;
  const email = buyer.email?.trim().toLowerCase();
  return Boolean(email && emails.includes(email));
}
