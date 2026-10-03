/**
 * PR #58 r7: AshaLiveBriefing and AshaDailyGreeting show the greeting-limit copy when the greeting
 * cap (or the global cap) is hit, and the temporary-unavailable line for anything else.
 * The components run as plain functions with React's hooks replaced by a tiny recorder, so the real
 * onError / catch wiring inside each component is exercised (no DOM needed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  state: [] as unknown[],
  effects: [] as Array<() => unknown>,
  index: 0,
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  const useState = (initial: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.state)) hooks.state[slot] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    const set = (next: unknown) => {
      hooks.state[slot] = typeof next === "function" ? (next as (prev: unknown) => unknown)(hooks.state[slot]) : next;
    };
    return [hooks.state[slot], set];
  };
  const useEffect = (effect: () => unknown) => { hooks.effects.push(effect); };
  const overrides = {
    useState,
    useEffect,
    useCallback: <T,>(fn: T) => fn,
    useRef: <T,>(value: T) => ({ current: value }),
    useMemo: <T,>(fn: () => T) => fn(),
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

const failure = vi.hoisted(() => ({ error: null as unknown }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    asha: {
      dailyGreeting: {
        useMutation: () => ({
          mutate: (_input: unknown, options: { onError?: (error: unknown) => void }) => options.onError?.(failure.error),
          mutateAsync: () => Promise.reject(failure.error),
          isPending: false,
        }),
      },
    },
    marketState: { canonicalCurrent: { useQuery: () => ({ data: { pressureIndex: 33, regime: "MODERATE RISK", confidenceOrEvidenceQuality: "HEALTHY" } }) } },
  },
}));
vi.mock("@/contexts/EngineContext", async () => {
  const { DEFAULT_INDICATORS } = await import("../client/src/lib/engine");
  const { selectBrowserMarketOutput } = await import("../client/src/lib/marketStateProjection");
  const selected = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
  return { useEngine: () => ({ output: selected.output, isLoading: false, marketMode: selected.mode }) };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Ada Lovelace" }, loading: false }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/app/now", vi.fn()] }));

import React from "react";
import AshaLiveBriefing from "../client/src/components/AshaLiveBriefing";
import AshaDailyGreeting from "../client/src/components/AshaDailyGreeting";
import {
  PLATO_DAILY_LIMIT_MESSAGE,
  PLATO_USER_DAILY_GREETING_LIMIT_MESSAGE,
  PLATO_USER_DAILY_LIMIT_MESSAGE,
} from "../shared/ashaPanelMachine";

// The client build uses the classic JSX runtime under vitest's esbuild transform.
(globalThis as { React?: typeof React }).React = React;

const limitError = (message: string) => ({ message, data: { code: "TOO_MANY_REQUESTS" } });
const UNAVAILABLE = "PLATO is temporarily unavailable, so there is no PLATO greeting right now.";

async function run(component: () => unknown): Promise<string[]> {
  hooks.state = [];
  hooks.effects = [];
  hooks.index = 0;
  component();
  for (const effect of hooks.effects) {
    try { effect(); } catch { /* effects unrelated to the greeting (canvas, timers) */ }
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  return hooks.state.filter((value): value is string => typeof value === "string");
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AshaLiveBriefing greeting failure copy", () => {
  const briefing = () => (AshaLiveBriefing as (props: { onContinue: () => void }) => unknown)({ onContinue: () => {} });

  it("greeting cap: shows the greeting-limit copy, not the question copy and not 'temporarily unavailable'", async () => {
    failure.error = limitError(PLATO_USER_DAILY_GREETING_LIMIT_MESSAGE);
    const strings = await run(briefing);
    expect(strings).toContain(`Welcome back, Ada. ${PLATO_USER_DAILY_GREETING_LIMIT_MESSAGE}`);
    expect(strings.join("\n")).not.toContain("question limit");
    expect(strings.join("\n")).not.toContain(UNAVAILABLE);
  });

  it("global cap: shows the global-limit copy", async () => {
    failure.error = limitError(PLATO_DAILY_LIMIT_MESSAGE);
    expect(await run(briefing)).toContain(`Welcome back, Ada. ${PLATO_DAILY_LIMIT_MESSAGE}`);
  });

  it("any other failure (or the question copy) shows the temporary-unavailable line", async () => {
    for (const error of [{ message: "PLATO is temporarily unavailable. Please try again.", data: { code: "SERVICE_UNAVAILABLE" } }, limitError(PLATO_USER_DAILY_LIMIT_MESSAGE)]) {
      failure.error = error;
      expect(await run(briefing)).toContain(`Welcome back, Ada. ${UNAVAILABLE}`);
    }
  });
});

describe("AshaDailyGreeting greeting failure copy", () => {
  const greeting = () => (AshaDailyGreeting as () => unknown)();

  it("greeting cap: shows the greeting-limit copy", async () => {
    failure.error = limitError(PLATO_USER_DAILY_GREETING_LIMIT_MESSAGE);
    const strings = await run(greeting);
    expect(strings).toContain(PLATO_USER_DAILY_GREETING_LIMIT_MESSAGE);
    expect(strings.join("\n")).not.toContain(UNAVAILABLE);
  });

  it("global cap: shows the global-limit copy", async () => {
    failure.error = limitError(PLATO_DAILY_LIMIT_MESSAGE);
    expect(await run(greeting)).toContain(PLATO_DAILY_LIMIT_MESSAGE);
  });

  it("any other failure shows the temporary-unavailable line", async () => {
    failure.error = { message: "boom", data: { code: "SERVICE_UNAVAILABLE" } };
    const strings = await run(greeting);
    expect(strings.some(value => value.startsWith(UNAVAILABLE))).toBe(true);
  });
});
