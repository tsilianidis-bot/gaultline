#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/dist/execution-report.md"
mkdir -p "${ROOT}/dist"

COMMIT="${GITHUB_SHA:-unknown}"
REF="${GITHUB_REF_NAME:-unknown}"
RUN_ID="${GITHUB_RUN_ID:-unknown}"

cat >"${OUT}" <<EOF
# FAULTLINE Execution Report

- Commit: \`${COMMIT}\`
- Ref: \`${REF}\`
- GitHub Actions run: \`${RUN_ID}\`

## Proven automatically by CI before this report

- dependency install from the locked package graph
- TypeScript typecheck
- production build
- Vitest suite
- production startup without Stripe secret
- \`GET /api/health\` startup smoke
- build identity artifact

## Do not repeat in Work

The checks above are deterministic CI responsibilities. A Work session should not be used merely to rerun them.

## Route failures

- Source, typecheck, build, test, or startup failure -> Grok/Codex repository repair, then rerun CI.
- Strategy, interpretation, requirements, or prioritization -> Chat.
- Authenticated visual/browser proof that CI does not cover -> batch in \`WORK_QUEUE.md\` and run once against an exact build.

## Work-only boundary

Consult \`WORK_QUEUE.md\`. Work is reserved for logged-in graphical QA, visual judgment, cross-route interaction, or external multi-app workflows that cannot be proven safely in CI.
EOF

echo "Wrote ${OUT}"
