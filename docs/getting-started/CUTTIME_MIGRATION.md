# Migrate From CutTime

The **Migrate from CutTime** workflow is a one-time cutover for a new Band Office program. It does not connect to a CutTime account, synchronize changes, or store the raw exports. It reads the CSV or XLSX files you select in the browser, previews the result, then creates one auditable import when you commit it.

## Before You Start

1. Get school approval for the Band Office deployment and use district-approved storage for the original exports.
2. Select a cutover date. Stop changing records in CutTime before making the final exports.
3. Start from a new, empty Band Office program. The migration is intentionally unavailable after people, groups, inventory, assignments, or financial entries exist.
4. Keep the original CutTime files outside Band Office. They are your source record during reconciliation.

Only a **Director** can run the migration.

## Files To Export

The member export is required. The rest are optional.

| CutTime export | Required fields | Result in Band Office |
| --- | --- | --- |
| Members | Student ID, first name, last name, grade | Students, sections, and any listed group memberships |
| Guardians | Linked student ID, guardian name, email or phone | Guardian contacts and family links; the same guardian can link to multiple students |
| Groups | Group name and linked student ID | Additional flat groups and memberships |
| Instruments | Instrument ID, asset tag | Instrument inventory, components, missing parts, current assignment only when a student ID is present |
| Attire | Attire ID, asset tag | Uniform inventory, size, components, missing parts, and current assignment only when a student ID is present |
| Equipment | Equipment ID, asset tag | Equipment inventory, components, missing parts, and current assignment only when a student ID is present |
| Student balances | Linked student ID and balance | One opening charge or credit per student as of the cutover date |

Use an actual CutTime student ID whenever a relationship needs to be carried over. Band Office will not guess that a name refers to a particular student. If an asset export lists a name but no assigned student ID, the asset imports unassigned with a warning for director review.

## What Carries Over

- Active students and contact details present in the selected exports
- Guardian-to-student links, including shared guardians
- Flat groups and memberships
- Current instruments, attire, and equipment, including component and missing-part notes
- A current checkout when the exported assignment includes a student ID
- Assets marked in repair as a new open repair record
- One current financial opening balance per student
- Export filenames, file hashes, headers, recognized mappings, row counts, warnings, timestamps, and audit entries

## What Does Not Carry Over

This first migration intentionally does not import historical payments, prior charges, historical checkouts, repair history, messages, delivery history, forms, uploaded files, event history, portal passwords, or payment credentials. Those records remain in the original CutTime export/archive. Band Office starts its own ongoing history on the cutover date.

## Run The Cutover

1. Sign in as a Director and open **Administration → Import**.
2. Select **Migrate from CutTime**.
3. Set the date when CutTime became read-only.
4. Add the available CSV or XLSX exports and select **Preview migration**.
5. Resolve every blocking item. Review warnings and the expected counts.
6. Select **Commit CutTime migration** once the preview is ready.
7. Check People, Groups, Assets, Financials, and the audit history against your original exports. Create and verify an encrypted backup before resuming normal operations.

The migration can run once per program. Later changes belong in normal Band Office workflows or the regular spreadsheet importer.
