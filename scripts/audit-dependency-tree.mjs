import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  await execFileAsync(npm, ["ls", "--all", "--json"], { maxBuffer: 20 * 1024 * 1024 });
  console.log("Dependency tree audit passed: no missing, invalid, or extraneous packages.");
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
  throw new Error(`Dependency tree audit failed. Run npm ci before building a release.\n${output}`);
}
