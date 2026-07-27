#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="${1:-band-office-server:acceptance}"
version="$(node -p "require('${root}/package.json').version")"
work_directory="$(mktemp -d "${TMPDIR:-/tmp}/band-office-compose-acceptance.XXXXXX")"
project="band-office-compose-acceptance-$$"
compose=(docker compose --project-name "$project" --file "$work_directory/compose.yml" --env-file "$work_directory/.env")

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    "${compose[@]}" ps || true
    "${compose[@]}" logs --no-color || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  sudo rm -rf "$work_directory"
  exit "$status"
}
trap cleanup EXIT

cd "$root"
npm run server:bundle -- --image "$image" >/dev/null
cp -R "dist-server/Band-Office-Server-${version}/." "$work_directory/"

cd "$work_directory"
cp .env.example .env
mkdir -p data backups caddy-data caddy-config secrets
chmod 700 data backups caddy-data caddy-config secrets
openssl rand -hex 32 > secrets/worker-token.txt
touch secrets/smtp-password.txt
chmod 600 .env
sudo chown 10001:10001 data secrets/worker-token.txt secrets/smtp-password.txt
sudo chmod 700 data
sudo chmod 400 secrets/worker-token.txt secrets/smtp-password.txt

"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait app
"${compose[@]}" up -d worker
sleep 2
"${compose[@]}" ps --status running --services | grep -qx 'worker'
"${compose[@]}" exec -T app sh -c '
  test "$(id -u)" = "10001"
  test -r /run/secrets/worker_token
  test -r /run/secrets/smtp_password
  test "$(stat -c "%u:%g:%a" /run/secrets/worker_token)" = "10001:10001:400"
'
"${compose[@]}" exec -T app node --input-type=module -e '
  import Database from "better-sqlite3";
  const db = new Database("/data/bandos.db", { readonly: true });
  if (db.pragma("integrity_check", { simple: true }) !== "ok") process.exit(1);
  if (db.prepare(`SELECT COUNT(*) AS count FROM "Program"`).get().count !== 0) process.exit(1);
  db.close();
'

"${compose[@]}" stop worker app
backup="backups/band-office-data-compose-acceptance.tar.gz"
sudo tar -czf "$backup" data
sudo chown "$(id -u):$(id -g)" "$backup"
chmod 600 "$backup"
sha256sum "$backup" > "$backup.sha256"
sha256sum --check "$backup.sha256"
tar -tzf "$backup" > backup-contents.txt
grep -q '^data/bandos.db$' backup-contents.txt

sudo mv data data-before-restore
sudo tar -xzf "$backup"
sudo chown -R 10001:10001 data
sudo chmod 700 data
"${compose[@]}" up -d --wait app
"${compose[@]}" up -d worker
sleep 2
"${compose[@]}" ps --status running --services | grep -qx 'worker'
"${compose[@]}" exec -T app node --input-type=module -e '
  import Database from "better-sqlite3";
  const db = new Database("/data/bandos.db", { readonly: true });
  if (db.pragma("integrity_check", { simple: true }) !== "ok") process.exit(1);
  db.close();
'

echo "Server Compose acceptance passed: packaged configuration, non-root secrets, startup, backup, and restore."
