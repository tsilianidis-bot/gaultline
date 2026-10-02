# PLATO AI Router

PLATO talks to providers through one server-side router, `routePlatoCompletion` in `server/plato/router.ts`. Provider HTTP lives in adapters. Asha procedures (`asha.ask`, `asha.dailyGreeting`) use the router with task type `FAST`.

Task type is an explicit request flag:

- `FAST` is the default. Low-latency chat, explanations, summaries, and market interpretation.
- `DEEP_REASONING` is used only when the caller sets `taskType: "DEEP_REASONING"`.
- `FALLBACK` is not requested directly. The router uses it after the primary fails, times out, returns 429, or is unavailable.

`FAST` never calls Manus API v2, even if `PLATO_FAST_PROVIDER=manus-v2`.

## Defaults

Unset provider and model variables keep today's direct path: the OpenAI-compatible adapter using `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`. That URL currently points at Gemini's OpenAI-compatible endpoint. The default FAST model is `gemini-3-flash-preview`.

When that base URL is Gemini (`generativelanguage.googleapis.com` or a URL ending in `/openai`), a configured `models/` prefix is removed before chat. Other gateways keep the id unchanged, so a Forge-style catalog can still use bare ids.

If the fallback provider and model are the same as the primary, the router does not send a second request.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PLATO_FAST_PROVIDER` | `openai-compatible` | FAST provider. `manus-v2` is ignored for FAST. |
| `PLATO_REASONING_PROVIDER` | unset (same OpenAI-compatible path as FAST) | `DEEP_REASONING` provider. Set to `manus-v2` to use Manus API v2. |
| `PLATO_FALLBACK_PROVIDER` | `openai-compatible` | Used after 429, 5xx, timeout, or an unconfigured primary. `manus-v2` is not used for FAST fallback. |
| `PLATO_FAST_MODEL` | `gemini-3-flash-preview` | FAST model. `FAULTLINE_PLATO_MODEL` is a legacy alias. |
| `PLATO_REASONING_MODEL` | unset | Model id for an OpenAI-compatible reasoning provider. Not sent to Manus v2. |
| `PLATO_FALLBACK_MODEL` | same as FAST | Fallback model. |
| `PLATO_FAST_TIMEOUT_MS` | unset (no client timeout) | Application timeout around a provider call. |
| `MANUS_OAUTH_TOKEN` | unset | Bearer token for Manus API v2. Preferred when both credentials are set. |
| `MANUS_API_KEY` | unset | `x-manus-api-key` for Manus API v2. Documented keys grant full account access. |
| `PLATO_MANUS_AGENT_PROFILE` | unset (`standard` on Manus) | `standard`, `lite`, or `max` only. Other values are ignored. |
| `PLATO_MANUS_POLL_DEADLINE_MS` | `45000` | Application poll deadline, not a Manus SLA. |
| `PLATO_MANUS_GATEWAY_ENABLED` | unset | Must be the string `true` or the gateway adapter refuses to run. |
| `PLATO_MANUS_GATEWAY_BASE_URL` | unset | No default URL. Required with the flag above. |
| `PLATO_MANUS_GATEWAY_API_KEY` | unset | Bearer token for that base URL. Stays on the server. |
| `PLATO_MANUS_GATEWAY_MODEL` | FAST model | Model id sent to the gateway `/v1/chat/completions` path. |

`gemini-3.1-pro-preview` is not selected unless one of the model variables names it.

## Switching providers

1. Direct Gemini or another OpenAI-compatible chat API: leave `PLATO_FAST_PROVIDER` unset and set `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`. Optional: `PLATO_FAST_MODEL`.
2. Deep reasoning on Manus API v2: set `PLATO_REASONING_PROVIDER=manus-v2` and either `MANUS_OAUTH_TOKEN` or `MANUS_API_KEY`. Call the router with `taskType: "DEEP_REASONING"`. The adapter creates a task, polls `task.detail`, then reads `task.listMessages`. It enforces the documented limits: `task.create` 10/minute, reads 100/minute, and about 5,000 estimated input tokens.
3. Manus inference gateway: set `PLATO_MANUS_GATEWAY_ENABLED=true`, `PLATO_MANUS_GATEWAY_BASE_URL`, and `PLATO_MANUS_GATEWAY_API_KEY`, then point `PLATO_FAST_PROVIDER` or `PLATO_FALLBACK_PROVIDER` at `manus-gateway`. Until those are set, the adapter throws and does not call a network.

Background jobs (OwnerSim, FMOS interpretation, trade preflight, publishing) do not use this router. They keep the separate OpenAI-compatible budget in `server/llmCapacity.ts`.

## UNVERIFIED

- The `chars / 4` token estimate. Manus documents a ~5,000 estimated-token input cap and says the estimator is lightweight, but it does not publish the formula.
- `PLATO_MANUS_POLL_DEADLINE_MS` (default 45 seconds). This is an application deadline. Manus does not publish a task completion SLA. Webhooks are the documented alternative to polling.
- `PLATO_REASONING_MODEL` is not a documented Manus model parameter. Manus v2 selects `agent_profile` (`standard`, `lite`, `max`). The model variable is ignored by the Manus adapter.
- External use of a Manus inference gateway is pending Manus confirmation that it is officially supported. The adapter stays disabled and has no default URL.
- In-process Manus rate limits, the background LLM budget, and the OwnerSim call cap reset when the process restarts. More than one server instance would not share those counters.
- A stale Railway `BUILD_COMMIT` variable makes `/api/health` report `ed4cc79`. This change does not edit Railway config.
