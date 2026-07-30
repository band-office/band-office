# Changelog

All notable project changes will be recorded here once versioned releases begin.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use semantic versioning after the alpha phase.

## Unreleased

### Added

- Added a separately packaged and tested Intel x64 macOS Desktop distribution.

### Changed

- Split macOS release checksums by architecture and require both Mac packages before Desktop alpha publication.

## Desktop 0.1.0-alpha.2 — 2026-07-29

### Added

- Added a first-run fictional Ridgeline demo that requires the director to create a local account, cannot be selected after an account exists, and remains visibly marked throughout the application.
- Added a director-facing Desktop download page with direct macOS and Windows installers, unsigned-package instructions, and checksum links.
- Added a plain-language data-flow document separating local Desktop storage, explicit email delivery, and district-operated Server hosting.

### Changed

- Made the alpha real-data boundary visible during first-run setup and directed evaluators to begin with fictional data.
- Synchronized the security, support, roadmap, release-channel, email, Server-secret, and CutTime-replacement documents with the issued Desktop and Server alpha channels.
- Recorded paid Apple and Microsoft signing as deferred distribution improvements rather than prerequisites for the issued unsigned alphas.

### Security

- Added pinned CodeQL `security-extended` analysis for JavaScript and TypeScript on pull requests, `main`, and a weekly schedule.
- Removed check-then-read races from Desktop backup validation and Server artifact verification; Desktop reads are hard-capped through one file handle and Server checks the exact bytes read.
- Prevented HTTP-derived communication-worker details from being written to the Desktop log and added a release-audit regression check for fixed worker diagnostics.

## Server 0.1.0-server-alpha.4 — 2026-07-27

### Fixed

- Corrected Linux ownership and modes for file-backed SMTP and worker secrets.
- Corrected offline backup and restore commands for the protected UID `10001` data directory.
- Prevented Server release tags from triggering the Desktop release workflow.
- Replaced pre-release version-looking container tags with commit-scoped staging tags.

### Verification

- Added Ubuntu acceptance of the packaged Docker Compose configuration, non-root secrets, worker startup, offline backup, checksum, restore, and post-restore SQLite integrity.

## Server 0.1.0-server-alpha.3 — 2026-07-27

### Added

- First public district-operated Band Office Server prerelease
- Public `linux/amd64` and `linux/arm64` container image with an immutable digest
- Digest-pinned operator bundle, SHA-256 checksums, and source-bound release manifest
- GitHub build provenance, operator-bundle attestation, and OCI software bill of materials
- District deployment, portal activation, backup and restore, upgrade, support-boundary, and ownership handoff guides

### Security

- Release-blocking scan for fixed high and critical container vulnerabilities
- Nonroot runtime with Linux capabilities dropped and no runtime npm or Corepack installation
- Anonymous registry, multi-platform image-index, and provenance verification before prerelease publication

## Desktop 0.1.0-alpha.1 — 2026-07-26

### Added

- First public Band Office Desktop prerelease for macOS Apple Silicon and Windows x64
- GitHub-specific brand assets built from the approved Band Office mark
- Repository contributor guide, code of conduct, security policy, support guide, governance, and roadmap
- Structured issue forms and pull request template
- Product screenshots for the repository presentation
- SHA-256 checksum files and a machine-readable release manifest

### Changed

- Repository README presentation and contributor navigation
- Desktop alpha distribution publishes an explicitly unsigned macOS package with Gatekeeper instructions while deferring paid Apple signing and notarization
- Desktop alpha distribution publishes an explicitly unsigned Windows package with SmartScreen instructions while deferring paid Microsoft signing

## Public source release candidate — 2026-07-26

- Published the current Band Office source under Apache-2.0.
- Documented the local desktop and district server release boundaries.
- Recorded release verification, security, backup, migration, and operator evidence.
