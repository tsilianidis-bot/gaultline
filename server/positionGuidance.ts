// ============================================================
// FAULTLINE Position Guidance™ — server/positionGuidance.ts
//
// Generates risk-based action bias for tracked assets using a
// weighted blend of 10 scoring factors derived from FAULTLINE
// pressure data + asset-specific characteristics.
//
// Action labels: Add | Hold | Trim | Watch / No Add |
//                Exit Watch | Sell Bias
//
// Scoring conversion (per brief):
//   80–100 = Add
//   65–79  = Hold / Add on Pullback
//   50–64  = Hold
//   35–49  = Trim
//   20–34  = Exit Watch
//   0–19   = Sell Bias
// ============================================================

import { invokeLLM } from "./_core/llm";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";

// ── Types ────────────────────────────────────────────────────

export type PositionAction =
  | "Add"
  | "Hold"
  | "Trim"
  | "Watch / No Add"
  | "Exit Watch"
  | "Sell Bias";

export type ConvictionLevel = "High" | "Moderate" | "Low";
export type PositionTimeframe = "Today" | "Week" | "Month" | "Year";

export interface AssetScores {
  assetSignalScore: number;      // 0–100
  marketRegimeScore: number;     // 0–100 (higher = more favorable)
  pressureIndexScore: number;    // 0–100 (inverted from pressure)
  sectorStrengthScore: number;   // 0–100
  momentumScore: number;         // 0–100
  volatilityScore: number;       // 0–100 (higher = more volatile = worse)
  liquidityScore: number;        // 0–100 (inverted from liquidity stress)
  macroRiskScore: number;        // 0–100 (inverted from macro pressure)
  breadthScore: number;          // 0–100 (inverted from breadth stress)
  trendSupportScore: number;     // 0–100
  compositeScore: number;        // weighted blend 0–100
}

export interface PositionGuidanceCard {
  ticker: string;
  name: string;
  assetType: "Stock" | "ETF" | "Crypto" | "Index";
  action: PositionAction;
  conviction: ConvictionLevel;
  timeframe: PositionTimeframe;
  currentPrice: string;          // placeholder — "$219.51" or "N/A"
  pressureIndex: number;
  regime: string;
  regimeLabel: string;
  scores: AssetScores;
  trendCondition: string;
  supportLevel: string;          // placeholder level description
  keyDrivers: string[];          // 3–5 bullets
  aiInterpretation: string;      // 2–3 sentence paragraph
  suggestedBehavior: string;     // 1–2 sentence action description
  invalidationCondition: string; // what would change the signal
  nextConditionToWatch: string;  // what to monitor
  whyThisSignal: {
    cause: string;               // what caused the action bias
    driver: string;              // asset strength vs market risk
    issueType: string;           // macro / technical / sector / volatility
    whatImproves: string;        // what would improve the signal
    whatWorsens: string;         // what would worsen the signal
  };
  cached?: boolean;
}

// ── Demo asset catalog ────────────────────────────────────────

interface AssetProfile {
  ticker: string;
  name: string;
  assetType: "Stock" | "ETF" | "Crypto" | "Index";
  sector: string;
  // Intrinsic characteristics (0–100, higher = more of that trait)
  aiExposure: number;
  debtRisk: number;
  recessionSensitivity: number;
  volatilityBase: number;
  momentumBase: number;
  sectorStrengthBase: number;
  priceNote: string;
}

const DEMO_ASSETS: AssetProfile[] = [
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF",
    assetType: "ETF",
    sector: "Broad Market",
    aiExposure: 35,
    debtRisk: 20,
    recessionSensitivity: 65,
    volatilityBase: 30,
    momentumBase: 55,
    sectorStrengthBase: 60,
    priceNote: "Prev Close — see Signals tab",
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    assetType: "ETF",
    sector: "Technology / Growth",
    aiExposure: 70,
    debtRisk: 25,
    recessionSensitivity: 70,
    volatilityBase: 45,
    momentumBase: 60,
    sectorStrengthBase: 65,
    priceNote: "Prev Close — see Signals tab",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    assetType: "Stock",
    sector: "Semiconductors / AI",
    aiExposure: 95,
    debtRisk: 20,
    recessionSensitivity: 75,
    volatilityBase: 65,
    momentumBase: 75,
    sectorStrengthBase: 80,
    priceNote: "$219.51 (May 21 close)",
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    assetType: "Stock",
    sector: "Consumer Technology",
    aiExposure: 50,
    debtRisk: 30,
    recessionSensitivity: 55,
    volatilityBase: 35,
    momentumBase: 55,
    sectorStrengthBase: 70,
    priceNote: "$304.99 (May 21 close)",
  },
  {
    ticker: "TSLA",
    name: "Tesla, Inc.",
    assetType: "Stock",
    sector: "EV / Consumer Discretionary",
    aiExposure: 60,
    debtRisk: 40,
    recessionSensitivity: 80,
    volatilityBase: 80,
    momentumBase: 50,
    sectorStrengthBase: 45,
    priceNote: "$417.85 (May 21 close)",
  },
  {
    ticker: "BTC",
    name: "Bitcoin",
    assetType: "Crypto",
    sector: "Digital Assets",
    aiExposure: 40,
    debtRisk: 10,
    recessionSensitivity: 85,
    volatilityBase: 90,
    momentumBase: 55,
    sectorStrengthBase: 50,
    priceNote: "Placeholder — live data not connected",
  },
  {
    ticker: "ETH",
    name: "Ethereum",
    assetType: "Crypto",
    sector: "Digital Assets / Smart Contracts",
    aiExposure: 45,
    debtRisk: 10,
    recessionSensitivity: 85,
    volatilityBase: 85,
    momentumBase: 50,
    sectorStrengthBase: 45,
    priceNote: "Placeholder — live data not connected",
  },
];

// ── Scoring engine ────────────────────────────────────────────

function getVectorScore(
  vectors: FaultlinePressureOutput["vectors"],
  id: string,
  fallback = 30
): number {
  return vectors.find(v => v.id === id)?.score ?? fallback;
}

function computeAssetScores(
  asset: AssetProfile,
  pressure: FaultlinePressureOutput
): AssetScores {
  const p = pressure.overallPressure;
  const { vectors } = pressure;

  const liquidityStress = getVectorScore(vectors, "liquidity-stress");
  const creditStress    = getVectorScore(vectors, "credit-contagion");
  const volatilityStress = getVectorScore(vectors, "volatility-regime");
  const macroStress     = getVectorScore(vectors, "macro-sensitivity");
  const breadthStress   = getVectorScore(vectors, "market-breadth");
  const aiStress        = getVectorScore(vectors, "ai-bubble");

  // Asset signal: momentum + sector strength, penalized by recession sensitivity under stress
  const recessionPenalty = p >= 60 ? (asset.recessionSensitivity / 100) * 20 : 0;
  const assetSignalScore = Math.max(0, Math.min(100,
    Math.round(asset.momentumBase * 0.5 + asset.sectorStrengthBase * 0.5 - recessionPenalty)
  ));

  // Market regime: inverted pressure, more favorable when pressure is low
  const marketRegimeScore = Math.max(0, Math.min(100, Math.round(100 - p)));

  // Pressure index score: direct inversion
  const pressureIndexScore = Math.max(0, Math.min(100, Math.round(100 - p)));

  // Sector strength: asset's base sector strength, penalized by breadth stress
  const sectorStrengthScore = Math.max(0, Math.min(100,
    Math.round(asset.sectorStrengthBase - breadthStress * 0.3)
  ));

  // Momentum: asset base momentum, penalized by overall pressure
  const momentumScore = Math.max(0, Math.min(100,
    Math.round(asset.momentumBase - p * 0.2)
  ));

  // Volatility: asset base + market volatility (higher = worse for scoring)
  const volatilityScore = Math.min(100,
    Math.round(asset.volatilityBase * 0.6 + volatilityStress * 0.4)
  );

  // Liquidity: inverted liquidity stress, penalized by asset debt risk
  const liquidityScore = Math.max(0, Math.min(100,
    Math.round((100 - liquidityStress) - asset.debtRisk * 0.2)
  ));

  // Macro risk: inverted macro stress, penalized by asset recession sensitivity
  const macroRiskScore = Math.max(0, Math.min(100,
    Math.round((100 - macroStress) - asset.recessionSensitivity * 0.15)
  ));

  // Breadth: inverted breadth stress
  const breadthScore = Math.max(0, Math.min(100, Math.round(100 - breadthStress)));

  // Trend support: combination of momentum + inverted credit stress
  const trendSupportScore = Math.max(0, Math.min(100,
    Math.round(asset.momentumBase * 0.5 + (100 - creditStress) * 0.5)
  ));

  // Weighted composite (per brief weights)
  const compositeScore = Math.round(
    assetSignalScore    * 0.15 +
    marketRegimeScore   * 0.15 +
    pressureIndexScore  * 0.10 +
    sectorStrengthScore * 0.10 +
    momentumScore       * 0.10 +
    (100 - volatilityScore) * 0.10 +  // invert: lower volatility = better
    liquidityScore      * 0.10 +
    macroRiskScore      * 0.10 +
    breadthScore        * 0.05 +
    trendSupportScore   * 0.05
  );

  return {
    assetSignalScore,
    marketRegimeScore,
    pressureIndexScore,
    sectorStrengthScore,
    momentumScore,
    volatilityScore,
    liquidityScore,
    macroRiskScore,
    breadthScore,
    trendSupportScore,
    compositeScore,
  };
}

function scoreToAction(compositeScore: number): PositionAction {
  if (compositeScore >= 80) return "Add";
  if (compositeScore >= 65) return "Hold";          // Hold / Add on Pullback
  if (compositeScore >= 50) return "Watch / No Add"; // Hold — conditions mixed
  if (compositeScore >= 35) return "Trim";
  if (compositeScore >= 20) return "Exit Watch";
  return "Sell Bias";
}

function scoreToConviction(compositeScore: number, pressure: number): ConvictionLevel {
  const distance = Math.abs(compositeScore - 50);
  if (distance >= 25 && pressure >= 60) return "High";
  if (distance >= 15) return "Moderate";
  return "Low";
}

function deriveTrendCondition(asset: AssetProfile, pressure: number): string {
  if (pressure >= 70 && asset.recessionSensitivity >= 70) {
    return "Trend under pressure — macro headwinds increasing";
  }
  if (asset.momentumBase >= 65 && pressure <= 50) {
    return "Uptrend intact — momentum constructive";
  }
  if (asset.momentumBase >= 50) {
    return "Trend neutral — watching for directional confirmation";
  }
  return "Trend weakening — below key moving averages";
}

function deriveSupportLevel(asset: AssetProfile, pressure: number): string {
  if (asset.assetType === "Crypto") {
    return "Key support levels vary — see live chart for current levels";
  }
  if (pressure >= 65) {
    return "Support levels at risk — elevated pressure may test key floors";
  }
  return "Support holding — monitor for breakdown below recent lows";
}

function deriveKeyDrivers(
  asset: AssetProfile,
  scores: AssetScores,
  pressure: FaultlinePressureOutput
): string[] {
  const drivers: string[] = [];
  const p = pressure.overallPressure;

  if (p >= 60) drivers.push(`Market pressure elevated at ${p}/100`);
  if (scores.volatilityScore >= 65) drivers.push(`${asset.ticker} volatility elevated — position sizing critical`);
  if (asset.aiExposure >= 70) drivers.push("AI/mega-cap concentration risk — sector crowding elevated");
  if (scores.momentumScore >= 65) drivers.push("Momentum constructive — trend following conditions present");
  if (scores.momentumScore <= 35) drivers.push("Momentum weakening — trend deteriorating");
  if (scores.sectorStrengthScore <= 40) drivers.push("Sector strength weakening — leadership narrowing");
  if (scores.sectorStrengthScore >= 65) drivers.push("Sector strength positive — leadership broad");
  if (scores.macroRiskScore <= 40) drivers.push("Macro risk elevated — rate and credit conditions tightening");
  if (scores.liquidityScore <= 40) drivers.push("Liquidity conditions constrained — funding stress rising");
  if (asset.recessionSensitivity >= 75 && p >= 55) {
    drivers.push(`${asset.ticker} is highly recession-sensitive — elevated macro risk is a direct headwind`);
  }

  if (drivers.length === 0) {
    drivers.push("Conditions broadly neutral — no dominant risk driver identified");
    drivers.push(`Composite score: ${scores.compositeScore}/100`);
  }

  return drivers.slice(0, 5);
}

// ── LLM interpretation ────────────────────────────────────────

const guidanceCache = new Map<string, { result: PositionGuidanceCard; fetchedAt: number }>();
const GUIDANCE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function generatePositionInterpretation(
  asset: AssetProfile,
  action: PositionAction,
  conviction: ConvictionLevel,
  scores: AssetScores,
  pressure: FaultlinePressureOutput,
  keyDrivers: string[]
): Promise<{
  aiInterpretation: string;
  suggestedBehavior: string;
  invalidationCondition: string;
  nextConditionToWatch: string;
  whyThisSignal: PositionGuidanceCard["whyThisSignal"];
}> {
  const p = pressure.overallPressure;
  const regime = pressure.regime;

  const systemPrompt = `You are FAULTLINE's institutional position guidance engine. You interpret structured market-risk scores and produce clear, professional, non-hyped position guidance. Tone: institutional, serious, direct, non-generic. NEVER say "crash guaranteed", "buy now", "sell everything", or use hype language. This is market-risk interpretation, not personalized financial advice.`;

  const userPrompt = `Generate FAULTLINE Position Guidance™ for ${asset.ticker} (${asset.name}).

STRUCTURED SCORES (interpret these — do not invent data):
- Action: ${action}
- Conviction: ${conviction}
- FAULTLINE Pressure Index: ${p}/100
- Market Regime: ${regime}
- Composite Score: ${scores.compositeScore}/100
- Asset Signal Score: ${scores.assetSignalScore}/100
- Sector Strength: ${scores.sectorStrengthScore}/100
- Momentum: ${scores.momentumScore}/100
- Volatility: ${scores.volatilityScore}/100 (higher = more volatile)
- Macro Risk Score: ${scores.macroRiskScore}/100
- Trend Support: ${scores.trendSupportScore}/100
- Key Drivers: ${keyDrivers.slice(0, 3).join("; ")}
- Asset Type: ${asset.assetType}
- Sector: ${asset.sector}

Return JSON with exactly these fields:
- "aiInterpretation": 2–3 sentence paragraph. Start with "${asset.ticker} [observation about current conditions]". Reference specific scores. End with what the signal means for positioning.
- "suggestedBehavior": 1–2 sentences describing the specific position action (e.g., "Trim 10–25% of overweight exposure, hold the remaining core position").
- "invalidationCondition": 1 sentence describing what would change this signal (e.g., "If ${asset.ticker} closes below key trend support...").
- "nextConditionToWatch": 1 sentence describing the most important thing to monitor.
- "whyThisSignal": object with:
  - "cause": 1 sentence — what caused the action bias
  - "driver": 1 sentence — whether driven by asset strength or market risk
  - "issueType": one of "Macro", "Technical", "Sector", "Volatility", "Mixed"
  - "whatImproves": 1 sentence — what would improve the signal
  - "whatWorsens": 1 sentence — what would worsen the signal`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "faultline_position_guidance",
          strict: true,
          schema: {
            type: "object",
            properties: {
              aiInterpretation: { type: "string" },
              suggestedBehavior: { type: "string" },
              invalidationCondition: { type: "string" },
              nextConditionToWatch: { type: "string" },
              whyThisSignal: {
                type: "object",
                properties: {
                  cause: { type: "string" },
                  driver: { type: "string" },
                  issueType: { type: "string", enum: ["Macro", "Technical", "Sector", "Volatility", "Mixed"] },
                  whatImproves: { type: "string" },
                  whatWorsens: { type: "string" },
                },
                required: ["cause", "driver", "issueType", "whatImproves", "whatWorsens"],
                additionalProperties: false,
              },
            },
            required: ["aiInterpretation", "suggestedBehavior", "invalidationCondition", "nextConditionToWatch", "whyThisSignal"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Empty LLM response");
    return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  } catch {
    // Fallback interpretation
    return {
      aiInterpretation: `${asset.ticker} is showing a composite score of ${scores.compositeScore}/100 under ${regime} conditions. ${action === "Trim" || action === "Exit Watch" || action === "Sell Bias" ? "Market pressure and deteriorating conditions suggest reducing exposure." : action === "Add" ? "Conditions remain constructive for adding exposure." : "Current conditions favor maintaining the existing position."} Risk management should reflect the current ${p >= 61 ? "elevated" : "moderate"} pressure environment.`,
      suggestedBehavior: action === "Trim"
        ? "Trim 10–25% of overweight exposure, hold the remaining core position, and avoid adding until market pressure eases."
        : action === "Add"
        ? "Conditions support adding exposure on pullbacks toward support. Use position sizing appropriate to the current volatility regime."
        : action === "Hold"
        ? "Maintain current position size. Avoid adding until conditions improve or reduce if pressure escalates."
        : action === "Watch / No Add"
        ? "Do not add to the position. Monitor for improved conditions before considering new exposure."
        : action === "Exit Watch"
        ? "Prepare to reduce or exit if trend support breaks. Tighten stop levels."
        : "Conditions favor reducing or exiting exposure. Prioritize capital preservation.",
      invalidationCondition: `If ${asset.ticker} breaks below key trend support, the signal may shift to a more defensive posture.`,
      nextConditionToWatch: `Monitor FAULTLINE Pressure Index and ${asset.sector} sector strength for directional confirmation.`,
      whyThisSignal: {
        cause: `Composite score of ${scores.compositeScore}/100 driven by ${scores.momentumScore >= 60 ? "strong momentum" : "weakening momentum"} and ${p >= 60 ? "elevated" : "moderate"} macro pressure.`,
        driver: p >= 60 ? "Primarily driven by market-wide risk conditions rather than asset-specific weakness." : "Driven by a combination of asset signal strength and macro conditions.",
        issueType: p >= 65 ? "Macro" : scores.volatilityScore >= 65 ? "Volatility" : scores.sectorStrengthScore <= 40 ? "Sector" : "Mixed",
        whatImproves: "A reduction in FAULTLINE Pressure Index below 50 and improving sector breadth would strengthen the signal.",
        whatWorsens: "A break below trend support or escalation in credit/liquidity stress would weaken the signal.",
      },
    };
  }
}

// ── Main export ───────────────────────────────────────────────

export async function getPositionGuidance(
  tickers?: string[],
  pressureData?: FaultlinePressureOutput
): Promise<PositionGuidanceCard[]> {
  const pressure = pressureData ?? await calculateFaultlinePressure();
  const assetsToProcess = tickers && tickers.length > 0
    ? DEMO_ASSETS.filter(a => tickers.includes(a.ticker))
    : DEMO_ASSETS;

  const results = await Promise.all(
    assetsToProcess.map(async (asset) => {
      const cacheKey = `${asset.ticker}:${pressure.overallPressure}:${new Date().toISOString().slice(0, 13)}`;
      const cached = guidanceCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < GUIDANCE_CACHE_TTL_MS) {
        return { ...cached.result, cached: true };
      }

      const scores = computeAssetScores(asset, pressure);
      const action = scoreToAction(scores.compositeScore);
      const conviction = scoreToConviction(scores.compositeScore, pressure.overallPressure);
      const trendCondition = deriveTrendCondition(asset, pressure.overallPressure);
      const supportLevel = deriveSupportLevel(asset, pressure.overallPressure);
      const keyDrivers = deriveKeyDrivers(asset, scores, pressure);

      // Determine timeframe based on conviction + pressure
      const timeframe: PositionTimeframe =
        pressure.overallPressure >= 70 ? "Today" :
        pressure.overallPressure >= 50 ? "Week" :
        "Month";

      const interpretation = await generatePositionInterpretation(
        asset, action, conviction, scores, pressure, keyDrivers
      );

      const card: PositionGuidanceCard = {
        ticker: asset.ticker,
        name: asset.name,
        assetType: asset.assetType,
        action,
        conviction,
        timeframe,
        currentPrice: asset.priceNote,
        pressureIndex: pressure.overallPressure,
        regime: pressure.regime,
        regimeLabel: pressure.level,
        scores,
        trendCondition,
        supportLevel,
        keyDrivers,
        ...interpretation,
        cached: false,
      };

      guidanceCache.set(cacheKey, { result: card, fetchedAt: Date.now() });
      return card;
    })
  );

  return results;
}

export function clearGuidanceCache(): void {
  guidanceCache.clear();
}

export { DEMO_ASSETS };
