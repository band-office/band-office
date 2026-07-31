# Where Your Data Goes

Band Office has two deployment paths. Desktop runs on one computer for local staff use. Server runs on district-operated infrastructure when a school needs student and guardian portals or continuous scheduled email.

Installing Band Office does not by itself establish FERPA compliance. The school or district remains responsible for approval, access, devices, hosting, backups, retention, and incident response.

## Band Office Desktop

| Activity | What leaves the computer |
| --- | --- |
| People, groups, inventory, finances, forms, events, and reports | Nothing. Records are stored in the local SQLite database. |
| Backups and exports | Nothing unless a staff user moves the resulting file. Store it only in district-approved encrypted storage. |
| Email | Only the selected recipient addresses, message, and attachments are sent through the email provider configured by the director. The database is not uploaded. |
| Barcode and QR scanning | Nothing. Camera frames are processed in the app and are not stored or transmitted. |
| Opening an approved external link | The computer's browser connects to the destination selected by the staff user. Band Office does not attach database records to the link. |
| Updates, analytics, and error reporting | Nothing. Band Office has no telemetry, analytics, cloud sync, automatic update ping, or remote error-reporting service. |

The Desktop application listens only on the local computer. It cannot provide public student or guardian portals.

## Band Office Server

The Server release stores the same program records on a Linux server operated by the school or district. Its family portals are intentionally reachable through district-controlled HTTPS.

The district controls:

- the server and physical or cloud hosting account;
- the domain, DNS, and HTTPS certificates;
- staff and family account activation;
- the email relay and credentials;
- firewall rules, logs, monitoring, patches, and upgrades;
- encrypted backups, restore tests, retention, and incident response.

Band Office does not operate a hosted service and does not receive a copy of the server database. The server deployment must pass the supplied [acceptance record](../release/SERVER_ACCEPTANCE_RECORD.md) before real family accounts are activated.

## Email is an explicit network action

Band Office does not send email until a director or server operator configures an email connection. When staff send a message, the configured provider receives the recipient address, message body, and any selected attachment. Standard SMTP is the current connector. Some Microsoft 365 and Google Workspace districts block that method or require settings controlled by IT.

Email capability is not blanket permission to upload the program database. There is no database-sync endpoint or Band Office cloud account.

## Before using real student information

1. Obtain school or district approval for the chosen Desktop or Server deployment.
2. Use district-managed, disk-encrypted equipment and named staff accounts.
3. Store backups and exports only in district-approved encrypted storage.
4. Create an encrypted backup, restore it, and confirm that the restored records open correctly.
5. Define who owns updates, access review, retention, and incident response.

While Band Office remains alpha software, evaluate it with the fictional demo first.
