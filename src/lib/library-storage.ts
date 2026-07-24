import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { getDatabaseFilePath } from "@/lib/db";

const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([".app", ".bat", ".cmd", ".com", ".exe", ".html", ".htm", ".js", ".mjs", ".ps1", ".sh"]);

export function getLibraryFilesRoot() {
  return resolve(dirname(getDatabaseFilePath()), "library-files");
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase().slice(0, 12);
  if (BLOCKED_EXTENSIONS.has(extension)) throw new Error("Executable and active web files cannot be stored in the music library.");
  return /^[.a-z0-9_-]*$/.test(extension) ? extension : "";
}

export function resolveLibraryStorageKey(storageKey: string) {
  const root = getLibraryFilesRoot();
  const normalized = normalize(storageKey).replace(/^[/\\]+/, "");
  const absolute = resolve(root, normalized);
  if (!normalized || relative(root, absolute).startsWith("..") || resolve(root) === absolute) throw new Error("Invalid library file storage key.");
  return absolute;
}

export async function storeLibraryFile(itemId: string, file: File) {
  if (!file.name || file.size <= 0) throw new Error("Choose a non-empty file.");
  if (file.size > MAX_LIBRARY_FILE_BYTES) throw new Error("Library files cannot exceed 25 MB each.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = join(itemId, `${randomUUID()}${safeExtension(file.name)}`);
  const absolute = resolveLibraryStorageKey(storageKey);
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

export async function readLibraryFile(storageKey: string) {
  return readFile(resolveLibraryStorageKey(storageKey));
}

export async function deleteLibraryFile(storageKey: string) {
  await rm(resolveLibraryStorageKey(storageKey), { force: true });
}

export const libraryFileLimits = { maxBytes: MAX_LIBRARY_FILE_BYTES };
