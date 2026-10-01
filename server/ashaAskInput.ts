import { z } from "zod";
import {
  ASHA_GATEWAY_HISTORY_LIMIT,
  ASHA_HISTORY_CONTENT_MAX_CHARS,
  ASHA_USER_MESSAGE_MAX_CHARS,
} from "@shared/ashaLimits";

export const ashaAskInputSchema = z.object({
  userMessage: z.string().min(1).max(ASHA_USER_MESSAGE_MAX_CHARS),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(ASHA_HISTORY_CONTENT_MAX_CHARS),
  })).max(ASHA_GATEWAY_HISTORY_LIMIT).default([]),
  pageContext: z.object({
    page: z.string(),
    pressureScore: z.number().optional(),
    regime: z.string().optional(),
    regimeConfidence: z.number().optional(),
    narrative: z.string().optional(),
    trend: z.string().optional(),
    keyDrivers: z.array(z.string()).optional(),
    historicalAnalog: z.string().optional(),
    transitionProbability: z.number().optional(),
    additionalContext: z.record(z.string(), z.unknown()).optional(),
  }),
});
