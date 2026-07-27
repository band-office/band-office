# Band Office Current Status

**Status date:** July 26, 2026

**Source state:** public release candidate

**Desktop state:** alpha release preparation; no public download issued

**Server state:** district-operator technical preview; no supported image issued

Band Office is a functioning local web and Electron application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup and restore, rollover, audit history, and a relationship-scoped read-only student and guardian portal with self-service password recovery.

## Accepted Evidence

The merged mixed-distribution release baseline at commit `a0036b0a1ecb3129f769cb124e072b0ff6b2f89f` passed [GitHub Actions run 30228396298](https://github.com/band-office/band-office/actions/runs/30228396298):

- Linux release verification;
- unsigned macOS packaging and packaged-application acceptance;
- unsigned Windows packaging and packaged-application acceptance;
- DMG verification, checksums, and temporary CI artifact upload.

The quality job included all 48 unit tests, the production build, desktop lifecycle acceptance, the complete Playwright director workflow, release audits, and dependency checks. The production dependency advisory audit reported zero vulnerabilities. Unsigned CI artifacts are temporary engineering evidence, not public downloads.

## Desktop Alpha

The application and cross-platform package candidates are implemented. The first alpha will intentionally publish unsigned macOS and Windows packages with SHA-256 checksums and explicit platform-warning instructions. Apple Developer ID signing, notarization, and Microsoft Artifact Signing are deferred until user interest warrants their recurring costs.

The first Desktop alpha remains blocked on:

1. Successful unsigned workflow execution from an accepted alpha tag and protected publication approval.
2. Clean-machine install, Gatekeeper and SmartScreen override, backup, restore, upgrade, and uninstall acceptance.
3. District approval and the SDMS real-data pilot before stable use.

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

## Real Data Boundary

No current channel authorizes real student data by itself. A school must approve the deployment, use district-managed encrypted equipment and storage, assign backup ownership, and verify restoration before replacing an existing system.
