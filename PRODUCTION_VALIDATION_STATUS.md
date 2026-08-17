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
