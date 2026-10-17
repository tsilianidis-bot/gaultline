import { createHash } from "node:crypto";

export function sha256Hex(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, entry]) => [key, sortValue(entry)]));
  }
  return value;
}

/** Stable JSON used for row fingerprints. Spec-file integrity uses the raw file bytes instead. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
