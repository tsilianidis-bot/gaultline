// ============================================================
// FAULTLINE — ALT ROTATION ENGINE™
//
// Institutional-grade crypto altseason probability scoring.
// Detects and quantifies the probability of a developing
// altseason using real market structure, liquidity, momentum,
// and sector rotation data — not hype.
//
// Score: 0–100
//   0–25:  Bitcoin Dominance Regime
//  26–45:  Early Rotation Watch
//  46–65:  Selective Alt Expansion
//  66–85:  Broad Altseason
//  86–100: Speculative Mania Phase
// ============================================================

import { log } from "./logger";

const CG_BASE = "https://api.coingecko.com/api/v3";
const CG_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// ── Types ─────────────────────────────────────────────────────

export interface BtcDominanceData {
  current: number;           // % e.g. 58.02
  trend: "rising" | "falling" | "neutral";
  velocity: number;          // % change in dominance (proxy from ETH/BTC momentum)
  pressure: "high" | "medium" | "low";
  signal: string;
  score: number;             // 0–100 contribution (higher = more altseason)
}

export interface EthLeadershipData {
  ethBtcRatio: number;       // e.g. 0.02727
  ethChange24h: number;
  btcChange24h: number;
  relativePerformance: number; // ETH 24h - BTC 24h
  status: "outperforming" | "underperforming" | "neutral";
  label: string;
  trend: "strengthening" | "weakening" | "neutral";
  score: number;             // 0–100 contribution
}

export interface StablecoinLiquidityData {
  usdtMarketCap: number;     // billions
  usdcMarketCap: number;     // billions
  totalStablecoinCap: number;
  usdtChange24h: number;
  usdcChange24h: number;
  combinedChange24h: number;
  status: "expanding" | "contracting" | "neutral";
  label: string;
  score: number;             // 0–100 contribution
}

export interface SectorCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  momentum: "strong" | "moderate" | "weak" | "negative";
}

export interface SectorData {
  name: string;
  key: string;
  coins: SectorCoin[];
  avgChange24h: number;
  avgChange7d: number;
  momentum: "strong" | "moderate" | "weak" | "negative";
  alert: string | null;
  score: number;             // 0–100 sector momentum score
  color: string;             // display accent color
}

export interface MarketBreadthData {
  total2Proxy: number;       // total market cap excluding BTC (billions)
  total3Proxy: number;       // total market cap excluding BTC+ETH (billions)
  altcoinDominance: number;  // 100 - BTC% - ETH%
  breadthSignal: "expanding" | "contracting" | "neutral";
  score: number;
}

export interface RotationAlert {
  id: string;
  type: "sector_rotation" | "dominance_shift" | "liquidity" | "momentum" | "risk_off";
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  timestamp: number;
}

export interface AltRotationPayload {
  score: number;
  regime: string;
  regimeKey: "btc_dominance" | "early_rotation" | "selective_expansion" | "broad_altseason" | "speculative_mania";
  regimeColor: string;
  btcDominance: BtcDominanceData;
  ethLeadership: EthLeadershipData;
  stablecoinLiquidity: StablecoinLiquidityData;
  sectors: SectorData[];
  marketBreadth: MarketBreadthData;
  alerts: RotationAlert[];
  aiCommentary: string;
  scoreBreakdown: { label: string; weight: number; rawScore: number; contribution: number }[];
  fetchedAt: number;
  dataSource: string;
}

// ── Sector definitions ────────────────────────────────────────

const SECTORS: { key: string; name: string; color: string; coinIds: string[] }[] = [
  {
    key: "ai",
    name: "AI & Compute",
    color: "#00D4FF",
    coinIds: ["render-token", "fetch-ai", "singularitynet", "akash-network", "bittensor"],
  },
  {
    key: "defi",
    name: "DeFi",
    color: "#34D399",
    coinIds: ["uniswap", "aave", "compound-governance-token", "curve-dao-token", "maker"],
  },
  {
    key: "layer2",
    name: "Layer-2",
    color: "#A78BFA",
    coinIds: ["arbitrum", "optimism", "polygon", "starknet", "zksync"],
  },
  {
    key: "gaming",
    name: "Gaming & Metaverse",
    color: "#F59E0B",
    coinIds: ["axie-infinity", "immutable-x", "the-sandbox", "decentraland", "gala"],
  },
  {
    key: "infra",
    name: "Infrastructure",
    color: "#FB923C",
    coinIds: ["chainlink", "polkadot", "cosmos", "avalanche-2", "near"],
  },
  {
    key: "rwa",
    name: "RWA & Tokenization",
    color: "#E879F9",
    coinIds: ["ondo-finance", "centrifuge", "maple", "goldfinch", "clearpool"],
  },
  {
    key: "meme",
    name: "Meme / Speculative",
    color: "#FF2D55",
    coinIds: ["dogecoin", "shiba-inu", "pepe", "bonk", "floki"],
  },
];

// ── Cache ─────────────────────────────────────────────────────

let cachedPayload: AltRotationPayload | null = null;
let cacheTime = 0;

// ── CoinGecko fetch helpers ───────────────────────────────────

async function cgFetch(path: string, apiKey?: string): Promise<unknown> {
  const url = `${CG_BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Scoring helpers ───────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreBtcDominance(dom: number): { score: number; trend: BtcDominanceData["trend"]; pressure: BtcDominanceData["pressure"]; signal: string } {
  // Lower dominance = higher altseason probability
  // Historical: 40% = peak altseason, 65%+ = BTC dominance regime
  let score: number;
  if (dom >= 65) score = 5;
  else if (dom >= 60) score = 15;
  else if (dom >= 55) score = 30;
  else if (dom >= 50) score = 50;
  else if (dom >= 45) score = 70;
  else if (dom >= 40) score = 85;
  else score = 95;

  const trend: BtcDominanceData["trend"] = dom > 58 ? "rising" : dom < 52 ? "falling" : "neutral";
  const pressure: BtcDominanceData["pressure"] = dom > 60 ? "high" : dom > 52 ? "medium" : "low";
  const signal = dom > 60
    ? "BTC dominance elevated — alts under pressure"
    : dom > 52
    ? "BTC dominance moderating — rotation potential building"
    : "BTC dominance weakening — altseason conditions improving";

  return { score, trend, pressure, signal };
}

function scoreEthLeadership(ethChange: number, btcChange: number, ethBtcRatio: number): { score: number; status: EthLeadershipData["status"]; label: string; trend: EthLeadershipData["trend"] } {
  const relPerf = ethChange - btcChange;
  let score: number;

  if (relPerf > 5) score = 90;
  else if (relPerf > 2) score = 75;
  else if (relPerf > 0) score = 60;
  else if (relPerf > -2) score = 40;
  else if (relPerf > -5) score = 25;
  else score = 10;

  const status: EthLeadershipData["status"] = relPerf > 1 ? "outperforming" : relPerf < -1 ? "underperforming" : "neutral";
  const label = status === "outperforming"
    ? "ETH Outperforming BTC"
    : status === "underperforming"
    ? "ETH Weak vs BTC"
    : "ETH Tracking BTC";
  const trend: EthLeadershipData["trend"] = relPerf > 2 ? "strengthening" : relPerf < -2 ? "weakening" : "neutral";

  return { score, status, label, trend };
}

function scoreStablecoinLiquidity(combinedChange: number): { score: number; status: StablecoinLiquidityData["status"]; label: string } {
  let score: number;
  if (combinedChange > 2) score = 85;
  else if (combinedChange > 0.5) score = 70;
  else if (combinedChange > 0) score = 55;
  else if (combinedChange > -0.5) score = 40;
  else if (combinedChange > -2) score = 25;
  else score = 10;

  const status: StablecoinLiquidityData["status"] = combinedChange > 0.3 ? "expanding" : combinedChange < -0.3 ? "contracting" : "neutral";
  const label = status === "expanding" ? "Liquidity Entering Market" : status === "contracting" ? "Liquidity Contracting" : "Liquidity Stable";
  return { score, status, label };
}

function scoreSector(avgChange24h: number, avgChange7d: number): { score: number; momentum: SectorData["momentum"]; alert: string | null } {
  const composite = avgChange24h * 0.6 + avgChange7d * 0.4;
  let score: number;
  if (composite > 10) score = 95;
  else if (composite > 5) score = 80;
  else if (composite > 2) score = 65;
  else if (composite > 0) score = 50;
  else if (composite > -3) score = 35;
  else if (composite > -8) score = 20;
  else score = 5;

  const momentum: SectorData["momentum"] = composite > 5 ? "strong" : composite > 1 ? "moderate" : composite > -3 ? "weak" : "negative";
  const alert = composite > 8 ? "Rotation Detected" : composite > 5 ? "Momentum Expansion" : null;
  return { score, momentum, alert };
}

function computeAltRotationScore(
  btcDomScore: number,
  ethScore: number,
  stableScore: number,
  sectorScore: number,
  breadthScore: number
): number {
  // Weighted average
  const weights = { btcDom: 0.30, eth: 0.25, stable: 0.20, sector: 0.15, breadth: 0.10 };
  const raw =
    btcDomScore * weights.btcDom +
    ethScore * weights.eth +
    stableScore * weights.stable +
    sectorScore * weights.sector +
    breadthScore * weights.breadth;

  return clamp(Math.round(raw));
}

function getRegime(score: number): { regime: string; regimeKey: AltRotationPayload["regimeKey"]; regimeColor: string } {
  if (score <= 25) return { regime: "Bitcoin Dominance Regime", regimeKey: "btc_dominance", regimeColor: "#F59E0B" };
  if (score <= 45) return { regime: "Early Rotation Watch", regimeKey: "early_rotation", regimeColor: "#FB923C" };
  if (score <= 65) return { regime: "Selective Alt Expansion", regimeKey: "selective_expansion", regimeColor: "#00D4FF" };
  if (score <= 85) return { regime: "Broad Altseason", regimeKey: "broad_altseason", regimeColor: "#34D399" };
  return { regime: "Speculative Mania Phase", regimeKey: "speculative_mania", regimeColor: "#FF2D55" };
}

function generateAlerts(
  btcDom: BtcDominanceData,
  eth: EthLeadershipData,
  stable: StablecoinLiquidityData,
  sectors: SectorData[],
  score: number
): RotationAlert[] {
  const alerts: RotationAlert[] = [];
  const now = Date.now();

  if (btcDom.current < 50) {
    alerts.push({
      id: "btc_dom_weak",
      type: "dominance_shift",
      severity: "high",
      title: "Bitcoin Dominance Weakening",
      body: `BTC dominance at ${btcDom.current.toFixed(1)}% — capital rotation into alts accelerating.`,
      timestamp: now,
    });
  } else if (btcDom.current > 62) {
    alerts.push({
      id: "btc_dom_high",
      type: "dominance_shift",
      severity: "medium",
      title: "Bitcoin Dominance Elevated",
      body: `BTC dominance at ${btcDom.current.toFixed(1)}% — altcoin capital under sustained pressure.`,
      timestamp: now,
    });
  }

  if (eth.status === "outperforming" && eth.relativePerformance > 3) {
    alerts.push({
      id: "eth_lead",
      type: "momentum",
      severity: "high",
      title: "Ethereum Leadership Confirmed",
      body: `ETH outperforming BTC by ${eth.relativePerformance.toFixed(1)}% — historically precedes broad altseason.`,
      timestamp: now,
    });
  }

  if (stable.status === "expanding") {
    alerts.push({
      id: "stable_expand",
      type: "liquidity",
      severity: "medium",
      title: "Institutional Liquidity Entering Market",
      body: `Stablecoin supply expanding — dry powder accumulating for deployment into risk assets.`,
      timestamp: now,
    });
  } else if (stable.status === "contracting") {
    alerts.push({
      id: "stable_contract",
      type: "liquidity",
      severity: "high",
      title: "Risk-Off Conditions Returning",
      body: `Stablecoin supply contracting — capital exiting crypto ecosystem.`,
      timestamp: now,
    });
  }

  for (const sector of sectors) {
    if (sector.alert && sector.momentum === "strong") {
      alerts.push({
        id: `sector_${sector.key}`,
        type: "sector_rotation",
        severity: sector.avgChange24h > 10 ? "high" : "medium",
        title: `${sector.name} ${sector.alert}`,
        body: `${sector.name} sector averaging +${sector.avgChange24h.toFixed(1)}% (24h) with synchronized momentum across ${sector.coins.filter(c => c.change24h > 3).length} assets.`,
        timestamp: now,
      });
    }
  }

  if (score >= 66) {
    alerts.push({
      id: "altseason_active",
      type: "momentum",
      severity: "high",
      title: "Broad Altseason Conditions Active",
      body: `Alt Rotation Score at ${score} — systemic capital rotation into altcoins underway.`,
      timestamp: now,
    });
  } else if (score >= 46) {
    alerts.push({
      id: "selective_expansion",
      type: "momentum",
      severity: "medium",
      title: "Selective Alt Expansion Detected",
      body: `Alt Rotation Score at ${score} — selective sector rotation emerging. Monitor AI and DeFi leadership.`,
      timestamp: now,
    });
  }

  return alerts.slice(0, 6); // cap at 6 alerts
}

function generateAiCommentary(
  score: number,
  regime: string,
  btcDom: BtcDominanceData,
  eth: EthLeadershipData,
  stable: StablecoinLiquidityData,
  sectors: SectorData[]
): string {
  const topSector = sectors.sort((a, b) => b.avgChange24h - a.avgChange24h)[0];
  const ethStatus = eth.status === "outperforming" ? "ETH/BTC strengthening" : eth.status === "underperforming" ? "ETH/BTC weakening" : "ETH/BTC neutral";
  const stableStatus = stable.status === "expanding" ? "stablecoin liquidity expanding" : stable.status === "contracting" ? "stablecoin liquidity contracting" : "stablecoin supply stable";

  if (score >= 66) {
    return `Broad altseason conditions confirmed. BTC dominance at ${btcDom.current.toFixed(1)}% with ${ethStatus} and ${stableStatus}. ${topSector.name} sector leading with ${topSector.avgChange24h.toFixed(1)}% average 24h performance. Systemic capital rotation into altcoins is underway — risk appetite elevated across multiple sectors simultaneously.`;
  } else if (score >= 46) {
    return `Selective alt expansion emerging. ${ethStatus} as BTC dominance holds at ${btcDom.current.toFixed(1)}%. ${stableStatus}. ${topSector.name} sector showing early rotation signals (+${topSector.avgChange24h.toFixed(1)}% 24h). Broad altseason not yet confirmed — capital rotation remains concentrated in quality names.`;
  } else if (score >= 26) {
    return `Early rotation watch conditions. BTC dominance at ${btcDom.current.toFixed(1)}% — moderating but not yet at altseason thresholds. ${ethStatus}. ${stableStatus}. Monitor ${topSector.name} sector for breakout confirmation. Conditions are building but not yet actionable for broad alt exposure.`;
  } else {
    return `Bitcoin dominance regime active at ${btcDom.current.toFixed(1)}%. ${ethStatus}. ${stableStatus}. Altcoin capital flows remain suppressed — BTC continues to absorb the majority of crypto market inflows. Wait for dominance breakdown below 55% before increasing alt exposure.`;
  }
}

// ── Main engine ───────────────────────────────────────────────

export async function computeAltRotation(apiKey?: string): Promise<AltRotationPayload> {
  // Return cache if fresh
  if (cachedPayload && Date.now() - cacheTime < CG_CACHE_TTL) {
    return cachedPayload;
  }

  try {
    // 1. Global market data (BTC dominance, total market cap)
    const globalData = await cgFetch("/global", apiKey) as {
      data: {
        market_cap_percentage: Record<string, number>;
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        active_cryptocurrencies: number;
        updated_at: number;
      };
    };
    const gd = globalData.data;
    const btcDomPct = gd.market_cap_percentage.btc ?? 58;
    const ethDomPct = gd.market_cap_percentage.eth ?? 9;
    const totalMcapUsd = gd.total_market_cap.usd ?? 0;

    // 2. BTC + ETH + stablecoin prices
    const priceData = await cgFetch(
      "/simple/price?ids=bitcoin,ethereum,tether,usd-coin&vs_currencies=usd,btc&include_market_cap=true&include_24hr_change=true",
      apiKey
    ) as Record<string, { usd?: number; btc?: number; usd_market_cap?: number; usd_24h_change?: number }>;

    const btcChange24h = priceData.bitcoin?.usd_24h_change ?? 0;
    const ethChange24h = priceData.ethereum?.usd_24h_change ?? 0;
    const ethBtcRatio = priceData.ethereum?.btc ?? 0;
    const usdtMcap = (priceData.tether?.usd_market_cap ?? 0) / 1e9;
    const usdcMcap = (priceData["usd-coin"]?.usd_market_cap ?? 0) / 1e9;

    // 3. Sector coins — batch fetch all sector coin IDs
    const allCoinIds = SECTORS.flatMap(s => s.coinIds).join(",");
    const sectorPrices = await cgFetch(
      `/simple/price?ids=${allCoinIds}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
      apiKey
    ) as Record<string, { usd?: number; usd_market_cap?: number; usd_24h_vol?: number; usd_24h_change?: number }>;

    // 4. 7d change — use markets endpoint for top coins
    const marketsData = await cgFetch(
      "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=7d",
      apiKey
    ) as Array<{ id: string; price_change_percentage_7d_in_currency?: number }>;

    const change7dMap: Record<string, number> = {};
    for (const c of marketsData) {
      change7dMap[c.id] = c.price_change_percentage_7d_in_currency ?? 0;
    }

    // ── Build sector data ─────────────────────────────────────
    const sectors: SectorData[] = SECTORS.map(sectorDef => {
      const coins: SectorCoin[] = sectorDef.coinIds.map(id => {
        const p = sectorPrices[id];
        return {
          id,
          symbol: id.split("-")[0].toUpperCase(),
          name: id.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          price: p?.usd ?? 0,
          change24h: p?.usd_24h_change ?? 0,
          change7d: change7dMap[id] ?? 0,
          marketCap: (p?.usd_market_cap ?? 0) / 1e9,
          volume24h: (p?.usd_24h_vol ?? 0) / 1e6,
          momentum: ((p?.usd_24h_change ?? 0) > 5 ? "strong" : (p?.usd_24h_change ?? 0) > 1 ? "moderate" : (p?.usd_24h_change ?? 0) > -3 ? "weak" : "negative") as SectorCoin["momentum"],
        };
      }).filter(c => c.price > 0);

      const validCoins = coins.filter(c => c.change24h !== 0 || c.price > 0);
      const avgChange24h = validCoins.length > 0
        ? validCoins.reduce((s, c) => s + c.change24h, 0) / validCoins.length
        : 0;
      const avgChange7d = validCoins.length > 0
        ? validCoins.reduce((s, c) => s + c.change7d, 0) / validCoins.length
        : 0;

      const { score, momentum, alert } = scoreSector(avgChange24h, avgChange7d);

      return {
        name: sectorDef.name,
        key: sectorDef.key,
        coins,
        avgChange24h: parseFloat(avgChange24h.toFixed(2)),
        avgChange7d: parseFloat(avgChange7d.toFixed(2)),
        momentum,
        alert: alert ? `${sectorDef.name} ${alert}` : null,
        score,
        color: sectorDef.color,
      };
    });

    // ── BTC Dominance Engine ──────────────────────────────────
    const btcDomScoring = scoreBtcDominance(btcDomPct);
    const btcDominance: BtcDominanceData = {
      current: parseFloat(btcDomPct.toFixed(2)),
      trend: btcDomScoring.trend,
      velocity: parseFloat((btcChange24h - ethChange24h).toFixed(2)),
      pressure: btcDomScoring.pressure,
      signal: btcDomScoring.signal,
      score: btcDomScoring.score,
    };

    // ── ETH Leadership Index ──────────────────────────────────
    const ethScoring = scoreEthLeadership(ethChange24h, btcChange24h, ethBtcRatio);
    const ethLeadership: EthLeadershipData = {
      ethBtcRatio: parseFloat(ethBtcRatio.toFixed(5)),
      ethChange24h: parseFloat(ethChange24h.toFixed(2)),
      btcChange24h: parseFloat(btcChange24h.toFixed(2)),
      relativePerformance: parseFloat((ethChange24h - btcChange24h).toFixed(2)),
      status: ethScoring.status,
      label: ethScoring.label,
      trend: ethScoring.trend,
      score: ethScoring.score,
    };

    // ── Stablecoin Liquidity Engine ───────────────────────────
    const totalStable = usdtMcap + usdcMcap;
    // Proxy combined 24h change from individual changes (weighted)
    const combinedStableChange = usdtMcap > 0 && usdcMcap > 0
      ? (priceData.tether?.usd_24h_change ?? 0) * (usdtMcap / totalStable) +
        (priceData["usd-coin"]?.usd_24h_change ?? 0) * (usdcMcap / totalStable)
      : 0;
    const stableScoring = scoreStablecoinLiquidity(combinedStableChange);
    const stablecoinLiquidity: StablecoinLiquidityData = {
      usdtMarketCap: parseFloat(usdtMcap.toFixed(1)),
      usdcMarketCap: parseFloat(usdcMcap.toFixed(1)),
      totalStablecoinCap: parseFloat(totalStable.toFixed(1)),
      usdtChange24h: parseFloat((priceData.tether?.usd_24h_change ?? 0).toFixed(3)),
      usdcChange24h: parseFloat((priceData["usd-coin"]?.usd_24h_change ?? 0).toFixed(3)),
      combinedChange24h: parseFloat(combinedStableChange.toFixed(3)),
      status: stableScoring.status,
      label: stableScoring.label,
      score: stableScoring.score,
    };

    // ── Market Breadth (TOTAL2/TOTAL3 proxy) ──────────────────
    const btcMcap = (priceData.bitcoin?.usd_market_cap ?? 0) / 1e9;
    const ethMcap = (priceData.ethereum?.usd_market_cap ?? 0) / 1e9;
    const totalMcapB = totalMcapUsd / 1e9;
    const total2Proxy = totalMcapB - btcMcap;
    const total3Proxy = totalMcapB - btcMcap - ethMcap;
    const altcoinDominance = 100 - btcDomPct - ethDomPct;
    const breadthScore = clamp(Math.round((altcoinDominance / 40) * 100)); // 40% altcoin dom = 100
    const marketBreadth: MarketBreadthData = {
      total2Proxy: parseFloat(total2Proxy.toFixed(0)),
      total3Proxy: parseFloat(total3Proxy.toFixed(0)),
      altcoinDominance: parseFloat(altcoinDominance.toFixed(2)),
      breadthSignal: altcoinDominance > 35 ? "expanding" : altcoinDominance < 25 ? "contracting" : "neutral",
      score: breadthScore,
    };

    // ── Sector composite score ────────────────────────────────
    const sectorComposite = sectors.length > 0
      ? sectors.reduce((s, sec) => s + sec.score, 0) / sectors.length
      : 50;

    // ── Final rotation score ──────────────────────────────────
    const score = computeAltRotationScore(
      btcDominance.score,
      ethLeadership.score,
      stablecoinLiquidity.score,
      sectorComposite,
      marketBreadth.score
    );

    const { regime, regimeKey, regimeColor } = getRegime(score);

    // ── Score breakdown ───────────────────────────────────────
    const scoreBreakdown = [
      { label: "BTC Dominance Engine", weight: 30, rawScore: btcDominance.score, contribution: Math.round(btcDominance.score * 0.30) },
      { label: "ETH Leadership Index", weight: 25, rawScore: ethLeadership.score, contribution: Math.round(ethLeadership.score * 0.25) },
      { label: "Stablecoin Liquidity", weight: 20, rawScore: stablecoinLiquidity.score, contribution: Math.round(stablecoinLiquidity.score * 0.20) },
      { label: "Sector Rotation", weight: 15, rawScore: Math.round(sectorComposite), contribution: Math.round(sectorComposite * 0.15) },
      { label: "Market Breadth", weight: 10, rawScore: marketBreadth.score, contribution: Math.round(marketBreadth.score * 0.10) },
    ];

    // ── Alerts ────────────────────────────────────────────────
    const alerts = generateAlerts(btcDominance, ethLeadership, stablecoinLiquidity, sectors, score);

    // ── AI Commentary ─────────────────────────────────────────
    const aiCommentary = generateAiCommentary(score, regime, btcDominance, ethLeadership, stablecoinLiquidity, sectors);

    const payload: AltRotationPayload = {
      score,
      regime,
      regimeKey,
      regimeColor,
      btcDominance,
      ethLeadership,
      stablecoinLiquidity,
      sectors,
      marketBreadth,
      alerts,
      aiCommentary,
      scoreBreakdown,
      fetchedAt: Date.now(),
      dataSource: "CoinGecko",
    };

    cachedPayload = payload;
    cacheTime = Date.now();
    log.info(`[AltRotation] Score: ${score} | Regime: ${regime} | BTC Dom: ${btcDomPct.toFixed(1)}%`);
    return payload;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[AltRotation] Fetch failed: ${msg}`);
    throw new Error(`Alt Rotation Engine data fetch failed: ${msg}`);
  }
}

export function clearAltRotationCache(): void {
  cachedPayload = null;
  cacheTime = 0;
}
