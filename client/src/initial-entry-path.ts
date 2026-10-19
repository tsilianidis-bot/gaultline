/**
 * Captured by main.tsx before route-level lazy imports. This preserves the
 * original arrival-path semantics for App's cinematic decision if a root
 * session redirect or client navigation loads App later in the same page.
 */
export const initialEntryPath =
  typeof window === "undefined" ? "/" : window.location.pathname;
