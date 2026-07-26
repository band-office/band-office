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
assert.ok(files.some((file) => file.path.endsWith(".dmg")), "Release assets are missing the macOS DMG.");
assert.ok(files.some((file) => file.path.endsWith("-mac-arm64.zip")), "Release assets are missing the macOS ZIP.");
assert.ok(files.some((file) => file.path.endsWith(".exe")), "Release assets are missing the Windows installer.");
assert.ok(files.some((file) => file.path.endsWith("-win-x64.zip")), "Release assets are missing the Windows ZIP.");

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
