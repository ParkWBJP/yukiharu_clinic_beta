#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LOG_FILE="$SCRIPT_DIR/codex_history.log"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex_logger.sh: codex command not found" >&2
  exit 127
fi

if [ "$#" -gt 0 ]; then
  request="$*"
else
  if [ -t 0 ]; then
    echo "Usage: $0 \"<request>\"" >&2
    exit 64
  fi
  request="$(cat)"
fi

if [ -f "$LOG_FILE" ]; then
  context="$(tail -n 100 "$LOG_FILE")"
else
  context=""
fi

if [ -n "$context" ]; then
  # Prepend recent history to maintain conversational context for the next call.
  prompt="Context (last 100 lines):\n$context\n\nRequest:\n$request"
else
  prompt="$request"
fi

tmp_response=$(mktemp)
cleanup() {
  rm -f "$tmp_response"
}
trap cleanup EXIT

status=0
if ! printf '%s\n' "$prompt" | codex | tee "$tmp_response"; then
  status=$?
fi

response="$(cat "$tmp_response")"

{
  printf '===== %s =====\n' "$(date -Is)"
  printf 'Request:\n%s\n' "$request"
  printf 'Response (exit %d):\n%s\n\n' "$status" "$response"
} >> "$LOG_FILE"

exit "$status"
