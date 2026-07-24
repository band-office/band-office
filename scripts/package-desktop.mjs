import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const builder = path.resolve("node_modules/.bin", process.platform === "win32" ? "electron-builder.cmd" : "electron-builder");
const electronRebuild = path.resolve("node_modules/.bin", process.platform === "win32" ? "electron-rebuild.cmd" : "electron-rebuild");
const electronVersion = JSON.parse(await readFile(path.resolve("node_modules/electron/package.json"), "utf8")).version;
const requestedTargets = process.argv.slice(2);
if (!requestedTargets.length) throw new Error("Pass electron-builder targets, for example --dir or --mac dmg zip.");

function run(command, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: environment });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${signal ?? code}`)));
  });
}

let nativeModulesRebuilt = false;
try {
  await run(npm, ["run", "build"]);
  await run(process.execPath, ["scripts/prepare-desktop-runtime.mjs"]);
  await run(electronRebuild, ["-v", electronVersion, "-f", "-w", "argon2", "-w", "better-sqlite3"]);
  nativeModulesRebuilt = true;
  const builderEnvironment = { ...process.env };
  if (process.env.BANDOS_SIGN_DESKTOP !== "1") builderEnvironment.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  await run(builder, [...requestedTargets, "--publish", "never", "--config.npmRebuild=false"], builderEnvironment);
} finally {
  if (nativeModulesRebuilt) await run(npm, ["rebuild", "argon2", "better-sqlite3"]);
}
