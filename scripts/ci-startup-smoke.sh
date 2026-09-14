#!/usr/bin/env bash
set -euo pipefail

# Startup smoke: the production server must listen without STRIPE_SECRET_KEY.
# Billing stays unavailable; process boot must not crash on a missing Stripe secret.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4010}"
LOG_FILE="${TMPDIR:-/tmp}/faultline-startup-smoke.log"
PID=""

cleanup() {
  if [[ -n "${PID}" ]] && kill -0 "${PID}" 2>/dev/null; then
    kill "${PID}" 2>/dev/null || true
    wait "${PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ ! -f "${ROOT}/dist/index.js" ]]; then
  echo "dist/index.js is missing — run the production build before startup smoke" >&2
  exit 1
fi

unset STRIPE_SECRET_KEY
export STRIPE_SECRET_KEY=""
export NODE_ENV="${NODE_ENV:-production}"
export PORT

echo "Starting FAULTLINE on port ${PORT} without STRIPE_SECRET_KEY"
node "${ROOT}/dist/index.js" >"${LOG_FILE}" 2>&1 &
PID="$!"

for _ in $(seq 1 60); do
  if ! kill -0 "${PID}" 2>/dev/null; then
    echo "Server exited before listen" >&2
    cat "${LOG_FILE}" >&2 || true
    exit 1
  fi
  if grep -q "Server running on http://0.0.0.0:${PORT}/" "${LOG_FILE}"; then
    health_ok=0
    for _ in $(seq 1 10); do
      if curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null | grep -q '"ok":true'; then
        health_ok=1
        break
      fi
      sleep 0.2
    done
    if [[ "${health_ok}" -ne 1 ]]; then
      echo "Listen succeeded but GET /api/health failed" >&2
      cat "${LOG_FILE}" >&2 || true
      exit 1
    fi
    echo "Startup smoke passed: server listened on 0.0.0.0 without STRIPE_SECRET_KEY; /api/health ok"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for listen" >&2
cat "${LOG_FILE}" >&2 || true
exit 1
