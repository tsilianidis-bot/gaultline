# SEC EDGAR Section 16 ownership ingestion

## Source contract

`server/insider/edgarIngestion.ts` reads a bounded set of **official SEC/EDGAR** records for one issuer ticker. It resolves the ticker only through SEC `company_tickers.json`, reads that issuer’s official `data.sec.gov/submissions/CIK##########.json`, verifies the SEC filing-index page, then parses the referenced ownership XML. It does not call a paid vendor or an aggregation provider.

The reader only considers SEC ownership Forms **3, 4, and 5** and their `/A` amendments. It never classifies Form 13F or any generic SEC form as insider activity. Forms lacking complete reportable transaction rows remain unavailable rather than becoming an inferred purchase, sale, score, alert, or radar entry.

Every admitted result carries the official accession number, form type, amendment flag, filing date, report date when supplied, transaction date when supplied, transaction code, acquired/disposed value, shares, price when supplied, reporting-owner identity, primary-XML URL, filing-index URL, submissions URL, retrieval timestamp, and SHA-256 of the exact fetched XML. A filing with multiple reporting owners does not assign a transaction row to one owner unless the source identifies one unambiguously.

The implementation does not write the records to the database or backfill history. That avoids representing an ephemeral public retrieval as durable ingestion before a separately reviewed additive persistence design, migration, retention policy, and source-rights review exist. The customer surface labels each returned value as a source record and retains unavailable states.

## SEC fair-access boundary

The reader will not send a request unless `SEC_EDGAR_USER_AGENT` contains a declared organization-and-email contact in the shape published by the SEC, for example `Company Name AdminContact@example.com`. There is no fallback user agent. Syntax validation cannot prove that a configured identity is truthful; the deploy owner must supply an organization-owned contact and approve its use.

Requests are sequential across the process, rate-limited to **4 requests per second**, bounded to at most five candidate filings per ticker lookup, time out, and retry only one transient `429`/`5xx` response. Non-transient errors, malformed records, ticker mismatches, missing XML, missing required source fields, missing user-agent configuration, and denied SEC responses fail closed. The page shows no cached or model-generated insider facts in those cases.

The implementation follows the SEC’s published fair-access limit of no more than 10 requests per second and its declared-user-agent example. The SEC describes the unauthenticated submissions API, including the 10-digit CIK path, and identifies Forms 3, 4, and 5 as the ownership reports for officers, directors, and 10% holders.

- [SEC Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
- [SEC EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [SEC Forms 3, 4 and 5](https://www.sec.gov/answers/form345.htm)

## Required central integration

`server/routers.ts` is a protected central file and is intentionally unchanged in this worktree. The existing `insider.company` procedure therefore remains fail-closed until the integrator applies this exact reviewed wiring:

```ts
import { readOfficialEdgarInsiderFilings, type EdgarTickerReadResult } from "./insider/edgarIngestion";

company: protectedProcedure
  .input(z.object({ ticker: z.string().min(1).max(10) }))
  .query(async ({ input }): Promise<EdgarTickerReadResult> =>
    readOfficialEdgarInsiderFilings(input.ticker)),
```

`insider.radar` and `insider.tickerAlert` must stay unavailable. They represent synthetic aggregation and inferred signals that are not admitted by this source reader. The existing customer page is prepared to render the `EdgarTickerReadResult` union returned by the replacement `company` procedure, including its truthful unavailable statuses. Until the central wiring is reviewed and integrated, no customer request can reach an SEC fetcher.

## Source-test boundary

The focused tests use clearly synthetic XML and JSON fixtures to verify parser, URL, amendment, retry, rate, and unavailable-state semantics. They do not establish a live SEC acceptance, configured contact ownership, provider rights, database persistence, historical backfill, or production operation. No live filing request was made by this source implementation task because no approved truthful application contact was configured for it.
