import Link from "next/link";
import { ArrowLeft, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, Download, ExternalLink, FileUp, Mail, MapPin, PackageCheck, Paperclip, Plus, RefreshCcw, Save, Trash2, UserMinus, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import {
  addEventFileAction,
  addEventGroupAction,
  addEventLinkAction,
  addEventParticipantAction,
  addEventEquipmentAction,
  addVolunteerSignupAction,
  cancelVolunteerSignupAction,
  createEventReminderAction,
  createVolunteerOpportunityAction,
  recordEventRsvpAction,
  refreshEventRosterAction,
  removeEventEquipmentAction,
  removeEventGroupAction,
  removeEventParticipantAction,
  removeEventResourceAction,
  setEventStatusAction,
  setVolunteerOpportunityStatusAction,
  updateEventAction,
  updateEventEquipmentPackingAction,
} from "@/app/events-actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import {
  AttendanceStatus,
  EventParticipantStatus,
  EventReminderAudience,
  EventResourceKind,
  EventResourceStatus,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  PersonStatus,
  VolunteerOpportunityStatus,
  VolunteerSignupStatus,
} from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

function localInput(value: Date | null) {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_EVENTS")) redirect("/today?error=Events%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const event = await db.event.findFirst({
    where: { id, programId: user.programId },
    include: {
      operatingPeriod: true,
      series: true,
      groups: { where: { removedAt: null }, include: { group: true }, orderBy: { group: { name: "asc" } } },
      participants: {
        where: { status: EventParticipantStatus.ACTIVE },
        include: {
          person: { include: { studentProfile: true, groupMemberships: { where: { endedAt: null }, include: { group: true } } } },
          rsvp: true,
          attendance: true,
        },
        orderBy: [{ person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
      },
      equipmentItems: { include: { asset: true }, orderBy: { label: "asc" } },
      resources: { where: { status: EventResourceStatus.ACTIVE }, orderBy: { createdAt: "desc" } },
      volunteerOpportunities: { include: { signups: { where: { status: VolunteerSignupStatus.CONFIRMED }, include: { person: true }, orderBy: { person: { lastName: "asc" } } } }, orderBy: { createdAt: "asc" } },
      reminders: { include: { announcement: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) notFound();
  const [groups, people, volunteerPeople, assets, series] = await Promise.all([
    db.group.findMany({ where: { programId: user.programId, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.person.findMany({ where: { programId: user.programId, status: PersonStatus.ACTIVE }, include: { studentProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.person.findMany({ where: { programId: user.programId, status: PersonStatus.ACTIVE, classifications: { some: { classification: { in: ["GUARDIAN", "STAFF", "BOOSTER", "EXTERNAL"] } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.asset.findMany({ where: { programId: user.programId, status: { not: "RETIRED" } }, orderBy: [{ category: "asc" }, { schoolAssetTag: "asc" }] }),
    db.eventSeries.findMany({ where: { programId: user.programId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const canManage = hasPermission(user, "MANAGE_EVENTS");
  const canAttendance = hasPermission(user, "RECORD_ATTENDANCE");
  const canEmail = hasPermission(user, "MANAGE_COMMUNICATIONS");
  const canExport = hasPermission(user, "EXPORT_DATA");
  const activeGroupIds = new Set(event.groups.map((row) => row.groupId));
  const recordedAttendance = event.participants.filter((participant) => participant.attendance?.status !== AttendanceStatus.NOT_RECORDED).length;
  const yesRsvps = event.participants.filter((participant) => participant.rsvp?.status === EventRsvpStatus.YES).length;
  const packed = event.equipmentItems.filter((item) => item.packedQuantity >= item.quantity).length;
  const volunteerCount = event.volunteerOpportunities.reduce((sum, opportunity) => sum + opportunity.signups.length, 0);

  return (
    <main className="content event-detail-content">
      <Link className="back-link no-print" href="/events"><ArrowLeft size={16} />Events</Link>
      <PageHeader
        eyebrow={`${event.operatingPeriod.label}${event.series ? ` · ${event.series.name}` : ""}`}
        title={event.name}
        description={`${formatDateTime(event.startsAt)}${event.location ? ` · ${event.location}` : ""}`}
        icon={CalendarDays}
        actions={<><PrintButton />{event.attendanceEnabled && canAttendance ? <Link className="button secondary" href={`/events/${event.id}/attendance`}><ClipboardCheck size={16} />Attendance</Link> : null}{canManage && event.status === EventStatus.DRAFT ? <form action={setEventStatusAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="status" value={EventStatus.PUBLISHED} /><button className="button primary" type="submit">Publish</button></form> : <StatusPill value={event.status} />}</>}
      />
      <FlashMessage {...query} />
      <section className="metric-strip event-metrics">
        <div><span>Roster</span><strong>{event.participants.length}</strong><small>{event.groups.length} source groups</small></div>
        <div><span>RSVP yes</span><strong>{event.rsvpEnabled ? yesRsvps : "Off"}</strong><small>{event.rsvpEnabled ? `${event.participants.length - yesRsvps} other` : "Not collected"}</small></div>
        <div><span>Attendance</span><strong>{event.attendanceEnabled ? `${recordedAttendance}/${event.participants.length}` : "Off"}</strong><small>Recorded</small></div>
        <div><span>Equipment ready</span><strong>{packed}/{event.equipmentItems.length}</strong><small>{volunteerCount} volunteers assigned</small></div>
      </section>

      <div className="event-action-bar no-print">
        {canExport ? <><a className="button secondary" href={`/api/export/event-trip-roster?eventId=${event.id}`}><Download size={15} />Trip roster CSV</a><a className="button secondary" href={`/api/export/event-equipment?eventId=${event.id}`}><Download size={15} />Equipment CSV</a></> : null}
        {canManage ? <details className="popover extra-wide"><summary className="button secondary"><Save size={15} />Edit event</summary><form action={updateEventAction} className="popover-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><h3>Edit event</h3>
          <Field label="Event name" wide><input name="name" defaultValue={event.name} required /></Field>
          <Field label="Starts"><input name="startsAt" type="datetime-local" defaultValue={localInput(event.startsAt)} required /></Field>
          <Field label="Ends"><input name="endsAt" type="datetime-local" defaultValue={localInput(event.endsAt)} /></Field>
          <Field label="Location" wide><input name="location" defaultValue={event.location ?? ""} /></Field>
          <Field label="Description" wide><textarea name="description" rows={3} defaultValue={event.description ?? ""} /></Field>
          <Field label="Series"><select name="seriesId" defaultValue={event.seriesId ?? ""}><option value="">No series</option>{series.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
          <fieldset className="field fieldset-control"><legend>Visibility</legend><div className="segmented-field"><label><input type="radio" name="visibility" value={EventVisibility.PRIVATE} defaultChecked={event.visibility === EventVisibility.PRIVATE} /><span>Private</span></label><label><input type="radio" name="visibility" value={EventVisibility.PUBLIC} defaultChecked={event.visibility === EventVisibility.PUBLIC} /><span>Public</span></label></div></fieldset>
          <fieldset className="field fieldset-control"><legend>Tracking</legend><div className="switch-list"><label><input type="checkbox" name="rsvpEnabled" defaultChecked={event.rsvpEnabled} /><span>RSVP</span></label><label><input type="checkbox" name="attendanceEnabled" defaultChecked={event.attendanceEnabled} /><span>Attendance</span></label></div></fieldset>
          <Field label="Itinerary" wide><textarea name="itinerary" rows={6} defaultValue={event.itinerary ?? ""} /></Field>
          <Field label="Staff notes" wide hint="No medical, disciplinary, or family information. This field is exported in reports."><textarea name="notes" rows={3} defaultValue={event.notes ?? ""} /></Field>
          <div className="form-actions field-wide"><SubmitButton>Save event</SubmitButton></div>
        </form></details> : null}
        {canManage && event.status !== EventStatus.CANCELED && event.status !== EventStatus.COMPLETED ? <details className="popover"><summary className="button secondary">Event status</summary><form action={setEventStatusAction} className="popover-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><h3>Change event status</h3><Field label="Status" wide><select name="status" defaultValue={event.status === EventStatus.PUBLISHED ? EventStatus.COMPLETED : EventStatus.CANCELED}>{event.status === EventStatus.PUBLISHED ? <option value={EventStatus.COMPLETED}>Completed</option> : null}<option value={EventStatus.CANCELED}>Canceled</option></select></Field><div className="form-actions field-wide"><SubmitButton>Update status</SubmitButton></div></form></details> : null}
      </div>

      <div className="dashboard-grid event-detail-grid">
        <section className="work-panel span-2">
          <div className="panel-heading"><div><UsersRound size={18} /><h2>Event roster</h2></div><div className="panel-heading-actions no-print">{canManage && event.groups.length ? <form action={refreshEventRosterAction}><input type="hidden" name="eventId" value={event.id} /><button className="icon-button" type="submit" aria-label="Refresh roster from groups" title="Refresh roster from groups"><RefreshCcw size={16} /></button></form> : null}{canManage ? <details className="inline-details"><summary><Plus size={15} />Add</summary><div className="inline-details-panel">
            <form action={addEventGroupAction} className="inline-form"><input type="hidden" name="eventId" value={event.id} /><label><span>Group source</span><select name="groupId" required defaultValue=""><option value="" disabled>Choose group</option>{groups.filter((group) => !activeGroupIds.has(group.id)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><SubmitButton>Add group</SubmitButton></form>
            <form action={addEventParticipantAction} className="inline-form"><input type="hidden" name="eventId" value={event.id} /><label><span>Individual person</span><select name="personId" required defaultValue=""><option value="" disabled>Choose person</option>{people.filter((person) => !event.participants.some((participant) => participant.personId === person.id)).map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}{person.studentProfile ? ` · Grade ${person.studentProfile.grade}` : ""}</option>)}</select></label><SubmitButton>Add person</SubmitButton></form>
          </div></details> : null}</div></div>
          {event.groups.length ? <div className="event-group-chips">{event.groups.map((row) => <span key={row.id}>{row.group.name}{canManage ? <form action={removeEventGroupAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="groupId" value={row.groupId} /><button type="submit" aria-label={`Remove ${row.group.name} group source`} title="Remove group source">×</button></form> : null}</span>)}</div> : null}
          <div className="data-table-wrap top-gap"><table className="data-table event-roster-table"><thead><tr><th>Person</th><th>Groups</th>{event.rsvpEnabled ? <th>RSVP</th> : null}<th>Attendance</th>{canManage ? <th aria-label="Remove" /> : null}</tr></thead><tbody>{event.participants.map((participant) => <tr key={participant.id}>
            <td><Link className="primary-cell compact-primary" href={`/roster/${participant.personId}`}><span className="avatar">{participant.person.firstName[0]}{participant.person.lastName[0]}</span><span><strong>{participant.person.lastName}, {participant.person.firstName}</strong><small>{participant.person.studentProfile ? `Grade ${participant.person.studentProfile.grade}` : "Program contact"}</small></span></Link></td>
            <td>{participant.person.groupMemberships.map((membership) => membership.group.name).join(", ") || "—"}</td>
            {event.rsvpEnabled ? <td>{canManage ? <form action={recordEventRsvpAction} className="compact-update-form"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="participantId" value={participant.id} /><select name="status" defaultValue={participant.rsvp?.status ?? EventRsvpStatus.PENDING} aria-label={`RSVP for ${participant.person.firstName} ${participant.person.lastName}`}>{Object.values(EventRsvpStatus).map((value) => <option value={value} key={value}>{titleCase(value)}</option>)}</select><button className="icon-button" type="submit" aria-label="Save RSVP" title="Save RSVP"><Save size={14} /></button></form> : <StatusPill value={participant.rsvp?.status ?? EventRsvpStatus.PENDING} />}</td> : null}
            <td><StatusPill value={participant.attendance?.status ?? AttendanceStatus.NOT_RECORDED} /></td>
            {canManage ? <td><form action={removeEventParticipantAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="participantId" value={participant.id} /><button className="icon-button danger" type="submit" aria-label={`Remove ${participant.person.firstName} ${participant.person.lastName} from roster`} title="Remove from roster"><UserMinus size={15} /></button></form></td> : null}
          </tr>)}</tbody></table>{!event.participants.length ? <p className="panel-empty">No roster members. Add a group source or an individual person.</p> : null}</div>
        </section>

        <section className="work-panel">
          <div className="panel-heading"><div><CalendarClock size={18} /><h2>Itinerary</h2></div>{event.visibility === EventVisibility.PUBLIC ? <StatusPill value="public" /> : <StatusPill value="private" />}</div>
          <div className="event-facts"><span><CalendarDays size={15} /><strong>{formatDateTime(event.startsAt)}</strong></span>{event.endsAt ? <span><CalendarClock size={15} /><strong>Ends {formatDateTime(event.endsAt)}</strong></span> : null}{event.location ? <span><MapPin size={15} /><strong>{event.location}</strong></span> : null}</div>
          {event.description ? <p className="event-description">{event.description}</p> : null}
          <div className="itinerary-text">{event.itinerary ? event.itinerary.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || "\u00a0"}</p>) : <p className="panel-empty">No itinerary entered.</p>}</div>
        </section>

        <section className="work-panel span-2">
          <div className="panel-heading"><div><PackageCheck size={18} /><h2>Equipment list</h2></div>{canManage ? <details className="inline-details no-print"><summary><Plus size={15} />Add item</summary><form action={addEventEquipmentAction} className="inline-details-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><Field label="Item" wide><input name="label" required /></Field><Field label="Linked asset"><select name="assetId" defaultValue=""><option value="">No linked asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.schoolAssetTag || asset.model || asset.category}</option>)}</select></Field><Field label="Quantity"><input name="quantity" type="number" min="1" max="999" defaultValue="1" required /></Field><Field label="Notes" wide hint="No student information."><input name="notes" /></Field><div className="form-actions field-wide"><SubmitButton>Add equipment</SubmitButton></div></form></details> : null}</div>
          <div className="equipment-list">{event.equipmentItems.map((item) => <div className="equipment-row" key={item.id}><span className={item.packedQuantity >= item.quantity ? "equipment-check ready" : "equipment-check"}>{item.packedQuantity >= item.quantity ? <CheckCircle2 size={18} /> : <PackageCheck size={18} />}</span><div><strong>{item.label}</strong><small>{item.asset?.schoolAssetTag ? `${item.asset.schoolAssetTag} · ` : ""}{item.notes || "No notes"}</small></div>{canManage ? <form action={updateEventEquipmentPackingAction} className="packing-form no-print"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="itemId" value={item.id} /><label><span className="sr-only">Packed quantity for {item.label}</span><input name="packedQuantity" type="number" min="0" max={item.quantity} defaultValue={item.packedQuantity} /></label><span>/ {item.quantity}</span><button className="icon-button" type="submit" aria-label={`Update packed quantity for ${item.label}`} title="Update packed quantity"><Save size={14} /></button></form> : <span>{item.packedQuantity} / {item.quantity}</span>}{canManage ? <form action={removeEventEquipmentAction} className="no-print"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="itemId" value={item.id} /><button className="icon-button danger" type="submit" aria-label={`Remove ${item.label}`} title="Remove item"><Trash2 size={14} /></button></form> : null}</div>)}</div>
          {!event.equipmentItems.length ? <p className="panel-empty">No equipment list items.</p> : null}
        </section>

        <section className="work-panel">
          <div className="panel-heading"><div><Paperclip size={18} /><h2>Files and links</h2></div><span className="count-badge">{event.resources.length}</span></div>
          <div className="resource-list event-resource-list">{event.resources.map((resource) => <div key={resource.id}><span><strong>{resource.label}</strong><small>{resource.kind === EventResourceKind.LOCAL_FILE ? resource.fileName : resource.externalUrl}</small></span><div>{resource.kind === EventResourceKind.LOCAL_FILE ? <a className="icon-button" href={`/api/events/files/${resource.id}`} aria-label={`Download ${resource.label}`} title="Download"><Download size={15} /></a> : <a className="icon-button" href={resource.externalUrl || "#"} target="_blank" rel="noreferrer" aria-label={`Open ${resource.label}`} title="Open link"><ExternalLink size={15} /></a>}{canManage ? <form action={removeEventResourceAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="resourceId" value={resource.id} /><button className="icon-button danger" type="submit" aria-label={`Remove ${resource.label}`} title="Remove resource"><Trash2 size={14} /></button></form> : null}</div></div>)}</div>
          {canManage ? <div className="resource-actions no-print"><details className="inline-details"><summary><ExternalLink size={15} />Add link</summary><form action={addEventLinkAction} className="inline-details-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><Field label="Label" wide><input name="label" required /></Field><Field label="HTTPS link" wide><input name="externalUrl" type="url" required /></Field><div className="form-actions field-wide"><SubmitButton>Add link</SubmitButton></div></form></details><details className="inline-details"><summary><FileUp size={15} />Upload</summary><form action={addEventFileAction} className="inline-details-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><Field label="Label" wide><input name="label" required /></Field><Field label="File" wide hint="Maximum 15 MB. Executable and active web files are blocked."><input name="file" type="file" required /></Field><div className="form-actions field-wide"><SubmitButton>Store file</SubmitButton></div></form></details></div> : null}
        </section>

        <section className="work-panel span-2">
          <div className="panel-heading"><div><UsersRound size={18} /><h2>Volunteer opportunities</h2></div>{canManage ? <details className="inline-details no-print"><summary><Plus size={15} />New opportunity</summary><form action={createVolunteerOpportunityAction} className="inline-details-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><Field label="Opportunity" wide><input name="title" required /></Field><Field label="Capacity"><input name="capacity" type="number" min="1" max="500" defaultValue="1" required /></Field><Field label="Starts"><input name="startsAt" type="datetime-local" /></Field><Field label="Ends"><input name="endsAt" type="datetime-local" /></Field><Field label="Description" wide><textarea name="description" rows={3} /></Field><div className="form-actions field-wide"><SubmitButton>Create opportunity</SubmitButton></div></form></details> : null}</div>
          <div className="opportunity-list">{event.volunteerOpportunities.map((opportunity) => <section className="opportunity-row" key={opportunity.id}><div className="opportunity-heading"><div><strong>{opportunity.title}</strong><span>{opportunity.signups.length}/{opportunity.capacity} assigned{opportunity.startsAt ? ` · ${formatDateTime(opportunity.startsAt)}` : ""}</span></div><StatusPill value={opportunity.status} /></div>{opportunity.description ? <p>{opportunity.description}</p> : null}<div className="volunteer-chip-list">{opportunity.signups.map((signup) => <span key={signup.id}>{signup.person.firstName} {signup.person.lastName}{canManage ? <form action={cancelVolunteerSignupAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="signupId" value={signup.id} /><button type="submit" aria-label={`Cancel volunteer assignment for ${signup.person.firstName} ${signup.person.lastName}`}>×</button></form> : null}</span>)}</div>{canManage && opportunity.status === VolunteerOpportunityStatus.OPEN && opportunity.signups.length < opportunity.capacity ? <form action={addVolunteerSignupAction} className="inline-form no-print"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="opportunityId" value={opportunity.id} /><label><span>Assign volunteer</span><select name="personId" required defaultValue=""><option value="" disabled>Choose person</option>{volunteerPeople.filter((person) => !opportunity.signups.some((signup) => signup.personId === person.id)).map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}</option>)}</select></label><SubmitButton>Assign</SubmitButton></form> : null}{canManage && opportunity.status !== VolunteerOpportunityStatus.CANCELED ? <form action={setVolunteerOpportunityStatusAction} className="opportunity-status-form no-print"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="opportunityId" value={opportunity.id} /><input type="hidden" name="status" value={opportunity.status === VolunteerOpportunityStatus.OPEN ? VolunteerOpportunityStatus.CLOSED : VolunteerOpportunityStatus.OPEN} /><button className="text-button" type="submit">{opportunity.status === VolunteerOpportunityStatus.OPEN ? "Close signups" : "Reopen signups"}</button></form> : null}</section>)}</div>
          {!event.volunteerOpportunities.length ? <p className="panel-empty">No volunteer opportunities.</p> : null}
        </section>

        <section className="work-panel">
          <div className="panel-heading"><div><Mail size={18} /><h2>Email reminders</h2></div><span className="count-badge">{event.reminders.length}</span></div>
          <div className="reminder-list">{event.reminders.map((reminder) => <Link href={reminder.announcementId ? `/communications/${reminder.announcementId}` : "#"} key={reminder.id}><span><strong>{titleCase(reminder.audience)}</strong><small>{reminder.scheduledFor ? `Scheduled ${formatDateTime(reminder.scheduledFor)}` : `Created ${formatDateTime(reminder.createdAt)}`}</small></span>{reminder.announcement ? <StatusPill value={reminder.announcement.status} /> : null}</Link>)}</div>
          {canManage && canEmail ? <details className="inline-details no-print"><summary><Plus size={15} />Create reminder</summary><form action={createEventReminderAction} className="inline-details-panel form-grid"><input type="hidden" name="eventId" value={event.id} /><Field label="Audience" wide><select name="audience" defaultValue={EventReminderAudience.PARTICIPANTS}>{Object.values(EventReminderAudience).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Scheduled delivery" wide hint="Leave blank to create a reviewable email ready for manual release."><input name="scheduledAt" type="datetime-local" /></Field><div className="form-actions field-wide"><SubmitButton>Create reminder</SubmitButton></div></form></details> : null}
        </section>
      </div>
      <p className="privacy-copy report-warning">Attendance contains status only. Do not record medical, disciplinary, or family explanations in event notes, equipment notes, or volunteer descriptions.</p>
    </main>
  );
}
