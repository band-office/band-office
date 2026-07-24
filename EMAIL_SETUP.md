# BandOS Email Setup

BandOS v0.4 sends through one shared program mailbox using standard SMTP. Google and Microsoft OAuth are not yet implemented.

## Desktop

1. Open **Email**, then **Shared mailbox**.
2. Enter the approved sender identity and SMTP host, port, username, and TLS mode.
3. Store the SMTP password or app password in the credential panel.
4. Restart BandOS when prompted.
5. Return to Shared mailbox and verify the connection.

The desktop credential is encrypted through Electron `safeStorage`, which uses the operating system credential protection available to the signed-in user. It is excluded from SQLite, audit diffs, readable exports, and encrypted BandOS backups.

## Local server or Docker

Set the password only in the process environment:

```bash
BANDOS_SMTP_PASSWORD="your-provider-credential" npm run dev
```

Do not place a real credential in source control, a Docker image, a screenshot, or a support issue.

## Delivery behavior

- Each deduplicated address receives a separate message; BandOS does not expose one recipient to another.
- SMTP acceptance is recorded per destination. It does not prove final inbox delivery.
- Immediate provider rejection appears in the failure queue and can be retried without resending successful destinations.
- Desktop schedules run only while BandOS is open.
- Messages overdue at startup are held until a staff user confirms them.
- Replies go to the configured school mailbox. BandOS is not an inbox.

Before real use, send a controlled announcement to staff-owned test addresses, verify reply routing, inspect attachment delivery, force one rejected address, retry it, restart across a scheduled time, and restore the resulting version-5 backup on a clean test profile.
