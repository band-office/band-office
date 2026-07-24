import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, FileWarning, PackageOpen, Wrench } from "lucide-react";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { getDb } from "@/lib/db";
import { assetName, daysSince, formatMoney, formatShortDate } from "@/lib/format";
import { fleetValue, outstandingAssignments } from "@/lib/reports";
import { getProgram } from "@/lib/program-context";
import { RepairStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  const canViewEvents = hasPermission(user, "VIEW_EVENTS");
  const canManageAssignments = hasPermission(user, "MANAGE_ASSIGNMENTS");
  const [overdue, repairs, unsigned, withoutAssets, [value], upcomingEvents] = await Promise.all([
    outstandingAssignments(db, program.id),
    db.repair.findMany({
      where: { asset: { programId: program.id }, status: { in: [RepairStatus.OPEN, RepairStatus.AT_VENDOR] } },
      include: { asset: true }, orderBy: { openedAt: "asc" },
    }),
    db.assignment.findMany({
      where: { asset: { programId: program.id }, checkedInAt: null, agreementOnFile: false },
      include: { person: true, asset: true }, orderBy: { checkedOutAt: "asc" },
    }),
    db.person.count({ where: { programId: program.id, status: "ACTIVE", studentProfile: { isNot: null }, assignments: { none: { checkedInAt: null } } } }),
    fleetValue(db, program.id),
    canViewEvents ? db.event.findMany({
      where: { programId: program.id, startsAt: { gte: new Date() }, status: { not: "CANCELED" } },
      include: { participants: { where: { status: "ACTIVE" }, include: { attendance: true } } },
      orderBy: { startsAt: "asc" },
      take: 4,
    }) : Promise.resolve([]),
  ]);

  return (
    <main className="content">
      <PageHeader eyebrow={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())} title="Today" description="The program work that needs your attention." actions={canManageAssignments ? <Link className="button primary" href="/checkout"><ClipboardCheck size={17} />Start checkout</Link> : undefined} />
      <FlashMessage {...params} />
      <section className="metric-strip" aria-label="Program inventory summary">
        <div><span>Assets assigned</span><strong>{value?.assignedAssetCount ?? 0}</strong><small>of {value?.assetCount ?? 0} total</small></div>
        <div><span>Value currently out</span><strong>{formatMoney(value?.assignedOutValue ?? 0)}</strong><small>{formatMoney(value?.totalFleetValue ?? 0)} fleet value</small></div>
        <div><span>Open repairs</span><strong>{repairs.length}</strong><small>{repairs.filter((repair) => daysSince(repair.openedAt) > 30).length} open over 30 days</small></div>
        <div><span>Without assignment</span><strong>{withoutAssets}</strong><small>active students</small></div>
      </section>

      <div className="dashboard-grid">
        {canViewEvents ? <section className="work-panel span-2">
          <div className="panel-heading"><div><span className="panel-icon"><CalendarDays size={17} /></span><h2>Upcoming events</h2></div><Link href="/events">Open calendar <ArrowRight size={15} /></Link></div>
          {upcomingEvents.length ? <div className="record-list">{upcomingEvents.map((event) => <Link className="record-row" href={`/events/${event.id}`} key={event.id}><div><strong>{event.name}</strong><span>{event.location || "Location not set"} · {event.participants.length} rostered</span></div><div className="record-meta"><strong>{formatShortDate(event.startsAt)}</strong><span>{event.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></div></Link>)}</div> : <p className="panel-empty">No upcoming events.</p>}
        </section> : null}

        <section className="work-panel span-2">
          <div className="panel-heading"><div><span className="panel-icon warning"><AlertTriangle size={17} /></span><h2>Overdue returns</h2></div><Link href="/reports">View report <ArrowRight size={15} /></Link></div>
          {overdue.length ? <div className="record-list">{overdue.slice(0, 6).map((item) => <Link className="record-row" href={`/roster/${item.personId}`} key={item.assignmentId}><div><strong>{item.personName}</strong><span>{item.assetTag} · {item.assetDescription}</span></div><div className="record-meta"><strong>{item.daysOverdue} days</strong><span>Due {formatShortDate(item.expectedReturnAt)}</span></div></Link>)}</div> : <p className="panel-empty">No overdue assignments.</p>}
        </section>

        <section className="work-panel">
          <div className="panel-heading"><div><span className="panel-icon"><Wrench size={17} /></span><h2>Repair queue</h2></div><Link href="/repairs">Manage <ArrowRight size={15} /></Link></div>
          <div className="record-list compact">{repairs.slice(0, 5).map((repair) => <Link className="record-row" href={`/assets/${repair.assetId}`} key={repair.id}><div><strong>{repair.asset.schoolAssetTag}</strong><span>{assetName(repair.asset)}</span></div><div className="record-meta"><StatusPill value={repair.status} /><span>{daysSince(repair.openedAt)} days</span></div></Link>)}</div>
        </section>

        <section className="work-panel span-2">
          <div className="panel-heading"><div><span className="panel-icon muted"><FileWarning size={17} /></span><h2>Agreements missing</h2></div><span className="count-badge">{unsigned.length}</span></div>
          <div className="record-list">{unsigned.slice(0, 6).map((assignment) => <Link className="record-row" href={`/roster/${assignment.personId}`} key={assignment.id}><div><strong>{assignment.person.lastName}, {assignment.person.firstName}</strong><span>{assignment.asset.schoolAssetTag} · checked out {formatShortDate(assignment.checkedOutAt)}</span></div><StatusPill value="not on file" /></Link>)}</div>
        </section>

        {canManageAssignments ? <section className="work-panel action-panel">
          <PackageOpen size={22} />
          <div><strong>Spring return station</strong><span>Process returns and open damage repairs in one step.</span></div>
          <Link className="button secondary" href="/checkin">Open check-in</Link>
        </section> : null}
      </div>
    </main>
  );
}
