/**
 * Print EXAMPLE DATA for the accountability ledger.
 * This script does not open a database connection and refuses production.
 *
 *   TRACK_RECORD_ALLOW_EXAMPLE_SEED=1 pnpm exec tsx scripts/seedIntelligenceAccountabilityExample.ts
 */
import { seedExampleLedger } from "../shared/intelligenceAccountability";

const ledger = seedExampleLedger(process.env);
process.stdout.write(`${JSON.stringify({ label: "EXAMPLE DATA", records: ledger.list() }, null, 2)}\n`);
