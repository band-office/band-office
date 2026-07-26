# Band Office: Product Strategy and v0 Specification

**Date:** July 4, 2026
**Revised:** July 24, 2026
**Mode:** Product architecture and staged implementation authority.
**Author context:** Prepared for Joshua Bloodworth. 15 years as a band director. Current commitments: Practical AI Workbench launch blockers, Gig City AI v1 site build, MBA, SDMS band program, Unit27 Research.

## 1. Blunt Verdict

**Is Band Office worth reviving?** Yes, as a phased open-source replacement for the operational jobs directors once handled in Charms Office and now handle in CutTime. It is not credible as a single release. It is credible as a modular product in which every release replaces one complete band-room workflow.

**The sharpest wedge:** the physical asset lifecycle. Instruments, uniforms, and school-owned equipment. Who has what, in what condition, since when, with what repair history, and how it all closes out at year end.

This wedge wins for four reasons:

1. It is the domain with the least student PII. A checkout ledger needs a name, a grade, and a section. It does not need guardians, phone numbers, medical data, or balances.
2. It is the domain where data ownership matters most. An instrument fleet is a six-figure district asset with a 20-year service life. Its history should not live inside a vendor subscription that disappears when the school stops paying or the vendor gets acquired.
3. It is the domain a single director controls without district procurement. Sending SMS to parents requires vendor agreements. Tracking which tuba is in which locker does not.
4. You can dogfood it at Soddy Daisy and publish it for the young directors and small programs it is meant to serve.

**What makes the full vision dangerous:** communication, payments, forms, and parent portals carry most of the compliance, uptime, security, and support burden. They belong on the roadmap because they are part of the replacement goal, but none belongs in the first release. The failure mode is attempting horizontal parity before one vertical workflow works in a real band room.

**The honest framing:** Band Office is public-interest infrastructure for school music programs that cannot justify another annual subscription. SDMS is the reference deployment, not the only intended user. Public usefulness is the mission even though the project does not depend on interviews, formal pilots, or an adoption target.

**Opportunity cost, stated plainly:** Band Office is not a near-term revenue project. Practical AI Workbench and Gig City AI still have commercial priority. Planning the full replacement does not authorize building all of it. The implementation sequence begins only when a calendar slot exists, and it begins with the asset lifecycle module already specified below.

## 2. Existing Landscape

**Category:** fine arts program management software, a niche of K-12 operational SaaS.

CutTime currently presents six primary product surfaces: members, communications, financials, inventory, administration/forms, and district management. It also connects fundraising and event-ticketing products. Those categories define the replacement landscape, but they do not dictate Band Office's information architecture or release order. Sources: [CutTime overview](https://gocuttime.com/) and [current feature summary](https://gocuttime.com/features).

The category converged on cloud SaaS, per-program subscriptions, parent-facing portals, payments, and communications. Nobody in the category is meaningfully open source, self-hosted, or centered on a director-owned complete operational history in open formats.

That gap is real. It is also real for a reason: communications, payments, portals, and support are operational services, not merely software screens. Band Office must distinguish between features that work entirely on school-controlled infrastructure and optional connectors that depend on email or payment providers.

**Replacement means job coverage, not screen parity.** Band Office replaces a CutTime capability when a director can complete the corresponding real workflow, preserve its history, export the result, and recover from failure without returning to CutTime. Similar-looking menus do not count.

**What Band Office must not copy:** magic-link authentication UX, seasons concept/naming, import template structures, usage agreement wording, portal layouts, fundraising concepts, QR tag workflows as designed by competitors, or any screenshot, icon, color scheme, or marketing language from existing vendors. Build every workflow from band-room reality.

**Open-source and self-hosted tools worth borrowing from conceptually:**

- **Snipe-IT:** mature IT asset management. Assets, checkouts, maintenance records, audits, labels. Closest reference for the wedge, but not the base.
- **InvenTree:** useful stock and location modeling reference.
- **PartKeepr:** mostly dormant, reference only.
- **Grocy:** good example of a self-hosted tool with personality and narrow, opinionated scope.

General patterns to borrow: a no-terminal desktop installer for directors, single-container Docker deployment for district IT, SQLite as the local database, CSV in and CSV out as first-class features, and printable labels.

## 3. Product Thesis

**One sentence:** Band Office is a free, open-source, local-first program management system for school music organizations, built so young teachers and under-resourced programs can run their operations without an annual software subscription or vendor-controlled history.

**The product model:** one program per installation, a small shared foundation, and independently releasable modules. The foundation owns program identity, operating periods, people, groups, permissions, audit history, import, export, and backup. Modules own inventory, financials, communications, library, forms, events, and portals. Band Office remains a modular monolith, not a collection of services.

**Who it is for:**

- Early-career teachers who inherited a program without mature administrative systems.
- Small, rural, rebuilding, and under-resourced programs where a commercial subscription competes with instruction, repairs, music, or supplies.
- Directors who need ordinary desktop software, not a server-administration project.
- District IT teams willing to host the same open-source application centrally when local desktop deployment is not appropriate.
- Districts whose data policies make third-party student data vendors painful to approve.
- Directors mid-migration after a vendor shutdown or price change who need a permanent home for program history.
- SDMS as the first reference deployment.

**Who early releases are not for:**

- Programs that need parent portals or online payments before those modules reach a stable release.
- Boosters seeking a fundraising storefront or ticket-sales platform.
- Chromebook-only programs whose district will neither install a desktop application nor host Band Office on a server.
- Districts that require vendor DPAs, SOC 2 reports, and support contracts.

**What pain it solves first:** the August and May problem. In August, a director checks out 50 to 200 instruments and uniform sets in a chaotic week and needs each assignment recorded with condition in under a minute per student. In May, the director needs everything back, needs to know what is missing and damaged, and needs a clean report for the school and boosters. Between those two points, repairs happen and nobody remembers which trombone went to the shop twice.

**What it ultimately replaces:** the daily operational loop around rosters and households, groups and memberships, assets and music libraries, charges and receipts, forms and acknowledgments, events and attendance, announcements, portals, audit history, and period transition. Fundraising commerce and district-wide enterprise administration remain separate decisions.

**Why open source and self-hosted matters here:**

- Instrument fleets outlive vendors, directors, and subscription budgets.
- No per-student pricing means no pressure to trim data or accounts.
- Student data that never leaves a school-controlled machine is a strong local-first privacy posture, provided the machine is district-managed, disk-encrypted, and backed up to district storage.
- An inspectable codebase fits the Unit27 stance: visible claims, bounded authority, human accountability.

**Product principles:**

1. Open formats are part of every module's definition of done.
2. Local-first is the default; external services are optional, named connectors.
3. No module may silently expand the data collected about a student.
4. A module ships only when it replaces a complete real workflow.
5. Band Office never copies a competitor's interface, language, forms, or proprietary file structures.
6. Normal director use never requires a terminal, Node.js, Docker, or database administration.
7. Migration and first-run guidance are product features, not documentation left for later.

## 4. v0 Scope

**Cut from v0: forms and signatures.** Forms drag in guardians, legal acknowledgment weight, delivery tracking, and the question of what a digital signature means at your school.

**Changed shape: "simple forms" becomes printable paper plus a status flag.** Band Office generates a printable checkout agreement from a director-editable text template, pre-filled with student name, asset details, and condition. The parent signs paper. The school files it. The director marks the assignment "agreement on file."

**Added: audit log from day one.** Every create, update, delete, checkout, and checkin gets an append-only log row with timestamp and acting user.

**Added: one-click full export and backup.** A single button produces a zip containing every table as CSV plus a copy of the database file.

**v0 feature list:**

1. **Roster import.** CSV in, with a column-mapping step. Minimal fields: first name, last name, grade, section/instrument, optional school ID.
2. **Asset inventory.** One unified asset model with categories: instrument, uniform piece, equipment. Uniform pieces are separate assignable assets. Cases, mouthpieces, necks, barrels, straps, and similar instrument components attach to a primary instrument and carry present/missing/damaged/replaced status without becoming separate loans. Core asset fields: category, make, model, serial number, school asset tag, size, condition, status, purchase year, estimated value, location, notes.
3. **Barcode, QR, and label workflow.** Resolve any inventory item from its school asset tag or serial number using a camera, connected barcode scanner, or manual entry. Scanning is available from the fleet, checkout, and check-in workflows. Print individual or batch QR and Code 128 labels on Letter-sized sheets. Labels encode the existing school asset tag rather than a proprietary identifier.
4. **Assignments.** Check an asset out to a member with a condition snapshot, checkout date, and expected return date. Check it in with a condition snapshot and date. Assignment history preserved forever per asset and per member. Agreement-on-file flag per assignment.
5. **Checkout station view.** Fast August rush screen: search or scan the asset, select the student, snapshot condition, print agreement, done in under 30 seconds.
6. **Repair log.** Per asset: date out, vendor, description, cost, date back, status. Open repairs visible on a queue screen.
7. **Reports and exports.** Who has what. What is unassigned. What is overdue for return based on `expected_return_at`. What attached components are missing or damaged. Repair spending by period and by asset. Total fleet value. Every report exports to CSV and prints cleanly.
8. **Period rollover.** Guided sequence: show outstanding assignments, drive them to checkin or written-off status, archive the period as an export bundle, advance grades where applicable, mark or remove graduated members, open the next period. The default period is a school year.
9. **Audit log and full backup export.**
10. **Single-user auth.** One director account with a password. Roles come later.

**What v0 explicitly is:** the first production module of the Charms/CutTime replacement. It replaces the asset lifecycle workflow, not the entire platform.

## 5. Replacement Roadmap

Version numbers express maturity, not calendar promises. Each phase must be useful on its own and must pass a real SDMS operating cycle before the next high-risk phase begins.

### v0.1: Assets and assignments

The v0 scope in Section 4. Replacement outcome: retire the instrument, uniform, and equipment checkout spreadsheet.

### v0.2: People, groups, and access (implemented foundation)

- One program per installation, with operating periods that default to a school year.
- One unified person record with one or more classifications: student, guardian, staff, booster, or external contact. Student-only fields live in a linked student profile.
- Permanent flat group definitions with dated memberships; one person may belong to multiple groups. Asset assignments may retain the relevant group context.
- Explicit guardian-to-student links with relationship label, primary-contact status, and communication eligibility.
- Local director, assistant director, inventory helper, and read-only staff accounts with server-enforced permission sets. Inventory helpers cannot view notes or export data.
- Student CSV reconciliation creates or reuses section groups and memberships. Historical v0.1 member rows, sections, and assignments migrate to the new model without changing their IDs.

Households, configurable capability grants, financial/portal guardian permissions, contact verification, and student/guardian authentication remain deferred to the modules that need them. Replacement outcome: Band Office now provides the authoritative person, group, staff-access, and asset-responsibility foundation for one program; it is not yet the family portal or household-statement system.

### v0.3: Financial ledger (implemented foundation)

- Individual charges and bulk charges to the active student members of a group. Grade, section, and ensemble assessments use the same flat-group mechanism.
- Manual payments and credits with date, description, optional group context, and reference while payment occurs elsewhere.
- Student-owned balances calculated from immutable signed entries; no mutable balance field exists.
- Equal-and-opposite reversals preserve the original entry and correction reason under audit.
- Printable individual statements plus CSV exports for balances, the full transaction ledger, group assessment history, and individual statements.
- Group assessments snapshot membership into separate student entries, so later membership changes do not rewrite financial history.
- Director and assistant-director financial access. Inventory helpers and read-only users cannot view financial records.
- No card or bank credentials stored by Band Office.

Deferred financial extensions: payment-to-charge allocation, waivers/write-offs as distinct entry types, printable receipts, deposit batches, financial-period close, transfers, refunds, household statement snapshots, and payment-provider reconciliation. Replacement outcome for the implemented foundation: a director can retire a simple student-account spreadsheet that tracks charges, credits, manual payments, balances, statements, and reports without adopting online payments.

### v0.4: Email communications

- Outbound email through a shared program mailbox using Google or Microsoft OAuth or standard SMTP.
- Recipient targeting for guardians, students, staff, boosters, external contacts, groups, grades, sections, and selected people.
- Guardian deduplication across siblings while preserving why each recipient was included.
- Templates, attachments, scheduling, audience preview, sent history, delivery status, and a visible failure queue.
- Replies return to the connected school mailbox; Band Office is not a two-way inbox.
- Contact states include enabled, disabled by contact, invalid/bounced, and administratively suppressed.
- Desktop scheduling runs only while Band Office is open; overdue messages require confirmation on reopen. Unattended scheduling requires the server edition.
- Remind support is limited to a copy/export handoff unless Remind publishes and approves a suitable outbound API. SMS is not a Band Office core capability.

Replacement outcome: programs with an approved email connection can move routine announcements from CutTime without adopting an SMS vendor.

### v0.5: Music library (implemented)

- One library item represents one complete score-and-parts set; individual parts are not separately inventoried.
- Catalog metadata, storage location, comments, missing-component notes, and performance history.
- Whole-set loans with borrower, checkout date, expected return date, return status, and history.
- Optional local digital files and links, with explicit copyright and retention warnings.

Replacement outcome: retire the music-library spreadsheet while preserving the program's performance and loan history.

### v0.6: Forms (implemented)

- Versioned form templates with short text, long text, choices, checkboxes, file uploads, and acknowledgments.
- Requests to members, guardians, or both; completion status, reminders, response exports, and per-form retention rules.
- Acknowledgments are ordinary recorded responses, not legal eSignatures. Band Office does not implement eSignature.
- Director and assistant staff can record paper, in-person, or approved-channel responses in the local release. Student and guardian self-service uses the same request records later, after portal authentication and relationship authorization pass their separate security gate.

Replacement outcome: routine information collection no longer requires CutTime, while official district forms may remain in district systems.

### v0.7: Events, calendars, attendance, and volunteers (implemented)

- Events, series, locations, itineraries, attachments, RSVP, trip rosters, equipment lists, and scheduled email reminders.
- Private and public subscribable calendars, including an embeddable public feed.
- Attendance states: present, absent, late, excused, and not recorded. Staff may edit in the current release; student and authorized guardian views wait for v0.8 relationship authorization. There is no medical or disciplinary reason field.
- Bounded volunteer opportunities, capacity, signup lists, and exports.

Replacement outcome: retire the event, trip-list, attendance, and volunteer spreadsheets.

### v0.8: Server edition and family portals

- Multi-user server deployment with Postgres and reliable background jobs.
- Staff passwords with optional authenticator-app two-factor authentication.
- Student and guardian access through emailed one-time codes; person records never become authentication records.
- Guardian and student self-registration may create an access request, but staff approval and relationship verification are required before any program record becomes visible.
- Guardian portal parity for linked students, assignments, announcements, applicable events, calendar subscription, financial statements and receipts, forms, reminders, and attendance visibility, subject to relationship permissions.
- Student portal access to the same student-facing records. Financial visibility is a program-level option that is off by default.
- No eSignature, online payment, SMS, or two-way messaging in the portal.

Replacement outcome: families can retrieve their authorized current program information without staff mediation.

### v0.9: Payment connectors

- Optional provider adapters for hosted checkout pages and webhook-confirmed receipts.
- Band Office stores provider references and ledger events, never card or bank credentials.
- Reconciliation, refunds, reversals, idempotency, and failed-webhook recovery are required before release.

Replacement outcome: approved programs can accept payments while keeping the internal ledger provider-independent.

### v1.0: Single-program replacement release

v1.0 is earned when the reference program can complete one full school year using Band Office for roster management, inventory, library, events, manual financials, forms, communications, family access, rollover, backup, and export without relying on CutTime for those jobs.

District dashboards, inter-school transfers, native mobile apps, fundraising commerce, and first-party hosting are not required for v1.0.

## 6. Scope Boundaries

**Not in the current release candidate, but present on the replacement roadmap:**

- Household aggregation and combined household statements.
- Granular guardian permissions for financials, forms, events, attendance, and portals.
- Financial allocation, receipt, household-statement, period-close, and optional payment-connector extensions.
- Member and guardian portals.
- District administration, only after the single-program release is stable.

**Not planned as native Band Office capabilities:**

- Fundraising storefronts, product sales, ticketing, and donor cultivation. Integrate or export instead.
- Grade, GPA, eligibility tracking, or UIL/TSSAA-style eligibility logic.
- Medical information, allergy lists, and medication tracking.
- Disciplinary records or behavior notes.
- Full volunteer-management systems beyond bounded event opportunities.
- Deep SIS integrations. CSV remains the baseline integration; optional district-owned adapters may come later.
- Native mobile apps before responsive web and installable PWA behavior prove insufficient.
- A first-party hosted Band Office cloud service. Hosting would be a separate business and compliance decision.
- Native SMS delivery. Band Office may provide a Remind-ready copy/export handoff, but it does not depend on an undocumented integration.
- eSignature.
- Chat, AI assistants for parents, or AI features that write to records or send anything.
- Photo storage of students.
- Audition scoring and placement decisioning.
- Drill design. OpenMarch is the appropriate open-source project for the Pyware problem.

## 7. Data Model

Conventions: **R** required, **O** optional, **S** sensitive, **D** dangerous.

The schema is staged. The current release builds the program, staff authentication, person, student profile, classification, group, membership, guardian relationship, asset, attached component, assignment, repair, financial, communication, music-library, operating-period, backup, session, and audit records. Later subsections define approved contracts for future modules. Extensions arrive through explicit migrations and do not overload unrelated entities.

### program and user (foundation)

- One `program` root scopes people, groups, staff users, assets, operating periods, and audit records. A district-level organization wrapper is deferred until district management is specified.
- `user` is a staff authentication identity, not a student or guardian record.
- Role grants are scoped by program and capability. A role never gains access merely because a new module is installed.

### person, student profile, and classification

- `person`: id (R, generated), program_id (R), first_name (R, S), last_name (R, S), email (O, S), phone (O, S), status (active, inactive, graduated, archived), notes (O, D-labeled).
- `student_profile`: person_id (R), program_id (R), grade (R), school_student_id (O, S). Non-students never receive placeholder grade or school-ID fields.
- `person_classification`: person_id plus student, guardian, staff, booster, or external. A person may hold multiple classifications.
- Excluded by design (D): mailing address in the current release, date of birth, photo, gender, race/ethnicity, medical anything, lunch status, and IEP/504 flags.

### guardian relationships and future households

- `guardian_student`: guardian_person_id, student_person_id, relationship_label, primary_contact, receives_communication. Both people belong to the same program; the student must have a student profile.
- A future `household` groups related people for communication and combined statements without assuming one family structure or creating one shared financial balance.
- Future module-specific guardian permissions and email preferences are explicit records. An address existing in the database will not by itself authorize a bulk send or portal access.

### group, operating_period, and membership (v0.2)

- One installation has one program and a flat list of reusable groups such as Concert Band, Jazz Band, Percussion, Guard, Trumpets, or Trip A.
- `group`: id, program_id, name, kind, active. Groups do not nest.
- `operating_period`: id, program_id, label, starts_at, ends_at, status, period_kind. The default kind is school year, but programs may use another period structure.
- `group_membership`: group_id, person_id, role_label (O), started_at, ended_at (O).
- Group definitions persist. Membership intervals preserve history, and a person may belong to multiple groups at once. Assignment and financial records snapshot their own operating period and group context rather than reinterpreting current membership.
- The v0.1 `section` string is migrated to a section group and active membership.

### asset

- id (R)
- category (R): instrument, uniform, equipment, locker (later)
- make (O), model (O), serial_number (O), school_asset_tag (O but strongly encouraged)
- size (O), condition (R): excellent, good, fair, poor, unusable
- status (R): available, assigned, in_repair, retired, missing
- purchase_year (O), estimated_value (O), location (O), notes (O, D-labeled)

`asset_component` records included cases, mouthpieces, necks, barrels, straps, stands, or other components attached to a primary instrument. Components may be marked present, missing, damaged, or replaced, but they are not independently checked out in the first inventory release. Uniform garments remain separate assets so individual jackets, bibbers, bags, and other pieces can be assigned and returned independently.

`asset.status` is stored for fast filtering, but it is not freeform truth. The application enforces these invariants in the same transaction as the relevant assignment or repair change:

- an asset with an open assignment is `assigned`
- an asset with an open repair and no open assignment is `in_repair`
- an asset with no open assignment or repair is `available`, unless manually marked `retired` or `missing`
- `retired` and `missing` block new checkout until the director changes the status

### assignment

- id (R), asset_id (R), person_id (R), group_id (O), operating_period_id (R)
- checked_out_at (R), expected_return_at (O), condition_out (R), agreement_on_file (R, boolean, default false)
- checked_in_at (O), condition_in (O)
- resolution (O): returned, written_off, transferred
- notes (O, D-labeled)

### repair

- id (R), asset_id (R), operating_period_id (R), opened_at (R), description (R)
- vendor (O), cost (O), closed_at (O), status (R): open, at_vendor, closed

### financial ledger (v0.3 implemented foundation)

- A student person is the ledger owner; no separate mutable account or balance row exists. Siblings never share a balance.
- `financial_batch`: program_id, operating_period_id, group_id, description, positive amount_per_student, occurred_at, due_date (O), created_at, created_by. It records the bulk-posting event and retains its group context.
- `financial_entry`: program_id, person_id, operating_period_id, group_id (O), batch_id (O), type (charge, payment, credit, reversal), signed amount, occurred_at, due_date (O), description, reference (O), reversal_of_id (O, unique), created_at, created_by.
- Charge amounts are positive. Payment and credit amounts are negative. A reversal is the exact opposite of its original signed amount.
- Balances are calculated from financial entries. Posted records have no update or delete path in the application.
- Group assessments create one immutable charge per active student at posting time. The batch is evidence of the shared posting; each student entry remains independently reversible.
- Later explicit migrations may add allocation, payment detail, deposit batch, financial period close, statement snapshot, transfer/refund/write-off types, household views, and provider-transaction reconciliation. None is implied by the current schema.

### library records (v0.5)

- `library_item`: one complete score-and-parts set with title, composer, arranger, publisher, grade, category, storage_location, acquisition details, status, and comments.
- `library_component_note`: bounded notes for missing or replaced score/part components; components are not separately inventoried or checked out.
- `library_loan`: item_id, borrower contact or organization text, checked_out_at, expected_return_at, returned_at, status, notes.
- `performance_record`: item_id, event or performance name, performed_at, group_id (O), conductor (O), notes (O).
- `library_file`: metadata, local storage key, content hash, copyright warning acknowledgment, and retention status. Database rows do not store file blobs or absolute paths.

### form and response records (v0.6)

Not tables in v0.1. `agreement_on_file` on assignment covers the first workflow. Later entities include versioned `form_template`, `form_question`, `form_request`, `form_response`, `form_upload`, and `acknowledgment_record`, each with retention and export metadata. Acknowledgment records capture that a response occurred; they are not represented as legal signatures.

### event and attendance records (v0.7)

- `event`: id, operating_period_id, name, starts_at, ends_at, location, visibility, series_id (O), itinerary, notes.
- `event_group`, `event_attachment`, `event_rsvp`, `event_equipment_item`, and bounded `volunteer_opportunity`/`volunteer_signup` records.
- `attendance_record`: event_id, person_id, status (present, absent, late, excused, not_recorded), recorded_by, recorded_at.
- There is no attendance reason field. Medical and disciplinary explanations belong in approved school systems, not Band Office.
- Public and private calendar feeds expose only fields permitted by event visibility.

### communication records (v0.4)

- `email_connection`: provider kind (Google, Microsoft, SMTP), shared-mailbox identity, encrypted credential reference, status, and last successful verification. Credentials never appear in exports or audit diffs.
- `email_template`: reusable subject, body, and attachment references.
- `announcement`: authored content, schedule, sender connection, and immutable audience snapshot at send/export time.
- `announcement_recipient`: one deduplicated destination with inclusion reasons, associated members, permission result, and final status.
- `delivery_attempt`: destination reference, status, timestamps, retry count, and provider message reference.
- Recipient contact data remains authoritative in contact records and is redacted from message-body logs and audit diffs.
- The desktop edition never silently sends an overdue scheduled message after downtime; a staff user must confirm it.

### operating period

- `operating_period` replaces a hard-coded season model. It defaults to school-year behavior but supports another locally chosen period structure.
- Every assignment, repair, group membership, event, financial entry, and form request carries an operating-period relationship where the workflow is period-bound.
- Financial periods may close independently from the operating period.

### audit_log

- id, timestamp (R), actor (R), action (R), entity_type (R), entity_id (R), change_summary (R), change_diff_json (O)
- Append-only. No delete path in the application.
- `change_summary` is a short human-readable sentence for the settings UI.
- `change_diff_json` is machine-readable JSON text with changed field names and redacted before/after values. It never stores note contents, member names, or guardian details; those fields are represented as `[redacted]`.

## 8. Privacy and Compliance Posture

**Design assumptions:**

- Treat every member row as a FERPA education record from day one.
- The director is responsible for following district policy. The README tells the director to clear the tool with administration before loading real student data.
- For SDMS, send one email to the principal describing what it stores and where it runs before dogfooding.
- The repo includes `PRINCIPAL_CLEARANCE_DRAFT.md` as a concrete pre-dogfood deliverable, not a vague reminder.
- Every later module that adds a new data class, external connector, or non-staff user requires a revised privacy review and administrative approval. Approval for v0.1 inventory does not automatically cover portals, messaging, forms, or payments.

**PII minimization:** the schema is the enforcement mechanism. Fields that do not exist cannot be filled. Notes fields are the leak path and carry permanent inline warnings.

**Role permissions:** the current local release provides fixed director, assistant director, inventory helper, and read-only staff roles. Directors control staff accounts and settings. Assistants receive current operational and financial capabilities but not staff administration, settings, or rollover. Inventory helpers may manage inventory and assignments but cannot view financials or notes, export data, manage people/groups, or access settings. Read-only users receive no mutation or financial-view capability. Communications adds its own capability before that data class exists; being classified as a booster never grants staff access.

**Audit trail:** append-only `audit_log`, readable in settings.

**Deletion and export policy:**

- Full export is one click and produces open formats only.
- Member removal is two-step: archive, then anonymize identifying fields after the year archive is written. Assignment history remains intact, but names and school IDs can be replaced with a non-identifying archived-member label.
- Hard delete is not a normal product path because it conflicts with permanent assignment history. If ever exposed, it is an advanced maintenance action with a separate backup warning.
- Rollover always writes the archive bundle before anonymization is possible.
- Posted financial records and issued statement snapshots follow the configured records-retention policy and cannot be removed through ordinary member archival.

**Network posture:** Band Office makes no external runtime calls by default. Enabling the SMTP connector permits outbound delivery only to the host an administrator configures; desktop browser traffic remains loopback-only. Connector settings name the provider, data sent, purpose, and last successful call. No release adds telemetry, advertising, silent update pings, or external error reporting.

**What never goes to an LLM:** any row from member or guardian, any notes field, and any export containing names. AI features receive schema, aggregates, and redacted structures only.

**Backup and device reality:** a SQLite file on a laptop is only as private as the laptop. The desktop edition requires a local staff password, supports a configurable inactivity lock, and relies on district-managed full-disk encryption for the live database. Automatic backup bundles are encrypted by default with a director-held recovery key. Manual CSV/XLSX exports remain readable open formats and therefore display a privacy warning before creation. Backups belong on district-approved storage, not personal cloud accounts.

## 9. UX Model

Screens designed from the band-room day:

1. **Today.** Outstanding assignments, open repairs, students with no assignment who probably should have one, total assigned asset value currently out.
2. **People.** Searchable directory by classification and group. Person detail shows classifications, student profile when applicable, current holdings, assignment history, groups, and guardian relationships.
3. **Groups.** Flat reusable groups with current membership, optional role labels, assignment context, and retained membership history.
4. **Financials.** Student-account dashboard with group and standing filters, current-period totals, immutable recent activity, group-assessment history, individual posting, printable statements, reversals, and CSV export.
5. **Assets.** Filter by category, status, condition, location. Asset detail shows every assignment, every repair, total repair spend against estimated value. Inventory and asset-detail views open the scanner and printable label workspace.
6. **Checkout station.** Big search for any active person, optional group context, search or scan asset, condition picker, agreement print button, confirm. Keyboard-first. Under 30 seconds.
7. **Check-in station.** Search or scan asset, condition picker, flag damage, prefill repair entry, confirm.
8. **Repair queue.** Open repairs worklist, closed-repairs history, per-asset and per-year totals.
9. **Reports.** A fixed library of trusted reports with print layouts and CSV export. Band Office does not begin with a general drag-and-drop report builder.
10. **Rollover wizard.** Linear, numbered, cannot skip archive step.
11. **Settings, import, export.** Backup, full export, agreement template editor, operating-period management, audit log viewer.

Later modules add work-centered surfaces rather than a generic application maze: **Accounts**, **Announcements**, **Library**, **Forms**, **Calendar**, and a deliberately smaller **Family Portal**. The Today screen remains an operational queue, not a chart dashboard.

**Reporting catalog:**

The baseline intentionally covers CutTime's documented member extracts, cost and payment reports, balance summaries, statements, inventory and library exports, form-response exports, announcement delivery status, volunteer exports, and year-end review. Band Office adds native attendance reporting because CutTime's current event documentation states that event attendance is not tracked. Sources: [financial reporting](https://support.gocuttime.com/article/911-financial-reporting), [member exports](https://support.gocuttime.com/article/844-student-management-overview), [instrument exports](https://support.gocuttime.com/article/910-instrument-management-overview), [forms](https://support.gocuttime.com/article/1039-custom-forms), [announcements](https://support.gocuttime.com/article/278-sending-announcements), and [events](https://support.gocuttime.com/article/277-events).

- **People:** roster by group, grade, position, or status; guardian/contact directory; missing-contact and missing-permission reports; migration and duplicate-resolution reports.
- **Financials now:** student balances, immutable transaction ledger, group assessment history, and individual student statements. **Later:** charge allocation, waivers/write-offs/transfers, deposit batches, household statement snapshots, period-close, and provider reconciliation.
- **Inventory:** master asset list; assigned, unassigned, overdue, missing, retired, and in-repair assets; condition and inspection status; attached or missing components; repair queue, history, spending, and lifetime cost; fleet and assigned-out value; uniform availability by type and size; physical audit status.
- **Library:** catalog, current loans, overdue loans, missing-component notes, performance history, and digital-file presence.
- **Communications:** announcement history, deduplicated audience, delivery outcomes, failures, suppressed recipients, and contacts missing usable email addresses.
- **Forms:** recipient completion, outstanding responses, response extracts, uploads, reminders, and retention status.
- **Events:** event roster, RSVP, attendance, absences, volunteer assignments, trip roster, and equipment list.
- **Administration:** audit history, import results and errors, operating-period closeout, and full-export manifest.

Reports are permission-aware. A financial manager may run financial reports without receiving inventory administration rights; an inventory helper cannot export financial or guardian data. Issued financial statements are immutable dated snapshots so staff can reproduce exactly what a student or guardian received.

## 10. AI Features

AI ships only if it is draft-only or read-only, works on redacted or aggregate data, and fails safe when wrong.

**Worth building:**

- CSV import mapper: deterministic header heuristics first; optional LLM sees headers and data types only.
- Duplicate detection: deterministic fuzzy matching on name plus grade.
- Missing-data warnings: deterministic queries surfaced on Today.
- Draft-only parent message helper: director supplies the situation; no database access; no send button.
- Repair trend summary: aggregate repair data only.
- Rollover checklist generator: aggregate state only.

**Explicitly avoided:**

- Automatic message generation or sending. Deterministic reminders configured by a director may be considered only after communications are stable and every scheduled send is visible and cancelable.
- Student risk, engagement, eligibility, retention, or sentiment inference.
- AI-assigned instruments or placements.
- Parent or student chatbots.
- Voice or photo features.
- Cloud AI features enabled by default.

## 11. Technical Architecture

**Recommendation:** a modular monolith using Next.js App Router and TypeScript, with Prisma for persistence. The same application supports two distribution modes: a packaged desktop edition with bundled SQLite for ordinary directors, and a Docker server edition for district IT. Postgres becomes the supported server database before portals, concurrent financial work, or district deployments.

Rationale:

1. It is your stack.
2. SQLite makes the first single-program release portable and inspectable.
3. One domain codebase can power both the desktop and district-hosted modes.
4. A modular monolith preserves simple deployment while allowing domain boundaries to remain explicit.

**Distribution:** the primary small-program release is a signed Windows and macOS desktop package that installs, launches, backs up, restores, and upgrades without a terminal. The proven shell is Electron: it supervises the standalone Next.js server on a random loopback-only port, stores SQLite in the operating system application-data directory, denies external navigation and browser permissions, and exposes only verified backup restore through a narrow preload bridge. Database migrations run before the server starts and create a recovery snapshot before changing an existing file. Docker Compose remains the administrator path, not the director onboarding path. Chromebook-only use requires a district or community-hosted server and is not promised in v0.1.

**Release signing:** Windows code signing and macOS signing/notarization are accessibility requirements because unsigned security warnings will stop the intended users. Certificate, signing, and release-hosting costs must be treated as project operating costs even though the software is free.

**Module boundaries:** `core`, `people`, `inventory`, `library`, `events`, `financials`, `forms`, `communications`, and `portal` expose application services rather than reaching across one another's tables from route handlers. Cross-module changes use one database transaction and one audit envelope.

**Auth:** the local release uses staff accounts linked to staff-classified people, passwords hashed with argon2, secure session cookies, a 30-minute inactivity lock, and fixed role permission sets. In the server edition, staff may add authenticator-app two-factor authentication. Students and guardians use emailed one-time codes only when portals are built. Portal identity, contact verification, account recovery, rate limiting, and session revocation are separate security work; person and guardian-link rows never become login records.

**Import/export:** CSV import with mapping and dry-run preview. Full export uses a database-independent archive containing every table in open formats, attachment metadata, content hashes, and a manifest. SQLite deployments may additionally include the native database file. Export then reimport must reproduce authoritative data.

**Backups:** settings button plus an optional scheduled job writes encrypted backup bundles to a configurable district-approved path. Setup creates or imports a director-held recovery key and requires a restore test. Manual open-format exports are separate from backups and display a privacy warning because they are intentionally readable. Document Litestream as advanced only.

**Files:** generated exports and managed library, form, and event attachments live in a mounted data directory through storage adapters. SQLite/Postgres rows store metadata and content hashes, not environment-specific absolute paths.

**Background work:** communications, exports, and connector reconciliation use a database-backed job table with leases, retries, idempotency keys, and a visible failure queue. The desktop worker operates only while Band Office is running and never silently releases overdue email after downtime. The server edition supports unattended workers. Do not introduce Redis or a separate queue service until measured load requires it.

**Connectors:** Google email, Microsoft email, SMTP, calendar publication, and later payment providers implement narrow adapters. The default email sender is one shared program mailbox; optional per-staff mailboxes wait for the multi-user server edition. Domain records never depend on provider-specific payloads. Disabling a connector leaves the underlying Band Office history readable and exportable. There is no native SMS connector in the approved roadmap.

**Non-goals:** no mandatory external service, telemetry, CDN dependency at runtime, license server, or microservice fleet. After dependencies are installed and cached, `npm run build` must succeed without network access.

## 12. Build Strategy

The replacement plan uses two nested gates: first prove v0.1 as a real asset product, then admit later modules one at a time.

**Implementation status as of July 24, 2026:** the inventory release, People/Groups/Access foundation, director-side Financials foundation, standard SMTP Email communications module, Music Library, director-side Forms, and Events/Attendance are implemented. Events acceptance covers public/private events and calendars, series, preserved roster snapshots, RSVP, attendance, itineraries, equipment packing, bounded volunteers, managed files, reviewable email reminders, seven CSV reports, and encrypted version-8 backup/restore. Current release acceptance covers version-2 through version-7 restore compatibility, nine migrations, historical upgrades, forced migration rollback, 41 unit/integration tests, the complete browser workflow, and a production build. Real district-mailbox delivery and Google/Microsoft OAuth connectors remain open, as do student/guardian self-service portals, Apple signing/notarization, Windows packaging, clean-machine upgrade testing, backup-location onboarding, and public licensing.

**v0.1 stages, each with an exit test:**

1. **Replacement blueprint.** Exit: approve the long-term module boundary, replacement matrix, v0.1 scope, and calendar slot.
2. **Data model prototype.** Prisma schema, migrations, seed script, audited data-access helpers, seven report queries, and a throwaway table UI. Exit: every v0 report can be produced as a raw query against seeded data, and every mutation path in the prototype writes an audit row. CSV round-trip is explicitly not part of this stage.
3. **v0 director console.** Nine screens. Exit: simulated August checkout on demo data in one sitting.
4. **Import/export hardening.** Malformed CSVs, duplicates, encoding junk, export-to-CSV then reimport of members and assets, full round-trip test, backup button.
5. **Privacy and security pass.** Auth review, audit-log coverage, notes labels, default-off and no-hard-coded-destination verification, connector-boundary review, dependency audit.
6. **Desktop packaging and onboarding.** Produce signed Windows and macOS builds, first-run program setup, demo-data option, backup location choice, and migration guidance. Current status: unsigned Apple Silicon packaging and clean-profile first-run acceptance pass; cross-platform signing, Windows acceptance, upgrade testing, and the remaining onboarding choices are still required. Exit: a clean-machine acceptance test reaches the checkout station in under ten minutes without a terminal on both supported platforms.
7. **Public repo beta.** Final license decision, README, privacy notes, screenshots, installers, checksums, tagged v0.1.0-beta. License selection is intentionally deferred until the distribution, contribution, and future-hosting implications have been reviewed; the specification does not currently prefer AGPL, MPL, MIT, or Apache.
8. **SDMS dogfood and public beta.** Complete principal clearance and real checkout at SDMS, verify backup and restore, publish the beta, and accept community feedback without making interviews or adoption quotas a release gate.

The earlier three-to-four-week estimate covered only the web application prototype and is no longer a credible public-beta estimate. Desktop packaging, signing, onboarding, and documentation add a separate release-hardening phase. Estimate that phase only after the packaging spike.

**Later-module gate:** People/Groups/Access, director-side Financials, standard SMTP Email communications, Music Library, Forms, and Events/Attendance are complete. Proceed next with the Server and Family Portals phase only after its deployment, authentication, relationship-authorization, rate-limit, recovery, and audit specification is approved. Google/Microsoft OAuth remains an explicit connector extension. Allocation, household-accounting, receipt, close, and payment-provider work returns only as an explicit financial extension. Before implementation, each module needs a workflow spec, data-classification change, permission map, import/export contract, failure-recovery design, and a retirement test naming the workflow it replaces.

**v1.0 release gate:** the reference program completes one school year and no unresolved high-severity data loss, permission, financial, delivery, or portal defects remain. Clean full exports and documented restore tests are mandatory.

## 13. Demo Dataset

Ridgeline Middle School Band, fully synthetic:

- 62 members across grades 6 to 8.
- 48 instruments.
- 74 uniform pieces.
- 10 equipment assets.
- 64 attached instrument components, including 5 marked missing or damaged.
- 41 active assignments, including 6 with `agreement_on_file=false`.
- 15 historical assignments in a closed prior year.
- 14 repairs: 4 open, 10 closed, including one stale 60+ days and one high-cost sousaphone.
- 3 financial assessment batches and 69 immutable ledger entries demonstrating charges, manual payments, credits, a correction reversal, positive balances, and credit balances.
- 2 reusable email templates plus synthetic guardian, booster, and external-contact addresses for audience-preview testing. No sender connection or credential is seeded.
- 3 events across current and prior periods, 62 event-roster snapshots, 62 RSVP and attendance rows, 6 equipment-list items, 2 volunteer opportunities, and 3 volunteer assignments.
- One closed prior operating period with archive bundle.

Sample seed rows:

```csv
first_name,last_name,grade,section,school_student_id
Marlow,Tenby,7,trumpet,RMS-2041
Ansel,Quirk,8,percussion,RMS-1988
Petra,Voss,6,clarinet,RMS-2210
```

```csv
category,make,model,serial_number,school_asset_tag,condition,status,purchase_year,estimated_value
instrument,Yamaha,YTR-2330,AY7301122,RMS-INST-014,good,assigned,2019,1150
instrument,Conn,20K Sousaphone,CN552914,RMS-INST-002,fair,in_repair,2006,7400
uniform,Fruhauf,Jacket 38R,,RMS-UNI-021,good,available,2017,310
```

## 14. Risks

**Adoption risk:** the intended directors generally will not self-host or troubleshoot developer tooling. Mitigation: a signed no-terminal desktop installation is part of v0.1 acceptance, Docker is reserved for IT, and the project publishes clear platform limits. Adoption is the mission, but no adoption quota is required to ship.

**Maintenance risk:** open-source issues generate obligation. Mitigation: explicit README support posture.

**Support risk:** young teachers may need more guidance than a source repository provides. Mitigation: task-based documentation, demo data, import diagnostics, backup checks, issue templates, and a public community help channel. There is no paid SLA, so the software must make common recovery actions self-service.

**Privacy risk:** dangerous paths are free-text notes, backups on personal cloud, and unencrypted laptops. Mitigation: field exclusions, inline warnings, backup guidance, district-managed encrypted machine note.

**Procurement risk:** even free software touching student data can require district approval. Mitigation: zero-PII mode and README guidance.

**Technical risk:** low for v0.1, material for portals, messaging, financials, and payments. The mitigation is module isolation, explicit release gates, provider-independent records, and no simultaneous expansion across high-risk domains.

**Too broad risk:** the replacement roadmap can become an excuse to build every CutTime menu. Mitigation: each release must retire one named workflow, and only one new high-risk module may be active at a time.

**Parity risk:** CutTime will continue changing while Band Office is built. Mitigation: measure replacement against stable director jobs and exportability, not competitor feature count.

**Connector risk:** email and payment providers can fail or change terms. Mitigation: connectors are optional adapters; all authoritative records remain provider-independent and failures are visible and recoverable. Remind is a manual handoff unless an approved public API becomes available.

**Distribution risk:** school-managed Windows/macOS devices may block installation, and Chromebook-only programs need a hosted server. Mitigation: publish signed packages, preserve the Docker path for IT, document known platform limits, and avoid claiming universal device support.

**Sequencing risk:** Band Office can consume time intended for commercial commitments. Mitigation: stage 1 requires a written calendar decision before code exists.

## 15. Differentiation

1. **The exit is the feature.** Band Office produces a complete, documented export bundle the program controls.
2. **No mandatory software subscription.** Optional hosting, email, or payment providers may still charge their own transparent fees.
3. **Strong local-first privacy posture.** Student data is designed to stay on a district machine, with the remaining risk shifted to laptop security and backup discipline.
4. **Offline and durable.**
5. **Inspectable.**
6. **Replaceable modules.** A program can adopt inventory without adopting payments or portals.
7. **Honest maturity.** The roadmap may be broad, but each release states exactly which workflow it can replace today.

**The open-source advantage in one line:** the category's central failure mode is vendor mortality, and open source is the only structural fix for vendor mortality.

## 16. Recommendation

**Build the replacement as a sequence, not as a parity project.**

- Keep the v0.1 asset and assignment specification intact as the first production slice.
- Establish the shared foundation so later modules do not require a rewrite, but do not prebuild their features.
- Use `CUTTIME_REPLACEMENT_MATRIX.md` as the scope authority for what is replaced, partial, planned, integrated, or intentionally excluded.
- Treat the implemented People/Groups/Access foundation as the ownership layer for assignments, financial accounts, communication audiences, library loans, form requests, and event rosters. Director-side Financials, standard SMTP Email, Music Library, Forms, and Events/Attendance are implemented; Server and Family Portals are next.
- Do not announce Band Office as a CutTime replacement until the README's current coverage table names enough completed workflows to make that statement true for a defined program profile.

The strategic commitment is now clear: Band Office aims to become an open-source Charms/CutTime alternative. The operational commitment remains bounded: only the currently approved module enters implementation.

## 17. Final Deliverables

The thesis, v0 list, replacement roadmap, schema draft, and privacy rules are above. Companion planning and build files:

- `stage-2-codex-build-prompt.md`
- `README-draft.md`
- `PRINCIPAL_CLEARANCE_DRAFT.md`
- `CUTTIME_REPLACEMENT_MATRIX.md`
