import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist-server");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.env.GITHUB_REF_NAME;
const commit = process.env.GITHUB_SHA;
const imageName = process.env.BAND_OFFICE_IMAGE_NAME;
const imageDigest = process.env.BAND_OFFICE_IMAGE_DIGEST;

assert.ok(tag, "GITHUB_REF_NAME is required.");
assert.ok(commit && /^[a-f0-9]{40}$/i.test(commit), "GITHUB_SHA must be a 40-character commit.");
assert.equal(imageName, "ghcr.io/band-office/band-office-server", "Unexpected Server image name.");
assert.ok(/^sha256:[a-f0-9]{64}$/.test(imageDigest ?? ""), "BAND_OFFICE_IMAGE_DIGEST must be a SHA-256 image digest.");

const archiveName = `Band-Office-Server-${packageJson.version}.zip`;
const archivePath = path.join(root, archiveName);
const checksumsPath = path.join(root, "SHA256SUMS.txt");
const archiveBytes = await readFile(archivePath);
const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex");
const checksums = await readFile(checksumsPath, "utf8");
assert.match(checksums, new RegExp(`^${archiveSha256}\\s+${archiveName}$`, "m"), "Server checksum file does not match the operator archive.");

const manifest = {
  schemaVersion: 1,
  product: "Band Office Server",
  channel: "server-alpha",
  tag,
  commit,
  generatedAt: new Date().toISOString(),
  image: {
    name: imageName,
    digest: imageDigest,
    reference: `${imageName}@${imageDigest}`,
    platforms: ["linux/amd64", "linux/arm64"],
    attestations: ["github-build-provenance", "oci-sbom"],
  },
  operatorBundle: {
    path: archiveName,
    bytes: (await stat(archivePath)).size,
    sha256: archiveSha256,
  },
};

const output = path.join(root, "Band-Office-Server-RELEASE-MANIFEST.json");
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Server release manifest written: ${output}`);
