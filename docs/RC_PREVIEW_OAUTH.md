# RC preview Manus OAuth (faultline1 Space)

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Scope:** preview Space sign-in only. This document does **not** deploy production, merge to `main`, or change live Stripe.

## Observed blocker

Preview login reaches the Manus account chooser, then `/api/oauth/callback` returns:

```json
{"error":"OAuth callback failed"}
```

The browser app-auth URL (working client start) is:

- `appId=Xbzsed6coyZiRmSu4UeiVi`
- `redirectUri=https://faultline1-xbzsed6c.manus.space/api/oauth/callback`

The **server** token exchange (`server/_core/sdk.ts` `getTokenByCode`) sends `clientId: ENV.appId`, and `ENV.appId` is **only** `process.env.VITE_APP_ID` (`server/_core/env.ts`). If that runtime value does not equal the `appId` on the app-auth URL, Manus rejects the code exchange. The previous catch-all hid the step that failed.

## What the owner must set on the Manus preview env

Set these on the **faultline1** preview Space (id `Xbzsed6coyZiRmSu4UeiVi`), then **rebuild** the Space if the client bundle embeds `VITE_*` at build time.

| Variable | Preview value / rule |
| --- | --- |
| `VITE_APP_ID` | **Must equal** the Manus `appId` on the app-auth URL. For faultline1 that is `Xbzsed6coyZiRmSu4UeiVi`. |
| `OAUTH_SERVER_URL` | Must be set (Manus OAuth API base; used by server token + userinfo). |
| `JWT_SECRET` | Must be set (session cookie signing). |
| `DATABASE_URL` | Must be set (user upsert on callback). |
| `VITE_OAUTH_PORTAL_URL` | Must be set before client build (login URL host, typically `https://manus.im`). |

Do **not** copy a different project’s `VITE_APP_ID` onto this Space. The original webdev project id is not the faultline1 Space id. Client `getLoginUrl()` (`client/src/const.ts`) already reads `import.meta.env.VITE_APP_ID` — there is no hardcoded Space id in the client. Vite inlines `VITE_APP_ID` at **build** time, so changing the env without a rebuild leaves the login URL on the old id.

## After a rebuild, confirm

1. View source / network on Sign in: `appId=` must be `Xbzsed6coyZiRmSu4UeiVi`.
2. Server process env `VITE_APP_ID` must be the same string (length 22). Empty `VITE_APP_ID` logs `[OAuth] ERROR: VITE_APP_ID is not configured!` at boot.
3. Retry login. A failure now returns a **safe** JSON body:

```json
{
  "error": "OAuth callback failed",
  "errorCode": "token_exchange_failed",
  "message": "Authorization code could not be exchanged for a token."
}
```

`errorCode` is one of: `token_exchange_failed`, `userinfo_failed`, `db_failed`, `session_failed`, `callback_failed`. The HTTP body never includes tokens, codes, or provider payloads. Full errors stay in **server logs** only.

| `errorCode` | Operator meaning |
| --- | --- |
| `token_exchange_failed` | `VITE_APP_ID` / `OAUTH_SERVER_URL` mismatch, or code/redirectUri rejected |
| `userinfo_failed` | Token exchange worked; userinfo call failed |
| `db_failed` | `DATABASE_URL` / user persist failed |
| `session_failed` | `JWT_SECRET` missing or session sign failed |
| `callback_failed` | Unclassified catch-all |

## What this RC does not do

- No production domain or Manus production deploy.
- No live Stripe.
- No client redesign and no hardcoded preview Space id (env-first stays correct for every host).

## Related

- `docs/RC_PREVIEW_PIN.md`
- `docs/RC_PREVIEW_BUILD_IDENTITY.md`
- `references/manus-oauth.md`
