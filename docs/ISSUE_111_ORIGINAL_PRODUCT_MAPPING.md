# Issue #111 — Original-product mapping and scope boundary

**Baseline:** `68d54c23caa3200d28e0b835dfb166b309042cf8` (clean source gate baseline).

There is no pre-existing VIP invitation flow to restore. The implementation is therefore constrained to the closest established FAULTLINE workflows rather than inventing a new product mode:

| Existing workflow authority                                | Issue #111 use                                                                      | Explicit non-change                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `PromoRedeem.tsx`                                          | Standalone, mobile-safe redemption page with sign-in gate and clear expiry outcome. | No public promo-code counter, campaign analytics, or permanent user-tier mutation.    |
| `AdminPromoDashboard.tsx` / existing `/app/admin/*` routes | Direct owner-only operational control, reusing the current authenticated app shell. | No new public navigation, owner role, or public registration route.                   |
| `server/_core/oauth.ts`                                    | The existing OAuth callback remains the sole account-creation path.                 | No client-supplied `invited` flag; `OPEN_REGISTRATION` stays `false`.                 |
| `shared/tiers.ts` and existing tier gates                  | Existing premium gates continue to be authoritative.                                | No Stripe, checkout, billing, PLATO, scheduler, Track Record, or feature-flag change. |

The recipient-facing view shows no market number, demo metric, or synthetic intelligence. It only states that downstream FAULTLINE market evidence can be delayed, stale, or unavailable and must remain labeled by the existing product surfaces.

The private token is consumed by a server redirect before any React route, OAuth state, analytics event, or referrer can receive it. Only a signed HttpOnly claim cookie reaches the redemption workflow.
