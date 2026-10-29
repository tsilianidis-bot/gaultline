/**
 * Email helper tests
 * Validates buildApprovalEmail template output and the outbound fail-closed
 * transport boundary with explicit fixture environments.
 */
import { describe, it, expect, vi } from "vitest";
import { buildApprovalEmail, sendEmail, type EmailTransport } from "./email";
import { DEPLOYMENT_SAFETY_ENV } from "./deploymentSafety";

const payload = { to: "test@example.com", subject: "Test", html: "<p>Test</p>" };

function fakeTransport(): EmailTransport {
  return {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  } as unknown as EmailTransport;
}

describe("buildApprovalEmail", () => {
  it("returns correct recipient email", () => {
    const approval = buildApprovalEmail({
      name: "Christian Scheel",
      email: "cscheel77@gmail.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.to).toBe("cscheel77@gmail.com");
  });

  it("returns correct subject line", () => {
    const approval = buildApprovalEmail({
      name: "Test User",
      email: "test@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.subject).toBe("Your FAULTLINE Founding Access is Ready");
  });

  it("includes the recipient name in the HTML body", () => {
    const approval = buildApprovalEmail({
      name: "Christian",
      email: "cscheel77@gmail.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.html).toContain("Christian");
  });

  it("includes the site URL as CTA link", () => {
    const approval = buildApprovalEmail({
      name: "Test",
      email: "test@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.html).toContain("https://getfaultline.live");
  });

  it("handles missing name gracefully", () => {
    const approval = buildApprovalEmail({
      name: "",
      email: "anon@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.html).toContain("there");
  });

  it("returns html and to fields", () => {
    const approval = buildApprovalEmail({
      name: "User",
      email: "user@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval).toHaveProperty("html");
    expect(approval).toHaveProperty("to");
    expect(approval).toHaveProperty("subject");
  });
});

describe("sendEmail outbound safety boundary", () => {
  it("returns success: false with descriptive error when the key is missing", async () => {
    const result = await sendEmail(payload, {
      [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "true",
    }, fakeTransport());
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("does not initialize or call the provider while outbound customer communication is disabled", async () => {
    const transport = fakeTransport();
    const result = await sendEmail(payload, {
      SENDGRID_API_KEY: "fixture-only-key",
      [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "false",
    }, transport);
    expect(result).toEqual({ success: false, error: "Outbound customer communication is disabled." });
    expect(transport.setApiKey).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("permits an explicitly enabled fixture through the injected transport only", async () => {
    const transport = fakeTransport();
    await expect(sendEmail(payload, {
      SENDGRID_API_KEY: "fixture-enabled-key",
      [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "true",
    }, transport)).resolves.toEqual({ success: true });
    expect(transport.setApiKey).toHaveBeenCalledWith("fixture-enabled-key");
    expect(transport.send).toHaveBeenCalledOnce();
  });
});
