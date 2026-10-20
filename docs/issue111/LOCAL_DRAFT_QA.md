# Issue #111 — Draft-only QA evidence

This evidence is **local source proof only**. It is not a Railway candidate run, production proof, an OAuth-session test, or evidence of a customer invitation.

## Rendered fail-closed UI

| View               | Result                                                                                 | Evidence                        |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------- |
| Desktop, 1440×1000 | PASS — token-free unavailable state rendered with no JavaScript exceptions.            | `local-desktop-unavailable.png` |
| Mobile, 390×844    | PASS — responsive token-free unavailable state rendered with no JavaScript exceptions. | `local-mobile-unavailable.png`  |

The screenshots intentionally exercise an unavailable invite. They confirm that a missing, expired, revoked, or previously redeemed claim fails closed without revealing which state occurred. They contain no invitation token, email, session, candidate URL, or production callback.

## Source and transaction gates

- Focused VIP primitive tests: **5 passed**.
- OAuth independence plus VIP primitive tests: **14 passed**.
- Full suite: **328 files passed, 8 skipped; 3,774 tests passed, 52 skipped**.
- TypeScript: **passed**.
- Production build: **passed**.
- Drizzle metadata check: **passed**.
- Disposable local MariaDB transaction proof: `0074_vip_guest_invitations.sql` applied; owner creation, single redemption, duplicate-redemption denial, unused-link expiry, revocation, and non-mutation of `users.accessTier` all passed.

## Not performed by this draft

No candidate deployment, candidate schema migration, Railway write, production change, checkout/billing change, public-registration toggle, PLATO activation, scheduled-job change, real OAuth/passkey session, or real recipient invitation was performed. A candidate demonstration requires a separate explicit authorization to deploy this exact draft SHA and apply its additive migration only to the isolated candidate database.
