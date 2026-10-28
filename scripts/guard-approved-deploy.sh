#!/usr/bin/env bash
# Refuse a Railway start whose commit is not in config/approved-production-commits.txt.
# No-ops unless this process is a Railway boot or FAULTLINE_ENFORCE_DEPLOY_GUARD=true.
# Does not print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWLIST="${ROOT}/config/approved-production-commits.txt"

if [[ "${FAULTLINE_ENFORCE_DEPLOY_GUARD:-}" != "true" && -z "${RAILWAY_ENVIRONMENT:-}" && -z "${RAILWAY_GIT_COMMIT_SHA:-}" ]]; then
  exit 0
fi

approved="$(grep -E '^[0-9a-f]{40}$' "${ALLOWLIST}" || true)"
if [[ -z "${approved}" ]]; then
  echo "Refusing Railway boot: approved production commit list is empty." >&2
  exit 1
fi

check_one() {
  local label="$1"
  local sha="$2"
  if [[ -z "${sha}" ]]; then
    return 0
  fi
  if ! grep -qx "${sha}" <<< "${approved}"; then
    echo "Refusing Railway boot: ${label} ${sha} is not an approved production commit." >&2
    exit 1
  fi
}

presented=0
if [[ -n "${RAILWAY_GIT_COMMIT_SHA:-}" ]]; then
  presented=1
  check_one "RAILWAY_GIT_COMMIT_SHA" "${RAILWAY_GIT_COMMIT_SHA}"
fi
if [[ -n "${BUILD_COMMIT:-}" ]]; then
  presented=1
  check_one "BUILD_COMMIT" "${BUILD_COMMIT}"
fi
if [[ -f "${ROOT}/dist/build-identity.json" ]]; then
  baked="$(node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (typeof v.commit==="string") process.stdout.write(v.commit.trim());' "${ROOT}/dist/build-identity.json" || true)"
  if [[ -n "${baked}" && "${baked}" != "dev" ]]; then
    presented=1
    check_one "baked build identity" "${baked}"
  fi
fi

if [[ "${presented}" -ne 1 ]]; then
  echo "Refusing Railway boot: no commit identity was presented." >&2
  exit 1
fi
