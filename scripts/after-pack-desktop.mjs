import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const unusedPrivacyDescriptions = [
  "NSAudioCaptureUsageDescription",
  "NSBluetoothAlwaysUsageDescription",
  "NSBluetoothPeripheralUsageDescription",
  "NSMicrophoneUsageDescription",
];

async function nativeFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await nativeFiles(absolute, base));
    else if (entry.name.endsWith(".node")) files.push(path.relative(base, absolute));
  }
  return files;
}

export default async function afterPack(context) {
  const applicationDirectory = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
    : null;
  if (context.electronPlatformName === "darwin") {
    const infoPlist = path.join(applicationDirectory, "Contents", "Info.plist");
    for (const key of unusedPrivacyDescriptions) await execFileAsync("/usr/bin/plutil", ["-remove", key, infoPlist]);
  }

  const resourcesDirectory = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  const appDirectory = context.packager.config.asar === false ? "app" : "app.asar.unpacked";
  const aliasesDirectory = path.join(resourcesDirectory, "app-runtime", "server", ".next", "node_modules");
  const aliases = await readdir(aliasesDirectory).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  const aliasFor = (packageName) => {
    const alias = aliases.find((entry) => entry.startsWith(`${packageName}-`));
    return alias ? path.join(aliasesDirectory, alias) : null;
  };
  const destinations = {
    argon2: [
      path.join(resourcesDirectory, "app-runtime", "server", "runtime-modules", "argon2"),
      aliasFor("argon2"),
    ],
    "better-sqlite3": [
      path.join(resourcesDirectory, appDirectory, "node_modules", "better-sqlite3"),
      path.join(resourcesDirectory, "app-runtime", "server", "runtime-modules", "better-sqlite3"),
      aliasFor("better-sqlite3"),
    ],
  };
  for (const packageName of Object.keys(destinations)) {
    const source = path.resolve("node_modules", packageName);
    for (const relative of await nativeFiles(source)) {
      for (const destination of destinations[packageName].filter(Boolean)) {
        await mkdir(path.dirname(path.join(destination, relative)), { recursive: true });
        await copyFile(path.join(source, relative), path.join(destination, relative));
      }
      console.log(`  • installed Electron-native ${packageName}/${relative}`);
    }
  }
  if (applicationDirectory) await execFileAsync("/usr/bin/xattr", ["-cr", applicationDirectory]);
}
