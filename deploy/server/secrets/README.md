# Runtime secrets

Create these two files on the server. Do not commit, email, or place them in a support ticket.

- `worker-token.txt`: one line containing at least 32 random characters. Generate it with `openssl rand -hex 32`.
- `smtp-password.txt`: the password or application password for the district-approved shared mailbox. Create an empty file until email is configured.

Restrict both files before starting Band Office:

```bash
chmod 600 secrets/worker-token.txt secrets/smtp-password.txt
```
