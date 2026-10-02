import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { isAuthNetworkError } from "../client/src/_core/hooks/useAuth";

const read = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8");
const useAuthSource = read("client/src/_core/hooks/useAuth.ts");
const mobileLayoutSource = read("client/src/components/MobileLayout.tsx");

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
    expect(query).toMatch(/retry: false/);
    expect(query).toMatch(/retryOnMount: false/);
    expect(useAuthSource).toMatch(/addEventListener\("online", onOnline\)/);
    expect(useAuthSource).toMatch(/offline: meQuery\.data === undefined && isAuthNetworkError\(meQuery\.error\)/);
  });

  it("classifies only no-server-answer failures as offline", () => {
    expect(isAuthNetworkError(null)).toBe(false);
    expect(isAuthNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isAuthNetworkError(TRPCClientError.from(new TypeError("Failed to fetch")))).toBe(true);
    const serverError = TRPCClientError.from({
      error: { message: "HTTP 503", code: -32000, data: { code: "HTTP_ERROR", httpStatus: 503 } },
    } as never);
    expect(isAuthNetworkError(serverError)).toBe(false);
  });

  it("MobileLayout shows a stable offline state instead of flipping the sign-in gate", () => {
    expect(mobileLayoutSource).toMatch(/const \{ user, loading, offline, refresh \} = useAuth\(\);/);
    expect(mobileLayoutSource).toMatch(/offline && !isAccountTab \? \(\s*<OfflineGate/);
    expect(mobileLayoutSource).toContain('role="status"');
    // Access rule unchanged
    expect(mobileLayoutSource).toContain('const hasAccess = !!user && (tier === "core" || tier === "premium" || tier === "founding");');
  });
});
