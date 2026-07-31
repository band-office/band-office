# Band Office Server Upgrade

This alpha runbook requires two versioned Server images for a complete upgrade and rollback drill. The first alpha can establish the installation baseline, but it cannot prove a cross-release upgrade until the next image exists.

Upgrades are manual and owned by the server operator. Do not use an automatic updater or an unqualified `latest` image.

## Before changing anything

1. Read the target release notes and migration warnings.
2. Record the current image reference and digest:

   ```bash
   docker compose images
   docker image inspect "$(docker compose config --images | head -1)" --format '{{index .RepoDigests 0}}'
   ```

3. Complete the offline pre-upgrade backup in `SERVER_BACKUP_RESTORE.md`.
4. Confirm the current health endpoint returns `{"status":"ok"}`.

## Upgrade

1. Change only `BAND_OFFICE_IMAGE` in `.env` to the exact approved release.
2. Validate, pull, and recreate:

   ```bash
   docker compose config --quiet
   docker compose pull app worker
   docker compose up -d app
   docker compose logs --tail=200 app
   docker compose up -d worker caddy
   docker compose ps
   ```

3. Verify HTTPS, director login, portal login, representative records and files, email configuration, and scheduled-job processing.
4. Record the accepted image digest with the upgrade log.

The application runs database migrations before accepting requests. Do not interrupt a migration unless the container has clearly failed and the logs have been preserved.

## Rollback

Changing the image back is not enough after a database migration. To roll back:

1. Stop the stack.
2. Preserve the failed post-upgrade `data` directory.
3. Restore the complete pre-upgrade infrastructure backup.
4. Restore the previous exact image reference.
5. Start `app`, verify records, then start `worker` and `caddy`.

Never point an older Band Office image at a database already migrated by a newer release unless that release's notes explicitly state that it is compatible.
