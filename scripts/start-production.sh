#!/usr/bin/env bash
# Container start path. Docker and Railway boot this script, then the server.
# The deploy guard runs only when FAULTLINE_ENFORCE_DEPLOY_GUARD=1.
# Leaving that unset keeps a boot working when the external allowlist is absent.
# When the flag is on, a missing SHA is a clear refusal, not an ambiguous crash.
# RAILWAY_GIT_COMMIT_SHA wins over FAULTLINE_DEPLOY_SHA. A mismatch refuses the boot.
# FAULTLINE_APPROVED_SHA, when set, must equal RAILWAY_GIT_COMMIT_SHA.
# Tag mode needs a git checkout. An image without .git must use SHAs.
# config/approved-production-commits.txt is not an allowlist and is not read.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${FAULTLINE_ENFORCE_DEPLOY_GUARD:-}" == "1" ]]; then
  bash scripts/guard-approved-deploy.sh
else
  echo "Deploy guard is on the start path and is not enforced. Set FAULTLINE_ENFORCE_DEPLOY_GUARD=1 plus FAULTLINE_APPROVED_SHA equal to RAILWAY_GIT_COMMIT_SHA before treating a boot as an approved deploy." >&2
fi

exec node dist/index.js
