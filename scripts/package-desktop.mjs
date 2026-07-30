import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Desktop packaging must be started through an npm script.");
const builderCli = path.resolve("node_modules/electron-builder/cli.js");
const electronRebuildCli = path.resolve("node_modules/@electron/rebuild/lib/cli.js");
const electronVersion = JSON.parse(await readFile(path.resolve("node_modules/electron/package.json"), "utf8")).version;
const requestedTargets = process.argv.slice(2);
if (!requestedTargets.length) throw new Error("Pass electron-builder targets, for example --dir or --mac dmg zip.");

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for signed Windows packaging.`);
  return value;
}

if (process.env.BANDOS_SIGN_DESKTOP === "1" && requestedTargets.includes("--win")) {
  for (const name of ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"]) requireEnvironment(name);

  const azureSigning = {
    publisherName: requireEnvironment("AZURE_SIGNING_PUBLISHER_NAME"),
    endpoint: requireEnvironment("AZURE_SIGNING_ENDPOINT"),
    certificateProfileName: requireEnvironment("AZURE_SIGNING_CERTIFICATE_PROFILE_NAME"),
    codeSigningAccountName: requireEnvironment("AZURE_SIGNING_ACCOUNT_NAME"),
  };

  if (!azureSigning.endpoint.startsWith("https://")) {
    throw new Error("AZURE_SIGNING_ENDPOINT must be an HTTPS Artifact Signing endpoint.");
  }

  for (const [name, value] of Object.entries(azureSigning)) {
    requestedTargets.push(`--config.win.azureSignOptions.${name}=${value}`);
  }
}

function run(command, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: environment });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${signal ?? code}`)));
  });
}

let nativeModulesRebuilt = false;
try {
  await run(process.execPath, [npmCli, "run", "build"]);
  await run(process.execPath, ["scripts/prepare-desktop-runtime.mjs"]);
  await run(process.execPath, [electronRebuildCli, "-v", electronVersion, "-f", "-w", "argon2", "-w", "better-sqlite3"]);
  nativeModulesRebuilt = true;
  const builderEnvironment = { ...process.env };
  if (process.env.BANDOS_SIGN_DESKTOP !== "1") {
    builderEnvironment.CSC_IDENTITY_AUTO_DISCOVERY = "false";
    if (requestedTargets.includes("--mac")) {
      requestedTargets.push(
        "--config.mac.identity=-",
        "--config.mac.sign=desktop/sign-mac-adhoc.mjs",
        "--config.mac.preAutoEntitlements=false",
        "--config.mac.entitlements=desktop/entitlements.mac.adhoc.plist",
        "--config.mac.entitlementsInherit=desktop/entitlements.mac.inherit.adhoc.plist",
      );
    }
  }
  await run(process.execPath, [builderCli, ...requestedTargets, "--publish", "never", "--config.npmRebuild=false"], builderEnvironment);
} finally {
  if (nativeModulesRebuilt) await run(process.execPath, [npmCli, "rebuild", "argon2", "better-sqlite3"]);
}
