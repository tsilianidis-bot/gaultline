/**
 * FAULTLINE Insider Intelligence
 *
 * All observed fields originate in SEC EDGAR Form 4 documents. Scores and
 * classifications below are explicitly derived methodology; no historical
 * accuracy, returns, identities, dates, or transactions are generated.
 */
import {
  getForm4Observations,
  type Form4ObservationResult,
  type SecForm4Observation,
  type SecForm4PlanStatus,
  type SecForm4ProviderMetadata,
  type SecForm4ReportingOwner,
  type SecForm4TransactionType,
} from "./providers/secForm4Adapter";

export const INSIDER_METHODOLOGY_ID = "sec-form4-insider-conviction" as const;
export const INSIDER_METHODOLOGY_VERSION = "2.0.0" as const;
const CLUSTER_WINDOW_DAYS = 21;

export type InsiderRole =
  | "CEO" | "CFO" | "COO" | "CTO" | "President"
  | "Director" | "SVP" | "EVP" | "VP" | "10% Owner" | "Officer" | "Other";

export type TransactionType = SecForm4TransactionType;
export type SellingClassification = "Normal" | "Elevated" | "Aggressive" | "Unusual";
export type ConvictionBand =
  | "Exceptional Conviction"
  | "Strong Conviction"
  | "Moderate Conviction"
  | "Neutral"
  | "Weak Conviction"
  | "Negative Insider Signal";

export interface DerivedMethodology {
  methodologyId: typeof INSIDER_METHODOLOGY_ID;
  methodologyVersion: typeof INSIDER_METHODOLOGY_VERSION;
  sourceClaimIds: string[];
}

export interface InsiderTransaction {
  id: string;
  sourceClaimId: string;
  ticker: string;
  company: string;
  issuerCik: string;
  insiderName: string;
  reportingOwners: SecForm4ReportingOwner[];
  role: InsiderRole;
  officerTitle: string | null;
  transactionType: TransactionType;
  transactionCode: string;
  acquiredDisposedCode: "A" | "D";
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  /** EDGAR filing date, not a client-clock relative date. */
  filingDate: string;
  acceptanceDateTime: string;
  transactionDate: string;
  accessionNumber: string;
  sourceUrl: string;
  percentOfHoldings: number | null;
  planStatus: SecForm4PlanStatus;
  planDisclosure: string | null;
  isCluster: boolean;
}

export interface ClusterBuyAlert {
  ticker: string;
  company: string;
  insiderCount: number;
  totalCapital: number | null;
  strength: "MODERATE" | "HIGH" | "EXCEPTIONAL";
  insiders: Array<{ name: string; role: InsiderRole; amount: number | null; sourceClaimIds: string[] }>;
  daysWindow: number;
  convictionScore: number;
  methodology: DerivedMethodology;
}

export interface SellingAnalysis {
  ticker: string;
  company: string;
  insiderName: string;
  role: InsiderRole;
  transactionCode: string;
  accessionNumber: string;
  sourceUrl: string;
  saleAmount: number | null;
  percentOfHoldings: number | null;
  classification: SellingClassification | null;
  reason: string;
  isScheduledPlan: "disclosed" | "unknown";
  isTaxRelated: true | "unknown";
  isDiversification: "unknown";
  isAbnormal: boolean | null;
  methodology: DerivedMethodology | null;
}

export interface InsiderConvictionProfile {
  ticker: string;
  company: string | null;
  dataStatus: "AVAILABLE" | "NO_ACTIVITY";
  provider: SecForm4ProviderMetadata;
  observedAt: string | null;
  convictionScore: number | null;
  convictionBand: ConvictionBand | null;
  impactPoints: number | null;
  methodology: DerivedMethodology | null;
  recentTransactions: InsiderTransaction[];
  buyVsSell: { buyCount: number; sellCount: number; buyValue: number | null; sellValue: number | null };
  largestInsider: { name: string; role: InsiderRole; totalBought: number | null } | null;
  mostRecentFiling: string | null;
  /** No governed backtest exists for this feature. */
  historicalAccuracy: null;
  clusterBuying: boolean;
  sellingAnalysis: SellingAnalysis[];
  /** Narrative generation is withheld; it is not a source-of-record field. */
  aiInterpretation: null;
}

export interface SmartMoneyRadarEntry {
  rank: number;
  ticker: string;
  company: string;
  convictionScore: number;
  convictionBand: ConvictionBand;
  activity: string;
  dollarAmount: number | null;
  signal: string;
  signalColor: "green" | "yellow" | "red";
  clusterCount: number;
  trend: "unavailable";
  methodology: DerivedMethodology;
}

export interface InsiderRadarOutput {
  radar: SmartMoneyRadarEntry[];
  clusterAlerts: ClusterBuyAlert[];
  topSellingAlerts: SellingAnalysis[];
  weeklyStats: {
    totalBuyValue: number | null;
    totalSellValue: number | null;
    netSentiment: number | null;
    activeTickers: number;
    clusterCount: number;
    unclassifiedSellingCount: number;
  };
  /** Deprecated compatibility field; equal to observedAt, never a local-clock reconstruction. */
  lastUpdated: string | null;
  provider: SecForm4ProviderMetadata[];
  observedAt: string | null;
}

export interface InsiderCompanyOutput {
  profile: InsiderConvictionProfile;
  timeline: Array<{
    date: string;
    type: "buy" | "sell" | "other";
    role: InsiderRole;
    amount: number | null;
    label: string;
    transactionCode: string;
    shares: number;
    pricePerShare: number | null;
    accessionNumber: string;
    sourceUrl: string;
    filingDate: string;
  }>;
  /** Withheld until a versioned, governed historical evaluation is supplied. */
  accuracyHistory: Array<never>;
}

export class InsiderSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsiderSourceUnavailableError";
  }
}

export type Form4ObservationProvider = (ticker: string) => Promise<Form4ObservationResult>;

export interface InsiderEngineOptions {
  observationProvider?: Form4ObservationProvider;
  /** A configured radar universe is product configuration, never a source of transactions. */
  tickers?: string[];
}

const ROLE_WEIGHTS: Record<InsiderRole, number> = {
  CEO: 1.0,
  CFO: 0.9,
  President: 0.85,
  COO: 0.8,
  CTO: 0.75,
  EVP: 0.65,
  SVP: 0.6,
  VP: 0.5,
  Director: 0.55,
  "10% Owner": 0.7,
  Officer: 0.5,
  Other: 0.4,
};

function normalizeTicker(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.]{1,10}$/.test(normalized)) throw new InsiderSourceUnavailableError("A valid ticker is required for Insider Intelligence.");
  return normalized;
}

function roleFromOwners(owners: SecForm4ReportingOwner[]): { role: InsiderRole; officerTitle: string | null; name: string } {
  const officer = owners.find(owner => owner.isOfficer && owner.officerTitle);
  const title = officer?.officerTitle ?? null;
  const normalizedTitle = title?.toUpperCase() ?? "";
  let role: InsiderRole;
  if (/CHIEF EXECUTIVE|\bCEO\b/.test(normalizedTitle)) role = "CEO";
  else if (/CHIEF FINANCIAL|\bCFO\b/.test(normalizedTitle)) role = "CFO";
  else if (/CHIEF OPERATING|\bCOO\b/.test(normalizedTitle)) role = "COO";
  else if (/CHIEF TECHNOLOGY|\bCTO\b/.test(normalizedTitle)) role = "CTO";
  else if (/\bPRESIDENT\b/.test(normalizedTitle)) role = "President";
  else if (/\bEXECUTIVE VICE PRESIDENT|\bEVP\b/.test(normalizedTitle)) role = "EVP";
  else if (/\bSENIOR VICE PRESIDENT|\bSVP\b/.test(normalizedTitle)) role = "SVP";
  else if (/\bVICE PRESIDENT|\bVP\b/.test(normalizedTitle)) role = "VP";
  else if (owners.some(owner => owner.isDirector)) role = "Director";
  else if (owners.some(owner => owner.isTenPercentOwner)) role = "10% Owner";
  else if (owners.some(owner => owner.isOfficer)) role = "Officer";
  else role = "Other";
  return { role, officerTitle: title, name: owners.map(owner => owner.name).join(" / ") };
}

function sourceClaimId(observation: SecForm4Observation): string {
  return `sec-form4:${observation.id}`;
}

function transactionFromObservation(observation: SecForm4Observation, isCluster = false): InsiderTransaction {
  const owner = roleFromOwners(observation.reportingOwners);
  const percentOfHoldings = observation.acquiredDisposedCode === "D" && observation.sharesOwnedFollowingTransaction !== null
    ? Number((observation.shares / (observation.shares + observation.sharesOwnedFollowingTransaction) * 100).toFixed(4))
    : null;
  return {
    id: observation.id,
    sourceClaimId: sourceClaimId(observation),
    ticker: observation.ticker,
    company: observation.issuerName,
    issuerCik: observation.issuerCik,
    insiderName: owner.name,
    reportingOwners: observation.reportingOwners,
    role: owner.role,
    officerTitle: owner.officerTitle,
    transactionType: observation.transactionType,
    transactionCode: observation.transactionCode,
    acquiredDisposedCode: observation.acquiredDisposedCode,
    shares: observation.shares,
    pricePerShare: observation.pricePerShare,
    totalValue: observation.amount,
    filingDate: observation.filingDate,
    acceptanceDateTime: observation.acceptanceDateTime,
    transactionDate: observation.transactionDate,
    accessionNumber: observation.accessionNumber,
    sourceUrl: observation.sourceUrl,
    percentOfHoldings,
    planStatus: observation.planStatus,
    planDisclosure: observation.planDisclosure,
    isCluster,
  };
}

function getConvictionBand(score: number): ConvictionBand {
  if (score >= 90) return "Exceptional Conviction";
  if (score >= 75) return "Strong Conviction";
  if (score >= 60) return "Moderate Conviction";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Weak Conviction";
  return "Negative Insider Signal";
}

function getImpactPoints(score: number): number {
  if (score >= 90) return 15;
  if (score >= 75) return 10;
  if (score >= 60) return 5;
  if (score >= 40) return 0;
  if (score >= 20) return -7;
  return -15;
}

function sumExactValues(transactions: InsiderTransaction[]): number | null {
  if (!transactions.length) return 0;
  if (transactions.some(transaction => transaction.totalValue === null)) return null;
  return transactions.reduce((sum, transaction) => sum + (transaction.totalValue ?? 0), 0);
}

function calculateConviction(transactions: InsiderTransaction[]): { score: number; methodology: DerivedMethodology } | null {
  const buys = transactions.filter(transaction => transaction.transactionCode === "P");
  const sales = transactions.filter(transaction => transaction.transactionCode === "S");
  if (!buys.length && !sales.length) return null;

  const totalBuyValue = sumExactValues(buys);
  const totalSellValue = sumExactValues(sales);
  const ceoPurchased = buys.some(transaction => transaction.role === "CEO");
  const cfoPurchased = buys.some(transaction => transaction.role === "CFO");
  const directorCount = new Set(buys.filter(transaction => transaction.role === "Director").map(transaction => transaction.insiderName)).size;
  const buyOwners = new Set(buys.map(transaction => transaction.insiderName)).size;
  const clusterSelling = new Set(sales.map(transaction => transaction.insiderName)).size >= 3;
  const avgRoleWeight = buys.length
    ? buys.reduce((sum, transaction) => sum + ROLE_WEIGHTS[transaction.role], 0) / buys.length
    : 0;

  let score = 50;
  if (ceoPurchased) score += 18;
  if (cfoPurchased) score += 14;
  score += Math.min(directorCount * 4, 16);
  if (buyOwners >= 5) score += 14;
  else if (buyOwners >= 3) score += 9;
  else if (buyOwners >= 2) score += 5;
  if (clusterSelling) score -= 20;
  if (totalBuyValue !== null) {
    if (totalBuyValue >= 5_000_000) score += 10;
    else if (totalBuyValue >= 1_000_000) score += 6;
    else if (totalBuyValue >= 250_000) score += 3;
  }
  if (totalBuyValue !== null && totalSellValue !== null) {
    if (totalSellValue > totalBuyValue * 3) score -= 18;
    else if (totalSellValue > totalBuyValue * 1.5) score -= 8;
  }
  if (buys.length >= 5) score += 8;
  else if (buys.length >= 3) score += 4;
  score += Math.round(avgRoleWeight * 10);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    methodology: {
      methodologyId: INSIDER_METHODOLOGY_ID,
      methodologyVersion: INSIDER_METHODOLOGY_VERSION,
      sourceClaimIds: transactions.map(transaction => transaction.sourceClaimId),
    },
  };
}

function clusterGroups(transactions: InsiderTransaction[]): Map<string, InsiderTransaction[]> {
  const groups = new Map<string, InsiderTransaction[]>();
  for (const transaction of transactions.filter(item => item.transactionCode === "P")) {
    const group = groups.get(transaction.ticker) ?? [];
    group.push(transaction);
    groups.set(transaction.ticker, group);
  }
  for (const [ticker, buys] of Array.from(groups.entries())) {
    const latestDate = Math.max(...buys.map(buy => Date.parse(`${buy.transactionDate}T00:00:00Z`)));
    const withinWindow = buys.filter(buy => latestDate - Date.parse(`${buy.transactionDate}T00:00:00Z`) <= CLUSTER_WINDOW_DAYS * 86_400_000);
    const byOwner = new Map<string, InsiderTransaction>();
    for (const buy of withinWindow) if (!byOwner.has(buy.insiderName)) byOwner.set(buy.insiderName, buy);
    if (byOwner.size < 2) groups.delete(ticker);
    else groups.set(ticker, Array.from(byOwner.values()));
  }
  return groups;
}

function withClusterFlags(transactions: InsiderTransaction[]): InsiderTransaction[] {
  const clusters = clusterGroups(transactions);
  const clusteredIds = new Set(Array.from(clusters.values()).flatMap(group => group.map(transaction => transaction.id)));
  return transactions.map(transaction => ({ ...transaction, isCluster: clusteredIds.has(transaction.id) }));
}

function buildClusterAlerts(transactions: InsiderTransaction[]): ClusterBuyAlert[] {
  return Array.from(clusterGroups(transactions).values()).map<ClusterBuyAlert>(cluster => {
    const scored = calculateConviction(cluster);
    if (!scored) throw new InsiderSourceUnavailableError("SEC cluster could not be scored from source observations.");
    const insiderCount = cluster.length;
    return {
      ticker: cluster[0].ticker,
      company: cluster[0].company,
      insiderCount,
      totalCapital: sumExactValues(cluster),
      strength: insiderCount >= 5 ? "EXCEPTIONAL" : insiderCount >= 3 ? "HIGH" : "MODERATE",
      insiders: cluster.map(transaction => ({
        name: transaction.insiderName,
        role: transaction.role,
        amount: transaction.totalValue,
        sourceClaimIds: [transaction.sourceClaimId],
      })),
      daysWindow: CLUSTER_WINDOW_DAYS,
      convictionScore: scored.score,
      methodology: scored.methodology,
    };
  }).sort((a, b) => b.convictionScore - a.convictionScore || a.ticker.localeCompare(b.ticker));
}

function classifySelling(transaction: InsiderTransaction): SellingAnalysis {
  const methodology = (classification: SellingClassification): DerivedMethodology => ({
    methodologyId: INSIDER_METHODOLOGY_ID,
    methodologyVersion: INSIDER_METHODOLOGY_VERSION,
    sourceClaimIds: [transaction.sourceClaimId],
  });
  const common = {
    ticker: transaction.ticker,
    company: transaction.company,
    insiderName: transaction.insiderName,
    role: transaction.role,
    transactionCode: transaction.transactionCode,
    accessionNumber: transaction.accessionNumber,
    sourceUrl: transaction.sourceUrl,
    saleAmount: transaction.totalValue,
    percentOfHoldings: transaction.percentOfHoldings,
    isScheduledPlan: transaction.planStatus,
    isTaxRelated: transaction.transactionCode === "F" ? true as const : "unknown" as const,
    isDiversification: "unknown" as const,
  };
  if (transaction.transactionCode === "F") {
    return { ...common, classification: "Normal", reason: "SEC transaction code F: payment of exercise price or tax liability by delivering or withholding securities.", isAbnormal: false, methodology: methodology("Normal") };
  }
  if (transaction.planStatus === "disclosed") {
    return { ...common, classification: "Normal", reason: transaction.planDisclosure ?? "Form 4 discloses a Rule 10b5-1(c) transaction indication.", isAbnormal: false, methodology: methodology("Normal") };
  }
  if (transaction.percentOfHoldings === null) {
    return { ...common, classification: null, reason: "Classification unavailable: the filing does not provide enough holdings data for this deterministic rule.", isAbnormal: null, methodology: null };
  }
  if (transaction.percentOfHoldings >= 30) {
    return { ...common, classification: "Aggressive", reason: `Derived rule: reported disposition is ${transaction.percentOfHoldings.toFixed(1)}% of holdings immediately before the transaction.`, isAbnormal: true, methodology: methodology("Aggressive") };
  }
  if (transaction.percentOfHoldings >= 15) {
    return { ...common, classification: "Elevated", reason: `Derived rule: reported disposition is ${transaction.percentOfHoldings.toFixed(1)}% of holdings immediately before the transaction.`, isAbnormal: false, methodology: methodology("Elevated") };
  }
  if (transaction.totalValue !== null && transaction.totalValue >= 10_000_000) {
    return { ...common, classification: "Unusual", reason: "Derived rule: reported transaction value is at least $10M and no Rule 10b5-1 disclosure was parsed for this row.", isAbnormal: true, methodology: methodology("Unusual") };
  }
  return { ...common, classification: "Normal", reason: `Derived rule: reported disposition is ${transaction.percentOfHoldings.toFixed(1)}% of holdings immediately before the transaction.`, isAbnormal: false, methodology: methodology("Normal") };
}

function sellingAnalyses(transactions: InsiderTransaction[]): SellingAnalysis[] {
  const order: Record<SellingClassification, number> = { Aggressive: 0, Unusual: 1, Elevated: 2, Normal: 3 };
  return transactions
    .filter(transaction => transaction.transactionCode === "S" || transaction.transactionCode === "F")
    .map(classifySelling)
    .sort((a, b) => {
      const aOrder = a.classification === null ? 4 : order[a.classification];
      const bOrder = b.classification === null ? 4 : order[b.classification];
      return aOrder - bOrder || (b.saleAmount ?? -1) - (a.saleAmount ?? -1);
    });
}

function latestObservedAt(transactions: InsiderTransaction[]): string | null {
  if (!transactions.length) return null;
  return new Date(Math.max(...transactions.map(transaction => Date.parse(transaction.acceptanceDateTime)))).toISOString();
}

function requireAvailable(result: Form4ObservationResult): Form4ObservationResult & { status: "AVAILABLE" } {
  if (result.status !== "AVAILABLE") throw new InsiderSourceUnavailableError(result.reason ?? "SEC Form 4 source is unavailable.");
  return result as Form4ObservationResult & { status: "AVAILABLE" };
}

async function observationsForTicker(ticker: string, provider: Form4ObservationProvider): Promise<{ result: Form4ObservationResult; transactions: InsiderTransaction[] }> {
  const result = requireAvailable(await provider(normalizeTicker(ticker)));
  const rawTransactions = result.observations.map(observation => transactionFromObservation(observation));
  return { result, transactions: withClusterFlags(rawTransactions) };
}

function configuredRadarTickers(): string[] {
  const configured = process.env.SEC_FORM4_RADAR_TICKERS;
  if (!configured?.trim()) return [];
  const values = configured.split(",").map(value => value.trim().toUpperCase()).filter(value => /^[A-Z0-9.]{1,10}$/.test(value));
  return Array.from(new Set(values));
}

export async function getInsiderRadar(options: InsiderEngineOptions = {}): Promise<InsiderRadarOutput> {
  const provider = options.observationProvider ?? getForm4Observations;
  const tickers = options.tickers ?? configuredRadarTickers();
  if (!tickers.length) {
    throw new InsiderSourceUnavailableError("Insider radar is unavailable: SEC_FORM4_RADAR_TICKERS is not configured with a verified coverage universe.");
  }

  const resolved = [] as Array<{ result: Form4ObservationResult; transactions: InsiderTransaction[] }>;
  for (const ticker of tickers) resolved.push(await observationsForTicker(ticker, provider));
  const transactions = resolved.flatMap(item => item.transactions);
  const clusterAlerts = buildClusterAlerts(transactions);
  const topSellingAlerts = sellingAnalyses(transactions).filter(alert => alert.classification !== null);
  const radar = resolved.flatMap(({ transactions: tickerTransactions }) => {
    const scored = calculateConviction(tickerTransactions);
    if (!scored) return [];
    const buys = tickerTransactions.filter(transaction => transaction.transactionCode === "P");
    const sales = tickerTransactions.filter(transaction => transaction.transactionCode === "S");
    const company = tickerTransactions[0]?.company;
    if (!company) return [];
    const owners = new Set(buys.map(transaction => transaction.insiderName));
    let activity: string;
    if (buys.some(transaction => transaction.role === "CEO") && buys.some(transaction => transaction.role === "CFO")) activity = "Observed CEO and CFO open-market purchases";
    else if (buys.some(transaction => transaction.role === "CEO")) activity = "Observed CEO open-market purchase";
    else if (owners.size >= 2) activity = `Observed purchases by ${owners.size} insiders`;
    else if (buys.length) activity = "Observed open-market purchase";
    else if (sales.length) activity = "Observed open-market sale";
    else activity = "No open-market P/S transaction in returned filings";
    return [{
      rank: 0,
      ticker: tickerTransactions[0].ticker,
      company,
      convictionScore: scored.score,
      convictionBand: getConvictionBand(scored.score),
      activity,
      dollarAmount: sumExactValues(buys),
      signal: getConvictionBand(scored.score),
      signalColor: scored.score >= 65 ? "green" as const : scored.score >= 40 ? "yellow" as const : "red" as const,
      clusterCount: clusterAlerts.find(alert => alert.ticker === tickerTransactions[0].ticker)?.insiderCount ?? 0,
      trend: "unavailable" as const,
      methodology: scored.methodology,
    }];
  }).sort((a, b) => b.convictionScore - a.convictionScore || a.ticker.localeCompare(b.ticker)).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const buyTransactions = transactions.filter(transaction => transaction.transactionCode === "P");
  const saleTransactions = transactions.filter(transaction => transaction.transactionCode === "S");
  const netSentiment = radar.length ? Math.round((radar.reduce((sum, entry) => sum + entry.convictionScore, 0) / radar.length - 50) * 2) : null;
  const observedAt = latestObservedAt(transactions);
  return {
    radar,
    clusterAlerts,
    topSellingAlerts,
    weeklyStats: {
      totalBuyValue: sumExactValues(buyTransactions),
      totalSellValue: sumExactValues(saleTransactions),
      netSentiment,
      activeTickers: radar.length,
      clusterCount: clusterAlerts.length,
      unclassifiedSellingCount: sellingAnalyses(transactions).filter(alert => alert.classification === null).length,
    },
    lastUpdated: observedAt,
    provider: resolved.map(item => item.result.provider),
    observedAt,
  };
}

export async function getInsiderCompany(ticker: string, options: InsiderEngineOptions = {}): Promise<InsiderCompanyOutput> {
  const provider = options.observationProvider ?? getForm4Observations;
  const { result, transactions } = await observationsForTicker(ticker, provider);
  const scored = calculateConviction(transactions);
  const buys = transactions.filter(transaction => transaction.transactionCode === "P");
  const sales = transactions.filter(transaction => transaction.transactionCode === "S");
  const largestInsider = buys.length
    ? buys.reduce<InsiderTransaction | null>((largest, transaction) => {
      if (transaction.totalValue === null) return largest;
      return !largest || (largest.totalValue ?? -1) < transaction.totalValue ? transaction : largest;
    }, null)
    : null;
  const analyses = sellingAnalyses(transactions);
  const profile: InsiderConvictionProfile = {
    ticker: normalizeTicker(ticker),
    company: transactions[0]?.company ?? null,
    dataStatus: transactions.length ? "AVAILABLE" : "NO_ACTIVITY",
    provider: result.provider,
    observedAt: result.observedAt ?? latestObservedAt(transactions),
    convictionScore: scored?.score ?? null,
    convictionBand: scored ? getConvictionBand(scored.score) : null,
    impactPoints: scored ? getImpactPoints(scored.score) : null,
    methodology: scored?.methodology ?? null,
    recentTransactions: [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    buyVsSell: {
      buyCount: buys.length,
      sellCount: sales.length,
      buyValue: sumExactValues(buys),
      sellValue: sumExactValues(sales),
    },
    largestInsider: largestInsider ? { name: largestInsider.insiderName, role: largestInsider.role, totalBought: largestInsider.totalValue } : null,
    mostRecentFiling: transactions.length ? latestObservedAt(transactions) : null,
    historicalAccuracy: null,
    clusterBuying: transactions.some(transaction => transaction.isCluster),
    sellingAnalysis: analyses,
    aiInterpretation: null,
  };
  const timeline = [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).map(transaction => ({
    date: transaction.transactionDate,
    type: transaction.transactionCode === "P" ? "buy" as const : transaction.transactionCode === "S" ? "sell" as const : "other" as const,
    role: transaction.role,
    amount: transaction.totalValue,
    label: `${transaction.insiderName} — SEC code ${transaction.transactionCode}; ${transaction.shares.toLocaleString("en-US")} shares`,
    transactionCode: transaction.transactionCode,
    shares: transaction.shares,
    pricePerShare: transaction.pricePerShare,
    accessionNumber: transaction.accessionNumber,
    sourceUrl: transaction.sourceUrl,
    filingDate: transaction.filingDate,
  }));
  return { profile, timeline, accuracyHistory: [] };
}

export async function getInsiderAlertsForTicker(ticker: string, options: InsiderEngineOptions = {}): Promise<{
  convictionScore: number | null;
  convictionBand: ConvictionBand | null;
  impactPoints: number | null;
  recentActivity: string;
  aiSummary: null;
  methodology: DerivedMethodology | null;
}> {
  const { profile } = await getInsiderCompany(ticker, options);
  const buys = profile.recentTransactions.filter(transaction => transaction.transactionCode === "P");
  const sales = profile.recentTransactions.filter(transaction => transaction.transactionCode === "S");
  let recentActivity: string;
  if (buys.some(transaction => transaction.role === "CEO") && buys.some(transaction => transaction.role === "CFO")) recentActivity = "Observed CEO and CFO open-market purchases in returned Form 4 filings.";
  else if (buys.some(transaction => transaction.role === "CEO")) recentActivity = "Observed CEO open-market purchase in returned Form 4 filings.";
  else if (profile.clusterBuying) recentActivity = "Observed multi-insider open-market purchase cluster in returned Form 4 filings.";
  else if (buys.length) recentActivity = `Observed ${buys.length} open-market purchase transaction${buys.length === 1 ? "" : "s"} in returned Form 4 filings.`;
  else if (sales.length) recentActivity = `Observed ${sales.length} open-market sale transaction${sales.length === 1 ? "" : "s"} in returned Form 4 filings.`;
  else recentActivity = "No open-market P/S transaction is present in the returned Form 4 observations.";
  return {
    convictionScore: profile.convictionScore,
    convictionBand: profile.convictionBand,
    impactPoints: profile.impactPoints,
    recentActivity,
    aiSummary: null,
    methodology: profile.methodology,
  };
}
