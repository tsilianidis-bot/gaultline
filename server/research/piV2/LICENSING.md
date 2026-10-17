# Licensing and paid-data requirements

No licenses were purchased for this research branch. The frozen spec uses public FRED series only. Components below are required before a later spec can claim coverage they do not have today.

## Free public series already in FL-PI-v2-research-0

| Input | Series | Terms |
| --- | --- | --- |
| Credit, investment-grade proxy | FRED `BAA10Y` | Public FRED |
| Funding history | FRED `TEDRATE` through 2022-01-21 | Public FRED. No live successor is approved. |
| Volatility | FRED `VIXCLS` | Public FRED redistribution of the CBOE close |
| Equity level | FRED `SP500` | Public FRED. Yahoo is a reference history label only. |
| Unemployment | FRED / ALFRED `UNRATE` | Public. Real-time history needs ALFRED vintages, not one revised download. |
| Recession target dates | NBER business-cycle peaks | Public chronology. The embedded list stops at the February 2020 peak. |

FRED itself needs the existing `FRED_API_KEY` for live capture. That key is not a market-data license and is not committed here.

## Free but windowed — not in the composite

| Input | What FRED actually provides | What is still required |
| --- | --- | --- |
| ICE BofA US High Yield OAS | FRED `BAMLH0A0HYM2`, probed window begins **2023-10-16** | A license for the full ICE BofA history if a later spec wants high-yield OAS before that date. This spec labels the window and keeps the series out of the score. |

## Paid or vendor series — not fetched, not scored

| Component | Why it is not in this spec |
| --- | --- |
| Full ICE BofA high-yield OAS history | The long sample is a licensed research archive. The FRED window is not that archive. |
| Full ICE BofA investment-grade OAS history | Same licensing boundary if a later spec wants the full OAS curve rather than `BAA10Y`. |
| CDS / CDX | Vendor history. Not a public FRED series with a usable research archive here. |
| FRA-OIS | Licensed. Not a substitute for TED under this spec. |
| Tick-level breadth or dealer financial-conditions indexes | Vendor panels. Out of scope. |
| Conference Board LEI | Paid macro series. Not used. |

## Public candidate that still needs its own approval

CP minus T-bill (`DCPF3M` minus `DTB3`) is public FRED data and is **not** approved for `FL-PI-v2-research-0`. The calculation notes live in `eval/CP_TBILL_CANDIDATE.md`. Using it as the funding pillar requires a new spec id.

## Not available from this environment

The OFR Financial Stress Index CSV was reported as blocked (HTTP 403 / HTML) on 2026-10-14. It is not downloaded here and is not a pillar.

## What this does not authorize

Buying any of the paid series, calling a paid vendor, or treating a licensed window as a complete history. Those choices stay with the founder.
