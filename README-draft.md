# BandOS

A free, open-source, local-first program management system for school music organizations. BandOS is being built as a phased alternative to the operational jobs handled by Charms Office and CutTime, especially for young teachers and small programs that cannot justify another subscription.

The current local release candidate includes inventory, people and groups, student fee accounts, outbound email, a whole-set music library, forms, and events with attendance. Student and guardian portals, granular relationship permissions, household accounting, and optional payment connectors remain later phases. The README for every release says exactly which workflows are ready to replace and which remain planned.

## Why

School music programs carry years of operational history across directors, vendors, and budget cycles. That history should not become inaccessible because a subscription ends or a vendor disappears. BandOS is built around open source, local-first deployment, open formats, and tested full export.

## Current release candidate

- Roster import from CSV, with minimal student fields
- Instrument, uniform, and equipment inventory
- Attached instrument components and separately assigned uniform pieces
- Fast checkout and check-in with condition snapshots
- Printable checkout agreements, with paper signature and tracked status
- Repair log and repair queue
- The reports you hand to your principal and boosters
- Guided operating-period rollover with a full archive
- Append-only audit log, one-click full backup
- People, flat groups, guardian links, staff roles, and permission enforcement
- Auditable student charges, credits, manual payments, reversals, statements, and reports
- Outbound SMTP email with audience snapshots, scheduling, retries, contact holds, and delivery history
- Whole-set music library records, loans, missing-component history, managed files, and performance history
- Versioned forms and acknowledgment tracking without eSignature
- Events, public/private calendars, roster snapshots, RSVP, attendance, trip lists, equipment packing, and bounded volunteers

## Planned replacement modules

- Household views, granular guardian permissions, financial allocation, receipts, period close, and combined household statements
- A server edition with student and guardian portals
- Optional hosted payment connectors after the internal ledger is stable

See `CUTTIME_REPLACEMENT_MATRIX.md` for current coverage and release gates.

## What it will not do

Run fundraising storefronts, provide native SMS, implement eSignature, store medical or disciplinary information, design marching drill, or make decisions about students. Remind may receive a manual copy/export handoff, but BandOS will not depend on an undocumented API. No module sends email, exposes a portal, or accepts payments until that capability has its own security and failure-recovery release gate.

## Privacy posture

BandOS is local-first. Network access is disabled unless a director explicitly configures an outbound email connector; public and private calendars are served from the BandOS installation. Later portal and payment capabilities will name exactly what service receives what data. Real privacy still depends on where BandOS runs and where backups live. Use a district-managed, disk-encrypted machine, keep encrypted backups on district storage, read `PRIVACY.md`, and clear each new data-bearing module with your administration before using it. Manual spreadsheet exports are intentionally readable and must be handled as student records. BandOS also supports a zero-PII inventory mode using local ID codes instead of names.

## Desktop distribution

The Electron desktop application is working, and an unsigned Apple Silicon macOS test package is available. The public release gate remains signed and notarized macOS plus signed Windows installers. Normal director use will not require a terminal, Node.js, or Docker.

For district IT and contributors:

```bash
docker compose up
# open http://localhost:3000, load the demo program,
# try the checkout station
```

Contributor setup: `npm install && npm run dev` (Node 20+).

## Support posture

Built with a real middle school band as the reference deployment and published for young teachers and under-resourced programs everywhere. Issues and contributions are welcome. Community support is best-effort rather than a paid SLA, so installation, backup, restore, and common recovery tasks are designed to be self-service. License selection is deferred until the public-release gate.

Built by a 15-year band director.
