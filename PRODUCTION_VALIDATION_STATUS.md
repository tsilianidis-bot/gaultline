# FAULTLINE Production Validation Status

**Checked:** 2026-08-17

## Custom-domain observation

The public custom domain, [getfaultline.live](https://getfaultline.live), loads the public marketing experience and its platform-entry controls. The browser session was not authenticated with a Core-eligible account, so protected application routes such as Signals Visual Analysis and the ORACLE briefing could not be acceptance-tested on the live custom domain in this session.

## Deployment limitation

Recent checkpoints are successfully publishing from the project environment, but prior work identified a recurring production propagation problem involving the missing or disconnected Cloud Run service/custom-domain target. Consequently, loading the public marketing page does **not** establish that the latest protected application bundle is currently served by `getfaultline.live`.

## Current conclusion

> Live custom-domain verification remains an external deployment dependency. Continue application work without rollback; repeat authenticated production acceptance once the deployment target is confirmed to serve the current checkpoint.

## Evidence

| Item | Result |
|---|---|
| URL checked | `https://getfaultline.live/` |
| Public shell | Loaded successfully |
| Marketing entry controls | Present |
| Authenticated protected-route validation | Not available in the current browser session |
| Latest protected bundle attribution | Not determinable from the public landing route alone |

## Follow-up live-route check

On the same custom domain, the prior deployed parameterized route
`/app/signals/AAPL` resolves into the Signals Visual Analysis shell, while the
newly published `/app/day-trade-intelligence/NVDA?asset=stock` deep link routes
to the FAULTLINE 404 screen. The local preview contains the Day Trade route and
its regression coverage passes. This difference confirms that the custom domain
is still serving a bundle older than checkpoint `df2a0dad`, rather than exposing
a client-side route-definition error in the current project.

| Additional URL checked | Result |
|---|---|
| `https://getfaultline.live/app/signals/AAPL` | Existing parameterized route loads the prior Signals analysis shell |
| `https://getfaultline.live/app/day-trade-intelligence/NVDA?asset=stock` | FAULTLINE 404 — new route absent from served bundle |
| Local preview Day Trade deep link | Resolves to the app shell; protected visual content requires sign-in |
| Current project checkpoint containing Day Trade route | `df2a0dad` |
