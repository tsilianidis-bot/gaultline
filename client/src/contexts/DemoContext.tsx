/**
 * DemoContext — Read-Only Demo Mode
 *
 * Provides a synthetic "demo user" that bypasses Manus OAuth.
 * All components see a valid premium user, but write operations
 * (payments, portfolio saves, ledger logs) are silently disabled.
 *
 * Activated when the URL path starts with /demo.
 */
import React, { createContext, useContext, useMemo } from "react";

export interface DemoUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  accessTier: "free" | "core" | "premium" | "founding";
  dashboardMode: "pulse" | "signals" | "intelligence";
  preflightPromptMode: "full_guidance" | "minimal_reminders" | "off";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastPreflightCompletedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

interface DemoContextValue {
  isDemo: boolean;
  demoUser: DemoUser | null;
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false,
  demoUser: null,
});

export const DEMO_USER: DemoUser = {
  id: 0,
  openId: "demo-user-readonly",
  name: "Demo User",
  email: "demo@getfaultline.live",
  loginMethod: "demo",
  role: "user",
  accessTier: "premium",
  dashboardMode: "intelligence",
  preflightPromptMode: "off",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  lastPreflightCompletedAt: null,
  adminNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<DemoContextValue>(
    () => ({ isDemo: true, demoUser: DEMO_USER }),
    []
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoMode(): DemoContextValue {
  return useContext(DemoContext);
}

const DEMO_SESSION_KEY = "faultline_demo_session";

/**
 * Returns true if the current URL path starts with /demo,
 * OR if the user entered via /demo this session (persisted in sessionStorage).
 * Safe to call outside React (e.g., in route guards).
 */
export function isDemoPath(): boolean {
  if (typeof window === "undefined") return false;
  // Direct /demo path — activate and persist
  if (window.location.pathname.startsWith("/demo")) {
    try { sessionStorage.setItem(DEMO_SESSION_KEY, "1"); } catch {}
    return true;
  }
  // Already entered via /demo this session (survives redirect to /app/*)
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Clear demo session (e.g., when user logs in properly) */
export function clearDemoSession(): void {
  try { sessionStorage.removeItem(DEMO_SESSION_KEY); } catch {}
}
