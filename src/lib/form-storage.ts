import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { getDatabaseFilePath } from "@/lib/db";

const MAX_FORM_FILE_BYTES = 15 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([".app", ".bat", ".cmd", ".com", ".exe", ".html", ".htm", ".js", ".mjs", ".ps1", ".sh"]);

export function getFormFilesRoot() {
  return resolve(dirname(getDatabaseFilePath()), "form-files");
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase().slice(0, 12);
  if (BLOCKED_EXTENSIONS.has(extension)) throw new Error("Executable and active web files cannot be attached to form responses.");
  return /^[.a-z0-9_-]*$/.test(extension) ? extension : "";
}

export function resolveFormStorageKey(storageKey: string) {
  const root = getFormFilesRoot();
  const normalized = normalize(storageKey).replace(/^[/\\]+/, "");
  const absolute = resolve(root, normalized);
  if (!normalized || relative(root, absolute).startsWith("..") || root === absolute) throw new Error("Invalid form file storage key.");
  return absolute;
}

export async function storeFormFile(requestId: string, file: File) {
  if (!file.name || file.size <= 0) throw new Error("Choose a non-empty file.");
  if (file.size > MAX_FORM_FILE_BYTES) throw new Error("Form uploads cannot exceed 15 MB each.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = join(requestId, `${randomUUID()}${safeExtension(file.name)}`);
  const absolute = resolveFormStorageKey(storageKey);
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

export async function readFormFile(storageKey: string) {
  return readFile(resolveFormStorageKey(storageKey));
}

export async function deleteFormFile(storageKey: string) {
  await rm(resolveFormStorageKey(storageKey), { force: true });
}

export const formFileLimits = { maxBytes: MAX_FORM_FILE_BYTES };
