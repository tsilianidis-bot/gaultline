/**
 * Launch fix-up: response-boundary guard for signal "confidence".
 *
 * The trading-signal engines (tradingSignals.ts, cryptoSignals.ts) compute
 * "confidence" as a formula of the internal signal score (e.g.
 * min(95, 55 + |score| × 5)). It is not a calibrated probability, so it is
 * not sent to customers. The engines are unchanged and keep using the value
 * internally; only the tRPC response is nulled here.
 */

export type WithheldConfidence<T extends { confidence: number }> =
  Omit<T, "confidence"> & { confidence: null };

/** Null the formula confidence on one signal at the response boundary. */
export function withholdSignalConfidence<T extends { confidence: number }>(
  signal: T,
): WithheldConfidence<T> {
  return { ...signal, confidence: null };
}

/** Null the formula confidence on a batch of signals. */
export function withholdSignalsConfidence<T extends { confidence: number }>(
  signals: T[],
): WithheldConfidence<T>[] {
  return signals.map(withholdSignalConfidence);
}

/**
 * Screener variant. The crypto screener page ordered rows by the engine
 * confidence. To keep that ordering without sending the number, each row
 * carries `strengthRank`: an ordinal position only (1 = first), ties kept in
 * engine order. It is never a percentage and must not be displayed.
 */
export function withholdScreenerConfidence<T extends { confidence: number }>(
  signals: T[],
): Array<WithheldConfidence<T> & { strengthRank: number }> {
  const order = signals
    .map((s, index) => ({ index, confidence: s.confidence }))
    .sort((a, b) => b.confidence - a.confidence || a.index - b.index);
  const rankByIndex = new Map<number, number>();
  order.forEach((entry, position) => rankByIndex.set(entry.index, position + 1));
  return signals.map((s, index) => ({
    ...withholdSignalConfidence(s),
    strengthRank: rankByIndex.get(index) ?? signals.length,
  }));
}
