/**
 * Email helper tests
 * Validates buildApprovalEmail template output and sendEmail graceful fallback
 * when SENDGRID_API_KEY is not configured.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildApprovalEmail, sendEmail } from "./email";

describe("buildApprovalEmail", () => {
  it("returns correct recipient email", () => {
    const payload = buildApprovalEmail({
      name: "Christian Scheel",
      email: "cscheel77@gmail.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload.to).toBe("cscheel77@gmail.com");
  });

  it("returns correct subject line", () => {
    const payload = buildApprovalEmail({
      name: "Test User",
      email: "test@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload.subject).toBe("Your FAULTLINE Founding Access is Ready");
  });

  it("includes the recipient name in the HTML body", () => {
    const payload = buildApprovalEmail({
      name: "Christian",
      email: "cscheel77@gmail.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload.html).toContain("Christian");
  });

  it("includes the site URL as CTA link", () => {
    const payload = buildApprovalEmail({
      name: "Test",
      email: "test@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload.html).toContain("https://getfaultline.live");
  });

  it("handles missing name gracefully", () => {
    const payload = buildApprovalEmail({
      name: "",
      email: "anon@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload.html).toContain("there");
  });

  it("returns html and to fields", () => {
    const payload = buildApprovalEmail({
      name: "User",
      email: "user@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(payload).toHaveProperty("html");
    expect(payload).toHaveProperty("to");
    expect(payload).toHaveProperty("subject");
  });
});

describe("sendEmail — no API key configured", () => {
  beforeEach(() => {
    // Ensure SENDGRID_API_KEY is not set for these tests
    delete process.env.SENDGRID_API_KEY;
  });

  it("returns success: false with descriptive error when key is missing", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });
});
