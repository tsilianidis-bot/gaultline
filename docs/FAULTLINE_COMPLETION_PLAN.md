# FAULTLINE Completion Plan

**Branch:** `grok/faultline-completion-2026-09-08`  
**Baseline:** `870d1f82…`  
**Date:** 2026-09-08

Complexity: S/M/L/XL. Canonical touch: Y/N.

## P0 — integrity / blockers (code-first)

| ID | Problem | Solution | Cx | Canonical? | Status |
|----|---------|----------|----|------------|--------|
| P0-1 | USI `_providerHealth` untyped | Extend `DayTradeReport` | S | N | IN PROGRESS |
| P0-2 | Shadow `as any` where | drizzle `eq()` | S | N | DONE `0283841` |
| P0-3 | Hardcoded FMOS ECE/Brier as live | Label STATIC or wire live metrics | M | N | QUEUED |
| P0-4 | Docs not in repo | Commit audit/plan/log | S | N | PARTIAL |
| P0-5 | Maintenance flip without version proof | Runbook (committed) | S | N | DONE `601219a` |
| P0-6 | Dual-numbered drizzle ambiguity | Document apply order | M | N | QUEUED |
| P0-7 | Hardcoded pressure fallbacks | Ensure DataStatus always labeled | M | Y labels | QUEUED |

## P1 — launch (mostly owner/ops)

SendGrid key, heartbeat/cron, domain bundle=tip, auth path, maintenance flip, Stripe verify, provider keys, mobile icons self-host.

## P2 — product value

Governed FMOS calibration rebuild (shadow), 25-year claim demotion/extension, AltRotation nav, Track Record wording, PLATO naming.

## P3 — post-launch

CSP tighten, Vite OOM, archive dead pages, V3-H Challenger only.

## Execution order

P0-2 → P0-4/5 → P0-1 → P0-3 → P0-6/7 → remaining safe P0 → P1 code where possible → stop for owner blockers.
