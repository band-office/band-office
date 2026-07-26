# Band Office Release Channels

Band Office separates source visibility, local director distribution, and district-operated family access. A successful build in one channel does not authorize claims about another.

## Source Release Candidate

**State:** available on `main`.

**Audience:** contributors, technical reviewers, and directors evaluating the deterministic demo with fictional data.

This channel includes the full source, local development path, unsigned package acceptance, and the Server operator kit. It is not a stable download and is not approved for real student data.

Permitted public description:

> Band Office is a public open-source release candidate for school music program operations.

Do not describe this channel as generally available, production-ready, district-approved, or a supported CutTime replacement.

## Band Office Desktop Alpha

**State:** not yet issued.

**Audience:** directors running one program on one district-managed computer without public student or guardian access.

The Desktop alpha begins only when a `v*-alpha.*` GitHub prerelease contains:

- a signed and notarized macOS DMG and ZIP;
- a signed Windows installer and ZIP;
- platform acceptance results;
- SHA-256 checksums;
- the Apache license and third-party notice;
- source-tag and commit metadata.

Desktop is local-only. It may use an approved SMTP mailbox while the application is running, but it cannot host family portals over the public internet.

The first Desktop alpha remains pre-stable software. Real-data use still requires school approval, a district-managed encrypted computer, an encrypted backup, and a verified restore drill.

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

LinkedIn and contributor-facing posts may link to the source release candidate when they preserve its status. Broad band-director promotion should wait for the Desktop alpha to provide a normal signed download. Family-portal promotion should wait for a supported Server release.
