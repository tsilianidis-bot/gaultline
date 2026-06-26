/**
 * FAULTLINE Method™ — Proprietary Glossary
 *
 * Every term carries:
 *   definition     — plain-English explanation
 *   whyItMatters   — why investors should care
 *   triggeredBy    — what market conditions activate it
 *   watchNext      — what to monitor after this appears
 *   category       — grouping for the Glossary page
 *   relatedTerms   — IDs of related glossary entries
 */

export interface GlossaryTerm {
  id: string;
  term: string;
  badge?: string;          // e.g. "™" or "S.O.B.™"
  definition: string;
  whyItMatters: string;
  triggeredBy: string;
  watchNext: string;
  category: "regime" | "pressure" | "signal" | "risk" | "method";
  relatedTerms?: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  // ── METHOD ────────────────────────────────────────────────────────────────
  {
    id: "faultline-method",
    term: "The FAULTLINE Method™",
    badge: "™",
    definition:
      "A systematic approach to market navigation that continuously monitors multiple dimensions of market conditions — macro, technical, sentiment, and liquidity — and translates complex signals into clear, actionable awareness.",
    whyItMatters:
      "Markets move through changing regimes. Reacting to headlines or emotions leads to poor decisions. The FAULTLINE Method provides a structured framework so you always know what is changing, why it matters, and what deserves attention next.",
    triggeredBy:
      "Active whenever you are using FAULTLINE. The Method is the lens through which all data is interpreted.",
    watchNext:
      "Follow the three-step principle: Understand the current regime. Adapt your awareness to changing conditions. Navigate with greater confidence.",
    category: "method",
    relatedTerms: ["regime-shift", "sob", "building-pressure"],
  },
  {
    id: "understand-adapt-navigate",
    term: "Understand. Adapt. Navigate.",
    definition:
      "The three-step operating principle of the FAULTLINE Method™. Understand the current market regime. Adapt your awareness as conditions evolve. Navigate with greater confidence regardless of direction.",
    whyItMatters:
      "Markets do not move in straight lines. Investors who understand the current environment — rather than assuming it will continue — are better positioned to make informed decisions in any regime.",
    triggeredBy:
      "This principle is always active. It is the foundation of every FAULTLINE signal, score, and analysis.",
    watchNext:
      "Check the Regime Dashboard and S.O.B.™ panel regularly to stay aligned with the current environment.",
    category: "method",
    relatedTerms: ["faultline-method", "regime-shift"],
  },

  // ── REGIME ────────────────────────────────────────────────────────────────
  {
    id: "regime-shift",
    term: "Regime Shift",
    definition:
      "A meaningful change in the dominant market environment — for example, a transition from a risk-on growth regime to a defensive or contraction regime — that alters the behavior of most asset classes.",
    whyItMatters:
      "Strategies that work in one regime often fail in another. Identifying a Regime Shift early allows investors to re-evaluate positioning before the broader market reprices.",
    triggeredBy:
      "Triggered when multiple macro indicators — yield curve, credit spreads, breadth, and momentum — simultaneously shift direction, signaling a change in the underlying market structure.",
    watchNext:
      "Monitor the Pressure Index, credit spreads, and sector rotation patterns. A confirmed Regime Shift typically takes 2–6 weeks to fully materialize across asset classes.",
    category: "regime",
    relatedTerms: ["faultline-forming", "changing-tide", "sob"],
  },
  {
    id: "changing-tide",
    term: "Changing Tide",
    definition:
      "An early-stage signal that market conditions are beginning to shift direction — not yet a confirmed Regime Shift, but a meaningful change in the balance of forces.",
    whyItMatters:
      "Catching a Changing Tide early provides the most time to adjust awareness and positioning before the shift becomes obvious to the broader market.",
    triggeredBy:
      "Triggered when 2–3 leading indicators diverge from the prevailing trend, such as credit spreads widening while equities remain elevated, or breadth deteriorating while indices hold highs.",
    watchNext:
      "Watch for confirmation from a second wave of indicators. A Changing Tide that is confirmed by credit, breadth, and momentum becomes a Regime Shift.",
    category: "regime",
    relatedTerms: ["regime-shift", "faultline-forming", "leadership-narrowing"],
  },
  {
    id: "faultline-forming",
    term: "Faultline Forming",
    definition:
      "A condition where stress is accumulating beneath the surface of apparent market stability — similar to geological fault lines that build pressure invisibly before a sudden release.",
    whyItMatters:
      "Markets can appear calm while underlying stress builds. A Faultline Forming signal warns that the apparent stability may be fragile and that a sudden repricing is possible.",
    triggeredBy:
      "Triggered when the Pressure Index is elevated but price action has not yet reflected the stress — a divergence between fundamental conditions and market pricing.",
    watchNext:
      "Watch for a catalyst that could release the built-up pressure: earnings misses, macro data surprises, credit events, or policy changes.",
    category: "regime",
    relatedTerms: ["sob", "building-pressure", "regime-shift"],
  },

  // ── PRESSURE ──────────────────────────────────────────────────────────────
  {
    id: "sob",
    term: "S.O.B.™",
    badge: "S.O.B.™",
    definition:
      "Signals of Breakdown — FAULTLINE's proprietary framework for measuring the accumulation of market stress across multiple independent pillars. S.O.B. is NOT a crash prediction system. It measures how many independent stress signals are active simultaneously.",
    whyItMatters:
      "One signal means awareness. Multiple simultaneous signals indicate that conditions are evolving in a way that historically precedes increased market volatility or regime change. The more pillars active, the more attention is warranted.",
    triggeredBy:
      "Each S.O.B. pillar is triggered independently: credit spread widening, yield curve inversion, breadth deterioration, liquidity tightening, momentum breakdown, and volatility expansion. The S.O.B. level reflects how many pillars are simultaneously active.",
    watchNext:
      "When S.O.B. is elevated, monitor the specific active pillars for resolution or escalation. Watch for new pillars activating, which would increase the overall S.O.B. level.",
    category: "pressure",
    relatedTerms: ["building-pressure", "faultline-forming", "credit-stress-rising", "liquidity-tightening"],
  },
  {
    id: "building-pressure",
    term: "Building Pressure",
    definition:
      "A condition where the FAULTLINE Pressure Index is rising, indicating that stress is accumulating across multiple market dimensions — even if price action has not yet reflected it.",
    whyItMatters:
      "Pressure builds before it releases. Identifying Building Pressure early provides time to understand the environment before it becomes a crisis.",
    triggeredBy:
      "Triggered when the Pressure Index trend is upward across two or more consecutive readings, driven by deteriorating conditions in credit, breadth, or macro indicators.",
    watchNext:
      "Watch for the Pressure Index to cross key thresholds (40, 60, 80). Each threshold historically corresponds to a different level of market stress and behavioral change.",
    category: "pressure",
    relatedTerms: ["sob", "faultline-forming", "credit-stress-rising"],
  },
  {
    id: "credit-stress-rising",
    term: "Credit Stress Rising",
    definition:
      "A condition where credit spreads — the difference in yield between corporate bonds and risk-free Treasuries — are widening, indicating that lenders are demanding higher compensation for risk.",
    whyItMatters:
      "Credit markets often lead equity markets. When credit stress rises, it signals that the financial system is pricing in higher risk of defaults or economic deterioration — often before stock prices reflect it.",
    triggeredBy:
      "Triggered when investment-grade or high-yield credit spreads widen by a meaningful percentage from recent lows, or when the rate of widening accelerates.",
    watchNext:
      "Watch for credit spreads to stabilize or tighten as a sign of stress resolution. Continued widening alongside equity market weakness confirms a deteriorating environment.",
    category: "pressure",
    relatedTerms: ["sob", "liquidity-tightening", "building-pressure"],
  },
  {
    id: "liquidity-tightening",
    term: "Liquidity Tightening",
    definition:
      "A condition where the availability of money flowing through financial markets is contracting — making it harder and more expensive for businesses, investors, and institutions to access capital.",
    whyItMatters:
      "Liquidity is the lifeblood of markets. When liquidity tightens, asset prices often fall as sellers outnumber buyers and leverage becomes expensive. It amplifies volatility and can turn orderly declines into sharp corrections.",
    triggeredBy:
      "Triggered by Federal Reserve rate hikes, quantitative tightening (balance sheet reduction), rising interbank lending rates, or a reduction in money supply growth.",
    watchNext:
      "Watch for Fed policy signals, Treasury yield movements, and repo market conditions. A pivot toward easier policy typically signals liquidity conditions are improving.",
    category: "pressure",
    relatedTerms: ["credit-stress-rising", "sob", "building-pressure"],
  },

  // ── SIGNAL ────────────────────────────────────────────────────────────────
  {
    id: "leadership-narrowing",
    term: "Leadership Narrowing",
    definition:
      "A condition where market gains are increasingly concentrated in a shrinking number of stocks or sectors, while the majority of the market stagnates or declines.",
    whyItMatters:
      "Broad, healthy bull markets are supported by wide participation. When leadership narrows, the index can appear strong while the underlying market weakens — a classic warning sign that the rally may be fragile.",
    triggeredBy:
      "Triggered when the percentage of stocks above their 200-day moving average falls while major indices remain near highs, or when sector breadth deteriorates outside of a few mega-cap names.",
    watchNext:
      "Watch for the narrow leaders to also begin declining. When the last holdouts break down, the index typically follows quickly.",
    category: "signal",
    relatedTerms: ["changing-tide", "regime-shift", "sob"],
  },
  {
    id: "recovery-signal",
    term: "Recovery Signal",
    definition:
      "An early indication that market conditions are improving after a period of stress or contraction — not a guarantee of recovery, but a meaningful shift in the balance of evidence.",
    whyItMatters:
      "Recovery Signals appear before the broader market confirms a new uptrend. Identifying them early allows investors to adjust awareness before prices fully reflect the improving conditions.",
    triggeredBy:
      "Triggered when multiple stress indicators simultaneously improve: credit spreads tighten, breadth expands, momentum turns positive, and the Pressure Index begins declining from elevated levels.",
    watchNext:
      "Watch for the Recovery Signal to be confirmed by sustained breadth expansion and credit spread tightening. A single session of improvement is not confirmation.",
    category: "signal",
    relatedTerms: ["regime-shift", "changing-tide", "opportunity-zone"],
  },
  {
    id: "opportunity-zone",
    term: "Opportunity Zone",
    definition:
      "A market condition identified by FAULTLINE where the combination of regime, pressure, and signal factors suggests that risk/reward conditions are more favorable than average for a specific asset class or sector.",
    whyItMatters:
      "Not all market environments offer equal opportunity. An Opportunity Zone does not guarantee returns — it indicates that conditions are aligned in a way that historically has been more favorable for the identified asset class.",
    triggeredBy:
      "Triggered when regime conditions are supportive, pressure is low or declining, and momentum signals are positive for a specific sector or asset class.",
    watchNext:
      "Monitor the conditions that triggered the Opportunity Zone. If regime or pressure conditions deteriorate, the zone may close quickly.",
    category: "signal",
    relatedTerms: ["recovery-signal", "regime-shift", "understand-adapt-navigate"],
  },
];

/** Look up a single term by ID */
export function getGlossaryTerm(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.id === id);
}

/** Look up terms by category */
export function getGlossaryByCategory(category: GlossaryTerm["category"]): GlossaryTerm[] {
  return GLOSSARY.filter((t) => t.category === category);
}

/** All categories in display order */
export const GLOSSARY_CATEGORIES: { id: GlossaryTerm["category"]; label: string }[] = [
  { id: "method",   label: "The FAULTLINE Method™" },
  { id: "regime",   label: "Regime Conditions" },
  { id: "pressure", label: "Pressure & Stress" },
  { id: "signal",   label: "Market Signals" },
  { id: "risk",     label: "Risk Indicators" },
];
