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
const PROBABILITY_WORDS = String.raw`(?:historical frequency|frequency|probability|probabilities|chance|chances|likelihood|odds|confidence)`;
const SCENARIO_WORDS = String.raw`(?:bull(?:ish)?|bear(?:ish)?|neutral|crash|recession|soft[- ]landing|stagflation|remain(?:ing)? in regime|transition(?: to \w+)?)`;
const CONNECTORS = String.raw`(?:(?:\s+(?:of|at|is|was|near|around|about|roughly|approximately|=|~))*\s*:?\s*)`;

const RULES: Array<[RegExp, string]> = [
  // "(60% historical frequency)", "(25 percent probability)", or a bare "(60%)"
  [new RegExp(String.raw`\(\s*${PCT}(?:\s*${PROBABILITY_WORDS}[^)]*)?\s*\)`, "gi"), `(${W})`],
  // "60% historical frequency", "60%historical frequency", "2.5 % probability", "30 percent chance"
  [new RegExp(String.raw`${PCT}\s*(${PROBABILITY_WORDS})`, "gi"), `${W} $1`],
  // "1 in 4 chance", "one-in-five odds"
  [new RegExp(String.raw`${ODDS}(\s+${PROBABILITY_WORDS})`, "gi"), `${W}$1`],
  // "probability of 60%", "confidence: 41%", "odds near 20 percent", "chance of 1 in 4"
  [new RegExp(String.raw`(${PROBABILITY_WORDS})(${CONNECTORS})(?:${PCT}|${ODDS})`, "gi"), `$1$2${W}`],
  // "probability of 0.6", "confidence 0.996", "crash probability: .03"
  [new RegExp(String.raw`(${PROBABILITY_WORDS})(${CONNECTORS})${DECIMAL}`, "gi"), `$1$2${W}`],
  // "bull 53%", "crash: 2 percent", "remain in regime 60%", "recession 0.04"
  [new RegExp(String.raw`(\b${SCENARIO_WORDS})(\s*[:=]?\s*)(?:${PCT}|${DECIMAL})`, "gi"), `$1$2${W}`],
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
