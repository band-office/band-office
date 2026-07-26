# Band Office Current Status

**Status date:** July 26, 2026
**Release state:** public source release candidate; not approved for packaged public distribution

Band Office is a functioning local web and Electron desktop application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup/restore, rollover, audit history, and a relationship-scoped read-only student/guardian portal with self-service password recovery.

The release-hardening baseline includes explicit staff view and mutation permissions, bounded inventory-helper access, strict event status transitions, preserved manual roster removals, atomic event reminder creation, private calendar token handling without URL exposure, authenticated file routes, encrypted backup/restore, migration rollback, deterministic demo data, and automated unit, browser, desktop-runtime, package, privacy, dependency, and archive checks.

The server deployment kit is implemented in the repository: secret-mounted SMTP and worker credentials, a dedicated scheduled-email worker, database-aware health checks, persistent identifier-hashed login throttling, Caddy HTTPS and security headers, non-public application ports, versioned bundle generation, and separate deployment, activation, backup/restore, upgrade, and ownership runbooks.

A local Linux ARM64 container acceptance passed on July 26. The actual stack completed migrations, HTTPS proxying, security-header checks, worker-secret enforcement, restart recovery, SQLite integrity checks, and an isolated complete-data-directory backup/restore drill. The pruned runtime dependency tree reported zero known vulnerabilities. Exact evidence is in `SERVER_ACCEPTANCE_RECORD.md`.

The accepted source history was published to the public Apache-2.0 repository `band-office/band-office`. GitHub Actions release-candidate run [30215288767](https://github.com/band-office/band-office/actions/runs/30215288767) passed on July 26 against commit `e789f15fd77c8db66c19fe5543569ad4dd469215`: the full quality gate, unsigned macOS package and smoke acceptance, and unsigned Windows package and smoke acceptance all completed successfully. The retained test artifacts are `unsigned-macos-test-artifacts` (`sha256:19976bf798cbb6b65a14829c0901a7772044c9c7cf846fc1d79db9515fc9ebb7`) and `unsigned-windows-test-artifacts` (`sha256:b8cb8b0f5d75b62185999a1bddda09580a03a9e26a6b789af7a50ab1e2d5902a`). No stable release tag or packaged public download has been issued.

This is local container evidence, not a public-hosting acceptance claim. Public server release remains blocked until:

1. A canonical container registry and digest-pinned Band Office image are published.
2. The server bundle passes clean-Linux public DNS, ACME, SMTP, scheduler, portal, upgrade, and rollback acceptance.
3. A district assumes the infrastructure and backup responsibilities in `SERVER_SUPPORT_BOUNDARY.md`.
4. Required third-party notices pass release-artifact review and a reviewed release tag exists.
5. District approval, controlled live-email acceptance, and an SDMS real-data pilot are complete.

Use `NEXT_ACTION.md` for sequencing, `SECURITY_CHECKLIST.md` for verified claims, and `DECISIONS.md` for durable product boundaries.
