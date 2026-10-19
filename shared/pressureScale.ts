/**
 * @deprecated Import from `@shared/pressureBands` instead.
 * Thin compatibility shim over the canonical Pressure Index bands.
 */
import {
  PRESSURE_BANDS,
  pressureBand,
  type PressureBandDefinition,
} from "./pressureBands";

export const PRESSURE_SCALE = PRESSURE_BANDS.map((band) => ({
  min: band.min,
  range: band.range.includes("–") && band.max < 100
    ? `${band.min}–<${band.max + 1}`
    : band.range,
  label: band.regime,
  color: band.color,
  desc: band.description,
})) as ReadonlyArray<{
  min: number;
  range: string;
  label: string;
  color: string;
  desc: string;
}>;

export function pressureDisplayBand(score: number) {
  const band = pressureBand(score);
  return (
    PRESSURE_SCALE.find((entry) => entry.min === band.min) ?? PRESSURE_SCALE[0]
  );
}

export type { PressureBandDefinition };
