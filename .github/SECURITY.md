# Security policy

Band Office handles operational school-program data. Security reports should be treated carefully during the public-alpha phase.

## Supported versions

Band Office has not issued a stable release. Security fixes currently target the latest commit on `main` and the latest identified Desktop and Server alpha tags.

Temporary CI artifacts and untagged historical snapshots are not supported distribution channels. Use only the versioned GitHub prereleases and their published checksums.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub’s **Report a vulnerability** link when private vulnerability reporting is available. If the link is not visible, contact the project owner through a private method listed on their GitHub profile and ask for a secure reporting channel without posting exploit details.

Please include:

- the affected commit, branch, or package;
- the deployment mode involved;
- clear reproduction steps using fictional data;
- the expected and observed security boundary;
- likely impact;
- any suggested mitigation.

Do not access, retain, or transmit real student, guardian, staff, payment, or school data while testing.

## Response

The project will acknowledge a usable report as soon as practical, reproduce it, assess affected surfaces, and coordinate a fix and disclosure timeline with the reporter. Release timing depends on severity, exploitability, migration risk, and the school-operational impact of the fix.

## Deployment boundary

The Electron app is local-only. Family access requires the district-operated Server alpha behind HTTPS. A district may use that alpha for real program operations only after completing the published acceptance record, assigning infrastructure and data owners, and approving the deployment. Do not expose the development server, the raw application port, or a home-server port forward to the public internet.

See [RELEASE_CHANNELS.md](../docs/release/RELEASE_CHANNELS.md), [SERVER_SUPPORT_BOUNDARY.md](../docs/deployment/SERVER_SUPPORT_BOUNDARY.md), [SECURITY_CHECKLIST.md](../docs/release/SECURITY_CHECKLIST.md), and [CURRENT_STATUS.md](../docs/release/CURRENT_STATUS.md) before using Band Office with real program data.
