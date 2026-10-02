import { getLoginUrl } from "@/const";
import { DEMO_USER, isDemoPath } from "@/contexts/DemoContext";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

/** True when auth.me never got a server answer (fetch rejected, e.g. offline), as opposed to a server error. */
export function isAuthNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TRPCClientError) return !error.data && !error.shape;
  return error instanceof TypeError;
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // Demo mode bypass — skip OAuth entirely
  const isDemo = isDemoPath();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // A failed auth.me must not refetch each time another useAuth() consumer mounts.
    // Offline, that made gate <-> page remounts refetch auth.me hundreds of times per second.
    retryOnMount: false,
    // Skip the network call entirely in demo mode
    enabled: !isDemo,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    if (isDemo) return; // no-op in demo mode
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [isDemo, logoutMutation, utils]);

  // With retryOnMount off, recover from a network failure when the browser reports it is back online.
  const meFailed = meQuery.isError;
  const refetchMe = meQuery.refetch;
  useEffect(() => {
    if (isDemo || !meFailed || typeof window === "undefined") return;
    const onOnline = () => {
      void refetchMe();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [isDemo, meFailed, refetchMe]);

  const state = useMemo(() => {
    // In demo mode, return the synthetic demo user immediately
    if (isDemo) {
      return {
        user: DEMO_USER as unknown as typeof meQuery.data,
        loading: false,
        error: null,
        isAuthenticated: true,
        offline: false,
      };
    }

    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      // No user data and no server answer: identity is unknown (offline), not signed out.
      offline: meQuery.data === undefined && isAuthNetworkError(meQuery.error),
    };
  }, [
    isDemo,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (isDemo) return; // never redirect in demo mode
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (!redirectPath) return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    isDemo,
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => (isDemo ? undefined : meQuery.refetch()),
    logout,
  };
}
