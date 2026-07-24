import { randomUUID } from "node:crypto";
import { EmailConnectionStatus } from "@/generated/prisma/client";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "MANAGE_COMMUNICATIONS")) return new Response("Forbidden", { status: 403 });
  const db = getDb();
  const connection = await db.emailConnection.findUnique({ where: { programId: user.programId } });
  if (!connection) return new Response(null, { status: 204 });
  await db.$transaction([
    db.emailConnection.update({ where: { id: connection.id }, data: { status: EmailConnectionStatus.CONFIGURED, lastVerifiedAt: null, lastError: null } }),
    db.auditLog.create({ data: { id: randomUUID(), programId: user.programId, actor: user.username, action: "ROTATE_CREDENTIAL", entityType: "EmailConnection", entityId: connection.id, changeSummary: "SMTP credential changed; connection verification required" } }),
  ]);
  return new Response(null, { status: 204 });
}
