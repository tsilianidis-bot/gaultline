/**
 * Narrow SEC EDGAR Form 4 source adapter.
 *
 * This module deliberately returns UNAVAILABLE rather than synthesizing a
 * transaction, no-activity result, or filing timestamp when EDGAR evidence
 * cannot be verified. SEC requests require an explicitly configured,
 * declared user agent (SEC_USER_AGENT).
 */

export const SEC_FORM4_PROVIDER_ID = "SEC_EDGAR_FORM4" as const;
const COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const DATA_SEC_ORIGIN = "https://data.sec.gov";
const SEC_ARCHIVES_ORIGIN = "https://www.sec.gov/Archives/edgar/data";
const DEFAULT_MAX_FILINGS = 20;
const DEFAULT_MAX_FILING_AGE_DAYS = 45;

export type SecForm4TransactionType =
  | "purchase"
  | "sale"
  | "option_exercise"
  | "award"
  | "tax_withholding"
  | "gift"
  | "conversion"
  | "issuer_disposition"
  | "discretionary_transaction"
  | "other";

export type SecForm4PlanStatus = "disclosed" | "unknown";

export interface SecForm4ReportingOwner {
  cik: string | null;
  name: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  officerTitle: string | null;
}

export interface SecForm4ProviderMetadata {
  id: typeof SEC_FORM4_PROVIDER_ID;
  name: "SEC EDGAR";
  ticker: string;
  fetchedAt: string;
  sourceUrls: string[];
}

export interface SecForm4FilingMetadata {
  accessionNumber: string;
  issuerCik: string;
  ticker: string;
  filingDate: string;
  acceptanceDateTime: string;
  primaryDocument: string;
  sourceUrl: string;
}

export interface SecForm4Observation {
  /** Stable source-row identity, not a generated market identity. */
  id: string;
  accessionNumber: string;
  issuerCik: string;
  issuerName: string;
  ticker: string;
  sourceUrl: string;
  filingDate: string;
  acceptanceDateTime: string;
  transactionDate: string;
  table: "NON_DERIVATIVE" | "DERIVATIVE";
  securityTitle: string;
  reportingOwners: SecForm4ReportingOwner[];
  transactionCode: string;
  transactionType: SecForm4TransactionType;
  acquiredDisposedCode: "A" | "D";
  shares: number;
  pricePerShare: number | null;
  amount: number | null;
  sharesOwnedFollowingTransaction: number | null;
  ownershipForm: "D" | "I" | null;
  planStatus: SecForm4PlanStatus;
  planDisclosure: string | null;
  footnoteIds: string[];
}

export interface Form4ObservationResult {
  status: "AVAILABLE" | "UNAVAILABLE";
  observations: SecForm4Observation[];
  provider: SecForm4ProviderMetadata;
  /** Latest EDGAR acceptance timestamp represented by observations. */
  observedAt: string | null;
  reason: string | null;
}

export interface SecForm4AdapterOptions {
  /** Injectable only for isolated fixture tests. Production uses global fetch. */
  fetchImpl?: typeof fetch;
  /** Production must set SEC_USER_AGENT; no undeclared fallback is provided. */
  userAgent?: string;
  now?: () => Date;
  maxFilings?: number;
  maxFilingAgeDays?: number;
}

interface CompanyTickerRecord {
  cik_str?: number | string;
  ticker?: string;
  title?: string;
}

interface SubmissionsRecent {
  form?: unknown;
  accessionNumber?: unknown;
  filingDate?: unknown;
  acceptanceDateTime?: unknown;
  primaryDocument?: unknown;
}

interface SubmissionResponse {
  name?: unknown;
  filings?: { recent?: SubmissionsRecent };
}

class SecForm4ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecForm4ParseError";
  }
}

function normalizeTicker(ticker: string): string | null {
  const normalized = ticker.trim().toUpperCase();
  return /^[A-Z0-9.]{1,10}$/.test(normalized) ? normalized : null;
}

function normalizeCik(value: string | number): string | null {
  const numeric = String(value).trim();
  if (!/^\d{1,10}$/.test(numeric)) return null;
  return numeric.padStart(10, "0");
}

function toFiniteNumber(value: string | null, field: string, options: { required: boolean; positive?: boolean }): number | null {
  if (value === null || value.trim() === "") {
    if (options.required) throw new SecForm4ParseError(`Form 4 transaction is missing ${field}.`);
    return null;
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || (options.positive && parsed <= 0)) {
    throw new SecForm4ParseError(`Form 4 transaction has an invalid ${field}.`);
  }
  return parsed;
}

function toIsoTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new SecForm4ParseError(`Form 4 filing has an invalid ${field}.`);
  return new Date(timestamp).toISOString();
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)));
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rawTagContent(xml: string, tag: string): string | null {
  const match = new RegExp(`<${escapeRegex(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, "i").exec(xml);
  return match?.[1] ?? null;
}

function tagContent(xml: string, tag: string): string | null {
  const content = rawTagContent(xml, tag);
  return content === null ? null : decodeXml(content);
}

function nestedValue(xml: string, containerTag: string): string | null {
  const block = rawTagContent(xml, containerTag);
  return block === null ? null : (tagContent(block, "value") ?? decodeXml(block));
}

function blocks(xml: string, tag: string): string[] {
  const result: string[] = [];
  const matcher = new RegExp(`<${escapeRegex(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(xml)) !== null) result.push(match[1]);
  return result;
}

function tagBoolean(xml: string, tag: string): boolean {
  return tagContent(xml, tag) === "1";
}

function classifyTransactionCode(code: string): SecForm4TransactionType {
  switch (code) {
    case "P": return "purchase";
    case "S": return "sale";
    case "M": return "option_exercise";
    case "A": return "award";
    case "F": return "tax_withholding";
    case "G": return "gift";
    case "C": return "conversion";
    case "D": return "issuer_disposition";
    case "I": return "discretionary_transaction";
    default: return "other";
  }
}

function parseFootnotes(xml: string): Map<string, string> {
  const footnotes = new Map<string, string>();
  const footnotesBlock = rawTagContent(xml, "footnotes");
  if (!footnotesBlock) return footnotes;
  const matcher = /<footnote\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/footnote>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(footnotesBlock)) !== null) footnotes.set(match[1], decodeXml(match[2]));
  return footnotes;
}

function footnoteIdsForTransaction(xml: string): string[] {
  const ids = new Set<string>();
  const matcher = /<footnoteId\b[^>]*\bid=["']([^"']+)["'][^>]*\/?\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(xml)) !== null) ids.add(match[1]);
  return Array.from(ids);
}

function parseOwners(xml: string): SecForm4ReportingOwner[] {
  const owners = blocks(xml, "reportingOwner").map(ownerXml => {
    const id = rawTagContent(ownerXml, "reportingOwnerId") ?? "";
    const relationship = rawTagContent(ownerXml, "reportingOwnerRelationship") ?? "";
    const name = tagContent(id, "rptOwnerName");
    if (!name) throw new SecForm4ParseError("Form 4 filing is missing a reporting owner name.");
    const ownerCikRaw = tagContent(id, "rptOwnerCik");
    const ownerCik = ownerCikRaw ? normalizeCik(ownerCikRaw) : null;
    if (ownerCikRaw && !ownerCik) throw new SecForm4ParseError("Form 4 filing has an invalid reporting owner CIK.");
    return {
      cik: ownerCik,
      name,
      isDirector: tagBoolean(relationship, "isDirector"),
      isOfficer: tagBoolean(relationship, "isOfficer"),
      isTenPercentOwner: tagBoolean(relationship, "isTenPercentOwner"),
      isOther: tagBoolean(relationship, "isOther"),
      officerTitle: tagContent(relationship, "officerTitle"),
    };
  });
  if (!owners.length) throw new SecForm4ParseError("Form 4 filing has no reporting owner.");
  return owners;
}

function parseTransaction(
  transactionXml: string,
  table: SecForm4Observation["table"],
  context: Omit<SecForm4Observation, "id" | "table" | "securityTitle" | "transactionDate" | "transactionCode" | "transactionType" | "acquiredDisposedCode" | "shares" | "pricePerShare" | "amount" | "sharesOwnedFollowingTransaction" | "ownershipForm" | "planStatus" | "planDisclosure" | "footnoteIds">,
  sequence: number,
  footnotes: Map<string, string>,
  formPlanIndicated: boolean,
): SecForm4Observation {
  const transactionDate = nestedValue(transactionXml, "transactionDate");
  if (!isIsoDate(transactionDate)) throw new SecForm4ParseError("Form 4 transaction has an invalid transaction date.");
  const code = tagContent(rawTagContent(transactionXml, "transactionCoding") ?? "", "transactionCode")?.toUpperCase();
  if (!code || !/^[A-Z]$/.test(code)) throw new SecForm4ParseError("Form 4 transaction has an invalid transaction code.");
  const amounts = rawTagContent(transactionXml, "transactionAmounts") ?? "";
  const acquiredDisposedCode = nestedValue(amounts, "transactionAcquiredDisposedCode")?.toUpperCase();
  if (acquiredDisposedCode !== "A" && acquiredDisposedCode !== "D") {
    throw new SecForm4ParseError("Form 4 transaction has an invalid acquired/disposed code.");
  }
  const shares = toFiniteNumber(nestedValue(amounts, "transactionShares"), "transaction shares", { required: true, positive: true });
  const pricePerShare = toFiniteNumber(nestedValue(amounts, "transactionPricePerShare"), "transaction price per share", { required: false });
  const postTransaction = rawTagContent(transactionXml, "postTransactionAmounts") ?? "";
  const sharesOwnedFollowingTransaction = toFiniteNumber(
    nestedValue(postTransaction, "sharesOwnedFollowingTransaction"),
    "shares owned following transaction",
    { required: false },
  );
  const ownershipCode = nestedValue(rawTagContent(transactionXml, "ownershipNature") ?? "", "directOrIndirectOwnership")?.toUpperCase() ?? null;
  if (ownershipCode !== null && ownershipCode !== "D" && ownershipCode !== "I") {
    throw new SecForm4ParseError("Form 4 transaction has an invalid ownership form.");
  }
  const securityTitle = table === "NON_DERIVATIVE"
    ? nestedValue(transactionXml, "securityTitle")
    : nestedValue(transactionXml, "underlyingSecurityTitle") ?? nestedValue(transactionXml, "derivativeSecurityTitle");
  if (!securityTitle) throw new SecForm4ParseError("Form 4 transaction is missing a security title.");

  const footnoteIds = footnoteIdsForTransaction(transactionXml);
  const footnotePlanDisclosure = footnoteIds
    .map(id => footnotes.get(id))
    .find((value): value is string => Boolean(value && /10b5[\s-]*1/i.test(value) && /plan|contract|instruction/i.test(value)));
  const planDisclosure = formPlanIndicated
    ? "Form 4 Rule 10b5-1(c) indication."
    : footnotePlanDisclosure ?? null;

  return {
    ...context,
    id: `${context.accessionNumber}:${table}:${sequence}`,
    table,
    securityTitle,
    transactionDate,
    transactionCode: code,
    transactionType: classifyTransactionCode(code),
    acquiredDisposedCode,
    shares: shares!,
    pricePerShare,
    amount: pricePerShare === null ? null : shares! * pricePerShare,
    sharesOwnedFollowingTransaction,
    ownershipForm: ownershipCode,
    planStatus: planDisclosure ? "disclosed" : "unknown",
    planDisclosure,
    footnoteIds,
  };
}

/**
 * Strictly parses one recorded EDGAR ownership XML document. It is exported so
 * fixture tests can verify source mapping without a network call.
 */
export function parseSecForm4Xml(xml: string, metadata: SecForm4FilingMetadata): SecForm4Observation[] {
  if (!xml.includes("<ownershipDocument")) throw new SecForm4ParseError("SEC response is not an ownership XML document.");
  if (!/^\d{10}$/.test(metadata.issuerCik) || !metadata.accessionNumber || !metadata.sourceUrl) {
    throw new SecForm4ParseError("Form 4 source metadata is incomplete.");
  }
  if (!isIsoDate(metadata.filingDate)) throw new SecForm4ParseError("Form 4 source metadata has an invalid filing date.");
  const acceptanceDateTime = toIsoTimestamp(metadata.acceptanceDateTime, "acceptance timestamp");
  const issuer = rawTagContent(xml, "issuer") ?? "";
  const xmlCik = normalizeCik(tagContent(issuer, "issuerCik") ?? "");
  const issuerName = tagContent(issuer, "issuerName");
  const xmlTicker = normalizeTicker(tagContent(issuer, "issuerTradingSymbol") ?? "");
  if (!xmlCik || xmlCik !== metadata.issuerCik || !issuerName || !xmlTicker || xmlTicker !== metadata.ticker) {
    throw new SecForm4ParseError("Form 4 XML issuer identity does not match SEC submission metadata.");
  }

  const context = {
    accessionNumber: metadata.accessionNumber,
    issuerCik: metadata.issuerCik,
    issuerName,
    ticker: metadata.ticker,
    sourceUrl: metadata.sourceUrl,
    filingDate: metadata.filingDate,
    acceptanceDateTime,
    reportingOwners: parseOwners(xml),
  };
  const footnotes = parseFootnotes(xml);
  const formPlanIndicated = ["aff10b5One", "rule10b5One"]
    .some(tag => ["1", "true", "yes"].includes((tagContent(xml, tag) ?? "").trim().toLowerCase()));
  const nonDerivative = blocks(xml, "nonDerivativeTransaction");
  const derivative = blocks(xml, "derivativeTransaction");
  const parsed = [
    ...nonDerivative.map((block, index) => parseTransaction(block, "NON_DERIVATIVE", context, index, footnotes, formPlanIndicated)),
    ...derivative.map((block, index) => parseTransaction(block, "DERIVATIVE", context, nonDerivative.length + index, footnotes, formPlanIndicated)),
  ];
  if (!parsed.length) throw new SecForm4ParseError("Form 4 filing contains no transaction rows.");
  return parsed;
}

function unavailable(ticker: string, fetchedAt: string, reason: string, sourceUrls: string[] = []): Form4ObservationResult {
  return {
    status: "UNAVAILABLE",
    observations: [],
    provider: { id: SEC_FORM4_PROVIDER_ID, name: "SEC EDGAR", ticker, fetchedAt, sourceUrls },
    observedAt: null,
    reason,
  };
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new SecForm4ParseError(`SEC submissions response is missing ${field}.`);
  }
  return value;
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new SecForm4ParseError(`${label} request failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new SecForm4ParseError(`${label} response was not valid JSON.`);
  }
}

async function responseText(response: Response, label: string): Promise<string> {
  if (!response.ok) throw new SecForm4ParseError(`${label} request failed with HTTP ${response.status}.`);
  const text = await response.text();
  if (!text.trim()) throw new SecForm4ParseError(`${label} response was empty.`);
  return text;
}

/**
 * Builds a Form 4 adapter. Tests inject fetch and a declared fixture user
 * agent; production callers should use getForm4Observations.
 */
export function createSecForm4Adapter(options: SecForm4AdapterOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const userAgent = options.userAgent ?? process.env.SEC_USER_AGENT;
  const now = options.now ?? (() => new Date());
  const maxFilings = options.maxFilings ?? DEFAULT_MAX_FILINGS;
  const maxFilingAgeDays = options.maxFilingAgeDays ?? DEFAULT_MAX_FILING_AGE_DAYS;

  return async function getForm4Observations(tickerInput: string): Promise<Form4ObservationResult> {
    const ticker = normalizeTicker(tickerInput);
    const fetchedAt = now().toISOString();
    if (!ticker) return unavailable(tickerInput.trim().toUpperCase(), fetchedAt, "A valid ticker is required for SEC Form 4 lookup.");
    if (!userAgent?.trim()) {
      return unavailable(ticker, fetchedAt, "SEC Form 4 access requires configured SEC_USER_AGENT with a declared organization and contact email.");
    }
    if (!Number.isInteger(maxFilings) || maxFilings < 1 || !Number.isFinite(maxFilingAgeDays) || maxFilingAgeDays < 0) {
      return unavailable(ticker, fetchedAt, "SEC Form 4 adapter configuration is invalid.");
    }

    const headers = { "User-Agent": userAgent, Accept: "application/json" };
    const sourceUrls: string[] = [COMPANY_TICKERS_URL];
    try {
      const tickerResponse = await fetchImpl(COMPANY_TICKERS_URL, { headers, signal: AbortSignal.timeout(10_000) });
      const tickerJson = await responseJson(tickerResponse, "SEC company ticker mapping") as Record<string, CompanyTickerRecord>;
      const company = Object.values(tickerJson).find(record => normalizeTicker(record.ticker ?? "") === ticker);
      const cik = company && normalizeCik(company.cik_str ?? "");
      if (!company || !cik) return unavailable(ticker, fetchedAt, "SEC company ticker mapping did not provide a verified issuer CIK.", sourceUrls);

      const submissionsUrl = `${DATA_SEC_ORIGIN}/submissions/CIK${cik}.json`;
      sourceUrls.push(submissionsUrl);
      const submissionsResponse = await fetchImpl(submissionsUrl, { headers, signal: AbortSignal.timeout(10_000) });
      const submissions = await responseJson(submissionsResponse, "SEC submissions") as SubmissionResponse;
      const recent = submissions.filings?.recent;
      if (!recent) throw new SecForm4ParseError("SEC submissions response is missing recent filing history.");
      const forms = requireStringArray(recent.form, "filings.recent.form");
      const accessionNumbers = requireStringArray(recent.accessionNumber, "filings.recent.accessionNumber");
      const filingDates = requireStringArray(recent.filingDate, "filings.recent.filingDate");
      const acceptanceTimes = requireStringArray(recent.acceptanceDateTime, "filings.recent.acceptanceDateTime");
      const primaryDocuments = requireStringArray(recent.primaryDocument, "filings.recent.primaryDocument");
      if (![accessionNumbers.length, filingDates.length, acceptanceTimes.length, primaryDocuments.length].every(length => length === forms.length)) {
        throw new SecForm4ParseError("SEC submissions response has inconsistent filing columns.");
      }

      const form4Filings: SecForm4FilingMetadata[] = [];
      for (let index = 0; index < forms.length && form4Filings.length < maxFilings; index++) {
        if (forms[index] !== "4" && forms[index] !== "4/A") continue;
        const accessionNumber = accessionNumbers[index].trim();
        const filingDate = filingDates[index].trim();
        const acceptanceDateTime = acceptanceTimes[index].trim();
        const primaryDocument = primaryDocuments[index].trim();
        if (!accessionNumber || !isIsoDate(filingDate) || !acceptanceDateTime || !primaryDocument) {
          throw new SecForm4ParseError("SEC Form 4 submission metadata is incomplete.");
        }
        const accessionDigits = accessionNumber.replace(/-/g, "");
        if (!/^\d+$/.test(accessionDigits) || /(?:^|\/)\.\.(?:\/|$)|[?#]/.test(primaryDocument)) {
          throw new SecForm4ParseError("SEC Form 4 submission metadata is malformed.");
        }
        const sourceUrl = `${SEC_ARCHIVES_ORIGIN}/${String(Number(cik))}/${accessionDigits}/${primaryDocument}`;
        form4Filings.push({ accessionNumber, issuerCik: cik, ticker, filingDate, acceptanceDateTime, primaryDocument, sourceUrl });
      }
      if (!form4Filings.length) return unavailable(ticker, fetchedAt, "SEC submission history contains no Form 4 filing with complete source metadata.", sourceUrls);

      const newestAcceptedAt = Math.max(...form4Filings.map(filing => Date.parse(filing.acceptanceDateTime)));
      if (!Number.isFinite(newestAcceptedAt)) throw new SecForm4ParseError("SEC Form 4 filing is missing a valid acceptance timestamp.");
      if (now().getTime() - newestAcceptedAt > maxFilingAgeDays * 86_400_000) {
        return unavailable(ticker, fetchedAt, `Latest SEC Form 4 filing exceeds the configured ${maxFilingAgeDays}-day freshness limit.`, sourceUrls);
      }

      const observations: SecForm4Observation[] = [];
      for (const filing of form4Filings) {
        sourceUrls.push(filing.sourceUrl);
        const xmlResponse = await fetchImpl(filing.sourceUrl, { headers: { ...headers, Accept: "application/xml,text/xml" }, signal: AbortSignal.timeout(10_000) });
        const xml = await responseText(xmlResponse, "SEC Form 4 document");
        observations.push(...parseSecForm4Xml(xml, filing));
      }
      const observedAt = new Date(Math.max(...observations.map(observation => Date.parse(observation.acceptanceDateTime)))).toISOString();
      return {
        status: "AVAILABLE",
        observations,
        provider: { id: SEC_FORM4_PROVIDER_ID, name: "SEC EDGAR", ticker, fetchedAt, sourceUrls },
        observedAt,
        reason: null,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "SEC Form 4 source request failed.";
      return unavailable(ticker, fetchedAt, reason, sourceUrls);
    }
  };
}

/** Production SEC Form 4 observation boundary. */
export const getForm4Observations = createSecForm4Adapter();
