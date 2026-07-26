# Band Office Next Action

The current release candidate is implemented as a functioning local web and Electron desktop application. It includes secure staff accounts and fixed roles, a unified People directory, student profiles, guardian links, reusable flat groups and memberships, group-context assignments, student fee accounts, group assessments, manual payments and credits, immutable reversals, printable statements, financial reports, shared-mailbox SMTP email, deduplicated audience previews, templates, attachments, schedules, delivery retries and reports, a whole-set music library, library loans, component exceptions, managed files and links, performance history, versioned form templates, student and guardian campaigns, response entry, uploads, reminders, retention and exports, event series, roster snapshots, RSVP, attendance, itineraries, equipment packing, volunteers, event files, reminder drafts and calendar feeds, CSV student and asset import, inventory and components, barcode/QR scanning, label printing, checkout and check-in, printable agreements, repairs, encrypted backups, verified desktop restore, audit history, guarded period rollover, and automatic desktop database migrations.

The Electron packaging and local release-hardening pass are complete. An unsigned Apple Silicon `.app`, DMG, and ZIP pass fresh startup, historical-database upgrade, recovery-snapshot, SQLite integrity, privacy-metadata, visual smoke, and archive-integrity checks. Atomic backup/restore, forced migration rollback, exact dependency pins, hard-coded-destination auditing, a manual update policy, and unsigned macOS/Windows CI acceptance jobs are in place. Optional SMTP is isolated to the communications adapter and disabled until configured.

The July 24 trust-boundary pass added explicit view permissions for People, Groups, Inventory, Repairs, and Reports; removed event data from inventory-helper and read-only dashboards; separated contact and family-link access from operational student identity; constrained event status transitions; made roster restoration explicit; made event reminder creation atomic; removed private calendar bearer tokens from page URLs; and aligned API `401`/`403` behavior with the security record.

The remaining v0.1 release gates are public-grade distribution and real-school validation:

1. Publish the verified local Git history to the canonical public repository and tag the accepted release commit.
2. Complete third-party notice verification for every packaged macOS, Windows, and server artifact.
3. Obtain Apple and Windows signing credentials; sign and notarize the macOS build.
4. Run the release-candidate workflow and accept its Windows x64 NSIS/ZIP results.
5. Run clean-machine install, backup, restore, upgrade, rollback, and uninstall checks on both platforms.
6. Complete SDMS approval and the real-data pilot before calling v0.1 stable.
7. Run the controlled live-mailbox acceptance in `EMAIL_SETUP.md`; mock transport proves workflow behavior but not district-provider policy or deliverability.

The repository now contains the first Band Office Server deployment kit and the read-only family portal. Local container acceptance is complete and recorded in `SERVER_ACCEPTANCE_RECORD.md`, including HTTPS proxy behavior, migration and restart checks, worker-secret enforcement, port isolation, and an isolated backup/restore drill.

The canonical GitHub organization and public repository are `band-office/band-office`, and the source license is Apache-2.0. The next server action is publication and external acceptance: publish the accepted source and multi-platform versioned image, deploy the generated bundle to a clean Linux server with real DNS, run the remaining checklist in `SERVER_DEPLOYMENT.md`, then test district SMTP, upgrade, and rollback. Do not describe the server path as supported for schools until those external checks pass. Google and Microsoft OAuth remain connector extensions; optional payment connectors follow server and guardian-permission acceptance.
