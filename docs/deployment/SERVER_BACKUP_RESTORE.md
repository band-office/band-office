# Server Backup and Restore

Complete an isolated synthetic restore drill before loading student information. After activation, treat every infrastructure copy and portable archive as a student record under district policy.

Band Office Server requires two backup layers:

1. **Portable program archive:** a director regularly downloads the encrypted archive from Settings to district-approved storage. Current source and `v0.1.0-server-alpha.5` use `.bandoffice`; older `.bandos` archives remain accepted.
2. **Infrastructure recovery copy:** IT backs up the complete server `data` directory while the application and worker are stopped.

The infrastructure copy is the server's direct disaster-recovery path. It contains the SQLite database and managed library, form, and event files. Copying only `bandos.db` is incomplete.

## Backup schedule

- Nightly or according to district policy: protected infrastructure backup of the server volume
- Before every Band Office upgrade: offline copy using the procedure below
- At operating-period rollover: encrypted `.bandoffice` archive plus infrastructure copy
- At least quarterly: restore drill on an isolated server

Keep backups encrypted at rest and restrict them as student records. Do not place them in personal cloud storage.

## Offline infrastructure backup

From the deployment directory:

```bash
mkdir -p backups
docker compose stop worker app
backup="backups/band-office-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
sudo tar -czf "$backup" data
sudo chown "$(id -u):$(id -g)" "$backup"
chmod 600 "$backup"
sha256sum "$backup" > "$backup.sha256"
docker compose start app worker
docker compose ps
```

The application is briefly unavailable while `app` is stopped. `sudo` is required because the protected `data` directory belongs to the non-root container UID `10001`. Do not copy live SQLite, WAL, and managed files independently.

Verify the checksum after copying the archive to district-approved encrypted storage. Record the backup filename, checksum, creation time, Band Office image reference, and the operator who created it.

## Restore drill

Never test restoration against the production directory. Provision an isolated server with no public DNS, copy the deployment bundle and backup to it, and:

1. Configure the same Band Office release image used when the backup was created.
2. Keep ports blocked from public access.
3. Extract the backup and restore the required ownership:

   ```bash
   sudo tar -xzf backups/band-office-data-YYYYMMDDTHHMMSSZ.tar.gz
   sudo chown -R 10001:10001 data
   sudo chmod 700 data
   ```

   The restored deployment must contain `data/bandos.db` and all managed-file directories.
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
4. Extract the accepted infrastructure backup into a new `data` directory, then run `sudo chown -R 10001:10001 data` and `sudo chmod 700 data`.
5. Set the Band Office image to the version recorded with that backup.
6. Start `app`, verify database health and representative records, then start `worker` and `caddy`.
7. Record the incident, restored backup, missing time window, and operator.

An encrypted `.bandoffice` archive remains the portable program copy. Direct server restoration from that archive is not automated in v0.1; do not claim otherwise. Production disaster recovery uses the tested complete-data-directory procedure above.
