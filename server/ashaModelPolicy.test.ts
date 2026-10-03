import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalChatModelId, isKnownNonChatModel } from "./ashaModelPolicy";
import { PLATO_DEFAULT_FAST_MODEL, resolvePlatoModelChain } from "./plato/config";

describe("PLATO chat-model guard (TTS path removed)", () => {
  it("rejects every TTS, embedding, image, transcription and live-audio id the production Gemini catalog lists", () => {
    for (const id of [
      "models/gemini-2.5-flash-preview-tts",
      "models/gemini-2.5-pro-preview-tts",
      "models/gemini-3.1-flash-tts-preview",
      "models/gemini-3.8-flash-tts",
      "models/gemini-3.8-flash-lite-tts",
      "models/gemini-embedding-001",
      "models/imagen-4.0-generate-001",
      "models/gemini-3.5-transcribe",
      "models/gemini-2.5-flash-native-audio-preview",
      "models/gemini-live-2.5-flash",
      "models/veo-3.0-generate-001",
    ]) {
      expect(isKnownNonChatModel(id), id).toBe(true);
    }
  });

  it("accepts the chat models in the PLATO chain", () => {
    for (const id of ["gemini-3-flash-preview", "models/gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "claude-sonnet-4-6"]) {
      expect(isKnownNonChatModel(id), id).toBe(false);
    }
    expect(canonicalChatModelId("models/gemini-3-flash-preview")).toBe("gemini-3-flash-preview");
  });

  it("drops a TTS model even when it is configured as the primary or a fallback", () => {
    const chain = resolvePlatoModelChain({
      PLATO_FAST_MODEL: "models/gemini-2.5-flash-preview-tts",
      PLATO_FALLBACK_MODELS: "gemini-3.8-flash-tts, models/gemini-3.1-flash-lite",
    });
    expect(chain.models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    expect(chain.models.some(isKnownNonChatModel)).toBe(false);
    expect(chain.primaryConfigured).toBe(false);
  });

  it("no longer picks arbitrary catalog ids: the policy has no catalog lookup at all", () => {
    const source = readFileSync(new URL("./ashaModelPolicy.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/listLLMModels|fetchCatalog|slice\(0,\s*3\)/);
    const gateway = readFileSync(new URL("./ashaGateway.ts", import.meta.url), "utf8");
    expect(gateway).not.toContain("resolveAshaModelCandidates");
  });

  it("defaults to the approved primary plus same-provider fallbacks", () => {
    const chain = resolvePlatoModelChain({});
    expect(chain.models[0]).toBe(PLATO_DEFAULT_FAST_MODEL);
    expect(chain.models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
  });

  it("honours explicit overrides in order and de-duplicates", () => {
    expect(resolvePlatoModelChain({
      FAULTLINE_PLATO_MODEL: "models/gemini-3.1-pro-preview",
      PLATO_FALLBACK_MODEL: "gemini-3.1-pro-preview",
    })).toEqual({ models: ["gemini-3.1-pro-preview"], primaryConfigured: true });
  });
});
