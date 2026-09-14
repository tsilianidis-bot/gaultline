import type { Request, Response } from "express";
import { resolveBuildIdentity } from "./buildIdentity";

export function healthBody(): { ok: true; commit: string; buildTime: string } {
  const identity = resolveBuildIdentity();
  return {
    ok: true,
    commit: identity.commit,
    buildTime: identity.buildTime,
  };
}

export function handleHealth(_req: Request, res: Response) {
  res.status(200).json(healthBody());
}
