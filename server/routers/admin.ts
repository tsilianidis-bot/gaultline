/**
 * Admin domain router
 * Handles all admin-only operations: user management, platform stats, founding requests,
 * email sending, pressure run inspection, and feature flag management.
 * Extracted from server/routers.ts for maintainability.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getAllUsers, getAllUsersWithTier, setUserTier,
  getFoundingRequests, updateFoundingRequestStatus,
  getPlatformStats, getActivityFeed,
  getSignupTimeSeries, getWaitlistTimeSeries, getConversionStats,
  deleteUser,
  getRecentPressureRuns, countPressureRuns,
  getAllFeatureFlags, setFeatureFlag,
} from "../db";
import { sendEmail, buildApprovalEmail } from "../email";

export const adminRouter = router({
  // List all registered users
  getUsers: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        return await getAllUsers();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
      }
    }),

  // List all users with tier info
  getUsersWithTier: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        return await getAllUsersWithTier();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
      }
    }),

  // Set a user's access tier
  setUserTier: protectedProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      tier: z.enum(["free", "core", "premium", "founding"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        await setUserTier(input.userId, input.tier);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set tier", cause: err });
      }
    }),

  // List all founding access requests
  getFoundingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        return await getFoundingRequests();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch requests", cause: err });
      }
    }),

  // Platform stats
  getPlatformStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        return await getPlatformStats();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch stats", cause: err });
      }
    }),

  // Activity feed
  getActivityFeed: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        return await getActivityFeed(30);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch activity", cause: err });
      }
    }),

  // Update founding request status
  updateFoundingRequestStatus: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "approved", "rejected"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        await updateFoundingRequestStatus(input.id, input.status);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update request", cause: err });
      }
    }),

  // Signup/waitlist/conversion time series
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const [signups, waitlist, conversion] = await Promise.all([
      getSignupTimeSeries(30),
      getWaitlistTimeSeries(30),
      getConversionStats(),
    ]);
    return { signups, waitlist, conversion };
  }),

  // Send founding access approval email
  sendApprovalEmail: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      const emailPayload = buildApprovalEmail({
        name: input.name ?? "",
        email: input.email,
        siteUrl: input.origin,
      });
      const result = await sendEmail(emailPayload);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Failed to send email" });
      }
      return { success: true, sentTo: input.email };
    }),

  // Remove a user account and all their data
  removeUser: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own account." });
      try {
        await deleteUser(input.userId);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove user", cause: err });
      }
    }),

  // Pressure engine audit trail inspection
  getPressureRuns: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const [runs, total] = await Promise.all([
        getRecentPressureRuns(input.limit),
        countPressureRuns(),
      ]);
      return { runs, total };
    }),

  // Feature flags — read
  getFeatureFlags: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAllFeatureFlags();
    }),

  // Feature flags — toggle
  setFeatureFlag: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await setFeatureFlag(input.key, input.enabled, ctx.user.id);
      return { success: true };
    }),
});
