import { describe, expect, it } from "vitest";
import { handleQaAccess, isQaSession, QA_ACCESS_COOKIE } from "./qaAccess";

function fakeResponse() {
  const state: { status?: number; body?: unknown; cookie?: { name: string; value: string; options: Record<string, unknown> } } = {};
  return {
    state,
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
    cookie(name: string, value: string, options: Record<string, unknown>) { state.cookie = { name, value, options }; return this; },
  };
}

describe("permanent owner QA access", () => {
  it("accepts the configured secret, issues only an HttpOnly signed cookie, and verifies its session", () => {
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
});
