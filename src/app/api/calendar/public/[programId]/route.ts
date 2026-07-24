import { buildCalendarFeed } from "@/lib/calendar-feed";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const feed = await buildCalendarFeed(getDb(), programId, "public");
  if (!feed) return new Response("Calendar not found", { status: 404 });
  return new Response(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bandos-public-calendar.ics"',
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
