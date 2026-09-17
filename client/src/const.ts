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
 * Build the Manus app-auth login URL. Returns "" when the portal or app id is
 * missing/invalid so module load and first render cannot throw `Invalid URL`.
 * When both are set, the constructed URL matches the previous production shape.
 */
export function buildLoginUrl(
  oauthPortalUrl: unknown,
  appId: unknown,
  origin: string,
): string {
  if (!isValidAbsoluteUrl(oauthPortalUrl) || !isNonEmptyString(appId)) {
    return "";
  }

  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return "";
  }
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return buildLoginUrl(
    import.meta.env.VITE_OAUTH_PORTAL_URL,
    import.meta.env.VITE_APP_ID,
    origin,
  );
};

/**
 * Navigate to the OAuth portal only when Vite OAuth env produced a real URL.
 * Independent staging leaves getLoginUrl() as "" — do not send the browser to Manus.
 */
export function navigateToLogin(): void {
  const url = getLoginUrl();
  if (!url) return;
  if (typeof window === "undefined") return;
  window.location.href = url;
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
