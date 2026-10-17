import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { isAuthNetworkError, isAuthServerError, shouldRetryAuthMe } from "../client/src/_core/hooks/useAuth";

const read = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8");
const useAuthSource = read("client/src/_core/hooks/useAuth.ts");
const mobileLayoutSource = read("client/src/components/MobileLayout.tsx");
const gateSource = read("client/src/components/CinematicAuthGate.tsx");

const networkError = () => TRPCClientError.from(new TypeError("Failed to fetch"));
const httpError = (httpStatus: number) =>
  TRPCClientError.from({
    error: { message: `HTTP ${httpStatus}`, code: -32000, data: { code: "HTTP_ERROR", httpStatus } },
  } as never);

afterEach(() => vi.unstubAllGlobals());

describe("offline auth.me: no refetch storm", () => {
  // Mirrors the gate loop: an errored query with no data gets a new observer on each remount.
  const mountObservers = async (retryOnMount: boolean | undefined) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const opts = {
      queryKey: ["auth", "me"],
      queryFn: async () => { calls++; throw new TypeError("Failed to fetch"); },
      retry: false,
      ...(retryOnMount === undefined ? {} : { retryOnMount }),
    };
    const first = new QueryObserver(client, opts);
    const unsub = first.subscribe(() => {});
    await new Promise(r => setTimeout(r, 10));
    for (let i = 0; i < 20; i++) {
      const o = new QueryObserver(client, opts);
      const u = o.subscribe(() => {});
      await new Promise(r => setTimeout(r, 1));
      u();
    }
    unsub();
    client.clear();
    return calls;
  };

  it("default retryOnMount refetches on every remount (the storm), retryOnMount:false does not", async () => {
    expect(await mountObservers(undefined)).toBeGreaterThan(10);
    expect(await mountObservers(false)).toBe(1);
  });

  it("useAuth's auth.me query sets retryOnMount:false and refetches on the online event", () => {
    const query = useAuthSource.slice(useAuthSource.indexOf("trpc.auth.me.useQuery"), useAuthSource.indexOf("const logoutMutation"));
    expect(query).toMatch(/retry: shouldRetryAuthMe,/);
    expect(query).toMatch(/retryOnMount: false/);
    expect(useAuthSource).toMatch(/addEventListener\("online", onOnline\)/);
    expect(useAuthSource).toMatch(/offline: meQuery\.data === undefined && isAuthNetworkError\(meQuery\.error\)/);
  });

  it("classifies only a real network failure (or navigator.onLine === false) as offline", () => {
    expect(isAuthNetworkError(null)).toBe(false);
    expect(isAuthNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isAuthNetworkError(networkError())).toBe(true);
    expect(isAuthNetworkError(httpError(503))).toBe(false);
    // 200 with a non-JSON body: response.json() throws SyntaxError -> a server answer, not offline
    expect(isAuthNetworkError(TRPCClientError.from(new SyntaxError("Unexpected token < in JSON")))).toBe(false);
    // non-tRPC JSON body (e.g. {error:"..."}) fails result transformation -> not offline
    class TransformResultError extends Error {}
    expect(isAuthNetworkError(TRPCClientError.from(new TransformResultError("Unable to transform response from server")))).toBe(false);
    vi.stubGlobal("navigator", { onLine: false });
    expect(isAuthNetworkError(TRPCClientError.from(new SyntaxError("x")))).toBe(true);
    expect(isAuthNetworkError(null)).toBe(false);
  });

  it("retries auth.me once for a 5xx only; never 401/4xx or network failures", () => {
    expect(isAuthServerError(httpError(500))).toBe(true);
    expect(isAuthServerError(httpError(503))).toBe(true);
    expect(isAuthServerError(httpError(401))).toBe(false);
    expect(isAuthServerError(httpError(429))).toBe(false);
    expect(isAuthServerError(networkError())).toBe(false);
    expect(shouldRetryAuthMe(0, httpError(502))).toBe(true);
    expect(shouldRetryAuthMe(1, httpError(502))).toBe(false);
    expect(shouldRetryAuthMe(0, httpError(401))).toBe(false);
    expect(shouldRetryAuthMe(0, networkError())).toBe(false);
  });

  // The real auth.me options (bounded server retry + retryOnMount:false) under 20 remounts.
  const runAuthMe = async (failures: Array<() => unknown>) => {
    // App defaults from main.tsx (staleTime 2 min) so a healthy cached user is not refetched per mount.
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 2 * 60 * 1000 } } });
    let calls = 0;
    const opts = {
      queryKey: ["auth", "me", "sim"],
      queryFn: async () => {
        const f = failures[calls++];
        if (f) throw f();
        return { id: 1 };
      },
      retry: shouldRetryAuthMe,
      retryDelay: 5,
      retryOnMount: false,
    };
    const first = new QueryObserver(client, opts);
    const unsub = first.subscribe(() => {});
    await new Promise(r => setTimeout(r, 50));
    for (let i = 0; i < 20; i++) {
      const o = new QueryObserver(client, opts);
      const u = o.subscribe(() => {});
      await new Promise(r => setTimeout(r, 1));
      u();
    }
    const state = client.getQueryState(["auth", "me", "sim"]);
    unsub();
    client.clear();
    return { calls, status: state?.status };
  };

  it("offline: 1 request; brief 5xx heals with 1 retry; persistent 5xx stops at 2; 401 is not retried", async () => {
    const always = (e: () => unknown) => Array.from({ length: 100 }, () => e);
    expect(await runAuthMe(always(networkError))).toEqual({ calls: 1, status: "error" });
    expect(await runAuthMe([() => httpError(503)])).toEqual({ calls: 2, status: "success" });
    expect(await runAuthMe(always(() => httpError(500)))).toEqual({ calls: 2, status: "error" });
    expect(await runAuthMe(always(() => httpError(401)))).toEqual({ calls: 1, status: "error" });
  });

  it("CinematicAuthGate shows an honest offline state (RETRY) instead of 'Sign in to continue'", () => {
    expect(gateSource).toMatch(/const \{ user, loading, offline, refresh \} = useAuth\(\);/);
    expect(gateSource).toMatch(/\{offline \? \(\s*<>\s*You're offline\./);
    expect(gateSource).toMatch(/onClick=\{offline \? \(\) => \{ void refresh\(\); \} : handleSignIn\}/);
    expect(gateSource).toContain('{offline ? "RETRY" : signingIn ? "REDIRECTING…"');
  });

  it("MobileLayout shows a stable offline state instead of flipping the sign-in gate", () => {
    expect(mobileLayoutSource).toMatch(/const \{ user, loading, offline, refresh \} = useAuth\(\);/);
    expect(mobileLayoutSource).toMatch(/offline && !isAccountTab \? \(\s*<OfflineGate/);
    expect(mobileLayoutSource).toContain('role="status"');
    // Access rule unchanged
    expect(mobileLayoutSource).toContain('const hasAccess = !!user && (tier === "core" || tier === "premium" || tier === "founding");');
  });
});
