#!/bin/sh
set -eu

load_secret() {
  variable_name="$1"
  file_variable_name="${variable_name}_FILE"
  eval "file_path=\${$file_variable_name:-}"
  if [ -n "$file_path" ]; then
    if [ ! -r "$file_path" ]; then
      echo "Band Office cannot read the secret file configured by $file_variable_name." >&2
      exit 1
    fi
    secret_value="$(cat "$file_path")"
    export "$variable_name=$secret_value"
  fi
  unset "$file_variable_name"
}

load_secret BANDOS_SMTP_PASSWORD
load_secret BANDOS_WORKER_TOKEN

if [ "${BAND_OFFICE_SERVER_MODE:-false}" = "true" ]; then
  token_length="$(printf %s "${BANDOS_WORKER_TOKEN:-}" | wc -c | tr -d ' ')"
  if [ "$token_length" -lt 32 ]; then
    echo "BANDOS_WORKER_TOKEN must contain at least 32 characters in server mode." >&2
    exit 1
  fi
fi

case "${1:-app}" in
  app)
    export BANDOS_STARTED_AT="${BANDOS_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
    node scripts/deploy-sqlite-migrations.mjs
    node --import tsx scripts/seed-if-empty.ts
    exec node .next/standalone/server.js
    ;;
  worker)
    exec node scripts/run-server-worker.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
