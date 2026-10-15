# AI Provider Quota Sources — 2026-10-15

- Google Gemini API billing: <https://ai.google.dev/gemini-api/docs/billing>
  - Tier 1 requires an active linked billing account; Google states that setup may require a minimum US$5 prepayment.
  - Project-level spend caps are configurable in AI Studio.
  - Paid service requires positive prepaid credit balance where the account uses the Prepay plan.
- Google Gemini API rate limits: <https://ai.google.dev/gemini-api/docs/rate-limits>
  - Limits are evaluated per project across requests/minute, input tokens/minute, and requests/day; limits vary by model.
  - Requests/day reset at midnight Pacific time.
  - Google documents 429 `RESOURCE_EXHAUSTED` for limit exhaustion and advises waiting/retrying, reducing expensive requests, or requesting a rate-limit increase.
- Google Gemini API pricing: <https://ai.google.dev/gemini-api/docs/pricing>
  - Pricing is model-, token-, and tier-specific; the production project's actual selected model and usage volume are required to calculate a precise recurring cost.

This record is factual source evidence only; it contains no credentials or production billing data.
