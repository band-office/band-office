import { basename } from "node:path";
import { validateBackupArchive } from "../desktop/backup-archive.mjs";

const archivePath = process.argv[2];
if (!archivePath) throw new Error("Usage: npm run backup:verify -- /path/to/band-office-backup.bandoffice [passphrase]");

const passphrase = process.argv[3] || process.env.BANDOS_BACKUP_PASSPHRASE || "";
const result = await validateBackupArchive(archivePath, passphrase);
console.log(`Verified ${basename(archivePath)}: manifest v${result.manifest.version}, SQLite integrity and foreign keys ok, ${result.checkedTables} CSV table counts match.`);
