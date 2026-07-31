import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const findings = [];

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const compose = await text("deploy/server/compose.yml");
const caddy = await text("deploy/server/Caddyfile");
const dockerfile = await text("Dockerfile");
const dockerignore = await text(".dockerignore");
const entrypoint = await text("scripts/docker-entrypoint.sh");
const worker = await text("scripts/run-server-worker.mjs");
const health = await text("src/app/api/health/route.ts");
const authThrottle = await text("src/lib/auth-throttle.ts");
const deployment = await text("docs/deployment/SERVER_DEPLOYMENT.md");
const backupRestore = await text("docs/deployment/SERVER_BACKUP_RESTORE.md");
const composeAcceptance = await text("scripts/test-server-compose.sh");

function composeServiceBlock(name) {
  const match = compose.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:\\n|^secrets:|^networks:|(?![\\s\\S]))`, "m"));
  return match?.[0] ?? "";
}

for (const required of [
  "LICENSE",
  "NOTICE",
  "docs/release/SERVER_ALPHA_RELEASE.md",
  "docs/deployment/SERVER_DEPLOYMENT.md",
  "docs/deployment/SERVER_OPERATOR_HANDOFF.md",
  "docs/deployment/PORTAL_ACTIVATION.md",
  "docs/deployment/SERVER_BACKUP_RESTORE.md",
  "docs/deployment/SERVER_UPGRADE.md",
  "docs/deployment/SERVER_SUPPORT_BOUNDARY.md",
  "docs/release/SERVER_ACCEPTANCE_RECORD.md",
  "deploy/server/.env.example",
  "deploy/server/secrets/README.md",
]) {
  await text(required).catch(() => findings.push(`Missing server release file: ${required}`));
}

if (!compose.includes('image: "${BAND_OFFICE_IMAGE:?')) findings.push("Compose does not require an explicit versioned Band Office image.");
if (/^    ports:/m.test(composeServiceBlock("app"))) findings.push("The application service publishes a host port.");
if (/^    ports:/m.test(composeServiceBlock("worker"))) findings.push("The worker service publishes a host port.");
if (!compose.includes('file: ./secrets/worker-token.txt')) findings.push("Compose does not mount the worker token as a secret.");
if (!compose.includes('file: ./secrets/smtp-password.txt')) findings.push("Compose does not mount the SMTP password as a secret.");
if (!compose.includes("condition: service_healthy")) findings.push("Server services do not wait for application health.");
if (!compose.includes('BANDOS_LOAD_DEMO: "false"')) findings.push("The production deployment does not force demo seeding off.");
if (!compose.includes('caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648')) findings.push("The Caddy image is not pinned to the reviewed multi-platform digest.");
if (!composeServiceBlock("worker").includes("    healthcheck:\n      disable: true")) findings.push("The non-HTTP worker inherits an invalid image health check.");
for (const service of ["app", "worker"]) {
  const block = composeServiceBlock(service);
  if (!block.includes("    cap_drop:\n      - ALL")) findings.push(`The ${service} service does not drop Linux capabilities.`);
}

for (const marker of [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "Permissions-Policy",
  "reverse_proxy app:3000",
  "@notCalendarEmbed",
  "admin off",
  "http://{$BAND_OFFICE_HOSTNAME}",
  "header -Server",
]) {
  if (!caddy.includes(marker)) findings.push(`Caddyfile is missing ${marker}.`);
}
if (caddy.includes("\n\tlog ")) findings.push("Caddy access logging is enabled and may retain private calendar bearer URLs.");

if (!dockerfile.includes('ENTRYPOINT ["./scripts/docker-entrypoint.sh"]')) findings.push("The image does not use the secret-aware entrypoint.");
if (!dockerfile.includes("AS build") || !dockerfile.includes("AS runtime")) findings.push("The image is not a multi-stage runtime build.");
if (!dockerfile.includes("node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d")) findings.push("The Node base image is not pinned to the reviewed multi-platform digest.");
if (!dockerfile.includes("npm prune --omit=dev --ignore-scripts")) findings.push("The runtime image does not prune development dependencies.");
if (!dockerfile.includes("npm pkg delete devDependencies.prisma")) findings.push("The runtime image may retain the unused Prisma CLI and database-driver dependency chain.");
if (!dockerfile.includes("rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack")) findings.push("The runtime image retains the unused npm and Corepack package-manager trees.");
if (!dockerfile.includes("rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack")) findings.push("The runtime image retains unused package-manager commands.");
if (!dockerfile.includes(".next/standalone/server.js") && !entrypoint.includes(".next/standalone/server.js")) findings.push("The runtime image does not start the Next.js standalone server.");
if (!dockerfile.includes("USER 10001:10001")) findings.push("The runtime image does not run as the non-root Band Office user.");
for (const label of ["org.opencontainers.image.source", "org.opencontainers.image.licenses", "org.opencontainers.image.revision"]) {
  if (!dockerfile.includes(label)) findings.push(`The runtime image is missing OCI label ${label}.`);
}
for (const excluded of ["node_modules", "data", "dist-desktop", ".git"]) {
  if (!dockerignore.split(/\r?\n/).includes(excluded)) findings.push(`.dockerignore does not exclude ${excluded}.`);
}
if (!entrypoint.includes("BANDOS_SMTP_PASSWORD_FILE") && !entrypoint.includes("load_secret BANDOS_SMTP_PASSWORD")) findings.push("The entrypoint does not load the SMTP secret.");
if (!entrypoint.includes("load_secret BANDOS_WORKER_TOKEN")) findings.push("The entrypoint does not load the worker secret.");
if (!worker.includes("/api/internal/communications/worker")) findings.push("The server worker does not call the internal communication route.");
if (!health.includes('SELECT 1')) findings.push("The health endpoint does not verify database availability.");
if (!authThrottle.includes("FAILURE_LIMIT = 10") || !authThrottle.includes("identifierHash")) findings.push("Internet-facing login throttling is missing or unbounded.");

for (const marker of [
  "sudo chown 10001:10001 data secrets/worker-token.txt secrets/smtp-password.txt",
  "sudo chmod 400 secrets/worker-token.txt secrets/smtp-password.txt",
  "File-backed Docker Compose secrets retain their host ownership on Linux",
]) {
  if (!deployment.includes(marker)) findings.push(`Server deployment instructions are missing the non-root secret ownership marker: ${marker}`);
}
for (const marker of [
  'sudo tar -czf "$backup" data',
  'sudo chown "$(id -u):$(id -g)" "$backup"',
  "sudo chown -R 10001:10001 data",
]) {
  if (!backupRestore.includes(marker)) findings.push(`Server backup instructions are missing the protected-data marker: ${marker}`);
}
for (const marker of [
  "sudo chown 10001:10001 data secrets/worker-token.txt secrets/smtp-password.txt",
  '"${compose[@]}" up -d --wait app',
  '"${compose[@]}" up -d worker',
  'sudo tar -czf "$backup" data',
  "sudo chown -R 10001:10001 data",
]) {
  if (!composeAcceptance.includes(marker)) findings.push(`Server Compose acceptance is missing the operator-path marker: ${marker}`);
}

const composeResult = spawnSync(
  "docker",
  ["compose", "-f", "deploy/server/compose.yml", "config", "--quiet"],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ACME_EMAIL: "it@example.org",
      BAND_OFFICE_HOSTNAME: "band.example.org",
      BAND_OFFICE_IMAGE: "ghcr.io/example/band-office:0.1.0",
      BAND_OFFICE_TIMEZONE: "America/New_York",
    },
  },
);
if (composeResult.error?.code !== "ENOENT" && composeResult.status !== 0) {
  findings.push(`Docker Compose rejected the server configuration: ${(composeResult.stderr || composeResult.stdout).trim()}`);
}

const migrationWorkDirectory = await mkdtemp(path.join(tmpdir(), "band-office-server-migrations-"));
try {
  const databasePath = path.join(migrationWorkDirectory, "bandos.db");
  const migrationResult = spawnSync(
    process.execPath,
    ["scripts/deploy-sqlite-migrations.mjs"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    },
  );
  if (migrationResult.status !== 0) {
    findings.push(`The server migration runner failed on a new database: ${(migrationResult.stderr || migrationResult.stdout).trim()}`);
  } else {
    const database = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      const expectedMigrations = (await readdir(path.join(root, "prisma/migrations"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory()).length;
      const appliedMigrations = database.prepare('SELECT COUNT(*) AS count FROM "_bandos_desktop_migrations"').get().count;
      const throttleTable = database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'AuthenticationThrottle'").get().count;
      if (database.pragma("integrity_check", { simple: true }) !== "ok") findings.push("Fresh server migration database failed SQLite integrity checking.");
      if (database.pragma("foreign_key_check").length) findings.push("Fresh server migration database failed foreign-key checking.");
      if (appliedMigrations !== expectedMigrations) findings.push(`Fresh server migration applied ${appliedMigrations} of ${expectedMigrations} migrations.`);
      if (throttleTable !== 1) findings.push("Fresh server migration omitted AuthenticationThrottle.");
    } finally {
      database.close();
    }
  }
} finally {
  await rm(migrationWorkDirectory, { recursive: true, force: true });
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`Server bundle verification passed${composeResult.error?.code === "ENOENT" ? " (Docker Compose unavailable; static checks only)" : " including Docker Compose parsing"}.`);
