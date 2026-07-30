# Band Office Desktop Packaging

Band Office uses Electron as a local desktop shell around the same standalone Next.js application used by the server edition. The shell is not a remote website wrapper: it starts a private loopback server, opens one hardened application window, and owns the local database lifecycle.

## Current status

- Apple Silicon macOS `.app`, DMG, and ZIP build successfully. Intel x64 packages are built and tested separately on a native GitHub-hosted Intel runner.
- Fresh and historical profiles create or upgrade the database, apply all migrations, render successfully, and preserve existing records.
- Pre-migration recovery snapshots, SQLite integrity and foreign-key checks, DMG verification, ZIP integrity, and SHA-256 checksums pass locally.
- Native `argon2` and `better-sqlite3` modules are rebuilt explicitly for the installed Electron version.
- Camera permission is limited to director-initiated inventory scanning; audio and all unrelated Electron permissions remain denied.
- SMTP credentials are encrypted with Electron `safeStorage`, excluded from the database and backups, and passed only to the supervised local server process after restart.
- Unsigned Windows NSIS and ZIP packaging plus packaged-app smoke acceptance pass in public GitHub Actions.
- The repository includes a fail-closed unsigned alpha workflow. Both platforms are intentionally unsigned with checksums and platform warnings. Current CI artifacts are test builds only.

## Runtime layout

Electron stores live records outside the application bundle:

| Platform | Application data root |
| --- | --- |
| macOS | `~/Library/Application Support/BandOS` |
| Windows | `%APPDATA%\BandOS` |

Within that root:

The legacy `BandOS` application-data directory is intentionally retained after the public rename to Band Office. Changing it would make an existing database, recovery snapshots, and encrypted SMTP credential appear to be missing.

- `data/bandos.db` is the live SQLite database.
- `logs/desktop.log` records desktop startup, migration, server, and restore events.
- `recovery-snapshots/` holds pre-migration and pre-restore database copies.
- `secrets/smtp-password.json` contains only the operating-system-encrypted SMTP credential payload.
- A validated restore is staged, applied on restart, and preserves the prior database first.

The packaged application contains migrations and the standalone server, but no `.env` file, demo database, or real program data.

## Build commands

```bash
npm run desktop:pack       # unpacked application for the current OS
npm run desktop:dist:mac   # unsigned macOS DMG and ZIP
npm run desktop:dist:mac:arm64 # explicit Apple Silicon package
npm run desktop:dist:mac:x64   # explicit Intel package; run on Intel macOS
npm run desktop:dist:win   # unsigned Windows NSIS and ZIP, run on Windows
```

The packaging script always restores native modules to the contributor Node ABI after Electron packaging, including after a failed build.

Signing is opt-in so local builds cannot accidentally invoke a certificate:

```bash
npm run desktop:dist:mac:signed
npm run desktop:dist:win:signed
```

Those commands set `BANDOS_SIGN_DESKTOP=1` and remain available for future signed channels. Windows signed packaging requires Microsoft Entra authentication secrets and Artifact Signing profile values; the packaging script fails before building if any are missing. The initial public alpha uses the unsigned commands for both platforms.

The only authorized public Desktop publication path is `.github/workflows/desktop-alpha-release.yml`. It verifies the unsigned distribution boundary, packaged legal files, application behavior, disk image, and checksums, then requires approval through the protected `desktop-alpha-release` environment before creating a GitHub prerelease. See [DESKTOP_ALPHA_RELEASE.md](./DESKTOP_ALPHA_RELEASE.md).

## Public release gates

1. Both unsigned macOS architectures pass native application acceptance, executable-architecture checks, DMG verification, checksum generation, and clean-machine Gatekeeper override testing.
2. The unsigned Windows package passes application acceptance, checksum generation, and clean-machine SmartScreen override testing.
3. Clean macOS and Windows machines complete install, first-run setup, backup, restore, and uninstall checks.
4. An older supported database upgrades successfully, with the automatic recovery snapshot verified.
5. The update strategy is explicit. No update may silently replace the live database or bypass migration snapshots.
6. Published artifacts include SHA-256 checksums and match the source tag.

Updates are manual and director-initiated for v0.1. See [UPDATE_POLICY.md](./UPDATE_POLICY.md); no updater or update-polling code ships in the application.
