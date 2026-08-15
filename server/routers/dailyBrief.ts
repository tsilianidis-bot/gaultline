/**
 * FAULTLINE V3.0 — Institutional Daily Brief Router
 *
 * Procedures:
 *  - preferences.get        — fetch user preferences (or null if not set)
 *  - preferences.save       — upsert user preferences (called at onboarding end)
 *  - preferences.complete   — mark onboarding as complete
 *  - brief.generate         — generate today's institutional daily brief via LLM + FMOS
 *  - brief.getChanges       — compute "Since Your Last Visit" diff
 *  - brief.recordVisit      — update lastVisitAt + lastVisitSnapshot
 */

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dailyBriefSnapshots, userPreferences } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const NotificationPrefsSchema = z.object({
  regime:             z.boolean().default(true),
  watchlist:          z.boolean().default(true),
  riskAlerts:         z.boolean().default(true),
  opportunityAlerts:  z.boolean().default(true),
  macroEvents:        z.boolean().default(true),
  dailyBrief:         z.boolean().default(true),
});

const PreferencesInputSchema = z.object({
  investorType:      z.string().optional(),
  riskProfile:       z.string().optional(),
  interests:         z.array(z.string()).optional(),
  watchlistTickers:  z.array(z.string()).optional(),
  notificationPrefs: NotificationPrefsSchema.optional(),
  onboardingComplete: z.boolean().optional(),
});

// ── Engine snapshot shape (subset of EngineOutput for diff) ──────────────────
const EngineSnapshotSchema = z.object({
  overallPressure:  z.number(),
  regime:           z.string(),
  liquidity:        z.number(),
  credit:           z.number(),
  breadth:          z.number(),
  aiConcentration:  z.number(),
  volatility:       z.number(),
  bullProbability:  z.number(),
  vix:              z.number().nullable().optional(),
  dxy:              z.number().nullable().optional(),
  treasury10y:      z.number().nullable().optional(),
  timestamp:        z.number(),
});

type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;

// ── Opportunity card shape ────────────────────────────────────────────────────
const OpportunityInputSchema = z.object({
  ticker:          z.string(),
  opportunityScore: z.number(),
  confidence:      z.number(),
  risk:            z.string(),
  timeHorizon:     z.string(),
  suggestedAction: z.string(),
  primaryDriver:   z.string(),
});

// ── Daily brief generation input ─────────────────────────────────────────────
const BriefInputSchema = z.object({
  engineSnapshot: EngineSnapshotSchema,
  investorType:   z.string().optional(),
  riskProfile:    z.string().optional(),
  interests:      z.array(z.string()).optional(),
  watchlistTickers: z.array(z.string()).optional(),
  topOpportunities: z.array(OpportunityInputSchema).optional(),
});

// ── Helper: derive institutional bias from pressure + regime ─────────────────
function deriveInstitutionalBias(pressure: number, regime: string): string {
  const r = regime.toLowerCase();
  if (pressure < 25) {
    if (r.includes("expansion") || r.includes("bull")) return "Strongly Bullish";
    return "Moderately Bullish";
  }
  if (pressure < 45) {
    if (r.includes("expansion")) return "Moderately Bullish";
    return "Neutral to Cautious";
  }
  if (pressure < 65) return "Cautious";
  if (pressure < 80) return "Defensive";
  return "Risk-Off";
}

// ── Helper: derive market health label ───────────────────────────────────────
function deriveMarketHealth(pressure: number, breadth: number, liquidity: number): string {
  const composite = (100 - pressure) * 0.4 + breadth * 0.3 + liquidity * 0.3;
  if (composite >= 75) return "HEALTHY";
  if (composite >= 55) return "MODERATE";
  if (composite >= 35) return "STRESSED";
  return "CRITICAL";
}

// ── Helper: compute "since last visit" changes ───────────────────────────────
function computeChanges(
  current: EngineSnapshot,
  previous: EngineSnapshot,
): Array<{ label: string; direction: "up" | "down" | "neutral"; delta: string; significance: "high" | "medium" | "low" }> {
  const changes: Array<{ label: string; direction: "up" | "down" | "neutral"; delta: string; significance: "high" | "medium" | "low" }> = [];

  // Regime change — always significant
  if (current.regime !== previous.regime) {
    changes.push({
      label: `Regime changed: ${previous.regime} → ${current.regime}`,
      direction: "neutral",
      delta: "",
      significance: "high",
    });
  }

  // Pressure Index
  const pressureDelta = current.overallPressure - previous.overallPressure;
  if (Math.abs(pressureDelta) >= 3) {
    changes.push({
      label: `Pressure Index ${pressureDelta > 0 ? "increased" : "decreased"}`,
      direction: pressureDelta > 0 ? "up" : "down",
      delta: `${pressureDelta > 0 ? "+" : ""}${pressureDelta.toFixed(0)}`,
      significance: Math.abs(pressureDelta) >= 8 ? "high" : "medium",
    });
  }

  // Liquidity
  const liquidityDelta = current.liquidity - previous.liquidity;
  if (Math.abs(liquidityDelta) >= 5) {
    changes.push({
      label: `Liquidity ${liquidityDelta > 0 ? "improved" : "contracted"}`,
      direction: liquidityDelta > 0 ? "up" : "down",
      delta: `${liquidityDelta > 0 ? "+" : ""}${liquidityDelta.toFixed(0)}`,
      significance: Math.abs(liquidityDelta) >= 10 ? "high" : "medium",
    });
  }

  // Credit stress
  const creditDelta = current.credit - previous.credit;
  if (Math.abs(creditDelta) >= 5) {
    changes.push({
      label: `Credit stress ${creditDelta > 0 ? "increased" : "decreased"}`,
      direction: creditDelta > 0 ? "up" : "down",
      delta: `${creditDelta > 0 ? "+" : ""}${creditDelta.toFixed(0)}`,
      significance: Math.abs(creditDelta) >= 10 ? "high" : "medium",
    });
  }

  // Market breadth
  const breadthDelta = current.breadth - previous.breadth;
  if (Math.abs(breadthDelta) >= 5) {
    changes.push({
      label: `Market breadth ${breadthDelta > 0 ? "strengthened" : "weakened"}`,
      direction: breadthDelta > 0 ? "up" : "down",
      delta: `${breadthDelta > 0 ? "+" : ""}${breadthDelta.toFixed(0)}`,
      significance: Math.abs(breadthDelta) >= 10 ? "high" : "medium",
    });
  }

  // Bull probability
  const bullDelta = current.bullProbability - previous.bullProbability;
  if (Math.abs(bullDelta) >= 4) {
    changes.push({
      label: `Bull probability ${bullDelta > 0 ? "increased" : "decreased"}`,
      direction: bullDelta > 0 ? "up" : "down",
      delta: `${bullDelta > 0 ? "+" : ""}${bullDelta.toFixed(0)}%`,
      significance: Math.abs(bullDelta) >= 8 ? "high" : "medium",
    });
  }

  // Sort by significance
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return changes.sort((a, b) => order[a.significance] - order[b.significance]).slice(0, 6);
}

// ── Router ───────────────────────────────────────────────────────────────────

export const dailyBriefRouter = router({

  // ── Admin: snapshot audit trail ───────────────────────────────────────────
  getSnapshotAudit: adminProcedure
    .input(z.object({ snapshotId: z.string().optional(), limit: z.number().min(1).max(30).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(dailyBriefSnapshots)
        .where(input.snapshotId ? eq(dailyBriefSnapshots.snapshotId, input.snapshotId) : undefined)
        .orderBy(desc(dailyBriefSnapshots.createdAt))
        .limit(input.limit);
      return rows.map(row => ({
        snapshotId: row.snapshotId,
        briefDateEt: row.briefDateEt,
        tradingDate: row.tradingDate,
        generatedAt: row.generatedAt,
        status: row.status,
        articleId: row.articleId,
        promptVersion: row.promptVersion,
        modelVersion: row.modelVersion,
        snapshot: JSON.parse(row.snapshotJson),
        inputFreshness: JSON.parse(row.inputFreshnessJson),
        validation: JSON.parse(row.validationJson),
        warnings: row.warningsJson ? JSON.parse(row.warningsJson) : [],
      }));
    }),

  // ── Preferences: get ──────────────────────────────────────────────────────
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      onboardingComplete: row.onboardingComplete,
      investorType:       row.investorType,
      riskProfile:        row.riskProfile,
      interests:          row.interests ? (JSON.parse(row.interests) as string[]) : [],
      watchlistTickers:   row.watchlistTickers ? (JSON.parse(row.watchlistTickers) as string[]) : [],
      notificationPrefs:  row.notificationPrefs ? JSON.parse(row.notificationPrefs) : null,
      hasSeenGettingStartedVideo: row.hasSeenGettingStartedVideo,
      lastVisitAt:        row.lastVisitAt?.getTime() ?? null,
    };
  }),

  // ── Mark Getting Started video as seen ───────────────────────────────────────────
  markVideoSeen: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
    if (existing.length) {
      await db.update(userPreferences).set({ hasSeenGettingStartedVideo: true }).where(eq(userPreferences.userId, ctx.user.id));
    } else {
      await db.insert(userPreferences).values({ userId: ctx.user.id, onboardingComplete: false, hasSeenGettingStartedVideo: true });
    }
    return { success: true };
  }),

  // ── Preferences: save ─────────────────────────────────────────────────────
  savePreferences: protectedProcedure
    .input(PreferencesInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);

      const data = {
        userId:            ctx.user.id,
        investorType:      input.investorType,
        riskProfile:       input.riskProfile,
        interests:         input.interests ? JSON.stringify(input.interests) : undefined,
        watchlistTickers:  input.watchlistTickers ? JSON.stringify(input.watchlistTickers) : undefined,
        notificationPrefs: input.notificationPrefs ? JSON.stringify(input.notificationPrefs) : undefined,
        onboardingComplete: input.onboardingComplete,
      };

      if (existing.length) {
        await db.update(userPreferences).set(data).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ ...data, onboardingComplete: input.onboardingComplete ?? false });
      }
      return { success: true };
    }),

  // ── Record visit (update lastVisitAt + snapshot) ──────────────────────────
  recordVisit: protectedProcedure
    .input(z.object({ snapshot: EngineSnapshotSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);

      const data = {
        lastVisitAt:       new Date(),
        lastVisitSnapshot: JSON.stringify(input.snapshot),
      };

      if (existing.length) {
        await db.update(userPreferences).set(data).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ userId: ctx.user.id, onboardingComplete: false, ...data });
      }
      return { success: true };
    }),

  // ── Get "Since Last Visit" changes ────────────────────────────────────────
  getChanges: protectedProcedure
    .input(z.object({ currentSnapshot: EngineSnapshotSchema }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { changes: [], hasChanges: false };

      const rows = await db.select({ lastVisitSnapshot: userPreferences.lastVisitSnapshot, lastVisitAt: userPreferences.lastVisitAt })
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (!rows.length || !rows[0].lastVisitSnapshot) {
        return { changes: [], hasChanges: false, lastVisitAt: null };
      }

      const previous = JSON.parse(rows[0].lastVisitSnapshot) as EngineSnapshot;
      const changes = computeChanges(input.currentSnapshot, previous);

      return {
        changes,
        hasChanges: changes.length > 0,
        lastVisitAt: rows[0].lastVisitAt?.getTime() ?? null,
      };
    }),

  // ── Generate Institutional Daily Brief ───────────────────────────────────
  generateBrief: protectedProcedure
    .input(BriefInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { engineSnapshot, investorType, riskProfile, interests, watchlistTickers, topOpportunities } = input;

      const institutionalBias = deriveInstitutionalBias(engineSnapshot.overallPressure, engineSnapshot.regime);
      const marketHealth = deriveMarketHealth(engineSnapshot.overallPressure, engineSnapshot.breadth, engineSnapshot.liquidity);
      const overallConfidence = Math.round(
        (100 - engineSnapshot.overallPressure) * 0.35 +
        engineSnapshot.breadth * 0.25 +
        engineSnapshot.liquidity * 0.25 +
        engineSnapshot.bullProbability * 0.15
      );

      // Build top risks from engine data
      const topRisks: string[] = [];
      if (engineSnapshot.credit > 60) topRisks.push("Credit market deterioration");
      if (engineSnapshot.breadth < 40) topRisks.push("Weak market breadth — narrow participation");
      if (engineSnapshot.liquidity < 40) topRisks.push("Liquidity contraction");
      if (engineSnapshot.aiConcentration > 65) topRisks.push("Overextended AI sector concentration");
      if (engineSnapshot.volatility > 60) topRisks.push("Elevated volatility regime");
      if (engineSnapshot.overallPressure > 55) topRisks.push("Macro uncertainty — elevated pressure index");
      if ((engineSnapshot.vix ?? 0) > 25) topRisks.push("VIX elevated — options market pricing risk");
      if ((engineSnapshot.treasury10y ?? 0) > 4.5) topRisks.push("High long-term yields constraining valuations");
      // No calendar adapter is passed into this procedure. Returning an explicit
      // unavailable state is safer than showing a plausible-looking static calendar.
      const todaysEvents: Array<{ event: string; category: string; importance: string; whyItMatters: string }> = [];

      // LLM: generate CIO-style institutional insight (3 sentences max)
      let institutionalInsight = "";
      try {
        const llmResp = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You write a concise, institutional Daily Brief opening from supplied FAULTLINE inputs only.
Write exactly 3 sentences in measured language. Do not invent price action, market direction, policy changes, or missing data. Label model-derived statements as FAULTLINE outputs. Do not infer external conditions from a proprietary score. Format: plain text, no markdown, no bullet points.`,
            },
            {
              role: "user",
              content: `Market data:
- Regime: ${engineSnapshot.regime}
- Pressure Index: ${engineSnapshot.overallPressure}/100
- Institutional Bias: ${institutionalBias}
- Liquidity: ${engineSnapshot.liquidity}/100
- Credit Stress: ${engineSnapshot.credit}/100
- Market Breadth: ${engineSnapshot.breadth}/100
- Bull Probability: ${engineSnapshot.bullProbability}%
- VIX: ${engineSnapshot.vix ?? "N/A"}
- 10Y Treasury: ${engineSnapshot.treasury10y ?? "N/A"}%
- Investor Type: ${investorType ?? "general"}
- Risk Profile: ${riskProfile ?? "balanced"}
- Interests: ${interests?.join(", ") ?? "general markets"}

Write the 3-sentence CIO institutional insight for today's brief.`,
            },
          ],
        });
        institutionalInsight = (llmResp.choices?.[0]?.message?.content as string) ?? "";
      } catch {
        institutionalInsight = `FAULTLINE currently identifies ${engineSnapshot.regime} conditions with a Pressure Index of ${engineSnapshot.overallPressure}. The model-derived institutional bias is ${institutionalBias}, based on the supplied breadth and liquidity inputs. Monitor subsequent confirmed data for changes in the current assessment.`;
      }

      // A symbol-specific data packet is not supplied to this procedure, so do
      // not manufacture confidence changes or directional watchlist calls.
      const watchlistIntelligence = (watchlistTickers ?? []).slice(0, 8).map((ticker) => {
        return {
          ticker,
          signal: "Current symbol-specific data was not included in this intelligence snapshot.",
          direction: "neutral" as const,
        };
      });

      return {
        // Section 1: Today's Market
        todaysMarket: {
          regime:             engineSnapshot.regime,
          pressureIndex:      engineSnapshot.overallPressure,
          marketHealth,
          institutionalBias,
          confidence:         Math.min(99, Math.max(50, overallConfidence)),
          marketStatus:       engineSnapshot.overallPressure < 30 ? "RISK-ON" : engineSnapshot.overallPressure < 55 ? "NEUTRAL" : "RISK-OFF",
        },
        // Section 3: Top Opportunities
        topOpportunities: (topOpportunities ?? []).slice(0, 5),
        // Section 4: Top Risks
        topRisks: topRisks.slice(0, 5),
        // Section 5: Watchlist Intelligence
        watchlistIntelligence,
        // Section 6: Today's Events
        todaysEvents,
        eventsAvailability: "Current economic-calendar data was not included in this intelligence snapshot.",
        // Section 8: Institutional Insight (LLM-generated)
        institutionalInsight,
        // Section 11: Engine Status
        engineStatus: {
          fmosVersion:        "FMOS v3.0",
          engineHealth:       null,
          dataFreshness:      "Source-specific freshness was not included in this procedure input.",
          liveDataSources:    null,
          averageLatency:     null,
          lastUpdated:        new Date().toISOString(),
        },
        generatedAt: Date.now(),
      };
    }),

  // ── Startup page preference ────────────────────────────────────────────────
  getStartupPage: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { startupPage: 'now' };
    const rows = await db.select({ startupPage: userPreferences.startupPage }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
    return { startupPage: rows[0]?.startupPage ?? 'now' };
  }),

  setStartupPage: protectedProcedure
    .input(z.object({ startupPage: z.enum(['now', 'why', 'outlook', 'watch', 'act', 'last']) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
      if (existing.length) {
        await db.update(userPreferences).set({ startupPage: input.startupPage }).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ userId: ctx.user.id, onboardingComplete: false, startupPage: input.startupPage });
      }
      return { success: true };
    }),

  // ── Reset onboarding (restart First Briefing) ─────────────────────────────
  resetOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
      if (existing.length) {
        await db.update(userPreferences).set({ onboardingComplete: false }).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ userId: ctx.user.id, onboardingComplete: false });
      }
      return { success: true };
    }),
  // ── Experience mode preference ─────────────────────────────────────────────
  getExperience: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { experienceMode: 'guided' as const };
    const rows = await db.select({ experienceMode: userPreferences.experienceMode }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
    return { experienceMode: (rows[0]?.experienceMode ?? 'guided') as 'guided' | 'tools' };
  }),
  setExperience: protectedProcedure
    .input(z.object({ experienceMode: z.enum(['guided', 'tools']) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, ctx.user.id)).limit(1);
      if (existing.length) {
        await db.update(userPreferences).set({ experienceMode: input.experienceMode }).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({ userId: ctx.user.id, onboardingComplete: false, experienceMode: input.experienceMode });
      }
      return { success: true };
    }),
});
