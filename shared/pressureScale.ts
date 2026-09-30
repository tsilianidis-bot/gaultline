/**
 * Presentation of the existing engine thresholds; this does not calculate scores.
 * Labels are the engine's own regime names (server/pressure/engine.ts classifyRegime).
 */
export const PRESSURE_SCALE = [
  { min: 0, range: "0–<25", label: "LOW RISK", color: "#00E5FF", desc: "Low measured pressure across the implemented inputs." },
  { min: 25, range: "25–<45", label: "MODERATE RISK", color: "#FFD700", desc: "Moderate measured pressure; monitor changes in the contributing inputs." },
  { min: 45, range: "45–<65", label: "ELEVATED RISK", color: "#EAB308", desc: "Elevated measured pressure across the composite score." },
  { min: 65, range: "65–<80", label: "HIGH STRESS", color: "#FF9500", desc: "High measured pressure; review the input evidence and its freshness." },
  { min: 80, range: "80–100", label: "SYSTEMIC CRISIS", color: "#FF4444", desc: "Critical measured pressure. This band does not establish a probability of a crash." },
] as const;

export function pressureDisplayBand(score: number) {
  return [...PRESSURE_SCALE].reverse().find(band => score >= band.min) ?? PRESSURE_SCALE[0];
}
