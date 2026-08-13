# Rising Stars Validation Notes

## 2026-08-13 Preview Observation

The direct `/app/opportunities` preview was redirected by the application's active onboarding/deep-route flow to `/app/act/deep`, where the authenticated shell, navigation, intelligence ticker, ASHA panel, and loading state rendered. This did not provide a stable direct rendering of Opportunity Radar because onboarding and route state controlled the preview session. Browser validation of the new Opportunity Radar panel therefore remains pending after source-level, syntax, and unit-test validation; it must be repeated in an authenticated session with onboarding completed or skipped.
