# FAULTLINE Work Queue

Use this file only for tasks that pass the Work gate in `FAULTLINE_EXECUTION_ROUTER.md`.

## Rules

- Do not add ordinary strategy, coding, CI, or deterministic verification here.
- Pin every Work run to an exact commit SHA or preview build.
- Batch related items into one Work session whenever possible.
- Record evidence and outcome after each Work run.

## Pending

- [ ] Authenticated desktop/mobile preview QA
  - Commit/build: TBD
  - Scope: login, protected-route navigation, persistence, console errors
  - Evidence: screenshots + PASS/FAIL matrix

- [ ] Visual regression pass on key intelligence routes
  - Commit/build: TBD
  - Scope: Deep Dashboard, Pulse/Signals/Watchlist/Rotation/Brief, Validation surfaces
  - Evidence: screenshots + defects only

- [ ] Stripe sandbox browser verification
  - Commit/build: TBD
  - Scope: sandbox checkout/entitlement flow only
  - Evidence: screenshots + PASS/FAIL
  - Guardrail: no live payment activation or commercial-offer changes

## Completed

_No completed Work batches recorded yet._
