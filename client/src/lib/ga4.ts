import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  getConsentChoice,
  type ConsentChoice,
} from "@/lib/analyticsConsent";

export const DEFAULT_GA4_MEASUREMENT_ID = "G-YLJ9EQZK7P";
export const GA4_READY_EVENT = "faultline:ga4-ready";

const GA4_SCRIPT_ID = "faultline-ga4-script";
const CLARITY_SCRIPT_ID = "faultline-clarity-script";
const CLARITY_PROJECT_ID = "xlipasu6ui";
const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_KEY_LENGTH = 40;
const MAX_PARAM_STRING_LENGTH = 500;

const DISALLOWED_PARAM_KEYS = new Set([
  "address",
  "customer_email",
  "customer_name",
  "email",
  "first_name",
  "ip",
  "ip_address",
  "last_name",
  "name",
  "open_id",
  "openid",
  "phone",
  "phone_number",
  "user_email",
  "user_name",
]);

const ALLOWED_QUERY_PARAMS = new Set([
  "plan",
  "ref",
  "source",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };
type AnalyticsWindow = Window & { clarity?: ClarityFunction };

let ga4Initialized = false;
let analyticsListenerInstalled = false;
let lastPageViewKey: string | null = null;

export type Ga4EventParams = Record<string, unknown>;

export function resolveGa4MeasurementId(configuredId?: string): string {
  const candidate = configuredId?.trim().toUpperCase();
  return candidate && /^G-[A-Z0-9]{6,15}$/.test(candidate)
    ? candidate
    : DEFAULT_GA4_MEASUREMENT_ID;
}

export const GA4_MEASUREMENT_ID = resolveGa4MeasurementId(
  import.meta.env.VITE_GA4_MEASUREMENT_ID,
);

export function normalizeGa4EventName(eventName: string): string | null {
  const normalized = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_EVENT_NAME_LENGTH);

  if (!normalized || !/^[a-z]/.test(normalized)) return null;
  return normalized;
}

function sanitizeUrlValue(rawValue: string, baseOrigin: string): string {
  try {
    const parsed = new URL(rawValue, baseOrigin);
    const filtered = new URLSearchParams();

    parsed.searchParams.forEach((value, key) => {
      if (ALLOWED_QUERY_PARAMS.has(key.toLowerCase())) {
        filtered.append(key, value.slice(0, 100));
      }
    });

    const query = filtered.toString();
    parsed.search = query ? `?${query}` : "";
    parsed.hash = "";

    if (rawValue.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}`;
    }

    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return rawValue.split("#", 1)[0].split("?", 1)[0].slice(0, MAX_PARAM_STRING_LENGTH);
  }
}

function sanitizePrimitive(key: string, value: unknown, baseOrigin: string): unknown {
  if (typeof value === "string") {
    if (
      key.includes("url") ||
      key.includes("location") ||
      key.includes("path") ||
      key.includes("referrer")
    ) {
      return sanitizeUrlValue(value, baseOrigin).slice(0, MAX_PARAM_STRING_LENGTH);
    }
    return value.slice(0, MAX_PARAM_STRING_LENGTH);
  }

  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  return undefined;
}

function sanitizeObject(
  input: Record<string, unknown>,
  baseOrigin: string,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key)) continue;
    if (key.length > MAX_PARAM_KEY_LENGTH || DISALLOWED_PARAM_KEYS.has(key)) continue;
    if (rawValue === undefined || rawValue === null) continue;

    if (Array.isArray(rawValue)) {
      const sanitizedItems = rawValue
        .slice(0, 200)
        .map(item => {
          if (typeof item !== "object" || item === null || Array.isArray(item)) return undefined;
          return sanitizeObject(item as Record<string, unknown>, baseOrigin);
        })
        .filter((item): item is Record<string, unknown> => Boolean(item));
      if (sanitizedItems.length > 0) output[key] = sanitizedItems;
      continue;
    }

    if (typeof rawValue === "object") {
      const nested = sanitizeObject(rawValue as Record<string, unknown>, baseOrigin);
      if (Object.keys(nested).length > 0) output[key] = nested;
      continue;
    }

    const sanitized = sanitizePrimitive(key, rawValue, baseOrigin);
    if (sanitized !== undefined) output[key] = sanitized;
  }

  return output;
}

export function sanitizeGa4EventParams(
  params: Ga4EventParams,
  baseOrigin = "https://getfaultline.live",
): Record<string, unknown> {
  return sanitizeObject(params, baseOrigin);
}

export function buildGa4PageViewParams(
  path: string,
  title: string,
  pageLocation: string,
  baseOrigin = "https://getfaultline.live",
): Record<string, unknown> {
  return sanitizeGa4EventParams(
    {
      page_path: path,
      page_title: title,
      page_location: pageLocation,
      send_to: GA4_MEASUREMENT_ID,
    },
    baseOrigin,
  );
}

function ensureGtag(): void {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

function setGoogleConsent(choice: ConsentChoice): void {
  ensureGtag();
  window.gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: choice === "accepted" ? "granted" : "denied",
  });
}

function initializeGa4(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (getConsentChoice() !== "accepted") return false;

  ensureGtag();
  if (!ga4Initialized) {
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
    setGoogleConsent("accepted");
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID, {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      cookie_flags: "SameSite=None;Secure",
      debug_mode:
        import.meta.env.DEV ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1",
      send_page_view: false,
    });

    if (!document.getElementById(GA4_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GA4_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
      document.head.appendChild(script);
    }

    ga4Initialized = true;
    window.dispatchEvent(new Event(GA4_READY_EVENT));
  }

  return true;
}

function initializeClarity(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (getConsentChoice() !== "accepted" || document.getElementById(CLARITY_SCRIPT_ID)) return;

  const analyticsWindow = window as AnalyticsWindow;
  if (!analyticsWindow.clarity) {
    const clarity: ClarityFunction = (...args: unknown[]) => {
      clarity.q = clarity.q || [];
      clarity.q.push(args);
    };
    analyticsWindow.clarity = clarity;
  }

  const script = document.createElement("script");
  script.id = CLARITY_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}

function handleConsentChange(): void {
  const choice = getConsentChoice();
  if (choice === "accepted") {
    initializeGa4();
    initializeClarity();
    return;
  }

  if (ga4Initialized) setGoogleConsent("declined");
}

export function initializeAnalytics(): boolean {
  if (typeof window === "undefined") return false;

  if (!analyticsListenerInstalled) {
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
    analyticsListenerInstalled = true;
  }

  if (getConsentChoice() !== "accepted") return false;
  const initialized = initializeGa4();
  initializeClarity();
  return initialized;
}

export function trackGa4Event(eventName: string, params: Ga4EventParams = {}): boolean {
  if (typeof window === "undefined" || getConsentChoice() !== "accepted") return false;
  if (!initializeGa4()) return false;

  const normalizedEventName = normalizeGa4EventName(eventName);
  if (!normalizedEventName) return false;

  const sanitizedParams = sanitizeGa4EventParams(
    { ...params, send_to: GA4_MEASUREMENT_ID },
    window.location.origin,
  );
  window.gtag("event", normalizedEventName, sanitizedParams);
  return true;
}

export function trackGa4PageView(path: string, title?: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const params = buildGa4PageViewParams(
    path,
    title || document.title || "FAULTLINE",
    window.location.href,
    window.location.origin,
  );
  const pageViewKey = `${String(params.page_path)}|${String(params.page_location)}`;
  if (pageViewKey === lastPageViewKey) return false;

  const tracked = trackGa4Event("page_view", params);
  if (tracked) lastPageViewKey = pageViewKey;
  return tracked;
}

export function resetGa4PageViewDedupe(): void {
  lastPageViewKey = null;
}
