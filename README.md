# BandOS

BandOS is a free, open-source Charms Office/CutTime alternative for school music programs. The current release candidate is a functioning local-first program directory, group, access, inventory, assignment, student-fee ledger, outbound email console, whole-set music library, routine forms system, and events and attendance workspace.

It does not yet replace all of CutTime. Granular guardian permissions, household accounting, payment processing, and family portals are later releases and do not appear as inactive navigation. Standard SMTP email, Music Library, director-side Forms, and Events are implemented; Google and Microsoft OAuth connections remain planned adapters.

## What works now

- First-run program setup and local staff accounts protected with Argon2id
- 30-minute inactivity sessions and protected application/export routes
- A unified People directory for students, guardians, staff, boosters, and external contacts
- Multi-classification people, student profiles, guardian/student links, and reusable flat groups
- Director, assistant director, inventory helper, and read-only staff roles with server-enforced permissions
- Student fee accounts with individual charges, manual payments, credits, current balances, printable statements, and immutable reversals
- Group assessments that snapshot active student membership at posting time
- Financial balance, transaction-ledger, assessment-history, and individual-statement CSV exports
- Shared-mailbox SMTP configuration and verification, with no password stored in SQLite, exports, or audit history
- Email targeting by contact type, group, grade, guardians of students, or selected people
- Guardian deduplication across linked students, immutable audience previews, address-level contact holds, attachments, templates, schedules, retries, and visible delivery failures
- Desktop background delivery while BandOS is open, with staff confirmation required after a missed scheduled time
- Announcement-history, recipient-delivery, and contact-readiness CSV reports
- Whole-set score-and-parts catalog with audited loans, missing-component history, performance history, and overdue tracking
- Managed local library files and approved HTTPS links with copyright acknowledgment, hashes, retention status, and controlled download
- Versioned form templates with short and long text, single and multiple choice, checkboxes, ordinary acknowledgments, and managed file uploads
- Form campaigns for students, guardians, or both, resolved from active people, grades, and groups into permanent recipient snapshots
- Staff response entry, drafts, completion and waiver tracking, reviewable email reminder drafts, retention purge, and six form CSV reports
- Event series, public and private events, preserved group-based roster snapshots, itinerary, RSVP, attendance, equipment packing, and trip rosters
- Bounded volunteer opportunities and assignments, managed event files and approved HTTPS links, and reviewable email reminder drafts
- Public iCalendar subscription and embeddable calendar page, plus revocable private calendar links whose bearer tokens are stored only as SHA-256 hashes
- Event roster, RSVP, attendance, absence, volunteer, trip-roster, and equipment-list CSV reports
- Mapped student and asset CSV imports with a dry-run preview and automatic section-group membership
- Permanent person, group-membership, and assignment history
- Instrument, uniform-piece, and equipment inventory with attached components
- Barcode and QR lookup by camera or connected scanner, using asset tags or serial numbers
- Single-asset and batch QR/Code 128 label printing on Letter-sized label sheets
- Keyboard-first checkout and check-in to any active person, with optional validated group context, condition snapshots, and expected returns
- Printable, director-editable paper checkout agreements
- Atomic damage return and repair creation
- Repair queue, vendor/cost tracking, closeout, and lifetime service history
- Thirty-one program-level CSV reports, individual statement exports, browser print layouts, and operational queues
- Encrypted full backups containing 51 CSV tables, a manifest, managed library, form, and event files, and a consistent SQLite snapshot
- Append-only audit history for record changes, imports, exports, and backups
- Archive-gated operating-period rollover with configurable graduation grade

## Desktop test build

An unsigned Apple Silicon macOS package is available in [dist-desktop](./dist-desktop):

- `BandOS-0.1.0-mac-arm64.dmg`
- `BandOS-0.1.0-mac-arm64.zip`
- `SHA256SUMS.txt`

The desktop app requires no terminal, Node.js, or Docker. It creates and migrates its private SQLite database under `~/Library/Application Support/BandOS/data/bandos.db`; logs and pre-migration or pre-restore recovery snapshots stay in the same BandOS application-data directory. SMTP credentials use operating-system encrypted storage under the BandOS application-data root and never enter the database. Encrypted backup and verified restore remain available in Settings. Camera access is requested only when the director starts barcode or QR scanning; connected USB and Bluetooth scanners work through the same asset-tag field without camera permission.

These artifacts are for local testing. They are not Apple-signed or notarized, so macOS may block or warn on first launch. Do not present the unsigned package as the public director download.

## Clean local setup

Requires Node.js 20.9 or newer.

```bash
npm install
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first-run screen creates the program, opening school-year period, and director account. Use a password with at least 12 characters.

To replace an empty local database with the deterministic Ridgeline demo instead, run `npm run db:init`. That command is destructive and must never be used against real program data.

## Docker

```bash
docker compose up --build
```

Compose runs one container and mounts the SQLite database at `/data/bandos.db`. Demo data is off by default. To load Ridgeline into a new empty volume:

```bash
BANDOS_LOAD_DEMO=true docker compose up --build
```

## Backups

Settings offers an encrypted `.bandos` archive by default and an explicitly marked readable ZIP export for district-approved encrypted storage. The passphrase is never stored and cannot be recovered.

Verify that an archive decrypts, contains every required file, passes SQLite integrity checking, and matches CSV row counts:

```bash
npm run backup:verify -- /path/to/backup.bandos "your backup passphrase"
```

Rollover remains blocked until every assignment is resolved and a backup newer than the latest record mutation exists.

## Email setup

Open Email, then Shared mailbox. Standard SMTP is the currently implemented connector. Desktop users store the SMTP password through operating-system encrypted storage and restart BandOS before verification. Local-server and Docker administrators set `BANDOS_SMTP_PASSWORD` in the process environment. Sender settings, templates, announcements, attachments, audience snapshots, attempts, queue state, and contact holds are included in version-8 backups; credentials are not.

Scheduled desktop email runs only while BandOS is open. If a scheduled time passes while it is closed, the message is held until a staff user confirms delivery. Provider acceptance records SMTP handoff, not guaranteed inbox delivery. See [EMAIL_SETUP.md](./EMAIL_SETUP.md).

## Verification

```bash
npm ci
npm run release:verify
```

The release gate runs lint, 42 seeded unit tests, a production build, desktop migration and restore failure-path acceptance, the complete Playwright workflow, static privacy/network/package audits, a clean dependency-tree check, and the production-dependency npm advisory audit. Development and packaging dependencies remain exact-pinned and separately reviewed. See [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) and [UPDATE_POLICY.md](./UPDATE_POLICY.md) for the evidence record and manual update rules.

Build an unsigned desktop application for the current platform:

```bash
npm run desktop:pack
npm run desktop:dist:mac   # macOS DMG and ZIP
npm run desktop:dist:win   # Windows NSIS installer and ZIP; run on Windows
```

Desktop packaging compiles the standalone application, rebuilds native modules for Electron, packages the app, and restores the contributor installation to the normal Node ABI. See [DESKTOP_PACKAGING.md](./DESKTOP_PACKAGING.md) for data paths, release commands, and signing gates.

The unit suite recreates only `data/test.db`. The browser suite recreates only `data/e2e.db`, starts an isolated loopback server on port 3102, and verifies first-run auth, CSV import, SMTP configuration, financial workflows, whole-set library workflows, a complete versioned form campaign, an event with RSVP, attendance, equipment, volunteers, managed files, reminders and calendar feeds, inventory checkout, repair creation, encrypted backup verification, logout, and API protection. Neither suite resets `data/bandos.db`.

## Privacy boundary

The People directory stores names, optional email and phone, classifications, student grade/ID, group membership, and explicit guardian/student links. Financial records store student-linked charges, payments, credits, references, group context, and reversals; they do not store card or bank credentials. Communication records store authored messages, attachment bytes, audience snapshots, recipient addresses, and delivery outcomes. Form records store assigned recipients, answers, ordinary acknowledgment timestamps, and approved uploads under explicit retention rules. Event records store roster snapshots, RSVP, attendance status, itineraries, equipment, volunteers, reminders, and approved files; there is no attendance-reason field. Only director and assistant-director roles can access communications, forms, and events. The schema intentionally has no address, birthdate, medical, photo, or disciplinary fields. Inventory helpers can use names, grade, student ID, groups, holdings, inventory, repairs, and fixed reports, but cannot view contact details, guardian relationships, financials, communications, forms, events, notes, or exports. Student and guardian portals do not exist in the local release.

> No medical, disciplinary, or family information. This field is exported in reports.

Run BandOS on a district-managed, disk-encrypted machine. Store backups and readable exports only in district-approved locations, and clear real student-data use with school administration.

## Release status

The application workflow and unsigned Apple Silicon desktop package are usable as a release candidate. The packaged app has passed clean-profile startup, historical-database upgrade, recovery-snapshot, SQLite integrity, privacy-metadata, visual smoke, DMG verification, and ZIP integrity checks. Apple signing/notarization, Windows packaging and clean-machine acceptance, a public license decision, district approval, and the SDMS real-data pilot remain gates before v0.1 should be called stable or offered as a public director download.
