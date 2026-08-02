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
- Desktop alpha.15 Mac packages are Developer ID-signed, Apple-notarized, stapled, and Gatekeeper-validated. Earlier ad hoc-signed packages remain release history only. Windows remains unsigned. Every package has checksums and platform guidance. Current pull-request artifacts are test builds only.

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
npm run desktop:dist:mac   # ad hoc-signed macOS DMG and ZIP
npm run desktop:dist:mac:arm64 # explicit Apple Silicon package
npm run desktop:dist:mac:x64   # explicit Intel package; run on Intel macOS
npm run desktop:dist:mac:arm64:signed # Developer ID-sign and notarize Apple Silicon
npm run desktop:dist:mac:x64:signed   # Developer ID-sign and notarize Intel macOS
npm run desktop:dist:mac:arm64:sign-only # Developer ID-sign Apple Silicon without waiting for Apple
npm run desktop:dist:mac:x64:sign-only   # Developer ID-sign Intel without waiting for Apple
npm run desktop:dist:win   # unsigned Windows NSIS and ZIP, run on Windows
```

The packaging script always restores native modules to the contributor Node ABI after Electron packaging, including after a failed build.

Signing is opt-in so local builds cannot accidentally invoke a certificate:

```bash
npm run desktop:dist:mac:signed
npm run desktop:dist:win:signed
```

The signed Mac commands set `BANDOS_SIGN_DESKTOP=1` and force code signing. The `:signed` commands also enable Electron Builder notarization for a local maintainer; the `:sign-only` commands are reserved for the resumable GitHub release preparation workflow. Both require a Developer ID Application certificate and App Store Connect team API key; see [macOS signing setup](./MACOS_SIGNING.md). Windows signed packaging requires Microsoft Entra authentication secrets and Artifact Signing profile values; the packaging script fails before building if any are missing. The current Windows alpha remains unsigned.

The only authorized public Desktop publication path is the two-stage GitHub workflow: `.github/workflows/desktop-alpha-release.yml` prepares Developer ID-signed Mac artifacts and submits their exact ZIPs to Apple; `.github/workflows/desktop-alpha-finalize.yml` validates accepted tickets, staples those exact apps, checks Gatekeeper, combines them with the unsigned Windows artifacts, and requires approval through the protected `desktop-alpha-release` environment before creating a GitHub prerelease. See [DESKTOP_ALPHA_RELEASE.md](../release/DESKTOP_ALPHA_RELEASE.md).

## Public release gates

1. Both Developer ID-signed and Apple-notarized macOS architectures pass strict recursive signature verification, notarization-ticket validation, Gatekeeper assessment, native application acceptance, executable-architecture checks, DMG verification, checksum generation, and clean-machine launch testing without a Gatekeeper override.
2. The unsigned Windows package passes application acceptance, checksum generation, and clean-machine SmartScreen override testing.
3. Clean macOS and Windows machines complete install, first-run setup, backup, restore, and uninstall checks.
4. An older supported database upgrades successfully, with the automatic recovery snapshot verified.
5. The update strategy is explicit. No update may silently replace the live database or bypass migration snapshots.
6. Published artifacts include SHA-256 checksums and match the source tag.

Updates are manual and director-initiated for v0.1. See [UPDATE_POLICY.md](./UPDATE_POLICY.md); no updater or update-polling code ships in the application.
