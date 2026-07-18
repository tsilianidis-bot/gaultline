/**
 * FAULTLINE — Promotional Campaign Router
 *
 * Handles the FACEBOOK30 (and any future) promotional campaigns.
 *
 * Key guarantees:
 * - Concurrency-safe: uses UPDATE ... WHERE redemptionCount < maxRedemptions
 *   to atomically increment the counter. Only one winner per slot.
 * - Per-user deduplication: unique constraints on (userId, campaignId) and
 *   (email, campaignId) prevent any user from redeeming twice.
 * - Silent cap: no public counter is ever exposed.
 * - Auto-deactivation: campaign is set inactive after the 100th redemption.
 * - Milestone notifications: owner notified at 75, 90, 100 redemptions.
 * - Trial expiry: trialExpiresAt = activatedAt + trialDays days.
 * - User access tier: elevated to trialTier for the trial duration.
 */
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { promoCampaigns, promoRedemptions, users } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

// ── Helpers ───────────────────────────────────────────────────

/** Check if a user's promo trial is currently active */
export async function isPromoTrialActive(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ trialExpiresAt: promoRedemptions.trialExpiresAt })
    .from(promoRedemptions)
    .where(eq(promoRedemptions.userId, userId))
    .limit(1);
  if (!rows.length) return false;
  return new Date() < new Date(rows[0].trialExpiresAt);
}

/** Mark a redemption as engaged (called on login after activation) */
export async function markPromoEngaged(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(promoRedemptions)
    .set({ engaged: true })
    .where(eq(promoRedemptions.userId, userId));
}

/** Mark a redemption as converted (called when user starts paid subscription) */
export async function markPromoConverted(userId: number, stripeSubscriptionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(promoRedemptions)
    .set({ converted: true, stripeSubscriptionId })
    .where(eq(promoRedemptions.userId, userId));
}

// ── Fire milestone notification if threshold just crossed ─────
async function checkAndFireMilestones(
  campaignId: number,
  newCount: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(eq(promoCampaigns.id, campaignId))
    .limit(1);
  const campaign = rows[0];
  if (!campaign) return;

  const milestones = (campaign.milestones ?? "75,90,100")
    .split(",")
    .map((m: string) => Number(m))
    .filter(Boolean);

  let notified: number[] = [];
  try {
    notified = JSON.parse(campaign.milestonesNotified ?? "[]");
  } catch {
    notified = [];
  }

  const toFire = milestones.filter((m: number) => m <= newCount && !notified.includes(m));
  if (toFire.length === 0) return;

  for (const milestone of toFire) {
    const isMax = milestone >= campaign.maxRedemptions;
    await notifyOwner({
      title: isMax
        ? `🎯 FACEBOOK30 Campaign Complete — ${milestone} Redemptions`
        : `📊 FACEBOOK30 Milestone: ${milestone} Redemptions Reached`,
      content: isMax
        ? `The FACEBOOK30 promotional campaign has reached its maximum of ${campaign.maxRedemptions} successful redemptions. The campaign has been automatically deactivated. No further redemptions are possible. Review the admin dashboard at /admin/promo for full analytics.`
        : `The FACEBOOK30 campaign has reached ${milestone} successful redemptions out of ${campaign.maxRedemptions} available. Review the admin dashboard at /admin/promo for details.`,
    });
    notified.push(milestone);
  }

  await db
    .update(promoCampaigns)
    .set({ milestonesNotified: JSON.stringify(notified) })
    .where(eq(promoCampaigns.id, campaignId));
}

// ── Router ────────────────────────────────────────────────────
export const promoRouter = router({

  /**
   * validateCode — public
   * Returns whether a code is valid and active.
   * Never reveals redemption count or remaining slots.
   */
  validateCode: publicProcedure
    .input(z.object({ code: z.string().min(1).max(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const rows = await db
        .select()
        .from(promoCampaigns)
        .where(eq(promoCampaigns.code, input.code.toUpperCase()))
        .limit(1);
      const campaign = rows[0];

      if (!campaign) {
        return { valid: false, message: "This promotional offer has ended." };
      }
      if (!campaign.active || campaign.redemptionCount >= campaign.maxRedemptions) {
        return { valid: false, message: "This promotional offer has ended." };
      }

      return {
        valid: true,
        trialDays: campaign.trialDays,
        // Never expose count, remaining, or max
      };
    }),

  /**
   * redeemCode — protected (requires login)
   * Atomically claims one of the 100 slots.
   *
   * Concurrency safety strategy:
   * 1. UPDATE promoCampaigns SET redemptionCount = redemptionCount + 1
   *    WHERE id = ? AND active = TRUE AND redemptionCount < maxRedemptions
   *    Returns affectedRows = 1 only if the slot was successfully claimed.
   * 2. If affectedRows = 0, the campaign is full — return "offer ended".
   * 3. Unique constraints on (userId, campaignId) and (email, campaignId)
   *    prevent duplicate redemptions at the DB level.
   * 4. User accessTier is elevated to trialTier for the trial duration.
   */
  redeemCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      const userId = ctx.user.id;
      const userEmail = ctx.user.email ?? "";

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // 1. Look up campaign
      const campaignRows = await db
        .select()
        .from(promoCampaigns)
        .where(eq(promoCampaigns.code, code))
        .limit(1);
      const campaign = campaignRows[0];

      if (!campaign || !campaign.active || campaign.redemptionCount >= campaign.maxRedemptions) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This promotional offer has ended.",
        });
      }

      // 2. Check if this user has already redeemed this campaign
      const existingByUser = await db
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(and(
          eq(promoRedemptions.campaignId, campaign.id),
          eq(promoRedemptions.userId, userId),
        ))
        .limit(1);
      if (existingByUser.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already redeemed this promotional offer.",
        });
      }

      // Check by email too
      if (userEmail) {
        const existingByEmail = await db
          .select({ id: promoRedemptions.id })
          .from(promoRedemptions)
          .where(and(
            eq(promoRedemptions.campaignId, campaign.id),
            eq(promoRedemptions.email, userEmail),
          ))
          .limit(1);
        if (existingByEmail.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This email address has already been used to redeem this offer.",
          });
        }
      }

      // 3. Atomically claim a slot — the WHERE clause is the concurrency guard
      const updateResult = await db.execute(
        sql`UPDATE promoCampaigns
            SET redemptionCount = redemptionCount + 1
            WHERE id = ${campaign.id}
              AND active = TRUE
              AND redemptionCount < maxRedemptions`
      );

      // MySQL returns affectedRows in the result header
      const affectedRows = (updateResult as any)[0]?.affectedRows ?? 0;
      if (affectedRows === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This promotional offer has ended.",
        });
      }

      // 4. Fetch the updated redemption count to assign the redemption number
      const updatedRows = await db
        .select({ redemptionCount: promoCampaigns.redemptionCount })
        .from(promoCampaigns)
        .where(eq(promoCampaigns.id, campaign.id))
        .limit(1);
      const redemptionNumber = updatedRows[0]?.redemptionCount ?? (campaign.redemptionCount + 1);

      // 5. Calculate trial expiry
      const activatedAt = new Date();
      const trialExpiresAt = new Date(activatedAt);
      trialExpiresAt.setDate(trialExpiresAt.getDate() + campaign.trialDays);

      // 6. Insert redemption record
      try {
        await db.insert(promoRedemptions).values({
          campaignId: campaign.id,
          userId,
          redemptionNumber,
          email: userEmail || `user-${userId}@promo.faultline`,
          name: ctx.user.name ?? undefined,
          activatedAt,
          trialExpiresAt,
          engaged: false,
          converted: false,
        });
      } catch (insertErr: any) {
        // Unique constraint violation — duplicate redemption attempt
        if (insertErr?.code === "ER_DUP_ENTRY" || insertErr?.message?.includes("Duplicate")) {
          // Roll back the counter increment
          await db.execute(
            sql`UPDATE promoCampaigns
                SET redemptionCount = redemptionCount - 1
                WHERE id = ${campaign.id}`
          );
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already redeemed this promotional offer.",
          });
        }
        throw insertErr;
      }

      // 7. Elevate user access tier for the trial duration
      await db
        .update(users)
        .set({ accessTier: campaign.trialTier as "free" | "core" | "premium" | "founding" })
        .where(eq(users.id, userId));

      // 8. Auto-deactivate campaign if max reached
      if (redemptionNumber >= campaign.maxRedemptions) {
        await db
          .update(promoCampaigns)
          .set({ active: false })
          .where(eq(promoCampaigns.id, campaign.id));
      }

      // 9. Fire milestone notifications (non-blocking)
      checkAndFireMilestones(campaign.id, redemptionNumber).catch(console.error);

      return {
        success: true,
        trialExpiresAt: trialExpiresAt.toISOString(),
        trialDays: campaign.trialDays,
        accessTier: campaign.trialTier,
      };
    }),

  /**
   * myRedemption — protected
   * Returns the current user's redemption status for any campaign.
   * Used to show trial expiry info in the user's profile/settings.
   */
  myRedemption: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const rows = await db
      .select()
      .from(promoRedemptions)
      .where(eq(promoRedemptions.userId, ctx.user.id))
      .limit(1);
    const redemption = rows[0];
    if (!redemption) return null;

    const now = new Date();
    const expiresAt = new Date(redemption.trialExpiresAt);
    const isActive = now < expiresAt;
    const daysRemaining = isActive
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      isActive,
      daysRemaining,
      trialExpiresAt: redemption.trialExpiresAt,
      activatedAt: redemption.activatedAt,
    };
  }),

  // ── Admin procedures ────────────────────────────────────────

  /**
   * adminGetCampaign — admin only
   * Returns full campaign stats for the admin dashboard.
   */
  adminGetCampaign: adminProcedure
    .input(z.object({ code: z.string().default("FACEBOOK30") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const campaignRows = await db
        .select()
        .from(promoCampaigns)
        .where(eq(promoCampaigns.code, input.code.toUpperCase()))
        .limit(1);
      const campaign = campaignRows[0];
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });

      const redemptions = await db
        .select()
        .from(promoRedemptions)
        .where(eq(promoRedemptions.campaignId, campaign.id))
        .orderBy(promoRedemptions.redemptionNumber);

      const totalRedemptions = redemptions.length;
      const now = new Date();
      const activeTrials = redemptions.filter(r => now < new Date(r.trialExpiresAt)).length;
      const expiredTrials = totalRedemptions - activeTrials;
      const engagedCount = redemptions.filter(r => r.engaged).length;
      const convertedCount = redemptions.filter(r => r.converted).length;
      const conversionRate = totalRedemptions > 0
        ? Math.round((convertedCount / totalRedemptions) * 100)
        : 0;

      return {
        campaign: {
          id: campaign.id,
          code: campaign.code,
          description: campaign.description,
          active: campaign.active,
          trialTier: campaign.trialTier,
          trialDays: campaign.trialDays,
          maxRedemptions: campaign.maxRedemptions,
          redemptionCount: campaign.redemptionCount,
          source: campaign.source,
          createdAt: campaign.createdAt,
        },
        stats: {
          totalRedemptions,
          activeTrials,
          expiredTrials,
          engaged: engagedCount,
          converted: convertedCount,
          conversionRate,
          remaining: Math.max(0, campaign.maxRedemptions - campaign.redemptionCount),
        },
        redemptions: redemptions.map(r => ({
          id: r.id,
          redemptionNumber: r.redemptionNumber,
          name: r.name,
          email: r.email,
          activatedAt: r.activatedAt,
          trialExpiresAt: r.trialExpiresAt,
          trialActive: now < new Date(r.trialExpiresAt),
          engaged: r.engaged,
          converted: r.converted,
          stripeSubscriptionId: r.stripeSubscriptionId,
        })),
      };
    }),

  /**
   * adminUpdateEngagement — admin only
   * Manually mark a redemption as engaged or converted.
   */
  adminUpdateEngagement: adminProcedure
    .input(z.object({
      redemptionId: z.number(),
      engaged: z.boolean().optional(),
      converted: z.boolean().optional(),
      stripeSubscriptionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const updates: Record<string, unknown> = {};
      if (input.engaged !== undefined) updates.engaged = input.engaged;
      if (input.converted !== undefined) updates.converted = input.converted;
      if (input.stripeSubscriptionId) updates.stripeSubscriptionId = input.stripeSubscriptionId;

      await db
        .update(promoRedemptions)
        .set(updates as any)
        .where(eq(promoRedemptions.id, input.redemptionId));

      return { success: true };
    }),
});
