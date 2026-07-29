# Download Band Office Desktop

Band Office Desktop is the local version for one director and one program. It stores program records on that computer and does not make the student or guardian portals available on the internet.

> [!IMPORTANT]
> This is unsigned alpha software. Start with the fictional demo. Before loading student information, obtain school approval, use a district-managed encrypted computer, and complete an encrypted backup and verified restore.

## Choose your computer

| macOS Apple Silicon | Windows x64 |
| --- | --- |
| **[Download the Mac installer](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.2/Band-Office-0.1.0-mac-arm64.dmg)** | **[Download the Windows installer](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.2/Band-Office-0.1.0-win-x64.exe)** |
| For Macs with Apple silicon, including M1, M2, M3, and M4. | For 64-bit Windows computers. |

### Install on a Mac

1. Open the downloaded `.dmg` and move Band Office to Applications.
2. Because the app is not Apple-signed, Control-click Band Office, choose **Open**, then confirm **Open**.
3. Create a local director account. Choose **Fictional demo** on the first screen to explore without student information.

Verify the download with [`SHA256SUMS-macos.txt`](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.2/SHA256SUMS-macos.txt).

### Install on Windows

1. Open the downloaded `.exe`.
2. If Microsoft Defender SmartScreen appears, choose **More info**, verify that the app is Band Office, then choose **Run anyway**.
3. Create a local director account. Choose **Fictional demo** on the first screen to explore without student information.

Verify the download with [`SHA256SUMS-windows.txt`](https://github.com/band-office/band-office/releases/download/v0.1.0-alpha.2/SHA256SUMS-windows.txt).

School-managed computers may block unsigned applications. Do not bypass district controls. Ask district IT to review the [source](https://github.com/band-office/band-office), release checksums, and [current release status](./CURRENT_STATUS.md).

## What the fictional demo does

The first-run **Fictional demo** option loads Ridgeline Middle School Band, a deterministic set of invented people, assets, assignments, financial records, library records, forms, and events. You choose the local director username and password.

Use the demo to test workflows and decide whether Band Office fits your program. Do not add real student records to the demo installation. When you are ready to start an approved program installation, remove the demo application data or use a clean computer profile and create **My program** instead.

## Need family portals?

Desktop is not a public website. Student and guardian access requires the separately released, district-operated [Band Office Server](./SERVER_DEPLOYMENT.md). A district must own and approve the server, domain, HTTPS, email relay, monitoring, backups, and restore process.

Read [Where Your Data Goes](./DATA_FLOW.md) before choosing either release.
