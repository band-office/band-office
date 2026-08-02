# Band Office Current Status

**Status date:** August 2, 2026

**Source state:** public source with versioned Desktop and Server alphas

**Desktop state:** [`v0.1.0-alpha.13`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.13) public prerelease issued; Developer ID-signed, Apple-notarized macOS packages for Apple Silicon and Intel Macs plus unsigned Windows x64 packages

**Server state:** [`v0.1.0-server-alpha.4`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.4) public district-operated prerelease issued

Band Office is a functioning local web and Electron application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup and restore, rollover, audit history, and a relationship-scoped read-only student and guardian portal with self-service password recovery.

## Accepted Evidence

Desktop alpha.10 at source commit `10dd054bcbe9d0b46b8750d20dee57e2c2167c96` passed the protected [GitHub Actions finalizer run 30721964472](https://github.com/band-office/band-office/actions/runs/30721964472). It verified both saved Apple notarization submissions as accepted, stapled the exact submitted Apple Silicon and Intel applications, validated the stapled tickets, and required Gatekeeper to report `Notarized Developer ID` before the required reviewer approved publication. The release contains both Mac DMGs and ZIPs, the unsigned Windows installer and ZIP, architecture-specific checksums, and a source-bound manifest.

Desktop alpha.13 supersedes alpha.12 after a release-layout regression: the accepted app was present, but the rebuilt DMG omitted the normal Applications shortcut. Alpha.13 preserves the native installer layout, verifies the final mounted DMG contains the accepted app and `/Applications` link, then validates its Developer ID signature and Gatekeeper acceptance before publication.

Desktop alpha.6 adds a guarded exit from the fictional demo. The permanent demo banner now offers **Start my program** only in the Desktop app. After native confirmation, Band Office verifies that the active database contains only the fixed Ridgeline demo, preserves the database and managed files in recovery snapshots, clears the active demo, restarts, and returns to first-run setup. The reset path rejects director-created programs and its lifecycle behavior is covered by automated acceptance.

Desktop alpha.5 supersedes the alpha.3 Mac packages. A tester exposed that alpha.3 contained only an executable-level placeholder signature rather than a sealed application-bundle signature, which could cause macOS to report that the app was damaged. The alpha.4 tag did not produce a release because the strengthened gate caught a runtime image-cache write inside the sealed bundle. Alpha.5 disables that write and requires a valid ad hoc bundle seal, strict recursive `codesign` verification after packaged-app acceptance, the `org.bandoffice.desktop` application identifier, and DMG verification before publication. Alpha.3 remains available as immutable release history but should not be installed on macOS.

The tagged Desktop alpha.5 at commit `8524ee2bc8d277d042ca3230759501bbe95edf9c` passed the protected [GitHub Actions release run 30584349679](https://github.com/band-office/band-office/actions/runs/30584349679):

- Linux release verification;
- native Apple Silicon and Intel macOS packaging and packaged-application acceptance;
- executable-architecture checks matching each Mac download label;
- strict recursive macOS bundle-seal verification after packaged-application acceptance;
- unsigned Windows packaging and packaged-application acceptance;
- DMG and ZIP verification;
- architecture-specific SHA-256 checksum and release-manifest generation;
- required-reviewer approval before prerelease publication.

The quality job included all 51 unit tests, the production build, desktop lifecycle acceptance, the complete Playwright director workflow, release audits, and dependency checks. The production dependency advisory audit reported zero vulnerabilities. The native platform jobs then passed packaged-application acceptance, signature or unsigned-distribution checks as applicable, and checksum generation. The ten published release assets are three installers, three ZIP packages, three checksum files, and `Band-Office-RELEASE-MANIFEST.json`.

Earlier Desktop alpha.1 through alpha.3 releases remain immutable. Alpha.4 is an immutable tag without a published release because its strengthened integrity gate failed closed.

The Server alpha at commit `be4e539bbe0e32794d8fbebed0e67c687a10aaa4` passed protected [GitHub Actions release run 30275406054](https://github.com/band-office/band-office/actions/runs/30275406054):

- full release verification and portal workflow acceptance;
- native container startup, migration, restart, and SQLite checks;
- packaged Docker Compose startup with UID `10001` secret ownership, offline backup, checksum, restore, and post-restore integrity checks;
- a blocking scan for fixed high and critical container vulnerabilities;
- public `linux/amd64` and `linux/arm64` image publication;
- anonymous registry access, image-index, provenance, and attestation verification;
- digest-pinned operator-bundle verification, checksum generation, and prerelease publication.

The immutable Server image is `ghcr.io/band-office/band-office-server@sha256:35b05d56032f68d8c04f9feb5d4b25a4c7cdcefdf0e734e54072267808f6bbaa`.

Repository protection also runs pinned CodeQL `security-extended` analysis on pull requests, `main`, and a weekly schedule. The first full `main` analysis surfaced two high-severity file-system race findings and one medium-severity network-to-file logging finding. Desktop restore intake now uses a hard-capped file-handle read, Server verification inspects the exact bytes it reads, and communication-worker logs contain fixed diagnostics rather than HTTP-derived values. The protected-`main` ruleset blocks analysis errors and high-or-higher CodeQL security alerts.

## Desktop Alpha

The current Desktop alpha.13 is public as separate Developer ID-signed, Apple-notarized macOS packages for Apple Silicon and Intel Macs and an unsigned Windows package, with SHA-256 checksums and platform-specific guidance. The Mac applications were stapled and Gatekeeper-validated before publication. Microsoft Artifact Signing remains deferred.

The Desktop alpha creates a private database during first-run setup and offers an empty program or the deterministic fictional Ridgeline demo. The demo remains visibly marked throughout the application and should never be mixed with real student information. Its permanent banner provides a Desktop-only **Start my program** action that preserves recovery snapshots and returns to first-run setup. A non-demo installation can be used for real local program operations within the documented Desktop boundary after the school-data safeguards are met. Remaining release-hardening work is:

1. Clean-machine install, backup, restore, upgrade, and uninstall acceptance on Apple Silicon macOS and Intel macOS, confirming that the notarized app opens without a Gatekeeper override.
2. Clean-machine SmartScreen, install, backup, restore, upgrade, and uninstall acceptance on Windows x64.
3. Clear confirmation that a nondeveloper can choose the correct package and follow the current platform guidance.

See `DESKTOP_ALPHA_RELEASE.md`.

## Server Alpha

A local Linux ARM64 container stack passed migrations, HTTPS proxying, security-header checks, worker-secret enforcement, restart recovery, SQLite integrity checks, and an isolated complete-data-directory restore drill. The public release additionally passed multi-platform image, vulnerability, anonymous-access, checksum, and provenance gates. Exact evidence is in `SERVER_ACCEPTANCE_RECORD.md`.

This is a public software release, not a claim that a district's internet-facing installation has passed acceptance. Before one district activates real family accounts, that district must:

1. Pass clean-Linux public DNS, ACME HTTPS, firewall, and external-port acceptance.
2. Pass district SMTP, scheduling, retries, downtime recovery, and portal password recovery tests.
3. Pass published-version upgrade, rollback, and complete-data restore drills.
4. Name the infrastructure, backup, mailbox, and director owners.
5. Approve the stored records and public access model.

See `RELEASE_CHANNELS.md` and `SERVER_SUPPORT_BOUNDARY.md`.

## Real Data Conditions

Desktop loads Ridgeline only when the director explicitly chooses **Fictional demo** during first-run setup; Server installations do not load it. Before a director loads student information into a non-demo installation, the school should approve the deployment, use district-managed encrypted equipment and storage, assign backup ownership, and verify restoration. Server installations must also complete the public-edge, SMTP, ownership, and portal acceptance record before real family accounts are activated.
