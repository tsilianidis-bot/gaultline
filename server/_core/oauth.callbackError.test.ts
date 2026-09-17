import { describe, expect, it } from "vitest";
import {
  OAUTH_CALLBACK_ERROR_CODES,
  OAuthCallbackStepError,
  publicOAuthCallbackFailure,
  resolveOAuthCallbackErrorCode,
} from "./oauth";

const SENSITIVE_SAMPLES = [
  "access_token=secret-token-value",
  "sk_test_51ExampleSecretValue",
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
  "authorization_code=abc123",
];

describe("OAuth callback operator error payload", () => {
  it("exposes a stable errorCode and non-sensitive message for each step", () => {
    const expected: Record<(typeof OAUTH_CALLBACK_ERROR_CODES)[number], string> = {
      token_exchange_failed: "Authorization code could not be exchanged for a token.",
      userinfo_failed: "User info could not be loaded after token exchange.",
      db_failed: "Signed-in user could not be saved.",
      session_failed: "Session could not be created.",
      callback_failed: "OAuth callback failed.",
    };

    for (const errorCode of OAUTH_CALLBACK_ERROR_CODES) {
      const body = publicOAuthCallbackFailure(errorCode);
      expect(Object.keys(body).sort()).toEqual(["error", "errorCode", "message"]);
      expect(body.error).toBe("OAuth callback failed");
      expect(body.errorCode).toBe(errorCode);
      expect(body.message).toBe(expected[errorCode]);
    }
  });

  it("maps step errors to their code and unknown errors to callback_failed", () => {
    expect(
      resolveOAuthCallbackErrorCode(new OAuthCallbackStepError("token_exchange_failed")),
    ).toBe("token_exchange_failed");
    expect(
      resolveOAuthCallbackErrorCode(new OAuthCallbackStepError("userinfo_failed")),
    ).toBe("userinfo_failed");
    expect(
      resolveOAuthCallbackErrorCode(new OAuthCallbackStepError("db_failed")),
    ).toBe("db_failed");
    expect(
      resolveOAuthCallbackErrorCode(new OAuthCallbackStepError("session_failed")),
    ).toBe("session_failed");
    expect(resolveOAuthCallbackErrorCode(new Error("boom"))).toBe("callback_failed");
    expect(resolveOAuthCallbackErrorCode("not-an-error")).toBe("callback_failed");
  });

  it("does not leak tokens or secrets from a wrapped provider error", () => {
    const cause = {
      message: "ExchangeToken rejected",
      response: {
        data: {
          accessToken: "secret-token-value",
          error_description: "client_id mismatch",
        },
        config: {
          data: JSON.stringify({
            clientId: "Xbzsed6coyZiRmSu4UeiVi",
            code: "authorization_code=abc123",
          }),
        },
      },
    };
    const wrapped = new OAuthCallbackStepError("token_exchange_failed", cause);
    const body = publicOAuthCallbackFailure(resolveOAuthCallbackErrorCode(wrapped));
    const serialized = JSON.stringify(body);

    expect(body.errorCode).toBe("token_exchange_failed");
    expect(body).not.toHaveProperty("cause");
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("response");
    for (const sample of SENSITIVE_SAMPLES) {
      expect(serialized).not.toContain(sample);
    }
  });
});
