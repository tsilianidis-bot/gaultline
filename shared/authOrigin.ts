/** Keep production sign-in on one host; preserve local and staging origins. */
export const FAULTLINE_ORIGIN = "https://getfaultline.live";

export function canonicalAuthOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "getfaultline.live" || url.hostname === "www.getfaultline.live") {
      return FAULTLINE_ORIGIN;
    }
  } catch {
    // The login builder retains its existing invalid-configuration behavior.
  }
  return origin;
}
