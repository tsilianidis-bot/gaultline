import { afterEach, describe, expect, it } from "vitest";
import {
  configuredQaAccessHost,
  handleQaAccess,
  isExactQaAccessHost,
  isManagedPreview,
  isManagedPreviewFlagEnabled,
  isQaSession,
  QA_ACCESS_COOKIE,
} from "./qaAccess";

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
  QA_ACCESS_HOST: process.env.QA_ACCESS_HOST,
};

const QA_HOST = "qa.faultline.test";

function request(host = QA_HOST, secret?: string) {
  return { body: { secret }, protocol: "https", headers: { host } } as any;
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("permanent owner QA access", () => {
  it("issues an HttpOnly signed cookie only on the configured exact host", () => {
    process.env.QA_ACCESS_HOST = QA_HOST;
    process.env.QA_ACCESS_SECRET = "owner-qa-secret";
    const res = fakeResponse();

    handleQaAccess(request(QA_HOST, "owner-qa-secret"), res as any);

    expect(configuredQaAccessHost()).toBe(QA_HOST);
    expect(res.state.body).toEqual({ ok: true, mode: "owner_qa_read_only" });
    expect(res.state.cookie?.name).toBe(QA_ACCESS_COOKIE);
    expect(res.state.cookie?.options.httpOnly).toBe(true);
    expect(res.state.cookie?.options.secure).toBe(true);
    expect(isQaSession({ headers: { host: QA_HOST, cookie: `${QA_ACCESS_COOKIE}=${res.state.cookie?.value}` } } as any)).toBe(true);
  });

  it("rejects credentials and sessions from every non-exact host", () => {
    process.env.QA_ACCESS_HOST = QA_HOST;
    process.env.QA_ACCESS_SECRET = "owner-qa-secret";
    const res = fakeResponse();

    handleQaAccess(request(`preview.${QA_HOST}`, "owner-qa-secret"), res as any);

    expect(res.state.status).toBe(403);
    expect(res.state.cookie).toBeUndefined();
    expect(res.state.body).toEqual({ ok: false, error: "qa_access_host_not_allowed" });
    expect(isExactQaAccessHost({ headers: { host: QA_HOST } } as any)).toBe(true);
    expect(isExactQaAccessHost({ headers: { host: `${QA_HOST}:443` } } as any)).toBe(false);
    expect(isQaSession({ headers: { host: `preview.${QA_HOST}`, cookie: `${QA_ACCESS_COOKIE}=anything` } } as any)).toBe(false);
  });

  it("allows managed-preview QA only when the exact configured host is explicitly opted in", () => {
    process.env.QA_ACCESS_HOST = QA_HOST;
    process.env.FAULTLINE_MANAGED_PREVIEW = "true";

    expect(isManagedPreviewFlagEnabled()).toBe(true);
    expect(isManagedPreview({ headers: { host: QA_HOST } } as any)).toBe(true);
    expect(isQaSession({ headers: { host: QA_HOST } } as any)).toBe(true);
    expect(isManagedPreview({ headers: { host: `other.${QA_HOST}` } } as any)).toBe(false);
  });
});
