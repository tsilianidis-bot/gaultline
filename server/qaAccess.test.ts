import { afterEach, describe, expect, it } from "vitest";
import { handleQaAccess, isManagedPreview, isManagedPreviewFlagEnabled, isQaSession, QA_ACCESS_COOKIE } from "./qaAccess";

function fakeResponse() {
  const state: { status?: number; body?: unknown; cookie?: { name: string; value: string; options: Record<string, unknown> } } = {};
  return {
    state,
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
    cookie(name: string, value: string, options: Record<string, unknown>) { state.cookie = { name, value, options }; return this; },
  };
}

const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  FAULTLINE_MANAGED_PREVIEW: process.env.FAULTLINE_MANAGED_PREVIEW,
  QA_ACCESS_SECRET: process.env.QA_ACCESS_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("permanent owner QA access", () => {
  it.skipIf(!process.env.QA_ACCESS_SECRET)("accepts the configured secret, issues only an HttpOnly signed cookie, and verifies its session", () => {
    const secret = process.env.QA_ACCESS_SECRET;
    expect(secret).toBeTruthy();
    const res = fakeResponse();
    handleQaAccess({ body: { secret }, protocol: "https", headers: {} } as any, res as any);
    expect(res.state.status).toBeUndefined();
    expect(res.state.body).toEqual({ ok: true, mode: "owner_qa_read_only" });
    expect(res.state.cookie?.name).toBe(QA_ACCESS_COOKIE);
    expect(res.state.cookie?.options.httpOnly).toBe(true);
    expect(res.state.cookie?.options.secure).toBe(true);
    expect(isQaSession({ headers: { cookie: `${QA_ACCESS_COOKIE}=${res.state.cookie?.value}` } } as any)).toBe(true);
  });

  it("rejects an invalid secret without issuing a QA session", () => {
    const res = fakeResponse();
    handleQaAccess({ body: { secret: "incorrect" }, protocol: "https", headers: {} } as any, res as any);
    expect(res.state.status).toBe(401);
    expect(res.state.cookie).toBeUndefined();
    expect(res.state.body).toEqual({ ok: false, error: "invalid_qa_access_secret" });
  });

  it("does not auto-grant managed-preview QA unless FAULTLINE_MANAGED_PREVIEW=true", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FAULTLINE_MANAGED_PREVIEW;
    const req = { headers: { host: "staging.up.railway.app" } } as any;
    expect(isManagedPreviewFlagEnabled()).toBe(false);
    expect(isManagedPreview(req)).toBe(false);
    expect(isQaSession(req)).toBe(false);

    process.env.FAULTLINE_MANAGED_PREVIEW = "false";
    expect(isManagedPreviewFlagEnabled()).toBe(false);
    expect(isManagedPreview(req)).toBe(false);
    expect(isQaSession(req)).toBe(false);
  });

  it("enables managed-preview QA on independent hosts only when FAULTLINE_MANAGED_PREVIEW=true", () => {
    process.env.NODE_ENV = "production";
    process.env.FAULTLINE_MANAGED_PREVIEW = "true";
    const req = { headers: { host: "staging.up.railway.app" } } as any;
    expect(isManagedPreviewFlagEnabled()).toBe(true);
    expect(isManagedPreview(req)).toBe(true);
    expect(isQaSession(req)).toBe(true);
  });

  it("keeps secret-gated QA on production-like hosts without the managed-preview flag", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FAULTLINE_MANAGED_PREVIEW;
    process.env.QA_ACCESS_SECRET = "independent-staging-qa-secret";
    const res = fakeResponse();
    handleQaAccess(
      { body: { secret: "independent-staging-qa-secret" }, protocol: "https", headers: { host: "staging.up.railway.app" } } as any,
      res as any,
    );
    expect(res.state.body).toEqual({ ok: true, mode: "owner_qa_read_only" });
    expect(
      isQaSession({
        headers: {
          host: "staging.up.railway.app",
          cookie: `${QA_ACCESS_COOKIE}=${res.state.cookie?.value}`,
        },
      } as any),
    ).toBe(true);
  });
});
