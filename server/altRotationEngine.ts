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
  current: number | null;    // % e.g. 58.02; null when CoinGecko did not supply it
  trend: "rising" | "falling" | "neutral" | null;
  velocity: number | null;   // % change in dominance (proxy from ETH/BTC momentum)
  pressure: "high" | "medium" | "low" | null;
  signal: string;
  score: number | null;      // null when dominance was not observed
}

export interface EthLeadershipData {
  ethBtcRatio: number | null;       // e.g. 0.02727
  ethChange24h: number | null;
  btcChange24h: number | null;
  relativePerformance: number | null; // ETH 24h - BTC 24h
  status: "outperforming" | "underperforming" | "neutral" | "unavailable";
  label: string;
  trend: "strengthening" | "weakening" | "neutral" | "unavailable";
  score: number | null;             // null when a change was not supplied
}

export interface StablecoinLiquidityData {
  usdtMarketCap: number | null;     // billions
  usdcMarketCap: number | null;     // billions
  totalStablecoinCap: number | null;
  usdtChange24h: number | null;
  usdcChange24h: number | null;
  combinedChange24h: number | null;
  status: "expanding" | "contracting" | "neutral" | "unavailable";
  label: string;
  score: number | null;             // null when cap or change was not supplied
}

export interface SectorCoin {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  momentum: "strong" | "moderate" | "weak" | "negative" | "unavailable";
}

export interface SectorData {
  name: string;
  key: string;
  coins: SectorCoin[];
  avgChange24h: number | null;
  avgChange7d: number | null;
  momentum: "strong" | "moderate" | "weak" | "negative" | "unavailable";
  alert: string | null;
  score: number | null;      // null when the sector changes were not supplied
  color: string;             // display accent color
}

export interface MarketBreadthData {
  total2Proxy: number | null;       // total market cap excluding BTC (billions)
  total3Proxy: number | null;       // total market cap excluding BTC+ETH (billions)
  altcoinDominance: number | null;  // 100 - BTC% - ETH%; null when either reading is missing
  ethDominance: number | null;
  breadthSignal: "expanding" | "contracting" | "neutral" | "unavailable";
  score: number | null;
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
  ethDominance: number | null;
  ethLeadership: EthLeadershipData;
  stablecoinLiquidity: StablecoinLiquidityData;
  sectors: SectorData[];
  marketBreadth: MarketBreadthData;
  alerts: RotationAlert[];
  aiCommentary: string;
  scoreBreakdown: { label: string; weight: number; rawScore: number | null; contribution: number | null }[];
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

function observedPercent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scaled(value: unknown, divisor: number): number | null {
  const n = finiteNumber(value);
  return n == null ? null : n / divisor;
}

function fixedOrNull(value: number | null, digits: number): number | null {
  return value == null ? null : parseFloat(value.toFixed(digits));
}

function dominancePhrase(current: number | null): string {
  return current == null ? "BTC dominance unavailable" : `BTC dominance at ${current.toFixed(1)}%`;
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
  btcDomScore: number | null,
  ethScore: number | null,
  stableScore: number | null,
  sectorScore: number | null,
  breadthScore: number | null
): number {
  // Observed inputs keep the original weights. A missing component is omitted
  // from both sides and cannot move the score.
  if (btcDomScore != null && ethScore != null && stableScore != null && sectorScore != null && breadthScore != null) {
    const raw =
      btcDomScore * 0.30 +
      ethScore * 0.25 +
      stableScore * 0.20 +
      sectorScore * 0.15 +
      breadthScore * 0.10;
    return clamp(Math.round(raw));
  }
  const parts = [
    btcDomScore == null ? null : { score: btcDomScore, weight: 0.30 },
    ethScore == null ? null : { score: ethScore, weight: 0.25 },
    stableScore == null ? null : { score: stableScore, weight: 0.20 },
    sectorScore == null ? null : { score: sectorScore, weight: 0.15 },
    breadthScore == null ? null : { score: breadthScore, weight: 0.10 },
  ].filter((part): part is { score: number; weight: number } => part != null);
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (weight <= 0) return 0;
  return clamp(Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weight));
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
  const dominanceText = dominancePhrase(btcDom.current);

  if (btcDom.current != null && btcDom.current < 50) {
    alerts.push({
      id: "btc_dom_weak",
      type: "dominance_shift",
      severity: "high",
      title: "Bitcoin Dominance Weakening",
      body: `${dominanceText} — capital rotation into alts accelerating.`,
      timestamp: now,
    });
  } else if (btcDom.current != null && btcDom.current > 62) {
    alerts.push({
      id: "btc_dom_high",
      type: "dominance_shift",
      severity: "medium",
      title: "Bitcoin Dominance Elevated",
      body: `${dominanceText} — altcoin capital under sustained pressure.`,
      timestamp: now,
    });
  }

  if (eth.status === "outperforming" && eth.relativePerformance != null && eth.relativePerformance > 3) {
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
      title: "Lower appetite Conditions Returning",
      body: `Stablecoin supply contracting — capital exiting crypto ecosystem.`,
      timestamp: now,
    });
  }

  for (const sector of sectors) {
    if (sector.alert && sector.momentum === "strong" && sector.avgChange24h != null) {
      alerts.push({
        id: `sector_${sector.key}`,
        type: "sector_rotation",
        severity: sector.avgChange24h > 10 ? "high" : "medium",
        title: `${sector.name} ${sector.alert}`,
        body: `${sector.name} sector averaging +${sector.avgChange24h.toFixed(1)}% (24h) with synchronized momentum across ${sector.coins.filter(c => c.change24h != null && c.change24h > 3).length} assets.`,
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
  const topSector = [...sectors].sort((a, b) => (b.avgChange24h ?? Number.NEGATIVE_INFINITY) - (a.avgChange24h ?? Number.NEGATIVE_INFINITY))[0];
  const topMove = topSector?.avgChange24h == null ? "unavailable" : `${topSector.avgChange24h.toFixed(1)}%`;
  const dominanceText = dominancePhrase(btcDom.current);
  const ethStatus = eth.status === "outperforming" ? "ETH/BTC strengthening" : eth.status === "underperforming" ? "ETH/BTC weakening" : "ETH/BTC neutral";
  const stableStatus = stable.status === "expanding" ? "stablecoin liquidity expanding" : stable.status === "contracting" ? "stablecoin liquidity contracting" : "stablecoin supply stable";

  if (score >= 66) {
    return `Broad altseason conditions confirmed. ${dominanceText} with ${ethStatus} and ${stableStatus}. ${topSector.name} sector leading with ${topMove} average 24h performance. Systemic capital rotation into altcoins is underway — risk appetite elevated across multiple sectors simultaneously.`;
  } else if (score >= 46) {
    const holds = btcDom.current == null ? "BTC dominance is unavailable" : `BTC dominance holds at ${btcDom.current.toFixed(1)}%`;
    const earlyMove = topSector?.avgChange24h == null ? "unavailable" : `+${topSector.avgChange24h.toFixed(1)}%`;
    return `Selective alt expansion emerging. ${ethStatus} as ${holds}. ${stableStatus}. ${topSector.name} sector showing early rotation signals (${earlyMove} 24h). Broad altseason not yet confirmed — capital rotation remains concentrated in quality names.`;
  } else if (score >= 26) {
    return `Early rotation watch conditions. ${dominanceText} — moderating but not yet at altseason thresholds. ${ethStatus}. ${stableStatus}. Monitor ${topSector.name} sector for breakout confirmation. Conditions are building but not yet actionable for broad alt exposure.`;
  } else if (btcDom.current == null) {
    return `Bitcoin dominance unavailable. ${ethStatus}. ${stableStatus}. Altcoin capital flows cannot be read from a missing dominance print. This is not an all-clear signal.`;
  } else {
    return `Bitcoin dominance is ${btcDom.current.toFixed(1)}% on this print. ${ethStatus}. ${stableStatus}. The card does not publish a position change.`;
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
    const btcDomPct = observedPercent(gd.market_cap_percentage?.btc);
    const ethDomPct = observedPercent(gd.market_cap_percentage?.eth);
    const totalMcapUsd = finiteNumber(gd.total_market_cap?.usd);

    // 2. BTC + ETH + stablecoin prices
    const priceData = await cgFetch(
      "/simple/price?ids=bitcoin,ethereum,tether,usd-coin&vs_currencies=usd,btc&include_market_cap=true&include_24hr_change=true",
      apiKey
    ) as Record<string, { usd?: number; btc?: number; usd_market_cap?: number; usd_24h_change?: number }>;

    const btcChange24h = finiteNumber(priceData.bitcoin?.usd_24h_change);
    const ethChange24h = finiteNumber(priceData.ethereum?.usd_24h_change);
    const ethBtcRatio = finiteNumber(priceData.ethereum?.btc);
    const usdtMcap = scaled(priceData.tether?.usd_market_cap, 1e9);
    const usdcMcap = scaled(priceData["usd-coin"]?.usd_market_cap, 1e9);
    const usdtChange = finiteNumber(priceData.tether?.usd_24h_change);
    const usdcChange = finiteNumber(priceData["usd-coin"]?.usd_24h_change);

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

    const change7dMap: Record<string, number | null> = {};
    for (const c of marketsData) {
      change7dMap[c.id] = finiteNumber(c.price_change_percentage_7d_in_currency);
    }

    // ── Build sector data ─────────────────────────────────────
    const sectors: SectorData[] = SECTORS.map(sectorDef => {
      const coins: SectorCoin[] = sectorDef.coinIds.map(id => {
        const p = sectorPrices[id];
        const change24h = finiteNumber(p?.usd_24h_change);
        return {
          id,
          symbol: id.split("-")[0].toUpperCase(),
          name: id.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          price: finiteNumber(p?.usd),
          change24h,
          change7d: change7dMap[id] ?? null,
          marketCap: scaled(p?.usd_market_cap, 1e9),
          volume24h: scaled(p?.usd_24h_vol, 1e6),
          momentum: (change24h == null ? "unavailable" : change24h > 5 ? "strong" : change24h > 1 ? "moderate" : change24h > -3 ? "weak" : "negative") as SectorCoin["momentum"],
        };
      }).filter(c => c.price != null && c.price > 0);

      const average = (values: Array<number | null>) => {
        const nums = values.filter((value): value is number => typeof value === "number");
        return nums.length > 0 ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
      };
      const avgChange24h = average(coins.map(c => c.change24h));
      const avgChange7d = average(coins.map(c => c.change7d));
      const scored = avgChange24h != null && avgChange7d != null ? scoreSector(avgChange24h, avgChange7d) : null;

      return {
        name: sectorDef.name,
        key: sectorDef.key,
        coins,
        avgChange24h: fixedOrNull(avgChange24h, 2),
        avgChange7d: fixedOrNull(avgChange7d, 2),
        momentum: scored?.momentum ?? "unavailable",
        alert: scored?.alert ? `${sectorDef.name} ${scored.alert}` : null,
        score: scored?.score ?? null,
        color: sectorDef.color,
      };
    });

    // ── BTC Dominance Engine ──────────────────────────────────
    const velocity = btcChange24h != null && ethChange24h != null
      ? parseFloat((btcChange24h - ethChange24h).toFixed(2))
      : null;
    const btcDominance: BtcDominanceData = btcDomPct == null
      ? {
          current: null,
          trend: null,
          velocity,
          pressure: null,
          signal: "BTC dominance unavailable",
          score: null,
        }
      : {
          current: parseFloat(btcDomPct.toFixed(2)),
          velocity,
          ...scoreBtcDominance(btcDomPct),
        };

    // ── ETH Leadership Index ──────────────────────────────────
    const ethScoring = ethChange24h != null && btcChange24h != null
      ? scoreEthLeadership(ethChange24h, btcChange24h, ethBtcRatio ?? 0)
      : null;
    const ethLeadership: EthLeadershipData = {
      ethBtcRatio: fixedOrNull(ethBtcRatio, 5),
      ethChange24h: fixedOrNull(ethChange24h, 2),
      btcChange24h: fixedOrNull(btcChange24h, 2),
      relativePerformance: ethChange24h != null && btcChange24h != null
        ? parseFloat((ethChange24h - btcChange24h).toFixed(2))
        : null,
      status: ethScoring?.status ?? "unavailable",
      label: ethScoring?.label ?? "Unavailable",
      trend: ethScoring?.trend ?? "unavailable",
      score: ethScoring?.score ?? null,
    };

    // ── Stablecoin Liquidity Engine ───────────────────────────
    const totalStable = usdtMcap != null && usdcMcap != null ? usdtMcap + usdcMcap : null;
    // Proxy combined 24h change from individual changes (weighted).
    // An observed zero cap still yields 0. A missing cap or change is withheld.
    const combinedStableChange = usdtMcap == null || usdcMcap == null
      ? null
      : usdtMcap > 0 && usdcMcap > 0
        ? (usdtChange != null && usdcChange != null && totalStable
          ? usdtChange * (usdtMcap / totalStable) + usdcChange * (usdcMcap / totalStable)
          : null)
        : 0;
    const stableScoring = combinedStableChange == null ? null : scoreStablecoinLiquidity(combinedStableChange);
    const stablecoinLiquidity: StablecoinLiquidityData = {
      usdtMarketCap: fixedOrNull(usdtMcap, 1),
      usdcMarketCap: fixedOrNull(usdcMcap, 1),
      totalStablecoinCap: fixedOrNull(totalStable, 1),
      usdtChange24h: fixedOrNull(usdtChange, 3),
      usdcChange24h: fixedOrNull(usdcChange, 3),
      combinedChange24h: fixedOrNull(combinedStableChange, 3),
      status: stableScoring?.status ?? "unavailable",
      label: stableScoring?.label ?? "Unavailable",
      score: stableScoring?.score ?? null,
    };

    // ── Market Breadth (TOTAL2/TOTAL3 proxy) ──────────────────
    const btcMcap = scaled(priceData.bitcoin?.usd_market_cap, 1e9);
    const ethMcap = scaled(priceData.ethereum?.usd_market_cap, 1e9);
    const totalMcapB = totalMcapUsd == null ? null : totalMcapUsd / 1e9;
    const total2Proxy = totalMcapB != null && btcMcap != null ? totalMcapB - btcMcap : null;
    const total3Proxy = total2Proxy != null && ethMcap != null ? total2Proxy - ethMcap : null;
    const observedEth = ethDomPct == null ? null : parseFloat(ethDomPct.toFixed(2));
    const altcoinDominance = btcDomPct == null || ethDomPct == null ? null : 100 - btcDomPct - ethDomPct;
    const breadthScore = altcoinDominance == null ? null : clamp(Math.round((altcoinDominance / 40) * 100)); // 40% altcoin dom = 100
    const marketBreadth: MarketBreadthData = {
      total2Proxy: fixedOrNull(total2Proxy, 0),
      total3Proxy: fixedOrNull(total3Proxy, 0),
      altcoinDominance: altcoinDominance == null ? null : parseFloat(altcoinDominance.toFixed(2)),
      ethDominance: observedEth,
      breadthSignal: altcoinDominance == null ? "unavailable" : altcoinDominance > 35 ? "expanding" : altcoinDominance < 25 ? "contracting" : "neutral",
      score: breadthScore,
    };

    // ── Sector composite score ────────────────────────────────
    const scoredSectors = sectors.map(sec => sec.score).filter((score): score is number => typeof score === "number");
    const sectorComposite = scoredSectors.length > 0
      ? scoredSectors.reduce((sum, score) => sum + score, 0) / scoredSectors.length
      : sectors.length === 0 ? 50 : null;

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
    const weighted = (rawScore: number | null, weight: number) =>
      rawScore == null ? null : Math.round(rawScore * weight);
    const scoreBreakdown = [
      { label: "BTC Dominance Engine", weight: 30, rawScore: btcDominance.score, contribution: weighted(btcDominance.score, 0.30) },
      { label: "ETH Leadership Index", weight: 25, rawScore: ethLeadership.score, contribution: weighted(ethLeadership.score, 0.25) },
      { label: "Stablecoin Liquidity", weight: 20, rawScore: stablecoinLiquidity.score, contribution: weighted(stablecoinLiquidity.score, 0.20) },
      { label: "Sector Rotation", weight: 15, rawScore: sectorComposite == null ? null : Math.round(sectorComposite), contribution: weighted(sectorComposite == null ? null : Math.round(sectorComposite), 0.15) },
      { label: "Market Breadth", weight: 10, rawScore: marketBreadth.score, contribution: weighted(marketBreadth.score, 0.10) },
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
      ethDominance: observedEth,
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
    log.info(`[AltRotation] Score: ${score} | Regime: ${regime} | BTC Dom: ${btcDomPct == null ? "unavailable" : `${btcDomPct.toFixed(1)}%`}`);
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
