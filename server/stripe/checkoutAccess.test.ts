import { afterEach, describe, expect, it } from "vitest";
import { CHECKOUT_ENABLED } from "../../shared/tiers";
import {
  CHECKOUT_ALLOWLIST_COPY,
  CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY,
  isCheckoutBuyerAllowed,
  isCheckoutRuntimeEnabled,
} from "../../shared/checkoutAccess";
import { explainCheckoutBlock } from "../routers/billing";

const buyer = { id: 42, email: "Member@Faultline.app" };

afterEach(() => {
  delete process.env.CHECKOUT_RUNTIME_ENABLED;
  delete process.env.CHECKOUT_ALLOWLIST_ONLY;
  delete process.env.CHECKOUT_ALLOWLIST_USER_IDS;
  delete process.env.CHECKOUT_ALLOWLIST_EMAILS;
});

describe("checkout runtime kill switch (no Stripe call)", () => {
  it("stays closed when the compiled flag is false, even if the env var is true", () => {
    expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: "true" }, false)).toBe(false);
  });

  it("stays closed when the compiled flag is true and the env var is unset, empty, or false", () => {
    expect(CHECKOUT_ENABLED).toBe(true);
    expect(isCheckoutRuntimeEnabled({}, true)).toBe(false);
    expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: "" }, true)).toBe(false);
    expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: "false" }, true)).toBe(false);
    expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: "0" }, true)).toBe(false);
    expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: "off" }, true)).toBe(false);
  });

  it("opens only when the compiled flag is true and CHECKOUT_RUNTIME_ENABLED is explicitly true", () => {
    for (const value of ["true", "TRUE", "1", "on", "yes"]) {
      expect(isCheckoutRuntimeEnabled({ CHECKOUT_RUNTIME_ENABLED: value }, true)).toBe(true);
    }
  });
});

describe("checkout allowlist (no Stripe call)", () => {
  it("allows every buyer when allowlist mode is off", () => {
    expect(isCheckoutBuyerAllowed({}, null)).toBe(true);
    expect(isCheckoutBuyerAllowed({ CHECKOUT_ALLOWLIST_ONLY: "false" }, null)).toBe(true);
  });

  it("denies everyone when allowlist mode is on and both lists are empty", () => {
    const env = { CHECKOUT_ALLOWLIST_ONLY: "true" };
    expect(isCheckoutBuyerAllowed(env, null)).toBe(false);
    expect(isCheckoutBuyerAllowed(env, buyer)).toBe(false);
  });

  it("allows a listed user id or email and denies everyone else", () => {
    const env = {
      CHECKOUT_ALLOWLIST_ONLY: "true",
      CHECKOUT_ALLOWLIST_USER_IDS: "7, 42",
      CHECKOUT_ALLOWLIST_EMAILS: "other@faultline.app",
    };
    expect(isCheckoutBuyerAllowed(env, buyer)).toBe(true);
    expect(isCheckoutBuyerAllowed(env, { id: 9, email: "Other@Faultline.app" })).toBe(true);
    expect(isCheckoutBuyerAllowed(env, { id: 9, email: "stranger@faultline.app" })).toBe(false);
    expect(isCheckoutBuyerAllowed(env, null)).toBe(false);
  });
});

describe("explainCheckoutBlock (no Stripe call)", () => {
  const env = { CHECKOUT_RUNTIME_ENABLED: "true" };

  it("rejects Trader, Founding, and annual plans even when runtime checkout is on", () => {
    expect(explainCheckoutBlock("core", "price_core", buyer, env)).toBe("not_for_sale");
    expect(explainCheckoutBlock("founding", "price_founding", buyer, env)).toBe("not_for_sale");
    expect(explainCheckoutBlock("core_annual", "price_annual", buyer, env)).toBe("not_for_sale");
    expect(explainCheckoutBlock("premium_annual", "price_annual", buyer, env)).toBe("not_for_sale");
  });

  it("rejects Intelligence and Lifetime until a price id and the runtime flag are both present", () => {
    expect(explainCheckoutBlock("premium", "price_99", buyer, {})).toBe("runtime_off");
    expect(explainCheckoutBlock("lifetime", null, buyer, env)).toBe("unconfigured");
    expect(explainCheckoutBlock("premium", "price_99", buyer, env)).toBeNull();
    expect(explainCheckoutBlock("lifetime", "price_1500", buyer, env)).toBeNull();
  });

  it("denies a signed-in buyer who is not on the allowlist, and anonymous listing", () => {
    const allowlisted = {
      CHECKOUT_RUNTIME_ENABLED: "true",
      CHECKOUT_ALLOWLIST_ONLY: "true",
      CHECKOUT_ALLOWLIST_EMAILS: "member@faultline.app",
    };
    expect(explainCheckoutBlock("premium", "price_99", buyer, allowlisted)).toBeNull();
    expect(explainCheckoutBlock("premium", "price_99", { id: 9, email: "nope@faultline.app" }, allowlisted)).toBe("allowlist");
    expect(explainCheckoutBlock("premium", "price_99", null, allowlisted)).toBe("allowlist");
    expect(CHECKOUT_ALLOWLIST_COPY).toContain("approved accounts");
    expect(CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY).toContain("temporarily unavailable");
  });
});
