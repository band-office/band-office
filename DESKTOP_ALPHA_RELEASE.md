# Band Office Desktop Alpha Release

The Desktop alpha workflow is fail-closed around the selected distribution policy. It publishes a GitHub prerelease only after Apple Silicon and Intel macOS produce valid ad hoc integrity seals, Windows produces an explicitly unsigned package, every package is checksum-protected, and all three native jobs complete packaged-application acceptance.

Desktop packages exclude repository databases. A fresh installation creates its own database and offers an empty program or the deterministic fictional Ridgeline demo during first-run setup. Real student information should be loaded only into a non-demo installation after school approval, encrypted-device preparation, and a verified encrypted backup and restore.

## Release Identity

- Package version: `package.json` without prerelease text, for example `0.1.0`.
- Tag format: `v<package-version>-alpha.<number>`, for example `v0.1.0-alpha.1`.
- GitHub release: prerelease, created only by `.github/workflows/desktop-alpha-release.yml`.
- Updates: manual and director-initiated under `UPDATE_POLICY.md`.

The tag must point to an accepted commit on `main`. The workflow fetches `main` and rejects a tag whose commit is not in that history. It also rejects a mismatched tag, dirty package metadata, an unexpectedly signed platform output, or a failed platform acceptance step.

## Protected Environment

Create a GitHub environment named `desktop-alpha-release`. Limit deployment to protected branches and tags that match the alpha format, and add a required reviewer. The environment contains no signing secrets or variables; it is the manual approval gate immediately before GitHub publishes the prerelease.

## Distribution Enrollment

### macOS

The macOS alpha is ad hoc signed to seal the app bundle and ships separate Apple Silicon and Intel x64 packages. Each architecture is built and launched on a native GitHub-hosted runner. The workflow requires `codesign --verify --deep --strict` to pass and rejects any unexpected Developer ID identity. Do not add Apple credentials to the release environment or describe either package as Apple-verified. The release notes must state that macOS requires a manual Gatekeeper override, and users must be given the architecture-specific published SHA-256 checksum.

Apple Developer Program enrollment, Developer ID signing, and notarization are deferred until adoption warrants the annual cost. The future signed command remains available, but it is not part of this alpha workflow.

### Windows

The initial Windows alpha is intentionally unsigned. Do not add Microsoft Artifact Signing credentials to the release environment or describe the package as Microsoft-verified. The release notes must disclose the likely Microsoft Defender SmartScreen warning and provide the published SHA-256 checksum.

Microsoft Artifact Signing is deferred until adoption warrants the monthly cost. The future signed command remains available, but it is not part of this alpha workflow.

## Before Tagging

1. Merge the release changes through the protected `quality` check.
2. Confirm `main` is clean and synchronized.
3. Run `npm ci` and `npm run release:verify`.
4. Update `CHANGELOG.md` and `CURRENT_STATUS.md`.
5. Confirm the package version is the intended alpha version.
6. Confirm the protected environment contains no signing credentials.
7. Confirm a named reviewer is available to approve publication.

## Create The Alpha

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.4 -m "Band Office Desktop 0.1.0 alpha 4"
git push origin v0.1.0-alpha.4
```

The tag starts the mixed-distribution workflow. Do not create the GitHub Release manually and do not upload temporary Actions artifacts as substitutes.

## Required Workflow Evidence

### macOS

- Electron Builder packages with signing identity auto-discovery disabled and explicit ad hoc signing enabled.
- Apple Silicon and Intel x64 packages are built and launched on matching native runners.
- The packaged executable architecture matches the download label.
- Strict recursive code-signature verification passes, including the sealed resource manifest.
- The job confirms the ad hoc signature and rejects any unexpected Developer ID signature.
- Packaged application acceptance passes.
- The DMG verifies.
- SHA-256 checksums are generated and the release notes disclose the ad hoc, non-notarized status and Gatekeeper override.

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
3. On macOS, verify the documented Privacy & Security > Open Anyway flow.
4. On Windows, verify the SmartScreen warning and user-controlled override on a clean, non-managed test machine.
5. Complete first-run setup, encrypted backup, restore, upgrade, and uninstall checks on all three platform/architecture targets.
6. Record those results in `CURRENT_STATUS.md`.
7. Keep the alpha prerelease label until the remaining release gates pass reproducibly.

Apple and Microsoft signing are deliberately deferred distribution enhancements. Neither is required to evaluate the alpha.
