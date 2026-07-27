# Band Office Server Acceptance Record

**Run date:** July 26-27, 2026

**Environment:** local Docker Desktop, Linux ARM64 containers

**Image:** `band-office:0.1.0`

**Local image digest:** `sha256:8fd772d6f57490af0df017e8332ef5012add20eb8d91797a03e192f46c341696`

**Public release:** [`v0.1.0-server-alpha.3`](https://github.com/band-office/band-office/releases/tag/v0.1.0-server-alpha.3)

**Published image:** `ghcr.io/band-office/band-office-server@sha256:8c15705948833da04dd9aab23d4fa2550fd245dd9e2dd4500272f9022fb459f0`

**Result:** public release and local container acceptance passed; district-hosted public deployment acceptance remains open

## Image

- [x] Multi-stage image built from the repository.
- [x] Runtime starts the Next.js standalone server through the migration-aware entrypoint.
- [x] Development, Electron, Prisma CLI, MySQL, and the unused unknown-license `seq-queue` dependency are absent from the runtime dependency tree.
- [x] Apache-2.0 package metadata, `LICENSE`, and `NOTICE` are present in the runtime image.
- [x] `npm audit --omit=dev` reports zero known vulnerabilities in the runtime dependency tree.
- [x] Compressed local image size is 246,948,866 bytes.
- [x] The protected release workflow published the canonical image for `linux/amd64` and `linux/arm64`.
- [x] The release blocked fixed high and critical container vulnerabilities.
- [x] Anonymous registry access, GitHub build provenance, the operator-bundle attestation, and release checksums verified.

The local digest identifies the original ARM64 acceptance image and must not be used as the release reference. Operators must use the published digest above.

## Stack

- [x] `app`, `worker`, and pinned `caddy:2.11.4-alpine` services started from `deploy/server/compose.yml`.
- [x] The application became healthy through the database-aware `/api/health` check.
- [x] The worker waited for application health and ran without an inappropriate HTTP health check.
- [x] Neither application nor worker published port 3000 to the host.
- [x] Caddy was the only public service on ports 80 and 443.
- [x] Demo seeding remained disabled.

## Edge

- [x] HTTP redirected to HTTPS with status 301.
- [x] The redirect and HTTPS responses omitted the `Server` header.
- [x] HTTPS `/api/health`, `/login`, and `/portal/login` returned successfully through Caddy.
- [x] HTTPS responses included HSTS, Content Security Policy, Permissions Policy, Referrer Policy, `X-Content-Type-Options`, and frame denial where required.
- [x] The local Caddy certificate was trusted only for this isolated acceptance environment.

This run did not test public DNS or ACME issuance. Those require a real deployment hostname.

## Data And Worker

- [x] All 11 repository migrations applied to a new server database.
- [x] Restarting the application treated the schema as current and returned to healthy state.
- [x] SQLite integrity checking returned `ok`.
- [x] SQLite foreign-key checking returned zero violations.
- [x] The worker endpoint rejected a public request without its secret with status 403.
- [x] The internal worker succeeded with the mounted secret and processed an empty queue.

## Backup And Restore

- [x] A synthetic program marker was written to the acceptance database.
- [x] Application and worker were stopped before archiving the complete `data` directory.
- [x] The archive was extracted into a separate isolated data root.
- [x] A separate container started from the restored copy and returned healthy.
- [x] The restored marker was present.
- [x] The restored database passed integrity and foreign-key checks.
- [x] The isolated restore container was removed and the original application and worker returned to healthy operation.

The synthetic drill proves the documented complete-data-directory procedure on this machine. A district still must test restoration of its own encrypted backup on its own infrastructure.

## Remaining External Acceptance

- [x] Publish controlled release images for required architectures and record the registry digest.
- [ ] Repeat the stack test on a clean, supported Linux server.
- [ ] Verify public DNS, ACME certificate issuance, firewall behavior, and external port isolation.
- [ ] Verify district-approved SMTP, reply routing, delivery failure, retry, scheduled downtime, and portal recovery.
- [ ] Complete upgrade and rollback drills between published releases.
- [ ] Name the district infrastructure and backup owners and complete a restore drill with the school's backup system.
