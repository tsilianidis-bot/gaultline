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

## Post-checkpoint confirmation

After checkpoint `ded19125`, the custom-domain URL
`https://getfaultline.live/app/day-trade-intelligence/NVDA?asset=stock&validation=ded19125`
again loaded the older application shell without the current Day Trade Visual
Analysis content. It also showed the standard sign-in path rather than the
newly published permanent QA path. The managed preview resolves the same route
and QA principal correctly.

> The public custom-domain target is therefore still serving an older bundle.
> This remains a deployment propagation/routing infrastructure dependency, not
> a defect in the current Day Trade route or permanent QA implementation.

## Founder Statement checkpoint validation

After checkpoint `ddeaf4f5`, the custom-domain URL
`https://getfaultline.live/?founder-statement=ddeaf4f5` returned the FAULTLINE
page title but rendered a blank black client surface with no visible interactive
elements in the available browser session. The updated Founder Statement could
therefore not be visually confirmed on the live domain from this session.

| Additional URL checked | Result |
|---|---|
| `https://getfaultline.live/?founder-statement=ddeaf4f5` | Blank client surface; no visible Founder Statement or controls |
| Local Founder Statement source | Supplied replacement copy present in the active Product Experience section |
| Regression coverage | Confirms the previous Product Experience Founder Statement is absent and requested opening, questions, and closing are present |

> This live-render result is consistent with the existing external custom-domain
> bundle/propagation problem. It does not change the validated local source or
> full-suite result for checkpoint `ddeaf4f5`.

## Public Founder and pricing repair checkpoint validation

After checkpoint `d69b0fc6`, the custom-domain URL
`https://getfaultline.live/pricing?public-repair=d69b0fc6` reached the production
shell but remained at **LOADING MODULE…**. This prevented desktop or mobile
visual confirmation of the new Founder copy and the Founding Member / Trader /
Power pricing cards. The page title continued to identify the prior
**Free, Pro & Founding Member** bundle.

| Additional URL checked | Result |
|---|---|
| `https://getfaultline.live/pricing?public-repair=d69b0fc6` | Production shell loaded but stalled at **LOADING MODULE…** |
| Current public source and regression suite | Founder, pricing, retired-offer, chatbot, and verified-checkout guard checks pass locally |
| Current published repair checkpoint | `d69b0fc6` |

> The live custom-domain client still does not serve a verifiable current pricing
> module. This remains an external deployment/module propagation dependency, not
> a validated local source or test failure.
