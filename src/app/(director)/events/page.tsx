import Link from "next/link";
import { CalendarDays, CalendarPlus, ExternalLink, Globe2, KeyRound, MapPin, Plus, UsersRound } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createCalendarSubscriptionAction, createEventAction, revokeCalendarSubscriptionAction } from "@/app/events-actions";
import { CalendarTokenReveal } from "@/components/calendar-token-reveal";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { EventParticipantStatus, EventStatus, EventVisibility } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { CALENDAR_REVEAL_COOKIE, decodeCalendarReveal } from "@/lib/calendar-reveal";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

function localInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [query, user, cookieStore] = await Promise.all([searchParams, requireUser(), cookies()]);
  if (!hasPermission(user, "VIEW_EVENTS")) redirect("/today?error=Events%20access%20is%20not%20available%20for%20this%20account.");
  const calendarReveal = decodeCalendarReveal(cookieStore.get(CALENDAR_REVEAL_COOKIE)?.value);
  const db = getDb();
  const now = new Date();
  const [events, groups, series, subscriptions] = await Promise.all([
    db.event.findMany({
      where: { programId: user.programId },
      include: {
        series: true,
        groups: { where: { removedAt: null }, include: { group: true } },
        participants: { where: { status: EventParticipantStatus.ACTIVE }, include: { attendance: true } },
        _count: { select: { equipmentItems: true, volunteerOpportunities: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.group.findMany({ where: { programId: user.programId, active: true }, include: { _count: { select: { memberships: { where: { endedAt: null } } } } }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.eventSeries.findMany({ where: { programId: user.programId, active: true }, orderBy: { name: "asc" } }),
    db.calendarSubscription.findMany({ where: { programId: user.programId }, orderBy: { createdAt: "desc" } }),
  ]);
  const upcoming = events.filter((event) => event.startsAt >= now && event.status !== EventStatus.CANCELED);
  const published = events.filter((event) => event.status === EventStatus.PUBLISHED);
  const attendanceOpen = events.filter((event) => event.attendanceEnabled && event.startsAt <= now && event.status !== EventStatus.CANCELED && event.participants.some((participant) => participant.attendance?.status === "NOT_RECORDED")).length;
  const canManage = hasPermission(user, "MANAGE_EVENTS");
  const defaultStart = new Date(now.getTime() + 7 * 86_400_000);
  defaultStart.setHours(18, 0, 0, 0);

  return (
    <main className="content">
      <PageHeader
        eyebrow="Calendar, trips, and participation"
        title="Events"
        description="Roster snapshots, itineraries, RSVP, attendance, equipment, volunteers, reminders, and calendar publication."
        icon={CalendarDays}
        actions={canManage ? <details className="popover extra-wide"><summary className="button primary"><Plus size={17} />New event</summary><form action={createEventAction} className="popover-panel form-grid"><h3>New event</h3>
          <Field label="Event name" wide><input name="name" required autoFocus /></Field>
          <Field label="Starts"><input name="startsAt" type="datetime-local" defaultValue={localInput(defaultStart)} required /></Field>
          <Field label="Ends"><input name="endsAt" type="datetime-local" /></Field>
          <Field label="Location" wide><input name="location" /></Field>
          <Field label="Description" wide><textarea name="description" rows={3} /></Field>
          <Field label="Existing series"><select name="seriesId" defaultValue=""><option value="">No series</option>{series.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Or new series"><input name="seriesName" placeholder="Concert season" /></Field>
          <fieldset className="field fieldset-control"><legend>Visibility</legend><div className="segmented-field"><label><input type="radio" name="visibility" value={EventVisibility.PRIVATE} defaultChecked /><span>Private</span></label><label><input type="radio" name="visibility" value={EventVisibility.PUBLIC} /><span>Public</span></label></div></fieldset>
          <fieldset className="field fieldset-control"><legend>Tracking</legend><div className="switch-list"><label><input type="checkbox" name="rsvpEnabled" /><span>RSVP</span></label><label><input type="checkbox" name="attendanceEnabled" defaultChecked /><span>Attendance</span></label></div></fieldset>
          <Field label="Initial roster groups" wide hint="Current active students become a preserved event roster snapshot."><div className="selection-grid">{groups.map((group) => <label key={group.id}><input type="checkbox" name="groupIds" value={group.id} /><span>{group.name}<small>{group._count.memberships} active</small></span></label>)}</div></Field>
          <Field label="Itinerary" wide><textarea name="itinerary" rows={5} /></Field>
          <Field label="Staff notes" wide hint="No medical, disciplinary, or family information. This field is exported in reports."><textarea name="notes" rows={3} /></Field>
          <div className="form-actions field-wide"><SubmitButton>Create event</SubmitButton></div>
        </form></details> : undefined}
      />
      <FlashMessage {...query} />
      {calendarReveal ? <CalendarTokenReveal token={calendarReveal.token} name={calendarReveal.name || "Private calendar"} /> : null}
      <section className="metric-strip events-metrics">
        <div><span>Upcoming</span><strong>{upcoming.length}</strong><small>Active calendar</small></div>
        <div><span>Published</span><strong>{published.length}</strong><small>{published.filter((event) => event.visibility === EventVisibility.PUBLIC).length} public</small></div>
        <div><span>Attendance open</span><strong>{attendanceOpen}</strong><small>Roster entries not recorded</small></div>
        <div><span>Series</span><strong>{series.length}</strong><small>Reusable event context</small></div>
      </section>

      <div className="dashboard-grid events-dashboard-grid">
        <section className="work-panel span-2">
          <div className="panel-heading"><div><CalendarPlus size={18} /><h2>Program calendar</h2></div><span className="muted-copy">{events.length} events</span></div>
          <div className="event-list">
            {events.map((event) => {
              const recorded = event.participants.filter((participant) => participant.attendance?.status !== "NOT_RECORDED").length;
              return <Link className="event-list-row" href={`/events/${event.id}`} key={event.id}>
                <time><strong>{event.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong><span>{event.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></time>
                <div><strong>{event.name}</strong><span>{event.location ? <><MapPin size={13} />{event.location}</> : "Location not set"}{event.series ? ` · ${event.series.name}` : ""}</span></div>
                <div className="event-list-meta"><StatusPill value={event.status} /><span><UsersRound size={13} />{event.participants.length}</span>{event.attendanceEnabled ? <small>{recorded}/{event.participants.length} attendance</small> : null}</div>
              </Link>;
            })}
            {!events.length ? <div className="empty-state"><CalendarDays size={24} /><strong>No events yet</strong><span>Create the first rehearsal, performance, trip, or program meeting.</span></div> : null}
          </div>
        </section>

        <section className="work-panel calendar-publication-panel">
          <div className="panel-heading"><div><Globe2 size={18} /><h2>Calendar publication</h2></div></div>
          <div className="calendar-link-list">
            <a className="calendar-link-row" href={`/api/calendar/public/${user.programId}`}><span><strong>Public subscription</strong><small>Published public events only</small></span><ExternalLink size={16} /></a>
            <a className="calendar-link-row" href={`/api/calendar/embed/${user.programId}`} target="_blank" rel="noreferrer"><span><strong>Public embed</strong><small>Browser and iframe view</small></span><ExternalLink size={16} /></a>
          </div>
          {canManage ? <details className="inline-details"><summary><KeyRound size={15} />New private link</summary><form action={createCalendarSubscriptionAction} className="inline-form top-gap"><label><span>Calendar name</span><input name="name" required placeholder="Director calendar" /></label><SubmitButton>Create once-only link</SubmitButton></form></details> : null}
          <div className="subscription-list">
            {subscriptions.map((subscription) => <div key={subscription.id}><span><strong>{subscription.name}</strong><small>{subscription.revokedAt ? `Revoked ${formatDateTime(subscription.revokedAt)}` : subscription.lastUsedAt ? `Last used ${formatDateTime(subscription.lastUsedAt)}` : "Not used yet"}</small></span>{!subscription.revokedAt && canManage ? <form action={revokeCalendarSubscriptionAction}><input type="hidden" name="subscriptionId" value={subscription.id} /><button className="text-button danger" type="submit">Revoke</button></form> : <StatusPill value={subscription.revokedAt ? "revoked" : "active"} />}</div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
