# FAULTLINE Sector Rotation Map™ — methodology (`sector-rotation-v1.1.0`)

Display-only layer inside the Pentagonal Thesis™ five questions. It does **not** read into or change the
Pressure Index, regimes, thresholds, weights, engine output or the probability contract. It references the
canonical regime / Pressure Index / stateId it was read beside (read-only).

Code: `server/sectorRotation/calc.ts` (pure), `server/sectorRotation/service.ts` (paced fetch),
`server/sectorRotation/collector.ts` (post-close collector), `server/sectorRotation/snapshotStore.ts` (persisted snapshots),
`shared/sectorRotation.ts` (contract + fixed parameters), `client/src/components/sectorRotation/SectorRotationModule.tsx` (render only).

## Principles
- **Data first.** Deterministic server code computes every number. No LLM is wired in. Prose is templated from
  the computed object and validated (`findUntraceableNumbers`): a sentence quoting a number that the object does
  not contain is withheld (`null`).
- **Fail closed.** Missing, misaligned or stale data is labelled UNAVAILABLE / STALE with its as-of time. Nothing is
  interpolated, carried forward, defaulted or replaced with a demo value. An unavailable sector is not ranked.
- **No probabilities, no trade recommendations.** Q5 uses bounded classes only.
- **Parameters fixed a priori** (below). They were not tuned against historical outcomes; changing one requires a new `methodVersion`.

## Data sources
| Input | Source (existing adapter) | Endpoint |
|---|---|---|
| SPY, XLK XLF XLE XLV XLI XLY XLP XLU XLB XLRE XLC, SOXX, SMH, IWM, CL=F, DX-Y.NYB, ^VIX | Yahoo v8 chart via `yahooProxy.getDailyChart` (range 6mo, 10-min cache) | `https://query1.finance.yahoo.com/v8/finance/chart/{T}?interval=1d&range=6mo&includePrePost=false` |
| S&P 500 constituents (daily bars) | same, range 3mo | `.../v8/finance/chart/{T}?interval=1d&range=3mo&includePrePost=false` |
| S&P 500 universe + GICS sector | State Street Select Sector SPDR daily holdings (public, no key; 12 h cache) | `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{etf}.xlsx` (11 files) |
| 10Y, 2Y, HY OAS, 10Y breakeven, Fed balance sheet | FRED via `fredClient.fetchFredSeries` (existing `FRED_API_KEY`, 15-min cache) | `https://api.stlouisfed.org/fred/series/observations?series_id={DGS10,DGS2,BAMLH0A0HYM2,T10YIE,WALCL}` |
| Company news | Polygon (existing `POLYGON_API_KEY`), one bulk request per window, 10-min cache | `https://api.polygon.io/v2/reference/news?published_utc.gt=..&published_utc.lte=..&order=desc&sort=published_utc&limit=1000` |
| Regime, Pressure Index, stateId | `getAuthoritativeCanonicalIntelligenceState()` (read-only select) | — |

Growth expectations: no series exists in FAULTLINE's sources → always shown **Unavailable** (not substituted).

## Session rule
A daily bar's session = its ET date. A session is **completed** at 4:00 PM ET + 60 min (17:00 ET, DST-aware).
5D / 20D returns, RS, RRG, breadth, volume-vs-normal and driver changes use completed bars only.
"Today %" = in-progress bar vs last completed close, labelled **Intraday · as of <provider time>**; otherwise last
completed session vs the one before, labelled **Session close <date>**. A sector/stock whose basis differs from SPY's
is not shown/ranked on that basis.

## Relative rotation (RRG-style; conventional construction)
- `RS_t = close_sector / close_SPY` on SPY-aligned completed sessions (the asset must have a bar for every session in the
  tail used and for SPY's latest completed session; otherwise UNAVAILABLE).
- `RS-Ratio_t = 100 × RS_t / SMA(RS, 50)_t`
- `RS-Momentum_t = 100 × RS-Ratio_t / RS-Ratio_(t−10)`
- Minimum 61 aligned completed sessions (latest + prior reading).
- Quadrants (centre 100, ties on the ≥ side): LEADING (≥,≥), IMPROVING (<,≥), LOSING MOMENTUM (≥,<), LAGGING (<,<).
- Arrow (display only): RS-Momentum ≥ 100.5 ↑, ≤ 99.5 ↓, else →.
- Rank: RS-Ratio descending (ties by ticker). Prior rank: same set on the prior completed session. `rankChange = priorRank − rank`.
- Leadership groups (Q3): LEADING → current leadership; IMPROVING → emerging; LOSING MOMENTUM → deteriorating; LAGGING → confirmed weakness. `sessionsInQuadrant` counts consecutive completed sessions in the quadrant within the computable window.
- Breadth: share of a sector's constituents whose latest completed close is above their 50-session SMA; withheld below 90% constituent coverage.

## Q5 bounded classes (mechanical: quadrant + evidence)
| Class | Rule |
|---|---|
| OVERWEIGHT | LEADING AND 20-session return vs SPY > 0 AND breadth ≥ 50% (breadth must be available) |
| WATCH FOR CONFIRMATION | IMPROVING; or LEADING failing any OVERWEIGHT check |
| NEUTRAL | LOSING MOMENTUM AND 20-session return vs SPY > 0 |
| UNDERWEIGHT | LOSING MOMENTUM with 20-session return vs SPY ≤ 0; or LAGGING without every AVOID condition |
| AVOID | LAGGING AND 20-session return vs SPY < 0 AND breadth < 50% AND arrow ↓ |
Each card lists its four evidence checks (✓ / ✗ / – unavailable).

## Q2 drivers (observed co-movement, not causation)
20-observation change (FRED: bp; Yahoo: % or VIX points; WALCL: 4 weeks). Direction dead-bands (display, fixed): yields/spreads/breakeven ±5 bp,
DXY / oil ±1%, VIX ±1 pt, WALCL ±0.5%, relative-return drivers ±1 pp. SOXX / defensives (mean of XLU, XLP, XLV) / IWM drivers =
20-session return minus SPY's. Conventional sector↔driver links (`SECTOR_DRIVER_LINKS`, sign only, no coefficients) are labelled
CONSISTENT / DIVERGING / NO CLEAR DIRECTION / UNAVAILABLE from the measured directions.

## Q4 watch indicators
XLF/SPY, XLK/SPY, SOXX+SMH/SPY, XLU+XLV, IWM/SPY: CONFIRMING when RS-Momentum ≥ 100 (both, for pairs). XLE vs WTI: CONFIRMING when the
20-session directions agree and WTI is outside its ±1% band. HY OAS: CONFIRMING unless widening ≥ 5 bp. 10Y: CONFIRMING when its direction
matches the rate link of a LEADING sector. Only the quadrant line (100) and the stated bands are used as thresholds.

## Top 5 Winners / Losers
- Universe: union of the 11 Select Sector SPDR holdings (equity rows with a SEDOL; `BRK.B` → `BRK-B`). 504 tickers on 2026-10-01.
- Ranking: today % on SPY's session basis; ties by ticker; winners must be > 0, losers < 0. Panel **UNAVAILABLE** if the universe
  cannot be fetched or fewer than 95% of constituents are on the basis; otherwise unranked tickers are counted and listed.
- 5D: completed sessions. Volume vs normal: latest completed volume / mean of the prior 20 completed sessions; **unavailable** during an
  in-progress session or with any missing volume.
- Corporate-action guard: a single completed-session move ≥ 50% inside a window withholds the metric spanning it (5D, breadth);
  a stock whose today % is ≥ 50% in magnitude is not ranked (listed as unavailable). FAULTLINE never "adjusts" prices.
- Catalyst rule (first match wins; news window = (prior session's 4 PM ET close, end of the measured move]):
  1. **EVENT-DRIVEN** — a *qualifying* item (below) whose title matches a family (earnings/results, guidance, M&A, regulatory, analyst action; priority in that order; specific phrases only).
  2. **COMPANY-SPECIFIC** — a qualifying item AND the sector ETF does not explain the move.
  3. **SECTOR-DRIVEN** — sector ETF moved the same way by ≥ 50% of the stock's move AND SPY does not explain the sector's move.
  4. **MACRO-DRIVEN** — SPY moved the same way by ≥ 50% of the stock's move.
  5. Otherwise exactly **CATALYST UNCLEAR** (always when no item qualifies and no co-move qualifies).
  For 1–2 the "Why" is the qualifying headline verbatim with publisher and time; no LLM summary. 3–4 are price classifications
  and **never carry a headline**.
- **Qualifying news item (v1.1.0, `qualifyNewsItem`, all must hold; otherwise the item is ignored):**
  1. published inside the move's window (parseable timestamp);
  2. publisher on the controlled list `APPROVED_NEWS_PUBLISHERS` (Benzinga, GlobeNewswire, PR Newswire, Business Wire, ACCESSWIRE,
     Reuters, MarketWatch, CNBC, Investing.com, Barron's, The Wall Street Journal, Bloomberg); missing publisher → rejected;
  3. tagged with the mover and with ≤ 3 tickers in total (`maxNewsTickerTags`);
  4. not a movers roundup / market wrap (`ROUNDUP_PATTERN`), even if it names the stock;
  5. the **title explicitly names the mover**: `$TICKER`, `(TICKER)`, `(NYSE: TICKER)`, an unambiguous bare ticker (≥ 3 letters, not on
     the common-word list, not in an all-caps title), or a controlled alias. Aliases are deterministic: the SSGA holdings name with legal
     suffixes removed (e.g. `LOWE S COS INC` → "lowe"), its first word when ≥ 5 letters, not a stopword and unique in the universe, plus
     the fixed `EXPLICIT_COMPANY_ALIASES` table. Ordinary words, first names and places (`ALIAS_STOPWORDS`, e.g. "state", "wells",
     "advanced", "delta") are never single-word aliases: those issuers are named only by full name or ticker. Exchange qualifiers such as
     "(NASDAQ: TER)" are notation, not a mention of the exchange operator. An alias shared by two issuers is ambiguous → rejected;
  6. the title names **no other** S&P 500 issuer (one company's earnings never explain a peer; sector/market stories never explain a stock
     they do not name). There is no inference from sector similarity or neighbouring companies.
- Q3: a winner in a LEADING/IMPROVING sector or a loser in a LAGGING/LOSING MOMENTUM sector REINFORCES; the opposite CONTRADICTS.
- Q4 early indicator: CONTRADICTS AND (SECTOR-DRIVEN or CATALYST UNCLEAR) AND volume ≥ 1.5× normal.

## WHY IT MATTERS (deterministic, ≤ 2 sentences)
Tilt = defensive if ≥ 2 of XLU/XLP/XLV are LEADING/IMPROVING, cyclical/growth if ≥ 2 are LAGGING/LOSING MOMENTUM, else mixed.
"Consistent with" the regime when (ELEVATED RISK / HIGH STRESS / SYSTEMIC CRISIS and defensive) or (LOW / MODERATE RISK and not defensive);
"at odds with" otherwise; omitted when mixed or the regime is unavailable. Second sentence: strongest and weakest stock with catalyst class and Q3 alignment.

## Refresh architecture (v1.1.0): post-close collector → persisted snapshot → read-only UI
- `sectorRotation.current` (used by NOW / WHY / OUTLOOK / WATCH / ACT, sent as its own non-batched request) **only reads the latest
  saved snapshot**. A page load never fetches market data and never triggers a build.
- The collector (`SectorRotationCollector`, started at server boot) builds **once per completed session**: after 17:00 ET (4 PM + 60 min)
  on a weekday, if no snapshot exists for that session for the current `methodVersion`. Checks run every 10 min (first 90 s after boot);
  holiday sessions are detected from SPY's latest completed bar and never rebuilt.
- Fan-out discipline: 2 concurrent requests with 250 ms spacing, one 10-minute overall budget, an HTTP 429 from any provider aborts the
  fan-out immediately and opens a 60-minute circuit; failed attempts back off 30 → 60 → 120 min, max 3 attempts per session, then stop
  until the next session. No builds 13:45–14:45 ET (the scheduled outcome-collection window that also uses Yahoo).
- A build is saved only when valid (benchmark available, movers panel not UNAVAILABLE, not aborted). On failure the last valid snapshot
  is served as **STALE** with the reason and next attempt time; with no snapshot the module shows **UNAVAILABLE**. Nothing is recomputed
  from traffic.
- Snapshot content: timestamp, completed session date, methodology version, canonical stateId, rankings/quadrants, breadth, winners/losers,
  catalyst class + source + time, status and missing-data flags (the full `SectorRotationReading`), with a sha256 integrity hash.
- Storage: see `STORAGE_PROPOSAL.md` (existing `marketMemory` table, insert-only, no migration).
