# Band Office Current Status

**Status date:** July 26, 2026
**Release state:** verified local release candidate; not approved for public distribution

Band Office is a functioning local web and Electron desktop application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup/restore, rollover, audit history, and a relationship-scoped read-only student/guardian portal with self-service password recovery.

The release-hardening baseline includes explicit staff view and mutation permissions, bounded inventory-helper access, strict event status transitions, preserved manual roster removals, atomic event reminder creation, private calendar token handling without URL exposure, authenticated file routes, encrypted backup/restore, migration rollback, deterministic demo data, and automated unit, browser, desktop-runtime, package, privacy, dependency, and archive checks.

The server deployment kit is implemented in the repository: secret-mounted SMTP and worker credentials, a dedicated scheduled-email worker, database-aware health checks, persistent identifier-hashed login throttling, Caddy HTTPS and security headers, non-public application ports, versioned bundle generation, and separate deployment, activation, backup/restore, upgrade, and ownership runbooks.

A local Linux ARM64 container acceptance passed on July 26. The actual stack completed migrations, HTTPS proxying, security-header checks, worker-secret enforcement, restart recovery, SQLite integrity checks, and an isolated complete-data-directory backup/restore drill. The pruned runtime dependency tree reported zero known vulnerabilities. Exact evidence is in `SERVER_ACCEPTANCE_RECORD.md`.

This is local container evidence, not a public-hosting acceptance claim. Public server release remains blocked until:

1. A canonical container registry and digest-pinned Band Office image are published.
2. The server bundle passes clean-Linux public DNS, ACME, SMTP, scheduler, portal, upgrade, and rollback acceptance.
3. A district assumes the infrastructure and backup responsibilities in `SERVER_SUPPORT_BOUNDARY.md`.
4. The canonical public repository receives the accepted source, required third-party notices pass release-artifact review, and a tagged release commit exists.
5. District approval, controlled live-email acceptance, and an SDMS real-data pilot are complete.

Use `NEXT_ACTION.md` for sequencing, `SECURITY_CHECKLIST.md` for verified claims, and `DECISIONS.md` for durable product boundaries.
