# BandOS v0.1 Update Policy

BandOS v0.1 uses manual, director-initiated updates. The application contains no update service, update polling, silent download, or automatic installer. This preserves the zero-runtime-network boundary and prevents an updater from changing a live school database without a recovery path.

## Supported update sequence

1. Create an encrypted BandOS backup and verify it with `npm run backup:verify -- <archive> <passphrase>`.
2. Quit BandOS completely.
3. Install the signed replacement application from the official release artifact for the same platform.
4. Start BandOS. Before applying pending migrations, the desktop launcher writes a consistent `pre-migration-*.db` recovery snapshot under the BandOS application-data directory.
5. Confirm the program, roster, inventory counts, current assignments, and newest audit entry before deleting the prior installer.

The application bundle and the live database are stored separately. Replacing the application must not remove the operating system application-data directory.

## Failure and rollback

- Do not open a migrated database with an older BandOS build.
- Preserve the application-data directory and `recovery-snapshots/` before troubleshooting.
- Reinstall the prior signed application only with its compatible database, or restore the verified pre-update backup through the desktop restore workflow.
- A failed migration restores the pre-migration snapshot before startup exits. An interrupted restore preserves or recovers the displaced database before retrying.

## Future updater gate

An automatic updater is not authorized for v0.1. A future updater requires a separate threat model, signed update metadata, rollback behavior, staged rollout controls, visible consent, and tests proving it cannot bypass database snapshots or release signatures.
