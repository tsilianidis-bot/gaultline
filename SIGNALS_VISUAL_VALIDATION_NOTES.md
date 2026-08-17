# Signals Visual Analysis Preview Notes

## Preview validation — 2026-08-17

The direct preview route `/app/signals/AAPL` resolved through the new page and displayed the intentional fault-tolerant unavailable state rather than a generic blank or crash screen. The page retained the back route to Signals and exposed a retry action.

The upstream visual-detail request did not complete successfully in the unauthenticated preview context because the route uses the existing `coreProcedure` authorization policy. The page now distinguishes the Core-access requirement from provider availability rather than showing a generic retry state. Authenticated end-to-end visual validation requires a Core-eligible session.

Focused regression coverage passes for the canonical adapter, route ordering, scanner handoff, shared-chart reuse, no-history boundary, evidence sections, and access-state copy: **8 tests across 3 files**.

The full suite reached **1,587 passing tests and 22 skipped**, but did not complete cleanly because six unrelated tests timed out while calling external-dependent Smart Discovery, decision-ledger, and trade-preflight paths. An isolated rerun reproduced the decision-ledger timeout and trade-preflight timeouts without touching Signals Visual Analysis code. These failures must be resolved or excluded through deterministic mocks before the project-wide suite can meet its all-green gate.
