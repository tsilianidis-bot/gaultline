export type InternalPageView = {
  sessionId: string;
  visitorId: string;
  userId?: number;
  path: string;
  title: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  screenWidth?: number;
};

type AnalyticsTransport = {
  sendBeacon?: (url: string, data: BodyInit | null) => boolean;
  fetch?: typeof fetch;
};

export function queueInternalPageView(
  payload: InternalPageView,
  transport: AnalyticsTransport = {},
): "beacon" | "fetch" | "unavailable" {
  const serialized = JSON.stringify(payload);
  const sendBeacon = transport.sendBeacon ?? (
    typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon.bind(navigator)
      : undefined
  );

  if (sendBeacon) {
    try {
      const body = new Blob([serialized], { type: "application/json" });
      if (sendBeacon("/api/analytics/pageview", body)) return "beacon";
    } catch {
      // Fall through to fetch when the browser cannot queue a beacon.
    }
  }

  const fetchImpl = transport.fetch ?? (
    typeof fetch === "function" ? fetch : undefined
  );

  if (!fetchImpl) return "unavailable";

  void fetchImpl("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serialized,
    keepalive: true,
  }).catch(() => undefined);

  return "fetch";
}
