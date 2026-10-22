/**
 * SEC EDGAR Form 4 verification contract.
 *
 * Disabled. This module does not fetch, parse, or store filings.
 * SEC_EDGAR_INGESTION_ENABLED is a source constant, not an environment flag.
 */

export const SEC_EDGAR_INGESTION_ENABLED = false;

const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface EdgarForm4Transaction {
  insiderName: string;
  role: string;
  transactionCode: string;
  shares: number;
  pricePerShare: number | null;
  acquiredOrDisposed: "A" | "D";
}

export interface EdgarForm4Provenance {
  provider: "SEC EDGAR";
  retrievedAt: string;
  filingIndexUrl: string;
}

export interface EdgarForm4Filing {
  accessionNumber: string;
  filingDate: string;
  issuerTicker: string;
  sourceUrl: string;
  transactions: EdgarForm4Transaction[];
  provenance: EdgarForm4Provenance;
}

export type EdgarClaimResult =
  | { ok: true; filing: EdgarForm4Filing }
  | { ok: false; reason: string };

export type EdgarIngestionResult =
  | { status: "disabled" }
  | { status: "rejected"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function secUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "www.sec.gov" || url.hostname === "sec.gov");
  } catch {
    return false;
  }
}

function transaction(value: unknown): EdgarForm4Transaction | null {
  if (!isRecord(value)) return null;
  if (!nonEmpty(value.insiderName) || !nonEmpty(value.role) || !nonEmpty(value.transactionCode)) return null;
  if (value.acquiredOrDisposed !== "A" && value.acquiredOrDisposed !== "D") return null;
  if (typeof value.shares !== "number" || !Number.isFinite(value.shares) || value.shares <= 0) return null;
  if (value.pricePerShare !== null && (typeof value.pricePerShare !== "number" || !Number.isFinite(value.pricePerShare) || value.pricePerShare < 0)) {
    return null;
  }
  return {
    insiderName: value.insiderName.trim(),
    role: value.role.trim(),
    transactionCode: value.transactionCode.trim(),
    shares: value.shares,
    pricePerShare: value.pricePerShare,
    acquiredOrDisposed: value.acquiredOrDisposed,
  };
}

/** Pure contract check. It does not contact the SEC. */
export function validateEdgarForm4Claim(input: unknown): EdgarClaimResult {
  if (!isRecord(input)) return { ok: false, reason: "Filing claim must be an object." };
  if (!nonEmpty(input.accessionNumber) || !ACCESSION.test(input.accessionNumber)) {
    return { ok: false, reason: "Accession number is required." };
  }
  if (!nonEmpty(input.filingDate) || !ISO_DATE.test(input.filingDate) || Number.isNaN(Date.parse(`${input.filingDate}T00:00:00Z`))) {
    return { ok: false, reason: "Filing date is required." };
  }
  if (!nonEmpty(input.issuerTicker)) return { ok: false, reason: "Issuer ticker is required." };
  if (!secUrl(input.sourceUrl)) return { ok: false, reason: "SEC source link is required." };
  if (!Array.isArray(input.transactions) || input.transactions.length === 0) {
    return { ok: false, reason: "Transaction details are required." };
  }
  const transactions: EdgarForm4Transaction[] = [];
  for (const row of input.transactions) {
    const parsed = transaction(row);
    if (!parsed) return { ok: false, reason: "Transaction details are incomplete." };
    transactions.push(parsed);
  }
  if (!isRecord(input.provenance) || input.provenance.provider !== "SEC EDGAR") {
    return { ok: false, reason: "SEC EDGAR provenance is required." };
  }
  if (!nonEmpty(input.provenance.retrievedAt) || Number.isNaN(Date.parse(input.provenance.retrievedAt))) {
    return { ok: false, reason: "Provenance retrieval time is required." };
  }
  if (!secUrl(input.provenance.filingIndexUrl)) {
    return { ok: false, reason: "Provenance filing index link is required." };
  }
  return {
    ok: true,
    filing: {
      accessionNumber: input.accessionNumber,
      filingDate: input.filingDate,
      issuerTicker: input.issuerTicker.trim().toUpperCase(),
      sourceUrl: input.sourceUrl,
      transactions,
      provenance: {
        provider: "SEC EDGAR",
        retrievedAt: input.provenance.retrievedAt,
        filingIndexUrl: input.provenance.filingIndexUrl,
      },
    },
  };
}

/** Disabled entry point. It never fetches and never returns a filing. */
export function ingestVerifiedEdgarForm4(input: unknown): EdgarIngestionResult {
  if (!SEC_EDGAR_INGESTION_ENABLED) return { status: "disabled" };
  const claim = validateEdgarForm4Claim(input);
  if (!claim.ok) return { status: "rejected", reason: claim.reason };
  return { status: "rejected", reason: "SEC EDGAR retrieval is not implemented." };
}
