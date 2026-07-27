# Band Office Release Channels

Band Office separates source visibility, local director distribution, and district-operated family access. A successful build in one channel does not authorize claims about another.

## Source Release Candidate

**State:** available on `main`.

**Audience:** contributors, technical reviewers, and directors building or reviewing from source.

This channel includes the full source, local development path, package acceptance evidence, and the Server operator kit. Source availability does not by itself create a supported deployment.

Permitted public description:

> Band Office is a public open-source release candidate for school music program operations.

Do not describe this channel as generally available, production-ready, district-approved, or a supported CutTime replacement.

## Band Office Desktop Alpha

**State:** [`v0.1.0-alpha.1`](https://github.com/band-office/band-office/releases/tag/v0.1.0-alpha.1) issued as an unsigned public prerelease.

**Audience:** directors running one program on one district-managed computer without public student or guardian access.

The Desktop alpha is issued only when a `v*-alpha.*` GitHub prerelease contains:

- an explicitly unsigned macOS DMG and ZIP with SHA-256 checksums and Gatekeeper instructions;
- an explicitly unsigned Windows installer and ZIP with SHA-256 checksums and SmartScreen instructions;
- platform acceptance results;
- SHA-256 checksums;
- the Apache license and third-party notice;
- source-tag and commit metadata.

Desktop is local-only. It may use an approved SMTP mailbox while the application is running, but it cannot host family portals over the public internet.

Fresh Desktop installations start with an empty database and first-run program setup. Demo records are not included in the package. Directors may use the alpha for real local program operations, but before student information is loaded, the school should approve the deployment, provide a district-managed encrypted computer, assign backup ownership, and complete an encrypted backup and verified restore drill.

## Band Office Server Technical Preview

**State:** source and operator kit available; no supported image published.

**Audience:** district IT staff evaluating the architecture with fictional data.

The technical preview includes Caddy HTTPS configuration, an application container, a scheduled-email worker, secret mounts, health checks, migration tooling, backup and restore instructions, and relationship-scoped student and guardian portals.

It is not approved for real family accounts. A supported Server release requires:

1. A canonical multi-platform image with immutable registry digests.
2. Clean-Linux acceptance with public DNS and ACME HTTPS.
3. District SMTP, password recovery, scheduling, retry, and downtime acceptance.
4. Upgrade, rollback, and complete-data restore drills.
5. Named district infrastructure, backup, mailbox, and director owners.
6. District approval for the stored records and public access model.

## Promotion Boundary

LinkedIn, contributor-facing posts, and band-director communities may link to the Desktop alpha when they preserve its alpha status and disclose that both platform packages are unsigned. Do not describe it as stable, district-approved, or a supported CutTime replacement. Family-portal promotion should wait for a supported Server release.
