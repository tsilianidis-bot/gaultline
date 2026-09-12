# Test environment gating

Default `pnpm test` / `npm test` (Vitest) must stay green in CI and local sandboxes that do not inject live vendor secrets.

## Rule

Suites that *require* a live credential or live vendor object must use Vitest `describe.skipIf` / `it.skipIf` instead of failing the default run.

Do not use silent early `return` inside an `it()` to hide a missing secret. Skip the case so the report shows `skipped`, not a false pass or a fail.

## Gated suites

| Suite | Gate | Why |
| --- | --- | --- |
| `server/stripe.prices.test.ts` | `describe.skipIf` unless all four `STRIPE_*_PRICE_ID` values start with `price_`; live retrieve cases use `it.skipIf` unless `STRIPE_SECRET_KEY` is a live key | Price IDs and Stripe API retrieval |
| `server/stripe.live-prices.test.ts` | `describe.skipIf` unless all four live price IDs are present | Exact live-mode price ID lock |
| `server/sendgrid.key.test.ts` | `describe.skipIf` unless `SENDGRID_API_KEY` is set | SendGrid credential shape |
| `server/polygon.key.test.ts` | `describe.skipIf` unless `POLYGON_API_KEY` is set | Polygon credential + live prev-bar call |
| `server/coingecko.key.test.ts` | `describe.skipIf` unless `COINGECKO_API_KEY` is set; `/ping` still uses `it.skipIf(!RUN_INTEGRATION_TESTS)` | CoinGecko credential + optional live ping |
| `server/gsc.credentials.test.ts` | `describe.skipIf` unless both Google OAuth client values are set | Search Console OAuth client construction |
| `server/qaAccess.test.ts` | `it.skipIf` unless `QA_ACCESS_SECRET` is set | Owner QA cookie issuance against the live secret |

## ASHA unavailable copy

ASHA is an interpretation layer. User-visible unavailable copy must say **interpretation**, not a generic “analysis” / “intelligence” substitute:

- `AshaIntelligenceBrief` catch path: `Interpretation temporarily unavailable. Please refresh.`
- Crypto source-health limitation: `Crypto interpretation is supplemented...`
- Daily greeting fail-safe: `Canonical state unavailable. Insufficient evidence for a current market interpretation.`

## Local re-enable

Export the relevant secrets (and `RUN_INTEGRATION_TESTS=1` for CoinGecko `/ping`) before running the focused file:

```bash
pnpm test server/stripe.prices.test.ts
```
