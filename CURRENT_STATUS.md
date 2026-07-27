# Band Office Current Status

**Status date:** July 26, 2026

**Source state:** public source with versioned Desktop alpha

**Desktop state:** [`v0.1.0-alpha.1`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.1) public prerelease issued; unsigned macOS Apple Silicon and Windows x64 packages

**Server state:** district-operator technical preview; no supported image issued

Band Office is a functioning local web and Electron application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup and restore, rollover, audit history, and a relationship-scoped read-only student and guardian portal with self-service password recovery.

## Accepted Evidence

The tagged Desktop alpha at commit `8db851b62256c1d100462a077dba3ac41a7ea85e` passed the protected [GitHub Actions release run 30232531767](https://github.com/band-office/band-office/actions/runs/30232531767):

- Linux release verification;
- unsigned macOS packaging and packaged-application acceptance;
- unsigned Windows packaging and packaged-application acceptance;
- DMG and ZIP verification;
- SHA-256 checksum and release-manifest generation;
- required-reviewer approval before prerelease publication.

The quality job included all 48 unit tests, the production build, desktop lifecycle acceptance, the complete Playwright director workflow, release audits, and dependency checks. The production dependency advisory audit reported zero vulnerabilities. The seven published release assets match the hashes and byte sizes recorded by GitHub and `Band-Office-RELEASE-MANIFEST.json`.

## Desktop Alpha

The first Desktop alpha is public as explicitly unsigned macOS and Windows packages with SHA-256 checksums and platform-warning instructions. Apple Developer ID signing, notarization, and Microsoft Artifact Signing are deferred until user interest warrants their recurring costs.

The Desktop alpha starts with an empty database and first-run setup; no demo records are packaged. A director can use it for real local program operations within the documented Desktop boundary. Remaining release-hardening work is:

1. Clean-machine install, Gatekeeper and SmartScreen override, backup, restore, upgrade, and uninstall acceptance.
2. Clear confirmation that the unsigned-install instructions are understandable to a nondeveloper.
3. The SDMS real-program pilot before the release can be considered stable.

See `DESKTOP_ALPHA_RELEASE.md`.

## Server Technical Preview

A local Linux ARM64 container stack passed migrations, HTTPS proxying, security-header checks, worker-secret enforcement, restart recovery, SQLite integrity checks, and an isolated complete-data-directory restore drill. Exact local evidence is in `SERVER_ACCEPTANCE_RECORD.md`.

This is not a public-hosting acceptance claim. Server and family portal release remains blocked until:

1. A canonical multi-platform image and immutable registry digests are published.
2. A clean Linux server passes public DNS, ACME HTTPS, firewall, and external-port acceptance.
3. District SMTP, scheduling, retries, downtime recovery, and portal password recovery pass controlled tests.
4. Published-version upgrade, rollback, and complete-data restore drills pass.
5. A district names the infrastructure, backup, mailbox, and director owners.
6. District approval is complete before real family accounts are activated.

See `RELEASE_CHANNELS.md` and `SERVER_SUPPORT_BOUNDARY.md`.

## Real Data Conditions

Desktop has no fictional-data restriction and does not automatically load the Ridgeline dataset. Before a director loads student information, the school should approve the deployment, use district-managed encrypted equipment and storage, assign backup ownership, and verify restoration. Those are operational safeguards for real school records, not a demo-mode limitation. The separate Server channel is not yet approved for real family accounts.
