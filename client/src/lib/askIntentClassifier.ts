/**
 * FAULTLINE — Ask Intent Classifier
 * client/src/lib/askIntentClassifier.ts
 *
 * Classifies every Ask question into one of 12 modes BEFORE it reaches the backend.
 * This is the single source of truth for context management across all Ask entry points.
 *
 * Rules (in priority order):
 *  1. If the question explicitly mentions a NEW ticker → switch to that ticker
 *  2. If the question is clearly global/macro/portfolio → clear symbol context
 *  3. If the question is ambiguous and a symbol is active → keep symbol context
 *  4. If no symbol is active and question is ambiguous → treat as global
 */

export type AskMode =
  | "global"       // "What are the best investments right now?"
  | "macro"        // "How is the economy doing?" / "Fed rate impact"
  | "portfolio"    // "How is my portfolio doing?" / "Should I rebalance?"
  | "stock"        // "Should I buy NVDA?" / "How low could it fall?"
  | "crypto"       // "Best crypto opportunities?" / "Is BTC a buy?"
  | "etf"          // "What ETFs should I hold?" / "SPY vs QQQ"
  | "sector"       // "Which sectors look strongest?" / "Tech vs Energy"
  | "comparison"   // "NVDA vs AMD" / "Which is better?"
  | "watchlist"    // "What's on my watchlist doing?"
  | "trading"      // "Best swing trades?" / "Short-term setups"
  | "risk"         // "How dangerous is the market?" / "What's my downside?"
  | "economic";    // "Recession risk?" / "Inflation impact?"

export interface ClassifiedIntent {
  mode: AskMode;
  /** Resolved ticker to use — null means global/no-symbol context */
  resolvedTicker: string | null;
  /** If a new ticker was detected in the question text */
  detectedTicker: string | null;
  /** Whether the active symbol context should be cleared */
  shouldClearSymbol: boolean;
  /** Confidence 0–1 */
  confidence: number;
}

// ── Ticker detection ──────────────────────────────────────────────────────────
// Matches 1-5 uppercase letters that look like a ticker symbol.
// We require word boundaries and exclude common English words that happen to be
// all-caps in a sentence (I, A, OK, US, etc.) and common abbreviations.
const TICKER_REGEX = /\b([A-Z]{1,5})\b/g;

const COMMON_WORDS_NOT_TICKERS = new Set([
  "A", "I", "OK", "US", "EU", "UK", "AI", "ML", "IT", "HR", "PR", "CEO", "CFO",
  "CTO", "IPO", "ETF", "GDP", "CPI", "PPI", "PCE", "ISM", "PMI", "NFP", "FOMC",
  "FED", "SEC", "IMF", "WHO", "UN", "NATO", "G7", "G20", "OPEC", "BRICS",
  "USD", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "CHF", "MXN", "BRL",
  "YOY", "QOQ", "MOM", "YTD", "ATH", "ATL", "EPS", "PE", "PB", "ROE", "ROI",
  "EBITDA", "FCF", "DCF", "IRR", "NPV", "CAGR", "TAM", "SAM", "SOM",
  "AND", "OR", "NOT", "THE", "FOR", "ARE", "BUT", "CAN", "DO", "BE",
  "VS", "VIA", "RE", "EX", "NEW", "OLD", "TOP", "LOW", "HIGH", "BIG",
  "WHAT", "WHEN", "WHERE", "WHY", "HOW", "WHO", "WHICH", "WILL", "WOULD",
  "COULD", "SHOULD", "DOES", "DID", "HAS", "HAD", "WAS", "WERE", "IS",
  "ALL", "ANY", "SOME", "MOST", "BEST", "GOOD", "BAD", "NEXT", "LAST",
  "NOW", "SOON", "LONG", "SHORT", "BUY", "SELL", "HOLD", "WAIT", "RISK",
  "SAFE", "BULL", "BEAR", "RATE", "BOND", "GOLD", "OIL", "CASH", "DEBT",
  "TECH", "BANK", "REAL", "FUND", "PLAN", "IDEA", "MOVE", "PLAY", "TRADE",
  "CALL", "PUT", "STOP", "LOSS", "GAIN", "FALL", "RISE", "DROP", "JUMP",
  "STAY", "KEEP", "TAKE", "MAKE", "GIVE", "SHOW", "TELL", "LOOK", "FEEL",
  "MEAN", "KNOW", "THINK", "WANT", "NEED", "LIKE", "LOVE", "HATE", "FEAR",
  "HELP", "FIND", "PICK", "RANK", "LIST", "SORT", "FILTER", "SCAN",
  "FAULTLINE", "ASK", "ABOUT", "FROM", "INTO", "OVER", "UNDER", "ABOVE",
  "BELOW", "AFTER", "BEFORE", "SINCE", "UNTIL", "WHILE", "DURING",
  // Common English words that happen to be valid ticker symbols — never treat as tickers in NL context
  "RIGHT", "NOW", "HOT", "BEST", "MOST", "NEXT", "LAST", "SOON",
  "WELL", "JUST", "EVEN", "ALSO", "ONLY", "VERY", "MUCH", "MORE",
  "LESS", "SOME", "MANY", "BOTH", "EACH", "SUCH", "SAME", "ELSE",
  "THEN", "THAN", "THAT", "THIS", "THEY", "THEM", "THEIR", "THERE",
  "HERE", "HAVE", "WITH", "YOUR", "MINE", "OURS", "HERS", "THEM",
]);

// Well-known tickers to boost confidence in detection
const KNOWN_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA", "NFLX",
  "AMD", "INTC", "QCOM", "AVGO", "TXN", "MU", "AMAT", "LRCX", "KLAC",
  "JPM", "BAC", "GS", "MS", "WFC", "C", "USB", "PNC", "TFC", "COF",
  "JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "BMY", "AMGN", "GILD",
  "XOM", "CVX", "COP", "SLB", "EOG", "PXD", "OXY", "VLO", "PSX",
  "BRK", "V", "MA", "PYPL", "SQ", "COIN", "HOOD", "SOFI", "AFRM",
  "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "GLD", "SLV", "TLT", "HYG",
  "BTC", "ETH", "BNB", "SOL", "ADA", "XRP", "DOT", "AVAX", "MATIC",
  "LINK", "UNI", "AAVE", "CRV", "MKR", "COMP", "SNX", "YFI",
  "MSTR", "RIOT", "MARA", "HUT", "CLSK", "BTBT", "CIFR",
  "PLTR", "RBLX", "U", "SNAP", "PINS", "TWTR", "LYFT", "UBER",
  "SHOP", "ETSY", "EBAY", "AMZN", "WMT", "TGT", "COST", "HD", "LOW",
  "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR",
  "BA", "LMT", "RTX", "NOC", "GD", "L3H", "HII",
  "CAT", "DE", "MMM", "HON", "GE", "EMR", "ITW",
  "SMCI", "ARM", "ASML", "TSM", "SAMSF",
]);

/**
 * Detect if the question explicitly mentions a ticker symbol.
 * Returns the ticker if found, null otherwise.
 */
export function detectTickerInQuestion(question: string): string | null {
  // Contextual patterns — run against ORIGINAL string (not uppercased)
  // Captures must be ALL UPPERCASE to qualify as a ticker (e.g. PLTR, not 'me' or 'for')
  // This prevents false positives like 'for me' → ME, 'long term' → TERM
  const contextualPatterns = [
    /\babout\s+([A-Z]{2,5})\b/g,
    /\bfor\s+([A-Z]{2,5})\b/g,
    /\b([A-Z]{2,5})\s+stock\b/gi,
    /\b([A-Z]{2,5})\s+crypto\b/gi,
    /\b([A-Z]{2,5})\s+coin\b/gi,
    /\b([A-Z]{2,5})\s+shares?\b/gi,
    /\bwhat about\s+([A-Z]{2,5})\b/g,
    /\bswitch to\s+([A-Z]{2,5})\b/g,
    /\banalyze\s+([A-Z]{2,5})\b/g,
    /\blook at\s+([A-Z]{2,5})\b/g,
    /\bbuy\s+([A-Z]{2,5})\b/g,
    /\bsell\s+([A-Z]{2,5})\b/g,
    /\bhold\s+([A-Z]{2,5})\b/g,
    /\bshort\s+([A-Z]{2,5})\b/g,
    /\blong\s+([A-Z]{2,5})\b/g,
    /\b([A-Z]{2,5})\s+vs\b/g,
    /\bvs\s+([A-Z]{2,5})\b/g,
  ];

  const upperQ = question.toUpperCase();

  for (const pattern of contextualPatterns) {
    const match = pattern.exec(question); // Run against original string
    if (match) {
      const candidate = match[1].toUpperCase();
      // Require all-uppercase capture (real tickers are ALL CAPS in text)
      if (
        candidate === match[1] &&  // Was already uppercase in original
        !COMMON_WORDS_NOT_TICKERS.has(candidate) &&
        candidate.length >= 2
      ) {
        return candidate;
      }
    }
  }

  // Fallback: scan for known tickers in the question
  // Must also check exclusion set — some words like LOW, HIGH, LONG, SHORT are in KNOWN_TICKERS
  // but are also common English words that should not be treated as tickers in context
  const words = upperQ.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Z]/g, "");
    if (KNOWN_TICKERS.has(clean) && !COMMON_WORDS_NOT_TICKERS.has(clean)) {
      return clean;
    }
  }

  return null;
}

// ── Global question patterns ──────────────────────────────────────────────────
// These patterns indicate the user is asking about the broad market, not a specific asset.

const GLOBAL_PATTERNS: RegExp[] = [
  /best\s+(stocks?|investments?|opportunities|picks?|buys?|plays?)\s*(right\s*now|today|this\s*week|this\s*month)?/i,
  /top\s+(stocks?|investments?|opportunities|picks?|sectors?|cryptos?|assets?)/i,
  /what\s+should\s+i\s+(buy|invest|do|hold|sell)/i,
  /where\s+should\s+i\s+(invest|put|allocate)/i,
  /what('s|\s+is)\s+(the\s+)?(market|economy|everything)\s+(doing|look(ing)?|at)/i,
  /how\s+(is|are)\s+(the\s+)?(market|markets|economy|stocks?|equities)\s+(doing|looking|performing)/i,
  /best\s+crypto\s*(opportunities|investments?|picks?|coins?)?/i,
  /what\s+sectors?\s+(look|are|perform)/i,
  /which\s+sectors?\s+(look|are|perform|strongest|weakest)/i,
  /how\s+dangerous\s+is\s+(the\s+)?market/i,
  /market\s+(outlook|conditions?|sentiment|regime|environment)/i,
  /overall\s+market/i,
  /broad\s+market/i,
  /investment\s+opportunities/i,
  /opportunities\s+(right\s*now|today|this\s*week)/i,
  /what('s|\s+is)\s+(hot|working|trending|moving)/i,
  /what\s+are\s+(institutions?|hedge\s*funds?|smart\s*money)\s+(buying|selling|doing)/i,
  /rotation\s+(into|out\s+of|strategy)/i,
  /risk\s+(on|off)\s+(environment|mode|trade)/i,
  /everything\s+(is\s+)?(crashing|falling|rising|rallying)/i,
];

const MACRO_PATTERNS: RegExp[] = [
  /\b(fed|federal\s+reserve|fomc|powell|yellen)\b/i,
  /\b(interest\s+rates?|rate\s+hike|rate\s+cut|rate\s+pause)\b/i,
  /\b(inflation|deflation|cpi|ppi|pce|core\s+inflation)\b/i,
  /\b(gdp|economic\s+growth|recession|soft\s+landing|stagflation)\b/i,
  /\b(yield\s+curve|treasury|bonds?|10\s*year|2\s*year)\b/i,
  /\b(dollar|dxy|currency|forex|fx)\b/i,
  /\b(jobs?\s+report|nfp|unemployment|payrolls?|labor\s+market)\b/i,
  /\b(earnings?\s+season|q[1-4]\s+earnings?)\b/i,
  /\b(geopolitical|war|sanctions?|tariffs?|trade\s+war)\b/i,
  /macro\s+(environment|conditions?|outlook|picture|headwinds?|tailwinds?)/i,
  /\b(ism|pmi|manufacturing|services?\s+sector)\b/i,
  /\b(credit\s+market|spreads?|high\s+yield|investment\s+grade)\b/i,
];

const PORTFOLIO_PATTERNS: RegExp[] = [
  /\b(my\s+portfolio|my\s+positions?|my\s+holdings?|my\s+investments?)\b/i,
  /\b(rebalance|rebalancing|asset\s+allocation)\b/i,
  /\b(diversif(y|ied|ication))\b/i,
  /\bhow\s+am\s+i\s+(doing|positioned|exposed)\b/i,
  /\bmy\s+(exposure|risk|concentration)\b/i,
  /\bportfolio\s+(review|analysis|performance|risk|health)\b/i,
];

const SECTOR_PATTERNS: RegExp[] = [
  /\b(tech(nology)?|financials?|healthcare|energy|utilities|materials|industrials?|consumer|real\s+estate|communication)\s+sector\b/i,
  /\bsector\s+(rotation|analysis|outlook|performance|leaders?|laggards?)\b/i,
  /\b(which|what)\s+sector/i,
  /\bsectors?\s+(look|are|perform|strongest|weakest|leading|lagging)/i,
  /\b(XLK|XLF|XLV|XLE|XLU|XLB|XLI|XLY|XLP|XLRE|XLC)\b/,
];

const RISK_PATTERNS: RegExp[] = [
  /\b(market\s+risk|systemic\s+risk|tail\s+risk|downside\s+risk|drawdown)\b/i,
  /\bhow\s+(risky|dangerous|safe|volatile)\s+is\s+(the\s+)?market\b/i,
  /\bshould\s+i\s+(hedge|reduce\s+risk|raise\s+cash|go\s+defensive)\b/i,
  /\b(vix|volatility\s+index|fear\s+index)\b/i,
  /\bmarket\s+(crash|correction|bear\s+market|meltdown)\b/i,
];

const ECONOMIC_PATTERNS: RegExp[] = [
  /\b(recession|depression|economic\s+cycle|business\s+cycle)\b/i,
  /\b(fiscal\s+policy|monetary\s+policy|stimulus|quantitative\s+easing|qt|qe)\b/i,
  /\b(debt\s+ceiling|government\s+shutdown|budget\s+deficit)\b/i,
  /\b(housing\s+market|real\s+estate\s+market|mortgage\s+rates?)\b/i,
  /\b(consumer\s+spending|retail\s+sales|consumer\s+confidence)\b/i,
];

const TRADING_PATTERNS: RegExp[] = [
  /\b(swing\s+trade?|day\s+trade?|scalp|momentum\s+trade?)\b/i,
  /\b(technical\s+analysis|chart\s+pattern|support|resistance|breakout|breakdown)\b/i,
  /\b(short\s+term|near\s+term|this\s+week|next\s+week)\s+(trade?|setup|play|opportunity)\b/i,
  /\bbest\s+(swing|day|momentum)\s+trades?\b/i,
  /\b(oversold|overbought|rsi|macd|moving\s+average)\b/i,
];

const CRYPTO_GLOBAL_PATTERNS: RegExp[] = [
  /\b(crypto\s+market|crypto\s+opportunities|best\s+crypto|top\s+crypto|crypto\s+outlook)\b/i,
  /\b(defi|nft|web3|blockchain)\s+(market|opportunities|outlook)\b/i,
  /\b(bitcoin|btc)\s+(market|dominance|cycle)\b/i,
  /\b(altcoin\s+season|crypto\s+bull|crypto\s+bear)\b/i,
];

// ── Ambiguous symbol-context patterns ─────────────────────────────────────────
// When these appear WITHOUT a new ticker, keep the active symbol context.
const SYMBOL_CONTEXT_PATTERNS: RegExp[] = [
  /\bshould\s+i\s+(buy|sell|hold|add|reduce|exit|enter)\b/i,
  /\bhow\s+low\s+(could|can|will|might)\s+it\b/i,
  /\bhow\s+high\s+(could|can|will|might)\s+it\b/i,
  /\bwhat('s|\s+is)\s+(the\s+)?(downside|upside|target|price\s+target)\b/i,
  /\bis\s+(it|this)\s+(a\s+)?(buy|sell|hold|good\s+entry|overvalued|undervalued)\b/i,
  /\bwould\s+you\s+(buy|sell|add|reduce|hold|enter|exit)\b/i,
  /\bvaluation\s+(stretched|expensive|cheap|fair)\b/i,
  /\b(entry|exit)\s+(point|zone|level|price)\b/i,
  /\binvalidation\s+(level|price|point)\b/i,
  /\bstop\s+loss\b/i,
  /\btake\s+profit\b/i,
  /\bprice\s+target\b/i,
  /\bfair\s+value\b/i,
  /\bwhat\s+are\s+(the\s+)?(risks?|catalysts?|drivers?)\b/i,
  /\bupside\s+(potential|scenario|case)\b/i,
  /\bdownside\s+(risk|scenario|case|protection)\b/i,
  /\bbull\s+case\b/i,
  /\bbear\s+case\b/i,
  /\bbase\s+case\b/i,
];

// ── Main classifier ───────────────────────────────────────────────────────────

/**
 * Classify a question and determine the resolved context.
 *
 * @param question - The raw question text from the user
 * @param activeSymbol - The currently active ticker (from TickerStore), or null
 * @param activeAssetType - The asset type of the active ticker, or null
 */
export function classifyAskIntent(
  question: string,
  activeSymbol: string | null,
  activeAssetType: "stock" | "crypto" | null = null,
): ClassifiedIntent {
  const q = question.trim();

  // ── Step 1: Detect explicit ticker mention in the question ────────────────
  const detectedTicker = detectTickerInQuestion(q);

  // ── Step 2: Check for comparison FIRST (two tickers or "vs") ─────────────
  // Must run before single-ticker detection so 'SPY vs QQQ' → comparison, not stock
  if (/\bvs\.?\s+[A-Z]{1,5}\b/i.test(q) || /\b[A-Z]{1,5}\s+vs\.?\b/i.test(q)) {
    return {
      mode: "comparison",
      resolvedTicker: detectedTicker ?? activeSymbol,
      detectedTicker,
      shouldClearSymbol: !detectedTicker && !activeSymbol,
      confidence: 0.9,
    };
  }

  // If a new ticker is explicitly mentioned (different from active), switch to it
  if (detectedTicker && detectedTicker !== activeSymbol) {
    const isKnownCrypto = ["BTC", "ETH", "BNB", "SOL", "ADA", "XRP", "DOT", "AVAX",
      "MATIC", "LINK", "UNI", "AAVE", "CRV", "MKR", "COMP", "SNX", "YFI"].includes(detectedTicker);
    return {
      mode: isKnownCrypto ? "crypto" : "stock",
      resolvedTicker: detectedTicker,
      detectedTicker,
      shouldClearSymbol: false,
      confidence: KNOWN_TICKERS.has(detectedTicker) ? 0.95 : 0.75,
    };
  }

  // ── Step 3: Check specific sub-modes BEFORE global patterns ─────────────
  // Order matters: more specific modes must win over generic 'global'

  // ── Step 3a: Sector ──────────────────────────────────────────────────────
  for (const pattern of SECTOR_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "sector",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.85,
      };
    }
  }

  // ── Step 3b: Risk (global market risk questions) ─────────────────────────
  for (const pattern of RISK_PATTERNS) {
    if (pattern.test(q)) {
      if (!activeSymbol) {
        return {
          mode: "risk",
          resolvedTicker: null,
          detectedTicker: null,
          shouldClearSymbol: false,
          confidence: 0.8,
        };
      }
      // Risk questions WITH an active symbol stay in symbol context
      break;
    }
  }

  // ── Step 3c: Crypto global ───────────────────────────────────────────────
  for (const pattern of CRYPTO_GLOBAL_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "crypto",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.85,
      };
    }
  }

  // ── Step 3d: Macro ───────────────────────────────────────────────────────
  for (const pattern of MACRO_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "macro",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.85,
      };
    }
  }

  // ── Step 3e: Portfolio ───────────────────────────────────────────────────
  for (const pattern of PORTFOLIO_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "portfolio",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.9,
      };
    }
  }

  // ── Step 3f: Economic ────────────────────────────────────────────────────
  for (const pattern of ECONOMIC_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "economic",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.85,
      };
    }
  }

  // ── Step 3g: Trading ─────────────────────────────────────────────────────
  for (const pattern of TRADING_PATTERNS) {
    if (pattern.test(q)) {
      if (!activeSymbol) {
        return {
          mode: "trading",
          resolvedTicker: null,
          detectedTicker: null,
          shouldClearSymbol: false,
          confidence: 0.8,
        };
      }
      break;
    }
  }

  // ── Step 4: Check global patterns ────────────────────────────────────────
  for (const pattern of GLOBAL_PATTERNS) {
    if (pattern.test(q)) {
      return {
        mode: "global",
        resolvedTicker: null,
        detectedTicker: null,
        shouldClearSymbol: true,
        confidence: 0.9,
      };
    }
  }

  // ── Step 11: Check symbol-context patterns (keep active symbol) ───────────
  if (activeSymbol) {
    for (const pattern of SYMBOL_CONTEXT_PATTERNS) {
      if (pattern.test(q)) {
        return {
          mode: activeAssetType === "crypto" ? "crypto" : "stock",
          resolvedTicker: activeSymbol,
          detectedTicker: null,
          shouldClearSymbol: false,
          confidence: 0.85,
        };
      }
    }
  }

  // ── Step 12: Fallback ─────────────────────────────────────────────────────
  // If there's an active symbol and the question is ambiguous, keep the symbol
  if (activeSymbol) {
    return {
      mode: activeAssetType === "crypto" ? "crypto" : "stock",
      resolvedTicker: activeSymbol,
      detectedTicker: null,
      shouldClearSymbol: false,
      confidence: 0.5,
    };
  }

  // No symbol, no clear pattern → global
  return {
    mode: "global",
    resolvedTicker: null,
    detectedTicker: null,
    shouldClearSymbol: false,
    confidence: 0.6,
  };
}

/**
 * Get the placeholder text for the Ask input based on current context.
 */
export function getAskPlaceholder(
  mode: AskMode,
  activeSymbol: string | null,
): string {
  if (activeSymbol) {
    return `Ask ASHA about ${activeSymbol}…`;
  }
  switch (mode) {
    case "macro":
      return "Ask ASHA about macro conditions, Fed policy, inflation…";
    case "portfolio":
      return "Ask ASHA about your portfolio…";
    case "sector":
      return "Ask ASHA about sectors, rotation, industry trends…";
    case "crypto":
      return "Ask ASHA about crypto markets, DeFi, opportunities…";
    case "trading":
      return "Ask ASHA about trade setups, technicals, momentum…";
    case "risk":
      return "Ask ASHA about market risk, hedging, downside protection…";
    case "economic":
      return "Ask ASHA about the economy, recession risk, cycles…";
    default:
      return "Ask ASHA…";
  }
}
