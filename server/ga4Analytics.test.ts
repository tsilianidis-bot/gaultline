import { describe, expect, it } from "vitest";
import {
  buildGa4PageViewParams,
  DEFAULT_GA4_MEASUREMENT_ID,
  normalizeGa4EventName,
  resolveGa4MeasurementId,
  sanitizeGa4EventParams,
} from "../client/src/lib/ga4";

describe("GA4 analytics contract", () => {
  it("uses a valid configured Measurement ID and falls back safely", () => {
    expect(resolveGa4MeasurementId(" g-abc12345 ")).toBe("G-ABC12345");
    expect(resolveGa4MeasurementId("UA-LEGACY-ID")).toBe(DEFAULT_GA4_MEASUREMENT_ID);
    expect(resolveGa4MeasurementId()).toBe(DEFAULT_GA4_MEASUREMENT_ID);
  });

  it("normalizes custom event names to the GA4-compatible contract", () => {
    expect(normalizeGa4EventName("Signup Completed! ")).toBe("signup_completed");
    expect(normalizeGa4EventName("123 checkout")).toBeNull();
    expect(normalizeGa4EventName("Feature Used With A Very Long Descriptive Name")).toHaveLength(40);
  });

  it("removes direct identifiers and unsafe URL query parameters", () => {
    const sanitized = sanitizeGa4EventParams({
      customer_email: "customer@example.com",
      user_name: "Customer Name",
      page_location:
        "https://getfaultline.live/checkout/success?session_id=cs_secret&utm_source=launch&plan=lifetime#complete",
      ticker: "NVDA",
      value: Number.POSITIVE_INFINITY,
      items: [
        {
          item_id: "lifetime",
          item_name: "FAULTLINE Founding Lifetime",
          customer_email: "customer@example.com",
        },
      ],
    });

    expect(sanitized).not.toHaveProperty("customer_email");
    expect(sanitized).not.toHaveProperty("user_name");
    expect(sanitized).not.toHaveProperty("value");
    expect(sanitized.page_location).toBe(
      "https://getfaultline.live/checkout/success?utm_source=launch&plan=lifetime",
    );
    expect(sanitized.ticker).toBe("NVDA");
    expect(sanitized.items).toEqual([
      {
        item_id: "lifetime",
        item_name: "FAULTLINE Founding Lifetime",
      },
    ]);
  });

  it("builds a sanitized manual page_view payload for SPA navigation", () => {
    const params = buildGa4PageViewParams(
      "/checkout/success?session_id=cs_secret&plan=lifetime",
      "FAULTLINE — Checkout Complete",
      "https://getfaultline.live/checkout/success?session_id=cs_secret&plan=lifetime#receipt",
    );

    expect(params).toEqual({
      page_path: "/checkout/success?plan=lifetime",
      page_title: "FAULTLINE — Checkout Complete",
      page_location: "https://getfaultline.live/checkout/success?plan=lifetime",
      send_to: DEFAULT_GA4_MEASUREMENT_ID,
    });
  });
});
