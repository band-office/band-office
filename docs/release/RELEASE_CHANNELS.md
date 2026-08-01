# Band Office Release Channels

Band Office separates source visibility, local director distribution, and district-operated family access. A successful build in one channel does not authorize claims about another.

## Source

**State:** available on `main`.

**Audience:** contributors, technical reviewers, and directors building or reviewing from source.

This channel includes the full source, local development path, package acceptance evidence, and the Server operator kit. Source availability does not by itself create a supported deployment.

Permitted public description:

> Band Office is a public open-source project for school music program operations, with separate Desktop and district-operated Server alpha channels.

Do not describe this channel as generally available, production-ready, district-approved, or a supported CutTime replacement.

## Band Office Desktop Alpha

**State:** [`v0.1.0-alpha.10`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.10) issued as a public prerelease.

**Audience:** directors running one program on one district-managed computer without public student or guardian access.

The Desktop alpha is issued only when a `v*-alpha.*` GitHub prerelease contains:

- separate Developer ID-signed, Apple-notarized Apple Silicon and Intel macOS DMGs and ZIPs with architecture-specific SHA-256 checksums;
- an explicitly unsigned Windows installer and ZIP with SHA-256 checksums and SmartScreen instructions;
- platform acceptance results;
- SHA-256 checksums;
- the Apache license and third-party notice;
- source-tag and commit metadata.

Desktop is local-only. It may use an approved SMTP mailbox while the application is running, but it cannot host family portals over the public internet.

Fresh Desktop installations create a private database and offer an empty program or the deterministic fictional Ridgeline demo during first-run setup. Directors should begin with the demo and must not add real student information to that installation. The permanent demo banner provides a Desktop-only **Start my program** action that preserves a recovery snapshot and returns to first-run setup. Before student information is loaded into a non-demo installation, the school should approve the deployment, provide a district-managed encrypted computer, assign backup ownership, and complete an encrypted backup and verified restore drill.

## Band Office Server Alpha

**State:** [`v0.1.0-server-alpha.4`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.4) issued as a public district-operated prerelease.

**Audience:** district IT staff evaluating or operating one approved school music program.

The Server alpha includes a public multi-platform image, a digest-pinned operator bundle, Caddy HTTPS configuration, an application container, a scheduled-email worker, secret mounts, health checks, migration tooling, backup and restore instructions, and relationship-scoped student and guardian portals. Fresh installations start empty.

Band Office does not host or operate this channel. Before activating real family accounts, each district deployment requires:

1. Clean-Linux acceptance with public DNS and ACME HTTPS.
2. District SMTP, password recovery, scheduling, retry, and downtime acceptance.
3. Upgrade, rollback, and complete-data restore drills.
4. Named district infrastructure, backup, mailbox, and director owners.
5. District approval for the stored records and public access model.

## Promotion Boundary

LinkedIn, contributor-facing posts, and band-director communities may link to either alpha when they preserve its alpha status. Desktop posts may describe the alpha.10 Mac packages as Developer ID-signed and Apple-notarized, and must disclose that Windows packages are unsigned. Server posts must say that it is district-operated, requires Linux administration and district acceptance, and is not a hosted Band Office service. Do not describe either channel as stable, district-approved, turnkey, or a supported CutTime replacement.
