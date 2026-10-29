import { createHash } from "node:crypto";

/**
 * Official SEC/EDGAR Section 16 ownership-record reader.
 *
 * Requests are possible only when SEC_EDGAR_USER_AGENT contains a declared
 * organization and email contact. The module never uses a default, invented,
 * or browser user agent. It only admits Forms 3, 4, and 5 (and amendments),
 * and only returns transaction rows that are present in the official ownership
 * XML. It deliberately does not treat Form 13F or any other form as insider
 * activity.
 */

export const SEC_EDGAR_INGESTION_ENABLED = true;
export const SEC_EDGAR_MIN_INTERVAL_MS = 250;
export const SEC_EDGAR_MAX_REQUESTS_PER_SECOND = 4;
export const SEC_EDGAR_MAX_RETRIES = 1;
export const SEC_EDGAR_MAX_FILINGS_PER_REQUEST = 5;

const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const OWNERSHIP_FORMS = new Set(["3", "3/A", "4", "4/A", "5", "5/A"]);
const SEC_HOSTS = new Set(["sec.gov", "www.sec.gov", "data.sec.gov"]);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_DELAY_MS = 500;

export interface EdgarReportingOwner {
  cik: string | null;
  name: string;
  role: string | null;
}

export interface EdgarInsiderTransaction {
  transactionDate: string | null;
  ownerCik: string | null;
  ownerName: string | null;
  role: string | null;
  transactionCode: string;
  shares: number;
  pricePerShare: number | null;
  acquiredOrDisposed: "A" | "D";
}

export interface EdgarForm4Provenance {
  provider: "SEC EDGAR";
  retrievedAt: string;
  filingIndexUrl: string;
  submissionsUrl: string;
}

export interface EdgarInsiderFiling {
  accessionNumber: string;
  formType: "3" | "3/A" | "4" | "4/A" | "5" | "5/A";
  isAmendment: boolean;
  filingDate: string;
  reportDate: string | null;
  issuerTicker: string;
  sourceUrl: string;
  rawDocumentSha256: string;
  reportingOwners: EdgarReportingOwner[];
  transactions: EdgarInsiderTransaction[];
  provenance: EdgarForm4Provenance;
}

/** Kept as a compatibility alias for the prior Form-4-only contract. */
export type EdgarForm4Filing = EdgarInsiderFiling;

export type EdgarClaimResult =
  | { ok: true; filing: EdgarInsiderFiling }
  | { ok: false; reason: string };

export type EdgarIngestionResult =
  | { status: "accepted"; filing: EdgarInsiderFiling }
  | { status: "rejected"; reason: string };

export type EdgarUnavailableReason =
  | "configuration_required"
  | "ticker_not_found"
  | "source_request_failed"
  | "source_response_invalid"
  | "no_admissible_filings";

export type EdgarTickerReadResult =
  | {
      status: "ok";
      ticker: string;
      cik: string;
      companyName: string;
      retrievedAt: string;
      filings: EdgarInsiderFiling[];
    }
  | {
      status: "unavailable";
      ticker: string;
      reason: EdgarUnavailableReason;
      message: string;
    };

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

interface EdgarReaderOptions {
  /** Tests may provide a compliant declared user agent without reading process state. */
  userAgent?: string | null;
  fetch?: FetchLike;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  pacer?: SecRequestPacer;
  minIntervalMs?: number;
  maxFilings?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

interface TickerEntry {
  ticker: string;
  cik: string;
  companyName: string;
}

interface SubmissionRow {
  accessionNumber: string;
  formType: EdgarInsiderFiling["formType"];
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string;
}

class EdgarRequestError extends Error {
  constructor(
    readonly reason: Exclude<EdgarUnavailableReason, "configuration_required" | "ticker_not_found" | "no_admissible_filings">,
  ) {
    super(reason);
  }
}

/**
 * A process-local sequential reservation prevents concurrent app requests from
 * collectively exceeding the module's documented 4 requests/second ceiling.
 */
export class SecRequestPacer {
  private nextAt = 0;

  async reserve(now: () => number, sleep: (milliseconds: number) => Promise<void>, minIntervalMs: number): Promise<void> {
    const current = now();
    const scheduled = Math.max(current, this.nextAt);
    this.nextAt = scheduled + minIntervalMs;
    const waitMs = scheduled - current;
    if (waitMs > 0) await sleep(waitMs);
  }
}

const sharedPacer = new SecRequestPacer();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  if (!nonEmpty(value) || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: unknown): value is string {
  return nonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function isSecUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SEC_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isArchiveFilingUrl(value: unknown): value is string {
  if (!isSecUrl(value)) return false;
  const url = new URL(value);
  return url.hostname.toLowerCase() === "www.sec.gov" && url.pathname.startsWith("/Archives/edgar/data/");
}

function isOwnershipForm(value: unknown): value is EdgarInsiderFiling["formType"] {
  return typeof value === "string" && OWNERSHIP_FORMS.has(value);
}

function validDeclaredUserAgent(value: string | null | undefined): value is string {
  if (!value || value.length > 240 || /[\r\n]/.test(value)) return false;
  // SEC's published sample is "Company Name AdminContact@example.com". This
  // validates that a caller declared that structure; it cannot attest that the
  // configured identity belongs to the deploying organization.
  return /^[\x20-\x7E]+\s+[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalizedTicker(value: string): string | null {
  const ticker = value.trim().toUpperCase();
  return /^[A-Z0-9.]{1,10}$/.test(ticker) ? ticker : null;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function publicMessage(reason: EdgarUnavailableReason): string {
  switch (reason) {
    case "configuration_required":
      return "Official SEC/EDGAR retrieval is unavailable because no declared SEC contact user agent is configured.";
    case "ticker_not_found":
      return "The official SEC ticker directory did not identify this issuer.";
    case "no_admissible_filings":
      return "No admissible official Section 16 transaction filing was available for this issuer.";
    case "source_response_invalid":
      return "Official SEC/EDGAR records were returned, but no complete source record could be admitted.";
    case "source_request_failed":
      return "Official SEC/EDGAR records are temporarily unavailable. No filing data is shown.";
  }
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal: string) => String.fromCodePoint(Number.parseInt(hexadecimal, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function tagText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match?.[1]) return null;
  const text = cleanXmlText(match[1]);
  return text || null;
}

function tagBlocks(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map(match => match[1] ?? "")
    .filter(Boolean);
}

function flag(xml: string, tag: string): boolean {
  const value = tagText(xml, tag)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "y";
}

function roleForOwner(xml: string): string | null {
  const roles: string[] = [];
  if (flag(xml, "isDirector")) roles.push("Director");
  if (flag(xml, "isOfficer")) roles.push(tagText(xml, "officerTitle") ?? "Officer");
  if (flag(xml, "isTenPercentOwner")) roles.push("10% Owner");
  if (flag(xml, "isOther")) roles.push(tagText(xml, "otherText") ?? "Other");
  return roles.length > 0 ? roles.join("; ") : null;
}

function validCik(value: unknown): string | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,10}$/.test(raw)) return null;
  return raw.padStart(10, "0");
}

function safeDocumentPath(value: unknown): string | null {
  if (!nonEmpty(value) || value.length > 240 || value.startsWith("/") || value.includes("\\") || value.split("/").some(part => !part || part === "." || part === ".." || !/^[A-Za-z0-9._-]+$/.test(part))) {
    return null;
  }
  return value;
}

function parseTickerDirectory(payload: unknown, ticker: string): TickerEntry | null {
  if (!isRecord(payload)) return null;
  for (const row of Object.values(payload)) {
    if (!isRecord(row) || typeof row.ticker !== "string" || row.ticker.trim().toUpperCase() !== ticker) continue;
    const cik = validCik(row.cik_str);
    const companyName = typeof row.title === "string" ? row.title.trim() : "";
    if (cik && companyName) return { ticker, cik, companyName };
  }
  return null;
}

function asStringArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseSubmissionRows(payload: unknown): SubmissionRow[] {
  if (!isRecord(payload) || !isRecord(payload.filings) || !isRecord(payload.filings.recent)) return [];
  const recent = payload.filings.recent;
  const forms = asStringArray(recent.form);
  const accessions = asStringArray(recent.accessionNumber);
  const filingDates = asStringArray(recent.filingDate);
  const reportDates = asStringArray(recent.reportDate);
  const documents = asStringArray(recent.primaryDocument);
  const length = Math.min(forms.length, accessions.length, filingDates.length, documents.length);
  const rows: SubmissionRow[] = [];
  for (let index = 0; index < length; index += 1) {
    const formType = forms[index];
    const accessionNumber = accessions[index];
    const filingDate = filingDates[index];
    const primaryDocument = safeDocumentPath(documents[index]);
    const reportDate = reportDates[index] == null || reportDates[index] === "" ? null : reportDates[index];
    if (!isOwnershipForm(formType) || typeof accessionNumber !== "string" || !ACCESSION.test(accessionNumber) || !isIsoDate(filingDate) || !primaryDocument || (reportDate !== null && !isIsoDate(reportDate))) {
      continue;
    }
    rows.push({ accessionNumber, formType, filingDate, reportDate, primaryDocument });
  }
  return rows;
}

function filingUrls(cik: string, accessionNumber: string, primaryDocument: string): { indexUrl: string; sourceUrl: string } {
  const cikDirectory = String(Number(cik));
  const accessionDirectory = accessionNumber.replaceAll("-", "");
  return {
    indexUrl: `https://www.sec.gov/Archives/edgar/data/${cikDirectory}/${accessionNumber}-index.html`,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cikDirectory}/${accessionDirectory}/${primaryDocument}`,
  };
}

function indexReferencesDocument(indexHtml: string, primaryDocument: string): boolean {
  return indexHtml.toLowerCase().includes(primaryDocument.toLowerCase());
}

function parseOwners(xml: string): EdgarReportingOwner[] {
  const owners: EdgarReportingOwner[] = [];
  for (const ownerXml of tagBlocks(xml, "reportingOwner")) {
    const ownerId = tagBlocks(ownerXml, "reportingOwnerId")[0] ?? ownerXml;
    const ownerName = tagText(ownerId, "rptOwnerName");
    if (!ownerName) continue;
    owners.push({
      cik: validCik(tagText(ownerId, "rptOwnerCik")),
      name: ownerName,
      role: roleForOwner(tagBlocks(ownerXml, "reportingOwnerRelationship")[0] ?? ownerXml),
    });
  }
  return owners;
}

function parseTransaction(block: string, owners: EdgarReportingOwner[]): EdgarInsiderTransaction | null {
  const code = tagText(tagBlocks(block, "transactionCoding")[0] ?? block, "transactionCode");
  const shares = numberFromUnknown(tagText(tagBlocks(block, "transactionAmounts")[0] ?? block, "transactionShares"));
  const acquiredOrDisposed = tagText(tagBlocks(block, "transactionAmounts")[0] ?? block, "transactionAcquiredDisposedCode");
  const priceText = tagText(tagBlocks(block, "transactionAmounts")[0] ?? block, "transactionPricePerShare");
  const pricePerShare = priceText === null ? null : numberFromUnknown(priceText);
  const transactionDate = tagText(tagBlocks(block, "transactionDate")[0] ?? block, "value") ?? tagText(block, "transactionDate");
  if (!code || shares === null || shares <= 0 || (acquiredOrDisposed !== "A" && acquiredOrDisposed !== "D") || (priceText !== null && (pricePerShare === null || pricePerShare < 0)) || (transactionDate !== null && !isIsoDate(transactionDate))) {
    return null;
  }
  const soleOwner = owners.length === 1 ? owners[0] : null;
  return {
    transactionDate,
    ownerCik: soleOwner?.cik ?? null,
    ownerName: soleOwner?.name ?? null,
    role: soleOwner?.role ?? null,
    transactionCode: code,
    shares,
    pricePerShare,
    acquiredOrDisposed,
  };
}

function parseFilingXml(input: {
  xml: string;
  ticker: string;
  formType: EdgarInsiderFiling["formType"];
  accessionNumber: string;
  filingDate: string;
  reportDate: string | null;
  sourceUrl: string;
  indexUrl: string;
  submissionsUrl: string;
  retrievedAt: string;
}): EdgarIngestionResult {
  if (!/<ownershipDocument(?:\s[^>]*)?>/i.test(input.xml)) return { status: "rejected", reason: "Official filing was not an ownership XML document." };
  const declaredForm = tagText(input.xml, "documentType");
  const expectedBaseForm = input.formType.replace("/A", "");
  const declaredBaseForm = declaredForm?.toUpperCase().replace("/A", "");
  // Ownership XML commonly names the base form while the submissions feed
  // carries the authoritative /A amendment marker.
  if (declaredBaseForm && declaredBaseForm !== expectedBaseForm) return { status: "rejected", reason: "Official filing form type did not match its submissions record." };
  const xmlTicker = tagText(tagBlocks(input.xml, "issuer")[0] ?? input.xml, "issuerTradingSymbol");
  if (!xmlTicker || xmlTicker.toUpperCase() !== input.ticker) return { status: "rejected", reason: "Official filing issuer did not match the requested ticker." };
  const reportingOwners = parseOwners(input.xml);
  if (reportingOwners.length === 0) return { status: "rejected", reason: "Official filing did not identify a reporting owner." };
  const transactionBlocks = [
    ...tagBlocks(input.xml, "nonDerivativeTransaction"),
    ...tagBlocks(input.xml, "derivativeTransaction"),
  ];
  const transactions = transactionBlocks
    .map(block => parseTransaction(block, reportingOwners))
    .filter((row): row is EdgarInsiderTransaction => row !== null);
  if (transactions.length === 0) return { status: "rejected", reason: "Official filing had no complete reportable transaction rows." };
  return ingestVerifiedEdgarForm4({
    accessionNumber: input.accessionNumber,
    formType: input.formType,
    isAmendment: input.formType.endsWith("/A") || flag(input.xml, "isAmendment"),
    filingDate: input.filingDate,
    reportDate: input.reportDate ?? tagText(input.xml, "periodOfReport"),
    issuerTicker: input.ticker,
    sourceUrl: input.sourceUrl,
    rawDocumentSha256: createHash("sha256").update(input.xml).digest("hex"),
    reportingOwners,
    transactions,
    provenance: {
      provider: "SEC EDGAR",
      retrievedAt: input.retrievedAt,
      filingIndexUrl: input.indexUrl,
      submissionsUrl: input.submissionsUrl,
    },
  });
}

function transaction(value: unknown): EdgarInsiderTransaction | null {
  if (!isRecord(value) || !nonEmpty(value.transactionCode) || (value.acquiredOrDisposed !== "A" && value.acquiredOrDisposed !== "D")) return null;
  if (value.transactionDate !== null && !isIsoDate(value.transactionDate)) return null;
  if (value.ownerCik !== null && validCik(value.ownerCik) === null) return null;
  if (value.ownerName !== null && !nonEmpty(value.ownerName)) return null;
  if (value.role !== null && !nonEmpty(value.role)) return null;
  if (typeof value.shares !== "number" || !Number.isFinite(value.shares) || value.shares <= 0) return null;
  if (value.pricePerShare !== null && (typeof value.pricePerShare !== "number" || !Number.isFinite(value.pricePerShare) || value.pricePerShare < 0)) return null;
  return {
    transactionDate: value.transactionDate,
    ownerCik: value.ownerCik === null ? null : validCik(value.ownerCik),
    ownerName: value.ownerName === null ? null : value.ownerName.trim(),
    role: value.role === null ? null : value.role.trim(),
    transactionCode: value.transactionCode.trim(),
    shares: value.shares,
    pricePerShare: value.pricePerShare,
    acquiredOrDisposed: value.acquiredOrDisposed,
  };
}

/** Pure contract check. It does not contact the SEC. */
export function validateEdgarForm4Claim(input: unknown): EdgarClaimResult {
  if (!isRecord(input)) return { ok: false, reason: "Filing claim must be an object." };
  if (!nonEmpty(input.accessionNumber) || !ACCESSION.test(input.accessionNumber)) return { ok: false, reason: "Accession number is required." };
  if (!isOwnershipForm(input.formType)) return { ok: false, reason: "A Section 16 ownership form is required." };
  if (typeof input.isAmendment !== "boolean") return { ok: false, reason: "Amendment status is required." };
  if (!isIsoDate(input.filingDate)) return { ok: false, reason: "Filing date is required." };
  if (input.reportDate !== null && !isIsoDate(input.reportDate)) return { ok: false, reason: "Report date must be an ISO date or null." };
  if (!nonEmpty(input.issuerTicker)) return { ok: false, reason: "Issuer ticker is required." };
  if (!isArchiveFilingUrl(input.sourceUrl)) return { ok: false, reason: "SEC filing source link is required." };
  if (!nonEmpty(input.rawDocumentSha256) || !SHA256.test(input.rawDocumentSha256)) return { ok: false, reason: "Raw document hash is required." };
  if (!Array.isArray(input.reportingOwners) || input.reportingOwners.length === 0) return { ok: false, reason: "Reporting owner identity is required." };
  const reportingOwners: EdgarReportingOwner[] = [];
  for (const owner of input.reportingOwners) {
    if (!isRecord(owner) || !nonEmpty(owner.name) || (owner.cik !== null && validCik(owner.cik) === null) || (owner.role !== null && !nonEmpty(owner.role))) {
      return { ok: false, reason: "Reporting owner identity is incomplete." };
    }
    reportingOwners.push({ cik: owner.cik === null ? null : validCik(owner.cik), name: owner.name.trim(), role: owner.role === null ? null : owner.role.trim() });
  }
  if (!Array.isArray(input.transactions) || input.transactions.length === 0) return { ok: false, reason: "Transaction details are required." };
  const transactions: EdgarInsiderTransaction[] = [];
  for (const row of input.transactions) {
    const parsed = transaction(row);
    if (!parsed) return { ok: false, reason: "Transaction details are incomplete." };
    transactions.push(parsed);
  }
  if (!isRecord(input.provenance) || input.provenance.provider !== "SEC EDGAR" || !isIsoTimestamp(input.provenance.retrievedAt) || !isArchiveFilingUrl(input.provenance.filingIndexUrl) || !isSecUrl(input.provenance.submissionsUrl)) {
    return { ok: false, reason: "SEC EDGAR provenance is required." };
  }
  return {
    ok: true,
    filing: {
      accessionNumber: input.accessionNumber,
      formType: input.formType,
      isAmendment: input.isAmendment,
      filingDate: input.filingDate,
      reportDate: input.reportDate,
      issuerTicker: input.issuerTicker.trim().toUpperCase(),
      sourceUrl: input.sourceUrl,
      rawDocumentSha256: input.rawDocumentSha256.toLowerCase(),
      reportingOwners,
      transactions,
      provenance: {
        provider: "SEC EDGAR",
        retrievedAt: input.provenance.retrievedAt,
        filingIndexUrl: input.provenance.filingIndexUrl,
        submissionsUrl: input.provenance.submissionsUrl,
      },
    },
  };
}

/**
 * Admits a parsed official XML record. Network retrieval is performed by
 * readOfficialEdgarInsiderFilings, which calls this before returning any filing.
 */
export function ingestVerifiedEdgarForm4(input: unknown): EdgarIngestionResult {
  const claim = validateEdgarForm4Claim(input);
  return claim.ok ? { status: "accepted", filing: claim.filing } : { status: "rejected", reason: claim.reason };
}

async function fetchText(url: string, options: Required<Pick<EdgarReaderOptions, "fetch" | "now" | "sleep" | "pacer">> & { userAgent: string; minIntervalMs: number; timeoutMs: number; retryDelayMs: number }): Promise<string> {
  for (let attempt = 0; attempt <= SEC_EDGAR_MAX_RETRIES; attempt += 1) {
    await options.pacer.reserve(() => options.now().valueOf(), options.sleep, options.minIntervalMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await options.fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          "Accept-Encoding": "gzip, deflate",
          Accept: "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.1",
        },
        signal: controller.signal,
      });
      if (response.ok) return await response.text();
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === SEC_EDGAR_MAX_RETRIES) throw new EdgarRequestError("source_request_failed");
    } catch (error) {
      if (error instanceof EdgarRequestError || attempt === SEC_EDGAR_MAX_RETRIES) throw error instanceof EdgarRequestError ? error : new EdgarRequestError("source_request_failed");
    } finally {
      clearTimeout(timer);
    }
    await options.sleep(options.retryDelayMs * (attempt + 1));
  }
  throw new EdgarRequestError("source_request_failed");
}

async function fetchJson(url: string, options: Parameters<typeof fetchText>[1]): Promise<unknown> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new EdgarRequestError("source_response_invalid");
  }
}

/**
 * Reads a small, sequential set of official SEC records for one issuer. This
 * performs no database write or historical backfill. Every returned row carries
 * the official source URL, filing and report dates, transaction date/code, owner
 * identity, amendment flag, raw-document hash, and retrieval provenance.
 */
export async function readOfficialEdgarInsiderFilings(tickerInput: string, overrides: EdgarReaderOptions = {}): Promise<EdgarTickerReadResult> {
  const ticker = normalizedTicker(tickerInput) ?? tickerInput.trim().toUpperCase();
  if (!ticker) return { status: "unavailable", ticker: "", reason: "ticker_not_found", message: publicMessage("ticker_not_found") };
  const userAgent = overrides.userAgent ?? process.env.SEC_EDGAR_USER_AGENT;
  if (!SEC_EDGAR_INGESTION_ENABLED || !validDeclaredUserAgent(userAgent)) {
    return { status: "unavailable", ticker, reason: "configuration_required", message: publicMessage("configuration_required") };
  }
  const options = {
    userAgent: userAgent.trim(),
    fetch: overrides.fetch ?? (globalThis.fetch as unknown as FetchLike),
    now: overrides.now ?? (() => new Date()),
    sleep: overrides.sleep ?? defaultSleep,
    pacer: overrides.pacer ?? sharedPacer,
    minIntervalMs: clampInteger(overrides.minIntervalMs, SEC_EDGAR_MIN_INTERVAL_MS, SEC_EDGAR_MIN_INTERVAL_MS, 1_000),
    maxFilings: clampInteger(overrides.maxFilings, SEC_EDGAR_MAX_FILINGS_PER_REQUEST, 1, SEC_EDGAR_MAX_FILINGS_PER_REQUEST),
    timeoutMs: clampInteger(overrides.timeoutMs, DEFAULT_TIMEOUT_MS, 1_000, 15_000),
    retryDelayMs: clampInteger(overrides.retryDelayMs, DEFAULT_RETRY_DELAY_MS, 100, 2_000),
  };
  if (typeof options.fetch !== "function") return { status: "unavailable", ticker, reason: "source_request_failed", message: publicMessage("source_request_failed") };

  try {
    const directory = await fetchJson("https://www.sec.gov/files/company_tickers.json", options);
    const issuer = parseTickerDirectory(directory, ticker);
    if (!issuer) return { status: "unavailable", ticker, reason: "ticker_not_found", message: publicMessage("ticker_not_found") };
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${issuer.cik}.json`;
    const submissions = await fetchJson(submissionsUrl, options);
    const candidates = parseSubmissionRows(submissions).slice(0, options.maxFilings);
    const retrievedAt = options.now().toISOString();
    // A complete official submissions response with no Section 16 filing is a
    // successful empty lookup, not a source/configuration failure.
    if (candidates.length === 0) return { status: "ok", ticker: issuer.ticker, cik: issuer.cik, companyName: issuer.companyName, retrievedAt, filings: [] };

    const filings: EdgarInsiderFiling[] = [];
    let hadInvalidOfficialRecord = false;
    for (const candidate of candidates) {
      const urls = filingUrls(issuer.cik, candidate.accessionNumber, candidate.primaryDocument);
      const indexHtml = await fetchText(urls.indexUrl, options);
      if (!indexReferencesDocument(indexHtml, candidate.primaryDocument)) {
        hadInvalidOfficialRecord = true;
        continue;
      }
      const xml = await fetchText(urls.sourceUrl, options);
      const parsed = parseFilingXml({
        xml,
        ticker: issuer.ticker,
        formType: candidate.formType,
        accessionNumber: candidate.accessionNumber,
        filingDate: candidate.filingDate,
        reportDate: candidate.reportDate,
        sourceUrl: urls.sourceUrl,
        indexUrl: urls.indexUrl,
        submissionsUrl,
        retrievedAt,
      });
      if (parsed.status === "accepted") filings.push(parsed.filing);
      else hadInvalidOfficialRecord = true;
    }
    if (filings.length === 0) {
      if (hadInvalidOfficialRecord) {
        return { status: "unavailable", ticker, reason: "source_response_invalid", message: publicMessage("source_response_invalid") };
      }
      return { status: "ok", ticker: issuer.ticker, cik: issuer.cik, companyName: issuer.companyName, retrievedAt, filings: [] };
    }
    return { status: "ok", ticker: issuer.ticker, cik: issuer.cik, companyName: issuer.companyName, retrievedAt, filings };
  } catch (error) {
    const reason: EdgarUnavailableReason = error instanceof EdgarRequestError ? error.reason : "source_request_failed";
    return { status: "unavailable", ticker, reason, message: publicMessage(reason) };
  }
}
