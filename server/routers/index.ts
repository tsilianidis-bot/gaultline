/**
 * Domain router barrel
 * Re-exports all extracted domain routers for use in the main appRouter.
 * Add new domain routers here as they are extracted from server/routers.ts.
 */
export { analyticsRouter } from "./analytics";
export { blogRouter } from "./blog";
export { billingRouter } from "./billing";
export { adminRouter } from "./admin";
export { outlookRouter } from "./outlook";
export { organicContentRouter } from "./organicContent";
export { smartDiscoveryRouter } from "./smartDiscovery";
export { fmosRouter } from "./fmos";
export { dailyBriefRouter } from "./dailyBrief";
export { intelligenceValidationRouter } from "./intelligenceValidation";
