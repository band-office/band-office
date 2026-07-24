import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { processDueCommunicationJobs } from "@/lib/communications-service";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.BANDOS_WORKER_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Forbidden", { status: 403 });
  const startedAt = process.env.BANDOS_STARTED_AT ? new Date(process.env.BANDOS_STARTED_AT) : new Date();
  const processed = await processDueCommunicationJobs(getDb(), startedAt);
  return Response.json({ processed });
}
