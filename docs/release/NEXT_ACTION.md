# Band Office Next Action

The current work is release engineering, not another feature module.

## Desktop Alpha

The public-release cleanup, protected `desktop-alpha-release` environment, required reviewer, native package acceptance, and [`v0.1.0-alpha.15`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.15) publication are complete. Apple Silicon and Intel macOS packages are Developer ID-signed, Apple-notarized, stapled, and Gatekeeper-validated. Windows x64 remains unsigned with checksums and SmartScreen guidance.

1. Run clean-machine installation, backup, restore, upgrade, and uninstall acceptance on macOS Apple Silicon, confirming the notarized app opens without a Gatekeeper override.
2. Run the same clean-machine lifecycle acceptance on Intel macOS.
3. Run the equivalent clean-machine SmartScreen and lifecycle acceptance on Windows x64.
4. Record whether a nondeveloper can choose the correct package and follow the current Mac or Windows guidance without assistance.
5. Resolve any release-blocking findings in a later alpha tag; never move or replace a published alpha tag.

Use only the versioned GitHub prerelease for evaluation. Do not publish temporary Actions artifacts as director downloads. Windows signing remains deferred; each future Mac alpha must continue through Developer ID signing and Apple notarization.

## Server Alpha

The protected Server release workflow, vulnerability gate, packaged Linux Compose acceptance, public multi-platform image, immutable digest, signed provenance, operator bundle, and [`v0.1.0-server-alpha.5`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.5) publication are complete.

1. Deploy the released operator bundle to a clean supported Linux server with real DNS using fictional data.
2. Complete public HTTPS, firewall, external-port, SMTP, portal recovery, scheduled-worker downtime, backup, restore, upgrade, and rollback acceptance.
3. Record whether district IT can follow the operator handoff without repository-author assistance.
4. Resolve release-blocking findings in a later alpha tag; never move or replace `v0.1.0-server-alpha.5`.

Do not activate real family accounts until district ownership, public-edge, SMTP, password-recovery, upgrade, rollback, restore, and approval gates pass.

## Stable Release

The first stable Desktop release remains gated on reproducible clean-machine lifecycle acceptance and verified encrypted-backup restoration. Server stability separately requires controlled public-edge, live-mailbox, portal-recovery, upgrade, rollback, and complete-data restore acceptance on district-owned infrastructure.
