import { isSnapshotDue } from "./calendar";
import { runCapture } from "./capture";
import { evaluateResearchMonitors } from "./monitor";
import { hashSpecBytes } from "./spec";
import { EXPECTED_SPEC_SHA256 } from "./lock";
import type { ResearchRepository } from "./repository";
import type { RawDraft } from "./types";

export const INTENDED_ROUTE = "/api/scheduled/pi-v2-research-tick";
export const SCHEDULE_REGISTRATION = "DISABLED" as const;

export type ScheduleEnv = Record<string, string | undefined>;

export function researchScheduleGate(env: ScheduleEnv): { enabled: false; reason: string } | { enabled: true } {
  if (env.NODE_ENV === "production") return { enabled: false, reason: "production_schedule_forbidden" };
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID) {
    return { enabled: false, reason: "railway_schedule_forbidden" };
  }
  if (env.PI_V2_RESEARCH_SCHEDULE_ENABLED !== "true") return { enabled: false, reason: "flag_off" };
  if (env.PI_V2_RESEARCH_ISOLATED_ACK !== "research-only-not-production") return { enabled: false, reason: "ack_missing" };
  return { enabled: true };
}

export type TickResult = {
  ran: boolean;
  reason: string;
  rawInserted: number;
  snapshot: "appended" | "already_exists" | "not_requested" | "calculation_failure" | "not_run";
};

/**
 * Daily raw capture and the Friday official snapshot.
 * The public server does not register this function. The default gate is closed,
 * and a production or Railway environment cannot open it.
 */
export async function runResearchTick(args: {
  now: Date;
  env: ScheduleEnv;
  repo: ResearchRepository;
  loadObservations?: () => Promise<RawDraft[]>;
}): Promise<TickResult> {
  const gate = researchScheduleGate(args.env);
  if (!gate.enabled) {
    return { ran: false, reason: gate.reason, rawInserted: 0, snapshot: "not_run" };
  }
  const drafts = args.loadObservations ? await args.loadObservations() : [];
  const due = isSnapshotDue(args.now);
  const capture = runCapture({
    repo: args.repo,
    drafts,
    asOfDate: due.asOfDate,
    nowIso: args.now.toISOString(),
    runTrigger: "SCHEDULED_CRON",
    writeSnapshot: due.due,
  });
  const findings = evaluateResearchMonitors({
    now: args.now,
    snapshotDates: args.repo.listSnapshots().map(row => row.asOfDate),
    raw: args.repo.listRaw(),
    actualSpecHash: hashSpecBytes(),
    lockedSpecHash: EXPECTED_SPEC_SHA256,
    watchFrom: args.env.PI_V2_RESEARCH_WATCH_FROM,
  });
  for (const finding of findings) {
    args.repo.appendMonitor({
      detectedAt: args.now.toISOString(),
      kind: finding.kind,
      severity: finding.severity,
      specId: finding.specId,
      specSha256: finding.specSha256,
      asOfDate: finding.asOfDate,
      detailJson: JSON.stringify(finding.detail),
    }, args.now.toISOString());
  }
  return {
    ran: true,
    reason: due.reason,
    rawInserted: capture.rawInserted,
    snapshot: capture.snapshot,
  };
}
