import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function option(name) {
  const index = process.argv.indexOf(name);
  assert.notEqual(index, -1, `Missing ${name}.`);
  const value = process.argv[index + 1];
  assert.ok(value && !value.startsWith("--"), `Missing value for ${name}.`);
  return value;
}

const input = option("--input");
const expectedTag = option("--tag");
const expectedArch = option("--arch");
const format = process.argv.includes("--format") ? option("--format") : "json";
const submission = JSON.parse(await readFile(input, "utf8"));

assert.equal(submission.schemaVersion, 1, "Unsupported notarization metadata schema.");
assert.equal(submission.tag, expectedTag, "Notarization metadata tag does not match the requested release.");
assert.equal(submission.arch, expectedArch, "Notarization metadata architecture does not match the requested release.");
assert.match(submission.commit ?? "", /^[a-f0-9]{40}$/i, "Notarization metadata must contain a full source commit SHA.");
assert.match(submission.submissionId ?? "", /^[A-Za-z0-9-]+$/, "Notarization metadata submission ID is invalid.");
assert.match(submission.archive ?? "", /^Band-Office-[A-Za-z0-9._-]+-mac-(?:arm64|x64)-pending-notarization\.zip$/, "Notarization metadata archive name is invalid.");
assert.match(submission.sha256 ?? "", /^[a-f0-9]{64}$/i, "Notarization metadata SHA-256 is invalid.");

if (format === "json") {
  console.log(JSON.stringify(submission));
} else if (format === "env") {
  console.log(`NOTARIZATION_SOURCE_COMMIT=${submission.commit.toLowerCase()}`);
  console.log(`NOTARIZATION_SUBMISSION_ID=${submission.submissionId}`);
  console.log(`NOTARIZATION_ARCHIVE=${submission.archive}`);
  console.log(`NOTARIZATION_ARCHIVE_SHA256=${submission.sha256.toLowerCase()}`);
} else {
  throw new Error(`Unsupported output format: ${format}`);
}
