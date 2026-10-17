import { describe, expect, it, vi } from "vitest";
import { canonicalBrowserHost } from "./canonicalHost";

function request(hostname: string, path: string, method = "GET", query = "") {
  const redirect = vi.fn();
  const next = vi.fn();
  canonicalBrowserHost({ hostname, path, method, originalUrl: path + query } as any,
    { redirect } as any, next);
  return { redirect, next };
}

describe("canonical production browser host", () => {
  it("moves navigation and in-flight OAuth callbacks to apex before setting cookies", () => {
    for (const path of ["/", "/app", "/mobile", "/api/oauth/callback", "//example.invalid/path"]) {
      const result = request("www.getfaultline.live", path, "GET", "?code=test&state=test");
      expect(result.redirect).toHaveBeenCalledWith(302,
        `https://getfaultline.live${path}?code=test&state=test`);
      expect(result.next).not.toHaveBeenCalled();
    }
  });
  it("preserves API handlers, writes, staging, local and apex requests", () => {
    for (const [host, path, method] of [
      ["www.getfaultline.live", "/api/qa-access", "GET"],
      ["www.getfaultline.live", "/api/cron/run", "GET"],
      ["www.getfaultline.live", "/api/stripe/webhook", "POST"],
      ["www.getfaultline.live", "/app", "POST"],
      ["getfaultline.live", "/app", "GET"],
      ["staging.example.com", "/app", "GET"],
      ["localhost", "/app", "GET"],
    ]) {
      const result = request(host, path, method);
      expect(result.redirect).not.toHaveBeenCalled();
      expect(result.next).toHaveBeenCalledOnce();
    }
  });
});
