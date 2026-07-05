# FAULTLINE Production Audit Findings

## Route Mapping for 4 Target Pages

| Requested Path | Actual Route | Component | Status |
|---|---|---|---|
| /app/command-center | /app/command | MarketCommandCenter.tsx (698 lines) | EXISTS — needs /app/command-center alias + tier gate |
| /app/pressure-index | /pressure-index (public) + /app/pressure | PressureIndex.tsx (547 lines, public) + Pressure.tsx | EXISTS — needs /app/pressure-index alias inside app |
| /app/ai-diagnostic | /app/diagnostic | DiagnosticAI.tsx (855 lines) | EXISTS — has DEMO MODE banner in PositionGuidanceSection (line 576) |
| /app/daily-briefing | /app/report | DailyReport.tsx (565 lines) | EXISTS — needs /app/daily-briefing alias |

## DiagnosticAI DEMO MODE Issue
- File: client/src/pages/DiagnosticAI.tsx, line 576
- The `PositionGuidanceSection` shows "DEMO MODE — Placeholder assets for illustration. Connect live data for production use."
- The component DOES receive real data via `trpc.guidance.getGuidance.useQuery()` (line 214)
- The DEMO MODE banner is hardcoded — it shows even when real data is present
- Fix: Remove the hardcoded DEMO MODE banner from PositionGuidanceSection

## positionGuidance.ts
- `getPositionGuidance()` is a real engine using FAULTLINE pressure data + LLM
- It uses a demo asset list (line 563 references demoAsset) when no user positions exist
- The guidance IS real data, not placeholder — the banner is wrong

## What Needs to Be Done

### Phase 2: Command Center
- Add route alias `/app/command-center` → MarketCommandCenter in App.tsx
- Add nav entry in AppLayout (already has /app/command)
- The page is already substantial (698 lines) — review for any stubs

### Phase 3: Pressure Index  
- Add route alias `/app/pressure-index` inside the authenticated app section
- The public `/pressure-index` is an acquisition funnel page
- The authenticated `/app/pressure` is the full Pressure.tsx page
- May need to check Pressure.tsx for completeness

### Phase 4: AI Diagnostic
- Remove DEMO MODE banner from DiagnosticAI.tsx PositionGuidanceSection (line 576)
- Add route alias `/app/ai-diagnostic` → DiagnosticAI in App.tsx
- Verify all 4 timeframe tabs work with real data

### Phase 5: Daily Briefing
- Add route alias `/app/daily-briefing` → DailyReport in App.tsx
- Check DailyReport.tsx for any placeholder content

## Other Issues Found
- `client/src/pages/DiagnosticAI.tsx:576` — DEMO MODE banner (hardcoded, wrong)
- All 4 pages exist and have substantial content — they just need route aliases

## Existing Routes (No Missing Pages)
All pages exist. The issue is:
1. The requested paths (/app/command-center, /app/pressure-index, /app/ai-diagnostic, /app/daily-briefing) don't exist as routes
2. The actual routes use different paths (/app/command, /app/pressure, /app/diagnostic, /app/report)
3. Need to add both the aliases AND update nav entries to use the canonical paths

## Nav Entries to Add/Update
- AppLayout: check if all 4 pages have nav entries
- The DEMO MODE banner in DiagnosticAI must be removed
