import type { NextFunction, Request, Response } from "express";

/**
 * Deployment-side effect controls.
 *
 * Every capability is disabled unless its variable is exactly the string "true".
 * These source controls do not replace deployment approval, credential isolation,
 * provider allowlists, schedule inventory, or schema migration review.
 */
export type DeploymentSafetyEnvironment = Record<string, string | undefined>;

export const DEPLOYMENT_SAFETY_ENV = {
  canonicalCollection: "FAULTLINE_CANONICAL_COLLECTION_ENABLED",
  nativeCronDispatch: "FAULTLINE_NATIVE_CRON_DISPATCH_ENABLED",
  outboundCustomerCommunication: "FAULTLINE_OUTBOUND_CUSTOMER_COMMUNICATION_ENABLED",
  automaticPublication: "FAULTLINE_AUTOMATIC_PUBLICATION_ENABLED",
  sectorRotationCollector: "FAULTLINE_SECTOR_ROTATION_COLLECTOR_ENABLED",
} as const;

export type ScheduledDispatchKind = "canonical-collection" | "automatic-publication" | "outbound-customer-communication";

function exactTrue(env: DeploymentSafetyEnvironment, name: string): boolean {
  return env[name] === "true";
}

export function isCanonicalCollectionEnabled(env: DeploymentSafetyEnvironment = process.env): boolean {
  return exactTrue(env, DEPLOYMENT_SAFETY_ENV.canonicalCollection);
}

export function isNativeCronDispatchEnabled(env: DeploymentSafetyEnvironment = process.env): boolean {
  return exactTrue(env, DEPLOYMENT_SAFETY_ENV.nativeCronDispatch);
}

export function isOutboundCustomerCommunicationEnabled(env: DeploymentSafetyEnvironment = process.env): boolean {
  return exactTrue(env, DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication);
}

export function isAutomaticPublicationEnabled(env: DeploymentSafetyEnvironment = process.env): boolean {
  return exactTrue(env, DEPLOYMENT_SAFETY_ENV.automaticPublication);
}

export function isSectorRotationCollectorEnabled(env: DeploymentSafetyEnvironment = process.env): boolean {
  return exactTrue(env, DEPLOYMENT_SAFETY_ENV.sectorRotationCollector);
}

export type ScheduledDispatchDecision =
  | { allowed: true }
  | { allowed: false; code: "native_cron_dispatch_disabled" | "canonical_collection_disabled" | "automatic_publication_disabled" | "outbound_customer_communication_disabled" };

/**
 * Native schedule credentials prove request origin only. The independent capability
 * gates below prove that this build is allowed to dispatch that class of work.
 */
export function scheduledDispatchDecision(
  kind: ScheduledDispatchKind,
  env: DeploymentSafetyEnvironment = process.env,
): ScheduledDispatchDecision {
  if (!isNativeCronDispatchEnabled(env)) return { allowed: false, code: "native_cron_dispatch_disabled" };
  if (kind === "canonical-collection" && !isCanonicalCollectionEnabled(env)) {
    return { allowed: false, code: "canonical_collection_disabled" };
  }
  if (kind === "automatic-publication" && !isAutomaticPublicationEnabled(env)) {
    return { allowed: false, code: "automatic_publication_disabled" };
  }
  if (kind === "outbound-customer-communication" && !isOutboundCustomerCommunicationEnabled(env)) {
    return { allowed: false, code: "outbound_customer_communication_disabled" };
  }
  return { allowed: true };
}

/**
 * Must be mounted after requireCron. Denial occurs before the scheduled handler,
 * avoiding provider calls, writes, publication, and email dispatch.
 */
export function requireScheduledDispatch(
  kind: ScheduledDispatchKind,
  env: DeploymentSafetyEnvironment = process.env,
) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const decision = scheduledDispatchDecision(kind, env);
    if (!decision.allowed) {
      res.status(403).json({ ok: false, error: "scheduled_dispatch_disabled", code: decision.code });
      return;
    }
    next();
  };
}

/** Throws before an X adapter can create a client or perform a remote write. */
export function assertAutomaticPublicationEnabled(env: DeploymentSafetyEnvironment = process.env): void {
  if (!isAutomaticPublicationEnabled(env)) {
    throw new Error("Automatic publication is disabled by FAULTLINE_AUTOMATIC_PUBLICATION_ENABLED.");
  }
}
