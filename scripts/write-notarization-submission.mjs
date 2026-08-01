import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

function option(name) {
  const index = process.argv.indexOf(name);
  assert.notEqual(index, -1, `Missing ${name}.`);
  const value = process.argv[index + 1];
  assert.ok(value && !value.startsWith("--"), `Missing value for ${name}.`);
  return value;
}

const output = option("--output");
const responsePath = option("--response");
const tag = option("--tag");
const commit = option("--commit");
const arch = option("--arch");
const archive = option("--archive");
const sha256 = option("--sha256");

assert.match(tag, /^v\d+\.\d+\.\d+-alpha\.[1-9]\d*$/, "Notarization metadata must use a Desktop alpha tag.");
assert.match(commit, /^[a-f0-9]{40}$/i, "Notarization metadata must contain a full source commit SHA.");
assert.ok(["arm64", "x64"].includes(arch), "Notarization metadata architecture must be arm64 or x64.");
assert.match(archive, /^Band-Office-[A-Za-z0-9._-]+-mac-(?:arm64|x64)-pending-notarization\.zip$/, "Notarization archive name is invalid.");
assert.match(sha256, /^[a-f0-9]{64}$/i, "Notarization archive must have a SHA-256 digest.");

const response = JSON.parse(await readFile(responsePath, "utf8"));
assert.equal(typeof response.id, "string", "Apple did not return a notarization submission ID.");
assert.match(response.id, /^[A-Za-z0-9-]+$/, "Apple returned an invalid notarization submission ID.");

const submission = {
  schemaVersion: 1,
  tag,
  commit: commit.toLowerCase(),
  arch,
  submissionId: response.id,
  submittedAt: new Date().toISOString(),
  archive,
  sha256: sha256.toLowerCase(),
};

await writeFile(output, `${JSON.stringify(submission, null, 2)}\n`);
console.log(`Notarization submission metadata written: ${output}`);
