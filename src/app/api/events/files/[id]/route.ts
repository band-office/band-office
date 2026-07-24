import { EventResourceKind, EventResourceStatus } from "@/generated/prisma/client";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readEventFile } from "@/lib/event-storage";

export const dynamic = "force-dynamic";

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"]/g, "_").slice(0, 255);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "VIEW_EVENTS")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const resource = await getDb().eventResource.findFirst({
    where: { id, kind: EventResourceKind.LOCAL_FILE, status: EventResourceStatus.ACTIVE, event: { programId: user.programId } },
  });
  if (!resource?.storageKey || !resource.fileName) return new Response("Event file not found", { status: 404 });
  try {
    const bytes = await readEventFile(resource.storageKey);
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        "Content-Type": resource.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeDownloadName(resource.fileName)}"`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Managed event file is unavailable", { status: 404 });
  }
}
