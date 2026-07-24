import { hasPermission, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readLibraryFile } from "@/lib/library-storage";

export const dynamic = "force-dynamic";

function safeDownloadName(value: string) {
  return value.replace(/["\r\n\\/]/g, "_").slice(0, 180) || "library-file";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "VIEW_LIBRARY")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const resource = await getDb().libraryResource.findFirst({
    where: { id, status: "ACTIVE", kind: "LOCAL_FILE", item: { programId: user.programId } },
  });
  if (!resource?.storageKey || !resource.fileName) return new Response("Library file not found", { status: 404 });
  try {
    const bytes = await readLibraryFile(resource.storageKey);
    return new Response(Uint8Array.from(bytes).buffer, { headers: { "Content-Type": resource.mimeType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${safeDownloadName(resource.fileName)}"`, "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("The managed file is missing from local storage.", { status: 410 });
  }
}
