# Band Office Desktop alpha

This is a functional prerelease of the local-only Band Office Desktop application for directors running one program on one computer.

## Supported packages

- macOS Apple Silicon: ad hoc-signed DMG and ZIP with a verified bundle integrity seal.
- macOS Intel x64: ad hoc-signed DMG and ZIP with a verified bundle integrity seal.
- Windows x64: unsigned NSIS installer and ZIP. Windows may show a Microsoft Defender SmartScreen warning.

Both macOS packages require a manual Gatekeeper override through Privacy & Security.
Both require macOS 12 Monterey or later.

## Important boundaries

- Desktop runs one program on one local computer.
- First-run setup offers an empty program or the deterministic fictional Ridgeline demo.
- Do not add real student information to the demo installation.
- Directors can use the alpha for real local program operations.
- Desktop does not expose student or guardian portals to the public internet.
- Server and family portals remain a separate district-operator technical preview.
- Before loading student information, obtain school approval, use a district-managed encrypted computer, and complete an encrypted backup and verified restore drill.
- Updates are manual. Create and verify a backup before installing a later alpha.
- Verify the published SHA-256 checksum before opening a macOS package. The Mac bundle is integrity-sealed, but it is not identified, verified, or notarized by Apple.
- Verify the published SHA-256 checksum before opening a Windows package. The unsigned Windows build is not verified by Microsoft.

This alpha is not yet stable or a supported CutTime replacement. Read `DOWNLOAD.md`, `DATA_FLOW.md`, `CURRENT_STATUS.md`, `RELEASE_CHANNELS.md`, and `UPDATE_POLICY.md` before adoption.
