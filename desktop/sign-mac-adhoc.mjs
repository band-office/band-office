import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { signAsync } from "@electron/osx-sign";

const execFileAsync = promisify(execFile);

export default async function signMacAdHoc(options) {
  await execFileAsync("/usr/bin/xattr", ["-cr", options.app]);
  await signAsync({ ...options, identity: "-" });
}
