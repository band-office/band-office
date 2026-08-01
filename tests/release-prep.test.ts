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

  test("writes and validates resumable notarization metadata", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "band-office-notarization-metadata-"));
    temporaryDirectories.push(directory);
    const responsePath = path.join(directory, "notary-response.json");
    const outputPath = path.join(directory, "notarization-submission.json");
    const submissionId = "26497f5b-d263-4326-8769-3a5671a61910";
    await writeFile(responsePath, JSON.stringify({ id: submissionId }));

    await execFileAsync(process.execPath, [
      "scripts/write-notarization-submission.mjs",
      "--output", outputPath,
      "--response", responsePath,
      "--tag", "v0.1.0-alpha.1",
      "--commit", "d".repeat(40),
      "--arch", "arm64",
      "--archive", "Band-Office-0.1.0-mac-arm64-pending-notarization.zip",
      "--sha256", "e".repeat(64),
    ]);

    const { stdout } = await execFileAsync(process.execPath, [
      "scripts/read-notarization-submission.mjs",
      "--input", outputPath,
      "--tag", "v0.1.0-alpha.1",
      "--arch", "arm64",
      "--format", "env",
    ]);
    expect(stdout).toContain(`NOTARIZATION_SUBMISSION_ID=${submissionId}`);
    expect(stdout).toContain(`NOTARIZATION_SOURCE_COMMIT=${"d".repeat(40)}`);

    await expect(execFileAsync(process.execPath, [
      "scripts/read-notarization-submission.mjs",
      "--input", outputPath,
      "--tag", "v0.1.0-alpha.1",
      "--arch", "x64",
    ])).rejects.toThrow();
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
    const channels = await readFile("docs/release/RELEASE_CHANNELS.md", "utf8");
    const download = await readFile("docs/getting-started/DOWNLOAD.md", "utf8");
    const deployment = await readFile("docs/deployment/SERVER_DEPLOYMENT.md", "utf8");
    const preparationWorkflow = await readFile(".github/workflows/desktop-alpha-release.yml", "utf8");
    const finalizerWorkflow = await readFile(".github/workflows/desktop-alpha-finalize.yml", "utf8");
    const notaryStatusWorkflow = await readFile(".github/workflows/apple-notary-status.yml", "utf8");
    const acceptanceWorkflow = await readFile(".github/workflows/release-candidate.yml", "utf8");
    const pullRequestWorkflow = await readFile(".github/workflows/pull-request-quality.yml", "utf8");
    const serverWorkflow = await readFile(".github/workflows/server-alpha-release.yml", "utf8");

    expect(readme).not.toContain("[dist-desktop](./dist-desktop)");
    expect(readme).toContain("v0.1.0-alpha.10");
    expect(readme).toContain("public prerelease");
    expect(readme).toContain("Start with the fictional Ridgeline demo");
    expect(readme).toContain("verify an encrypted backup and restore");
    expect(readme).toContain("Apple-notarized");
    expect(readme).toContain("Windows is unsigned");
    expect(readme).toContain("v0.1.0-server-alpha.4");
    expect(readme).toContain("district-operated prerelease");
    expect(channels).toContain("Band Office Server Alpha");
    expect(channels).toContain("v0.1.0-server-alpha.4");
    expect(channels).toContain("Directors should begin with the demo");
    expect(channels).toContain("must not add real student information to that installation");
    expect(channels).not.toContain("**State:** not yet issued.");
    expect(download).toContain("v0.1.0-alpha.10");
    expect(download).toContain("Start my program");
    expect(download).toContain("Band-Office-0.1.0-mac-arm64.dmg");
    expect(download).toContain("Band-Office-0.1.0-mac-x64.dmg");
    expect(download).toContain("Band-Office-0.1.0-win-x64.exe");
    expect(download).toContain("SHA256SUMS-macos-arm64.txt");
    expect(download).toContain("SHA256SUMS-macos-x64.txt");
    expect(download).toContain("macOS 12 Monterey or later");
    expect(download).toContain("Developer ID-signed and Apple-notarized");
    expect(download).not.toContain("choose **Open Anyway**");
    expect(deployment).toContain("Fresh installations start empty");
    expect(deployment).toContain("activating real family accounts");
    expect(deployment).toContain("sudo chown 10001:10001 data secrets/worker-token.txt secrets/smtp-password.txt");
    expect(deployment).toContain("sudo chmod 400 secrets/worker-token.txt secrets/smtp-password.txt");
    expect(preparationWorkflow).toContain('(($lines -join "`n") + "`n")');
    expect(acceptanceWorkflow).toContain('(($lines -join "`n") + "`n")');
    expect(acceptanceWorkflow).toContain("codesign --verify --deep --strict");
    expect(acceptanceWorkflow).toContain("Unexpected Developer ID signature on the ad hoc macOS release candidate.");
    expect(acceptanceWorkflow).toContain("Unexpected Authenticode signature on the unsigned Windows release candidate");
    expect(preparationWorkflow).not.toContain("AZURE_SIGNING_CERTIFICATE_PROFILE_NAME");
    expect(preparationWorkflow).not.toContain("WINDOWS_CSC_LINK");
    expect(preparationWorkflow).toContain("codesign --verify --deep --strict");
    expect(preparationWorkflow).toContain("pending-notarization-macos-${{ matrix.arch }}-alpha");
    expect(preparationWorkflow).toContain("unsigned-windows-alpha");
    expect(preparationWorkflow).toContain("desktop:dist:mac:arm64:sign-only");
    expect(preparationWorkflow).toContain("desktop:dist:mac:x64:sign-only");
    expect(preparationWorkflow).toContain("BANDOS_DESKTOP_SKIP_RUNTIME_LAUNCH");
    expect(preparationWorkflow).toContain("xcrun notarytool submit");
    expect(preparationWorkflow).toContain("scripts/write-notarization-submission.mjs");
    expect(preparationWorkflow).toContain("macos-15-intel");
    expect(preparationWorkflow).toContain('lipo -archs "$app/Contents/MacOS/Band Office"');
    expect(preparationWorkflow).toContain("Authority=Developer ID Application");
    expect(preparationWorkflow).toContain("APPLE_DEVELOPER_ID_APPLICATION_P12_BASE64");
    expect(preparationWorkflow).toContain("APPLE_NOTARY_KEY_P8_BASE64");
    expect(preparationWorkflow).toContain("npm run desktop:dist:win");
    expect(preparationWorkflow).toContain('- "!v*-server-alpha.*"');
    expect(preparationWorkflow).not.toContain("APPLE_APP_SPECIFIC_PASSWORD");
    expect(finalizerWorkflow).toContain("workflow_dispatch:");
    expect(finalizerWorkflow).toContain("source_run_id:");
    expect(finalizerWorkflow).toContain("xcrun notarytool info");
    expect(finalizerWorkflow).toContain("Apple notarization status is $status. The release remains unpublished.");
    expect(finalizerWorkflow).toContain("status=\"$(node -p 'JSON.parse(require(\"fs\").readFileSync(\"notarization-status.json\", \"utf8\")).status')\"");
    expect(finalizerWorkflow).toContain("version=\"$(node -p 'require(\"./package.json\").version')\"");
    expect(finalizerWorkflow).not.toContain('node -p \\"');
    expect(finalizerWorkflow).toContain("xcrun stapler validate");
    expect(finalizerWorkflow).toContain("source=Notarized Developer ID");
    expect(finalizerWorkflow).toContain("notarized-macos-${{ matrix.arch }}-alpha");
    expect(finalizerWorkflow).toContain("release-assets/*");
    expect(finalizerWorkflow).not.toContain("release-assets/notarized-macos-arm64-alpha/*");
    expect(finalizerWorkflow).toContain("environment: desktop-alpha-release");
    expect(finalizerWorkflow).toContain("gh release create");
    expect(finalizerWorkflow).toContain("scripts/read-notarization-submission.mjs");
    expect(notaryStatusWorkflow).toContain("workflow_dispatch:");
    expect(notaryStatusWorkflow).toContain("submission_ids:");
    expect(notaryStatusWorkflow).toContain("xcrun notarytool info");
    expect(notaryStatusWorkflow).toContain("APPLE_NOTARY_KEY_P8_BASE64");
    expect(notaryStatusWorkflow).toContain("Apple notarization status");
    expect(notaryStatusWorkflow).not.toContain("xcrun notarytool submit");
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
    const backupRestore = await readFile("docs/deployment/SERVER_BACKUP_RESTORE.md", "utf8");
    expect(backupRestore).toContain('sudo tar -czf "$backup" data');
    expect(backupRestore).toContain("sudo chown -R 10001:10001 data");
    const composeAcceptance = await readFile("scripts/test-server-compose.sh", "utf8");
    expect(composeAcceptance).toContain('"${compose[@]}" up -d --wait app');
    expect(composeAcceptance).toContain('"${compose[@]}" up -d worker');
    expect(composeAcceptance).toContain('sudo tar -czf "$backup" data');
    expect(await readFile("Dockerfile", "utf8")).toContain("rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack");
  });
});
