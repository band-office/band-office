# Band Office CutTime Replacement Matrix

**Date:** July 24, 2026
**Status:** Scope and implementation authority

## Replacement Standard

A capability is **replaced** only when a defined program profile can complete the full workflow in Band Office, preserve and audit its history, export it in open formats, restore it from backup, and recover from ordinary failures without returning to CutTime.

Statuses:

- **Now:** included in the approved v0.1 build scope.
- **Implemented:** present in the current release candidate and covered by automated acceptance.
- **Planned:** belongs to the product thesis but has not passed its release gate.
- **Integration:** Band Office should connect or export rather than build the adjacent business.
- **Excluded:** intentionally outside the product.

## Target v1.0 Program Profile

Band Office v1.0 targets early-career directors and small or under-resourced school music programs with multiple groups, director and assistant staff, bounded staff and booster roles, students and households, and optional approved email/payment connectors. Directors use a normal desktop installation; district IT may use the server edition.

It does not require a district dashboard, inter-school asset exchange, fundraising storefront, ticket sales, native mobile apps, or first-party Band Office hosting.

## Coverage Matrix

| Director Job | Band Office Module | Phase | Status | Replacement Proof |
|---|---|---:|---|---|
| Import and maintain students | People | v0.1/v0.2 | Implemented | Roster reconciles against a new CSV without duplicates or lost history |
| Organize students into reusable flat groups | People | v0.2 | Implemented | Group definitions and dated memberships persist; assignments retain optional group context |
| Track guardians, staff, boosters, and external contacts | People | v0.2 | Implemented | Unified people, classifications, and guardian/student links survive backup and migration |
| Combine people into households | People | v0.3+ | Planned | Household views never merge student identity or financial ledgers |
| Limit each guardian's access per student | People | v0.2/v0.8 | Planned | Communication, financial, form, event, and attendance permissions cannot cross relationship boundaries |
| Control staff and helper access | Core | v0.2 | Implemented | Permission tests prove each role can see and change only approved records |
| Inventory instruments, attire, and equipment | Inventory | v0.1 | Now | Existing inventory spreadsheet is retired |
| Check assets out and in | Inventory | v0.1 | Now | August checkout and May return run without direct database edits |
| Track inspections, repairs, value, and status | Inventory | v0.1 | Now | Repair queue and asset history reconcile with physical audit |
| Track attached instrument components and separate uniform pieces | Inventory | v0.1 | Now | Checkout and return identify missing components without treating them as independent loans |
| Scan asset barcodes and QR codes | Inventory | v0.1 | Now | Camera or connected scanner retrieves the correct tagged asset from inventory, checkout, and check-in |
| Print asset labels | Inventory | v0.1 | Now | Single and batch QR/Code 128 sheets encode existing school asset tags without introducing a proprietary identifier |
| Assess charges by group or individual student | Financials | v0.3 | Implemented | Group membership is snapshotted into separate student charges; individual charges reconcile to the ledger |
| Record credits and manual payments | Financials | v0.3 | Implemented | Positive input becomes an immutable signed entry with date, description, optional group, and reference |
| Derive balances and reverse posted entries | Financials | v0.3 | Implemented | Balances are computed from entries and corrections preserve the original through equal-and-opposite reversal |
| Produce student statements and financial reports | Financials | v0.3 | Implemented | Printable statements and CSV balance, transaction, assessment, and individual-statement exports reconcile |
| Allocate, transfer, close, and deposit-batch financial records | Financials | v0.3+ | Planned | Automatic/manual allocations, transfers, period close, and deposit reconciliation reproduce expected balances under audit |
| Produce combined household statement snapshots | Financials/People | v0.3+ | Planned | Student balances remain separate while dated household snapshots aggregate authorized siblings |
| Send approved outbound email | Communications | v0.4 | Implemented | SMTP settings and verification, shared-mailbox delivery, deduplication, scheduling, suppression, retries, failure queue, reports, and backup pass automated acceptance; live district-provider acceptance remains open |
| Connect Google or Microsoft through OAuth | Communications | v0.4+ | Planned | Provider consent, token storage/refresh, revocation, least-privilege scopes, and controlled delivery pass connector-specific security review |
| Hand messages off to Remind | Communications | v0.4 | Integration | Copy/export provides message and audience without an undocumented API dependency |
| Maintain whole-set music library records | Library | v0.5 | Implemented | Whole-set catalog, loans, missing components, managed files and links, performance history, six CSV reports, and backup/restore pass automated acceptance |
| Request and track routine forms | Forms | v0.6 | Implemented | Versioned templates, recipient snapshots, staff response entry, reminders, retention, uploads, exports, and restore pass automated acceptance |
| Track inventory agreements | Forms/Inventory | v0.1/v0.6 | Implemented | Paper assignment status and ordinary form acknowledgments preserve history without representing eSignature |
| Manage events, calendars, and trip lists | Events | v0.7 | Implemented | Director generates a preserved roster snapshot, itinerary, equipment list, trip roster, and public/private calendar feed |
| Track attendance and volunteer assignments | Events | v0.7 | Implemented | Attendance and volunteer workflows and exports pass acceptance without medical or disciplinary reason fields |
| Let students and guardians view authorized records | Portal | v0.8 | Planned | One-time-code access cannot cross member, household, or relationship boundaries |
| Collect online payments | Payments | v0.9 | Planned | Hosted provider checkout reconciles idempotently to the internal ledger |
| Complete year-end rollover | Core | v0.1 onward | Now, then expanded | Backup precedes rollover and next-year records retain required history |
| Export and restore the whole program | Core | Every phase | Now | Clean-machine restore reproduces authoritative records and attachments |
| Operate district-wide dashboards | District | Post-v1.0 | Planned later | Separate district specification and approval required |
| Run fundraising and ticket sales | External provider | N/A | Integration | Export or link to approved fundraising platform |
| Design marching drill | OpenMarch | N/A | Excluded | Separate open-source product handles the Pyware problem |

## Dependency Order

```text
Core: program, operating periods, users, permissions, audit, import/export, backup
  -> People: members, contacts, households, groups
      -> Inventory
      -> Financials
      -> Communications
      -> Library
      -> Forms
      -> Events
          -> Server and Portal
Financials + Portal
  -> Payment connectors
```

The arrows express data and security dependencies, not permission to build several phases concurrently. The approved release order is Inventory, People/Groups/Access, Financials, Email, Library, Forms, Events, Server/Portals, then optional Payment Connectors.

## Replacement Gates

Every module plan must answer these questions before implementation:

1. Which existing spreadsheet or CutTime workflow will be retired?
2. What is the smallest complete workflow, including corrections and failure recovery?
3. What new student, guardian, financial, or communication data enters Band Office?
4. Who may view, create, change, export, and administer that data?
5. What open-format export proves the program can leave?
6. What backup and restore test protects the history?
7. What reference-program cycle demonstrates that the module works?

## Current Decision

Assets/assignments, People/Groups/Access, the director-side Financials foundation, standard SMTP Email communications, Music Library, director-side Forms, and Events/Attendance are implemented in the current release candidate. Server and Family Portals are the next authorized product phase and require a separate security and deployment specification before implementation. The stated mission and audience are sufficient product direction; interviews, discovery research, and external pilot quotas are not prerequisites.
