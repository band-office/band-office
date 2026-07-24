# BandOS Decisions

**Last updated:** July 24, 2026

- BandOS is a free, open-source alternative to the operational program-management functions of Charms Office and CutTime. Marching drill design and Pyware replacement are separate product territory.
- The primary release is a local Windows and macOS desktop application. Docker and a district-hosted server remain administrator paths.
- One installation represents one program. Students may belong to multiple flat groups used for assignments, fees, communication, forms, events, and reporting.
- Inventory tracks instruments, uniforms, equipment, components, barcode/QR identities, assignments, condition, repairs, and history.
- Music-library inventory treats a score and its full parts set as one catalog item, with component exceptions, loans, resources, comments, and performance history attached separately.
- Financials record charges, credits, manual payments, balances, statements, reversals, and reports. Payment processing is deferred to an optional later connector.
- BandOS sends email through an explicitly configured shared mailbox. SMS and Remind-style delivery are deferred connector decisions.
- Forms use ordinary acknowledgments and response records, not eSignature.
- Student and guardian portals are a server-edition phase. They require relationship-scoped authorization, emailed one-time codes, recovery, rate limiting, session revocation, and audit boundaries before exposure.
- Inventory helpers can see operational student identity, groups, holdings, inventory, repairs, and fixed reports. They cannot see contact details, guardian relationships, notes, financials, communications, forms, events, or exports.
- Read-only staff have explicit non-mutating access to People, contact and family context, groups, inventory, repairs, and fixed reports. Sensitive modules remain separately permissioned.
- Event group selection creates a preserved roster snapshot. Refresh adds never-seen current members only; a manually removed participant returns only through an explicit individual add.
- Event status transitions are `draft -> published|canceled` and `published -> completed|canceled`. Completed and canceled events are terminal.
- Cross-module writes, including event-generated email reminders, use one database transaction and one audit envelope.
- Private calendar feed tokens are stored only as hashes, are revocable, and are never placed in page URLs during creation.
- Public licensing remains undecided until the third-party notice review is complete.
