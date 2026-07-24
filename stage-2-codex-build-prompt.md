# First Codex Build Prompt

Use this to open Stage 2, the data model prototype. Do not hand Codex the whole spec at once.

```text
Project: BandOS, a phased open-source, self-hosted alternative to
Charms Office/CutTime for school music programs. This stage builds
only the first production module: the asset and assignment ledger.
Single-tenant, one band program, one director user.

Stack (fixed, do not substitute):
- Next.js (App Router), TypeScript, Prisma with SQLite.
- Runs locally with `npm run dev` and via a single Docker container
  with the SQLite file on a mounted volume at /data/bandos.db.
- Zero external network calls at runtime. No telemetry, no fonts
  from CDNs, no analytics. After dependencies are installed and
  cached, the build must succeed without network access.

Stage 2 scope only. Build:
1. Prisma schema for these entities exactly as specified:
   program (id, name),
   member (id, program_id FK, first_name, last_name, grade, section,
     school_student_id?, status enum [active|inactive|graduated],
     notes?),
   asset (id, program_id FK,
     category enum [instrument|uniform|equipment],
     make?, model?, serial_number?, school_asset_tag?, size?,
     condition enum [excellent|good|fair|poor|unusable],
     status enum [available|assigned|in_repair|retired|missing],
     purchase_year?, estimated_value?, location?, notes?),
   asset_component (id, asset_id FK, name, status enum
     [present|missing|damaged|replaced], notes?),
   assignment (id, asset_id FK, member_id FK, operating_period_id FK,
     checked_out_at, expected_return_at?, condition_out,
     agreement_on_file boolean default false, checked_in_at?,
     condition_in?,
     resolution? enum [returned|written_off|transferred], notes?),
   repair (id, asset_id FK, operating_period_id FK, opened_at,
     description, vendor?, cost?, closed_at?,
     status enum [open|at_vendor|closed]),
   operating_period (id, program_id FK, label, starts_at, ends_at?,
     period_kind, status enum [open|closed], archive_path?),
   audit_log (id, program_id FK, timestamp, actor, action, entity_type,
     entity_id, change_summary, change_diff_json?). Append-only:
     no update or delete code paths for this table anywhere in the app.
2. A data access layer where every create, update, and delete
   writes an audit_log row in the same transaction. Enforce asset
   status invariants in those transactions: open assignment means
   assigned; open repair with no open assignment means in_repair;
   no open assignment or repair means available unless manually
   retired or missing; retired and missing assets cannot be checked out.
3. A seed script that loads the Ridgeline Middle School demo
   program and dataset: 62 members, 48 instruments, 74 uniform pieces,
   10 equipment assets, 64 attached instrument components (5 missing
   or damaged), 41 active assignments (6 with
   agreement_on_file=false), 15 historical assignments in a
   closed prior operating_period, 14 repairs (4 open, one opened 60+
   days ago; 10 closed with costs). All names and serials
   synthetic. Deterministic seed (same output every run).
4. Seven raw report queries with passing tests against the seed:
   who-has-what, unassigned assets, outstanding assignments,
   missing-or-damaged components, repair cost by period, repair cost
   by asset, total fleet value and assigned-out value.
   Every query accepts program_id and is scoped to that program.
5. A throwaway /dev page rendering each report as a plain table.

Constraints:
- No auth yet, no styling effort, no extra entities, no forms
  engine, no email, no payments. If a feature is not listed
  above, do not build it.
- Do not model medical, address, birthdate, guardian, photo, or
  disciplinary fields. Their absence is intentional.
- Notes columns exist but the /dev page must render this literal
  helper text beside them: "No medical, disciplinary, or family
  information. This field is exported in reports."
- Exit test: all seven report queries return correct results
  against the seed, verified by automated tests, and prototype
  create/update/delete paths write audit rows in the same transaction.
  CSV export-to-reimport round-trip is intentionally deferred to the
  import/export hardening stage.
```
