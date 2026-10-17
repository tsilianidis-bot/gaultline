# PLATO AI router

All PLATO model calls (`asha.ask`, `asha.dailyGreeting`) go through
`server/plato/router.ts` via `invokeAshaGateway` in `server/ashaGateway.ts`.

## Provider

One approved provider: the existing OpenAI-compatible gateway configured by
`BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`. In production that is
Google's Gemini OpenAI-compatible endpoint. No other provider is added or
enabled by this code.

## Model chain

Primary first, then fallbacks on the same provider and key:

| Order | Model | Why |
| --- | --- | --- |
| 1 | `gemini-3-flash-preview` | Existing production model |
| 2 | `gemini-3.1-flash-lite` | Separate per-model quota bucket on Gemini |
| 3 | `gemini-3.5-flash-lite` | Separate per-model quota bucket on Gemini |

Verified against the production key's `/models` catalog and a chat call on
2026-10-02. `gemini-2.5-flash` and `gemini-2.5-flash-lite` return 404 "no
longer available to new users" on this key.

Optional overrides (none set in production): `PLATO_FAST_MODEL` or
`FAULTLINE_PLATO_MODEL` (primary), `PLATO_FALLBACK_MODELS` (comma list) or
`PLATO_FALLBACK_MODEL`. TTS, embedding, image, video, audio and transcription
models are always dropped from the chain (`server/ashaModelPolicy.ts`).

The old catalog-guess path (take the first three catalog ids when no preferred
id matched) is removed. On the production key those ids were
`gemini-2.5-flash`, `gemini-2.5-pro` and `gemini-2.5-flash-preview-tts`.

## Retry and fallback

| Failure | Class | Action |
| --- | --- | --- |
| 429 / `RESOURCE_EXHAUSTED` | `quota` | Next model (quota is per model, so no same-model retry) |
| 503 / `UNAVAILABLE` / "high demand" / "overloaded" | `capacity` | Retry same model once with jittered backoff, then next model |
| Other 5xx | `provider_5xx` | Same as capacity |
| `fetch failed`, `ECONNRESET`, DNS | `network` | Same as capacity |
| Attempt deadline (request is aborted) | `timeout` | Next model |
| 404 | `model_unavailable` | Next model |
| 401 / 403 / missing key | `auth` | Stop. Every model shares the key |
| 400 / 422 | `bad_request` | Stop |

Bounds (env override in brackets): per-attempt deadline 45 s
(`PLATO_ATTEMPT_TIMEOUT_MS`), total deadline 100 s (`PLATO_TOTAL_DEADLINE_MS`),
at most 4 provider calls (`PLATO_MAX_ATTEMPTS`, capped at 8), 1 same-model
retry (`PLATO_SAME_MODEL_RETRIES`, capped at 2), backoff base 750 ms
(`PLATO_RETRY_BASE_DELAY_MS`, capped at 4 s).

## All providers fail

The router throws `PlatoUnavailableError` with `reason` `quota`, `capacity`,
`timeout`, `misconfigured` or `provider_error`. It never returns a synthetic
answer. `server/ashaProcedureError.ts` maps it to a typed tRPC error:

| Reason | tRPC code | HTTP |
| --- | --- | --- |
| `quota` | `TOO_MANY_REQUESTS` | 429 |
| `capacity`, `timeout`, `provider_error` | `SERVICE_UNAVAILABLE` | 503 |
| `misconfigured` | `INTERNAL_SERVER_ERROR` | 500 |

Every message starts with "PLATO is temporarily unavailable". Upstream text is
never sent to the client. `AshaPanel` shows an unavailable card that keeps the
question and offers Retry (`shared/ashaPanelMachine.ts`).
`AshaIntelligenceBrief` already shows "Interpretation temporarily unavailable".
The dashboard greeting shows an unavailable line instead of a canned reading.

## Logs

One `[PLATO] model call` line per attempt: provider, model, task type
(`FAST`/`FALLBACK`), attempt number, latency, success, error class, HTTP
status, fallback reason, token counts, timestamp, and on failure a redacted,
240-character upstream status summary. No prompt, question, history, page
context, answer, key or gateway URL. On total failure, `[PLATO] ask
unavailable` logs the reason and the per-attempt model/class list.
