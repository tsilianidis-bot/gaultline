# Additional feature qualification — Daily Intelligence Brief

**Scope/identity.** This review selects exactly one additional, non-overlapping intelligence feature: **Daily Intelligence Brief — snapshot-bound public archive**. Reviewed read-only at **2026-10-19** on `marketing/premium-homepage-20261019` / `49d6ab7dbf97dcca272e96339217acf9e8ca022d` (PR #109). PR-head records list #106/#107/#108 at `1d60575`, `c685686`, and `5ee4a06` respectively (`/home/ubuntu/marketing-completion/current-pr-heads.json:12-31`); `git show` limited to Daily Brief paths returned no direct deltas. No server, browser, tests, DB/API, secret, production, login, checkout, or source mutation was used.

## Decision: **blocked**

The feature has a credible **public, read-only delivery contract**, but there is **no local genuine Daily Brief observation, bound snapshot, published slug, or sanctioned product capture** to qualify. The repository search found no tracked Daily Brief content/capture payload; only code, migrations/docs, and tests. The archive itself explicitly renders “No briefs published yet” when the public query has no rows (`client/src/pages/DailyBriefArchive.tsx:60-64, 184-190`). This is not evidence that a production database is empty; it is the only permissible local conclusion without a DB call.

The general marketing record independently bars promotion: all gallery items remain placeholders with zero eligible captures (`docs/marketing/SCREENSHOT_EVIDENCE.md:3, 9-11`; `docs/marketing/VERIFICATION.md:52-56, 70-73, 82`). The five preview PNGs are layout-only and cannot substitute (`docs/marketing/SCREENSHOT_EVIDENCE.md:3-5`).

## Why this is the strongest additional candidate

- It has explicit **standalone public routes**, no product shell: `/daily-brief` and `/daily-brief/:slug` (`client/src/App.tsx:334-347`), unlike the authenticated core workspace destinations (`shared/routeRegistry.ts:20-30`).
- Its public read procedure selects only `organicContent.status = "published"`, filters `daily_market_brief`, and returns no data if the DB is unavailable (`server/routers/organicContent.ts:11-50`). A public detail read again requires `published` (`server/routers/organicContent.ts:52-69`).
- A current snapshot-bound article exposes saved-generation time and never substitutes a later live reading; a legacy item without a snapshot is explicitly marked as archived metadata and must **not** qualify (`client/src/pages/DailyBriefPost.tsx:89-93, 194-210`).
- The snapshot contract records generated/trading time, canonical origin, input provenance/as-of/freshness, and validation (`server/dailyBriefSnapshot.ts:12-60, 72-96`). This supports a real-observation review rather than a render claim.

## Exact blockers and exact nonproduction resource

1. **Missing actual observation:** no nonproduction `organicContent` row of `contentType="daily_market_brief"`, `status="published"`, and no linked `dailyBriefSnapshots` row is locally persisted. A static route and source code do not prove an operational brief.
2. **Required resource:** an isolated **nonproduction database** containing one genuinely generated, published Daily Brief and its immutable linked `dailyBriefSnapshots` record, derived from a real nonproduction canonical/seismograph (or pressure-engine) run. It must carry a valid `snapshotId`, `generatedAt`, `tradingDate`, input-provenance/as-of/freshness data, and `validation.passed=true`; canonical origin must be `linked`. Do not seed, fabricate, replay a fixture, use production data/services, or use legacy brief rows.
3. **Publication evidence:** the authorized nonproduction runtime must return that row through the existing public `organicContent.listPublished` and `getBySlug` procedures. A row with missing `briefSnapshot`, stale/failed validation, unavailable origin, or unpublished status is ineligible.
4. **Tests are non-qualifying:** the Sector Rotation test suite is explicitly synthetic/mocked (`server/sectorRotation.snapshot.test.ts:1-7, 12-26, 66-110`); no fixture/synthetic unit test is operational evidence for this selected feature either.

## Conditional safe capture path (parent runtime/browser only)

**Authorized public routes (conditional, not presently qualified):**

1. `/daily-brief` — verify a single real `daily_market_brief` appears in the published archive.
2. `/daily-brief/<published-slug>` — capture the actual snapshot-bound detail page. This is the required evidence surface; it must show the saved-generation context, not an unbound legacy article.

For **each desktop and mobile capture**:

1. Use the isolated nonproduction deployment at the reviewed branch/SHA; do not log in or invoke generation/admin/CTA/checkout controls. Navigate only through the two public GET routes above.
2. Before capture, have the authorized operator record the persisted row and linked snapshot: `status=published`, matching slug, snapshot ID, snapshot `generatedAt`/`tradingDate`, canonical origin `linked`, source-input provenance and freshness, and `validation.passed=true`. Confirm the UI preserves snapshot time and flags stale state as implemented (`server/routers/organicContent.ts:69-106`; `client/src/pages/DailyBriefPost.tsx:194-205`).
3. Record **source branch** `marketing/premium-homepage-20261019`, **source SHA** `49d6ab7dbf97dcca272e96339217acf9e8ca022d`, actual ISO **capture date/time**, and **observationAt** = immutable `briefSnapshot.generatedAt` (with `tradingDate` retained). Classify it **recent** only if the documented freshness review supports that at capture; otherwise **historical**. An archive snapshot must not be labelled live; do not infer timing from page render time.
4. Perform a privacy/publication review of the exact article and visible metadata: public-safe only; no user preferences/watchlists, personal information, credentials/tokens, private links, hidden/admin IDs, or unsupported/uncalibrated claim. Treat `briefSnapshot` absence, `STALE SNAPSHOT`, failed validation, or canonical-origin unavailable as a stop condition.
5. Capture the same qualified public detail page at desktop and mobile viewports, preserve original rasters and the verification report, then (and only then) place sanitized copies under same-origin `/marketing/…` paths and complete every fail-closed manifest field: verified status, operational/source verification, capture path/time, branch/SHA, `public-sanitized`, observation class/time, completed sensitive-information review, and `containsSensitiveInformation=false` (`client/src/components/marketing/showcaseEvidence.ts:15-37, 149-205`).

Until all steps complete, **do not add a screenshot or feature claim**; no eligible capture exists today.

## Parent scope clarification

This was a source-only review with no session supplied, not a claim that the user prohibited all login. An explicitly authorized nonproduction test session may later qualify member-only captures without changing authentication or customer access. No such resource is available in this checkout. Public links above are documentation/preview destinations, not proof that data is currently operational. The source review is pinned to the original candidate SHA; subsequent changes are marketing/bootstrap only and do not activate these capabilities.
