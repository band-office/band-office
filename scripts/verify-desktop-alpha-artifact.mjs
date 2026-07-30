import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] ?? "dist-desktop");

async function exists(target) {
  return access(target).then(() => true).catch(() => false);
}

async function findDirectory(parent, predicate) {
  const entries = await readdir(parent, { withFileTypes: true });
  const match = entries.find((entry) => entry.isDirectory() && predicate(entry.name));
  return match ? path.join(parent, match.name) : null;
}

let resourcesDirectory;
if (process.platform === "darwin") {
  const unpacked = await findDirectory(outputDirectory, (name) => name === "mac" || name.startsWith("mac-"));
  assert.ok(unpacked, "No unpacked macOS application directory was found.");
  resourcesDirectory = path.join(unpacked, "Band Office.app", "Contents", "Resources");
} else if (process.platform === "win32") {
  resourcesDirectory = path.join(outputDirectory, "win-unpacked", "resources");
} else {
  throw new Error("Desktop alpha artifact verification supports macOS and Windows.");
}

const asarPath = path.join(resourcesDirectory, "app.asar");
const licensePath = path.join(resourcesDirectory, "legal", "LICENSE");
const noticePath = path.join(resourcesDirectory, "legal", "NOTICE");

for (const target of [asarPath, licensePath, noticePath]) {
  assert.equal(await exists(target), true, `Packaged release is missing ${path.relative(resourcesDirectory, target)}.`);
  assert.ok((await stat(target)).size > 0, `Packaged release file is empty: ${target}`);
}

const license = await readFile(licensePath, "utf8");
const notice = await readFile(noticePath, "utf8");
assert.match(license, /Apache License[\s\S]*Version 2\.0/);
assert.match(notice, /Band Office[\s\S]*Copyright 2026 Joshua Bloodworth/);
assert.match(notice, /Inter[\s\S]*SIL Open Font License 1\.1/);
assert.match(notice, /libvips[\s\S]*LGPL-3\.0-or-later/);

console.log(`Desktop alpha artifact verified: application archive and legal files are present under ${resourcesDirectory}.`);
