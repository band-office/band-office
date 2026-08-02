# Download Band Office Desktop

Band Office Desktop is the local version for one director and one program. It stores program records on that computer and does not make the student or guardian portals available on the internet.

> [!IMPORTANT]
> This is alpha software. The Mac installers are Developer ID-signed and Apple-notarized; Windows is unsigned. Start with the fictional demo. Before loading student information, obtain school approval, use a district-managed encrypted computer, and complete an encrypted backup and verified restore.

New to Band Office? Follow the [five-minute first-run guide](./FIRST_RUN.md) after installation.

## Choose your computer

- **[Apple Silicon Mac installer](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/Band-Office-0.1.0-mac-arm64.dmg)** for Macs with an M-series chip.
- **[Intel Mac installer](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/Band-Office-0.1.0-mac-x64.dmg)** for Macs that list an Intel processor.
- **[Windows x64 installer](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/Band-Office-0.1.0-win-x64.exe)** for 64-bit Windows computers.

### Install on a Mac

1. Open the downloaded `.dmg` and move Band Office to Applications.
2. Open Band Office from Applications. The published Mac app is Developer ID-signed and Apple-notarized, so it should open without a Gatekeeper override. Do not use Terminal commands or disable macOS security controls if a managed device blocks installation; ask district IT to review the release instead.
3. Create a local director account. Choose **Fictional demo** on the first screen to explore without student information.

Band Office Desktop requires macOS 12 Monterey or later. To identify your Mac, open **Apple menu > About This Mac**. A **Chip** entry such as M1, M2, M3, or M4 means Apple Silicon. A **Processor** entry containing Intel means Intel Mac.

Verify the download with the matching checksum file:

- [Apple Silicon checksums](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/SHA256SUMS-macos-arm64.txt)
- [Intel Mac checksums](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/SHA256SUMS-macos-x64.txt)

### Install on Windows

1. Open the downloaded `.exe`.
2. If Microsoft Defender SmartScreen appears, choose **More info**, verify that the app is Band Office, then choose **Run anyway**.
3. Create a local director account. Choose **Fictional demo** on the first screen to explore without student information.

Verify the download with [`SHA256SUMS-windows.txt`](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.14/SHA256SUMS-windows.txt).

School-managed computers may block unsigned applications. Do not bypass district controls. Ask district IT to review the [source](https://github.com/band-office/band-office), release checksums, and [current release status](../release/CURRENT_STATUS.md).

## What the fictional demo does

The first-run **Fictional demo** option loads Ridgeline Middle School Band, a deterministic set of invented people, assets, assignments, financial records, library records, forms, and events. You choose the local director username and password.

Use the demo to test workflows and decide whether Band Office fits your program. Do not add real student records to the demo installation. When you are ready to start an approved program installation, choose **Start my program** in the permanent demo banner. Band Office preserves the demo in its recovery snapshots, clears the active demo data, restarts, and returns to first-run setup so you can create **My program**.

## Need family portals?

Desktop is not a public website. Student and guardian access requires the separately released, district-operated [Band Office Server](../deployment/SERVER_DEPLOYMENT.md). A district must own and approve the server, domain, HTTPS, email relay, monitoring, backups, and restore process.

Read [Where Your Data Goes](./DATA_FLOW.md) before choosing either release.
