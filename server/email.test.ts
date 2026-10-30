/**
 * Email helper tests
 * Validates template escaping/link construction and the outbound fail-closed
 * transport boundary with explicit fixture environments.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildApprovalEmail,
  buildContactAutoReply,
  buildContactEmail,
  buildDay1PressureEmail,
  buildDay2UpgradeEmail,
  buildDay3FoundingEmail,
  buildEmailTemplateLink,
  buildFoundingRequestNotification,
  buildSubscriberBriefEmailHtml,
  buildSubscriptionConfirmationEmail,
  buildWelcomeEmail,
  escapeEmailHtml,
  sendEmail,
  type EmailTransport,
} from "./email";
import { DEPLOYMENT_SAFETY_ENV } from "./deploymentSafety";

const payload = {
  to: "test@example.com",
  subject: "Test",
  html: "<p>Test</p>",
};
const adversarialText = `</div><img src=x onerror="alert(1)"> & "'`;

function fakeTransport(): EmailTransport {
  return {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  } as unknown as EmailTransport;
}

function expectEscapedMarkup(html: string) {
  expect(html).not.toContain('<img src=x onerror="alert(1)">');
  expect(html).not.toContain('onerror="alert(1)');
  expect(html).toContain("&lt;/div&gt;&lt;img");
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

  it("includes the site URL as a first-party CTA link", () => {
    const approval = buildApprovalEmail({
      name: "Test",
      email: "test@example.com",
      siteUrl: "https://getfaultline.live",
    });
    expect(approval.html).toContain('href="https://getfaultline.live/"');
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

describe("email template escaping", () => {
  it("encodes every HTML delimiter for text and quoted attribute contexts", () => {
    expect(escapeEmailHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("escapes adversarial user-controlled values in every email template family", () => {
    const templates = [
      buildApprovalEmail({
        name: adversarialText,
        email: "recipient@example.test",
        siteUrl: 'https://attacker.example/" onmouseover=alert(1)',
      }).html,
      buildContactEmail({
        name: adversarialText,
        email: 'attacker@example.test" onmouseover="alert(1)',
        subject: adversarialText,
        message: adversarialText,
        category: adversarialText,
      }).html,
      buildContactAutoReply({
        name: adversarialText,
        email: "recipient@example.test",
        subject: adversarialText,
      }).html,
      buildWelcomeEmail({
        name: adversarialText,
        email: "recipient@example.test",
        siteUrl: "javascript:alert(1)",
      }).html,
      buildSubscriptionConfirmationEmail({
        name: adversarialText,
        email: "recipient@example.test",
        planName: adversarialText,
        siteUrl: "https://getfaultline.live.evil",
      }).html,
      buildFoundingRequestNotification({
        name: adversarialText,
        email: 'attacker@example.test" onmouseover="alert(1)',
        message: adversarialText,
        requestId: 7,
        siteUrl: "https://getfaultline.live@attacker.example",
      }).html,
      buildDay1PressureEmail({
        name: adversarialText,
        email: "recipient@example.test",
        siteUrl: "data:text/html,unsafe",
      }).html,
      buildDay2UpgradeEmail({
        name: adversarialText,
        email: "recipient@example.test",
        siteUrl: "http://getfaultline.live",
      }).html,
      buildDay3FoundingEmail({
        name: adversarialText,
        email: "recipient@example.test",
        siteUrl: "https://evil.example",
      }).html,
      buildSubscriberBriefEmailHtml({
        name: adversarialText,
        title: adversarialText,
        category: adversarialText,
        articlePath: "//attacker.example/brief",
        tier: "premium",
      }),
    ];

    for (const html of templates) {
      expectEscapedMarkup(html);
      expect(html).not.toContain("https://attacker.example");
      expect(html).not.toContain("https://evil.example");
      expect(html).not.toContain("javascript:alert(1)");
    }
  });

  it("uses a safe fallback for a malformed reply address instead of creating an injected mailto attribute", () => {
    const contact = buildContactEmail({
      name: "Sender",
      email: 'attacker@example.test" onmouseover="alert(1)',
      subject: "Reply needed",
      message: "Message body",
      category: "General",
    });

    expect(contact.html).toContain(
      'href="mailto:jt@getfaultline.live?subject=Re%3A+Reply+needed"'
    );
    expect(contact.html).not.toContain('onmouseover="alert(1)');
  });
});

describe("email template link allowlist", () => {
  it("allows only configured first-party HTTPS origins and rejects unsafe paths", () => {
    expect(
      buildEmailTemplateLink("/app", "https://www.getfaultline.live")
    ).toBe("https://www.getfaultline.live/app");
    expect(buildEmailTemplateLink("/app", "https://attacker.example")).toBe(
      "https://getfaultline.live/app"
    );
    expect(
      buildEmailTemplateLink("javascript:alert(1)", "https://getfaultline.live")
    ).toBe("https://getfaultline.live/");
    expect(
      buildEmailTemplateLink(
        "//attacker.example/brief",
        "https://getfaultline.live"
      )
    ).toBe("https://getfaultline.live/");
  });
});

describe("sendEmail outbound safety boundary", () => {
  it("returns success: false with descriptive error when the key is missing", async () => {
    const result = await sendEmail(
      payload,
      {
        [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "true",
      },
      fakeTransport()
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("does not initialize or call the provider while outbound customer communication is disabled", async () => {
    const transport = fakeTransport();
    const result = await sendEmail(
      payload,
      {
        SENDGRID_API_KEY: "fixture-only-key",
        [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "false",
      },
      transport
    );
    expect(result).toEqual({
      success: false,
      error: "Outbound customer communication is disabled.",
    });
    expect(transport.setApiKey).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("permits an explicitly enabled fixture through the injected transport only", async () => {
    const transport = fakeTransport();
    await expect(
      sendEmail(
        payload,
        {
          SENDGRID_API_KEY: "fixture-enabled-key",
          [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "true",
        },
        transport
      )
    ).resolves.toEqual({ success: true });
    expect(transport.setApiKey).toHaveBeenCalledWith("fixture-enabled-key");
    expect(transport.send).toHaveBeenCalledOnce();
  });

  it("normalizes untrusted subject line breaks before the injected transport sees them", async () => {
    const transport = fakeTransport();
    await expect(
      sendEmail(
        {
          ...payload,
          subject: "Safe subject\r\nBcc: attacker@example.test",
        },
        {
          SENDGRID_API_KEY: "fixture-header-key",
          [DEPLOYMENT_SAFETY_ENV.outboundCustomerCommunication]: "true",
        },
        transport
      )
    ).resolves.toEqual({ success: true });

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Safe subject Bcc: attacker@example.test",
      })
    );
  });
});
