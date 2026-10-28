#!/usr/bin/env bash
# Pre-deploy check. Do not call this from pnpm start or the container entrypoint.
# The allowlist is outside the commit:
#   FAULTLINE_APPROVED_DEPLOY_SHAS   comma/whitespace-separated full SHAs
#   FAULTLINE_APPROVED_DEPLOY_TAGS   git tag names; each peeled commit is allowed
# BUILD_COMMIT is ignored. A stale service variable cannot approve or reject the target.
set -euo pipefail

TARGET="${1:-${FAULTLINE_DEPLOY_SHA:-}}"
if [[ ! "${TARGET}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Refusing pre-deploy check: pass a full lowercase target SHA as FAULTLINE_DEPLOY_SHA or the first argument." >&2
  exit 1
fi

allowfile="$(mktemp)"
trap 'rm -f "${allowfile}"' EXIT

if [[ -n "${FAULTLINE_APPROVED_DEPLOY_SHAS:-}" ]]; then
  normalized="${FAULTLINE_APPROVED_DEPLOY_SHAS//,/ }"
  for token in ${normalized}; do
    if [[ "${token}" =~ ^[0-9a-f]{40}$ ]]; then
      printf '%s\n' "${token}" >> "${allowfile}"
    fi
  done
fi

if [[ -n "${FAULTLINE_APPROVED_DEPLOY_TAGS:-}" ]]; then
  for tag in ${FAULTLINE_APPROVED_DEPLOY_TAGS}; do
    sha="$(git rev-parse "${tag}^{commit}" 2>/dev/null || true)"
    if [[ "${sha}" =~ ^[0-9a-f]{40}$ ]]; then
      printf '%s\n' "${sha}" >> "${allowfile}"
    fi
  done
fi

if [[ ! -s "${allowfile}" ]]; then
  echo "Refusing pre-deploy check: external allowlist is empty. Set FAULTLINE_APPROVED_DEPLOY_SHAS or FAULTLINE_APPROVED_DEPLOY_TAGS." >&2
  exit 1
fi

if grep -qx "${TARGET}" "${allowfile}"; then
  echo "Pre-deploy check passed for ${TARGET}."
  exit 0
fi

echo "Refusing deploy of ${TARGET}: not in the external allowlist." >&2
exit 1
