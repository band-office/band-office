import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const image = process.argv[2] ?? process.env.BAND_OFFICE_SERVER_IMAGE ?? "band-office-server:acceptance";
const containerName = `band-office-server-acceptance-${process.pid}`;
const workDirectory = await mkdtemp(path.join(tmpdir(), "band-office-server-acceptance-"));
const dataDirectory = path.join(workDirectory, "data");
const workerToken = "server-acceptance-worker-token-0123456789abcdef";

async function docker(args, options = {}) {
  return execFileAsync("docker", args, { encoding: "utf8", ...options });
}

function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
}

async function mappedOrigin() {
  const portResult = await docker(["port", containerName, "3000/tcp"]);
  const portMatch = portResult.stdout.trim().match(/:(\d+)$/);
  assert.ok(portMatch, `Could not determine mapped container port: ${portResult.stdout}`);
  return `http://127.0.0.1:${portMatch[1]}`;
}

async function waitForHealth(origin) {
  let lastError;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await request(`${origin}/api/health`);
      if (response.ok && (await response.json()).status === "ok") return;
      lastError = new Error(`Health returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw lastError ?? new Error("Server container did not become healthy.");
}

try {
  await mkdir(dataDirectory);
  await chmod(dataDirectory, 0o777);
  await docker([
    "run",
    "--detach",
    "--name", containerName,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true",
    "--env", "BAND_OFFICE_SERVER_MODE=true",
    "--env", "BANDOS_LOAD_DEMO=false",
    "--env", `BANDOS_WORKER_TOKEN=${workerToken}`,
    "--env", "DATABASE_URL=file:/data/bandos.db",
    "--env", "HOSTNAME=0.0.0.0",
    "--env", "NEXT_TELEMETRY_DISABLED=1",
    "--env", "NODE_ENV=production",
    "--env", "PORT=3000",
    "--env", "TZ=UTC",
    "--publish", "127.0.0.1::3000",
    "--volume", `${dataDirectory}:/data`,
    image,
  ]);
  let origin = await mappedOrigin();
  await waitForHealth(origin);

  const user = await docker(["exec", containerName, "id", "-u"]);
  assert.equal(user.stdout.trim(), "10001", "Server container must run as the non-root Band Office user.");
  await assert.rejects(
    docker(["exec", containerName, "npm", "--version"]),
    "Server runtime must not include the unused npm CLI.",
  );

  const login = await request(`${origin}/login`);
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Create the director account/);
  assert.doesNotMatch(loginHtml, /Ridgeline Middle School/);

  const portal = await request(`${origin}/portal/login`);
  assert.equal(portal.status, 200);
  assert.match(await portal.text(), /Student and guardian portal/);

  const rejectedWorker = await request(`${origin}/api/internal/communications/worker`, {
    method: "POST",
    headers: { authorization: "Bearer invalid-worker-token" },
  });
  assert.equal(rejectedWorker.status, 403);
  const acceptedWorker = await request(`${origin}/api/internal/communications/worker`, {
    method: "POST",
    headers: { authorization: `Bearer ${workerToken}` },
  });
  assert.equal(acceptedWorker.status, 200);
  assert.deepEqual(await acceptedWorker.json(), { processed: 0 });

  const databaseState = await docker([
    "exec",
    containerName,
    "node",
    "--input-type=module",
    "-e",
    `import Database from "better-sqlite3";
const db = new Database("/data/bandos.db", { readonly: true });
const state = {
  integrity: db.pragma("integrity_check", { simple: true }),
  foreignKeys: db.pragma("foreign_key_check").length,
  programs: db.prepare('SELECT COUNT(*) AS count FROM "Program"').get().count,
  migrations: db.prepare('SELECT COUNT(*) AS count FROM "_bandos_desktop_migrations"').get().count,
};
db.close();
console.log(JSON.stringify(state));`,
  ]);
  const state = JSON.parse(databaseState.stdout.trim());
  assert.equal(state.integrity, "ok");
  assert.equal(state.foreignKeys, 0);
  assert.equal(state.programs, 0, "Fresh Server image must not seed demo or program data.");
  assert.ok(state.migrations > 0);

  await docker(["restart", containerName]);
  origin = await mappedOrigin();
  await waitForHealth(origin);
  const restartedLogin = await request(`${origin}/login`);
  assert.equal(restartedLogin.status, 200);
  assert.match(await restartedLogin.text(), /Create the director account/);

  console.log(`Server container acceptance passed for ${image}: non-root startup, empty first run, portal route, worker authorization, restart, and SQLite checks.`);
} catch (error) {
  const logs = await docker(["logs", containerName]).then((result) => result.stdout + result.stderr).catch(() => "");
  if (logs) console.error(logs);
  throw error;
} finally {
  await docker(["rm", "--force", containerName]).catch(() => undefined);
  await rm(workDirectory, { recursive: true, force: true });
}
