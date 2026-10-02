import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { ASHA_UNAVAILABLE_TITLE, reduceAshaAskFailure } from "../shared/ashaPanelMachine";
import { mapAshaProcedureError, PLATO_UNAVAILABLE_MESSAGES } from "./ashaProcedureError";
import { PlatoRouteError, PlatoUnavailableError, type PlatoErrorClass } from "./plato/errors";

const clientError = (code: string) => ({ message: "x", data: { code } });

function unavailable(...classes: PlatoErrorClass[]): PlatoUnavailableError {
  const attempts = classes.map((errorClass, index) => ({
    provider: "openai-compatible",
    model: `model-${index}`,
    errorClass,
    httpStatus: null,
  }));
  const last = new PlatoRouteError("upstream text that must not reach the client", {
    httpStatus: null,
    errorClass: classes[classes.length - 1],
    provider: "openai-compatible",
    model: `model-${classes.length - 1}`,
  });
  return new PlatoUnavailableError(last, attempts);
}

describe("PLATO unavailable panel state", () => {
  it("keeps a 429 on the unavailable panel with retry and never returns to summon", () => {
    const failure = reduceAshaAskFailure(clientError("TOO_MANY_REQUESTS"));
    expect(failure).toMatchObject({ panelState: "unavailable", kind: "rate_limit", title: ASHA_UNAVAILABLE_TITLE, showRetry: true });
  });

  it("shows a capacity message for SERVICE_UNAVAILABLE", () => {
    const failure = reduceAshaAskFailure(clientError("SERVICE_UNAVAILABLE"));
    expect(failure).toMatchObject({ panelState: "unavailable", kind: "capacity", showRetry: true });
    expect(failure.detail).toMatch(/high demand/);
  });

  it("keeps any other failure on the unavailable panel", () => {
    expect(reduceAshaAskFailure(clientError("INTERNAL_SERVER_ERROR"))).toMatchObject({ panelState: "unavailable", kind: "unavailable" });
    expect(reduceAshaAskFailure(new Error("network"))).toMatchObject({ panelState: "unavailable", kind: "unavailable" });
  });

  it("asks the user to sign in when the ask is unauthorized", () => {
    const failure = reduceAshaAskFailure(clientError("UNAUTHORIZED"));
    expect(failure.kind).toBe("unauthorized");
    expect(failure.detail).toMatch(/Sign in/);
  });
});

describe("typed server-side PLATO errors", () => {
  it("maps all-model quota exhaustion to TOO_MANY_REQUESTS", () => {
    const mapped = mapAshaProcedureError(unavailable("quota", "quota", "model_unavailable"));
    expect(mapped.code).toBe("TOO_MANY_REQUESTS");
    expect(mapped.message).toBe(PLATO_UNAVAILABLE_MESSAGES.quota);
  });

  it("maps capacity / high demand, 5xx and network failures to SERVICE_UNAVAILABLE", () => {
    expect(mapAshaProcedureError(unavailable("quota", "capacity")).code).toBe("SERVICE_UNAVAILABLE");
    expect(mapAshaProcedureError(unavailable("provider_5xx")).code).toBe("SERVICE_UNAVAILABLE");
    expect(mapAshaProcedureError(unavailable("network")).message).toBe(PLATO_UNAVAILABLE_MESSAGES.capacity);
  });

  it("maps timeouts to SERVICE_UNAVAILABLE with a timeout message", () => {
    const mapped = mapAshaProcedureError(unavailable("timeout", "timeout"));
    expect(mapped.code).toBe("SERVICE_UNAVAILABLE");
    expect(mapped.message).toBe(PLATO_UNAVAILABLE_MESSAGES.timeout);
  });

  it("maps auth / bad request to a generic INTERNAL_SERVER_ERROR without upstream text", () => {
    const mapped = mapAshaProcedureError(unavailable("auth"));
    expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    expect(mapped.message).toBe(PLATO_UNAVAILABLE_MESSAGES.misconfigured);
  });

  it("never leaks upstream provider text to the client", () => {
    for (const error of [unavailable("quota"), unavailable("capacity"), unavailable("auth"), new Error("secret upstream body")]) {
      const mapped = mapAshaProcedureError(error);
      expect(mapped.message).toMatch(/^PLATO is temporarily unavailable/);
      expect(mapped.message).not.toContain("upstream");
    }
  });

  it("passes an existing TRPCError through unchanged", () => {
    const original = new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
    expect(mapAshaProcedureError(original)).toBe(original);
  });

  it("the client machine and server codes agree for every reason", () => {
    expect(reduceAshaAskFailure(clientError(mapAshaProcedureError(unavailable("quota")).code)).kind).toBe("rate_limit");
    expect(reduceAshaAskFailure(clientError(mapAshaProcedureError(unavailable("capacity")).code)).kind).toBe("capacity");
    expect(reduceAshaAskFailure(clientError(mapAshaProcedureError(unavailable("timeout")).code)).kind).toBe("capacity");
    expect(reduceAshaAskFailure(clientError(mapAshaProcedureError(unavailable("auth")).code)).kind).toBe("unavailable");
  });
});
