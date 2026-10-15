import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Request, Response } from "express";
import {
  hasExactCronAuthorization,
  hasVerifiedCronRequest,
  requireCron,
} from "./_core/cronGuard";

const projectRoot = resolve(import.meta.dirname, "..");
const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe("scheduled publishing authorization", () => {
  it("accepts only the exact configured scheduler bearer", () => {
    process.env.CRON_SECRET = "test-scheduler-secret";

    expect(hasExactCronAuthorization("Bearer test-scheduler-secret")).toBe(true);
    expect(hasExactCronAuthorization("Bearer incorrect-secret")).toBe(false);
    expect(hasExactCronAuthorization(undefined)).toBe(false);
    expect(
      hasVerifiedCronRequest({ headers: { authorization: "Bearer test-scheduler-secret" } } as Pick<Request, "headers">),
    ).toBe(true);
  });

  it("fails closed when the scheduler secret is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(hasExactCronAuthorization("Bearer any-value")).toBe(false);
  });

  it("allows a verified scheduler request through the HTTP guard", () => {
    process.env.CRON_SECRET = "test-scheduler-secret";
    let nextCalled = false;
    const response = {
      status: () => response,
      json: () => response,
    } as unknown as Response;

    requireCron(
      { headers: { authorization: "Bearer test-scheduler-secret" } } as Request,
      response,
      () => { nextCalled = true; },
    );

    expect(nextCalled).toBe(true);
  });

  it("keeps Daily Brief and blog publishers compatible with the verified bearer", () => {
    const publishing = readFileSync(resolve(projectRoot, "server/autonomousPublishing.ts"), "utf8");
    const blog = readFileSync(resolve(projectRoot, "server/scheduledBlog.ts"), "utf8");

    expect(publishing).toContain('if (hasVerifiedCronRequest(req)) return true;');
    expect(blog).toContain('if (hasVerifiedCronRequest(req)) return true;');
    expect(publishing).not.toContain('const user = await sdk.authenticateRequest(req);\n    if (!user.isCron');
    expect(blog).not.toContain('const user = await sdk.authenticateRequest(req);\n    if (!user.isCron');
  });
});
