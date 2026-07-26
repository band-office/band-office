# Server Backup and Restore

This runbook belongs to the Server technical preview. Use fictional data until the supported-image, public-edge, district-ownership, and approval gates pass.

Band Office Server requires two backup layers:

1. **Portable program archive:** a director regularly downloads the encrypted `.bandos` archive from Settings to district-approved storage.
2. **Infrastructure recovery copy:** IT backs up the complete server `data` directory while the application and worker are stopped.

The infrastructure copy is the server's direct disaster-recovery path. It contains the SQLite database and managed library, form, and event files. Copying only `bandos.db` is incomplete.

## Backup schedule

- Nightly or according to district policy: protected infrastructure backup of the server volume
- Before every Band Office upgrade: offline copy using the procedure below
- At operating-period rollover: encrypted `.bandos` archive plus infrastructure copy
- At least quarterly: restore drill on an isolated server

Keep backups encrypted at rest and restrict them as student records. Do not place them in personal cloud storage.

## Offline infrastructure backup

From the deployment directory:

```bash
mkdir -p backups
docker compose stop worker app
tar -czf "backups/band-office-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" data
docker compose start app worker
docker compose ps
```

The application is briefly unavailable while `app` is stopped. Do not copy live SQLite, WAL, and managed files independently.

Record the backup filename, creation time, Band Office image reference, and the operator who created it. Move the archive to district-approved encrypted storage after the command completes.

## Restore drill

Never test restoration against the production directory. Provision an isolated server with no public DNS, copy the deployment bundle and backup to it, and:

1. Configure the same Band Office release image used when the backup was created.
2. Keep ports blocked from public access.
3. Extract the backup so the restored deployment contains `data/bandos.db` and all managed-file directories.
4. Start only the application:

   ```bash
   docker compose up -d app
   docker compose ps
   docker compose logs --tail=200 app
   ```

5. Verify `/api/health`, sign in, inspect representative people, assignments, financial entries, library files, forms, and event files.
6. Stop and remove the isolated drill environment according to district retention policy.

## Production recovery

1. Preserve the failed deployment and logs; do not overwrite them.
2. Stop the stack with `docker compose down`.
3. Rename the failed `data` directory with a timestamp.
4. Extract the accepted infrastructure backup into a new `data` directory.
5. Set the Band Office image to the version recorded with that backup.
6. Start `app`, verify database health and representative records, then start `worker` and `caddy`.
7. Record the incident, restored backup, missing time window, and operator.

An encrypted `.bandos` archive remains the open-format portability copy. Direct server restoration from that archive is not automated in v0.1; do not claim otherwise. Production disaster recovery uses the tested complete-data-directory procedure above.
