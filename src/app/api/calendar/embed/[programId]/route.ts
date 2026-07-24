import { EventStatus, EventVisibility } from "@/generated/prisma/client";
import { escapeCalendarHtml } from "@/lib/calendar-feed";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function format(value: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const db = getDb();
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) return new Response("Calendar not found", { status: 404 });
  const events = await db.event.findMany({ where: { programId, status: { in: [EventStatus.PUBLISHED, EventStatus.COMPLETED] }, visibility: EventVisibility.PUBLIC, startsAt: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { startsAt: "asc" }, take: 50 });
  const items = events.map((event) => `<article><time>${escapeCalendarHtml(format(event.startsAt))}</time><div><strong>${escapeCalendarHtml(event.name)}</strong>${event.location ? `<span>${escapeCalendarHtml(event.location)}</span>` : ""}${event.description ? `<p>${escapeCalendarHtml(event.description)}</p>` : ""}</div></article>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeCalendarHtml(program.name)} calendar</title><style>:root{color-scheme:light;font-family:ui-sans-serif,system-ui,sans-serif;color:#17211d;background:#f7faf8}*{box-sizing:border-box}body{margin:0;padding:18px}header{border-bottom:2px solid #176b50;padding-bottom:12px;margin-bottom:4px}h1{font-size:20px;margin:0}header span{display:block;color:#63706a;font-size:13px;margin-top:4px}article{display:grid;grid-template-columns:minmax(112px,140px) 1fr;gap:16px;padding:16px 0;border-bottom:1px solid #dbe3df}time{font-size:13px;font-weight:700;color:#176b50}strong{display:block;font-size:16px}span,p{display:block;color:#5d6964;font-size:14px;margin:4px 0 0}p{line-height:1.45}.empty{padding:28px 0;color:#63706a}@media(max-width:520px){article{grid-template-columns:1fr;gap:5px}}</style></head><body><header><h1>${escapeCalendarHtml(program.name)}</h1><span>Public events</span></header>${items || '<p class="empty">No upcoming public events.</p>'}</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors *",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
