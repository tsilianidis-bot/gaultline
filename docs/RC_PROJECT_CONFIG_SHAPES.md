# RC `.project-config.json` shapes (no secret values)

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Hard rule:** this file prints **keys, types, lengths, prefix classes** only. It does **not** print secret values. **Do not rotate** any credential without explicit **owner authorization**.

## Is the file real credentials, or placeholders?

Inspected via shape classifier (values never echoed).

| Slot | Shape class | Genuine-looking? |
| --- | --- | --- |
| `env_vars.DATABASE_URL` | mysql URL, len 160, user@host form | Yes — live connection-string **shape** |
| `env_vars.DRIZZLE_DATABASE_URL` | same len; **equal** to `DATABASE_URL` | Yes (duplicate slot) |
| `env_vars.MANUS_WEBDEV_PROJECT_ID` | opaque 22 | Platform id shape |
| `secrets.FRED_API_KEY` | 32-char opaque | Yes |
| `secrets.POLYGON_API_KEY` | 32-char opaque | Yes |
| `secrets.COINGECKO_API_KEY` | `CG-` + 27 | Yes (Demo-style) |
| `secrets.SENDGRID_API_KEY` | `SG.` + 69 | Yes |
| `secrets.Sendgrid` | `SG.` + 69, **≠** `SENDGRID_API_KEY` | Yes — **second different key** |
| `secrets.STRIPE_SECRET_KEY` | `sk_test_` + 107 | Yes — **test mode** |
| `secrets.VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_` + 107 | Yes — **test mode** |
| `secrets.STRIPE_*_PRICE_ID` (four) | `price_` + 30 | Yes — and they **equal the locked live-mode IDs** in `stripe.live-prices.test.ts` |
| `secrets.STRIPE_WEBHOOK_SECRET` | `whsec_` + 38 | Yes |
| `secrets.GOOGLE_CLIENT_ID` | `*.apps.googleusercontent.com` len 72 | Yes |
| `secrets.GOOGLE_CLIENT_SECRET` | opaque 35 | Yes |
| `secrets.JWT_SECRET` | opaque 22 | Yes |
| `secrets.QA_ACCESS_SECRET` | len **9** | Weak / possibly a passphrase, not a high-entropy secret |
| `secrets.BUILT_IN_FORGE_API_KEY` / `VITE_FRONTEND_FORGE_API_KEY` | opaque 22 | Yes |
| `secrets.BUILT_IN_FORGE_API_URL` / `VITE_FRONTEND_FORGE_API_URL` / `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL` | `https://` short hosts | Yes |
| `secrets.X_*` (four) | opaque 25–50 | Yes |
| `secrets.VITE_ANALYTICS_ENDPOINT` | `https://` 27 | Yes |
| `secrets.VITE_ANALYTICS_WEBSITE_ID` | UUID 36 | Yes |
| `git_remote.access_key_id` | 20-char access-key shape | Yes — **looks like cloud access key** |
| `git_remote.secret_access_key` | 40-char | Yes |
| `git_remote.session_token` | 1040-char session token | Yes — **temporary STS-like token** |
| `git_remote.expiration` | 24-char timestamp | Present (not printed) |

**Absent (no slot):** `SENTRY_DSN`, `CRON_SECRET`, `HEARTBEAT_SECRET`, any Yahoo key, `STRIPE_CORE_ANNUAL_PRICE_ID`, `STRIPE_PREMIUM_ANNUAL_PRICE_ID`.

Non-secret top-level: `build_command`, `dev_command`, `test_command`, `capabilities[3]`, `experiments[1]`, `name`, `path`, `port`, `template_id`.

## Where consumed

| Consumer | How |
| --- | --- |
| **Manus / webdev platform** | Injects `env_vars` + `secrets` into the host process. App code does **not** `import` this JSON. |
| **App runtime** | `import "dotenv/config"` + `process.env.*` (`server/_core/env.ts`, stripe, fred, llm, email, X, GSC, QA). |
| **Backup / restore docs** | `scripts/generateBackupDocs.mjs` **excludes** this filename; `FAULTLINE_BACKUP_VERIFICATION.md` says the zip omits it. |
| **Git** | Listed in `.gitignore` and **untracked going forward** (`git rm --cached`). App runtime is unchanged. History is **not** rewritten. |

This agent’s verify suite did **not** load the file into `process.env`. CI similarly does not inject these secrets. Shape-present ≠ process-present.

## Does git history still contain them?

**Yes, in history only.** Forward tracking is stopped (`git rm --cached .project-config.json`). `git log -- .project-config.json` still has historical commits on this lineage, first added `42e338c` (2026-05-15). Any clone of the repo history can recover prior secret values until the owner authorizes a separate history rewrite.

`git_remote.session_token` / access keys that remain in old commits are especially sensitive (repo-write or object-store scoped, depending on Manus). Do not rewrite history in this change.

## Rotation steps (owner-authorized only)

**Do not rotate in this RC.** If the owner later authorizes:

1. Owner confirms which slots are still live (SendGrid pair, Stripe test vs live price mismatch, Forge, FRED, Polygon, X, Google, JWT, QA, DB URL, git_remote STS).
2. Issue **new** credentials at each vendor; revoke old.
3. Update **platform secrets UI** (or a new untracked local file). **Do not** commit new values.
4. **Forward untrack is done** (`git rm --cached .project-config.json`). Use the placeholder example or Railway/env for names only. Rewriting history is a separate, explicit owner request.
5. Rotate `JWT_SECRET` only with a planned cookie invalidation window.
6. Rotate `DATABASE_URL` only with a planned failover.
7. After SendGrid: re-run live account check offline before removing `it.skip`.
8. After Stripe: create **test-mode** prices matching `shared/tiers.ts`; do not keep live price IDs next to `sk_test_`.
9. Set `CRON_SECRET` on the host (do not fail-open).
10. Confirm no copies in chat logs, backup zips, or agent transcripts.

## Discrepancies (inspect-only)

1. **Test Stripe secret + live-locked price IDs** — checkout verify will fail (see `docs/RC_STRIPE_SANDBOX_RECONCILE.md`). No offer change.
2. **Two SendGrid keys** (`SENDGRID_API_KEY` vs `Sendgrid`) — app reads `SENDGRID_API_KEY`; the other may be stale.
3. **Was tracked + gitignored** — forward tracking removed; history leak remains until owner-authorized rewrite.
4. **QA secret length 9** — rotate if owner wants production QA.
5. **git_remote STS** — likely expired; still a secret-in-git issue.

## Related

- `docs/RC_PROVIDER_MATRIX.md`
- `docs/RC_STRIPE_SANDBOX_RECONCILE.md`
- `.gitignore` line `.project-config.json`
- `.project-config.example.json` (placeholders only)
- `docs/SECURITY.md`
