import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
describe("public release preparation", () => {
  test("accepts only alpha tags matching the package version", async () => {
    await expect(execFileAsync(process.execPath, ["scripts/verify-desktop-alpha-tag.mjs", "v0.1.0-alpha.1"])).resolves.toMatchObject({
      stdout: expect.stringContaining("Desktop alpha tag verified"),
    });
    await expect(execFileAsync(process.execPath, ["scripts/verify-desktop-alpha-tag.mjs", "v0.1.1-alpha.1"])).rejects.toThrow();
    await expect(execFileAsync(process.execPath, ["scripts/verify-desktop-alpha-tag.mjs", "v0.1.0"])).rejects.toThrow();
  });

  test("accepts only Server alpha tags matching the package version", async () => {
    await expect(execFileAsync(process.execPath, ["scripts/verify-server-alpha-tag.mjs", "v0.1.0-server-alpha.1"])).resolves.toMatchObject({
      stdout: expect.stringContaining("Server alpha tag verified"),
    });
    await expect(execFileAsync(process.execPath, ["scripts/verify-server-alpha-tag.mjs", "v0.1.1-server-alpha.1"])).rejects.toThrow();
    await expect(execFileAsync(process.execPath, ["scripts/verify-server-alpha-tag.mjs", "v0.1.0-alpha.1"])).rejects.toThrow();
  });

  test("writes a source-bound manifest for all Desktop artifact sets", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "band-office-release-manifest-"));
    temporaryDirectories.push(directory);
    const artifactNames = [
      "Band-Office-0.1.0-mac-arm64.dmg",
      "Band-Office-0.1.0-mac-arm64.zip",
      "Band-Office-0.1.0-mac-x64.dmg",
      "Band-Office-0.1.0-mac-x64.zip",
      "Band-Office-0.1.0-win-x64.exe",
      "Band-Office-0.1.0-win-x64.zip",
    ];
    const hashes = new Map<string, string>();
    for (const name of artifactNames) {
      const contents = `synthetic ${name}`;
      await writeFile(path.join(directory, name), contents);
      hashes.set(name, createHash("sha256").update(contents).digest("hex"));
    }

    await expect(execFileAsync(process.execPath, ["scripts/write-release-manifest.mjs", directory], {
      env: { ...process.env, GITHUB_REF_NAME: "v0.1.0-alpha.1", GITHUB_SHA: "a".repeat(40) },
    })).rejects.toThrow();

    await writeFile(
      path.join(directory, "SHA256SUMS-macos-arm64.txt"),
      artifactNames.slice(0, 2).map((name) => `${hashes.get(name)}  ${name}`).join("\n"),
    );
    await writeFile(
      path.join(directory, "SHA256SUMS-macos-x64.txt"),
      artifactNames.slice(2, 4).map((name) => `${hashes.get(name)}  ${name}`).join("\n"),
    );
    await writeFile(
      path.join(directory, "SHA256SUMS-windows.txt"),
      artifactNames.slice(4).map((name) => `${hashes.get(name)}  ${name}`).join("\n"),
    );

    await execFileAsync(process.execPath, ["scripts/write-release-manifest.mjs", directory], {
      env: { ...process.env, GITHUB_REF_NAME: "v0.1.0-alpha.1", GITHUB_SHA: "a".repeat(40) },
    });

    const manifest = JSON.parse(await readFile(path.join(directory, "Band-Office-RELEASE-MANIFEST.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      product: "Band Office Desktop",
      channel: "alpha",
      tag: "v0.1.0-alpha.1",
      commit: "a".repeat(40),
    });
    expect(manifest.files).toHaveLength(9);
    expect(manifest.files.every((file: { sha256: string }) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });

  test("builds and verifies a digest-pinned Server operator bundle and manifest", async () => {
    const digest = `sha256:${"b".repeat(64)}`;
    await execFileAsync("npm", ["run", "server:bundle", "--", "--image", `ghcr.io/band-office/band-office-server@${digest}`]);
    await execFileAsync("npm", ["run", "release:server:artifact:verify", "--", "dist-server"]);
    await execFileAsync("npm", ["run", "release:server:manifest", "--", "dist-server"], {
      env: {
        ...process.env,
        GITHUB_REF_NAME: "v0.1.0-server-alpha.1",
        GITHUB_SHA: "c".repeat(40),
        BAND_OFFICE_IMAGE_NAME: "ghcr.io/band-office/band-office-server",
        BAND_OFFICE_IMAGE_DIGEST: digest,
      },
    });

    const manifest = JSON.parse(await readFile("dist-server/Band-Office-Server-RELEASE-MANIFEST.json", "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      product: "Band Office Server",
      channel: "server-alpha",
      tag: "v0.1.0-server-alpha.1",
      commit: "c".repeat(40),
      image: {
        name: "ghcr.io/band-office/band-office-server",
        digest,
        platforms: ["linux/amd64", "linux/arm64"],
      },
    });
  });

  test("keeps public channels and unsupported deployment boundaries explicit", async () => {
    const readme = await readFile("README.md", "utf8");
    const channels = await readFile("RELEASE_CHANNELS.md", "utf8");
    const deployment = await readFile("SERVER_DEPLOYMENT.md", "utf8");
    const signedWorkflow = await readFile(".github/workflows/desktop-alpha-release.yml", "utf8");
    const acceptanceWorkflow = await readFile(".github/workflows/release-candidate.yml", "utf8");
    const pullRequestWorkflow = await readFile(".github/workflows/pull-request-quality.yml", "utf8");
    const serverWorkflow = await readFile(".github/workflows/server-alpha-release.yml", "utf8");

    expect(readme).not.toContain("[dist-desktop](./dist-desktop)");
    expect(readme).toContain("v0.1.0-alpha.2");
    expect(readme).toContain("public, unsigned prerelease");
    expect(readme).toContain("Start with the fictional Ridgeline demo");
    expect(readme).toContain("verify an encrypted backup and restore");
    expect(readme).toContain("v0.1.0-server-alpha.4");
    expect(readme).toContain("district-operated prerelease");
    expect(channels).toContain("Band Office Server Alpha");
    expect(channels).toContain("v0.1.0-server-alpha.4");
    expect(channels).toContain("Directors should begin with the demo");
    expect(channels).toContain("must not add real student information to that installation");
    expect(channels).not.toContain("**State:** not yet issued.");
    expect(deployment).toContain("Fresh installations start empty");
    expect(deployment).toContain("activating real family accounts");
    expect(deployment).toContain("sudo chown 10001:10001 data secrets/worker-token.txt secrets/smtp-password.txt");
    expect(deployment).toContain("sudo chmod 400 secrets/worker-token.txt secrets/smtp-password.txt");
    expect(signedWorkflow).toContain('(($lines -join "`n") + "`n")');
    expect(acceptanceWorkflow).toContain('(($lines -join "`n") + "`n")');
    expect(acceptanceWorkflow).toContain("Unexpected Developer ID signature on the unsigned macOS release candidate.");
    expect(acceptanceWorkflow).toContain("Unexpected Authenticode signature on the unsigned Windows release candidate");
    expect(signedWorkflow).not.toContain("AZURE_SIGNING_CERTIFICATE_PROFILE_NAME");
    expect(signedWorkflow).not.toContain("WINDOWS_CSC_LINK");
    expect(signedWorkflow).toContain("unsigned-macos-${{ matrix.arch }}-alpha");
    expect(signedWorkflow).toContain("unsigned-windows-alpha");
    expect(signedWorkflow).toContain("desktop:dist:mac:arm64");
    expect(signedWorkflow).toContain("desktop:dist:mac:x64");
    expect(signedWorkflow).toContain("macos-15-intel");
    expect(signedWorkflow).toContain('lipo -archs "$app/Contents/MacOS/Band Office"');
    expect(signedWorkflow).toContain("npm run desktop:dist:win");
    expect(signedWorkflow).toContain('- "!v*-server-alpha.*"');
    expect(signedWorkflow).not.toContain("APPLE_APP_SPECIFIC_PASSWORD");
    expect(serverWorkflow).toContain('- "v*-server-alpha.*"');
    expect(serverWorkflow).toContain("environment: server-alpha-release");
    expect(serverWorkflow).toContain("platforms: linux/amd64,linux/arm64");
    expect(serverWorkflow).toContain("provenance: mode=max");
    expect(serverWorkflow).toContain("sbom: true");
    expect(serverWorkflow).toContain("npm run server:compose:test -- band-office-server:acceptance");
    expect(serverWorkflow).toContain("${{ env.IMAGE_NAME }}:sha-${{ github.sha }}");
    expect(serverWorkflow).not.toContain("${{ env.IMAGE_NAME }}:${{ steps.release.outputs.version }}");
    expect(serverWorkflow).toContain("uses: actions/attest@");
    expect(serverWorkflow).not.toContain("visibility=public");
    expect(serverWorkflow).not.toContain("packages/container/band-office-server");
    expect(serverWorkflow).toContain("BAND_OFFICE_IMAGE_NAME: ${{ env.IMAGE_NAME }}");
    expect(serverWorkflow).toContain('DOCKER_CONFIG="$anonymous_config"');
    expect(serverWorkflow).not.toContain(":latest");
    expect(pullRequestWorkflow).toContain("server-compose-acceptance:");
    expect(pullRequestWorkflow).toContain("npm run server:compose:test -- band-office-server:acceptance");
    const backupRestore = await readFile("SERVER_BACKUP_RESTORE.md", "utf8");
    expect(backupRestore).toContain('sudo tar -czf "$backup" data');
    expect(backupRestore).toContain("sudo chown -R 10001:10001 data");
    const composeAcceptance = await readFile("scripts/test-server-compose.sh", "utf8");
    expect(composeAcceptance).toContain('"${compose[@]}" up -d --wait app');
    expect(composeAcceptance).toContain('"${compose[@]}" up -d worker');
    expect(composeAcceptance).toContain('sudo tar -czf "$backup" data');
    expect(await readFile("Dockerfile", "utf8")).toContain("rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack");
  });
});
