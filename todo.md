
## 2026-10-16 — Intelligence Core Phase 1 Readiness & Phase 2 Preparation
- [x] Verify the Phase 0 Integrity Gate, Phase 1 evidence contract, canonical boundary adapter, authenticated `intelligenceEvidence.current` endpoint, feature flag, append-only `marketMemory` store, branch, commit, and regression status without rebuilding working components.
- [x] Perform read-only/safely isolated provider, feature-flag, persistence, deployed-commit, and source-timestamp checks. Explicitly distinguish local adapter evidence from production runtime evidence and retain unavailable/stale source states without synthetic values.
- [x] Document the exact production-access blocker: the existing Railway API connector has an encrypted project token but is disabled, so Railway runtime, database readback, provider environment presence, and deployment logs remain inaccessible.
- [x] Prepare Phase 2 NOW-page visual architecture: a feature-gated, accessible constellation and evidence drawer that consumes only validated server evidence and has no automatic event claims or AI-generated market conclusions.
- [ ] Enable the existing Railway API connector only with owner authorization, then run read-only production service, deployment, variable-name, database connectivity, and append-only `marketMemory` read/write verification. Do not deploy, enable either feature flag, mutate credentials, or modify production data without separate approval.
- [ ] Implement Phase 1.1 CoinGecko `updated_at` propagation and a reviewed session-aware Yahoo freshness policy before any Phase 2 visual activation.
