import { loadLockedSpec } from "../spec";

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function auroc(scores: readonly number[], labels: readonly boolean[]): number | null {
  if (scores.length !== labels.length || scores.length === 0) return null;
  const positives = labels.filter(Boolean).length;
  const negatives = labels.length - positives;
  if (positives === 0 || negatives === 0) return null;
  const rows = scores.map((score, index) => ({ score, label: labels[index]! })).sort((left, right) => left.score - right.score);
  const ranks = new Array<number>(rows.length);
  let cursor = 0;
  while (cursor < rows.length) {
    let end = cursor;
    while (end < rows.length && rows[end]!.score === rows[cursor]!.score) end += 1;
    const average = (cursor + 1 + end) / 2;
    for (let index = cursor; index < end; index += 1) ranks[index] = average;
    cursor = end;
  }
  let rankSum = 0;
  for (let index = 0; index < rows.length; index += 1) if (rows[index]!.label) rankSum += ranks[index]!;
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function quantile(sorted: readonly number[], probability: number): number {
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low]!;
  return sorted[low]! * (high - index) + sorted[high]! * (index - low);
}

export function blockBootstrapAuroc(args: {
  scores: readonly number[];
  labels: readonly boolean[];
  blockLength?: number;
  draws?: number;
  seed?: number;
}): { auc: number | null; ciLow: number | null; ciHigh: number | null; status: "ok" | "INSUFFICIENT_SAMPLE" } {
  const spec = loadLockedSpec().spec;
  const blockLength = args.blockLength ?? spec.evaluation.blockLengthWeeks;
  const draws = args.draws ?? spec.evaluation.bootstrapDraws;
  const seed = args.seed ?? spec.evaluation.bootstrapSeed;
  const point = auroc(args.scores, args.labels);
  if (point == null || args.scores.length < blockLength * 2) {
    return { auc: point, ciLow: null, ciHigh: null, status: "INSUFFICIENT_SAMPLE" };
  }
  const random = mulberry32(seed);
  const blocks: number[][] = [];
  for (let start = 0; start < args.scores.length; start += blockLength) {
    const length = Math.min(blockLength, args.scores.length - start);
    const block: number[] = [];
    for (let offset = 0; offset < length; offset += 1) block.push(start + offset);
    blocks.push(block);
  }
  const samples: number[] = [];
  let attempts = 0;
  while (samples.length < draws && attempts < draws * 20) {
    attempts += 1;
    const picked: number[] = [];
    while (picked.length < args.scores.length) {
      const block = blocks[Math.floor(random() * blocks.length)]!;
      picked.push(...block);
    }
    const chosen = picked.slice(0, args.scores.length);
    const auc = auroc(chosen.map(index => args.scores[index]!), chosen.map(index => args.labels[index]!));
    if (auc != null) samples.push(auc);
  }
  if (samples.length < Math.min(draws, 50)) {
    return { auc: point, ciLow: null, ciHigh: null, status: "INSUFFICIENT_SAMPLE" };
  }
  samples.sort((left, right) => left - right);
  return { auc: point, ciLow: quantile(samples, 0.025), ciHigh: quantile(samples, 0.975), status: "ok" };
}

export function falseAlarmRate(args: {
  scores: readonly number[];
  events: readonly boolean[];
  threshold: number;
  horizonSteps: number;
}): { crossings: number; falseAlarms: number; rate: number | null } {
  if (args.scores.length !== args.events.length) throw new Error("Score and event lengths differ");
  let crossings = 0;
  let falseAlarms = 0;
  for (let index = 1; index < args.scores.length; index += 1) {
    const crossed = args.scores[index - 1]! < args.threshold && args.scores[index]! >= args.threshold;
    if (!crossed) continue;
    crossings += 1;
    const window = args.events.slice(index, index + args.horizonSteps);
    if (!window.some(Boolean)) falseAlarms += 1;
  }
  return { crossings, falseAlarms, rate: crossings === 0 ? null : falseAlarms / crossings };
}

export function sensitivityThresholds(base: number): number[] {
  return [base * 0.8, base, Math.min(100, base * 1.2)];
}
