# Band Office Server Alpha Deployment

**Audience:** district IT, school technology staff, or an approved hosting administrator.

> [!WARNING]
> Band Office Server is district-operated alpha software, not a hosted service. Fresh installations start empty. Complete this deployment and its synthetic acceptance tests before loading student information or activating real family accounts.

Band Office Server provides staff login, student and guardian portals, and scheduled email. It is not a static website and cannot be installed by uploading files to ordinary shared hosting. The intended supported deployment is one district-approved Linux server running Docker Compose behind the included Caddy HTTPS proxy.

## Responsibility gate

Do not begin until the school has named:

- an infrastructure owner for the server, DNS, operating-system updates, firewall, and backups;
- a Band Office director responsible for people, relationships, portal access, and email content;
- a district-approved storage location for backups;
- a response contact for a lost server, exposed credential, or suspected unauthorized access.

Do not deploy student data to a personal hosting account, a home computer, or a server whose operator cannot satisfy those responsibilities.

## Required infrastructure

- A currently supported 64-bit Linux server with a static public IP
- Current Docker Engine and Docker Compose v2
- A dedicated DNS hostname such as `band.example.org`
- Inbound TCP ports 80 and 443 and UDP port 443
- Outbound HTTPS for image retrieval and certificate issuance
- Outbound access to the district-approved SMTP server
- Disk encryption and enough protected storage for `/data`, uploads, and backups

Band Office should be the only application using its hostname. The included Caddy service obtains and renews HTTPS certificates automatically. The application and communication worker do not publish host ports.

## Information to collect

- Exact Band Office Server image digest already written into the release bundle's `.env.example`
- Public hostname
- School IT contact email for certificate notices
- IANA timezone such as `America/New_York`
- Shared-mailbox SMTP password or application password

Do not use an unqualified `latest` image. Use the exact release tag and, after acceptance, record the image digest.

## Install

1. Point the hostname's DNS A and, when used, AAAA records to the server.
2. Copy the extracted `Band-Office-Server-<version>` directory to an IT-controlled location such as `/opt/band-office`.
3. Enter that directory and prepare configuration:

   ```bash
   cp .env.example .env
   mkdir -p data backups caddy-data caddy-config secrets
   chmod 700 data backups caddy-data caddy-config secrets
   sudo chown 10001:10001 data
   openssl rand -hex 32 > secrets/worker-token.txt
   touch secrets/smtp-password.txt
   chmod 600 .env secrets/worker-token.txt secrets/smtp-password.txt
   ```

4. Edit `.env`. Keep the digest-pinned `BAND_OFFICE_IMAGE` unchanged and replace the hostname, email, and timezone examples.
5. If email is already approved, place only the SMTP password in `secrets/smtp-password.txt`. Do not include a username or JSON.
6. Validate and start:

   ```bash
   docker compose config --quiet
   docker compose pull
   docker compose up -d
   docker compose ps
   ```

7. Verify the edge and database:

   ```bash
   curl --fail --silent --show-error "https://band.example.org/api/health"
   ```

   The response must be `{"status":"ok"}`. Replace the example hostname.

8. Open `https://<hostname>/login`. The first-run screen creates the program, opening period, and first director account. Use a unique password of at least 12 characters.

## Email activation

The SMTP host, port, username, sender, and reply-to address are entered by a director under **Email > Shared mailbox**. The password remains only in `secrets/smtp-password.txt`.

After changing that file:

```bash
docker compose restart app
docker compose ps
```

Verify the mailbox in Band Office before enabling portal accounts. Password setup and reset depend on successful email delivery.

## Acceptance test

- `https://<hostname>/login` loads without a certificate warning.
- `https://<hostname>/portal/login` loads.
- `http://<hostname>` redirects to HTTPS.
- Direct access to port 3000 fails from another machine.
- First director login and logout work.
- SMTP verification and one controlled test email work.
- One synthetic guardian can set a portal password and sees only the linked synthetic student.
- A scheduled synthetic announcement is processed by the worker.
- An encrypted Band Office export downloads successfully.
- The offline server backup and restore drill in `SERVER_BACKUP_RESTORE.md` succeeds.

After every item passes and `SERVER_OPERATOR_HANDOFF.md` is complete, the district may activate real accounts under its own approval and operating policies.

## Routine commands

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 worker
docker compose logs --tail=200 caddy
docker compose restart app
```

Logs can contain operational metadata. Review and redact them before sharing outside the district. Caddy access logging is intentionally disabled because private calendar bearer tokens can appear in request paths.

## Unsupported deployments

- Shared hosting or cPanel file upload
- A director's personal VPS without district authorization
- Home-server port forwarding
- Exposing `next dev`, `npm run dev`, or port 3000 publicly
- Running without HTTPS
- Multiple independent Band Office programs sharing one database
- Kubernetes, NAS application stores, or third-party one-click templates that have not passed the same acceptance test
