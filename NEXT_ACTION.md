# Band Office Next Action

The current work is release engineering, not another feature module.

## Desktop Alpha

The public-release cleanup, mixed-distribution workflow, protected `desktop-alpha-release` environment, required reviewer, and native unsigned package acceptance are complete. macOS will ship unsigned with checksums and a Gatekeeper warning; Apple signing is deferred.

1. Complete Microsoft Artifact Signing Public Trust identity validation and create the signing profile and service principal.
2. Add the three Microsoft secrets and four Artifact Signing variables listed in `DESKTOP_ALPHA_RELEASE.md`.
3. Create the mixed-distribution `v0.1.0-alpha.1` tag from accepted `main`.
4. Verify the GitHub prerelease, checksums, Windows signatures, macOS warning, and legal files.
5. Run clean-machine Gatekeeper override, installation, backup, restore, upgrade, and uninstall acceptance on macOS and Windows.

Do not publish temporary Actions artifacts as director downloads.

## Server Technical Preview

Desktop alpha work does not authorize the Server channel. The next Server action is to publish a versioned multi-platform image, record immutable digests, deploy to a clean Linux server with real DNS, and execute the remaining acceptance record using fictional data.

Do not activate real family accounts until district ownership, public-edge, SMTP, password-recovery, upgrade, rollback, and restore gates pass.

## Stable Release

The first stable release remains gated on district approval, the SDMS real-data pilot, verified encrypted-backup restoration, and controlled live-mailbox acceptance.
