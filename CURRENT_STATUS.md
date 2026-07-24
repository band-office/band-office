# BandOS Current Status

**Status date:** July 24, 2026
**Release state:** verified local release candidate; not approved for public distribution

BandOS is a functioning local web and Electron desktop application covering People, groups, inventory, assignments, repairs, financial ledgers, email communications, whole-set music library records, forms, events, attendance, reports, backup/restore, rollover, and audit history.

The release-hardening baseline includes explicit staff view and mutation permissions, bounded inventory-helper access, strict event status transitions, preserved manual roster removals, atomic event reminder creation, private calendar token handling without URL exposure, authenticated file routes, encrypted backup/restore, migration rollback, deterministic demo data, and automated unit, browser, desktop-runtime, package, privacy, dependency, and archive checks.

The next product phase is Server and Family Portals, but it remains blocked until the current local release completes:

1. Canonical public repository and tagged release commit.
2. Public-source license and third-party notices.
3. Signed and notarized macOS package.
4. Signed and accepted Windows package.
5. Clean-machine acceptance on both platforms.
6. District approval, controlled live-email acceptance, and an SDMS real-data pilot.

Use `NEXT_ACTION.md` for sequencing, `SECURITY_CHECKLIST.md` for verified claims, and `DECISIONS.md` for durable product boundaries.
