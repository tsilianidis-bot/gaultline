/**
 * Full technical inventory and disclosures for the public methodology page.
 *
 * This content was moved verbatim from the landing page (MarketingSite.tsx)
 * so the landing page can carry concise summaries while every disclosure
 * stays public. Do not delete an entry without moving it elsewhere; the
 * landing-disclosure tests assert that these are rendered on /methodology.
 */

export const pipeline = [
  ["Raw data", "Latest FRED observations, Polygon daily equity aggregates, Yahoo quotes, and CoinGecko crypto statistics."],
  ["Signals", "Equity labels from the symbol classifier, and crypto labels from the crypto intelligence engine."],
  ["Cross-market relationships", "Stock-regime versus crypto-regime alignment, plus vectors that combine credit, rates, liquidity, and macro inputs."],
  ["Systemic-risk analysis", "A six-vector pressure composite. A separate two-state regime model reads credit, rates, volatility, liquidity, and equity features and does not change the index."],
  ["Regime detection", "Pressure bands, equity-regime labels from SPY trend plus the index, and crypto cycle regimes."],
  ["Faultline Pressure Index™", "A 0–100 weighted composite of the six vector scores."],
  ["PLATO", "The interpretation layer. PLATO market explanation reads the measurements and says what they mean."],
  ["Intelligence", "Recorded seismograph readings, the daily brief generator, and the public brief archive."],
] as const;

export const stack = [
  {
    label: "Core risk engine",
    items: [
      ["Faultline Pressure Index™", "0–100 weighted composite of the six live vectors."],
      ["Six stress vectors", "High-yield OAS with SOFR; high-yield OAS with the 10-year and unemployment; the 10-year minus 2-year curve with the 10-year level; CPI, PPI, and federal funds; unemployment with the 10-year; and a fixed 32.4% concentration baseline adjusted by the 10-year and the high-yield spread. Internal ids still read volatility-regime, market-breadth, and ai-bubble; the display labels are Yield Curve (10Y–2Y) & 10Y Level, Labor & Rates, and AI / Speculation (Static Baseline). Those names are not extra measurements."],
      ["Risk regime bands", "Low, Moderate, Elevated, High Stress, and Systemic Crisis, from fixed score thresholds."],
      ["Systemic Regime Engine", "Two-state Gaussian HMM on a PCA factor. Model sre-hmm2-v1.0.0. It does not feed the Pressure Index."],
      ["Signal convergence", "An n-of-m vote across independent engines, not an average."],
    ],
  },
  {
    label: "Macro intelligence",
    items: [
      ["Yield curve", "10-year minus 2-year from FRED DGS10 and DGS2. T10Y2Y is also a systemic-regime feature."],
      ["Interest-rate conditions", "Federal funds, SOFR, and Treasury yields."],
      ["Inflation", "CPI and PPI, year-over-year from monthly FRED levels. Publication lag applies."],
      ["Unemployment", "FRED UNRATE. Monthly, with publication lag. This is the labor input."],
      ["Financial conditions", "NFCI and the St. Louis Fed Financial Stress Index are weekly features in the systemic-regime model."],
    ],
  },
  {
    label: "Credit intelligence",
    items: [
      ["High-yield credit", "ICE BofA US High Yield OAS, FRED BAMLH0A0HYM2, inside the pressure composite."],
      ["Investment-grade credit", "ICE BofA US Corporate OAS, FRED BAMLC0A0CM, in the systemic-regime feature set only."],
      ["Credit and rates together", "The credit-contagion vector blends the high-yield spread, the 10-year yield, and unemployment."],
    ],
  },
  {
    label: "Equity and market structure",
    items: [
      ["Equity market regimes", "Eight labels from the Pressure Index plus SPY trend on Polygon daily bars."],
      ["Symbol intelligence", "Regime-aware signal labels for individual tickers."],
      ["Aftershock map", "A static contagion graph rescored with price, volume, volatility, and pressure context."],
      ["Index context", "S&P 500 return, 21-day realized volatility, and 252-day drawdown are systemic-regime features."],
      ["Quoted boards", "Major equity indexes via Yahoo. Not a substitute for the pressure score."],
    ],
  },
  {
    label: "Rates and fixed income",
    items: [
      ["Treasury yields", "2-year, 10-year, and, on the markets board, 30-year constant-maturity rates from FRED."],
      ["Curve inversion and steepening", "Threshold bands on the 10-year minus 2-year spread inside the yield-curve vector."],
      ["Curve on the markets board", "A derived 2-year/10-year spread in basis points."],
    ],
  },
  {
    label: "Crypto intelligence",
    items: [
      ["Bitcoin and Ethereum", "Asset reads from CoinGecko, joined to the macro pressure score."],
      ["Crypto market regimes", "Cycle labels derived from the crypto intelligence report."],
      ["Crypto volatility", "24-hour range across the top markets returned by CoinGecko."],
      ["Crypto and macro", "The crypto systemic score includes the Pressure Index. Cross-market alignment compares crypto regime with the equity regime."],
      ["Dominance and market cap", "CoinGecko global statistics, including Bitcoin dominance."],
    ],
  },
  {
    label: "Historical intelligence",
    items: [
      ["Historical analog engine", "Euclidean similarity between the current vector profile and a fixed fingerprint library."],
      ["Pressure Index library", "2000, 2008, 2020, 2022, 1998, and 1973."],
      ["Extended FMOS library", "Adds 2015, 2011, 2019, and 2023. Similarity is still not an outcome."],
      ["Research stress windows", "Labeled intervals for systemic-regime validation only. They are not used to fit the model."],
    ],
  },
  {
    label: "Interpretation",
    items: [
      ["PLATO", "The customer-facing interpretation layer. FAULTLINE measures. PLATO explains."],
      ["Daily intelligence brief", "Generated from an engine snapshot. A public archive is published at /daily-brief."],
      ["Seismograph record", "Stores pressure readings and looks for recurring patterns in that record."],
      ["Cross-market synthesis", "Plain-language alignment or divergence between the equity regime and the crypto regime."],
      ["Situation Room", "An in-app portfolio-level review beside trade preflight. It is not part of the public Pressure Index, and this page does not link into the signed-in app."],
    ],
  },
] as const;

export const futureItems = [
  "GDP and other BEA growth accounts. No BEA client is wired into the engines.",
  "Jobless claims. Unemployment is the labor series that is actually read.",
  "Lending-standards or bank loan-officer surveys.",
  "Money supply as a pressure-index input. M2 appears in unused client metadata, not in the live composite.",
  "Direct BLS, BEA, or Treasury.gov clients. Those statistics are read only where FRED republishes them.",
  "Advance/decline market breadth. The Labor & Rates vector (formerly labelled Market Breadth) uses unemployment and the 10-year yield.",
  "A live market-cap concentration feed. The AI vector uses a static 32.4% baseline.",
  "Duration stress as its own model.",
  "A named credit/liquidity divergence module.",
  "Leadership analysis as its own model.",
  "A 2024–2025 analog period. It is not in the fingerprint library.",
  "A point-in-time backtest that replays raw inputs through the live formulas. The audit utility marks raw recreation as not defensible.",
  "Calibrated crash probabilities. Scenario scores elsewhere in the stack are arithmetic, not a fitted forecast.",
];

export const experiences = [
  {
    name: "Faultline Pressure Index™",
    href: "/pressure-index",
    what: "A single 0–100 reading of systemic pressure.",
    analyzes: "High-yield spreads, SOFR, the Treasury curve, CPI, PPI, federal funds, and unemployment, plus a static concentration baseline.",
    matters: "It is the shared starting number for the equity regime, the crypto macro link, and the interpretation layer.",
  },
  {
    name: "Seismograph",
    href: null,
    what: "A record of pressure readings over time.",
    analyzes: "The stored score, regime, direction, and patterns in that history.",
    matters: "A level means more next to the path that produced it. Pattern counts are historical descriptions, not guarantees.",
  },
  {
    name: "Stock signals",
    href: null,
    what: "Symbol intelligence for individual equities.",
    analyzes: "Ticker context classified into regime-aware labels such as momentum, rate sensitivity, and macro vulnerability. Prices come from Polygon daily aggregates and Yahoo quotes.",
    matters: "A label says how a name sits in the current macro read. It is not an instruction to trade.",
  },
  {
    name: "Crypto intelligence",
    href: null,
    what: "Bitcoin, Ethereum, and a market-wide crypto stress score.",
    analyzes: "CoinGecko prices, dominance, 24-hour ranges, and the Pressure Index.",
    matters: "Crypto is treated as part of the same risk system, not as a separate dashboard.",
  },
  {
    name: "Historical analog engine",
    href: "/#analogs",
    what: "A comparison of today’s vector profile with a fixed library of past periods.",
    analyzes: "Distance between current liquidity, credit, macro, and concentration scores and the stored fingerprints.",
    matters: "Similarity describes resemblance. It does not mean the same path will follow.",
  },
  {
    name: "Daily intelligence brief",
    href: "/daily-brief",
    what: "A written brief from the engine snapshot, plus a public archive.",
    analyzes: "Pressure, regime, and the inputs assembled for that brief.",
    matters: "It is the narrative layer of the same measurements, not a second source of truth.",
  },
  {
    name: "PLATO",
    href: "/#plato",
    what: "The interpretation layer of FAULTLINE.",
    analyzes: "Persisted engine output, including the pressure read and, when present, the systemic-regime contract.",
    matters: "PLATO can explain a measurement. It cannot replace one.",
  },
] as const;


export const weights = [
  ["High-yield OAS and SOFR", "20%", "Engine label: Liquidity Stress. A blend of the high-yield spread and SOFR, not an order-book liquidity measure."],
  ["High-yield OAS, 10-year, unemployment", "20%", "Engine label: Credit Contagion Risk. That blend only. Not a map of credit moving across named sectors."],
  ["10-year minus 2-year, plus the 10-year", "15%", "Label: Yield Curve (10Y–2Y) & 10Y Level (formerly Volatility Regime). Curve bands blended with the 10-year level. Not VIX and not realized volatility."],
  ["CPI, PPI, and federal funds", "20%", "Engine label: Macro Sensitivity. CPI and PPI are year-over-year. Monthly series are lagged."],
  ["Unemployment and the 10-year", "10%", "Label: Labor & Rates (formerly Market Breadth). Not advance/decline and not exchange breadth."],
  ["Static 32.4% baseline", "15%", "Label: AI / Speculation (Static Baseline). The 32.4% figure is a fixed reference value, then adjusted by the 10-year yield and the high-yield spread. Not a live market-cap feed."],
];

export const sources = [
  ["Federal Reserve / FRED", "Primary economic and financial series", "High-yield and investment-grade OAS, Treasury constant-maturity yields, T10Y2Y, SOFR, federal funds, CPI, PPI, unemployment, VIX close, S&P 500, NFCI, and the St. Louis Fed Financial Stress Index.", "Daily series are the latest published observation, typically the prior business day. CPI, PPI, unemployment, and federal funds are monthly and lagged. NFCI and the financial-stress index are weekly. Nothing here is a tick feed."],
  ["Polygon", "Market-data provider", "Grouped daily equity aggregates used for signals and for SPY trend in the equity-regime engine.", "Daily bars, including the previous session. This path is not a tick feed."],
  ["Yahoo quotes", "Market-data provider", "Index, volatility, FX, commodity, Bitcoin, and Ethereum quotes on the markets board, and a second quote path for signals.", "Snapshot quotes. Session state is carried on the quote. Treat them as a board, not as the pressure calculation."],
  ["CoinGecko", "Market-data provider", "Coin prices, global market cap, Bitcoin dominance, and 24-hour ranges for crypto intelligence.", "Cached in the crypto engine (about 90 seconds for an asset, about 3 minutes for the systemic crypto score). Not an on-exchange matching engine."],
];

export const analogs = [
  ["2000", "Dot-Com Bubble", "Pressure Index library and FMOS library"],
  ["1973", "1970s Stagflation", "Pressure Index library and FMOS library"],
  ["1998", "LTCM / Russia Crisis", "Pressure Index library and FMOS library"],
  ["2008", "Global Financial Crisis", "Pressure Index library and FMOS library"],
  ["2011", "European Debt Crisis", "FMOS library"],
  ["2015", "China Shock / EM Crisis", "FMOS library"],
  ["2019", "Fed Pivot Rally", "FMOS library"],
  ["2020", "COVID Shock", "Pressure Index library and FMOS library"],
  ["2022", "Rates Shock", "Pressure Index library and FMOS library"],
  ["2023", "Soft Landing Rally", "FMOS library"],
];

export const researchWindows = [
  ["2007-07-01 to 2009-03-31", "Global Financial Crisis"],
  ["2011-07-01 to 2012-06-30", "Euro area sovereign stress"],
  ["2015-08-01 to 2016-02-29", "Taper / EM stress"],
  ["2018-10-01 to 2018-12-31", "Q4 2018 drawdown"],
  ["2020-02-20 to 2020-04-30", "COVID liquidity shock"],
  ["2022-01-03 to 2022-10-31", "2022 hiking / inflation shock"],
];



export const faqs = [
  ["Is FAULTLINE investment advice?", "No. FAULTLINE is an analytical framework and an educational record of how that framework reads public data. It is not a recommendation to buy or sell any security, and it does not know your circumstances."],
  ["What does a high Pressure Index mean?", "More of the monitored inputs are in stressed ranges together. High pressure does not mean a crash is imminent. Low pressure does not mean risk is absent."],
  ["Does similarity to a past period mean the same outcome?", "No. The analog engine measures distance between fingerprints. Markets can diverge from any historical resemblance."],
];

export const crossMarket = {
  intro:
    "The cross-market engine compares the equity regime with the crypto regime. Its statuses are strongly aligned risk-on, aligned risk-on, aligned risk-off, strongly aligned risk-off, diverging with stocks leading, diverging with crypto leading, diverging with conflicting signals, or neutral. Separately, the pressure composite scores high-yield credit, SOFR, the Treasury curve, inflation, federal funds, and unemployment together.",
  regimes:
    "Equity labels are Bull Market, Expansion, Consolidation, Correction, Distribution, Bear Market, Recovery, and Recession Risk. Crypto labels are Bull Market, Expansion, Late Bull / Euphoria, Distribution, Bear Market, Capitulation, Bear Market → Accumulation Phase, Accumulation, and Early Recovery. Alignment compares those two reads.",
  quotedVsScored:
    "The markets board quotes equity indexes, VIX, the dollar, EUR/USD, USD/JPY, GBP/USD, gold, silver, WTI, Brent, natural gas, Bitcoin, and Ethereum. Those quotes are context. The Pressure Index does not take a weight from FX, commodities, or VIX. VIX enters the separate systemic-regime model as a daily close. Inside the composite, the Yield Curve (10Y–2Y) & 10Y Level vector (internal id volatility-regime, formerly labelled Volatility Regime) is the 10-year minus 2-year curve plus the 10-year level.",
} as const;

export const methodologyNotes = {
  version:
    "There is no single published methodology version for this page. The live index uses fixed weights of 20%, 20%, 15%, 20%, 10%, and 15%. An audit-only module records that same contract as Champion V1, label v1-observed-2026-08-18, and does not score the live index. FMOS pipeline version is 1.0.0. The separate systemic-regime model is sre-hmm2-v1.0.0.",
  coverage:
    "The live index uses the latest valid observation of each series it requests, and about thirteen months of CPI and PPI to form year-over-year changes. No verified point-in-time backtest window is published. The systemic-regime worker requests up to 10,000 observations on its long daily series.",
  normalization: [
    "Most inputs are linearly mapped from a calm reference range to a stressed reference range and clamped to the score bounds. The curve vector uses threshold bands: deeply inverted, inverted, slightly inverted, flat, and steeper. That band is then blended with the level of the 10-year yield.",
    "The index is the rounded weighted sum of the six vector scores. Weights sum to 1 and are fixed in the engine. They are not refit on each run.",
  ],
  regimes:
    "The composite maps to the five Pressure Index bands. Equity regime detection adds SPY trend to that score. Crypto regime detection uses the crypto report. The systemic-regime HMM is a second opinion on a broader FRED panel, and the code forbids adding it into the pressure weights.",
  historicalAnalysis:
    "Analog matching ranks the fingerprint library by Euclidean similarity. Narrative outcomes stored next to those fingerprints are descriptions attached to the library. They are not computed drawdowns from a price study inside the analog function.",
  inventory:
    "The intelligence stack is the methodology inventory: pressure vectors, systemic-regime features, equity and crypto regimes, symbol labels, the aftershock graph, analogs, the seismograph record, the daily brief, and PLATO. Items under Future Intelligence are outside this methodology.",
} as const;

export const analogMethod =
  "Similarity is one minus the normalized Euclidean distance between the current vector scores and a stored fingerprint. A closer fingerprint ranks higher. The library was written as a set of reference profiles. It is not a claim that FAULTLINE issued a live warning in those years, and resemblance is not a prediction.";

export const NOT_LIVE_WARNINGS_LABEL = "NOT A RETROSPECTIVE RECONSTRUCTION OF LIVE WARNINGS";

export const sourcesIntro =
  "FRED is the primary government and financial-statistics path. Polygon, Yahoo, and CoinGecko are market-data providers. FAULTLINE does not call BLS, BEA, or Treasury.gov directly. CPI, unemployment, and Treasury yields are used where FRED republishes them.";

export const validationParagraphs = [
  "The analog engine does not replay history. It compares today’s scores with hand-specified fingerprints for the periods in the analog table. An elevated similarity means the current mix of vector scores is nearer to that fingerprint than to the others. It does not mean the later market path will match the text stored beside the fingerprint.",
  "An audit utility can recompute the weighted composite from stored monthly vector scores. It refuses to call that a raw-input backtest: legacy months do not carry SOFR, PPI, or source vintages. The code marks that case raw recreation not defensible. This page does not claim a 25-year backtest and does not claim the index predicted any crisis.",
  "The systemic-regime research file labels these stress windows for validation metrics only. The same file says the windows are not current product truth and are never used to fit the HMM.",
] as const;

export const validationClosing =
  "Past resemblance does not guarantee future outcomes. In the pressure engine, 45–64 is Elevated Risk, 65–79 is High Stress, and 80–100 is Systemic Crisis.";

export const limitations = [
  "FAULTLINE is an analytical framework. It does not guarantee outcomes.",
  "High pressure does not mean an immediate crash. Low pressure does not mean risk is absent.",
  "Historical relationships can change. A fingerprint that resembled the past can stop resembling it.",
  "Economic series are revised. Monthly series arrive with a reporting lag. Daily FRED series are not intraday.",
  "The model can read stress when a break does not follow, and it can stay quiet when one does. Those are false positives and false negatives.",
  "The concentration input is a fixed 32.4% baseline, not a live market-cap feed. The Labor & Rates vector (formerly Market Breadth) is unemployment and the 10-year, not advance/decline. The Yield Curve vector (formerly Volatility Regime) is the 10-year minus 2-year curve and the 10-year level, not VIX.",
  "Nothing on this page is a solicitation or a personal recommendation.",
] as const;
