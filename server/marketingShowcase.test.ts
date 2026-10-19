import { describe, expect, it } from "vitest";
import {
  getVerifiedCapturePath,
  hasVerifiedCapture,
  isLocalMarketingAssetPath,
  SHOWCASE_EVIDENCE,
  type ShowcaseEvidence,
} from "../client/src/components/marketing/showcaseEvidence";

function qualifiedCandidate(): ShowcaseEvidence {
  const candidate = SHOWCASE_EVIDENCE[0];
  return {
    ...candidate,
    verification: {
      ...candidate.verification,
      status: "verified",
      operationalVerified: true,
      sourceVerified: true,
      actualCapturePath: "/marketing/pressure-index-reviewed.webp",
      capturedAt: "2026-10-19T15:00:00.000Z",
      sourceBranch: "marketing/premium-homepage-20261019",
      sourceSha: "f908e04ff265d004488f92a909cba4b2e0cebe3b",
      dataClassification: "public-sanitized",
      observationClassification: "delayed",
      observationAt: "2026-10-18T18:04:00.000Z",
      sensitiveInformationReviewed: true,
      containsSensitiveInformation: false,
    },
  };
}

describe("marketing showcase evidence manifest", () => {
  it("keeps all five candidate views pending by default", () => {
    expect(SHOWCASE_EVIDENCE.map(item => item.label)).toEqual([
      "Pressure Index",
      "Detection",
      "Six-Domain Intelligence",
      "Sector Rotation",
      "Smart Discovery",
    ]);

    for (const item of SHOWCASE_EVIDENCE) {
      expect(item.verification.status).toBe("pending");
      expect(getVerifiedCapturePath(item)).toBeNull();
      expect(hasVerifiedCapture(item)).toBe(false);
    }
  });

  it("only permits same-origin image assets under /marketing/", () => {
    expect(isLocalMarketingAssetPath("/marketing/captures/pressure.webp")).toBe(
      true
    );
    expect(isLocalMarketingAssetPath("/marketing/capture.jpg")).toBe(true);
    expect(isLocalMarketingAssetPath("https://example.com/capture.webp")).toBe(
      false
    );
    expect(isLocalMarketingAssetPath("//example.com/capture.webp")).toBe(false);
    expect(
      isLocalMarketingAssetPath("/marketing/../private/capture.webp")
    ).toBe(false);
    expect(
      isLocalMarketingAssetPath("/marketing/capture.webp?source=other")
    ).toBe(false);
    expect(isLocalMarketingAssetPath("/assets/capture.webp")).toBe(false);
  });

  it("allows a capture only after every verification and privacy gate passes", () => {
    const candidate = qualifiedCandidate();

    expect(hasVerifiedCapture(candidate)).toBe(true);
    expect(getVerifiedCapturePath(candidate)).toBe(
      "/marketing/pressure-index-reviewed.webp"
    );
  });

  it.each([
    ["operational review", { operationalVerified: false }],
    ["source review", { sourceVerified: false }],
    ["recorded capture path", { actualCapturePath: null }],
    ["recorded timestamp", { capturedAt: null }],
    ["source branch", { sourceBranch: null }],
    ["source SHA", { sourceSha: "not-a-sha" }],
    ["observation date", { observationAt: null }],
    ["data freshness classification", { observationClassification: null }],
    [
      "not a fictional demonstration",
      { observationClassification: "demonstration" as const },
    ],
    [
      "public-safe classification",
      { dataClassification: "restricted" as const },
    ],
    ["sensitive-information review", { sensitiveInformationReviewed: false }],
    [
      "absence of sensitive information",
      { containsSensitiveInformation: true },
    ],
    ["verified status", { status: "pending" as const }],
  ])("fails closed when %s is absent", (_label, gateChange) => {
    const candidate = qualifiedCandidate();
    const incomplete: ShowcaseEvidence = {
      ...candidate,
      verification: { ...candidate.verification, ...gateChange },
    };

    expect(hasVerifiedCapture(incomplete)).toBe(false);
    expect(getVerifiedCapturePath(incomplete)).toBeNull();
  });
});
