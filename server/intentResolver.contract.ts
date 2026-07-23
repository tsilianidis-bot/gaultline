export type AssetType = "stock" | "crypto" | "etf" | "forex" | "commodity" | null;
export type QueryType = "security" | "macro" | "opportunity" | "portfolio" | "general";

export type QuestionIntent =
  | "downside"
  | "upside"
  | "buy_verdict"
  | "sell_verdict"
  | "wait_verdict"
  | "entry_zone"
  | "exit_zone"
  | "target_price"
  | "invalidation"
  | "risk_assessment"
  | "compare"
  | "opportunity_ranking"
  | "general_analysis";

export interface IntentResult {
  ticker: string | null;
  assetType: AssetType;
  queryType: QueryType;
  assetName: string | null;
  needsClarification: boolean;
  clarificationPrompt: string | null;
  confidence: "high" | "medium" | "low";
}

export function detectQuestionIntent(query: string): QuestionIntent {
  const q = query.toLowerCase().trim();

  if (/\bvs\.?\b|\bversus\b|\bcompare\b|\bwhich is better\b|\bwhich one\b/.test(q)) return "compare";
  if (/best opportunit|top opportunit|best invest|top invest|best trade|best stock|best crypto|top pick|highest conviction|what (should i buy|to buy|are the best)|buy list|what stocks|what crypto|investment ideas|trade ideas/.test(q)) return "opportunity_ranking";
  if (/how low|how far (down|it fall|will it drop|can it drop|could it drop|can it fall|could it fall)|how far can|downside|fall to|drop to|crash to|how much (can it|will it) (fall|drop|lose)|bear.?case (price|target|level)|worst.?case (price|target|scenario)|what.?s the (low|bottom|floor)|minimum (price|level)|how bad/.test(q)) return "downside";
  if (/how high|how far (up|can it go|will it rise)|upside|rally to|rise to|ceiling|resistance level|how much (can it|will it) (gain|rise|go up)|bull.?case (price|target|level)|best.?case (price|target)|what.?s the (high|ceiling|top)|maximum (price|level)|price target|moon|target price|where (will|can|could) (it|this|\w+) (go|trade|end up)|where will it go|fair value|fair price|intrinsic value|end of year target|eoy target|12.month target/.test(q)) return "upside";
  if (/where (should i|to) enter|entry (zone|point|price|level)|good (entry|buy point|price to buy)|buy (at|around|near) \$|accumulate (at|around|near)|dip (to buy|entry)|what price (to buy|should i buy)/.test(q)) return "entry_zone";
  if (/where (should i|to) (exit|sell|take profit)|exit (zone|point|price|level)|profit target|sell (at|around|near|target) \$|take profit at|when (should i|to) sell|what price (to sell|should i sell)|trim (at|around)|reduce (at|around)|where (to|should i) take (profit|gains)|sell target|exit target/.test(q)) return "exit_zone";
  if (/should i buy|is (it|this|\w+) (a good|worth) (buy|investment|trade)|is (\w+ )?a good buy|buy or (wait|hold|sell)|good time to buy|right time to buy|buy now|buy today|add (to|more)|accumulate now/.test(q)) return "buy_verdict";
  if (/should i sell|time to (sell|exit)|sell now|sell today|exit now|exit today|lock in (profit|gains)|sell or hold|should i take profit|take (my )?profit now/.test(q)) return "sell_verdict";
  if (/invalidat|what (price|level) (breaks|kills|ends|destroys|invalidates)|thesis (fail|break|end)|where (is|should) (the stop|my stop)|stop.?loss (level|be|for|at)|what breaks|what kills|what ends the bull|what would break/.test(q)) return "invalidation";
  if (/what.?s the risk|how risky|risk level|how dangerous|how safe|risk.?reward|downside risk|tail risk|black swan|worst case|how much (can i|could i) lose|maximum loss|how volatile/.test(q)) return "risk_assessment";
  if (/should i wait|wait (for|until)|hold (off|on)|not yet|too early|too late|right time|is now (a good|the right) time|when (is the right|should i)/.test(q)) return "wait_verdict";
  if (/price target|what.?s (the target|a fair value|fair price|intrinsic value)/.test(q)) return "upside";
  return "general_analysis";
}
