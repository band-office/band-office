import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { signAsync } from "@electron/osx-sign";

const execFileAsync = promisify(execFile);

export default async function signMacAdHoc(options) {
  await execFileAsync("/usr/bin/xattr", ["-cr", options.app]);
  await signAsync({
    ...options,
    identity: "-",
    optionsForFile(filePath) {
      return {
        entitlements: filePath === options.app
          ? path.resolve("desktop/entitlements.mac.adhoc.plist")
          : path.resolve("desktop/entitlements.mac.inherit.adhoc.plist"),
      };
    },
  });
}
