import { buildCalendarFeed } from "@/lib/calendar-feed";
import { getDb } from "@/lib/db";
import { findCalendarSubscriptionByToken } from "@/lib/events-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const subscription = await findCalendarSubscriptionByToken(db, token);
  if (!subscription) return new Response("Calendar not found", { status: 404 });
  const feed = await buildCalendarFeed(db, subscription.programId, "private");
  if (!feed) return new Response("Calendar not found", { status: 404 });
  await db.calendarSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
  return new Response(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="band-office-private-calendar.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
