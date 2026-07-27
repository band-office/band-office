# Band Office Server alpha

This is the district-operated Band Office release with staff access, scheduled email, and student and guardian portals.

## What district IT receives

- A public multi-platform image for Linux AMD64 and ARM64.
- A digest-pinned operator ZIP with Docker Compose, Caddy HTTPS, secrets setup, and complete runbooks.
- SHA-256 checksums and a source-bound release manifest.
- OCI SBOM, maximum-level provenance, and GitHub-signed build provenance.

## Important boundaries

- One deployment runs one band program.
- Fresh installations start empty and contain no demo records.
- The Server alpha can support real program operations.
- District IT owns the Linux server, DNS, HTTPS, firewall, SMTP relay, encrypted backups, updates, monitoring, and incident response.
- Complete the synthetic student and guardian acceptance checklist before activating real family accounts.
- Standard SMTP is supported. Google and Microsoft OAuth are not included in this alpha.
- Do not use shared hosting, cPanel upload, a home server, an unqualified `latest` image, or a publicly exposed application port.

Download `Band-Office-Server-0.1.0.zip`, verify `SHA256SUMS.txt`, and start with `SERVER_DEPLOYMENT.md`. The operator bundle pins the exact image digest from this release.

This is alpha software, not a hosted service or a supported CutTime replacement.
