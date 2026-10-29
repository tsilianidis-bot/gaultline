import type { Request, Response } from "express";
import { getUsersPendingDripStep } from "./db";
import { sendEmail, buildDay1PressureEmail, buildDay2UpgradeEmail, buildDay3FoundingEmail } from "./email";
import {
  dispatchEmailWithClaim,
  onboardingDeliveryKey,
  publishingClaimStore,
} from "./publishingDeliveryClaims";

interface DripUser {
  id: number;
  name: string | null;
  email: string | null;
  accessTier: string | null;
}

async function sendClaimedDrip(
  user: DripUser,
  step: 1 | 2 | 3,
  build: () => { to: string; subject: string; html: string },
): Promise<boolean> {
  if (!user.email) return false;
  const delivery = await dispatchEmailWithClaim(publishingClaimStore, {
    deliveryKey: onboardingDeliveryKey(step, user.id),
    deliveryType: `onboarding_day_${step}`,
    userId: user.id,
    send: () => sendEmail(build()),
  });
  if (delivery.status !== "accepted" && delivery.status !== "completed") {
    console.warn(`[DripEmail] Step ${step} was not accepted for user ${user.id}: ${delivery.status}`);
  }
  // `completed` means a prior provider acceptance was already recorded; it is
  // not a new send and must not increment this invocation's acceptance count.
  return delivery.status === "accepted";
}

/**
 * POST /api/scheduled/drip-email
 *
 * Heartbeat handler — runs every hour. Candidate selection retains the existing
 * approved-access policy in getUsersPendingDripStep. Each remote email call is
 * fenced by a unique durable claim; provider acceptance is not recipient
 * delivery, and dispatching/ambiguous calls are not retried automatically.
 */
export async function handleDripEmail(req: Request, res: Response): Promise<void> {
  try {
    const DAY_MS = 24 * 60 * 60 * 1000;
    let sent1 = 0;
    let sent2 = 0;
    let sent3 = 0;

    const step1Users = await getUsersPendingDripStep(1, DAY_MS);
    for (const user of step1Users) {
      try {
        if (await sendClaimedDrip(user, 1, () => buildDay1PressureEmail({ name: user.name || "", email: user.email! }))) sent1++;
      } catch (err) {
        console.warn(`[DripEmail] Step 1 claim processing failed for user ${user.id}:`, err);
      }
    }

    const step2Users = await getUsersPendingDripStep(2, 2 * DAY_MS);
    for (const user of step2Users) {
      try {
        if (await sendClaimedDrip(user, 2, () => buildDay2UpgradeEmail({ name: user.name || "", email: user.email! }))) sent2++;
      } catch (err) {
        console.warn(`[DripEmail] Step 2 claim processing failed for user ${user.id}:`, err);
      }
    }

    const step3Users = await getUsersPendingDripStep(3, 3 * DAY_MS);
    for (const user of step3Users) {
      if (!user.email) continue;
      // Preserve the existing paid-user policy without claiming a transport
      // occurred. A durable skipped state stops repeated processing.
      if (user.accessTier && user.accessTier !== "free") {
        const claimed = await publishingClaimStore.claimDelivery({
          deliveryKey: onboardingDeliveryKey(3, user.id),
          deliveryType: "onboarding_day_3",
          userId: user.id,
        });
        if (claimed.status === "claimed") {
          await publishingClaimStore.markDeliverySkipped(claimed.claim);
        }
        continue;
      }
      try {
        if (await sendClaimedDrip(user, 3, () => buildDay3FoundingEmail({ name: user.name || "", email: user.email! }))) sent3++;
      } catch (err) {
        console.warn(`[DripEmail] Step 3 claim processing failed for user ${user.id}:`, err);
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
