/**
 * Pentagonal Thesis™ copy for the landing page.
 *
 * Built on James's copy. Every product claim is matched to code; where the
 * code does not support a phrase, the wording was adjusted as little as
 * possible. The claim-by-claim evidence (file:line) is in the PR #42 body under
 * "Pentagonal Thesis claim verification".
 *
 * All of this copy renders as visible text. None of it sits behind a tooltip,
 * accordion, disclosure widget or hover state.
 */

export const THESIS_INTRO = {
  eyebrow: "THE PENTAGONAL THESIS™",
  heading: "Five questions. A clearer way to read the market.",
  body: "Market data tells you what moved. FAULTLINE connects the conditions, drivers, possible outcomes, and signals that matter—so you can make a more informed decision.",
} as const;

export const THESIS_CLOSING =
  "Each answer informs the next. Together, they form the Pentagonal Thesis™—FAULTLINE's framework for connecting market pressure to informed decisions.";

export const THESIS_SUPPORTING_NOTE =
  "Every answer reads the same shared market state, so the story does not change between screens. Development timelines and historical comparisons support all five. Neither is a forecast.";

export interface ThesisOption {
  name: string;
  tradeoff: string;
}

export interface ThesisQuestion {
  id: "happening" | "why" | "next" | "watch" | "do";
  /** Prominent heading. */
  question: string;
  /** Pentagon vertex label. */
  short: string;
  /** Short explanation shown under the heading. */
  tagline: string;
  /** Readable supporting text. */
  body: string;
  /** Concise mapping to features that exist in code. */
  shows: readonly string[];
  /** Decision options with their tradeoffs (What should I do? only). */
  options?: readonly ThesisOption[];
  /** Boundary note shown with the question. */
  note?: string;
}

export const THESIS_QUESTIONS: readonly ThesisQuestion[] = [
  {
    id: "happening",
    question: "What's happening?",
    short: "WHAT'S HAPPENING?",
    tagline: "Understand the market you're in.",
    body: "Is the market strengthening, weakening, or becoming more fragile beneath the surface? FAULTLINE brings market conditions and risk signals into one view, helping you see whether pressure is building even when headline prices look calm.",
    shows: [
      "Faultline Pressure Index™: a 0–100 composite of six weighted vectors built from FRED credit, funding, rates, inflation and labor series. No equity price feeds the score.",
      "The band and regime on the engine's scale, from LOW RISK to SYSTEMIC CRISIS, with the as-of time and the freshness of the inputs.",
      "Systemic regime: a separate two-state model (sre-hmm2) on a broader FRED panel. It does not feed the index.",
    ],
  },
  {
    id: "why",
    question: "Why?",
    short: "WHY?",
    tagline: "Understand what's driving it.",
    body: "A price move is only part of the story. Are liquidity, funding rates, interest rates, credit stress, inflation, or the labor market contributing to it? FAULTLINE explains the evidence behind the outlook, including where the explanation remains uncertain.",
    shows: [
      "Vector drivers: which inputs carry the reading, from high-yield spreads, SOFR and Fed Funds to the 10-year and 2-year yields, CPI, PPI and unemployment.",
      "Evidence families ranked by strength, with the evidence consensus behind the explanation.",
      "Uncertainty in view: evidence quality, coherence, stale or fallback inputs, and the conditions that would weaken the explanation.",
      "No dedicated positioning feed. Where positioning comes up, WHY labels liquidity and credit readings as proxies, not holdings.",
      "PLATO interpretation: a plain-language read of what those measurements mean together.",
    ],
  },
  {
    id: "next",
    question: "What's next?",
    short: "WHAT'S NEXT?",
    tagline: "Understand the possible paths ahead.",
    body: "What happens if current conditions continue—and what happens if they change? FAULTLINE lays out the scenario paths it tracks, the evidence that would move the base case, and what could weaken it.",
    shows: [
      "Scenario paths: bull continuation, soft landing, stagflation, recession, and crash or bear, with transition triggers and invalidation conditions. Scenario scores are arithmetic weightings of current evidence, not calibrated probabilities.",
      "Systemic-regime state probabilities from sre-hmm2: the model's probability for its current state and its chance of leaving it. They describe the model, not the odds of a crash.",
      "Regime transitions recorded in the seismograph history.",
      "Aftershock and contagion map: a fixed contagion graph between assets, rescored with price, volume, volatility, and pressure context.",
      "Development timelines and historical resemblance: whether a condition is emerging, developing, or fading, and which reference period today's profile most resembles.",
    ],
    note: "Probabilities appear only where a model produces them, with their limits beside them. Nothing here forecasts a specific crash or a date.",
  },
  {
    id: "watch",
    question: "What should I watch?",
    short: "WHAT TO WATCH?",
    tagline: "Know what would change the outlook.",
    body: "Which developments would confirm the current thesis, weaken it, or signal a turning point? FAULTLINE identifies the signals to monitor and explains why they matter, helping users separate changes that persist or approach a threshold from everyday noise.",
    shows: [
      "Threshold proximity: how close each domain sits to its alert threshold.",
      "Leading indicators, each with why it matters, and a list of what to monitor next.",
      "Confirmation and invalidation conditions, and how long each condition has been developing.",
      "Signal convergence: how many independent engines are deteriorating at the same time.",
      "Cross-market alignment between the equity and crypto regimes, your watchlist, and the daily intelligence brief.",
    ],
  },
  {
    id: "do",
    question: "What should I do?",
    short: "WHAT TO DO?",
    tagline: "Turn the outlook into a risk-aware decision.",
    body: "Does the evidence support maintaining exposure, keeping participation conditional, reducing risk, or waiting for confirmation? FAULTLINE rates common responses against the current posture and keeps the evidence, and its uncertainty, beside each one. It does not promise outcomes or give personalised instructions.",
    options: [
      { name: "Maintain exposure", tradeoff: "Stays with the current read. The risk is that the read is wrong, or pressure moves up a band." },
      { name: "Keep participation conditional", tradeoff: "Participates, with the condition that would end it written down first. It costs attention and can exit on a signal that reverses." },
      { name: "Reduce risk or add hedges", tradeoff: "Lowers exposure to a deterioration. It gives up upside if pressure eases, and hedges have a cost." },
      { name: "Wait for confirmation", tradeoff: "Avoids acting on thin or stale evidence. It can mean acting late." },
    ],
    shows: [
      "A bounded posture, DEFENSIVE, BALANCED or OPPORTUNISTIC, read from the shared state, with supporting and cautionary signals and what would force a rethink.",
      "A strategy matrix that rates increasing exposure, holding current risk, reducing exposure, adding hedges, seeking new positions and reviewing invalidations as favorable, conditional or avoid under each posture.",
      "When evidence is missing or stale, the posture is withheld instead of guessed.",
      "PLATO can walk through the posture and the evidence behind it.",
    ],
    note: "Not investment advice. FAULTLINE does not know your circumstances and does not give personalised recommendations, trade instructions, or position sizes.",
  },
];
