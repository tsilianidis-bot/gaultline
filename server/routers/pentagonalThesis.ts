import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { composeStockPentagonalThesis } from "../pentagonalThesisCompose";

const symbolInput = z.object({
  symbol: z.string().trim().min(1).max(12),
});

export const pentagonalThesisRouter = router({
  forSymbol: publicProcedure.input(symbolInput).query(async ({ input }) => {
    return composeStockPentagonalThesis(input.symbol);
  }),
});
