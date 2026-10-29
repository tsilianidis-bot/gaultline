/*
 * FAULTLINE — Insider Intelligence
 *
 * This surface renders only official SEC/EDGAR ownership filings returned by the
 * authorized server reader. It does not derive conviction, a trading signal,
 * accuracy, a radar, a ranking, or an institutional-ownership interpretation.
 */
import { useState } from "react";
import { ExternalLink, FileText, RefreshCw, Search, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { PremiumGateFull } from "@/components/PremiumGate";
import { trackInsiderSearch } from "@/hooks/useAnalytics";
import { PAGE_SEO, useSEO } from "@/hooks/useSEO";
import { trpc } from "@/lib/trpc";

type OwnershipForm = "3" | "3/A" | "4" | "4/A" | "5" | "5/A";

type OfficialTransaction = {
  transactionDate: string | null;
  ownerCik: string | null;
  ownerName: string | null;
  role: string | null;
  transactionCode: string;
  shares: number;
  pricePerShare: number | null;
  acquiredOrDisposed: "A" | "D";
};

type OfficialFiling = {
  accessionNumber: string;
  formType: OwnershipForm;
  isAmendment: boolean;
  filingDate: string;
  reportDate: string | null;
  issuerTicker: string;
  sourceUrl: string;
  rawDocumentSha256: string;
  reportingOwners: Array<{ cik: string | null; name: string; role: string | null }>;
  transactions: OfficialTransaction[];
  provenance: {
    provider: "SEC EDGAR";
    retrievedAt: string;
    filingIndexUrl: string;
    submissionsUrl: string;
  };
};

type OfficialReadResult =
  | { status: "ok"; ticker: string; cik: string; companyName: string; retrievedAt: string; filings: OfficialFiling[] }
  | { status: "unavailable"; ticker: string; reason: string; message: string };

const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const PANEL: React.CSSProperties = {
  background: "rgba(12,15,22,0.98)",
  border: "1px solid rgba(0,212,255,0.18)",
  borderRadius: "6px",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

function formatPrice(value: number | null): string {
  return value === null ? "Not reported" : `$${formatNumber(value)}`;
}

function OfficialUnavailable({ message }: { message: string }) {
  return (
    <div role="alert" style={{ ...PANEL, padding: "14px 16px", borderColor: "rgba(255,149,0,0.45)", color: "#FFD08A", lineHeight: 1.55, fontFamily: MONO, fontSize: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", color: "#FFB84D" }}>
        <ShieldAlert size={15} aria-hidden="true" /> OFFICIAL SOURCE UNAVAILABLE
      </div>
      {message}
    </div>
  );
}

function FilingCard({ filing }: { filing: OfficialFiling }) {
  return (
    <article style={{ ...PANEL, padding: "16px", marginTop: "12px" }} aria-label={`${filing.formType} filing ${filing.accessionNumber}`}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#00D4FF", fontFamily: MONO, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}>
            FORM {filing.formType}{filing.isAmendment ? " · AMENDMENT" : ""}
          </div>
          <div style={{ color: "#D9E3ED", fontFamily: SANS, fontSize: "15px", marginTop: "5px" }}>
            Filed {filing.filingDate}{filing.reportDate ? ` · report date ${filing.reportDate}` : " · report date not reported"}
          </div>
          <div style={{ color: "#8393A5", fontFamily: MONO, fontSize: "10px", marginTop: "5px", wordBreak: "break-all" }}>ACCESSION {filing.accessionNumber}</div>
        </div>
        <a href={filing.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#66DAFF", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textDecoration: "none", border: "1px solid rgba(0,212,255,0.35)", borderRadius: "4px", padding: "7px 9px" }}>
          OPEN SEC FILING <ExternalLink size={12} aria-hidden="true" />
        </a>
      </header>

      <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(255,255,255,0.025)", borderRadius: "4px" }}>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#8A99A8", letterSpacing: "0.08em", marginBottom: "5px" }}>REPORTING OWNER{filing.reportingOwners.length === 1 ? "" : "S"}</div>
        {filing.reportingOwners.map(owner => (
          <div key={`${owner.cik ?? "unknown"}-${owner.name}`} style={{ fontFamily: SANS, fontSize: "13px", color: "#D9E3ED", lineHeight: 1.55 }}>
            {owner.name}{owner.role ? ` · ${owner.role}` : " · role not reported"}{owner.cik ? <span style={{ color: "#8393A5", fontFamily: MONO, fontSize: "10px" }}> · CIK {owner.cik}</span> : null}
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginTop: "14px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "630px" }}>
          <caption style={{ textAlign: "left", color: "#8A99A8", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", paddingBottom: "8px" }}>TRANSACTION ROWS AS FILED</caption>
          <thead>
            <tr>
              {["Transaction date", "Owner", "Code", "Acquired / disposed", "Shares", "Price / share"].map(label => (
                <th key={label} scope="col" style={{ color: "#78899A", fontFamily: MONO, fontSize: "9px", fontWeight: 500, letterSpacing: "0.07em", padding: "7px 8px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filing.transactions.map((transaction, index) => (
              <tr key={`${filing.accessionNumber}-${index}`}>
                <td style={cell}>{transaction.transactionDate ?? "Not reported"}</td>
                <td style={cell}>{transaction.ownerName ?? (filing.reportingOwners.length > 1 ? "Multiple owners; filing does not assign row" : "Not reported")}</td>
                <td style={{ ...cell, color: "#66DAFF", fontWeight: 700 }}>{transaction.transactionCode}</td>
                <td style={cell}>{transaction.acquiredOrDisposed === "A" ? "A" : "D"}</td>
                <td style={cell}>{formatNumber(transaction.shares)}</td>
                <td style={cell}>{formatPrice(transaction.pricePerShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer style={{ marginTop: "12px", color: "#6F8193", fontFamily: MONO, fontSize: "9px", lineHeight: 1.6, wordBreak: "break-word" }}>
        SEC EDGAR · retrieved {filing.provenance.retrievedAt} · <a href={filing.provenance.filingIndexUrl} target="_blank" rel="noreferrer" style={{ color: "#81CFF0" }}>filing index</a> · raw XML SHA-256 {filing.rawDocumentSha256}
      </footer>
    </article>
  );
}

const cell: React.CSSProperties = { color: "#C3CFDB", fontFamily: MONO, fontSize: "10px", padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.055)", verticalAlign: "top" };

export function InsiderIntelligenceInner() {
  useSEO(PAGE_SEO.insiderIntelligence);
  const [input, setInput] = useState("");
  const [requestedTicker, setRequestedTicker] = useState<string | null>(null);
  const tickerForQuery = requestedTicker ?? "AAPL";
  const query = trpc.insider.company.useQuery({ ticker: tickerForQuery }, {
    enabled: requestedTicker !== null,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  // The protected company procedure returns only the official-reader union.
  // Configuration and source failures remain explicit unavailable states.
  const officialRead = query.data as unknown as OfficialReadResult | undefined;

  const submit = () => {
    const ticker = input.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    if (!ticker) return;
    trackInsiderSearch(ticker);
    setRequestedTicker(ticker);
  };

  const sourceUnavailable = officialRead?.status === "unavailable" ? officialRead.message : query.error?.message;

  return (
    <div style={{ background: "#050608", minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>
        <PageHeader title="Insider Intelligence" subtitle="Official SEC/EDGAR Section 16 ownership filings only" badge="SEC SOURCE" />

        <section style={{ ...PANEL, padding: "16px", marginBottom: "12px" }} aria-label="Official SEC filing lookup">
          <div style={{ color: "#9BAABA", fontFamily: MONO, fontSize: "11px", lineHeight: 1.6, marginBottom: "12px" }}>
            Search an issuer ticker to retrieve only official Forms 3, 4, and 5 records and amendments. Form 13F and inferred conviction, rankings, accuracy, and signals are not used or displayed.
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 220px" }}>
              <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Issuer ticker</span>
              <input aria-label="Issuer ticker" value={input} onChange={event => setInput(event.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))} onKeyDown={event => event.key === "Enter" && submit()} maxLength={10} placeholder="Ticker, for example AAPL" style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.28)", borderRadius: "4px", color: "#E2E8F0", fontFamily: MONO, fontSize: "14px", letterSpacing: "0.08em", padding: "10px 12px", outline: "none" }} />
            </label>
            <button type="button" onClick={submit} style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.45)", borderRadius: "4px", color: "#66DAFF", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", padding: "10px 14px" }}>
              <Search size={14} aria-hidden="true" /> RETRIEVE FILINGS
            </button>
          </div>
        </section>

        {query.isLoading && <div role="status" style={{ ...PANEL, padding: "16px", color: "#9BAABA", fontFamily: MONO, fontSize: "11px" }}><RefreshCw size={13} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: "7px" }} />REQUESTING OFFICIAL SEC/EDGAR RECORDS…</div>}
        {sourceUnavailable && <OfficialUnavailable message={sourceUnavailable} />}

        {officialRead?.status === "ok" && !query.error && (
          <section aria-labelledby="official-filings-heading">
            <div style={{ ...PANEL, padding: "16px", marginTop: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
                <FileText size={18} color="#00D4FF" aria-hidden="true" />
                <div>
                  <h2 id="official-filings-heading" style={{ color: "#E3EDF5", fontFamily: SANS, fontSize: "20px", margin: 0 }}>{officialRead.ticker} · {officialRead.companyName}</h2>
                  <p style={{ color: "#8495A7", fontFamily: MONO, fontSize: "10px", lineHeight: 1.6, margin: "5px 0 0" }}>CIK {officialRead.cik} · retrieved {officialRead.retrievedAt} · {officialRead.filings.length} admitted filing{officialRead.filings.length === 1 ? "" : "s"}</p>
                </div>
              </div>
            </div>
            {officialRead.filings.map(filing => <FilingCard key={filing.accessionNumber} filing={filing} />)}
          </section>
        )}

        {!requestedTicker && (
          <div style={{ ...PANEL, marginTop: "12px", padding: "16px", color: "#8191A1", fontFamily: MONO, fontSize: "11px", lineHeight: 1.65 }}>
            No filing is displayed until an authenticated request retrieves a complete official SEC record. Missing source configuration, a denied request, malformed source record, or no admissible ownership transaction remains unavailable rather than becoming a modeled result.
          </div>
        )}

        <footer style={{ ...PANEL, marginTop: "12px", padding: "13px 15px", color: "#708293", fontFamily: MONO, fontSize: "10px", lineHeight: 1.65, textAlign: "center" }}>
          Source: U.S. Securities and Exchange Commission EDGAR. Filing dates, report dates, transaction dates, codes, ownership identity, amendment flags, source links, retrieval time, and raw-document hash are shown as available. This presentation is not investment advice.
        </footer>
      </div>
    </div>
  );
}

export default function InsiderIntelligence() {
  return <PremiumGateFull variant="insiderIntel"><InsiderIntelligenceInner /></PremiumGateFull>;
}
