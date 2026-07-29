# Band Office Next Action

The current work is release engineering, not another feature module.

## Desktop Alpha

The public-release cleanup, protected `desktop-alpha-release` environment, required reviewer, native unsigned package acceptance, and [`v0.1.0-alpha.1`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.1) publication are complete. Both platforms ship unsigned with checksums and platform warnings; paid Apple and Microsoft signing are deferred.

1. Run clean-machine Gatekeeper override, installation, backup, restore, upgrade, and uninstall acceptance on macOS Apple Silicon.
2. Run the equivalent clean-machine SmartScreen and lifecycle acceptance on Windows x64.
3. Record whether a nondeveloper can follow the unsigned-install and checksum instructions without assistance.
4. Resolve any release-blocking findings in a later alpha tag; never move or replace the published `v0.1.0-alpha.1` tag.

Use only the versioned GitHub prerelease for evaluation. Do not publish temporary Actions artifacts as director downloads.

## Server Alpha

The protected Server release workflow, vulnerability gate, packaged Linux Compose acceptance, public multi-platform image, immutable digest, signed provenance, operator bundle, and [`v0.1.0-server-alpha.4`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.4) publication are complete.

1. Deploy the released operator bundle to a clean supported Linux server with real DNS using fictional data.
2. Complete public HTTPS, firewall, external-port, SMTP, portal recovery, scheduled-worker downtime, backup, restore, upgrade, and rollback acceptance.
3. Record whether district IT can follow the operator handoff without repository-author assistance.
4. Resolve release-blocking findings in a later alpha tag; never move or replace `v0.1.0-server-alpha.4`.

Do not activate real family accounts until district ownership, public-edge, SMTP, password-recovery, upgrade, rollback, restore, and approval gates pass.

## Stable Release

The first stable Desktop release remains gated on reproducible clean-machine lifecycle acceptance and verified encrypted-backup restoration. Server stability separately requires controlled public-edge, live-mailbox, portal-recovery, upgrade, rollback, and complete-data restore acceptance on district-owned infrastructure.
