# FAULTLINE Grok Completion Log

**Branch:** `grok/faultline-completion-2026-09-08`  
**Baseline:** `870d1f82bffb02599f0a8e9818a902904511fd9a`  
**Started:** 2026-09-08 (America/New_York)  
**Path:** GitHub MCP file APIs only (no clone, no main, no force-push)

## RUNTIME VERIFICATION QUEUE

| ID | Command / check | Why blocked | Status |
|----|-----------------|-------------|--------|
| RV-1 | `pnpm install && pnpm check` | No full repo runtime on box | **BLOCKED-RUNTIME** |
| RV-2 | `pnpm test` | Same | **BLOCKED-RUNTIME** |
| RV-3 | `pnpm build` | Same (+ historical Vite OOM) | **BLOCKED-RUNTIME** |
| RV-4 | GitHub Actions on branch | Needs PR/CI watch | **BLOCKED-RUNTIME** |
| RV-5 | SendGrid live account check | Credential 401 — owner | **BLOCKED-OWNER** |
| RV-6 | Custom domain `/api/version` == tip | Deploy/domain — owner | **BLOCKED-OWNER** |
| RV-7 | Heartbeat schedule fire | Forge/CRON — owner | **BLOCKED-OWNER** |

---

## Commit SHAs (keep; do not revert)

| SHA | Message |
|-----|---------|
| `028384163d0811ce105d8d7b9e196642d37338a8` | fix(shadow): drizzle eq() |
| `601219a30a08089e395b6b67159d295c56839dd5` | docs: Grok log + maintenance runbook |
| `ab31893a675c7ba4a17b6024c02a62457a09acd6` | docs: audit + plan |
| `729d61e3048bc0ff763932adc11ed1faca115ad6` | fix(usi): restore UniversalSymbolIntelligence (P0-1) |
| `7f0c8dc3616e897c2ccd7657df767c8457d70c90` | fix(fmos): STATIC DEMO labels on FmosHealthDashboard (P0-3) |
| `975cc2b79e72e6935a13282802f9a889f35fc895` | fix(fmos): STATIC Phase-2 reference on ValidationLab (P0-3) |

---

## P0-1 USI — INCIDENT / BLOCKED-TRANSPORT

**Problem:** `DayTradeReport` lacked `_providerHealth?` while UI reads `report._providerHealth`.

**Prepared on box (correct full page):**
- `/workspace/usi-minimal.tsx` (sha256 `9cd71b9039426068c12a603bc884e8b27f8710fc89de1f61768ca4e44cf39159`)
- `/workspace/usi_push_xmlsafe.json` — push_files payload with `\u003c`/`\u003e` XML-safe escaping
- `/workspace/FINAL_usi_create_or_update.json`

**What went wrong:** Large JSX `push_files` with raw `<` broke tool-call XML / or path stubs (`FILE://…`, `PLACEHOLDER`) were uploaded literally. Current tip file is a stub — **must restore from box payload**.

**Do not revert** `0283841` / `601219a` / `ab31893`.

**Owner/parent action:** `push_files` or `create_or_update_file` with **full file bytes** from `/workspace/usi-minimal.tsx` (not a path string). Prefer `/workspace/usi_push_xmlsafe.json` as the exact MCP arguments object.

**Status:** **DONE** — restored at `729d61e3048bc0ff763932adc11ed1faca115ad6` via Contents API (leave USI alone).

**Do not touch USI again** after this restore.

---

## P0-2 shadow — DONE

- SHA: `028384163d0811ce105d8d7b9e196642d37338a8`

---

## P0-3 FMOS claim-honesty — DONE

Label STATIC DEMO / STATIC Phase-2 reference on hardcoded ECE/Brier display surfaces. Live `getCalibrationMetrics` remains separate; no invented live numbers.

| File | Commit SHA |
|------|------------|
| `client/src/pages/FmosHealthDashboard.tsx` | `7f0c8dc3616e897c2ccd7657df767c8457d70c90` |
| `client/src/pages/ValidationLab.tsx` | `975cc2b79e72e6935a13282802f9a889f35fc895` |

**Changes:**
- `BACKTEST_SUMMARY_DATA_CLASS = "STATIC_PHASE2_DEMO"` + amber STATIC DEMO banner before overview KPIs
- Overview KPIs / calibration Brier·Skill·ECE relabeled `STATIC ·` / `STATIC …` with Phase 2 demo / not live hints
- Findings intro: STATIC Phase 2 research findings (not live governed claims)
- `INSTITUTIONAL_METRICS_DATA_CLASS = "STATIC_PHASE2_REFERENCE"` + amber STATIC REFERENCE CARDS banner before Tabs
- Softened "Our score of 0.214" / live ECE tooltips to Phase-2 static reference language

**USI:** left alone at `729d61e3048bc0ff763932adc11ed1faca115ad6`.

---

## P0-5 maintenance runbook — DONE (in `601219a`)

See `docs/MAINTENANCE_MODE_RUNBOOK.md`.

---

## Next P0

1. ~~Restore USI (P0-1)~~ DONE (`729d61e…`).
2. ~~FMOS claim-honesty (P0-3)~~ DONE.
3. Owner: RV-1–RV-3 / RV-6 before maintenance flip.
