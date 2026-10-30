import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  // The runtime tables introduced by 0078-0082 live in focused modules. Keep
  // every module in the configured schema input so generation/introspection
  // sees the same declarations used by the corresponding server writers.
  schema: [
    "./drizzle/schema.ts",
    "./drizzle/billingPaymentLinkageSchema.ts",
    "./drizzle/decisionOutcomeProvenanceSchema.ts",
    "./drizzle/publishingDeliveryClaimsSchema.ts",
    "./drizzle/ownerAdminAuditSchema.ts",
    "./server/durableAlertEventsSchema.ts",
  ],
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
