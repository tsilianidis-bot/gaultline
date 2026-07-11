/**
 * Scheduled Seismograph Handler
 *
 * Runs daily to:
 * 1. Pull the latest FAULTLINE Pressure reading
 * 2. Record it as a Seismograph daily observation
 * 3. Run pattern analysis over the accumulated dataset
 *
 * Registered at: POST /api/scheduled/seismograph-daily
 * Cron: "0 0 18 * * *" (18:00 UTC / 2pm ET daily, after market close)
 */

import type { Request, Response } from "express";
import { calculateFaultlinePressure, type PressureAlert } from "./pressure/engine";
import { recordSeismographReading, runPatternAnalysis } from "./seismographEngine";

export async function handleScheduledSeismograph(
  _req: Request,
  res: Response
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[Seismograph] Daily job starting for ${today}`);

  try {
    // Step 1: Get the latest pressure reading
    const pressure = await calculateFaultlinePressure();

    // Step 2: Extract sub-scores from vectors
    const subScores: Record<string, number> = {};
    for (const v of pressure.vectors ?? []) {
      if (v.id && typeof v.score === "number") {
        subScores[v.id] = v.score;
      }
    }

    // Step 3: Build pressure drivers list from active alerts
    const pressureDrivers: string[] = (pressure.alerts ?? [])
      .filter((a: PressureAlert) => a.severity === "high" || a.severity === "critical")
      .map((a: PressureAlert) => a.title)
      .filter(Boolean)
      .slice(0, 5);

    // Step 4: Record the reading in the Seismograph database
    await recordSeismographReading({
      date: today,
      pressureScore: pressure.overallPressure,
      stressLevel: pressure.level,
      regime: pressure.regime,
      subScores,
      pressureDrivers,
      activeAlerts: (pressure.alerts ?? []).map((a: PressureAlert) => `${a.title}: ${a.detail}`).filter(Boolean),
    });

    console.log(
      `[Seismograph] Reading recorded: score=${pressure.overallPressure}, regime=${pressure.regime}`
    );

    // Step 5: Run pattern analysis over accumulated dataset
    await runPatternAnalysis();
    console.log(`[Seismograph] Pattern analysis complete`);

    res.json({
      ok: true,
      date: today,
      pressureScore: pressure.overallPressure,
      regime: pressure.regime,
    });
  } catch (err) {
    console.error("[Seismograph] Daily job failed:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
