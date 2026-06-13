/**
 * FAULTLINE Error Tracking
 *
 * Provides a unified error capture interface that:
 *  1. Sends errors to Sentry when SENTRY_DSN is configured (production)
 *  2. Falls back to the structured logger when Sentry is not available
 *
 * This design means the app never crashes due to missing Sentry config,
 * and local/staging environments get full structured log output without
 * needing a Sentry account.
 *
 * Usage:
 *   import { captureError, captureMessage, setUserContext } from "./errorTracking";
 *
 *   captureError(err, { procedure: "pressure.getCurrentPressure", userId: 42 });
 *   captureMessage("Stripe webhook received unknown event type", "warning", { eventType });
 */

import { log } from "./logger";

// ── Types ─────────────────────────────────────────────────────

export type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

export interface ErrorContext {
  /** tRPC procedure or Express route where the error occurred */
  procedure?: string;
  /** Authenticated user ID if available */
  userId?: number;
  /** Access tier of the user */
  userTier?: string;
  /** Any additional structured metadata */
  [key: string]: unknown;
}

// ── Sentry lazy loader ────────────────────────────────────────

let _sentry: typeof import("@sentry/node") | null = null;
let _sentryInitialized = false;

type SentryModule = typeof import("@sentry/node");

async function getSentry(): Promise<SentryModule | null> {
  if (_sentryInitialized) return _sentry;
  _sentryInitialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    log.debug("[ErrorTracking] SENTRY_DSN not set — using structured logger fallback");
    return null;
  }

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      // Only send 100% of errors in production; sample 10% in staging to reduce noise
      tracesSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0.1,
      // Attach release tag if available (set by CI/CD)
      release: process.env.APP_VERSION ?? undefined,
      // Scrub sensitive fields from payloads
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeSend(event: any) {
        // Strip Authorization headers and cookie values from captured requests
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        return event;
      },
    });
    _sentry = Sentry;
    log.info("[ErrorTracking] Sentry initialized", { environment: process.env.NODE_ENV });
    return Sentry;
  } catch (err) {
    log.warn("[ErrorTracking] Failed to load @sentry/node — falling back to logger", { err });
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Capture an error with optional structured context.
 * Sends to Sentry if configured; otherwise logs as ERROR.
 */
export async function captureError(
  err: unknown,
  context?: ErrorContext
): Promise<void> {
  const sentry = await getSentry();

  if (sentry) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sentry.withScope((scope: any) => {
      if (context?.userId) scope.setUser({ id: String(context.userId) });
      if (context?.userTier) scope.setTag("user_tier", context.userTier);
      if (context?.procedure) scope.setTag("procedure", context.procedure);
      if (context) scope.setContext("faultline", context);
      sentry.captureException(err);
    });
  } else {
    // Structured logger fallback — always available
    const errorMeta: Record<string, unknown> = { ...context };
    if (err instanceof Error) {
      errorMeta.errorMessage = err.message;
      errorMeta.errorStack = err.stack;
    } else {
      errorMeta.error = String(err);
    }
    log.error("[ErrorTracking] Unhandled error captured", errorMeta);
  }
}

/**
 * Capture a diagnostic message (non-error) with a severity level.
 * Useful for tracking unexpected-but-non-fatal conditions.
 */
export async function captureMessage(
  message: string,
  severity: ErrorSeverity = "info",
  context?: ErrorContext
): Promise<void> {
  const sentry = await getSentry();

  if (sentry) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sentry.withScope((scope: any) => {
      if (context?.userId) scope.setUser({ id: String(context.userId) });
      if (context) scope.setContext("faultline", context);
      sentry.captureMessage(message, severity);
    });
  } else {
    const logLevel = severity === "fatal" || severity === "error" ? "error"
      : severity === "warning" ? "warn"
      : "info";
    log[logLevel](`[ErrorTracking] ${message}`, context);
  }
}

/**
 * Set the current user context for subsequent error captures.
 * Call this after authentication in request middleware.
 */
export async function setUserContext(userId: number, tier?: string): Promise<void> {
  const sentry = await getSentry();
  if (sentry) {
    sentry.setUser({ id: String(userId), tier });
  }
}

/**
 * Flush pending events before process shutdown.
 * Call in SIGTERM handler to avoid losing events on cold-start shutdown.
 */
export async function flushErrorTracking(timeoutMs = 2000): Promise<void> {
  const sentry = await getSentry();
  if (sentry) {
    await sentry.close(timeoutMs);
  }
}
