import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const root = path.resolve(process.argv[2] ?? "dist-server");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const bundleName = `Band-Office-Server-${packageJson.version}`;
const bundleDirectory = path.join(root, bundleName);
const archivePath = path.join(root, `${bundleName}.zip`);
const outerChecksumsPath = path.join(root, "SHA256SUMS.txt");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseChecksums(contents) {
  const rows = new Map();
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    assert.ok(match, `Malformed checksum line: ${line}`);
    rows.set(match[2].trim(), match[1].toLowerCase());
  }
  return rows;
}

const archiveBytes = await readFile(archivePath);
assert.ok(archiveBytes.byteLength > 0, "Server operator archive is empty.");
const outerChecksums = parseChecksums(await readFile(outerChecksumsPath, "utf8"));
assert.equal(outerChecksums.get(`${bundleName}.zip`), sha256(archiveBytes), "Outer checksum does not match the Server operator archive.");

const envExample = await readFile(path.join(bundleDirectory, ".env.example"), "utf8");
const imageMatch = envExample.match(/^BAND_OFFICE_IMAGE=(ghcr\.io\/band-office\/band-office-server@sha256:[a-f0-9]{64})$/m);
assert.ok(imageMatch, "Server operator bundle must pin ghcr.io/band-office/band-office-server by SHA-256 digest.");
assert.doesNotMatch(imageMatch[1], /REPLACE_|latest/i);

const requiredFiles = [
  ".env.example",
  "Caddyfile",
  "compose.yml",
  "LICENSE",
  "NOTICE",
  "PORTAL_ACTIVATION.md",
  "SERVER_ACCEPTANCE_RECORD.md",
  "SERVER_ALPHA_RELEASE.md",
  "SERVER_BACKUP_RESTORE.md",
  "SERVER_DEPLOYMENT.md",
  "SERVER_OPERATOR_HANDOFF.md",
  "SERVER_SUPPORT_BOUNDARY.md",
  "SERVER_UPGRADE.md",
  "SHA256SUMS.txt",
  "secrets/README.md",
];
const innerChecksums = parseChecksums(await readFile(path.join(bundleDirectory, "SHA256SUMS.txt"), "utf8"));
for (const filename of requiredFiles.filter((filename) => filename !== "SHA256SUMS.txt")) {
  const bytes = await readFile(path.join(bundleDirectory, filename));
  assert.equal(innerChecksums.get(filename), sha256(bytes), `Bundle checksum does not match ${filename}.`);
}

const zip = await JSZip.loadAsync(archiveBytes);
for (const filename of requiredFiles) {
  const entry = zip.file(`${bundleName}/${filename}`);
  assert.ok(entry, `Server operator archive is missing ${filename}.`);
  const archivedBytes = await entry.async("nodebuffer");
  const diskBytes = await readFile(path.join(bundleDirectory, filename));
  assert.equal(sha256(archivedBytes), sha256(diskBytes), `Archived ${filename} differs from the verified bundle directory.`);
}

const topLevel = (await readdir(bundleDirectory, { withFileTypes: true })).map((entry) => entry.name);
assert.ok(topLevel.includes("compose.yml"));
console.log(`Server alpha artifact verified: ${archivePath} pins ${imageMatch[1]} and contains ${requiredFiles.length} required files.`);
