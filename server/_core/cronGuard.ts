import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Canonical fail-closed guard for every HTTP scheduled mount.
 * The Authorization header must be exactly `Bearer <CRON_SECRET>`.
 */
export function configuredCronSecret(): string {
  return (process.env.CRON_SECRET ?? "").trim();
}

export function hasExactCronAuthorization(
  authorization: string | string[] | undefined,
  secret = configuredCronSecret(),
): boolean {
  if (!secret || typeof authorization !== "string") return false;
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requireCron(req: Request, res: Response, next: NextFunction): void {
  if (!hasExactCronAuthorization(req.headers.authorization)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
