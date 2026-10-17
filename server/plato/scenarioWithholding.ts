/**
 * Scenario/probability withholding for everything sent to PLATO.
 *
 * Owner rule (approved with the probability contract, #60): a scenario or probability may be shown
 * only when its contract status is AVAILABLE, and none is today. The model therefore gets the
 * status text instead of any probability, in whatever form it appears: a percent, a decimal, a
 * "percent chance", "N in M" odds, or a numeric probability field in a context object.
 *
 * Kept on purpose: observed values and thresholds ("CPI 2.9%", "more than 70% of sectors",
 * "83% of all historical months"), analog "% similarity" (regime resemblance, not a probability),
 * vote counts ("3 of 5 independent votes"), z-scores and other non-probability numbers.
 */

/** What the model is told in place of any scenario or probability value. */
export const PLATO_SCENARIO_WITHHELD = "Uncalibrated";

const W = PLATO_SCENARIO_WITHHELD;
const NUM = String.raw`\d+(?:\.\d+)?`;
/** A percent: "60%", "60 %", "60 percent", "60 per cent", "60 pct". */
const PCT = String.raw`${NUM}\s*(?:%|percent\b|per\s+cent\b|pct\b)`;
/** A probability written as a decimal or unit fraction: "0.6", ".03", "0.0036", "1.0". */
const DECIMAL = String.raw`(?:0?\.\d+|1\.0+)(?![\d%])`;
const NUMBER_WORDS = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|a hundred|hundred|a thousand|thousand)`;
const COUNT = String.raw`(?:\d+|${NUMBER_WORDS})`;
/** Odds: "1 in 4", "one-in-five". */
const ODDS = String.raw`\b${COUNT}(?:\s+|-)in(?:\s+|-)${COUNT}\b`;
/** A fraction: "1/5". Only withheld next to a probability word, so "33/100" alone is kept. */
const FRACTION = String.raw`\b\d+\s*\/\s*\d+\b`;
const PROBABILITY_WORDS = String.raw`(?:historical frequency|frequency|probability|probabilities|chance|chances|likelihood|odds|confidence)`;
const SCENARIO_WORDS = String.raw`(?:bull(?:ish)?|bear(?:ish)?|neutral|crash|recession|soft[- ]landing|stagflation|stress|remain(?:ing)? in regime|transition(?: to \w+)?)`;
/** "=", ":", "~" with or without spaces, and "of", "at", "is", "near", ... */
const CONNECTORS = String.raw`(?:\s*(?:[:=~]|(?:of|at|is|was|near|around|about|roughly|approximately)\b))*\s*`;
/**
 * At most one word between a scenario/probability word and its number ("Bull case 53%", "crash
 * risk 2%"). Words that name an observed series are excluded, so "neutral rate 2.5%" is kept.
 */
const GAP = String.raw`(?:\s+(?!(?:rate|rates|yield|yields|spread|spreads|index|level|levels|score|scores|inflation|cpi|unemployment|real|z)\b)[a-z][a-z-]*)?`;
/** Frequency phrasing that is a probability: "60% of the time", "40% of cases". */
const FREQUENCY_TAIL = String.raw`\s+of\s+(?:the\s+)?(?:time|cases|outcomes|scenarios|occasions|instances)\b`;

const RULES: Array<[RegExp, string]> = [
  // "(60% historical frequency)", "(25 percent probability)", or a bare "(60%)"
  [new RegExp(String.raw`\(\s*${PCT}(?:\s*${PROBABILITY_WORDS}[^)]*)?\s*\)`, "gi"), `(${W})`],
  // "60% historical frequency", "60%historical frequency", "2.5 % probability", "30 percent chance"
  [new RegExp(String.raw`${PCT}\s*(${PROBABILITY_WORDS})`, "gi"), `${W} $1`],
  // "60% of the time", "40 percent of cases"
  [new RegExp(String.raw`${PCT}(${FREQUENCY_TAIL})`, "gi"), `${W}$1`],
  // "1 in 4 chance", "one-in-five odds", "1/5 chance"
  [new RegExp(String.raw`(?:${ODDS}|${FRACTION})(\s*${PROBABILITY_WORDS})`, "gi"), `${W}$1`],
  // "probability of 60%", "confidence: 41%", "probability=0.64", "odds near 20 percent",
  // "chance of 1 in 4", "chance of 1/5", "crash probability: .03", "probability estimate 0.6"
  [new RegExp(String.raw`(${PROBABILITY_WORDS}${GAP})(${CONNECTORS})(?:${PCT}|${ODDS}|${FRACTION}|${DECIMAL})`, "gi"), `$1$2${W}`],
  // "bull 53%", "Bull case 53%", "crash risk 2%", "stress: 20%", "remain in regime 60%", "recession 0.04"
  [new RegExp(String.raw`(\b${SCENARIO_WORDS}\b${GAP})(${CONNECTORS})(?:${PCT}|${DECIMAL})`, "gi"), `$1$2${W}`],
  // "53% bull", "60 percent remain in regime"
  [new RegExp(String.raw`${PCT}(\s+${SCENARIO_WORDS}\b)`, "gi"), `${W}$1`],
];

export function withholdScenarioPercents(text: string): string {
  return RULES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** Object keys whose numeric value is a scenario/probability/confidence figure. */
const PROBABILITY_KEY = /(probabilit|confidence|likelihood|odds)|^(bull|bear|neutral|crash|softLanding|stagflation|recession|remainInRegime|transitionTo\w+)$/i;

/** Only the probability contract's explicit AVAILABLE status lets a number through. */
function hasExplicitAvailableStatus(container: Record<string, unknown>): boolean {
  return container.state === "AVAILABLE";
}

/**
 * Applies withholdScenarioPercents to every string in a model-bound value, and replaces every
 * numeric probability field (crisisProbability, regimeConfidence, bull, remainInRegime, ...) with
 * the withheld status, unless its own object carries the contract's explicit AVAILABLE status.
 * Other numbers (scores, z-scores, similarity, counts) are untouched.
 */
export function withholdScenarioPercentsDeep<T>(value: T): T {
  if (typeof value === "string") return withholdScenarioPercents(value) as T;
  if (Array.isArray(value)) return value.map(entry => withholdScenarioPercentsDeep(entry)) as T;
  if (value && typeof value === "object") {
    const container = value as Record<string, unknown>;
    const available = hasExplicitAvailableStatus(container);
    return Object.fromEntries(Object.entries(container).map(([key, entry]) => [
      key,
      typeof entry === "number" && PROBABILITY_KEY.test(key) && !available ? W : withholdScenarioPercentsDeep(entry),
    ])) as T;
  }
  return value;
}
