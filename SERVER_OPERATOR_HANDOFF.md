# Band Office Server Operator Handoff

Complete and retain this record before loading student information or activating family accounts.

## Installation

- School or district:
- Program:
- Public hostname:
- Deployment directory:
- Band Office release tag:
- Band Office image digest:
- Installation date:

## Named Owners

- Infrastructure owner:
- Backup owner:
- Band director owner:
- SMTP mailbox owner:
- Security or incident contact:

## Protected Locations

- Encrypted server or volume:
- Complete-data backup location:
- Portable encrypted archive location (`.bandoffice` or legacy `.bandos`):
- Backup retention policy:

Do not record passwords, worker tokens, recovery codes, or other secrets in this handoff.

## Acceptance

- [ ] HTTPS loads without a warning and HTTP redirects to HTTPS.
- [ ] Only ports 80 and 443 are publicly reachable.
- [ ] Staff login and logout work.
- [ ] District SMTP verification and controlled email delivery work.
- [ ] Scheduled email runs after worker restart and requires confirmation after missed downtime.
- [ ] Synthetic student portal access is limited to that student.
- [ ] Synthetic guardian portal access is limited to explicitly linked students.
- [ ] Disabling a portal account immediately blocks access.
- [ ] Password setup and recovery work through the district mailbox.
- [ ] Encrypted portable-backup verification passes.
- [ ] A complete-data backup restores on isolated infrastructure.
- [ ] Upgrade and rollback procedures have been reviewed.

## Operating Record

- Last successful infrastructure backup:
- Last successful portable archive:
- Last isolated restore drill:
- Last image update:
- Next scheduled review:

If an owner leaves or the hostname, server, mailbox, or backup location changes, update this handoff before normal operation continues.
