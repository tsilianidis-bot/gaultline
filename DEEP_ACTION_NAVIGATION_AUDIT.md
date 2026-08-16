# Deep Action Navigation Audit

## Production reproduction boundary — 2026-08-16

The live URL `https://getfaultline.live/app/act/deep` was opened successfully. The unauthenticated route rendered the shared application shell, canonical Global Markets ticker, top and bottom navigation controls, and the protected-access gate. The Deep Action cards named in the report were not available to this browser session because the page requires sign-in.

This confirms that live route loading reaches the intended protected route rather than a direct server-side redirect. The reported card-level reload behavior must therefore be traced through the authenticated Deep Action component and shared navigation primitives in source, then verified in an authenticated session after the code repair.

## Initial production observations

| Area | Observation |
|---|---|
| Current route | `/app/act/deep` remained in the address bar after loading. |
| App shell | Loaded correctly with direct buttons for `NOW`, `WHY`, `OUTLOOK`, `WATCH`, and `ACT`. |
| Protected Deep Action content | Not rendered for the unauthenticated browser session. |
| Deployment evidence | The live domain currently serves the canonical Global Markets ticker update, unlike the earlier stale Rising Stars deployment observation. |

## Route and action map

`/app/act/deep` is intentionally rendered by `SmartDiscovery.tsx`, not `Act.tsx`. It is the protected ASHA/Smart Discovery workspace and therefore must retain in-page question execution rather than treating every card as a route link.

| Control group | Intended behavior | Source owner |
|---|---|---|
| Full Market Briefing, Macro Overview, Market Regime, Top Risks, Top Opportunities, Crypto Intelligence, Economic Calendar, Portfolio Risk, What Changed, Sector Rotation, Best Day Trades | Submit a predefined ASHA prompt in place. No route change or document navigation. | `QUICK_ACTIONS` → `handleSubmit` |
| Suggested ASHA questions | Submit the selected query in place. | `SUGGESTED_QUESTIONS` → `handleSubmit` |
| Result follow-ups | Submit follow-up prompt in place. | Result-card `onAskFollowUp` → `handleSubmit` |
| Result deep dives | Use Wouter to reach a supplied specialist route. | `handleDeepDive` |
| Selected asset | Set ticker context then navigate to Symbol Intelligence. | `handleSelectAsset` |
| Bottom navigation | Route through the canonical registry: Home `/app/now`, Why `/app/why`, Outlook `/app/outlook`, Watch `/app/watch`, Act `/app/act`. | `AppLayout.handleNavigate` |

## Root-cause findings

The application shell has no enclosing form and no document-level click redirect handler. Wouter navigation itself works in production: programmatically invoking the live `WHY` button changed the route from `/app/act/deep` to `/app/why` without a document reload.

The Deep Action workspace did, however, leave all of its interactive buttons at browser-default type and removed the just-submitted user message when a request failed. The combined effect made a failed in-page action look like the workspace had reset. The repair therefore applies one shared submission guard to the entire workspace, makes primary interactive controls explicit `type="button"`, stops unintended native click behavior before dispatching ASHA actions, and preserves the submitted context if an ASHA request fails.

## Validation

| Check | Result |
|---|---|
| Wouter production navigation | Confirmed: live `WHY` control changed `/app/act/deep` to `/app/why` without a document reload. |
| Nested forms / global redirects | No enclosing `form` and no document-level click redirect handler found in the app shell. |
| Deep Action safeguards | Added workspace-level `onSubmitCapture`, runtime explicit non-submit typing for all rendered controls, and explicit in-place handlers for quick prompts, suggested questions, input send, context clear, and conversation clear. |
| Failure behavior | The submitted ASHA question remains visible if the analysis request fails; an error now represents a recoverable request failure instead of a reset-looking state. |
| Automated coverage | `deepActionNavigation.test.ts` and `askUxFixes.test.ts`: 30/30 passing. Full suite: 1,572 passed, 22 skipped. |
