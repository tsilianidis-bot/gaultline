/**
 * FAULTLINE — Intent Resolution Engine
 * server/intentResolver.ts
 *
 * Executes BEFORE FMOS reasoning to correctly identify:
 *   - Asset type (stock, ETF, crypto, forex, commodity)
 *   - Ticker symbol
 *   - Query type (security, macro, opportunity, portfolio, general)
 *   - Whether clarification is needed
 *
 * Fixes: "Should I buy BTC today?" → Bitcoin (not SHOULD ticker)
 */

// ── Asset type ────────────────────────────────────────────────
export type AssetType = "stock" | "crypto" | "etf" | "forex" | "commodity" | null;
export type QueryType = "security" | "macro" | "opportunity" | "portfolio" | "general";

export interface IntentResult {
  ticker: string | null;
  assetType: AssetType;
  queryType: QueryType;
  assetName: string | null;       // Human-readable name (e.g. "Bitcoin")
  needsClarification: boolean;
  clarificationPrompt: string | null;
  confidence: "high" | "medium" | "low";
}

// ── Common English words that look like tickers — NEVER treat as tickers ──
const ENGLISH_SKIP = new Set([
  // Pronouns / articles
  "I","A","AN","THE","IT","ITS","MY","OUR","YOUR","HIS","HER","THEIR","WE","YOU","HE","SHE","THEY",
  // Verbs
  "IS","ARE","WAS","WERE","BE","BEEN","BEING","DO","DOES","DID","DONE","DOING",
  "BUY","SELL","HOLD","WAIT","RISK","TRADE","INVEST","OWN","GET","GO","GIVE","TAKE","MAKE","PUT","SET",
  "SHOULD","COULD","WOULD","WILL","SHALL","MAY","MIGHT","MUST","CAN","NEED","WANT","HAVE","HAS","HAD",
  "ENTER","EXIT","ADD","CUT","REDUCE","INCREASE","OPEN","CLOSE","SHORT","LONG",
  // Common English verbs that look like tickers
  "BREAK","BROKE","BROKEN","MOVE","MOVED","MOVING","RUN","RUNS","RISE","RISES","FELL","FALL","FALLS",
  "THINK","THOUGHT","KNOW","KNEW","FEEL","FELT","LOOK","LOOKS","SEEM","SEEMS","TELL","TOLD","SHOW",
  "EXPECT","WATCH","PLAY","STAY","KEEP","TURN","PUSH","PULL","HIT","MISS","PASS","FAIL","FIND",
  "CALL","CALLS","PUTS","PUTS","WORK","WORKS","HELP","HELPS","MEAN","MEANS","COME","CAME","CAME",
  // Prepositions / conjunctions
  "IN","AT","TO","FOR","OF","ON","BY","UP","DOWN","OUT","OFF","OVER","UNDER","INTO","FROM","WITH","WITHOUT",
  "AND","OR","BUT","IF","THEN","ELSE","SO","AS","THAT","THIS","THESE","THOSE","THAN","WHEN","WHERE","HOW","WHY","WHAT",
  "ABOUT","AFTER","BEFORE","BETWEEN","DURING","SINCE","UNTIL","WHILE","AROUND","AGAINST","BEYOND",
  // Common adjectives/adverbs that look like tickers
  "VERY","REALLY","QUITE","PRETTY","MUCH","MANY","SOME","SUCH","SAME","BOTH","EACH","EVERY","ONLY",
  "LIKE","JUST","BACK","EVEN","STILL","ALSO","WELL","AWAY","AGAIN","THROUGH","ACROSS","ALONG",
  // Financial terms that look like tickers
  "AI","US","UK","EU","FX","EM","DM","PE","EV","YOY","QOQ","MOM","YTD","MTD","IPO","ETF","EPS","FCF","ROE","ROA",
  "GDP","CPI","PPI","PMI","ISM","NFP","ADP","FED","ECB","BOJ","BOE","IMF","BIS","SEC","CFTC",
  "NOW","NEW","OLD","BIG","LOW","HIGH","GOOD","BAD","BEST","NEXT","LAST","FIRST","MOST","LESS","MORE",
  "DAY","WEEK","MONTH","YEAR","TIME","DATE","RATE","TERM","NEAR","FAR",
  "CASH","BOND","DEBT","LOAN","FUND","BANK","YIELD","PRICE","VALUE","COST","GAIN","LOSS",
  "BULL","BEAR","CRASH","RALLY","DIP","TOP","BOTTOM","PEAK","FLOOR","CEILING","SUPPORT","RESISTANCE",
  "MACRO","MICRO","SECTOR","MARKET","STOCK","CRYPTO","FOREX","GOLD","OIL","GAS","SILVER",
  "SAFE","RISKY","VOLATILE","STABLE","STRONG","WEAK","CHEAP","EXPENSIVE",
  "TODAY","TOMORROW","QUARTER","DAILY","WEEKLY","MONTHLY",
]);

// ── Crypto: name → ticker mapping ─────────────────────────────
const CRYPTO_NAME_MAP: Record<string, string> = {
  // Major coins — common names
  "bitcoin": "BTC", "btc": "BTC",
  "ethereum": "ETH", "eth": "ETH", "ether": "ETH",
  "solana": "SOL", "sol": "SOL",
  "binance": "BNB", "bnb": "BNB",
  "ripple": "XRP", "xrp": "XRP",
  "dogecoin": "DOGE", "doge": "DOGE",
  "cardano": "ADA", "ada": "ADA",
  "avalanche": "AVAX", "avax": "AVAX",
  "polkadot": "DOT", "dot": "DOT",
  "chainlink": "LINK", "link": "LINK",
  "polygon": "MATIC", "matic": "MATIC",
  "cosmos": "ATOM", "atom": "ATOM",
  "litecoin": "LTC", "ltc": "LTC",
  "uniswap": "UNI", "uni": "UNI",
  "aave": "AAVE",
  "compound": "COMP", "comp": "COMP",
  "maker": "MKR", "mkr": "MKR",
  "near": "NEAR",
  "fantom": "FTM", "ftm": "FTM",
  "algorand": "ALGO", "algo": "ALGO",
  "hedera": "HBAR", "hbar": "HBAR",
  "internet computer": "ICP", "icp": "ICP",
  "vechain": "VET", "vet": "VET",
  "tron": "TRX", "trx": "TRX",
  "stellar": "XLM", "xlm": "XLM",
  "ethereum classic": "ETC", "etc": "ETC",
  "tao": "TAO", "bittensor": "TAO",
  "ondo": "ONDO",
  "shiba": "SHIB", "shib": "SHIB", "shiba inu": "SHIB",
  "pepe": "PEPE",
  "sui": "SUI",
  "aptos": "APT", "apt": "APT",
  "arbitrum": "ARB", "arb": "ARB",
  "optimism": "OP", "op": "OP",
  "sei": "SEI",
  "injective": "INJ", "inj": "INJ",
  "render": "RNDR", "rndr": "RNDR",
  "worldcoin": "WLD", "wld": "WLD",
  "blur": "BLUR",
  "gmx": "GMX",
  "pendle": "PENDLE",
  "jito": "JTO", "jto": "JTO",
  "pyth": "PYTH",
  "wormhole": "W",
  "starknet": "STRK", "strk": "STRK",
  "celestia": "TIA", "tia": "TIA",
  "dydx": "DYDX",
  "lido": "LDO", "ldo": "LDO",
  "curve": "CRV", "crv": "CRV",
  "convex": "CVX", "cvx": "CVX",
  "yearn": "YFI", "yfi": "YFI",
  "synthetix": "SNX", "snx": "SNX",
  "eos": "EOS",
  "xmr": "XMR", "monero": "XMR",
  "zcash": "ZEC", "zec": "ZEC",
  "dash": "DASH",
  "filecoin": "FIL", "fil": "FIL",
  "the graph": "GRT", "grt": "GRT",
  "sandbox": "SAND", "sand": "SAND",
  "decentraland": "MANA", "mana": "MANA",
  "axie": "AXS", "axs": "AXS",
  "gala": "GALA",
  "immutable": "IMX", "imx": "IMX",
  "flow": "FLOW",
  "theta": "THETA",
  "zilliqa": "ZIL", "zil": "ZIL",
  "iota": "IOTA",
  "neo": "NEO",
  "waves": "WAVES",
  "qtum": "QTUM",
  "ontology": "ONT", "ont": "ONT",
  "icon": "ICX", "icx": "ICX",
  "nano": "NANO",
  "ravencoin": "RVN", "rvn": "RVN",
  "horizen": "ZEN", "zen": "ZEN",
  "siacoin": "SC", "sc": "SC",
  "storj": "STORJ",
  "ankr": "ANKR",
  "ocean": "OCEAN",
  "fetch": "FET", "fet": "FET",
  "numeraire": "NMR", "nmr": "NMR",
  "band": "BAND",
  "uma": "UMA",
  "loopring": "LRC", "lrc": "LRC",
  "1inch": "1INCH",
  "balancer": "BAL", "bal": "BAL",
  "sushiswap": "SUSHI", "sushi": "SUSHI",
  "pancakeswap": "CAKE", "cake": "CAKE",
  "venus": "XVS", "xvs": "XVS",
  "mdex": "MDX",
  "wbtc": "WBTC", "wrapped bitcoin": "WBTC",
  "steth": "STETH",
  "usdc": "USDC", "usd coin": "USDC",
  "usdt": "USDT", "tether": "USDT",
  "dai": "DAI",
  "busd": "BUSD",
  "frax": "FRAX",
  "tusd": "TUSD",
  "paxg": "PAXG", "pax gold": "PAXG",
};

// ── Crypto ticker set (for fast lookup) ──────────────────────
const CRYPTO_TICKERS = new Set(Object.values(CRYPTO_NAME_MAP));

// ── Stock: common name → ticker mapping ──────────────────────
const STOCK_NAME_MAP: Record<string, { ticker: string; name: string }> = {
  // Big Tech
  "apple": { ticker: "AAPL", name: "Apple" },
  "microsoft": { ticker: "MSFT", name: "Microsoft" },
  "google": { ticker: "GOOGL", name: "Alphabet/Google" },
  "alphabet": { ticker: "GOOGL", name: "Alphabet" },
  "amazon": { ticker: "AMZN", name: "Amazon" },
  "meta": { ticker: "META", name: "Meta" },
  "facebook": { ticker: "META", name: "Meta (Facebook)" },
  "nvidia": { ticker: "NVDA", name: "NVIDIA" },
  "nvda": { ticker: "NVDA", name: "NVIDIA" },
  "tesla": { ticker: "TSLA", name: "Tesla" },
  "netflix": { ticker: "NFLX", name: "Netflix" },
  "salesforce": { ticker: "CRM", name: "Salesforce" },
  "adobe": { ticker: "ADBE", name: "Adobe" },
  "intel": { ticker: "INTC", name: "Intel" },
  "amd": { ticker: "AMD", name: "AMD" },
  "advanced micro devices": { ticker: "AMD", name: "AMD" },
  "qualcomm": { ticker: "QCOM", name: "Qualcomm" },
  "broadcom": { ticker: "AVGO", name: "Broadcom" },
  "arm": { ticker: "ARM", name: "Arm Holdings" },
  "arm holdings": { ticker: "ARM", name: "Arm Holdings" },
  "palantir": { ticker: "PLTR", name: "Palantir" },
  "snowflake": { ticker: "SNOW", name: "Snowflake" },
  "datadog": { ticker: "DDOG", name: "Datadog" },
  "crowdstrike": { ticker: "CRWD", name: "CrowdStrike" },
  "servicenow": { ticker: "NOW", name: "ServiceNow" },
  "workday": { ticker: "WDAY", name: "Workday" },
  "splunk": { ticker: "SPLK", name: "Splunk" },
  "palo alto": { ticker: "PANW", name: "Palo Alto Networks" },
  "fortinet": { ticker: "FTNT", name: "Fortinet" },
  "cloudflare": { ticker: "NET", name: "Cloudflare" },
  "okta": { ticker: "OKTA", name: "Okta" },
  "zscaler": { ticker: "ZS", name: "Zscaler" },
  "mongodb": { ticker: "MDB", name: "MongoDB" },
  "twilio": { ticker: "TWLO", name: "Twilio" },
  "shopify": { ticker: "SHOP", name: "Shopify" },
  "uber": { ticker: "UBER", name: "Uber" },
  "lyft": { ticker: "LYFT", name: "Lyft" },
  "airbnb": { ticker: "ABNB", name: "Airbnb" },
  "doordash": { ticker: "DASH", name: "DoorDash" },
  "coinbase": { ticker: "COIN", name: "Coinbase" },
  "robinhood": { ticker: "HOOD", name: "Robinhood" },
  "paypal": { ticker: "PYPL", name: "PayPal" },
  "square": { ticker: "SQ", name: "Block (Square)" },
  "block": { ticker: "SQ", name: "Block" },
  "stripe": { ticker: "STRIPE", name: "Stripe (private)" },
  "visa": { ticker: "V", name: "Visa" },
  "mastercard": { ticker: "MA", name: "Mastercard" },
  "american express": { ticker: "AXP", name: "American Express" },
  "amex": { ticker: "AXP", name: "American Express" },
  // Finance
  "jpmorgan": { ticker: "JPM", name: "JPMorgan Chase" },
  "jp morgan": { ticker: "JPM", name: "JPMorgan Chase" },
  "goldman sachs": { ticker: "GS", name: "Goldman Sachs" },
  "morgan stanley": { ticker: "MS", name: "Morgan Stanley" },
  "bank of america": { ticker: "BAC", name: "Bank of America" },
  "wells fargo": { ticker: "WFC", name: "Wells Fargo" },
  "citigroup": { ticker: "C", name: "Citigroup" },
  "citi": { ticker: "C", name: "Citigroup" },
  "blackrock": { ticker: "BLK", name: "BlackRock" },
  "berkshire": { ticker: "BRK.B", name: "Berkshire Hathaway" },
  "berkshire hathaway": { ticker: "BRK.B", name: "Berkshire Hathaway" },
  // Energy
  "exxon": { ticker: "XOM", name: "ExxonMobil" },
  "exxonmobil": { ticker: "XOM", name: "ExxonMobil" },
  "chevron": { ticker: "CVX", name: "Chevron" },
  "shell": { ticker: "SHEL", name: "Shell" },
  "bp": { ticker: "BP", name: "BP" },
  "conocophillips": { ticker: "COP", name: "ConocoPhillips" },
  "halliburton": { ticker: "HAL", name: "Halliburton" },
  "schlumberger": { ticker: "SLB", name: "SLB" },
  // Healthcare
  "johnson": { ticker: "JNJ", name: "Johnson & Johnson" },
  "j&j": { ticker: "JNJ", name: "Johnson & Johnson" },
  "pfizer": { ticker: "PFE", name: "Pfizer" },
  "moderna": { ticker: "MRNA", name: "Moderna" },
  "merck": { ticker: "MRK", name: "Merck" },
  "abbvie": { ticker: "ABBV", name: "AbbVie" },
  "eli lilly": { ticker: "LLY", name: "Eli Lilly" },
  "lilly": { ticker: "LLY", name: "Eli Lilly" },
  "unitedhealth": { ticker: "UNH", name: "UnitedHealth" },
  "cvs": { ticker: "CVS", name: "CVS Health" },
  "walgreens": { ticker: "WBA", name: "Walgreens" },
  // Consumer
  "walmart": { ticker: "WMT", name: "Walmart" },
  "target": { ticker: "TGT", name: "Target" },
  "costco": { ticker: "COST", name: "Costco" },
  "home depot": { ticker: "HD", name: "Home Depot" },
  "lowes": { ticker: "LOW", name: "Lowe's" },
  "mcdonalds": { ticker: "MCD", name: "McDonald's" },
  "mcdonald's": { ticker: "MCD", name: "McDonald's" },
  "starbucks": { ticker: "SBUX", name: "Starbucks" },
  "nike": { ticker: "NKE", name: "Nike" },
  "disney": { ticker: "DIS", name: "Disney" },
  "coca cola": { ticker: "KO", name: "Coca-Cola" },
  "coke": { ticker: "KO", name: "Coca-Cola" },
  "pepsi": { ticker: "PEP", name: "PepsiCo" },
  "pepsico": { ticker: "PEP", name: "PepsiCo" },
  "procter": { ticker: "PG", name: "Procter & Gamble" },
  "p&g": { ticker: "PG", name: "Procter & Gamble" },
  "colgate": { ticker: "CL", name: "Colgate-Palmolive" },
  "unilever": { ticker: "UL", name: "Unilever" },
  // Industrials
  "boeing": { ticker: "BA", name: "Boeing" },
  "lockheed": { ticker: "LMT", name: "Lockheed Martin" },
  "raytheon": { ticker: "RTX", name: "RTX" },
  "caterpillar": { ticker: "CAT", name: "Caterpillar" },
  "deere": { ticker: "DE", name: "Deere & Company" },
  "ge": { ticker: "GE", name: "GE Aerospace" },
  "general electric": { ticker: "GE", name: "GE Aerospace" },
  "3m": { ticker: "MMM", name: "3M" },
  "honeywell": { ticker: "HON", name: "Honeywell" },
  "ups": { ticker: "UPS", name: "UPS" },
  "fedex": { ticker: "FDX", name: "FedEx" },
  // Telecom
  "at&t": { ticker: "T", name: "AT&T" },
  "verizon": { ticker: "VZ", name: "Verizon" },
  "t-mobile": { ticker: "TMUS", name: "T-Mobile" },
  "comcast": { ticker: "CMCSA", name: "Comcast" },
  // ETFs
  "spy": { ticker: "SPY", name: "S&P 500 ETF (SPY)" },
  "qqq": { ticker: "QQQ", name: "Nasdaq 100 ETF (QQQ)" },
  "iwm": { ticker: "IWM", name: "Russell 2000 ETF (IWM)" },
  "dia": { ticker: "DIA", name: "Dow Jones ETF (DIA)" },
  "voo": { ticker: "VOO", name: "Vanguard S&P 500 (VOO)" },
  "arkk": { ticker: "ARKK", name: "ARK Innovation ETF" },
  "xlk": { ticker: "XLK", name: "Technology Select Sector ETF" },
  "xlf": { ticker: "XLF", name: "Financial Select Sector ETF" },
  "xle": { ticker: "XLE", name: "Energy Select Sector ETF" },
  "xlv": { ticker: "XLV", name: "Health Care Select Sector ETF" },
  "gld": { ticker: "GLD", name: "Gold ETF (GLD)" },
  "slv": { ticker: "SLV", name: "Silver ETF (SLV)" },
  "tlt": { ticker: "TLT", name: "20+ Year Treasury Bond ETF" },
  "hyg": { ticker: "HYG", name: "High Yield Bond ETF" },
  "eem": { ticker: "EEM", name: "Emerging Markets ETF" },
  "vxus": { ticker: "VXUS", name: "Total International Stock ETF" },
  // AI stocks
  "openai": { ticker: "OPENAI", name: "OpenAI (private)" },
  "anthropic": { ticker: "ANTHROPIC", name: "Anthropic (private)" },
  "c3ai": { ticker: "AI", name: "C3.ai" },
  "c3.ai": { ticker: "AI", name: "C3.ai" },
  "soundhound": { ticker: "SOUN", name: "SoundHound AI" },
  "bigbear": { ticker: "BBAI", name: "BigBear.ai" },
  "symbotic": { ticker: "SYM", name: "Symbotic" },
  "samsara": { ticker: "IOT", name: "Samsara" },
  "astera labs": { ticker: "ALAB", name: "Astera Labs" },
  "marvell": { ticker: "MRVL", name: "Marvell Technology" },
  "micron": { ticker: "MU", name: "Micron Technology" },
  "super micro": { ticker: "SMCI", name: "Super Micro Computer" },
  "supermicro": { ticker: "SMCI", name: "Super Micro Computer" },
  "smci": { ticker: "SMCI", name: "Super Micro Computer" },
  "vertiv": { ticker: "VRT", name: "Vertiv" },
  "vistra": { ticker: "VST", name: "Vistra" },
  "constellation energy": { ticker: "CEG", name: "Constellation Energy" },
  "talen energy": { ticker: "TLN", name: "Talen Energy" },
  // Others
  "spotify": { ticker: "SPOT", name: "Spotify" },
  "twitter": { ticker: "X", name: "X (formerly Twitter, private)" },
  "snap": { ticker: "SNAP", name: "Snap" },
  "pinterest": { ticker: "PINS", name: "Pinterest" },
  "reddit": { ticker: "RDDT", name: "Reddit" },
  "roblox": { ticker: "RBLX", name: "Roblox" },
  "unity": { ticker: "U", name: "Unity Software" },
  "zoom": { ticker: "ZM", name: "Zoom" },
  "slack": { ticker: "WORK", name: "Slack (acquired by Salesforce)" },
  "dropbox": { ticker: "DBX", name: "Dropbox" },
  "box": { ticker: "BOX", name: "Box" },
  "docusign": { ticker: "DOCU", name: "DocuSign" },
  "zendesk": { ticker: "ZEN", name: "Zendesk" },
  "hubspot": { ticker: "HUBS", name: "HubSpot" },
  "asana": { ticker: "ASAN", name: "Asana" },
  "monday": { ticker: "MNDY", name: "Monday.com" },
  "gitlab": { ticker: "GTLB", name: "GitLab" },
  "hashicorp": { ticker: "HCP", name: "HashiCorp" },
  "confluent": { ticker: "CFLT", name: "Confluent" },
  "elastic": { ticker: "ESTC", name: "Elastic" },
  "fastly": { ticker: "FSLY", name: "Fastly" },
  "digital ocean": { ticker: "DOCN", name: "DigitalOcean" },
  "digitalocean": { ticker: "DOCN", name: "DigitalOcean" },
  "linode": { ticker: "LINODE", name: "Linode (private)" },
  "oracle": { ticker: "ORCL", name: "Oracle" },
  "ibm": { ticker: "IBM", name: "IBM" },
  "sap": { ticker: "SAP", name: "SAP" },
  "accenture": { ticker: "ACN", name: "Accenture" },
  "infosys": { ticker: "INFY", name: "Infosys" },
  "tata": { ticker: "TCS", name: "Tata Consultancy Services" },
  "wipro": { ticker: "WIT", name: "Wipro" },
};

// ── Commodity / Forex: name → symbol mapping ─────────────────
const COMMODITY_MAP: Record<string, { ticker: string; name: string; assetType: AssetType }> = {
  "gold": { ticker: "XAUUSD", name: "Gold", assetType: "commodity" },
  "xau": { ticker: "XAUUSD", name: "Gold", assetType: "commodity" },
  "silver": { ticker: "XAGUSD", name: "Silver", assetType: "commodity" },
  "xag": { ticker: "XAGUSD", name: "Silver", assetType: "commodity" },
  "oil": { ticker: "USOIL", name: "Crude Oil (WTI)", assetType: "commodity" },
  "crude": { ticker: "USOIL", name: "Crude Oil (WTI)", assetType: "commodity" },
  "crude oil": { ticker: "USOIL", name: "Crude Oil (WTI)", assetType: "commodity" },
  "wti": { ticker: "USOIL", name: "WTI Crude Oil", assetType: "commodity" },
  "brent": { ticker: "UKOIL", name: "Brent Crude Oil", assetType: "commodity" },
  "natural gas": { ticker: "NATGAS", name: "Natural Gas", assetType: "commodity" },
  "natgas": { ticker: "NATGAS", name: "Natural Gas", assetType: "commodity" },
  "copper": { ticker: "COPPER", name: "Copper", assetType: "commodity" },
  "wheat": { ticker: "WHEAT", name: "Wheat", assetType: "commodity" },
  "corn": { ticker: "CORN", name: "Corn", assetType: "commodity" },
  "soybeans": { ticker: "SOYBEAN", name: "Soybeans", assetType: "commodity" },
  "platinum": { ticker: "XPTUSD", name: "Platinum", assetType: "commodity" },
  "palladium": { ticker: "XPDUSD", name: "Palladium", assetType: "commodity" },
  // Forex
  "dollar": { ticker: "DXY", name: "US Dollar Index", assetType: "forex" },
  "dxy": { ticker: "DXY", name: "US Dollar Index", assetType: "forex" },
  "euro": { ticker: "EURUSD", name: "EUR/USD", assetType: "forex" },
  "eur": { ticker: "EURUSD", name: "EUR/USD", assetType: "forex" },
  "eurusd": { ticker: "EURUSD", name: "EUR/USD", assetType: "forex" },
  "pound": { ticker: "GBPUSD", name: "GBP/USD", assetType: "forex" },
  "gbp": { ticker: "GBPUSD", name: "GBP/USD", assetType: "forex" },
  "gbpusd": { ticker: "GBPUSD", name: "GBP/USD", assetType: "forex" },
  "yen": { ticker: "USDJPY", name: "USD/JPY", assetType: "forex" },
  "jpy": { ticker: "USDJPY", name: "USD/JPY", assetType: "forex" },
  "usdjpy": { ticker: "USDJPY", name: "USD/JPY", assetType: "forex" },
  "yuan": { ticker: "USDCNH", name: "USD/CNH", assetType: "forex" },
  "cnh": { ticker: "USDCNH", name: "USD/CNH", assetType: "forex" },
  "swiss franc": { ticker: "USDCHF", name: "USD/CHF", assetType: "forex" },
  "chf": { ticker: "USDCHF", name: "USD/CHF", assetType: "forex" },
  "cad": { ticker: "USDCAD", name: "USD/CAD", assetType: "forex" },
  "canadian dollar": { ticker: "USDCAD", name: "USD/CAD", assetType: "forex" },
  "aud": { ticker: "AUDUSD", name: "AUD/USD", assetType: "forex" },
  "australian dollar": { ticker: "AUDUSD", name: "AUD/USD", assetType: "forex" },
};

// ── Macro / portfolio keywords ────────────────────────────────
const MACRO_KEYWORDS = [
  "market", "macro", "economy", "recession", "inflation", "deflation", "stagflation",
  "fed", "federal reserve", "interest rate", "rate hike", "rate cut", "quantitative",
  "qe", "qt", "yield curve", "inverted yield", "credit", "liquidity", "systemic",
  "crash", "correction", "bear market", "bull market", "rally", "selloff",
  "gdp", "cpi", "ppi", "nfp", "unemployment", "jobs report", "earnings season",
  "geopolitical", "war", "sanctions", "tariff", "trade war", "china", "russia",
  "banking crisis", "debt ceiling", "fiscal", "monetary policy", "central bank",
  "vix", "volatility", "fear", "greed", "sentiment", "institutional",
  "safe haven", "risk off", "risk on", "flight to quality",
  "sector rotation", "asset allocation", "diversification",
  "how risky", "how dangerous", "what is happening", "what changed",
];

const PORTFOLIO_KEYWORDS = [
  "portfolio", "position", "holding", "allocation", "rebalance", "diversify",
  "my stocks", "my crypto", "my investments", "should i stay", "should i exit",
  "take profits", "cut losses", "stop loss", "risk management",
];

const OPPORTUNITY_KEYWORDS = [
  "opportunit", "swing trade", "best trade", "what to buy", "what should i buy",
  "best stock", "best crypto", "top pick", "undervalued", "oversold", "overbought",
  "screener", "scanner", "find me", "recommend", "suggestions",
];

// ── Main resolver function ────────────────────────────────────
export function resolveIntent(
  query: string,
  contextTicker: string | null = null,
  contextAssetType: AssetType = null,
): IntentResult {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();

  // ── Step 1: Check commodity/forex by name (highest priority for named assets) ──
  for (const [name, info] of Object.entries(COMMODITY_MAP)) {
    if (lower.includes(name)) {
      return {
        ticker: info.ticker,
        assetType: info.assetType,
        queryType: "security",
        assetName: info.name,
        needsClarification: false,
        clarificationPrompt: null,
        confidence: "high",
      };
    }
  }

  // ── Step 2: Check crypto by name ──────────────────────────
  for (const [name, ticker] of Object.entries(CRYPTO_NAME_MAP)) {
    if (lower.includes(name)) {
      return {
        ticker,
        assetType: "crypto",
        queryType: "security",
        assetName: name.charAt(0).toUpperCase() + name.slice(1),
        needsClarification: false,
        clarificationPrompt: null,
        confidence: "high",
      };
    }
  }

  // ── Step 3: Check stock by common name ───────────────────
  for (const [name, info] of Object.entries(STOCK_NAME_MAP)) {
    if (lower.includes(name)) {
      return {
        ticker: info.ticker,
        assetType: "stock",
        queryType: "security",
        assetName: info.name,
        needsClarification: false,
        clarificationPrompt: null,
        confidence: "high",
      };
    }
  }

  // ── Step 4: Extract uppercase ticker tokens from query ───
  // Only match tokens that are NOT in the English skip list
  const upperTokens = upper.match(/\b([A-Z]{1,6})\b/g) ?? [];
  const candidateTickers = upperTokens.filter(t => !ENGLISH_SKIP.has(t) && t.length >= 2);

  // ── Step 5: Check if any candidate is a known crypto ticker ──
  const cryptoCandidate = candidateTickers.find(t => CRYPTO_TICKERS.has(t));
  if (cryptoCandidate) {
    const assetName = Object.entries(CRYPTO_NAME_MAP).find(([, v]) => v === cryptoCandidate)?.[0] ?? cryptoCandidate;
    return {
      ticker: cryptoCandidate,
      assetType: "crypto",
      queryType: "security",
      assetName: assetName.charAt(0).toUpperCase() + assetName.slice(1),
      needsClarification: false,
      clarificationPrompt: null,
      confidence: "high",
    };
  }

  // ── Step 6: Check if query is purely a ticker symbol (e.g. "NVDA" or "AAPL") ──
  const pureTickerMatch = raw.match(/^([A-Z]{1,6})$/);
  if (pureTickerMatch && !ENGLISH_SKIP.has(pureTickerMatch[1])) {
    const t = pureTickerMatch[1];
    return {
      ticker: t,
      assetType: CRYPTO_TICKERS.has(t) ? "crypto" : "stock",
      queryType: "security",
      assetName: t,
      needsClarification: false,
      clarificationPrompt: null,
      confidence: "high",
    };
  }

  // ── Step 7: Check for remaining uppercase ticker candidates ──
  // Strategy: if multiple candidates, prefer ones that look like real tickers
  // (all-caps, 2-5 chars, not common English words already filtered)
  // If only one candidate remains after filtering, use it (medium confidence)
  // If multiple, try to find the most ticker-like one
  const knownStockTickers = new Set(Object.values(STOCK_NAME_MAP).map(v => v.ticker));
  
  // First pass: check if any candidate is a known stock ticker
  const stockCandidate = candidateTickers.find(t => knownStockTickers.has(t));
  if (stockCandidate) {
    return {
      ticker: stockCandidate,
      assetType: "stock",
      queryType: "security",
      assetName: stockCandidate,
      needsClarification: false,
      clarificationPrompt: null,
      confidence: "high",
    };
  }

  // Second pass: if exactly one candidate, use it (but only if it looks like a ticker)
  if (candidateTickers.length === 1) {
    const t = candidateTickers[0];
    // Don't treat single 2-letter tokens as tickers unless they look intentional
    const twoLetterSkip = new Set(["IS","IN","AT","TO","DO","BE","MY","OR","VS","US","UK","EU","IF","AI"]);
    if (t.length >= 3 || (t.length === 2 && !twoLetterSkip.has(t))) {
      return {
        ticker: t,
        assetType: CRYPTO_TICKERS.has(t) ? "crypto" : "stock",
        queryType: "security",
        assetName: t,
        needsClarification: false,
        clarificationPrompt: null,
        confidence: "medium",
      };
    }
  }

  // Third pass: multiple candidates — pick the shortest (most ticker-like) that is 2-5 chars
  if (candidateTickers.length > 1) {
    const tickerLike = candidateTickers
      .filter(t => t.length >= 2 && t.length <= 5)
      .sort((a, b) => a.length - b.length);
    if (tickerLike.length > 0) {
      const t = tickerLike[0];
      return {
        ticker: t,
        assetType: CRYPTO_TICKERS.has(t) ? "crypto" : "stock",
        queryType: "security",
        assetName: t,
        needsClarification: false,
        clarificationPrompt: null,
        confidence: "low",
      };
    }
  }

  // ── Step 8: Use context ticker if available ───────────────
  if (contextTicker && contextAssetType) {
    return {
      ticker: contextTicker,
      assetType: contextAssetType,
      queryType: classifyQueryType(lower, contextTicker),
      assetName: contextTicker,
      needsClarification: false,
      clarificationPrompt: null,
      confidence: "medium",
    };
  }

  // ── Step 9: Classify as macro / portfolio / opportunity / general ──
  const queryType = classifyQueryType(lower, null);

  return {
    ticker: null,
    assetType: null,
    queryType,
    assetName: null,
    needsClarification: false,
    clarificationPrompt: null,
    confidence: "high",
  };
}

// ── Query type classifier ─────────────────────────────────────
function classifyQueryType(lower: string, ticker: string | null): QueryType {
  if (ticker) return "security";
  if (OPPORTUNITY_KEYWORDS.some(k => lower.includes(k))) return "opportunity";
  if (PORTFOLIO_KEYWORDS.some(k => lower.includes(k))) return "portfolio";
  if (MACRO_KEYWORDS.some(k => lower.includes(k))) return "macro";
  return "general";
}

// ── Export helpers ────────────────────────────────────────────
export { CRYPTO_TICKERS, CRYPTO_NAME_MAP, STOCK_NAME_MAP, COMMODITY_MAP };
