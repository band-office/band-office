# BandOS v0.1 Security and Release Checklist

**Status date:** July 24, 2026
**Release state:** local release candidate; not approved for public distribution

## Verified locally

- [x] Local director passwords use Argon2id and are never stored in plaintext (`src/lib/auth.ts`).
- [x] Session tokens are random, stored only as SHA-256 hashes, sent in HTTP-only strict same-site cookies, and expire after inactivity (`src/lib/auth.ts`).
- [x] Application pages, exports, and backups require a valid local session; APIs distinguish unauthenticated `401` from authenticated-but-forbidden `403` (`src/proxy.ts`, `src/lib/auth.ts`, route tests).
- [x] Director, assistant director, inventory helper, and read-only roles have explicit view and mutation permissions enforced by server actions, APIs, direct-route guards, and permission-aware controls. Inventory helpers can see operational student identity, groups, holdings, inventory, repairs, and fixed reports, but cannot view contact details, guardian relationships, financials, communications, forms, events, notes, or exports (`src/lib/auth.ts`, page and browser tests).
- [x] Inventory lifecycle changes and destructive operations are transactional and append audit records (`src/lib/inventory-service.ts`).
- [x] Financial entries are immutable, signed ledger records; group assessments snapshot active students, corrections post equal-and-opposite reversals, and every posting is audited in the same transaction (`src/lib/financial-service.ts`, financial tests).
- [x] Communication audiences are deduplicated and frozen before delivery; guardian relationship eligibility and address-level disabled, invalid, or suppressed states are resolved before a destination becomes sendable (`src/lib/communications-service.ts`, communication tests).
- [x] Successful destinations are never resent by a failure retry; every provider attempt has a bounded result row, and audit diffs redact message, attachment, and recipient contents (`src/lib/communications-service.ts`).
- [x] Desktop SMTP credentials use operating-system encrypted storage and enter the child server only through process memory after restart. Credentials are excluded from SQLite, exports, audit diffs, and backups (`desktop/main.mjs`, `desktop/preload.cjs`).
- [x] Scheduled desktop email is processed by an authenticated loopback worker only while BandOS is running. Jobs missed during downtime become `OVERDUE` and require staff confirmation (`desktop/main.mjs`, worker route, communication tests).
- [x] Form versions become immutable when published; campaigns snapshot student and guardian recipients; required answers, ordinary acknowledgment timestamps, response changes, waivers, reminders, and retention purges are transactionally audited (`src/lib/forms-service.ts`, forms tests).
- [x] Form uploads reject executable and active-web extensions, use relative managed storage keys and authenticated downloads, and purge file content while retaining completion history (`src/lib/form-storage.ts`, form download route, forms tests).
- [x] Events preserve group-derived roster snapshots; roster refresh adds only never-seen current members, manual removals retain RSVP and attendance history, and restoration requires an explicit individual add (`src/lib/events-service.ts`, event tests).
- [x] Attendance stores only present, absent, late, excused, or not-recorded status. The schema contains no reason field, and all attendance writes are permission-checked and audited (`prisma/schema.prisma`, `src/lib/events-service.ts`).
- [x] Public calendar feeds expose only published or completed public event details. Private feeds require a high-entropy bearer token stored only as a SHA-256 hash and support explicit revocation. New private links are revealed through a two-minute HTTP-only same-site cookie and never transit a page URL (`src/lib/calendar-feed.ts`, calendar routes, browser tests).
- [x] Event uploads reject executable and active-web extensions, use relative managed storage keys and authenticated downloads, and restore with the event records (`src/lib/event-storage.ts`, event download route, desktop restore tests).
- [x] Volunteer opportunities enforce bounded capacity and retain canceled assignment history; event reminders create the reviewable Email announcement, audience snapshot, scheduled job, reminder link, and audit records in one database transaction rather than sending directly (`src/lib/events-service.ts`, `src/lib/communications-service.ts`, event tests).
- [x] Backup CSVs and `bandos.db` come from one SQLite snapshot, with no live-query split (`src/app/api/backup/route.ts`).
- [x] Backup validation checks format version, required tables, SQLite integrity, foreign keys, manifest ownership, all 51 current CSV row counts, and every managed library, form, and event file's size and SHA-256 hash while retaining version-2 through version-7 restore compatibility (`desktop/backup-archive.mjs`).
- [x] Library uploads reject executable and active-web extensions, store only relative managed keys, require copyright acknowledgment, use controlled authenticated downloads, and restore with the database (`src/lib/library-storage.ts`, `src/app/api/library/files/[id]/route.ts`).
- [x] Restore preserves the current database, recovers an interrupted swap, and never accepts an unverified archive (`desktop/data-lifecycle.mjs`, `scripts/test-desktop-runtime.mjs`).
- [x] Existing databases receive a pre-migration snapshot; forced migration failure restores it without WAL/SHM residue (`desktop/migrations.mjs`, `scripts/test-desktop-runtime.mjs`).
- [x] Historical v0.1 upgrade preserves program, person/student profile, derived section group, group membership, group-context assignment, and asset rows; it adds empty financial, communication, library, forms, and events tables and passes integrity and foreign-key checks (`scripts/test-desktop-runtime.mjs`).
- [x] Desktop rendering is sandboxed with context isolation, Node integration disabled, external navigation denied, and renderer requests restricted to the loopback application origin (`desktop/main.mjs`).
- [x] Camera access is director-initiated and video-only; microphone, audio-capture, Bluetooth, and unrelated Electron permissions are denied or stripped (`desktop/main.mjs`, `scripts/after-pack-desktop.mjs`).
- [x] Runtime source, local assets, entitlements, exact dependency pins, and packaged data exclusions pass `npm run audit:release` (`RELEASE_AUDIT.json`).
- [x] A clean `npm ci` installation passes the full dependency-tree audit with no missing, invalid, or extraneous packages (`npm run audit:tree`).
- [x] The production-dependency registry advisory audit reported zero vulnerabilities on July 24, 2026 with Next.js 16.2.11 plus patched transitive Hono server and Valibot overrides (`npm run audit:dependencies`). Development and packaging dependencies are governed separately by exact pins, the clean-tree audit, packaged-source exclusions, and manual updates.
- [x] The packaged macOS executable passes fresh startup, historical upgrade, recovery snapshot, rendered-window, SQLite integrity, foreign-key, and camera-only privacy-metadata acceptance (`npm run test:desktop-package`).
- [x] The unsigned DMG verifies, the ZIP has no corrupt entries, and SHA-256 checksums are recorded (`dist-desktop/SHA256SUMS.txt`).
- [x] The update policy is manual and makes backup, recovery snapshot, and rollback requirements explicit (`UPDATE_POLICY.md`).

## External gates still required

- [ ] Publish the verified local Git history to the canonical public repository and tag the accepted release commit.
- [ ] Select the public-source license and complete third-party notice review.
- [ ] Sign and notarize the macOS application and verify Gatekeeper acceptance on a separate clean Mac.
- [ ] Build, sign, install, back up, restore, upgrade, and uninstall the Windows x64 application on a clean Windows machine.
- [ ] Verify the GitHub Actions Windows artifact and packaged acceptance job; local macOS work cannot satisfy this gate.
- [ ] Complete principal/district approval before loading SDMS student data.
- [ ] Complete the SDMS real-data checkout pilot and verify a restore from its encrypted backup.
- [ ] Complete a controlled live SMTP test through the approved school mailbox, including reply routing, an attachment, a rejected address and retry, downtime scheduling, and restore verification.
- [ ] Implement and security-review Google and Microsoft OAuth adapters before claiming first-class support for those provider paths.

Unsigned artifacts remain test builds. Passing local automation does not authorize public distribution or real student-data use.

## Reproducible commands

```bash
npm ci
npm run release:verify
npm run desktop:dist:mac
npm run test:desktop-package
```

`release:verify` runs lint, unit tests, production build, standalone-runtime preparation, desktop migration/restore acceptance, Playwright workflow acceptance, the static release audit, the dependency-tree audit, and the npm advisory audit.
