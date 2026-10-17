/**
 * Fix-up 5: the Preflight modal crashed on open (React #310) from every
 * PreflightTrigger. Its early returns ran before later hooks, so the hook
 * count changed between closed → open-without-state → open-with-state.
 * 1) static render of the opened modal in healthy and degraded modes;
 * 2) hook-order harness: the same hooks run in the same order on every render.
 */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS, type EngineOutput } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";

(globalThis as any).React = React;

const demoOutput = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }).output;
const healthyOutput: EngineOutput = {
  ...demoOutput,
  overall: { ...demoOutput.overall, score: 6.1, source: "canonical-market-state" } as any,
  regime: { ...demoOutput.regime, label: "ELEVATED RISK" },
};
const env: { output: EngineOutput; marketMode: string; canonical: any } = { output: healthyOutput, marketMode: "canonical", canonical: undefined };
const canonical = (pressureIndex: number | null, regime: string | null) => ({ pressureIndex, regime, stateId: "state:preflight" });

// Hook-order recorder: every hook the modal calls (React and custom) is logged by name.
const hookLog: string[] = [];
const rec = (name: string) => { hookLog.push(name); };
let harness = false; // when true, React hooks are trivial stand-ins (direct function call)
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  const wrap = <K extends "useState" | "useEffect" | "useCallback" | "useMemo" | "useRef">(name: K, fake: (...a: any[]) => any) =>
    (...args: any[]) => { if (harness) { rec(name); return fake(...args); } return (((actual as any).default ?? actual)[name] as any)(...args); };
  const hooks = {
    useState: wrap("useState", (init: unknown) => [typeof init === "function" ? (init as () => unknown)() : init, () => undefined]),
    useEffect: wrap("useEffect", () => undefined),
    useCallback: wrap("useCallback", (fn: unknown) => fn),
    useMemo: wrap("useMemo", (fn: () => unknown) => fn()),
    useRef: wrap("useRef", (v: unknown) => ({ current: v })),
  };
  const base = ((actual as any).default ?? actual) as Record<string, unknown>;
  return { ...base, ...actual, ...hooks, default: { ...base, ...hooks } };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => { if (harness) rec("useAuth"); return { user: { id: 1, name: "QA" }, loading: false }; } }));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => { if (harness) rec("useLocation"); return ["/app/watchlist", () => undefined]; } };
});
vi.mock("@/contexts/EngineContext", () => ({
  useEngine: () => { if (harness) rec("useEngine"); return { output: env.output, marketMode: env.marketMode }; },
}));
vi.mock("@/hooks/useAnalytics", () => ({ trackPreflightLaunch: () => undefined }));
vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): any => new Proxy(() => undefined, {
    get: (_t, key) => {
      const p = path.join(".");
      if (key === "useQuery") return (_input?: unknown, opts?: { enabled?: boolean }) => {
        if (harness) rec(`useQuery:${p}`);
        const enabled = opts?.enabled !== false;
        if (p === "marketState.canonicalCurrent") return { data: enabled ? env.canonical : undefined, isLoading: false };
        if (p === "awareness.getScore") return { data: { score: 40, rating: { color: "#00D4FF", label: "Aware", statusLabel: "Aware" }, completedKeys: [], categoryBreakdown: {} }, isLoading: false, refetch: () => undefined };
        return { data: undefined, isLoading: false, refetch: () => undefined };
      };
      if (key === "useMutation") return () => { if (harness) rec(`useMutation:${p}`); return { mutate: () => undefined, mutateAsync: async () => undefined, isPending: false }; };
      if (key === "useUtils") return () => { if (harness) rec("useUtils"); return make([]); };
      return make([...path, String(key)]);
    },
    apply: () => make(path),
  });
  return { trpc: make([]) };
});

const { MarketPreflightModal } = await import("../client/src/components/MarketPreflight");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const props = (open: boolean) => ({ open, onClose: () => undefined, currentPage: "watchlist", regimeLabel: "ELEVATED RISK" });

beforeEach(() => { harness = false; hookLog.length = 0; });

describe("Preflight modal opens (static render)", () => {
  it("healthy: renders the opened modal", () => {
    env.output = healthyOutput; env.marketMode = "canonical"; env.canonical = canonical(61, "ELEVATED RISK");
    let html = "";
    expect(() => { html = renderToStaticMarkup(createElement(MarketPreflightModal, props(true))); }).not.toThrow();
    expect(html.length).toBeGreaterThan(500);
    expect(text(html)).toMatch(/checklist/i);
  });
  it("degraded (no MarketState, canonical OK): renders the opened modal", () => {
    env.output = demoOutput; env.marketMode = "deterministic-fallback"; env.canonical = canonical(34, "MODERATE RISK");
    let html = "";
    expect(() => { html = renderToStaticMarkup(createElement(MarketPreflightModal, props(true))); }).not.toThrow();
    expect(html.length).toBeGreaterThan(500);
  });
  it("closed, or open without a canonical state, renders nothing (unchanged behaviour)", () => {
    env.canonical = canonical(61, "ELEVATED RISK");
    expect(renderToStaticMarkup(createElement(MarketPreflightModal, props(false)))).toBe("");
    env.canonical = undefined;
    expect(renderToStaticMarkup(createElement(MarketPreflightModal, props(true)))).toBe("");
  });
});

describe("Preflight modal hook order (React #310 regression)", () => {
  const hooksFor = (open: boolean) => {
    harness = true; hookLog.length = 0;
    try { (MarketPreflightModal as (p: ReturnType<typeof props>) => unknown)(props(open)); } finally { harness = false; }
    return [...hookLog];
  };
  for (const mode of ["canonical", "deterministic-fallback"] as const) {
    it(`${mode}: closed → open (state loading) → open (state loaded) call the same hooks in the same order`, () => {
      env.marketMode = mode; env.output = mode === "canonical" ? healthyOutput : demoOutput;
      env.canonical = undefined;
      const closed = hooksFor(false);
      const loading = hooksFor(true);
      env.canonical = canonical(mode === "canonical" ? 61 : 34, "MODERATE RISK");
      const loaded = hooksFor(true);
      const closedAgain = hooksFor(false);
      expect(closed.length).toBeGreaterThan(10);
      expect(closed).toContain("useMemo");
      expect(loading).toEqual(closed);
      expect(loaded).toEqual(closed);
      expect(closedAgain).toEqual(closed);
    });
  }
});
