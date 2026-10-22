# SEC EDGAR Form 4 ingestion (design only)

Status: **disabled**. `SEC_EDGAR_INGESTION_ENABLED` in `server/insider/edgarIngestion.ts` is a source constant set to `false`. It is not an environment variable. Nothing in this design fetches, stores, or displays a filing.

The synthetic Form 4 generator in `server/insiderIntelligence.ts` remains off the request path. Router procedures do not call it. A synthetic record is not an SEC filing.

## What a real filing must carry

A verified filing is admissible only when all of the following are present on the same record:

- SEC accession number, matching `##########-##-######`
- filing date (`YYYY-MM-DD`)
- issuer ticker
- at least one transaction: insider name, role, transaction code, positive share count, acquired-or-disposed (`A` or `D`), and a price that is either a finite non-negative number or explicitly null
- HTTPS source link on `sec.gov` or `www.sec.gov`
- provenance: provider exactly `SEC EDGAR`, retrieval timestamp, and an HTTPS filing-index link on the SEC host

`validateEdgarForm4Claim` checks that contract and does not contact the network. `ingestVerifiedEdgarForm4` returns `{ status: "disabled" }` while the constant is false.

## Intended pipeline once explicitly activated

1. Discover Form 4 filings from the SEC submissions feed for a known CIK. Do not invent a CIK from a ticker guess.
2. Download the filing index and the primary XML document using the accession number.
3. Parse transaction rows from the official XML only. Drop a filing that lacks the required fields.
4. Persist the raw document hash, accession number, filing date, source URL, and retrieval time with the parsed rows.
5. Serve those rows through a new read procedure. Do not route them through `getInsiderRadar`, `getInsiderCompany`, or `getInsiderAlertsForTicker`.
6. Label the surface with the SEC source link and the filing date. Missing fields stay unavailable. No conviction score is computed from an incomplete filing.

Activation requires a later change that sets the constant to true and adds the fetcher. This document does not authorize that change.
