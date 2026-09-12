#!/usr/bin/env bash
set -euo pipefail

# Writes a durable build-identity artifact for CI verification and deploy audits.
# Does not print secrets. Safe to run in public logs.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-${ROOT}/dist}"
OUT_FILE="${OUT_DIR}/build-identity.json"

mkdir -p "${OUT_DIR}"

COMMIT="${BUILD_COMMIT:-${GITHUB_SHA:-$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)}}"
BRANCH="${BUILD_BRANCH:-${GITHUB_REF_NAME:-$(git -C "${ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}}"
BUILD_TIME="${BUILD_TIME:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
NODE_ENV_VALUE="${NODE_ENV:-production}"
PACKAGE_VERSION="$(node -p "require('${ROOT}/package.json').version" 2>/dev/null || echo unknown)"

cat > "${OUT_FILE}" <<EOF
{
  "name": "faultline",
  "version": "${PACKAGE_VERSION}",
  "commit": "${COMMIT}",
  "branch": "${BRANCH}",
  "buildTime": "${BUILD_TIME}",
  "nodeEnv": "${NODE_ENV_VALUE}"
}
EOF

echo "Wrote build identity to ${OUT_FILE}"
