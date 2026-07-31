# Student and Guardian Portal Activation

**Audience:** district IT and Band Office directors after completing `SERVER_DEPLOYMENT.md`.

> [!WARNING]
> Complete the controlled synthetic pilot below before enabling real student or guardian accounts. The district owns approval of its family rollout.

Portal access is enabled person by person. A student ID is not used to connect a guardian to a student and is not required for portal login. Relationships are created through searchable people records.

## Before enabling accounts

1. Confirm the public Band Office address uses HTTPS.
2. Verify the shared mailbox under **Email > Shared mailbox**.
3. Import or create students and guardians.
4. Open each student record and confirm the correct guardian relationships.
5. Resolve duplicate people and duplicate email addresses.
6. Confirm each portal user has a private email address they control.

Do not give two people one shared portal account. A portal email address must be unique within the program.

## Controlled pilot

1. Create a synthetic student and synthetic guardian.
2. Link the guardian through the student record.
3. Enable portal access for the synthetic guardian.
4. In a private browser window, open `/portal/login`.
5. Select **Forgot or need to set your password?**
6. Request the one-time code, set a password, and sign in.
7. Confirm the guardian sees only the linked student's current property, fee balance, and form status.
8. Disable the synthetic account and confirm it can no longer sign in.

Stop and contact the server operator if the reset email does not arrive, HTTPS is invalid, or unrelated student information appears.

## Family rollout

After Server acceptance and district approval are complete, enable accounts only after the relationship review. Send families the public portal address through the school's approved communication channel. Do not send passwords. Each user creates or resets their own password through the emailed one-time code.

When a relationship changes:

- update the guardian/student link first;
- disable access immediately when a person should no longer enter the portal;
- review shared-email situations rather than creating duplicate accounts;
- never place custody restrictions, medical details, or family circumstances in Band Office notes.

## Director support boundary

Directors can correct names, email addresses, relationships, and account status. Directors do not need to know or reset a family password. The user completes password recovery through the verified mailbox.

Send server outages, certificate warnings, failed backups, and suspected unauthorized access to the named IT operator. Do not work around an outage by exposing a desktop copy to the internet.
