# Phase 1B Historical Source Research Log

## Reference Date

2026-08-19. This log records source-discovery findings only. It does not authorize a replacement series, historical score build, model change, or public claim.

## Primary Findings Recorded

| Input | Primary-source finding | Immediate consequence |
|---|---|---|
| `BAMLH0A0HYM2` | FRED confirms that the exact ICE BofA US High Yield Index Option-Adjusted Spread is daily, close, percent, and that from April 2026 it retains only three years of observations. Its notes direct users needing more data to the ICE source and state copyright/reproduction restrictions. | Public FRED cannot extend the exact series before 2023-08-21. Any extension must be separately licensed or must use a documented archival source only after legal/methodological review. |
| Exact ICE source | ICE states that its Index Platform offers current and historical index and security-level data and that its history datasets are available through commercial access routes. | ICE is an authoritative route for exact-series history, but the currently accessible public page does not grant the data needed for a reproducible open research build. |
| `SOFR` | The New York Fed defines SOFR as an overnight Treasury-collateralized repo financing measure and describes its underlying transaction sources. It publishes the rate on the following business day. | Pre-SOFR values cannot be silently treated as SOFR. Any predecessor requires a separately versioned reconstructed policy and economic equivalence review. |

## Source URLs

1. https://fred.stlouisfed.org/series/BAMLH0A0HYM2
2. https://www.ice.com/fixed-income-data-services/index-solutions
3. https://www.newyorkfed.org/markets/reference-rates/sofr
4. https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates

## Additional Verified Evidence

| Candidate | Verified evidence | Proposed eligibility boundary |
|---|---|---|
| **Historical Overnight Treasury GC Repo Primary Dealer Survey Rate** | The New York Fed released an Excel series covering 1998-02-20 through 2018-02-28. Its 2018 operating-policy statement says the series is a volume-weighted mean of primary-dealer overnight Treasury general-collateral repo borrowing, while SOFR is a broader volume-weighted median. The Federal Reserve Board subsequently concluded that this official survey rate is a reasonable historical proxy for SOFR for risk modeling, while retaining the methodological distinctions. | Eligible only for a **separately versioned reconstructed** dataset, labeled `OFFICIAL_PROXY_RECONSTRUCTED`. It cannot enter a point-in-time dataset as SOFR. March 2018 has no direct published overlap and remains an explicit gap unless later official evidence resolves it. |
| **Internet Archive capture of exact FRED BAML series** | CDX records an HTTP 200 FRED CSV capture at 2025-11-04. The decoded file covers 1996-12-31 through 2025-11-03. In the 578-observation overlap with the currently retained FRED file (2023-08-21 onward), no values differ. | Candidate for `ARCHIVED_OFFICIAL_REVISED` use in a separate reconstructed dataset, subject to the same ICE/FRED copyright and internal-use restrictions recorded on the source page. It cannot be treated as point-in-time or released as a public data export. |

## Evidence Artifacts Retained Outside the Web Project

| Artifact | Coverage / checksum |
|---|---|
| `HistoricalOvernightTreasGCRepoPriDealerSurvRate.xlsx` | 1998-02-20 through 2018-02-28; downloaded from the New York Fed’s official link. |
| `bamlh0a0hym2_fred_archive_20251104.decoded.csv` | 1996-12-31 through 2025-11-03; Internet Archive capture of FRED CSV; SHA-256 of original compressed capture: `0fb5e6c945abb4a9913eb1e75946fd7fa5d88bad33e1be2025545119177cf8a4`. |

## Additional Source URLs

5. https://www.federalreserve.gov/econres/notes/feds-notes/historical-proxies-for-the-secured-overnight-financing-rate-20190715.html
6. https://www.newyorkfed.org/markets/opolicy/operating_policy_180309
7. https://web.archive.org/cdx/search/cdx?url=fred.stlouisfed.org%2Fgraph%2Ffredgraph.csv%3Fid%3DBAMLH0A0HYM2&output=json&filter=statuscode:200&collapse=digest&fl=timestamp,original,statuscode,mimetype,digest,length
