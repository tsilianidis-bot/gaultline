# Market Preflight Preference System — How It Works

## The Core Idea

The **Complete Market Awareness™** system is a daily situational awareness checklist built into FAULTLINE. The idea is that before a user makes any position decision, they should have reviewed the key context: the pressure index, the market regime, active alerts, signal labels, and scenario risk. The system tracks which pages they have actually visited and scores their awareness from 0–100.

The **preference controls** let each user decide how prominently that system surfaces itself. Some users want full coaching; others just want a quiet indicator; others want it completely out of their way while still keeping the data.

---

## The Three Layers

### 1. The Database Column (`preflightPromptMode`)

Every user row in the `users` table has a `preflightPromptMode` enum column with three values: `full_guidance`, `minimal_reminders`, or `off`. Default is `full_guidance`. This is the single source of truth — it persists across sessions and devices.

### 2. The Server Procedures (`awareness.getPreflightMode` / `awareness.setPreflightMode`)

Two tRPC procedures read and write that column. Both are `protectedProcedure` — they require a logged-in session. The preference card in `UserAccount.tsx` calls `setPreflightMode` when the user clicks a mode button, and every component that needs to know the mode calls `getPreflightMode` (cached for 60 seconds to avoid hammering the DB on every page load).

### 3. The Components (`AwarenessDashboardCard` + `PreflightTrigger`)

These two components are the only things that render differently based on the mode. They both call `getPreflightMode` on mount and branch their rendering:

| Mode | `AwarenessDashboardCard` (Dashboard) | `PreflightTrigger` (Page headers) |
|---|---|---|
| **Full Guidance** | Full card: score ring, completion bar, missing-checks list, "Run Market Preflight" CTA | Full button: score ring + "PREFLIGHT" label + missing-check count badge |
| **Minimal Reminders** | Compact row: small score ring + single button | Same compact button (no missing-check badge) |
| **Off** | Returns `null` — card is completely hidden | Returns `null` — button is completely hidden |

---

## What "Off" Does and Does Not Do

This is the most important design decision. When a user sets the mode to **Off**:

- The dashboard card disappears.
- The `PreflightTrigger` button disappears from all 10 page headers.
- **The underlying system keeps running.** The `logAction` mutations still fire silently when the user visits pages (because those are wired to page-level `useEffect` hooks, not to the trigger button). The awareness score keeps accumulating. The DB history is never cleared.
- The feature remains fully accessible from **Profile → Account Preferences** (where the setting lives) and from **How to Use FAULTLINE** (which links to the preflight modal directly).

This means a power user who finds the prompts distracting can silence them without losing their streak or history, and can re-enable at any time with no data loss.

---

## The Action Logging Flow

Each page that has a `PreflightTrigger` passes an `actionKey` prop (e.g. `"viewed_scores"`, `"viewed_signals"`). When the user opens the modal from that page, the trigger fires `awareness.logAction` with that key. Separately, the `AwarenessDashboardCard` fires `"viewed_dashboard"` automatically on mount. The server stores each action in the `awareness_actions` table with a UTC timestamp, and the `getScore` procedure aggregates today's completed keys into the 0–100 score.

---

## Where the Preference Setting Lives

**Profile → Account Preferences** — it is a three-button radio card labeled "Market Preflight Prompts" with descriptions for each mode. It is not buried in a settings submenu; it is in the main preferences section alongside other account controls. The user can change it at any time with a single click, and the change propagates immediately to all open tabs via tRPC cache invalidation.

---

## Summary

The preference is a **display filter, not a feature toggle**. The intelligence runs regardless; the setting only controls how loudly it announces itself.

| Layer | File | Purpose |
|---|---|---|
| DB schema | `drizzle/schema.ts` | `preflightPromptMode` enum column on `users` |
| Server | `server/routers.ts` | `awareness.getPreflightMode`, `awareness.setPreflightMode` |
| Components | `client/src/components/MarketPreflight.tsx` | `AwarenessDashboardCard`, `PreflightTrigger`, `MarketPreflightModal` |
| Preference UI | `client/src/pages/UserAccount.tsx` | Three-button radio card in Account Preferences |
| Dashboard | `client/src/pages/Dashboard.tsx` | `AwarenessDashboardCard` wired in |
| Page triggers | Pressure, Signals, Scores, DiagnosticAI, AIWatch, Charts, DailyReport | `PreflightTrigger` in `PageHeader` `rightSlot` |
