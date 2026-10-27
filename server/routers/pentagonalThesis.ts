import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizeThesisSymbol } from "../../shared/pentagonalThesis";
import { publicProcedure, router } from "../_core/trpc";
import { composeStockPentagonalThesis } from "../pentagonalThesisCompose";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, number[]>();

export function resetPentagonalThesisRateLimit(): void {
  hits.clear();
}

export function assertPentagonalThesisRateLimit(key: string, now = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter(stamp => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many thesis requests. Please wait a moment.",
    });
  }
  recent.push(now);
  hits.set(key, recent);
}

const symbolInput = z.object({
  symbol: z.string().trim().max(12).transform((value, ctx) => {
    const normalized = normalizeThesisSymbol(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Symbol must be a stock ticker using letters, digits, dots, or hyphens.",
      });
      return z.NEVER;
    }
    return normalized;
  }),
});

export const pentagonalThesisRouter = router({
  forSymbol: publicProcedure.input(symbolInput).query(async ({ input, ctx }) => {
    assertPentagonalThesisRateLimit(ctx.req.ip || "unknown");
    return composeStockPentagonalThesis(input.symbol);
  }),
});
