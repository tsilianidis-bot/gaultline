import { describe, expect, it } from "vitest";
import {
  DECISION_LIGHT_CONTRACT_VERSION,
  DECISION_LIGHT_REQUIRED_FIELDS,
  classifyDecisionMoveFamily,
  decisionLightLabel,
} from "../shared/decisionLight";
import { assertDecisionLightContract, evaluateDecisionLight, resolveDecisionEvidenceHealth } from "./decisionLight";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALL_MOVES = [
  "add_risk",
  "buy_specific_asset",
  "deploy_cash",
  "reduce_risk",
  "sell_specific_asset",
  "raise_cash",
  "hedge",
  "hold",
  "rotate",
] as const;

function liveEvidence(overrides: Partial<Parameters<typeof evaluateDecisionLight>[0]> = {}) {
  return evaluateDecisionLight({
    moveType: "add_risk",
    proposedAction: "Add Risk",
    favorability: 80,
    pressureIndex: 22,
    regime: "Expansion",
    dataSource: "live",
    creditScore: 20,
    liquidityScore: 18,
    greenLights: ["Credit contained", "Breadth broad"],
    confirmationTriggers: ["Breadth confirmation"],
    invalidationTriggers: ["Pressure above 65"],
    bullContinuationProbability: 72,
    crashDrawdownProbability: 12,
    timestamp: "2026-09-12T20:00:00.000Z",
    canonicalStateId: "state:decision-light-test",
    evidenceQuality: "HEALTHY",
    coherenceStatus: "COHERENT",
    ...overrides,
  });
}

describe("Decision-Light contract", () => {
  it("keeps required fields on every output", () => {
    const output = liveEvidence();
    for (const field of DECISION_LIGHT_REQUIRED_FIELDS) {
      expect(output[field], field).toBeDefined();
    }
    expect(output.contractVersion).toBe(DECISION_LIGHT_CONTRACT_VERSION);
    expect(output.canonicalStateId).toBe("state:decision-light-test");
    expect(output.timestamp).toBe("2026-09-12T20:00:00.000Z");
    expect(output.sourceHealthStatus).toBe("healthy");
    assertDecisionLightContract(output);
  });

  it("never manufactures a colored light when evidence is unavailable", () => {
    const cases = [
      liveEvidence({ pressureIndex: null, canonicalStateId: null }),
      liveEvidence({ evidenceQuality: "UNAVAILABLE", requiredSourcesUnavailable: true }),
      liveEvidence({ dataSource: "fallback", canonicalStateId: null, evidenceQuality: null }),
      liveEvidence({ freshnessStale: true }),
      liveEvidence({ coherenceStatus: "UNAVAILABLE" }),
    ];
    for (const output of cases) {
      expect(output.decisionLight).toBe("GRAY");
      expect(output.decisionLabel).toBe("UNAVAILABLE");
      expect(output.supportingEvidence).toEqual([]);
      expect(output.sourceHealthStatus).toBe("unavailable");
    }
  });

  it("issues GREEN/PROCEED for supported risk-on and aligned risk-off moves", () => {
    const addRisk = liveEvidence({ moveType: "add_risk", proposedAction: "Add Risk", favorability: 82, pressureIndex: 22 });
    expect(addRisk.decisionLight).toBe("GREEN");
    expect(addRisk.decisionLabel).toBe("PROCEED");
    expect(addRisk.moveFamily).toBe("risk_on");

    const reduceRisk = liveEvidence({
      moveType: "reduce_risk",
      proposedAction: "Reduce Risk",
      favorability: 78,
      pressureIndex: 72,
      creditScore: 68,
      liquidityScore: 64,
    });
    expect(reduceRisk.decisionLight).toBe("GREEN");
    expect(reduceRisk.moveFamily).toBe("risk_off");
  });

  it("issues YELLOW/CAUTION when opportunity coexists with pressure or fragility", () => {
    const mixed = liveEvidence({
      moveType: "buy_specific_asset",
      proposedAction: "Buy NVDA",
      favorability: 55,
      pressureIndex: 48,
      creditScore: 46,
    });
    expect(mixed.decisionLight).toBe("YELLOW");
    expect(mixed.decisionLabel).toBe("CAUTION");
    expect(mixed.explanation).toMatch(/tighten controls/i);
  });

  it("issues RED/AVOID on material conflict with canonical risk", () => {
    const addIntoStress = liveEvidence({
      moveType: "add_risk",
      proposedAction: "Add Risk",
      favorability: 30,
      pressureIndex: 75,
      creditScore: 68,
      liquidityScore: 70,
    });
    expect(addIntoStress.decisionLight).toBe("RED");
    expect(addIntoStress.decisionLabel).toBe("AVOID");

    const sellIntoCalm = liveEvidence({
      moveType: "sell_specific_asset",
      proposedAction: "Sell NVDA",
      favorability: 28,
      pressureIndex: 20,
      creditScore: 18,
      liquidityScore: 16,
    });
    expect(sellIntoCalm.decisionLight).toBe("RED");
  });

  it("caps degraded evidence at YELLOW and never upgrades it to GREEN", () => {
    const degraded = liveEvidence({
      evidenceQuality: "DEGRADED",
      dataSource: "live",
      favorability: 88,
      pressureIndex: 20,
    });
    expect(degraded.sourceHealthStatus).toBe("degraded");
    expect(degraded.decisionLight).toBe("YELLOW");
  });

  it("keeps bull-continuation and crash/drawdown as separate fields", () => {
    const output = liveEvidence({
      bullContinuationProbability: 61,
      crashDrawdownProbability: 27,
      pressureIndex: 44,
    });
    expect(output.bullContinuationProbability).toBe(61);
    expect(output.crashDrawdownProbability).toBe(27);
    expect(output.pressureIndex).toBe(44);
    expect(output.bullContinuationProbability).not.toBe(output.crashDrawdownProbability);
  });

  it("classifies every move type into exactly one family", () => {
    expect(classifyDecisionMoveFamily("add_risk")).toBe("risk_on");
    expect(classifyDecisionMoveFamily("buy_specific_asset")).toBe("risk_on");
    expect(classifyDecisionMoveFamily("deploy_cash")).toBe("risk_on");
    expect(classifyDecisionMoveFamily("reduce_risk")).toBe("risk_off");
    expect(classifyDecisionMoveFamily("sell_specific_asset")).toBe("risk_off");
    expect(classifyDecisionMoveFamily("raise_cash")).toBe("risk_off");
    expect(classifyDecisionMoveFamily("hedge")).toBe("risk_off");
    expect(classifyDecisionMoveFamily("hold")).toBe("neutral");
    expect(classifyDecisionMoveFamily("rotate")).toBe("neutral");
  });

  it("evaluates every move type deterministically", () => {
    for (const moveType of ALL_MOVES) {
      const first = liveEvidence({ moveType, proposedAction: moveType });
      const second = liveEvidence({ moveType, proposedAction: moveType });
      expect(first).toEqual(second);
      expect(first.moveType).toBe(moveType);
      expect(["GREEN", "YELLOW", "RED", "GRAY"]).toContain(first.decisionLight);
      expect(first.decisionLabel).toBe(decisionLightLabel(first.decisionLight));
    }
  });

  it("resolveDecisionEvidenceHealth does not treat a bound live canonical state as unavailable", () => {
    expect(resolveDecisionEvidenceHealth({
      moveType: "hold",
      proposedAction: "Hold",
      favorability: 50,
      pressureIndex: 40,
      regime: "Transition",
      dataSource: "live",
      canonicalStateId: "state:ok",
      evidenceQuality: "HEALTHY",
    })).toBe("healthy");
  });
});

describe("tradePreflight Decision-Light wiring and unreachable-case purge", () => {
  const preflight = readFileSync(resolve(import.meta.dirname, "tradePreflight.ts"), "utf8");

  it("imports and attaches the authoritative Decision-Light engine", () => {
    expect(preflight).toContain('from "./decisionLight"');
    expect(preflight).toContain("evaluateDecisionLight");
    expect(preflight).toContain("decisionLight:");
  });

  it("does not keep duplicate move-type case labels in the same switch", () => {
    const switches = preflight.split(/switch\s*\(\s*(?:moveType|input\.moveType)\s*\)/);
    expect(switches.length).toBeGreaterThan(3);
    for (const block of switches.slice(1)) {
      const body = block.slice(0, block.indexOf("\n}"));
      for (const move of ALL_MOVES) {
        const matches = body.match(new RegExp(`case\\s+"${move}"`, "g")) ?? [];
        expect(matches.length, `duplicate case "${move}" in switch`).toBeLessThanOrEqual(1);
      }
    }
  });
});
