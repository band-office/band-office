# Band Office Desktop Alpha Release

The Desktop alpha workflow is fail-closed around the selected distribution policy. It publishes a GitHub prerelease only after Apple Silicon and Intel macOS produce valid Developer ID signatures and stapled Apple notarization tickets, Windows produces an explicitly unsigned package, every package is checksum-protected, and all three native jobs complete packaged-application acceptance.

Desktop packages exclude repository databases. A fresh installation creates its own database and offers an empty program or the deterministic fictional Ridgeline demo during first-run setup. Real student information should be loaded only into a non-demo installation after school approval, encrypted-device preparation, and a verified encrypted backup and restore.

## Release Identity

- Package version: `package.json` without prerelease text, for example `0.1.0`.
- Tag format: `v<package-version>-alpha.<number>`, for example `v0.1.0-alpha.1`.
- GitHub release: prerelease, created only by `.github/workflows/desktop-alpha-release.yml`.
- Updates: manual and director-initiated under the [update policy](../deployment/UPDATE_POLICY.md).

The tag must point to an accepted commit on `main`. The workflow fetches `main` and rejects a tag whose commit is not in that history. It also rejects a mismatched tag, dirty package metadata, an unexpectedly signed platform output, or a failed platform acceptance step.

## Protected Environment And Credentials

Create a GitHub environment named `desktop-alpha-release`. Limit deployment to protected branches and tags that match the alpha format, and add a required reviewer. It remains the manual approval gate immediately before GitHub publishes the prerelease.

Store the following as repository Actions secrets. Do not add a certificate, private key, or notarization key to the repository, a release artifact, or a local `.env` file:

- `APPLE_DEVELOPER_ID_APPLICATION_P12_BASE64`: base64-encoded Developer ID Application `.p12` export.
- `APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD`: password protecting that `.p12` export.
- `APPLE_NOTARY_KEY_P8_BASE64`: base64-encoded App Store Connect **team** API key `.p8` file.
- `APPLE_NOTARY_KEY_ID`: App Store Connect key ID.
- `APPLE_NOTARY_ISSUER_ID`: App Store Connect issuer ID.

The release workflow materializes the notarization key only in the ephemeral native macOS runner. Electron Builder creates a temporary signing keychain from the certificate, and the workflow verifies the final app before uploading it as a release artifact.

## Distribution Enrollment

### macOS

The macOS alpha ships separate Apple Silicon and Intel x64 packages built and launched on native GitHub-hosted runners. The workflow requires a valid Developer ID Application authority, strict recursive signature verification, a stapled notarization ticket, and a Gatekeeper assessment reporting `Notarized Developer ID`. It rejects ad hoc signatures. Release notes must identify the Mac packages as Developer ID-signed and Apple-notarized, and users must still receive architecture-specific published SHA-256 checksums.

### Windows

The initial Windows alpha is intentionally unsigned. Do not add Microsoft Artifact Signing credentials to the release environment or describe the package as Microsoft-verified. The release notes must disclose the likely Microsoft Defender SmartScreen warning and provide the published SHA-256 checksum.

Microsoft Artifact Signing is deferred until adoption warrants the monthly cost. The future signed command remains available, but it is not part of this alpha workflow.

## Before Tagging

1. Merge the release changes through the protected `quality` check.
2. Confirm `main` is clean and synchronized.
3. Run `npm ci` and `npm run release:verify`.
4. Update `CHANGELOG.md` and `CURRENT_STATUS.md`.
5. Confirm the package version is the intended alpha version.
6. Confirm the five Apple signing and notarization secrets are present without revealing their values.
7. Confirm a named reviewer is available to approve publication.

## Create The Alpha

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.6 -m "Band Office Desktop 0.1.0 alpha 6"
git push origin v0.1.0-alpha.6
```

The tag starts the mixed-distribution workflow. Do not create the GitHub Release manually and do not upload temporary Actions artifacts as substitutes.

## Required Workflow Evidence

### macOS

- Electron Builder packages with forced code signing and notarization enabled.
- Apple Silicon and Intel x64 packages are built and launched on matching native runners.
- The packaged executable architecture matches the download label.
- Strict recursive code-signature verification passes, including the sealed resource manifest.
- The job confirms a Developer ID Application signature and rejects an ad hoc signature.
- `xcrun stapler validate` succeeds and Gatekeeper reports `Notarized Developer ID` for the packaged app.
- Packaged application acceptance passes.
- The DMG verifies.
- SHA-256 checksums are generated and the release notes disclose the Developer ID signature and Apple notarization.

### Windows

- Electron Builder packages with signing disabled.
- The job rejects an unexpected valid Authenticode signature.
- Packaged application acceptance passes.
- SHA-256 checksums are generated and the release notes disclose the unsigned status and likely SmartScreen warning.

### Shared

- `LICENSE` and `NOTICE` are present under the packaged `resources/legal` directory.
- Artifact checksums are generated after packaging.
- The source tag and workflow commit match.
- The release is marked as a GitHub prerelease.

## After Publication

1. Download the Apple Silicon macOS, Intel macOS, and Windows packages from the GitHub Release, not Actions.
2. Verify published checksums on separate clean machines.
3. On macOS, verify that a clean machine recognizes the notarized application without the Privacy & Security > Open Anyway flow.
4. On Windows, verify the SmartScreen warning and user-controlled override on a clean, non-managed test machine.
5. Complete first-run setup, encrypted backup, restore, upgrade, and uninstall checks on all three platform/architecture targets.
6. Record those results in `CURRENT_STATUS.md`.
7. Keep the alpha prerelease label until the remaining release gates pass reproducibly.

Windows signing remains a deferred distribution enhancement. Apple Developer ID signing and notarization are required for each new macOS alpha release.
