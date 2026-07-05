import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getUsersPendingDripStep, recordOnboardingEmailSent } from "./db";
import { sendEmail, buildDay1PressureEmail, buildDay2UpgradeEmail, buildDay3FoundingEmail } from "./email";
import { HttpError } from "../shared/_core/errors";

/**
 * POST /api/scheduled/drip-email
 *
 * Heartbeat handler — runs every hour.
 * Sends Day 1 (Pressure Index explainer), Day 2 (Trader upgrade), and Day 3
 * (Founding Member urgency) drip emails to users who signed up 24h / 48h / 72h ago
 * and haven't yet received those steps.
 */
export async function handleDripEmail(req: Request, res: Response): Promise<void> {
  // Authenticate — allow cron triggers and admin users
  let isCronOrAdmin = false;
  try {
    const user = await sdk.authenticateRequest(req);
    isCronOrAdmin = !!(user.isCron || user.role === "admin");
  } catch (authErr) {
    if (authErr instanceof HttpError) {
      res.status(authErr.statusCode).json({ error: authErr.message });
    } else {
      res.status(403).json({ error: "Authentication failed" });
    }
    return;
  }
  if (!isCronOrAdmin) {
    res.status(403).json({ error: "cron or admin only" });
    return;
  }
  try {

    const DAY_MS = 24 * 60 * 60 * 1000;
    let sent1 = 0;
    let sent2 = 0;
    let sent3 = 0;

    // ── Step 1: Day 1 email (24h after signup) ────────────────────────────────
    const step1Users = await getUsersPendingDripStep(1, DAY_MS);
    for (const u of step1Users) {
      if (!u.email) continue;
      try {
        await sendEmail(buildDay1PressureEmail({ name: u.name || "", email: u.email }));
        await recordOnboardingEmailSent(u.id, 1);
        sent1++;
      } catch (err) {
        console.warn(`[DripEmail] Step 1 failed for user ${u.id}:`, err);
      }
    }

    // ── Step 2: Day 2 email (48h after signup) ────────────────────────────────
    const step2Users = await getUsersPendingDripStep(2, 2 * DAY_MS);
    for (const u of step2Users) {
      if (!u.email) continue;
      try {
        await sendEmail(buildDay2UpgradeEmail({ name: u.name || "", email: u.email }));
        await recordOnboardingEmailSent(u.id, 2);
        sent2++;
      } catch (err) {
        console.warn(`[DripEmail] Step 2 failed for user ${u.id}:`, err);
      }
    }

    // ── Step 3: Day 3 email (72h after signup) ────────────────────────────────
    const step3Users = await getUsersPendingDripStep(3, 3 * DAY_MS);
    for (const u of step3Users) {
      if (!u.email) continue;
      // Only send Day 3 Founding urgency email to free (Observer) users —
      // paid users don't need the urgency nudge, just mark as sent.
      if (u.accessTier && u.accessTier !== "free") {
        await recordOnboardingEmailSent(u.id, 3);
        continue;
      }
      try {
        await sendEmail(buildDay3FoundingEmail({ name: u.name || "", email: u.email }));
        await recordOnboardingEmailSent(u.id, 3);
        sent3++;
      } catch (err) {
        console.warn(`[DripEmail] Step 3 failed for user ${u.id}:`, err);
      }
    }

    res.json({ ok: true, sent1, sent2, sent3, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[DripEmail] Handler error:", err);
    res.status(500).json({
      error: String(err),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
