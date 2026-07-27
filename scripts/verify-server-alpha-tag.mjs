import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

assert.ok(tag, "Pass a Server alpha tag or set GITHUB_REF_NAME.");
assert.equal(packageJson.private, true, "package.json must remain private; GitHub Releases and GHCR distribute Server.");
assert.equal(packageJson.license, "Apache-2.0", "Server alpha source must remain Apache-2.0.");

const expected = new RegExp(`^v${packageJson.version.replaceAll(".", "\\.")}-server-alpha\\.[1-9][0-9]*$`);
assert.match(tag, expected, `Tag ${tag} must match v${packageJson.version}-server-alpha.<positive number>.`);

const isGitHubTagPush = process.env.GITHUB_ACTIONS === "true"
  && process.env.GITHUB_EVENT_NAME === "push"
  && process.env.GITHUB_REF_TYPE === "tag";

if (isGitHubTagPush) {
  assert.ok(process.env.GITHUB_SHA, "GITHUB_SHA is required in GitHub Actions.");
  execFileSync("git", ["merge-base", "--is-ancestor", process.env.GITHUB_SHA, "origin/main"], { stdio: "inherit" });
}

console.log(`Server alpha tag verified: ${tag} matches package version ${packageJson.version}.`);
