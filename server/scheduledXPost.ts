// FAULTLINE — Scheduled X Post Handlers (server/scheduledXPost.ts)
//
// Heartbeat cron handlers for:
//   POST /api/scheduled/x-post-scheduled  — 3x daily posts (premarket/midday/closing)
//   POST /api/scheduled/x-news-monitor    — every 15 min, breaking alert if major headline
//
// Both endpoints are authenticated via sdk.authenticateRequest (isCron === true).
// ============================================================

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { calculateFaultlinePressure } from "./pressure/engine";
import { generateXPosts } from "./xPostGenerator";
import { postTweet } from "./xPoster";
import { getBreakingHeadline, setCooldown } from "./newsMonitor";
import { getDb } from "./db";
import { xPostQueue } from "../drizzle/schema";
import { log } from "./logger";

// ── Helper: save post to queue ────────────────────────────────

async function saveToQueue(
  postType: "premarket" | "midday" | "closing" | "breaking",
  variant: "short" | "thread" | "founder" | "institutional" | "breaking",
  content: string,
  status: "posted" | "failed" | "skipped",
  options: {
    xPostId?: string;
    errorMsg?: string;
    headline?: string;
    pressureScore?: number;
    pressureRegime?: string;
  } = {}
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(xPostQueue).values({
      postType,
      variant,
      content,
      status,
      xPostId: options.xPostId,
      errorMsg: options.errorMsg,
      headline: options.headline,
      pressureScore: options.pressureScore,
      pressureRegime: options.pressureRegime,
      postedAt: status === "posted" ? new Date() : undefined,
    });
  } catch (err) {
    log.warn(`[ScheduledXPost] Failed to save to queue: ${err}`);
  }
}

// ── Handler: 3x daily scheduled posts ────────────────────────
// Triggered by Heartbeat cron at 8:10am, 12pm, 3:45pm ET (UTC: 12:10, 16:00, 19:45)
// Payload: { "postType": "premarket" | "midday" | "closing" }

export async function handleScheduledXPost(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const postType = (req.body?.postType ?? "premarket") as "premarket" | "midday" | "closing";
    log.info(`[ScheduledXPost] Triggered: ${postType}`);

    // Get live pressure data
    const pressure = await calculateFaultlinePressure();

    // Generate posts using LLM
    const generated = await generateXPosts({ postType, pressure });

    // Post the "short" variant (≤280 chars, best for main feed)
    const shortPost = generated.short;
    if (!shortPost) {
      log.warn("[ScheduledXPost] No short post generated");
      return res.json({ ok: true, skipped: "no-content" });
    }

    try {
      const result = await postTweet(shortPost);
      log.info(`[ScheduledXPost] Posted ${postType}: ${result.id}`);

      await saveToQueue(postType, "short", shortPost, "posted", {
        xPostId: result.id,
        pressureScore: pressure.overallPressure,
        pressureRegime: pressure.regime,
      });

      return res.json({ ok: true, postType, xPostId: result.id });
    } catch (postErr) {
      const errMsg = String(postErr);
      log.warn(`[ScheduledXPost] Failed to post tweet: ${errMsg}`);

      await saveToQueue(postType, "short", shortPost, "failed", {
        errorMsg: errMsg,
        pressureScore: pressure.overallPressure,
        pressureRegime: pressure.regime,
      });

      return res.status(500).json({
        error: errMsg,
        stack: postErr instanceof Error ? postErr.stack : undefined,
        context: { postType, taskUid: user.taskUid },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    const errMsg = String(err);
    log.warn(`[ScheduledXPost] Handler error: ${errMsg}`);
    return res.status(500).json({
      error: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Handler: news monitor (every 15 min) ─────────────────────
// Polls Polygon.io, scores headlines, posts breaking alert if score >= 8

export async function handleXNewsMonitor(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    log.info("[XNewsMonitor] Triggered");

    // Check for breaking headline
    const breaking = await getBreakingHeadline();
    if (!breaking) {
      return res.json({ ok: true, skipped: "no-breaking-headline" });
    }

    // Get live pressure data
    const pressure = await calculateFaultlinePressure();

    // Generate breaking alert post
    const generated = await generateXPosts({ postType: "breaking", headline: breaking.article.title, pressure });
    const breakingPost = generated.breaking ?? generated.short;

    if (!breakingPost) {
      return res.json({ ok: true, skipped: "no-content-generated" });
    }

    try {
      const result = await postTweet(breakingPost);
      log.info(`[XNewsMonitor] Posted breaking alert: ${result.id}`);

      // Set cooldown to prevent spam
      setCooldown();

      await saveToQueue("breaking", "breaking", breakingPost, "posted", {
        xPostId: result.id,
        headline: breaking.article.title,
        pressureScore: pressure.overallPressure,
        pressureRegime: pressure.regime,
      });

      return res.json({
        ok: true,
        xPostId: result.id,
        headline: breaking.article.title,
        score: breaking.score,
      });
    } catch (postErr) {
      const errMsg = String(postErr);
      log.warn(`[XNewsMonitor] Failed to post breaking alert: ${errMsg}`);

      await saveToQueue("breaking", "breaking", breakingPost, "failed", {
        errorMsg: errMsg,
        headline: breaking.article.title,
        pressureScore: pressure.overallPressure,
        pressureRegime: pressure.regime,
      });

      return res.status(500).json({
        error: errMsg,
        stack: postErr instanceof Error ? postErr.stack : undefined,
        context: { headline: breaking.article.title, taskUid: user.taskUid },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    const errMsg = String(err);
    log.warn(`[XNewsMonitor] Handler error: ${errMsg}`);
    return res.status(500).json({
      error: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
