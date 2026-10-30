export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** True only for http(s) absolute URLs. Relative, empty, and placeholder values fail. */
export function isValidAbsoluteUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * OAuth state must be generated and stored by the server, not deterministically
 * derived in browser JavaScript. The server validates provider configuration,
 * issues a secure HttpOnly browser verifier, and then redirects to the portal.
 */
export function buildLoginUrl(
  oauthPortalUrl: unknown,
  appId: unknown,
  _origin?: string,
): string {
  if (!isValidAbsoluteUrl(oauthPortalUrl) || !isNonEmptyString(appId)) {
    return "";
  }
  return "/api/oauth/login";
}

// Generate the local initiation URL at runtime so first render stays safe when
// OAuth configuration is absent from an independent staging build.
export const getLoginUrl = () => buildLoginUrl(
  import.meta.env.VITE_OAUTH_PORTAL_URL,
  import.meta.env.VITE_APP_ID,
);

/**
 * Navigate only to the local OAuth initiator when client configuration indicates
 * sign-in is available. The server independently fails closed if its durable
 * state store or its provider configuration is unavailable.
 */
export function navigateToLogin(): boolean {
  const url = getLoginUrl();
  if (!url) return false;
  if (typeof window === "undefined") return false;
  window.location.href = url;
  return true;
}

/** Prevent empty-href same-document navigation when OAuth is inactive. */
export function handleLoginCtaClick(event?: { preventDefault(): void }): void {
  const url = getLoginUrl();
  if (!url) {
    event?.preventDefault();
    return;
  }
  navigateToLogin();
}
