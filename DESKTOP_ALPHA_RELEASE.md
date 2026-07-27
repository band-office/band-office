# Band Office Desktop Alpha Release

The Desktop alpha workflow is fail-closed around the selected distribution policy. It publishes a GitHub prerelease only after macOS produces an explicitly unsigned, checksum-protected package and Windows produces a valid Microsoft-signed package. Both jobs must complete packaged-application acceptance.

## Release Identity

- Package version: `package.json` without prerelease text, for example `0.1.0`.
- Tag format: `v<package-version>-alpha.<number>`, for example `v0.1.0-alpha.1`.
- GitHub release: prerelease, created only by `.github/workflows/desktop-alpha-release.yml`.
- Updates: manual and director-initiated under `UPDATE_POLICY.md`.

The tag must point to an accepted commit on `main`. The workflow fetches `main` and rejects a tag whose commit is not in that history. It also rejects a mismatched tag, dirty package metadata, missing Windows signing credentials, an unsigned Windows output, an unexpectedly Developer ID-signed macOS output, or a failed platform acceptance step.

## Protected Environment

Create a GitHub environment named `desktop-alpha-release`. Limit deployment to protected branches and tags that match the alpha format. Add a required reviewer before public release credentials are installed.

Store these secrets in that environment:

| Secret | Purpose |
| --- | --- |
| `AZURE_TENANT_ID` | Microsoft Entra tenant used by the signing service principal |
| `AZURE_CLIENT_ID` | Application/client ID for the signing service principal |
| `AZURE_CLIENT_SECRET` | Client secret for the signing service principal |

Store these non-secret values as environment variables:

| Variable | Purpose |
| --- | --- |
| `AZURE_SIGNING_PUBLISHER_NAME` | Exact Common Name shown by the Public Trust certificate |
| `AZURE_SIGNING_ENDPOINT` | Regional Artifact Signing endpoint, including `https://` |
| `AZURE_SIGNING_CERTIFICATE_PROFILE_NAME` | Public Trust certificate profile name |
| `AZURE_SIGNING_ACCOUNT_NAME` | Artifact Signing account name |

Never place certificates or passwords in the repository, workflow file, release notes, issue, or application data.

## Distribution Enrollment

### macOS

The initial macOS alpha is intentionally unsigned. Do not add Apple credentials to the release environment or describe the package as Apple-verified. The release notes must state that macOS requires a manual Gatekeeper override, and users must be given the published SHA-256 checksum.

Apple Developer Program enrollment, Developer ID signing, and notarization are deferred until adoption warrants the annual cost. The future signed command remains available, but it is not part of this alpha workflow.

### Microsoft

1. Use a paid Azure subscription whose billing identity matches the intended certificate subject.
2. Register the `Microsoft.CodeSigning` provider and create an Artifact Signing account.
3. Complete Public Trust identity validation in the Azure portal.
4. Create a Public Trust certificate profile.
5. Create a dedicated Microsoft Entra application/service principal for GitHub Actions.
6. Assign that service principal the `Artifact Signing Certificate Profile Signer` role at the certificate-profile scope.
7. Record the three service-principal secrets and four profile values listed above.

Use Microsoft’s [Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) and [role-assignment guide](https://learn.microsoft.com/en-us/azure/artifact-signing/tutorial-assign-roles) as the source of truth. Band Office uses Electron Builder’s `win.azureSignOptions`; no exportable Windows `.pfx` is stored in GitHub.

## Before Tagging

1. Merge the release changes through the protected `quality` check.
2. Confirm `main` is clean and synchronized.
3. Run `npm ci` and `npm run release:verify`.
4. Update `CHANGELOG.md` and `CURRENT_STATUS.md`.
5. Confirm the package version is the intended alpha version.
6. Confirm the protected environment contains all three Microsoft signing secrets and four Artifact Signing variables.
7. Confirm a named reviewer is available to approve the environment deployment.

## Create The Alpha

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.1 -m "Band Office Desktop 0.1.0 alpha 1"
git push origin v0.1.0-alpha.1
```

The tag starts the mixed-distribution workflow. Do not create the GitHub Release manually and do not upload temporary Actions artifacts as substitutes.

## Required Workflow Evidence

### macOS

- Electron Builder packages with signing identity auto-discovery disabled.
- The job rejects any unexpected Developer ID signature.
- Packaged application acceptance passes.
- The DMG verifies.
- SHA-256 checksums are generated and the release notes disclose the unsigned status and Gatekeeper override.

### Windows

- Electron Builder signs the NSIS installer and unpacked executable through Microsoft Artifact Signing.
- Authenticode reports `Valid` for both.
- Packaged application acceptance passes.

### Shared

- `LICENSE` and `NOTICE` are present under the packaged `resources/legal` directory.
- Artifact checksums are generated after packaging and, for Windows, after signing.
- The source tag and workflow commit match.
- The release is marked as a GitHub prerelease.

## After Publication

1. Download both platform packages from the GitHub Release, not Actions.
2. Verify published checksums on separate clean machines.
3. On macOS, verify the documented Privacy & Security > Open Anyway flow before completing first-run setup, encrypted backup, restore, upgrade, and uninstall checks.
4. Record those results in `CURRENT_STATUS.md`.
5. Keep the alpha prerelease label until the SDMS pilot and remaining release gates pass.

Windows signing credentials are an external project-operating requirement. The repository can enforce their use, but it cannot create or approve them. Apple signing is a deliberately deferred distribution enhancement.
