# Runtime secrets

These instructions belong to the district-operated Server alpha. Use synthetic credentials during acceptance and switch to district-approved credentials only after the deployment passes the published gates.

Create these two files on the server. Do not commit, email, or place them in a support ticket.

- `worker-token.txt`: one line containing at least 32 random characters. Generate it with `openssl rand -hex 32`.
- `smtp-password.txt`: the password or application password for the district-approved shared mailbox. Create an empty file until email is configured.

Restrict both files before starting Band Office:

```bash
sudo chown 10001:10001 secrets/worker-token.txt secrets/smtp-password.txt
sudo chmod 400 secrets/worker-token.txt secrets/smtp-password.txt
```

UID `10001` is the non-root Band Office account inside the application image. Docker Compose file-backed secrets keep their host ownership on Linux. To change the SMTP password later, use `sudoedit secrets/smtp-password.txt`, then confirm both the owner and mode remain unchanged.
