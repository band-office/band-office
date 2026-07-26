# Band Office Next Action

The current work is release engineering, not another feature module.

## Desktop Alpha

1. Merge the public-release cleanup and fail-closed signing workflow through protected CI.
2. Obtain an Apple Developer ID Application certificate and notarization credentials.
3. Obtain a Windows code-signing certificate suitable for CI.
4. Configure the protected `desktop-alpha-release` GitHub environment and required reviewer.
5. Add the seven environment secrets listed in `DESKTOP_ALPHA_RELEASE.md`.
6. Create the signed `v0.1.0-alpha.1` tag from accepted `main`.
7. Verify the GitHub prerelease, checksums, signatures, notarization ticket, and legal files.
8. Run clean-machine installation, backup, restore, upgrade, and uninstall acceptance on macOS and Windows.

Do not publish unsigned Actions artifacts as director downloads.

## Server Technical Preview

Desktop alpha work does not authorize the Server channel. The next Server action is to publish a versioned multi-platform image, record immutable digests, deploy to a clean Linux server with real DNS, and execute the remaining acceptance record using fictional data.

Do not activate real family accounts until district ownership, public-edge, SMTP, password-recovery, upgrade, rollback, and restore gates pass.

## Stable Release

The first stable release remains gated on district approval, the SDMS real-data pilot, verified encrypted-backup restoration, and controlled live-mailbox acceptance.
