# Band Office Desktop Alpha Release

The Desktop alpha workflow is fail-closed. It publishes a GitHub prerelease only after both operating-system jobs produce signed artifacts and complete post-signing verification.

## Release Identity

- Package version: `package.json` without prerelease text, for example `0.1.0`.
- Tag format: `v<package-version>-alpha.<number>`, for example `v0.1.0-alpha.1`.
- GitHub release: prerelease, created only by `.github/workflows/desktop-alpha-release.yml`.
- Updates: manual and director-initiated under `UPDATE_POLICY.md`.

The tag must point to an accepted commit on `main`. The workflow fetches `main` and rejects a tag whose commit is not in that history. It also rejects a mismatched tag, dirty package metadata, missing signing credentials, unsigned output, or a failed platform acceptance step.

## Protected Environment

Create a GitHub environment named `desktop-alpha-release`. Limit deployment to protected branches and tags that match the alpha format. Add a required reviewer before public release credentials are installed.

Store these secrets in that environment:

| Secret | Purpose |
| --- | --- |
| `MACOS_CSC_LINK` | Base64-encoded Developer ID Application `.p12` |
| `MACOS_CSC_KEY_PASSWORD` | Password for the `.p12` |
| `APPLE_ID` | Apple account used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific notarization password |
| `APPLE_TEAM_ID` | Apple Developer team identifier |
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

## Signing Enrollment

### Apple

1. Enroll the publisher in the [Apple Developer Program](https://developer.apple.com/programs/enroll/).
2. Create a Developer ID Application certificate and export it as a password-protected `.p12`.
3. Create an app-specific password for the Apple account used by notarization.
4. Record the Apple team ID.

The account holder must complete enrollment, payment, agreements, and identity checks. Do not transmit the certificate or passwords through an issue or chat.

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
6. Confirm the protected environment contains all eight signing secrets and four Artifact Signing variables.
7. Confirm a named reviewer is available to approve the environment deployment.

## Create The Alpha

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.1 -m "Band Office Desktop 0.1.0 alpha 1"
git push origin v0.1.0-alpha.1
```

The tag starts the signed workflow. Do not create the GitHub Release manually and do not upload unsigned artifacts as substitutes.

## Required Workflow Evidence

### macOS

- Electron Builder finds a Developer ID Application identity.
- The app is signed with Hardened Runtime and the approved entitlements.
- Apple notarization completes and the ticket is stapled.
- `codesign`, Gatekeeper assessment, and `stapler validate` pass.
- Packaged application acceptance passes.
- The DMG verifies.

### Windows

- Electron Builder signs the NSIS installer and unpacked executable through Microsoft Artifact Signing.
- Authenticode reports `Valid` for both.
- Packaged application acceptance passes.

### Shared

- `LICENSE` and `NOTICE` are present under the packaged `resources/legal` directory.
- Artifact checksums are generated after signing.
- The source tag and workflow commit match.
- The release is marked as a GitHub prerelease.

## After Publication

1. Download both platform packages from the GitHub Release, not Actions.
2. Verify published checksums on separate clean machines.
3. Complete install, first-run setup, encrypted backup, restore, upgrade, and uninstall checks.
4. Record those results in `CURRENT_STATUS.md`.
5. Keep the alpha prerelease label until the SDMS pilot and remaining release gates pass.

Signing credentials are an external project-operating requirement. The repository can enforce their use, but it cannot create or approve them.
