import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEPLOYMENT_SAFETY_ENV,
  assertAutomaticPublicationEnabled,
  requireScheduledDispatch,
  scheduledDispatchDecision,
} from "./deploymentSafety";

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { status, json } };
}

const canonicalCollectionFixture = {
  [DEPLOYMENT_SAFETY_ENV.nativeCronDispatch]: "true",
  [DEPLOYMENT_SAFETY_ENV.canonicalCollection]: "true",
};

describe("deployment side-effect controls", () => {
  it("fails closed when no deployment opt-ins are present", () => {
    expect(scheduledDispatchDecision("canonical-collection", {})).toEqual({
      allowed: false,
      code: "native_cron_dispatch_disabled",
    });
    expect(scheduledDispatchDecision("automatic-publication", {})).toEqual({
      allowed: false,
      code: "native_cron_dispatch_disabled",
    });
    expect(scheduledDispatchDecision("outbound-customer-communication", {})).toEqual({
      allowed: false,
      code: "native_cron_dispatch_disabled",
    });
  });

  it("allows isolated canonical collection without enabling email, X, blog, or autonomous publication", () => {
    expect(scheduledDispatchDecision("canonical-collection", canonicalCollectionFixture)).toEqual({ allowed: true });
    expect(scheduledDispatchDecision("automatic-publication", canonicalCollectionFixture)).toEqual({
      allowed: false,
      code: "automatic_publication_disabled",
    });
    expect(scheduledDispatchDecision("outbound-customer-communication", canonicalCollectionFixture)).toEqual({
      allowed: false,
      code: "outbound_customer_communication_disabled",
    });
  });

  it("requires exact true values rather than accepting legacy truthy schedule defaults", () => {
    const nonExact = {
      [DEPLOYMENT_SAFETY_ENV.nativeCronDispatch]: "1",
      [DEPLOYMENT_SAFETY_ENV.canonicalCollection]: "TRUE",
      [DEPLOYMENT_SAFETY_ENV.automaticPublication]: "yes",
      [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "enabled",
    };
    expect(scheduledDispatchDecision("canonical-collection", nonExact)).toMatchObject({ allowed: false });
    expect(scheduledDispatchDecision("automatic-publication", nonExact)).toMatchObject({ allowed: false });
    expect(scheduledDispatchDecision("outbound-customer-communication", nonExact)).toMatchObject({ allowed: false });
  });

  it("denies before an unapproved scheduled handler can run", () => {
    const next = vi.fn();
    const { json, status, res } = response();
    requireScheduledDispatch("automatic-publication", {})(
      {} as never,
      res as never,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: "scheduled_dispatch_disabled",
      code: "native_cron_dispatch_disabled",
    });
  });

  it("allows the canonical handler only with the explicit isolated candidate fixture", () => {
    const next = vi.fn();
    const { status, res } = response();
    requireScheduledDispatch("canonical-collection", canonicalCollectionFixture)(
      {} as never,
      res as never,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects direct X adapter use before a client can be constructed", () => {
    expect(() => assertAutomaticPublicationEnabled({
      [DEPLOYMENT_SAFETY_ENV.automaticPublication]: "false",
      X_API_KEY: "fixture-only",
      X_API_SECRET: "fixture-only",
      X_ACCESS_TOKEN: "fixture-only",
      X_ACCESS_TOKEN_SECRET: "fixture-only",
    })).toThrow("Automatic publication is disabled");
  });

  it("mounts every scheduled customer-facing outbound route behind the explicit dispatch control", () => {
    const source = readFileSync(resolve(import.meta.dirname, "_core/index.ts"), "utf8");
    for (const route of [
      "/api/scheduled/publish-blog",
      "/api/scheduled/auto-publish-drafts",
      "/api/scheduled/x-post-scheduled",
      "/api/scheduled/x-news-monitor",
      "/api/scheduled/daily-brief",
      "/api/scheduled/weekly-review",
      "/api/scheduled/monthly-report",
    ]) {
      expect(source).toContain(`app.post("${route}", requireCron, requireScheduledDispatch("automatic-publication")`);
    }
    expect(source).toContain('app.post("/api/scheduled/drip-email", requireCron, requireScheduledDispatch("outbound-customer-communication")');
  });
});
