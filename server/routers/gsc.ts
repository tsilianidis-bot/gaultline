/**
 * FAULTLINE — Google Search Console Router
 * Handles OAuth connect/disconnect and data fetching from GSC API.
 * Stores refresh tokens in gsc_tokens table (one per user).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { gscTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

// ── OAuth2 client factory ─────────────────────────────────────────────────────
function getOAuth2Client() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Google OAuth credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Settings → Secrets.",
    });
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getStoredToken(userId: number) {
  const db = (await getDb())!;
  const rows = await db.select().from(gscTokens).where(eq(gscTokens.userId, userId)).limit(1);
  return rows[0] ?? null;
}

async function getAuthenticatedClient(userId: number) {
  const token = await getStoredToken(userId);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Google Search Console not connected." });
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token:  token.accessToken,
    refresh_token: token.refreshToken ?? undefined,
    expiry_date:   token.expiryDate ?? undefined,
  });
  // Auto-refresh if expired
  const now = Date.now();
  if (token.expiryDate && token.expiryDate < now + 60_000) {
    const { credentials } = await oauth2.refreshAccessToken();
    const dbInst = (await getDb())!;
    await dbInst.update(gscTokens).set({
      accessToken: credentials.access_token!,
      expiryDate:  credentials.expiry_date ?? null,
    }).where(eq(gscTokens.userId, userId));
    oauth2.setCredentials(credentials);
  }
  return oauth2;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const gscRouter = router({

  // Returns the OAuth URL the frontend should redirect to
  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string().url() }))
    .query(({ input, ctx }) => {
      const oauth2 = getOAuth2Client();
      const url = oauth2.generateAuthUrl({
        access_type: "offline",
        prompt:      "consent",
        scope:       ["https://www.googleapis.com/auth/webmasters.readonly"],
        redirect_uri: input.redirectUri,
        state:       String(ctx.user.id),
      });
      return { url };
    }),

  // Exchange auth code for tokens and store them
  handleCallback: protectedProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const oauth2 = getOAuth2Client();
      const { tokens } = await oauth2.getToken({ code: input.code, redirect_uri: input.redirectUri });
      if (!tokens.access_token) throw new TRPCError({ code: "BAD_REQUEST", message: "No access token returned from Google." });
      oauth2.setCredentials(tokens);

      // Fetch the user's verified sites to pick the primary one
      const sc = google.searchconsole({ version: "v1", auth: oauth2 });
      const sitesRes = await sc.sites.list();
      const sites = sitesRes.data.siteEntry ?? [];
      const primarySite = sites.find(s => s.permissionLevel === "siteOwner") ?? sites[0];

      const db = (await getDb())!;
      await db.insert(gscTokens).values({
        userId:       ctx.user.id,
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate:   tokens.expiry_date ?? null,
        siteUrl:      primarySite?.siteUrl ?? null,
      }).onDuplicateKeyUpdate({
        set: {
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiryDate:   tokens.expiry_date ?? null,
          siteUrl:      primarySite?.siteUrl ?? null,
        },
      });

      return { success: true, siteUrl: primarySite?.siteUrl ?? null, siteCount: sites.length };
    }),

  // Check connection status
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const token = await getStoredToken(ctx.user.id);
    return {
      connected: Boolean(token),
      siteUrl:   token?.siteUrl ?? null,
    };
  }),

  // Disconnect (delete stored token)
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = (await getDb())!;
    await db.delete(gscTokens).where(eq(gscTokens.userId, ctx.user.id));
    return { success: true };
  }),

  // List all verified sites
  getSites: protectedProcedure.query(async ({ ctx }) => {
    const oauth2 = await getAuthenticatedClient(ctx.user.id);
    const sc = google.searchconsole({ version: "v1", auth: oauth2 });
    const res = await sc.sites.list();
    return { sites: res.data.siteEntry ?? [] };
  }),

  // Set the active site URL
  setSite: protectedProcedure
    .input(z.object({ siteUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      await db.update(gscTokens).set({ siteUrl: input.siteUrl }).where(eq(gscTokens.userId, ctx.user.id));
      return { success: true };
    }),

  // Fetch performance data: clicks, impressions, CTR, position
  getPerformance: protectedProcedure
    .input(z.object({
      startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dimensions:  z.array(z.enum(["query", "page", "country", "device", "date"])).default(["query"]),
      rowLimit:    z.number().min(1).max(500).default(25),
    }))
    .query(async ({ input, ctx }) => {
      const oauth2 = await getAuthenticatedClient(ctx.user.id);
      const token  = await getStoredToken(ctx.user.id);
      if (!token?.siteUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site selected. Set a site first." });

      const sc = google.searchconsole({ version: "v1", auth: oauth2 });
      const res = await sc.searchanalytics.query({
        siteUrl: token.siteUrl,
        requestBody: {
          startDate:  input.startDate,
          endDate:    input.endDate,
          dimensions: input.dimensions,
          rowLimit:   input.rowLimit,
        },
      });

      const rows = (res.data.rows ?? []).map(r => ({
        keys:        r.keys ?? [],
        clicks:      r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr:         r.ctr ?? 0,
        position:    r.position ?? 0,
      }));

      return { rows, siteUrl: token.siteUrl };
    }),

  // Summary totals for the date range
  getSummary: protectedProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input, ctx }) => {
      const oauth2 = await getAuthenticatedClient(ctx.user.id);
      const token  = await getStoredToken(ctx.user.id);
      if (!token?.siteUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No site selected." });

      const sc = google.searchconsole({ version: "v1", auth: oauth2 });

      // Fetch totals (no dimensions = aggregate)
      const [totalRes, dateRes] = await Promise.all([
        sc.searchanalytics.query({
          siteUrl: token.siteUrl,
          requestBody: { startDate: input.startDate, endDate: input.endDate, rowLimit: 1 },
        }),
        sc.searchanalytics.query({
          siteUrl: token.siteUrl,
          requestBody: { startDate: input.startDate, endDate: input.endDate, dimensions: ["date"], rowLimit: 90 },
        }),
      ]);

      const totals = totalRes.data.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
      const trend  = (dateRes.data.rows ?? []).map(r => ({
        date:        r.keys?.[0] ?? "",
        clicks:      r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr:         r.ctr ?? 0,
        position:    r.position ?? 0,
      }));

      return {
        siteUrl:     token.siteUrl,
        totalClicks:      totals.clicks ?? 0,
        totalImpressions: totals.impressions ?? 0,
        avgCtr:           totals.ctr ?? 0,
        avgPosition:      totals.position ?? 0,
        trend,
      };
    }),
});
