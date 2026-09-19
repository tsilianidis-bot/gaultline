/**
 * Customer UI must not show a commit SHA watermark.
 * Founder QA can reveal the existing BuildBadge with ?founderQa=1.
 * /api/health and /api/build-info remain the supported identity endpoints.
 */
export function isCustomerBuildBadgeVisible(search: string): boolean {
  const normalized = search.startsWith("?") || search === "" ? search : `?${search}`;
  return new URLSearchParams(normalized).get("founderQa") === "1";
}
