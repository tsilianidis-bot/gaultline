/**
 * Customer UI must never show a commit SHA watermark.
 * Production always hides the badge. /api/health and /api/build-info
 * remain the supported identity endpoints for founder QA.
 */
export function isCustomerBuildBadgeVisible(isProd: boolean): boolean {
  return !isProd;
}
