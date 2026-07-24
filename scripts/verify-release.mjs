import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const commands = [
  [npm, ["run", "lint"]],
  [npm, ["test"]],
  [npm, ["run", "build"]],
  [npm, ["run", "desktop:prepare"]],
  [npm, ["run", "test:desktop-runtime"]],
  [npm, ["run", "test:e2e"]],
  [npm, ["run", "audit:release"]],
  [npm, ["run", "audit:tree"]],
];
if (process.env.BANDOS_SKIP_ONLINE_AUDIT !== "1") commands.push([npm, ["run", "audit:dependencies"]]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`)));
  });
}

for (const [command, args] of commands) await run(command, args);
console.log("BandOS v0.1 release verification passed.");
