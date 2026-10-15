import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Real component, mocked hooks. This asserts what the PAGE renders for each auth state; it is not an end-to-end test.
let authState: { user: unknown; loading: boolean; offline: boolean } = { user: null, loading: false, offline: false };
let queryArgs: any[] = [];
let queryResult: any = { data: undefined, isLoading: false, isError: false };

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/lib/trpc", () => ({
  trpc: { billing: { verifyCheckoutSession: { useQuery: (...a: any[]) => { queryArgs = a; return queryResult; } } } },
}));
vi.mock("@/hooks/useAnalytics", () => ({ trackPurchaseConfirmed: () => undefined }));
vi.mock("@/const", () => ({ getLoginUrl: () => "https://auth.example/app-auth?type=signIn" }));
vi.mock("wouter", () => ({ useLocation: () => ["/checkout/success", () => undefined] }));

async function render() {
  (globalThis as any).React = React; // vitest's esbuild uses the classic JSX runtime for the client page
  const mod = await import("../../client/src/pages/CheckoutSuccess");
  return renderToStaticMarkup(createElement(mod.default));
}

beforeEach(() => {
  (globalThis as any).window = { location: { search: "?session_id=cs_test_123&plan=premium", pathname: "/checkout/success" } };
  queryArgs = [];
  queryResult = { data: undefined, isLoading: false, isError: false };
});

describe("CheckoutSuccess — signed-out visitor", () => {
  it("shows 'Sign in to verify your access' with a sign-in link, and no payment-failure / session data", async () => {
    authState = { user: null, loading: false, offline: false };
    const html = await render();
    expect(html).toContain("Sign in to verify your access");
    expect(html).toContain('href="https://auth.example/app-auth?type=signIn"');
    expect(html).not.toMatch(/Verification Failed|couldn&#x27;t verify your payment|Payment Pending|PAYMENT CONFIRMED|Receipt sent/i);
    expect(html).not.toContain("cs_test_123");
  });

  it("does not fire the protected session lookup while signed out", async () => {
    authState = { user: null, loading: false, offline: false };
    await render();
    expect(queryArgs[1].enabled).toBe(false);
  });

  it("shows a spinner (not the sign-in prompt) while auth is still loading", async () => {
    authState = { user: null, loading: true, offline: false };
    const html = await render();
    expect(html).toContain("CONFIRMING PAYMENT");
    expect(html).not.toContain("Sign in to verify your access");
  });

  it("does not claim signed-out when identity is unknown (offline)", async () => {
    authState = { user: null, loading: false, offline: true };
    const html = await render();
    expect(html).not.toContain("Sign in to verify your access");
  });
});

describe("CheckoutSuccess — signed-in visitor", () => {
  it("runs the lookup and shows confirmation for an owned paid session (no customer email)", async () => {
    authState = { user: { id: 1 }, loading: false, offline: false };
    queryResult = { data: { status: "complete", paymentStatus: "paid", amountTotal: 9900, currency: "usd", planId: "premium" }, isLoading: false, isError: false };
    const html = await render();
    expect(queryArgs[1].enabled).toBe(true);
    expect(html).toContain("PAYMENT CONFIRMED");
    expect(html).not.toContain("Sign in to verify your access");
    expect(html).not.toMatch(/Receipt sent/);
  });

  it("still shows 'Verification Failed' for a signed-in visitor whose lookup returns null (e.g. another account's session)", async () => {
    authState = { user: { id: 2 }, loading: false, offline: false };
    queryResult = { data: null, isLoading: false, isError: false };
    const html = await render();
    expect(html).toContain("Verification Failed");
    expect(html).not.toContain("Sign in to verify your access");
  });
});
