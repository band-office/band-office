import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { getDatabaseFilePath } from "@/lib/db";

const MAX_EVENT_FILE_BYTES = 15 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([".app", ".bat", ".cmd", ".com", ".exe", ".html", ".htm", ".js", ".mjs", ".ps1", ".sh"]);

export function getEventFilesRoot() {
  return resolve(dirname(getDatabaseFilePath()), "event-files");
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase().slice(0, 12);
  if (BLOCKED_EXTENSIONS.has(extension)) throw new Error("Executable and active web files cannot be attached to events.");
  return /^[.a-z0-9_-]*$/.test(extension) ? extension : "";
}

export function resolveEventStorageKey(storageKey: string) {
  const root = getEventFilesRoot();
  const normalized = normalize(storageKey).replace(/^[/\\]+/, "");
  const absolute = resolve(root, normalized);
  if (!normalized || relative(root, absolute).startsWith("..") || root === absolute) throw new Error("Invalid event file storage key.");
  return absolute;
}

export async function storeEventFile(eventId: string, file: File) {
  if (!file.name || file.size <= 0) throw new Error("Choose a non-empty file.");
  if (file.size > MAX_EVENT_FILE_BYTES) throw new Error("Event files cannot exceed 15 MB each.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = join(eventId, `${randomUUID()}${safeExtension(file.name)}`);
  const absolute = resolveEventStorageKey(storageKey);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes, { flag: "wx", mode: 0o600 });
  return {
    storageKey,
    fileName: file.name.slice(0, 255),
    mimeType: file.type || "application/octet-stream",
    byteSize: bytes.byteLength,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readEventFile(storageKey: string) {
  return readFile(resolveEventStorageKey(storageKey));
}

export async function deleteEventFile(storageKey: string) {
  await rm(resolveEventStorageKey(storageKey), { force: true });
}

export const eventFileLimits = { maxBytes: MAX_EVENT_FILE_BYTES };
