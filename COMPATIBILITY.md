# Band Office Compatibility Identifiers

Band Office was originally named BandOS. Current product text, downloads, brand assets, and newly created encrypted backups use the Band Office name. A limited set of older identifiers remains intentionally unchanged because renaming them would break upgrades, make existing data appear missing, or invalidate items already in use.

## Retained identifiers

- Desktop application-data directory: `BandOS`
- SQLite database and snapshot filenames: `bandos.db` and related recovery names
- Environment variables beginning with `BANDOS_`
- Desktop bridge, session-cookie, and migration-table identifiers
- Existing Docker volume names
- Asset QR payload prefix: `bandos:asset:`
- Encrypted-backup format marker: `BANDOSENC1`
- Desktop application identifier: `org.bandos.desktop`

These values are implementation contracts, not the current product name. New encrypted backups use the `.bandoffice` extension. Restore and verification continue to accept legacy `.bandos` files and older BandOS backup manifests.

Do not rename a retained identifier without an explicit migration, backward-compatibility tests, and a recovery plan for existing installations.
