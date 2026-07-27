# Band Office Server Alpha Release

Band Office Server is the district-operated release channel for staff access, scheduled email, and student and guardian portals. It runs one program on one Linux server. It is not a hosted Band Office service.

## Release Identity

- Tag format: `v<package-version>-server-alpha.<number>`, for example `v0.1.0-server-alpha.1`.
- Container: `ghcr.io/band-office/band-office-server`.
- Platforms: Linux AMD64 and Linux ARM64.
- GitHub release: prerelease created only by `.github/workflows/server-alpha-release.yml`.
- Operator bundle: digest-pinned Docker Compose, Caddy, secrets instructions, checksums, and runbooks.
- Registry staging tag: commit-scoped `sha-<commit>` only. The GitHub release and immutable digest, not a version-only container tag, define a completed release.

The release workflow rejects a tag that does not match `package.json`, does not point into `main`, or fails quality, container, packaged-Compose, portal, vulnerability, artifact, or protected-publication checks.

## Published Evidence

Every Server alpha release provides:

- an immutable multi-platform image digest;
- OCI SBOM and maximum-level provenance attached by Docker Buildx;
- signed GitHub build provenance backed by Sigstore;
- an operator ZIP whose `.env.example` pins the exact image digest;
- SHA-256 checksums;
- a source-bound release manifest;
- the Apache license and third-party notice.

Verify image provenance:

```bash
gh attestation verify \
  oci://ghcr.io/band-office/band-office-server@sha256:RELEASE_DIGEST \
  --repo band-office/band-office
```

## Release Boundary

Fresh installations start empty and contain no demo records. A district may use the Server alpha for real program operations after completing the supplied acceptance checklist and assigning the owners in `SERVER_OPERATOR_HANDOFF.md`.

Before activating real student or guardian accounts, the district must verify public HTTPS, port isolation, SMTP delivery and recovery, relationship scoping, encrypted backups, and restoration. Google and Microsoft OAuth are not included in the first Server alpha; the operator must provide an approved standard SMTP relay.

The project publishes software and runbooks. It does not operate, monitor, back up, or provide emergency response for a district installation.
