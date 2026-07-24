import Database from "better-sqlite3";
import { chmod, copyFile, cp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

export const PENDING_RESTORE_FILENAME = "bandos.restore-pending.db";
export const PENDING_LIBRARY_RESTORE_DIRECTORY = "library-files.restore-pending";
export const PENDING_FORM_RESTORE_DIRECTORY = "form-files.restore-pending";
export const PENDING_EVENT_RESTORE_DIRECTORY = "event-files.restore-pending";
const STAGED_RESTORE_FILENAME = "bandos.restore-staged.db";
const DISPLACED_DATABASE_FILENAME = "bandos.restore-current.db";
const LIBRARY_DIRECTORY = "library-files";
const STAGED_LIBRARY_DIRECTORY = "library-files.restore-staged";
const DISPLACED_LIBRARY_DIRECTORY = "library-files.restore-current";
const FORM_DIRECTORY = "form-files";
const STAGED_FORM_DIRECTORY = "form-files.restore-staged";
const DISPLACED_FORM_DIRECTORY = "form-files.restore-current";
const EVENT_DIRECTORY = "event-files";
const STAGED_EVENT_DIRECTORY = "event-files.restore-staged";
const DISPLACED_EVENT_DIRECTORY = "event-files.restore-current";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function applyPendingRestore({ dataDirectory, databasePath, snapshotsDirectory }) {
  const pendingPath = path.join(dataDirectory, PENDING_RESTORE_FILENAME);
  const stagedPath = path.join(dataDirectory, STAGED_RESTORE_FILENAME);
  const displacedPath = path.join(dataDirectory, DISPLACED_DATABASE_FILENAME);
  const pendingLibraryPath = path.join(dataDirectory, PENDING_LIBRARY_RESTORE_DIRECTORY);
  const stagedLibraryPath = path.join(dataDirectory, STAGED_LIBRARY_DIRECTORY);
  const displacedLibraryPath = path.join(dataDirectory, DISPLACED_LIBRARY_DIRECTORY);
  const libraryPath = path.join(dataDirectory, LIBRARY_DIRECTORY);
  const pendingFormPath = path.join(dataDirectory, PENDING_FORM_RESTORE_DIRECTORY);
  const stagedFormPath = path.join(dataDirectory, STAGED_FORM_DIRECTORY);
  const displacedFormPath = path.join(dataDirectory, DISPLACED_FORM_DIRECTORY);
  const formPath = path.join(dataDirectory, FORM_DIRECTORY);
  const pendingEventPath = path.join(dataDirectory, PENDING_EVENT_RESTORE_DIRECTORY);
  const stagedEventPath = path.join(dataDirectory, STAGED_EVENT_DIRECTORY);
  const displacedEventPath = path.join(dataDirectory, DISPLACED_EVENT_DIRECTORY);
  const eventPath = path.join(dataDirectory, EVENT_DIRECTORY);
  const databaseExists = await stat(databasePath).then(() => true).catch(() => false);
  const displacedExists = await stat(displacedPath).then(() => true).catch(() => false);
  if (!databaseExists && displacedExists) await rename(displacedPath, databasePath);
  else if (databaseExists && displacedExists) await rm(displacedPath, { force: true });
  await rm(stagedPath, { force: true });
  const libraryExists = await stat(libraryPath).then(() => true).catch(() => false);
  const displacedLibraryExists = await stat(displacedLibraryPath).then(() => true).catch(() => false);
  if (!libraryExists && displacedLibraryExists) await rename(displacedLibraryPath, libraryPath);
  else if (libraryExists && displacedLibraryExists) await rm(displacedLibraryPath, { recursive: true, force: true });
  await rm(stagedLibraryPath, { recursive: true, force: true });
  const formExists = await stat(formPath).then(() => true).catch(() => false);
  const displacedFormExists = await stat(displacedFormPath).then(() => true).catch(() => false);
  if (!formExists && displacedFormExists) await rename(displacedFormPath, formPath);
  else if (formExists && displacedFormExists) await rm(displacedFormPath, { recursive: true, force: true });
  await rm(stagedFormPath, { recursive: true, force: true });
  const eventExists = await stat(eventPath).then(() => true).catch(() => false);
  const displacedEventExists = await stat(displacedEventPath).then(() => true).catch(() => false);
  if (!eventExists && displacedEventExists) await rename(displacedEventPath, eventPath);
  else if (eventExists && displacedEventExists) await rm(displacedEventPath, { recursive: true, force: true });
  await rm(stagedEventPath, { recursive: true, force: true });

  const pending = await stat(pendingPath).then(() => true).catch(() => false);
  if (!pending) return null;
  const pendingLibrary = await stat(pendingLibraryPath).then((entry) => entry.isDirectory()).catch(() => false);
  if (!pendingLibrary) throw new Error("The pending restore is missing its managed library file directory.");
  const pendingForm = await stat(pendingFormPath).then((entry) => entry.isDirectory()).catch(() => false);
  if (!pendingForm) throw new Error("The pending restore is missing its managed form file directory.");
  const pendingEvent = await stat(pendingEventPath).then((entry) => entry.isDirectory()).catch(() => false);
  if (!pendingEvent) throw new Error("The pending restore is missing its managed event file directory.");
  await mkdir(snapshotsDirectory, { recursive: true });
  const current = await stat(databasePath).then(() => true).catch(() => false);
  let snapshotPath = null;
  if (current) {
    snapshotPath = path.join(snapshotsDirectory, `pre-restore-${timestamp()}.db`);
    const database = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      await database.backup(snapshotPath);
    } finally {
      database.close();
    }
    await chmod(snapshotPath, 0o600);
    await copyFile(snapshotPath, displacedPath);
    await chmod(displacedPath, 0o600);
  }
  if (libraryExists) {
    const librarySnapshotPath = path.join(snapshotsDirectory, `pre-restore-${timestamp()}-library-files`);
    await cp(libraryPath, librarySnapshotPath, { recursive: true, force: false });
  }
  if (formExists) {
    const formSnapshotPath = path.join(snapshotsDirectory, `pre-restore-${timestamp()}-form-files`);
    await cp(formPath, formSnapshotPath, { recursive: true, force: false });
  }
  if (eventExists) {
    const eventSnapshotPath = path.join(snapshotsDirectory, `pre-restore-${timestamp()}-event-files`);
    await cp(eventPath, eventSnapshotPath, { recursive: true, force: false });
  }
  await copyFile(pendingPath, stagedPath);
  await chmod(stagedPath, 0o600);
  await cp(pendingLibraryPath, stagedLibraryPath, { recursive: true, force: false });
  await cp(pendingFormPath, stagedFormPath, { recursive: true, force: false });
  await cp(pendingEventPath, stagedEventPath, { recursive: true, force: false });

  try {
    await rm(`${databasePath}-wal`, { force: true });
    await rm(`${databasePath}-shm`, { force: true });
    await rm(databasePath, { force: true });
    await rename(stagedPath, databasePath);
    if (await stat(libraryPath).then(() => true).catch(() => false)) await rename(libraryPath, displacedLibraryPath);
    await rename(stagedLibraryPath, libraryPath);
    if (await stat(formPath).then(() => true).catch(() => false)) await rename(formPath, displacedFormPath);
    await rename(stagedFormPath, formPath);
    if (await stat(eventPath).then(() => true).catch(() => false)) await rename(eventPath, displacedEventPath);
    await rename(stagedEventPath, eventPath);
    await rm(displacedPath, { force: true });
    await rm(displacedLibraryPath, { recursive: true, force: true });
    await rm(displacedFormPath, { recursive: true, force: true });
    await rm(displacedEventPath, { recursive: true, force: true });
    await rm(pendingPath, { force: true });
    await rm(pendingLibraryPath, { recursive: true, force: true });
    await rm(pendingFormPath, { recursive: true, force: true });
    await rm(pendingEventPath, { recursive: true, force: true });
    return snapshotPath;
  } catch (error) {
    const replacementExists = await stat(databasePath).then(() => true).catch(() => false);
    if (!replacementExists && snapshotPath) await copyFile(snapshotPath, databasePath);
    const libraryReplacementExists = await stat(libraryPath).then(() => true).catch(() => false);
    const libraryDisplacedExists = await stat(displacedLibraryPath).then(() => true).catch(() => false);
    if (libraryReplacementExists && libraryDisplacedExists) await rm(libraryPath, { recursive: true, force: true });
    if (libraryDisplacedExists) await rename(displacedLibraryPath, libraryPath);
    const formReplacementExists = await stat(formPath).then(() => true).catch(() => false);
    const formDisplacedExists = await stat(displacedFormPath).then(() => true).catch(() => false);
    if (formReplacementExists && formDisplacedExists) await rm(formPath, { recursive: true, force: true });
    if (formDisplacedExists) await rename(displacedFormPath, formPath);
    const eventReplacementExists = await stat(eventPath).then(() => true).catch(() => false);
    const eventDisplacedExists = await stat(displacedEventPath).then(() => true).catch(() => false);
    if (eventReplacementExists && eventDisplacedExists) await rm(eventPath, { recursive: true, force: true });
    if (eventDisplacedExists) await rename(displacedEventPath, eventPath);
    await rm(stagedPath, { force: true });
    await rm(stagedLibraryPath, { recursive: true, force: true });
    await rm(stagedFormPath, { recursive: true, force: true });
    await rm(stagedEventPath, { recursive: true, force: true });
    throw error;
  }
}
