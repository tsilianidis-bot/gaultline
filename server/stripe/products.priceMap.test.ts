import { describe, expect, it } from "vitest";
import type { Plan } from "./products";
import { selectPlanForPrice } from "./products";

function plan(partial: Pick<Plan, "id" | "priceId" | "tier"> & Partial<Plan>): Plan {
  return {
    name: partial.id,
    description: "",
    amount: 100,
    interval: "month",
    ...partial,
  };
}

describe("selectPlanForPrice", () => {
  it("prefers the on-sale plan when a legacy plan shares its price id", () => {
    const chosen = selectPlanForPrice([
      plan({ id: "core", priceId: "price_shared", tier: "core" }),
      plan({ id: "premium", priceId: "price_shared", tier: "premium" }),
    ]);
    expect(chosen?.id).toBe("premium");
  });

  it("keeps a unique legacy price mapped to that legacy plan", () => {
    const chosen = selectPlanForPrice([
      plan({ id: "core", priceId: "price_legacy_core", tier: "core" }),
    ]);
    expect(chosen?.id).toBe("core");
  });

  it("returns undefined when nothing matches", () => {
    expect(selectPlanForPrice([])).toBeUndefined();
  });
});
