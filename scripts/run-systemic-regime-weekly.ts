import { timingSafeEqual } from "node:crypto";
import { runSystemicRegimeTrainJob } from "../server/systemicRegime/scheduled";

const TOKEN_FLAG = "--scheduler-token";

function schedulerTokenFromArguments(argv: string[]): string | undefined {
  const index = argv.indexOf(TOKEN_FLAG);
  return index >= 0 ? argv[index + 1] : undefined;
}

function hasExactWeeklySchedulerToken(provided: string | undefined): boolean {
  const expected = process.env.SYSTEMIC_REGIME_WEEKLY_SCHEDULER_TOKEN ?? "";
  if (!expected || !provided) return false;
  const actual = Buffer.from(provided);
  const required = Buffer.from(expected);
  return actual.length === required.length && timingSafeEqual(actual, required);
}

async function main(): Promise<void> {
  if (!hasExactWeeklySchedulerToken(schedulerTokenFromArguments(process.argv.slice(2)))) {
    console.error("[SystemicRegime] Weekly training denied: exact scheduler token required.");
    process.exitCode = 1;
    return;
  }

  const result = await runSystemicRegimeTrainJob();
  if (!result.ok) {
    console.error("[SystemicRegime] Weekly training failed.", result);
    process.exitCode = 1;
    return;
  }
  console.log("[SystemicRegime] Weekly training completed.", result);
}

void main().catch(error => {
  console.error("[SystemicRegime] Weekly training crashed.", error);
  process.exitCode = 1;
});
