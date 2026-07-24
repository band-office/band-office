import { NextResponse } from "next/server";
import { FormUploadStatus } from "@/generated/prisma/client";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readFormFile } from "@/lib/form-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "VIEW_FORMS")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const upload = await getDb().formUpload.findFirst({ where: { id, status: FormUploadStatus.ACTIVE, response: { request: { campaign: { programId: user.programId } } } } });
  if (!upload) return NextResponse.json({ error: "File not found" }, { status: 404 });
  try {
    const bytes = await readFormFile(upload.storageKey);
    return new NextResponse(bytes, { headers: { "Content-Type": upload.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`, "Content-Length": String(bytes.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Stored file is unavailable" }, { status: 404 });
  }
}
