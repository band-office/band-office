# Band Office Current Status

**Status date:** July 30, 2026

**Source state:** public source with versioned Desktop and Server alphas

**Desktop state:** [`v0.1.0-alpha.3`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.3) public prerelease issued; unsigned Apple Silicon macOS, Intel macOS, and Windows x64 packages

**Server state:** [`v0.1.0-server-alpha.4`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.4) public district-operated prerelease issued

Band Office is a functioning local web and Electron application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup and restore, rollover, audit history, and a relationship-scoped read-only student and guardian portal with self-service password recovery.

## Accepted Evidence

The tagged Desktop alpha.3 at commit `f45cbfdb958018ba11d20cd8f3b1211f30531df3` passed the protected [GitHub Actions release run 30550782069](https://github.com/band-office/band-office/actions/runs/30550782069):

- Linux release verification;
- native Apple Silicon and Intel macOS packaging and packaged-application acceptance;
- executable-architecture checks matching each Mac download label;
- unsigned Windows packaging and packaged-application acceptance;
- DMG and ZIP verification;
- architecture-specific SHA-256 checksum and release-manifest generation;
- required-reviewer approval before prerelease publication.

The quality job included all 50 unit tests, the production build, desktop lifecycle acceptance, the complete Playwright director workflow, release audits, and dependency checks. The production dependency advisory audit reported zero vulnerabilities. The three native platform jobs then passed packaged-application acceptance, unsigned-distribution checks, and checksum generation. The ten published release assets are three installers, three ZIP packages, three checksum files, and `Band-Office-RELEASE-MANIFEST.json`.

The same Intel release path first passed the complete pre-merge [release-candidate run 30549734479](https://github.com/band-office/band-office/actions/runs/30549734479) at commit `fd1d7564958a594db8f36148b7cd33c20d28accc`. Earlier Desktop alpha.1 and alpha.2 releases remain immutable.

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

The current Desktop alpha is public as separate explicitly unsigned Apple Silicon macOS, Intel macOS, and Windows packages with SHA-256 checksums and platform-warning instructions. Apple Developer ID signing, notarization, and Microsoft Artifact Signing are deferred until user interest warrants their recurring costs.

The Desktop alpha creates a private database during first-run setup and offers an empty program or the deterministic fictional Ridgeline demo. The demo remains visibly marked throughout the application and should never be mixed with real student information. A non-demo installation can be used for real local program operations within the documented Desktop boundary after the school-data safeguards are met. Remaining release-hardening work is:

1. Clean-machine install, Gatekeeper and SmartScreen override, backup, restore, upgrade, and uninstall acceptance on Apple Silicon macOS, Intel macOS, and Windows x64.
2. Clear confirmation that the unsigned-install instructions are understandable to a nondeveloper.

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
