import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "release-assets");
const tag = process.env.GITHUB_REF_NAME;
const commit = process.env.GITHUB_SHA;
assert.ok(tag, "GITHUB_REF_NAME is required.");
assert.ok(commit, "GITHUB_SHA is required.");

const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (entry.name !== "Band-Office-RELEASE-MANIFEST.json") {
      const contents = await readFile(absolute);
      files.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes: (await stat(absolute)).size,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  }
}

await collect(root);
files.sort((left, right) => left.path.localeCompare(right.path));

function requiredFile(suffix, message) {
  const matches = files.filter((file) => file.path.endsWith(suffix));
  assert.equal(matches.length, 1, message);
  return matches[0];
}

const macArmDmg = requiredFile("-mac-arm64.dmg", "Release assets must contain exactly one Apple Silicon macOS DMG.");
const macArmZip = requiredFile("-mac-arm64.zip", "Release assets must contain exactly one Apple Silicon macOS ZIP.");
const macIntelDmg = requiredFile("-mac-x64.dmg", "Release assets must contain exactly one Intel macOS DMG.");
const macIntelZip = requiredFile("-mac-x64.zip", "Release assets must contain exactly one Intel macOS ZIP.");
const windowsInstaller = requiredFile(".exe", "Release assets must contain exactly one Windows installer.");
const windowsZip = requiredFile("-win-x64.zip", "Release assets must contain exactly one Windows ZIP.");
const macArmChecksums = requiredFile("SHA256SUMS-macos-arm64.txt", "Release assets must contain the Apple Silicon macOS checksum file.");
const macIntelChecksums = requiredFile("SHA256SUMS-macos-x64.txt", "Release assets must contain the Intel macOS checksum file.");
const windowsChecksums = requiredFile("SHA256SUMS-windows.txt", "Release assets must contain the Windows checksum file.");

async function verifyChecksums(checksumFile, targets) {
  const contents = await readFile(path.join(root, checksumFile.path), "utf8");
  const checksums = new Map();
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    assert.ok(match, `Malformed checksum line in ${checksumFile.path}: ${line}`);
    checksums.set(path.basename(match[2].trim()), match[1].toLowerCase());
  }
  for (const target of targets) {
    const name = path.basename(target.path);
    assert.equal(checksums.get(name), target.sha256, `${checksumFile.path} does not match ${name}.`);
  }
}

await verifyChecksums(macArmChecksums, [macArmDmg, macArmZip]);
await verifyChecksums(macIntelChecksums, [macIntelDmg, macIntelZip]);
await verifyChecksums(windowsChecksums, [windowsInstaller, windowsZip]);

const manifest = {
  schemaVersion: 1,
  product: "Band Office Desktop",
  channel: "alpha",
  tag,
  commit,
  generatedAt: new Date().toISOString(),
  files,
};

const output = path.join(root, "Band-Office-RELEASE-MANIFEST.json");
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest written with ${files.length} files: ${output}`);
