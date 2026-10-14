// Scheduled / admin-authorized persistence for Pressure Index readings.
// Phase 2 #7 (2026-10-13): moved out of the public pressure.getCurrentPressure
// query so that public reads never mutate stored observations.
import { insertPressureRun } from "../db";
import { runV3HShadow } from "./shadowEngine";
import { recordPressureV2ShadowObservation } from "./v2/shadowRecorder";
import type { FaultlinePressureOutput } from "./engine";

export async function persistPressureRunAndShadows(result: FaultlinePressureOutput, trigger: string): Promise<void> {
  if (result.verification?.status !== "verified") return; // never persist stale/unverified readings
  await insertPressureRun({
    overallPressure: result.overallPressure,
    regime: result.regime,
    level: result.level,
    dataSource: result.dataSource,
    vectorsJson: JSON.stringify(result.vectors),
    alertsJson: JSON.stringify(result.alerts),
    topAnalogJson: JSON.stringify(result.topAnalog),
    rawInputsJson: JSON.stringify({
      ...result.vectors.reduce((acc, v) => ({ ...acc, [v.id]: v.rawInputs }), {} as Record<string, unknown>),
      _provenance: result.verification.inputs,
      _methodologyVersion: result.verification.methodologyVersion,
      _trigger: trigger,
    }),
    engineVersion: "1.0.0",
  });
  await runV3HShadow(result).catch(() => {});
  await recordPressureV2ShadowObservation({ trigger, v1: result }).catch(() => {});
}
