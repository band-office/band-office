# Band Office Desktop alpha

This is a prerelease for controlled evaluation of the local-only Band Office Desktop application.

## Supported packages

- macOS Apple Silicon: unsigned DMG and ZIP. macOS will require a manual Gatekeeper override through Privacy & Security.
- Windows x64: unsigned NSIS installer and ZIP. Windows may show a Microsoft Defender SmartScreen warning.

## Important boundaries

- Desktop runs one program on one local computer.
- Desktop does not expose student or guardian portals to the public internet.
- Server and family portals remain a separate district-operator technical preview.
- Real student data requires school approval, a district-managed encrypted computer, an encrypted backup, and a verified restore drill.
- Updates are manual. Create and verify a backup before installing a later alpha.
- Verify the published SHA-256 checksum before opening a macOS package. The unsigned macOS build is not verified or notarized by Apple.
- Verify the published SHA-256 checksum before opening a Windows package. The unsigned Windows build is not verified by Microsoft.

This alpha is not a stable or supported CutTime replacement. Read `CURRENT_STATUS.md`, `RELEASE_CHANNELS.md`, and `UPDATE_POLICY.md` before evaluation.
