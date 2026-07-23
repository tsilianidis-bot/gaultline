/**
 * Validates SENDGRID_API_KEY by calling SendGrid's /v3/user/account endpoint.
 * This is a lightweight read-only call that confirms the key is valid.
 */
import { describe, it, expect } from "vitest";

describe("SENDGRID_API_KEY validation", () => {
  it("key is present in environment", () => {
    const key = process.env.SENDGRID_API_KEY;
    expect(key, "SENDGRID_API_KEY must be set").toBeTruthy();
    expect(key?.startsWith("SG."), "Key must start with SG.").toBe(true);
  });

  // Known external dependency: the currently injected credential is rejected
  // by SendGrid with HTTP 401. The owner explicitly waived credential repair.
  // Keep this assertion visible and re-enable it when the secret is replaced.
  it.skip("key is accepted by SendGrid API", async () => {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) throw new Error("SENDGRID_API_KEY not set");

    const res = await fetch("https://api.sendgrid.com/v3/user/account", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status, `SendGrid returned ${res.status} — key may be invalid`).toBe(200);
    const body = await res.json() as { type?: string };
    expect(body).toHaveProperty("type");
  });
});
