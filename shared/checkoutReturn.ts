/**
 * Post-sign-in return destination for the checkout success page.
 *
 * The OAuth callback always lands on `/app`, so a signed-out visitor arriving on
 * `/checkout/success?session_id=…` would lose their place. The success page stores
 * its own URL here before sending the visitor to sign in; the app shell restores it
 * once, right after sign-in.
 *
 * SAFETY: only same-origin paths on an explicit allowlist are ever restored (no open
 * redirect), entries expire, and nothing but the path (which already contains the
 * session id the visitor was handed by Stripe) is stored. No session data, no email.
 */
export const POST_LOGIN_RETURN_KEY = "fl_post_login_return_v1";
export const POST_LOGIN_RETURN_TTL_MS = 30 * 60 * 1000;
const ALLOWED_RETURN_PATHNAMES = ["/checkout/success"];
const MAX_LENGTH = 512;

/** Returns the path unchanged when it is a safe, allowlisted same-origin path; otherwise null. */
export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const pathname = raw.split(/[?#]/, 1)[0];
  return ALLOWED_RETURN_PATHNAMES.includes(pathname) ? raw : null;
}

export function encodeReturnPath(path: string, now: number = Date.now()): string | null {
  const safe = sanitizeReturnPath(path);
  return safe ? JSON.stringify({ path: safe, at: now }) : null;
}

/** Decodes a stored entry; null if malformed, expired, or no longer safe. */
export function decodeReturnPath(stored: string | null | undefined, now: number = Date.now()): string | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { path?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || now - parsed.at > POST_LOGIN_RETURN_TTL_MS || parsed.at > now + 60_000) return null;
    return sanitizeReturnPath(parsed.path);
  } catch {
    return null;
  }
}
