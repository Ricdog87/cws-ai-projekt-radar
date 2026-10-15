#!/usr/bin/env bash
# Smoke test of one radar instance: ready with a reachable database, expected build, pages served.
# Usage: smoke.sh <base-url> [<commit>]   (waits up to 5 minutes for /api/ready)
set -euo pipefail
base="${1%/}"
want="${2:-}"
want="${want:0:12}"

body=""
for attempt in $(seq 1 30); do
  body=$(curl -sS --max-time 10 "$base/api/ready" 2>/dev/null || true)
  if [[ "$body" == *'"ready":true'* ]] && { [[ -z "$want" ]] || [[ "$body" == *"\"build\":\"$want\""* ]]; }; then
    echo "Ready after $attempt attempt(s): $body"
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "::error::$base/api/ready did not report ready${want:+ with build $want} within 5 minutes. Last answer: ${body:-none}"
    exit 1
  fi
  sleep 10
done

check() { # name, path, required text
  local page
  page=$(curl -fsS --max-time 30 --compressed "$base$2") || { echo "::error::$1 ($2) is not reachable"; exit 1; }
  [[ "$page" == *"$3"* ]] || { echo "::error::$1 ($2) does not contain \"$3\""; exit 1; }
  echo "OK  $1"
}
check "Dashboard" "/" "KI-Projekt-Radar"
check "Request form" "/request" "Anwendungsfall"
check "Health" "/api/health" '"storage":true'

headers=$(curl -fsS --max-time 10 -o /dev/null -D - "$base/")
grep -qi '^content-security-policy:' <<<"$headers" || { echo "::error::Security headers are missing on /"; exit 1; }
echo "OK  Security headers"
echo "Smoke test passed: $base"
