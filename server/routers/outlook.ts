// ============================================================
// FAULTLINE — Signal Outlook Center™ tRPC Router
// server/routers/outlook.ts
// ============================================================
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getFullOutlook,
  getQuickOutlook,
  getTopOpportunities,
  getOpportunityDiscovery,
  clearOutlookCaches,
  type OutlookTimeframe,
  type FullOutlookResult,
  type OutlookHistoryPoint,
} from "../signalOutlook";
import { toOperationalPressure, requireFiniteSignalPayload } from "../operationalSignalInputs";
import { buildCanonicalEvidencePacket } from "../evidencePacket";
import { runFMOSPipelineFast } from "../fmos/pipeline";
import { invokeLLM } from "../_core/llm";
import { getQuote } from "../yahooProxy";
import { getRisingStarVisualDetail } from "../risingStarsVisual";
import { forecastHorizonPromptContract, insufficientHorizonMetadata } from "../../shared/forecastMetadata";
import { evidenceNarrativePromptContract } from "../../shared/evidenceContract";
import { recordForecastObservation } from "../forecastHorizon";
import { getAuthoritativeCanonicalIntelligenceState, toClientCanonicalIntelligenceState } from "../canonicalIntelligenceState";

const timeframeSchema = z.enum(["day", "short", "swing", "long"]).default("swing");
const assetTypeSchema = z.enum(["stock", "crypto"]);

/** Invalid numeric claims are withheld as a failed payload, never rewritten as 0. */
function sanitizeNumbers<T>(value: T): T { requireFiniteSignalPayload(value); return value; }

/**
 * QA r13 B12: no outlook "confidence" leaves the server. Each one is a formula
 * or a default, not a calibrated value:
 * - outlook / quick / top-opportunity / history `confidence` is
 *   |composite − 50| × 2 (distance of a heuristic score from neutral);
 * - `diagnosticIntegration.confidence` was an LLM self-rating with a `?? 60`
 *   default or a hard-coded 55;
 * - `tradeFramework.parameterConfidence` is score − pressure/timeframe penalties.
 * Scores, directions and risk levels are unchanged. The client shows
 * "Not established" / "—".
 */
export function withoutOutlookConfidence<T extends object>(o: T): Omit<T, "confidence"> & { confidence: null } {
  return { ...o, confidence: null };
}

type WithheldPoint = Omit<OutlookHistoryPoint, "confidence"> & { confidence: null };
export type WithheldFullOutlook = Omit<FullOutlookResult, "confidence" | "diagnosticIntegration" | "tradeFramework" | "history"> & {
  confidence: null;
  diagnosticIntegration: Omit<FullOutlookResult["diagnosticIntegration"], "confidence"> & { confidence: null };
  tradeFramework: Omit<FullOutlookResult["tradeFramework"], "parameterConfidence"> & { parameterConfidence: null };
  history: (Omit<NonNullable<FullOutlookResult["history"]>, "current" | "h24" | "d7" | "d30"> & {
    current: WithheldPoint; h24: WithheldPoint | null; d7: WithheldPoint | null; d30: WithheldPoint | null;
  }) | null;
};

export function withoutFullOutlookConfidence(r: FullOutlookResult): WithheldFullOutlook {
  const point = (h: OutlookHistoryPoint | null): WithheldPoint | null => (h ? withoutOutlookConfidence(h) : null);
  return {
    ...r,
    confidence: null,
    // Guarded at runtime as well (older cached payloads may lack a section).
    diagnosticIntegration: (r.diagnosticIntegration ? { ...r.diagnosticIntegration, confidence: null } : r.diagnosticIntegration) as WithheldFullOutlook["diagnosticIntegration"],
    tradeFramework: (r.tradeFramework ? { ...r.tradeFramework, parameterConfidence: null } : r.tradeFramework) as WithheldFullOutlook["tradeFramework"],
    history: r.history
      ? { ...r.history, current: withoutOutlookConfidence(r.history.current), h24: point(r.history.h24), d7: point(r.history.d7), d30: point(r.history.d30) }
      : null,
  };
}

function recordHorizonObservation(sourceType: string, sourceKey: string, metadata: ReturnType<typeof insufficientHorizonMetadata>) {
  void recordForecastObservation({
    sourceType,
    sourceKey,
    sourceModel: "FAULTLINE_OUTLOOK",
    modelVersion: "FORECAST_HORIZON_STANDARD_V1",
    metadata,
    sourceVersions: { horizonStandard: "FORECAST_HORIZON_STANDARD_V1", evidenceClass: metadata.evidenceClass },
  }).catch((err) => console.warn("[Forecast Horizon] Observation capture unavailable:", err));
}

export const outlookRouter = router({
  /**
   * Full outlook for a single symbol.
   * Includes all 8 scoring factors, AI interpretation, invalidation scenarios,
   * FAULTLINE environment context, and integration with Diagnostic AI / Preflight.
   */
  getOutlook: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
      timeframe: timeframeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
        const result = await getFullOutlook(input.symbol, input.assetType, input.timeframe as OutlookTimeframe, canonicalState);
        if (!canonicalState || result.canonicalStateId !== canonicalState.stateId) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Outlook canonical state unavailable or mismatched." });
        const forecastMetadata = insufficientHorizonMetadata(`outlook:${input.symbol}`, new Date().toISOString());
        return {
          ...withoutFullOutlookConfidence(sanitizeNumbers(result) as typeof result),
          analysisTimeframe: input.timeframe,
          forecastMetadata,
          canonicalState: canonicalState ? toClientCanonicalIntelligenceState(canonicalState) : null,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[outlook.getOutlook] Error for", input.symbol, err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Unable to generate outlook for ${input.symbol}. Live market data may be temporarily unavailable.`,
        });
      }
    }),

  /**
   * Quick outlook for a single symbol (watchlist chips, inline badges).
   * Returns score, direction, confidence, risk level only — no AI interpretation.
   * Cached for 10 minutes.
   */
  getQuickOutlook: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
        const result = await getQuickOutlook(input.symbol, input.assetType, canonicalState);
        if (!canonicalState || result.canonicalStateId !== canonicalState.stateId) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Quick Outlook canonical state unavailable or mismatched." });
        const forecastMetadata = insufficientHorizonMetadata(`quick-outlook:${input.symbol}`, new Date().toISOString());
        return {
          ...withoutOutlookConfidence(sanitizeNumbers(result) as typeof result),
          forecastMetadata,
          canonicalState: canonicalState ? toClientCanonicalIntelligenceState(canonicalState) : null,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[outlook.getQuickOutlook] Error for", input.symbol, err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Quick outlook unavailable for ${input.symbol}.`,
        });
      }
    }),

  /**
   * Top 5 stock + top 5 crypto opportunities ranked by composite outlook score.
   * Used on the Signal Outlook Center landing screen.
   * Cached for 8 minutes.
   */
  getTopOpportunities: publicProcedure
    .query(async () => {
      try {
        const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
        const result = sanitizeNumbers(await getTopOpportunities(canonicalState)) as Awaited<ReturnType<typeof getTopOpportunities>>;
        return { ...result, stocks: result.stocks.map(withoutOutlookConfidence), crypto: result.crypto.map(withoutOutlookConfidence) };
      } catch (err) {
        console.error("[outlook.getTopOpportunities] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Top opportunities unavailable." });
      }
    }),

  /**
   * Batch quick outlooks for a list of watchlist symbols.
   * Used by the Watchlist page to show outlook chips alongside each position.
   * Max 30 symbols per request.
   */
  getWatchlistOutlooks: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        symbol: z.string().min(1).max(20),
        assetType: assetTypeSchema,
      })).max(30),
    }))
    .query(async ({ input }) => {
      const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
      const results = await Promise.allSettled(
        input.items.map(item =>
          getQuickOutlook(item.symbol.toUpperCase(), item.assetType, canonicalState)
        )
      );
      return results.map((r, i) => ({
        symbol: input.items[i].symbol.toUpperCase(),
        assetType: input.items[i].assetType,
        outlook: r.status === "fulfilled" ? withoutOutlookConfidence(sanitizeNumbers(r.value) as typeof r.value) : null,
        error: r.status === "rejected" ? String(r.reason) : null,
      }));
    }),

  /**
   * Opportunity Discovery Engine — 8-category proactive feed.
   * Returns categorized buckets with Opportunity Score, Time Horizon, Catalyst, Risk Level.
   * Cached for 10 minutes.
   */
  getOpportunityDiscovery: publicProcedure
    .query(async () => {
      try {
        const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
        const result = await getOpportunityDiscovery({ canonicalState, captureEngineEvents: false });
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        console.error("[outlook.getOpportunityDiscovery] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Opportunity discovery unavailable." });
      }
    }),

  /**
   * Chart-first detail for an eligible Rising Star. Historical FAULTLINE
   * markers are returned only from immutable live verified records; market
   * OHLC bars never imply a reconstructed historical detection.
   */
  getRisingStarVisualDetail: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(20).toUpperCase(),
      range: z.enum(["1W", "1M", "3M", "6M"]).default("3M"),
    }))
    .query(async ({ input }) => {
      try {
        const detail = await getRisingStarVisualDetail(input.ticker, input.range);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: `${input.ticker} is not currently in the verified Rising Stars universe.` });
        return sanitizeNumbers(detail) as typeof detail;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[outlook.getRisingStarVisualDetail] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Rising Stars visual analysis is temporarily unavailable." });
      }
    }),

  /**
   * Security Context — unified live data bar for any ticker.
   * Returns price, change, volume, market cap, sector, regime alignment, opportunity score.
   * Used by UniversalTickerHeader on every analysis page.
   */
  getSecurityContext: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
        const [quote, quickOutlook] = await Promise.allSettled([
          getQuote(input.symbol),
          getQuickOutlook(input.symbol, input.assetType, canonicalState),
        ]);

        const q = quote.status === "fulfilled" ? quote.value : null;
        const o = quickOutlook.status === "fulfilled" ? quickOutlook.value : null;

        // Fetch sector/industry from Polygon reference
        const apiKey = process.env.POLYGON_API_KEY ?? "";
        let sector: string | null = null;
        let industry: string | null = null;
        let marketCap: number | null = null;
        if (input.assetType === "stock" && apiKey) {
          try {
            const refRes = await fetch(
              `https://api.polygon.io/v3/reference/tickers/${input.symbol}?apiKey=${apiKey}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (refRes.ok) {
              const refData = await refRes.json() as { results?: { sic_description?: string; sector?: string; industry?: string; market_cap?: number } };
              const r = refData.results ?? {};
              sector = r.sector ?? null;
              industry = r.sic_description ?? r.industry ?? null;
              marketCap = r.market_cap ?? null;
            }
          } catch { /* ignore */ }
        }

        return sanitizeNumbers({
          symbol: input.symbol,
          assetType: input.assetType,
          price: q?.price ?? null,
          change: q?.change ?? null,
          changePercent: q?.changePercent ?? null,
          volume: q?.volume ?? null,
          marketState: q?.marketState ?? "UNKNOWN",
          sector,
          industry,
          marketCap,
          opportunityScore: o?.outlookScore ?? null,
          direction: o?.direction ?? null,
          riskLevel: o?.riskLevel ?? null,
          // QA r12: quick-outlook "confidence" is |composite − 50| × 2, not a calibrated
          // confidence; withheld at the response boundary ("Not established" in the header).
          confidence: null,
        }) as {
          symbol: string;
          assetType: "stock" | "crypto";
          price: number | null;
          change: number | null;
          changePercent: number | null;
          volume: number | null;
          marketState: string;
          sector: string | null;
          industry: string | null;
          marketCap: number | null;
          opportunityScore: number | null;
          direction: string | null;
          riskLevel: string | null;
          confidence: number | null;
        };
      } catch (err) {
        console.error("[outlook.getSecurityContext] Error for", input.symbol, err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Security context unavailable for ${input.symbol}.` });
      }
    }),

  /**
   * Today's Story — AI-written market narrative.
   * What happened, what changed overnight, what institutions are doing,
   * what matters next, and the invalidation thesis.
   * Cached for 15 minutes.
   */
  getTodaysStory: publicProcedure.query(async () => {
    try {
      const canonical = await getAuthoritativeCanonicalIntelligenceState();
      const pressure = toOperationalPressure(canonical, true);
      const packet = buildCanonicalEvidencePacket(toClientCanonicalIntelligenceState(canonical!));
      const opportunityResult = await getTopOpportunities(canonical).catch(() => null);
      const first = opportunityResult?.stocks[0] ?? opportunityResult?.crypto[0] ?? null;
      const prompt = `${evidenceNarrativePromptContract()}
Interpret only this canonical DERIVED evidence packet: ${JSON.stringify(packet)}.
No prior comparable raw-source snapshot, market-event calendar, institutional positions/flows, or ticker news is supplied. Do not claim overnight changes, duration, historical outcomes, catalysts, institutional activity, future returns or calibrated confidence.
Return JSON {"executiveSummary":string,"whyFaultlineBelieves":string,"pressureIndexExplanation":string,"claimIds":string[]}. Every claim ID must be from this packet. These three text fields are MODEL_INTERPRETATION, not new observed facts.`;
      const response = await invokeLLM({ messages: [{ role: "system", content: "Explain supplied market evidence clearly. Do not create financial facts or sources." }, { role: "user", content: prompt }], response_format: { type: "json_object" } as any });
      const raw = response.choices?.[0]?.message?.content;
      if (typeof raw !== "string") throw new Error("Market story interpretation unavailable.");
      const story = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      const allowedIds = new Set(packet.claims.map(claim => claim.claimId));
      if (![story.executiveSummary, story.whyFaultlineBelieves, story.pressureIndexExplanation].every(value => typeof value === "string") ||
        !Array.isArray(story.claimIds) || !story.claimIds.length || !story.claimIds.every((id: unknown) => typeof id === "string" && allowedIds.has(id))) throw new Error("Market story is not bound to supplied evidence claims.");
      return sanitizeNumbers({
        headline: `${canonical!.regime} — Pressure ${canonical!.pressureIndex}/100`,
        executiveSummary: story.executiveSummary as string,
        whyFaultlineBelieves: story.whyFaultlineBelieves as string,
        pressureIndexExplanation: story.pressureIndexExplanation as string,
        interpretationClass: "MODEL_INTERPRETATION" as const,
        sourceClaimIds: story.claimIds as string[], evidencePacket: packet,
        canonicalStateId: canonical!.stateId, inputSnapshotId: canonical!.inputSnapshotId,
        dataAsOf: canonical!.effectiveAt, evidenceQuality: canonical!.confidenceOrEvidenceQuality,
        faultlineAction: "Review the source-backed market regime; ticker-specific execution requires separate asset evidence.",
        topOpportunityTicker: first?.symbol ?? "", topOpportunityName: first?.name ?? "",
        topOpportunityRating: first?.direction ?? "UNAVAILABLE", topOpportunityScore: first?.outlookScore ?? null,
        topOpportunityConfidence: null, topOpportunityTimeHorizon: "Not established", topOpportunityExpectedRisk: first?.riskLevel ?? "UNAVAILABLE",
        topOpportunityExpectedReward: "Not established", topOpportunityWhyFirst: first ? "Highest available deterministic Outlook score in this canonical-bound candidate set; not a calibrated return forecast." : "No verified candidate is available.",
        topOpportunityBullDrivers: [] as string[], topOpportunityBearDrivers: [] as string[], topOpportunityCatalysts: [] as string[],
        topOpportunityUpgradeTriggers: [] as string[], topOpportunityDowngradeTriggers: [] as string[],
        riskWarning: "Derived regime readings are not calibrated forecasts or ticker-specific execution advice.",
        whatHappened: `Current canonical reading is effective ${canonical!.effectiveAt}. Prior comparable market observations are not supplied.`,
        whatChanged: "Unavailable — no comparable prior raw-source snapshot was supplied; no overnight movement is asserted.",
        whatInstitutionsAreDoing: "Unavailable — no verified institutional-position or flow source was supplied.",
        whatMattersNext: "No verified event calendar was supplied; upcoming catalysts are not asserted.",
        invalidationTriggers: [] as string[], confidenceExplanation: "Calibrated forecast confidence is not established; original evidence quality is shown.",
        portfolioTakeaway: "Use the canonical market context alongside verified asset and portfolio observations.",
        regimeSummary: `${canonical!.regime} — Pressure ${canonical!.pressureIndex}/100`,
        pressureIndex: pressure.overallPressure, regime: pressure.regime, regimeLevel: pressure.level,
        topAnalog: null, dataSource: "canonical-intelligence-state", forecastMetadata: insufficientHorizonMetadata("daily-story", canonical!.effectiveAt),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Today's Story unavailable: canonical evidence or bound interpretation is unavailable." });
    }
  }),

  /**
   * Admin: clear all outlook caches (forces fresh computation on next request).
   */
  clearCaches: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      clearOutlookCaches();
      return { success: true };
    }),
});
