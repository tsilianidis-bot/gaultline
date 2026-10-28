#!/usr/bin/env bash
# Pre-deploy check. The container start script calls this only when
# FAULTLINE_ENFORCE_DEPLOY_GUARD=1. The allowlist is outside the commit:
#   FAULTLINE_APPROVED_DEPLOY_SHAS   comma/whitespace-separated full SHAs
#   FAULTLINE_APPROVED_DEPLOY_TAGS   git tag names; each peeled commit is allowed
# BUILD_COMMIT is ignored. A stale service variable cannot approve or reject the target.
#
# Identity:
#   RAILWAY_GIT_COMMIT_SHA is the platform commit. It wins over FAULTLINE_DEPLOY_SHA.
#   If both are set and differ, the boot is refused. A self-declared SHA cannot
#   impersonate the platform commit.
#   If neither is a full lowercase SHA, the boot is refused with that reason.
#   Tag mode needs a git checkout. An image without .git must use SHAs.
set -euo pipefail

PLATFORM="${RAILWAY_GIT_COMMIT_SHA:-}"
DECLARED="${FAULTLINE_DEPLOY_SHA:-${1:-}}"

if [[ -n "${PLATFORM}" && -n "${DECLARED}" && "${PLATFORM}" != "${DECLARED}" ]]; then
  echo "Refusing boot: RAILWAY_GIT_COMMIT_SHA (${PLATFORM}) does not match FAULTLINE_DEPLOY_SHA (${DECLARED}). The platform commit is the deploy identity. A self-declared SHA cannot override it." >&2
  exit 1
fi

if [[ "${PLATFORM}" =~ ^[0-9a-f]{40}$ ]]; then
  TARGET="${PLATFORM}"
elif [[ "${DECLARED}" =~ ^[0-9a-f]{40}$ ]]; then
  TARGET="${DECLARED}"
else
  echo "Refusing boot: FAULTLINE_ENFORCE_DEPLOY_GUARD=1 and neither RAILWAY_GIT_COMMIT_SHA nor FAULTLINE_DEPLOY_SHA is a full lowercase SHA. This is a clear refusal, not an ambiguous crash." >&2
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
  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Refusing boot: FAULTLINE_APPROVED_DEPLOY_TAGS is set but this runtime has no git checkout. The image does not contain .git, so tags cannot be peeled. Put the approved commit in FAULTLINE_APPROVED_DEPLOY_SHAS." >&2
    exit 1
  fi
  for tag in ${FAULTLINE_APPROVED_DEPLOY_TAGS}; do
    sha="$(git rev-parse "${tag}^{commit}" 2>/dev/null || true)"
    if [[ "${sha}" =~ ^[0-9a-f]{40}$ ]]; then
      printf '%s\n' "${sha}" >> "${allowfile}"
    fi
  done
fi

if [[ ! -s "${allowfile}" ]]; then
  echo "Refusing boot: external allowlist is empty. Set FAULTLINE_APPROVED_DEPLOY_SHAS or FAULTLINE_APPROVED_DEPLOY_TAGS." >&2
  exit 1
fi

if grep -qx "${TARGET}" "${allowfile}"; then
  echo "Pre-deploy check passed for ${TARGET}."
  exit 0
fi

echo "Refusing deploy of ${TARGET}: not in the external allowlist." >&2
exit 1
