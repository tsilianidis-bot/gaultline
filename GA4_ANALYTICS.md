# FAULTLINE GA4 Analytics

> **Production GA4 Measurement ID:** `G-YLJ9EQZK7P`

FAULTLINE now uses one client-side analytics runtime for Google Analytics 4. The runtime preserves the existing GA4 property, disables automatic page views, records one manual `page_view` for each application route, and does not load Google Analytics or Microsoft Clarity until the visitor explicitly accepts analytics cookies.

## Production configuration

| Setting | Value | Purpose |
|---|---|---|
| Default Measurement ID | `G-YLJ9EQZK7P` | Preserves continuity with the existing GA4 property |
| Optional environment override | `VITE_GA4_MEASUREMENT_ID` | Allows a future GA4 property change without editing application code |
| Runtime module | `client/src/lib/ga4.ts` | Initializes tags, applies consent, sanitizes payloads, and sends events |
| Consent storage key | `faultline_cookie_consent_v2` | Stores the visitor's accepted or declined choice |
| Automatic page views | Disabled | Prevents GA4 from duplicating the manual SPA route event |
| Google Signals | Disabled | Avoids advertising-oriented signal collection |
| Ad storage and personalization | Denied | Keeps the implementation focused on product analytics |

If the GA4 property changes later, update `VITE_GA4_MEASUREMENT_ID` through the project's managed environment settings rather than committing an `.env` file. Invalid values automatically fall back to the production ID above.

## Tracking behavior

| Visitor state | GA4 behavior | Clarity behavior |
|---|---|---|
| No consent choice | Script not loaded; no event sent | Script not loaded |
| Analytics declined | Script not loaded; no event sent | Script not loaded |
| Analytics accepted | Script loads and manual route tracking begins | Script loads |
| Consent later changed to declined | Consent updates to denied and FAULTLINE event helpers stop sending | No additional FAULTLINE analytics calls are initiated |

The runtime removes direct identifiers such as names, email addresses, phone numbers, IP fields, and customer identifiers. It also strips sensitive URL parameters—including checkout session identifiers—while preserving approved attribution parameters such as `utm_source`, `utm_medium`, `utm_campaign`, `ref`, `source`, and `plan`.

Existing acquisition and conversion instrumentation remains available through the shared runtime. This includes `page_view`, `session_start`, `sign_up`, `login`, `begin_checkout`, `purchase`, plan selection, upgrade prompts, search, feature usage, onboarding, and lifetime-offer interactions.

## GA4 verification

| Step | Action | Expected result |
|---|---|---|
| 1 | Open an incognito window and clear any prior FAULTLINE consent choice | Neither `gtag.js` nor Clarity loads before a choice |
| 2 | Select **Accept All** in the FAULTLINE cookie banner | `gtag.js?id=G-YLJ9EQZK7P` loads and consent changes to `analytics_storage: granted` |
| 3 | Navigate between public routes such as `/pricing`, `/analysis`, and `/blog` | GA4 receives exactly one `page_view` for each route |
| 4 | In GA4, open **Reports → Realtime** | The active user and page paths appear, usually within seconds |
| 5 | For detailed validation, connect the production URL in [Google Tag Assistant](https://tagassistant.google.com/) and open **Admin → DebugView** in GA4 | Consent, configuration, page views, and conversion events appear in event order |
| 6 | Repeat with analytics declined | No Google Analytics or Clarity script loads and no FAULTLINE analytics event is queued |

## Validation record

| Check | Result |
|---|---|
| TypeScript | Passed with no errors |
| Focused GA4 tests | 4 passed |
| Full Vitest suite | 1,557 passed, 22 skipped |
| Production build | Passed |
| Production browser: no choice | GA4 and Clarity blocked |
| Production browser: accepted | Correct tag loaded and one initial page view emitted |
| Production browser: SPA navigation | One additional page view emitted for the new route |
| Production browser: declined | GA4 and Clarity blocked after a fresh load |

The production build still reports pre-existing bundle-size advisories and duplicate-case warnings in `server/tradePreflight.ts`; neither warning originates from or affects this GA4 implementation.

## References

Google's consent implementation guidance requires consent defaults and updates to be set before measurement behavior proceeds.[1] Google also recommends manual page-view handling for single-page applications when automatic history-based measurement is not used.[2]

[1]: https://developers.google.com/tag-platform/security/guides/consent
[2]: https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
