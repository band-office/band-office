# Band Office Next Action

The current work is release engineering, not another feature module.

## Desktop Alpha

The public-release cleanup, protected `desktop-alpha-release` environment, required reviewer, and native unsigned package acceptance are complete. Both platforms will ship unsigned with checksums and platform warnings; paid Apple and Microsoft signing are deferred.

1. Create the unsigned `v0.1.0-alpha.1` tag from accepted `main`.
2. Approve publication through the protected GitHub environment.
3. Verify the GitHub prerelease, checksums, platform warnings, and legal files.
4. Run clean-machine Gatekeeper and SmartScreen override, installation, backup, restore, upgrade, and uninstall acceptance on macOS and Windows.

Do not publish temporary Actions artifacts as director downloads.

## Server Technical Preview

Desktop alpha work does not authorize the Server channel. The next Server action is to publish a versioned multi-platform image, record immutable digests, deploy to a clean Linux server with real DNS, and execute the remaining acceptance record using fictional data.

Do not activate real family accounts until district ownership, public-edge, SMTP, password-recovery, upgrade, rollback, and restore gates pass.

## Stable Release

The first stable release remains gated on district approval, the SDMS real-data pilot, verified encrypted-backup restoration, and controlled live-mailbox acceptance.
