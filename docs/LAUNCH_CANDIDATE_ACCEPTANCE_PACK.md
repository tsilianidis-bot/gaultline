# FAULTLINE launch-candidate acceptance pack

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Verify tip:** `761f73fdc2ba5d2fbecfe6668fb8e9d04c681dbb`  
**PR:** https://github.com/tsilianidis-bot/gaultline/pull/1  
**Base (do not merge to main):** `grok/faultline-completion-2026-09-08`  
**Rollback `main`:** `870d1f82` (untouched)

This pack is **stabilization evidence only**. No production deploy, no domain/maintenance flip, no live Stripe, no Contract v3, no new engines/dashboards, no offer change.

## Labels

| Label | Meaning |
| --- | --- |
| **BLOCKER** | Must be resolved by **owner/ops** (or a later authorized code change) before calling the candidate production-ready. Not silently “fixed” here. |
| **IMPORTANT** | Affects correctness, restore, or checkout; do not ignore. No silent commercial or schema rewrite on this RC. |
| **CLEANUP** | Documented drift / hygiene; not launch-blocking by itself. |

---

## STEP 1 — Verify (this agent, 2026-09-13)

| Gate | Result |
| --- | --- |
| HEAD == remote tip | `761f73fdc2ba5d2fbecfe6668fb8e9d04c681dbb` |
| `pnpm install --frozen-lockfile` | pass |
| `pnpm run check` | pass (0 errors) |
| `pnpm run build` | pass |
| `pnpm test` | **1913 passed, 44 skipped, 0 failed** (1957) |
| `scripts/ci-startup-smoke.sh` | pass (listen without Stripe secret) |
| `scripts/ci-write-build-identity.sh` | pass — artifact commit = HEAD, branch = this RC |
| GitHub Actions on #1 at this SHA | `typecheck-build-test-smoke` **success**; `Manus deploy` **skipped** |
| Code patches required to go green | **None** |

Identity artifact (local): `dist/build-identity.json` commit `761f73fdc2ba5d2fbecfe6668fb8e9d04c681dbb`.

---

## STEP 4 — Canonical truth / remaining independent calculations

**Evidence:** `docs/RC_INDEPENDENT_CALC_CONSUMERS.md`, `docs/RC_REMAINING_INDEPENDENT_CALCS.md`, `PHASE_2I_CONSUMER_INVENTORY.json`, `server/independentCalcConsumers.test.ts`.

Rule used: **do not exclude** until proven it cannot affect CURRENT.

| Producer | CURRENT reach | Acceptance |
| --- | --- | --- |
| Admin `getCurrentPressure` | No | Excluded (prior proof) |
| Ticker `tradingSignals` as Pressure authority | No | Excluded as market-truth authority |
| `marketIntelligence` header/MCC | Yes (parallel) | **Included** |
| `marketStateCache` stale-if-error | Yes (transport) | **Included** |
| Live `calculateFaultlinePressure()` via Seismograph | **Yes — Champion writer** | **Included** (different from Admin procedure) |
| FMOS pipeline / Hub `runPipelineFast` | Yes (evidence + CURRENT page) | **Included** — must not author Pressure |
| Day-trade / aftershock / outlook / tradePreflight / diagnostic crash-bull / preFlight / crypto overlay / reading snapshot | Yes on CURRENT-classified surfaces | **Included** |
| Owner/sim / Shadow V3-H | No as Champion | Excluded as CURRENT authority |

**IMPORTANT:** Seismograph **is** the CURRENT persist path. If the job has never fired, CURRENT is stale-if-error or UNAVAILABLE — that is correct fail-closed, not a reason to treat Admin live Pressure as homepage truth.

**CLEANUP:** IntelligenceHub still runs a live FMOS fast path on a CURRENT_CANONICAL page (parallel leak class).

---

## STEP 5 — Intelligence Contract v2 (scope only)

**Evidence:** `docs/FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE.md`, `server/intelligenceContractV2Scope.test.ts`.

Stages preserved **in order**, architecture/comments only:

1. REALITY  
2. CAUSATION  
3. CONSEQUENCE  
4. VERIFICATION  
5. ACTION  

Mandatory fields (when a stage record exists): confidence+basis, assumptions, supporting evidence, What Would Change My Mind?, confirmation/invalidation triggers (omit if unknown — do not invent). Storage pointers: Decision Ledger + Intelligence Validation Center. Tests fail if those modules invent `v2StageConfidence` or `INVENTED_V2_TRIGGER`.

**CLEANUP / policy:** v2 remains **not implemented**. No engine, no scores, no triggers added on this RC.

---

## STEP 6 — Provider matrix A–E

**Evidence:** `docs/RC_PROVIDER_MATRIX.md`, `docs/RC_SKIPPED_TESTS_AUDIT.md`.

**WORKING = A+B+C.** Mocks never count as C.

| Provider | A | B | C this RC | E CURRENT | Verdict |
| --- | --- | --- | --- | --- | --- |
| FRED | yes | pressure / seismograph | no | required | **IMPORTANT** — coded, not live-proven |
| Yahoo | n/a (public) | quotes / screeners | no | ticker chrome | **IMPORTANT** — not live-proven |
| Polygon | yes | signals / bars | no (2 skips) | ticker | **IMPORTANT** |
| CoinGecko | `CG-` | crypto | no | optional overlay | **IMPORTANT** |
| Manus Forge / LLM | https + key | `llm.ts`, heartbeat | no | briefs/Oracle, not Pressure | **BLOCKER** for auth/heartbeat fire (owner) |
| Stripe | `sk_test_` + live `price_` IDs | billing | no live | gates only | **IMPORTANT** — not WORKING; do not enable live |
| SendGrid | `SG.` (two unequal slots) | email | live historically **401** | no | **BLOCKER** (owner key) |
| GSC | Google client shape | SEO OAuth | no | no | CLEANUP / owner |
| X | four opaque slots | poster | no | no | owner cron |
| Sentry | **absent** | optional DSN | n/a | no | CLEANUP |
| Analytics | URL + UUID; first-party routes | beacons | 3p not proven | no | CLEANUP |

---

## STEP 7 — Billing reconcile (no offer change)

**Evidence:** `docs/RC_STRIPE_SANDBOX_RECONCILE.md`, `shared/tiers.ts`.

Approved public offer **unchanged**: Trader **$59**, Power **$99**, Founding **$49**, Lifetime **$299** unavailable.

| Discrepancy | Label |
| --- | --- |
| Live-test lock Core **$9.99** vs UI Trader **$59** | **IMPORTANT** |
| Live-test lock Premium **$59** vs UI Power **$99** | **IMPORTANT** |
| Platform secrets: `sk_test_` + those **same live price IDs** | **IMPORTANT** — checkout `verifyStripePlanConfiguration` will fail |
| Product name must match `FAULTLINE Trader` / `Power` / `Founding Member` | **IMPORTANT** |
| Annuals $0 / unavailable | CLEANUP (keep unsold) |
| Entitlement tests use synthetic `price_core_monthly` | CLEANUP (mocked, not catalog) |

No `shared/tiers.ts` edit. No live mode.

---

## STEP 8 — Cron / heartbeat

**Evidence:** `docs/RC_CRON_HEARTBEAT_REGISTRY.md`.

| Finding | Label |
| --- | --- |
| Empty `CRON_SECRET` **fail-opens** `requireCron` | **IMPORTANT** (host must set secret) |
| No `CRON_SECRET` / `HEARTBEAT_SECRET` in platform secrets file | **IMPORTANT** |
| No in-repo Forge job export / `lastExecutedAt` | **BLOCKER** (owner: RV-7 heartbeat fire) |
| Seismograph is the Champion writer | **IMPORTANT** — do not retarget prod jobs to preview |
| Comment path `/weeklyImprovementReport` vs mount `/weekly-improvement-report` | CLEANUP |
| Dual auth: some routes also need `isCron` | CLEANUP (document for operators) |

Preview pin (no prod domain): `docs/RC_PREVIEW_PIN.md`.

---

## STEP 9 — Drizzle migration chain

**Evidence:** `docs/RC_DRIZZLE_MIGRATION_CHAIN.md`.

| Finding | Label |
| --- | --- |
| Journal idx 0–70 unique (`0000`…`0070`) | CLEANUP / healthy |
| Orphan repair SQL reusing **0056–0059** (not in journal) | **IMPORTANT** restore footgun |
| schema vs applied prod unknown (no DB here) | **IMPORTANT** — owner diff |
| Destructive migrate / journal rewrite | **Not done** |

Safe restore: `drizzle-kit migrate` **journal only**; never glob `0056_*.sql`.

---

## STEP 10 — `.project-config.json` (no values)

**Evidence:** `docs/RC_PROJECT_CONFIG_SHAPES.md`.

| Finding | Label |
| --- | --- |
| Slots look like genuine credential **shapes** (prefixes/lengths), not empty placeholders | **IMPORTANT** |
| File is `.gitignore`’d; **forward tracking removed** (`git rm --cached`); history still has prior commits | **IMPORTANT** (history rewrite + rotation remain owner/James) |
| `git_remote` access key + 1040-char session token shape | **BLOCKER** (owner rotate if still valid) |
| Two different `SG.` keys | **IMPORTANT** |
| Test Stripe secret + live price IDs | **IMPORTANT** (same as Step 7) |
| `QA_ACCESS_SECRET` length 9 | CLEANUP |
| App consumes via **injected `process.env`**, not `import` of the JSON | CLEANUP |
| **Rotation** | **Not performed.** Needs **owner authorization.** |

---

## Preview vs production

| Action | This RC |
| --- | --- |
| Merge to `main` | **No** |
| Publish getfaultline.live | **No** |
| Maintenance flip | **No** |
| Manus production deploy | **No** (workflow refuses) |
| Preview pin instructions | `docs/RC_PREVIEW_PIN.md` only |

---

## Constraint checklist

- [x] No merge to main  
- [x] No production deploy / domain / maintenance flip  
- [x] No live Stripe  
- [x] No redesign / new dashboards / new engines / Contract v3 / pricing strategy  
- [x] Tests not weakened; 44 skips still classified, not deleted  
- [x] Secret values not printed  

---

## Owner remaining (external)

1. Rotate or untrack leaked platform secrets (**owner auth**).  
2. SendGrid replacement + live 200.  
3. Forge OAuth + Heartbeat jobs registered and fired (Seismograph first).  
4. Set non-empty `CRON_SECRET` on every host.  
5. Sandbox Stripe prices matching `shared/tiers.ts` if checkout is re-verified.  
6. Authenticated browser QA (public HTML still maintenance-gated).  
7. Preview pin + `/api/build-info` equals tip — never production domain.

## Related docs (this continuation)

- `docs/RC_REMAINING_INDEPENDENT_CALCS.md`  
- `docs/RC_PROVIDER_MATRIX.md`  
- `docs/RC_CRON_HEARTBEAT_REGISTRY.md`  
- `docs/RC_DRIZZLE_MIGRATION_CHAIN.md`  
- `docs/RC_PROJECT_CONFIG_SHAPES.md`  
- `docs/RC_PREVIEW_PIN.md`  
- Prior RC notes: skipped tests, Stripe reconcile, preview identity, independent calcs (first four), Contract v2 scope  
