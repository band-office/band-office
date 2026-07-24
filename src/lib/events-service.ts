import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  AttendanceStatus,
  EmailAudienceRecipientKind,
  EmailAudienceTargetType,
  EventParticipantStatus,
  EventReminderAudience,
  EventResourceKind,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  PersonStatus,
  Prisma,
  VolunteerOpportunityStatus,
  VolunteerSignupStatus,
} from "@/generated/prisma/client";
import { createAnnouncementInTransaction, type AudienceTargetInput } from "@/lib/communications-service";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export class EventInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventInvariantError";
  }
}

function required(value: string, label: string, max = 500) {
  const clean = value.trim();
  if (!clean) throw new EventInvariantError(`${label} is required.`);
  if (clean.length > max) throw new EventInvariantError(`${label} cannot exceed ${max} characters.`);
  return clean;
}

function optional(value: string | null | undefined, max = 20_000) {
  const clean = value?.trim() || null;
  if (clean && clean.length > max) throw new EventInvariantError(`Text cannot exceed ${max} characters.`);
  return clean;
}

function ensureDates(startsAt: Date, endsAt?: Date | null) {
  if (Number.isNaN(startsAt.getTime())) throw new EventInvariantError("Enter a valid event start.");
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new EventInvariantError("Enter a valid event end.");
  if (endsAt && endsAt <= startsAt) throw new EventInvariantError("Event end must be after its start.");
}

function auditFields(fields: string[]) {
  return JSON.stringify({ fields, values: "[redacted]" });
}

async function audit(tx: TransactionClient, input: { programId: string; actor: string; action: string; entityType: string; entityId: string; summary: string; fields?: string[] }) {
  await tx.auditLog.create({
    data: {
      id: randomUUID(),
      programId: input.programId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changeSummary: input.summary,
      changeDiffJson: input.fields ? auditFields(input.fields) : null,
    },
  });
}

async function createParticipantRecords(tx: TransactionClient, eventId: string, personIds: string[], actor: string, options: { restoreRemoved?: boolean } = {}) {
  if (!personIds.length) return 0;
  const existing = await tx.eventParticipant.findMany({ where: { eventId, personId: { in: personIds } }, select: { id: true, personId: true, status: true } });
  const byPerson = new Map(existing.map((row) => [row.personId, row]));
  let added = 0;
  for (const personId of personIds) {
    const current = byPerson.get(personId);
    if (current) {
      if (current.status === EventParticipantStatus.REMOVED && options.restoreRemoved) {
        await tx.eventParticipant.update({ where: { id: current.id }, data: { status: EventParticipantStatus.ACTIVE, removedAt: null, addedAt: new Date(), addedBy: actor } });
        added += 1;
      }
      continue;
    }
    const participant = await tx.eventParticipant.create({ data: { id: randomUUID(), eventId, personId, addedBy: actor } });
    await tx.eventRsvp.create({ data: { id: randomUUID(), participantId: participant.id } });
    await tx.attendanceRecord.create({ data: { id: randomUUID(), participantId: participant.id } });
    added += 1;
  }
  return added;
}

async function activeStudentIdsForGroups(tx: TransactionClient, programId: string, groupIds: string[]) {
  if (!groupIds.length) return [];
  const groups = await tx.group.findMany({ where: { id: { in: groupIds }, programId, active: true }, select: { id: true } });
  if (groups.length !== new Set(groupIds).size) throw new EventInvariantError("Choose active groups from this program.");
  const people = await tx.person.findMany({
    where: {
      programId,
      status: PersonStatus.ACTIVE,
      studentProfile: { isNot: null },
      groupMemberships: { some: { groupId: { in: groupIds }, endedAt: null } },
    },
    select: { id: true },
  });
  return people.map((person) => person.id);
}

export async function createEvent(db: DatabaseClient, input: {
  programId: string;
  operatingPeriodId: string;
  name: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  visibility: EventVisibility;
  itinerary?: string | null;
  notes?: string | null;
  rsvpEnabled: boolean;
  attendanceEnabled: boolean;
  groupIds: string[];
  seriesId?: string | null;
  seriesName?: string | null;
}, actor: string) {
  ensureDates(input.startsAt, input.endsAt);
  return db.$transaction(async (tx) => {
    const period = await tx.operatingPeriod.findUnique({ where: { id: input.operatingPeriodId } });
    if (!period || period.programId !== input.programId) throw new EventInvariantError("Choose an operating period from this program.");
    let seriesId = input.seriesId || null;
    if (seriesId) {
      const series = await tx.eventSeries.findFirst({ where: { id: seriesId, programId: input.programId, active: true } });
      if (!series) throw new EventInvariantError("Choose an active event series from this program.");
    } else if (input.seriesName?.trim()) {
      const name = required(input.seriesName, "Series name", 120);
      const existing = await tx.eventSeries.findUnique({ where: { programId_name: { programId: input.programId, name } } });
      seriesId = existing?.id ?? (await tx.eventSeries.create({ data: { id: randomUUID(), programId: input.programId, name, createdBy: actor } })).id;
    }
    const groupIds = [...new Set(input.groupIds.filter(Boolean))];
    const personIds = await activeStudentIdsForGroups(tx, input.programId, groupIds);
    const event = await tx.event.create({
      data: {
        id: randomUUID(),
        programId: input.programId,
        operatingPeriodId: input.operatingPeriodId,
        seriesId,
        name: required(input.name, "Event name", 160),
        description: optional(input.description, 2000),
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        location: optional(input.location, 300),
        visibility: input.visibility,
        itinerary: optional(input.itinerary),
        notes: optional(input.notes),
        rsvpEnabled: input.rsvpEnabled,
        attendanceEnabled: input.attendanceEnabled,
        createdBy: actor,
      },
    });
    if (groupIds.length) await tx.eventGroup.createMany({ data: groupIds.map((groupId) => ({ id: randomUUID(), eventId: event.id, groupId })) });
    const participantCount = await createParticipantRecords(tx, event.id, personIds, actor);
    await audit(tx, { programId: input.programId, actor, action: "CREATE", entityType: "Event", entityId: event.id, summary: `Created event with a ${participantCount}-person roster snapshot`, fields: ["name", "description", "startsAt", "endsAt", "location", "visibility", "itinerary", "notes", "rsvpEnabled", "attendanceEnabled", "groupIds", "seriesId"] });
    return { event, participantCount };
  });
}

export async function updateEvent(db: DatabaseClient, eventId: string, input: {
  name: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  visibility: EventVisibility;
  itinerary?: string | null;
  notes?: string | null;
  rsvpEnabled: boolean;
  attendanceEnabled: boolean;
  seriesId?: string | null;
}, actor: string) {
  ensureDates(input.startsAt, input.endsAt);
  return db.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id: eventId } });
    if (!existing) throw new EventInvariantError("Event not found.");
    if (input.seriesId) {
      const series = await tx.eventSeries.findFirst({ where: { id: input.seriesId, programId: existing.programId, active: true } });
      if (!series) throw new EventInvariantError("Choose an active event series from this program.");
    }
    const event = await tx.event.update({
      where: { id: eventId },
      data: {
        name: required(input.name, "Event name", 160),
        description: optional(input.description, 2000),
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        location: optional(input.location, 300),
        visibility: input.visibility,
        itinerary: optional(input.itinerary),
        notes: optional(input.notes),
        rsvpEnabled: input.rsvpEnabled,
        attendanceEnabled: input.attendanceEnabled,
        seriesId: input.seriesId || null,
      },
    });
    await audit(tx, { programId: existing.programId, actor, action: "UPDATE", entityType: "Event", entityId: eventId, summary: "Updated event details", fields: ["name", "description", "startsAt", "endsAt", "location", "visibility", "itinerary", "notes", "rsvpEnabled", "attendanceEnabled", "seriesId"] });
    return event;
  });
}

export async function setEventStatus(db: DatabaseClient, eventId: string, status: EventStatus, actor: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id: eventId }, include: { _count: { select: { participants: true } } } });
    if (!existing) throw new EventInvariantError("Event not found.");
    const allowedTransitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELED],
      [EventStatus.PUBLISHED]: [EventStatus.COMPLETED, EventStatus.CANCELED],
      [EventStatus.COMPLETED]: [],
      [EventStatus.CANCELED]: [],
    };
    if (!allowedTransitions[existing.status].includes(status)) {
      throw new EventInvariantError(`An event cannot move from ${existing.status.toLowerCase()} to ${status.toLowerCase()}.`);
    }
    const event = await tx.event.update({ where: { id: eventId }, data: { status } });
    await audit(tx, { programId: existing.programId, actor, action: status, entityType: "Event", entityId: eventId, summary: `Marked event ${status.toLowerCase()}`, fields: ["status"] });
    return event;
  });
}

export async function addEventGroup(db: DatabaseClient, eventId: string, groupId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    const personIds = await activeStudentIdsForGroups(tx, event.programId, [groupId]);
    await tx.eventGroup.upsert({
      where: { eventId_groupId: { eventId, groupId } },
      create: { id: randomUUID(), eventId, groupId },
      update: { removedAt: null, includedAt: new Date() },
    });
    const added = await createParticipantRecords(tx, eventId, personIds, actor);
    await audit(tx, { programId: event.programId, actor, action: "ADD_GROUP", entityType: "Event", entityId: eventId, summary: `Added event group and ${added} roster participants`, fields: ["groupId"] });
    return added;
  });
}

export async function removeEventGroup(db: DatabaseClient, eventId: string, groupId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    await tx.eventGroup.update({ where: { eventId_groupId: { eventId, groupId } }, data: { removedAt: new Date() } });
    await audit(tx, { programId: event.programId, actor, action: "REMOVE_GROUP", entityType: "Event", entityId: eventId, summary: "Removed group source while preserving the event roster snapshot", fields: ["groupId"] });
  });
}

export async function refreshEventRoster(db: DatabaseClient, eventId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, include: { groups: { where: { removedAt: null } } } });
    if (!event) throw new EventInvariantError("Event not found.");
    const personIds = await activeStudentIdsForGroups(tx, event.programId, event.groups.map((row) => row.groupId));
    const added = await createParticipantRecords(tx, eventId, personIds, actor);
    await audit(tx, { programId: event.programId, actor, action: "REFRESH_ROSTER", entityType: "Event", entityId: eventId, summary: `Added ${added} current group members without removing historical participants`, fields: ["groupMemberships"] });
    return added;
  });
}

export async function addEventParticipant(db: DatabaseClient, eventId: string, personId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    const person = await tx.person.findFirst({ where: { id: personId, programId: event.programId, status: PersonStatus.ACTIVE } });
    if (!person) throw new EventInvariantError("Choose an active person from this program.");
    const added = await createParticipantRecords(tx, eventId, [personId], actor, { restoreRemoved: true });
    if (!added) throw new EventInvariantError("That person is already on the active event roster.");
    await audit(tx, { programId: event.programId, actor, action: "ADD_PARTICIPANT", entityType: "Event", entityId: eventId, summary: "Added person to event roster snapshot", fields: ["personId"] });
  });
}

export async function removeEventParticipant(db: DatabaseClient, participantId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const participant = await tx.eventParticipant.findUnique({ where: { id: participantId }, include: { event: true } });
    if (!participant) throw new EventInvariantError("Event participant not found.");
    if (participant.status === EventParticipantStatus.REMOVED) return participant;
    const updated = await tx.eventParticipant.update({ where: { id: participantId }, data: { status: EventParticipantStatus.REMOVED, removedAt: new Date() } });
    await audit(tx, { programId: participant.event.programId, actor, action: "REMOVE_PARTICIPANT", entityType: "EventParticipant", entityId: participantId, summary: "Removed person from active event roster while preserving history", fields: ["status", "removedAt"] });
    return updated;
  });
}

export async function recordEventRsvp(db: DatabaseClient, participantId: string, status: EventRsvpStatus, actor: string) {
  return db.$transaction(async (tx) => {
    const participant = await tx.eventParticipant.findUnique({ where: { id: participantId }, include: { event: true } });
    if (!participant || participant.status !== EventParticipantStatus.ACTIVE) throw new EventInvariantError("Active event participant not found.");
    if (!participant.event.rsvpEnabled) throw new EventInvariantError("RSVP tracking is not enabled for this event.");
    const rsvp = await tx.eventRsvp.upsert({
      where: { participantId },
      create: { id: randomUUID(), participantId, status, recordedAt: status === EventRsvpStatus.PENDING ? null : new Date(), recordedBy: status === EventRsvpStatus.PENDING ? null : actor },
      update: { status, recordedAt: status === EventRsvpStatus.PENDING ? null : new Date(), recordedBy: status === EventRsvpStatus.PENDING ? null : actor },
    });
    await audit(tx, { programId: participant.event.programId, actor, action: "RECORD_RSVP", entityType: "EventRsvp", entityId: rsvp.id, summary: "Recorded event RSVP", fields: ["status", "recordedAt"] });
    return rsvp;
  });
}

export async function recordAttendance(db: DatabaseClient, eventId: string, entries: Array<{ participantId: string; status: AttendanceStatus }>, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, include: { participants: { where: { status: EventParticipantStatus.ACTIVE }, select: { id: true } } } });
    if (!event) throw new EventInvariantError("Event not found.");
    if (!event.attendanceEnabled) throw new EventInvariantError("Attendance tracking is not enabled for this event.");
    const activeIds = new Set(event.participants.map((participant) => participant.id));
    if (entries.some((entry) => !activeIds.has(entry.participantId))) throw new EventInvariantError("Attendance contains a person outside the active event roster.");
    const now = new Date();
    for (const entry of entries) {
      await tx.attendanceRecord.upsert({
        where: { participantId: entry.participantId },
        create: { id: randomUUID(), participantId: entry.participantId, status: entry.status, recordedAt: entry.status === AttendanceStatus.NOT_RECORDED ? null : now, recordedBy: entry.status === AttendanceStatus.NOT_RECORDED ? null : actor },
        update: { status: entry.status, recordedAt: entry.status === AttendanceStatus.NOT_RECORDED ? null : now, recordedBy: entry.status === AttendanceStatus.NOT_RECORDED ? null : actor },
      });
    }
    await audit(tx, { programId: event.programId, actor, action: "RECORD_ATTENDANCE", entityType: "Event", entityId: eventId, summary: `Recorded attendance for ${entries.length} roster participants`, fields: ["attendanceStatuses", "recordedAt"] });
    return entries.length;
  });
}

export async function addEventEquipmentItem(db: DatabaseClient, input: { eventId: string; assetId?: string | null; label: string; quantity: number; notes?: string | null }, actor: string) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999) throw new EventInvariantError("Equipment quantity must be between 1 and 999.");
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    if (input.assetId) {
      const asset = await tx.asset.findFirst({ where: { id: input.assetId, programId: event.programId } });
      if (!asset) throw new EventInvariantError("Choose an asset from this program.");
    }
    const item = await tx.eventEquipmentItem.create({ data: { id: randomUUID(), eventId: input.eventId, assetId: input.assetId || null, label: required(input.label, "Equipment item", 200), quantity: input.quantity, notes: optional(input.notes, 1000), createdBy: actor } });
    await audit(tx, { programId: event.programId, actor, action: "CREATE", entityType: "EventEquipmentItem", entityId: item.id, summary: "Added item to event equipment list", fields: ["assetId", "label", "quantity", "notes"] });
    return item;
  });
}

export async function updateEventEquipmentPacking(db: DatabaseClient, itemId: string, packedQuantity: number, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.eventEquipmentItem.findUnique({ where: { id: itemId }, include: { event: true } });
    if (!item) throw new EventInvariantError("Equipment item not found.");
    if (!Number.isInteger(packedQuantity) || packedQuantity < 0 || packedQuantity > item.quantity) throw new EventInvariantError("Packed quantity must be between zero and the required quantity.");
    const updated = await tx.eventEquipmentItem.update({ where: { id: itemId }, data: { packedQuantity } });
    await audit(tx, { programId: item.event.programId, actor, action: "UPDATE", entityType: "EventEquipmentItem", entityId: itemId, summary: "Updated event equipment packing count", fields: ["packedQuantity"] });
    return updated;
  });
}

export async function removeEventEquipmentItem(db: DatabaseClient, itemId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.eventEquipmentItem.findUnique({ where: { id: itemId }, include: { event: true } });
    if (!item) throw new EventInvariantError("Equipment item not found.");
    await tx.eventEquipmentItem.delete({ where: { id: itemId } });
    await audit(tx, { programId: item.event.programId, actor, action: "DELETE", entityType: "EventEquipmentItem", entityId: itemId, summary: "Removed item from event equipment list" });
  });
}

export type EventResourceInput = {
  id?: string;
  eventId: string;
  kind: EventResourceKind;
  label: string;
  fileName?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  storageKey?: string | null;
  contentHash?: string | null;
  externalUrl?: string | null;
};

export async function addEventResource(db: DatabaseClient, input: EventResourceInput, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    if (input.kind === EventResourceKind.LOCAL_FILE && (!input.fileName || !input.storageKey || !input.contentHash || !input.byteSize)) throw new EventInvariantError("Managed file metadata is incomplete.");
    if (input.kind === EventResourceKind.EXTERNAL_LINK) {
      try {
        const url = new URL(input.externalUrl || "");
        if (url.protocol !== "https:") throw new Error();
      } catch {
        throw new EventInvariantError("Event links must use a valid HTTPS address.");
      }
    }
    const resource = await tx.eventResource.create({
      data: {
        id: input.id ?? randomUUID(),
        eventId: input.eventId,
        kind: input.kind,
        label: required(input.label, "Resource label", 160),
        fileName: input.kind === EventResourceKind.LOCAL_FILE ? input.fileName : null,
        mimeType: input.kind === EventResourceKind.LOCAL_FILE ? input.mimeType : null,
        byteSize: input.kind === EventResourceKind.LOCAL_FILE ? input.byteSize : null,
        storageKey: input.kind === EventResourceKind.LOCAL_FILE ? input.storageKey : null,
        contentHash: input.kind === EventResourceKind.LOCAL_FILE ? input.contentHash : null,
        externalUrl: input.kind === EventResourceKind.EXTERNAL_LINK ? input.externalUrl : null,
        createdBy: actor,
      },
    });
    await audit(tx, { programId: event.programId, actor, action: "CREATE", entityType: "EventResource", entityId: resource.id, summary: input.kind === EventResourceKind.LOCAL_FILE ? "Stored managed event file" : "Added external event link", fields: ["kind", "label", "fileName", "mimeType", "byteSize", "storageKey", "contentHash", "externalUrl"] });
    return resource;
  });
}

export async function removeEventResource(db: DatabaseClient, resourceId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const resource = await tx.eventResource.findUnique({ where: { id: resourceId }, include: { event: true } });
    if (!resource) throw new EventInvariantError("Event resource not found.");
    const updated = await tx.eventResource.update({ where: { id: resourceId }, data: { status: "REMOVED", removedAt: new Date() } });
    await audit(tx, { programId: resource.event.programId, actor, action: "REMOVE", entityType: "EventResource", entityId: resourceId, summary: "Removed event resource while retaining metadata history", fields: ["status", "removedAt"] });
    return updated;
  });
}

export async function createVolunteerOpportunity(db: DatabaseClient, input: { eventId: string; title: string; description?: string | null; startsAt?: Date | null; endsAt?: Date | null; capacity: number }, actor: string) {
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) throw new EventInvariantError("Volunteer capacity must be between 1 and 500.");
  if (input.startsAt) ensureDates(input.startsAt, input.endsAt);
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    const opportunity = await tx.volunteerOpportunity.create({ data: { id: randomUUID(), eventId: input.eventId, title: required(input.title, "Opportunity title", 160), description: optional(input.description, 2000), startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, capacity: input.capacity, createdBy: actor } });
    await audit(tx, { programId: event.programId, actor, action: "CREATE", entityType: "VolunteerOpportunity", entityId: opportunity.id, summary: "Created bounded volunteer opportunity", fields: ["title", "description", "startsAt", "endsAt", "capacity"] });
    return opportunity;
  });
}

export async function setVolunteerOpportunityStatus(db: DatabaseClient, opportunityId: string, status: VolunteerOpportunityStatus, actor: string) {
  return db.$transaction(async (tx) => {
    const opportunity = await tx.volunteerOpportunity.findUnique({ where: { id: opportunityId }, include: { event: true } });
    if (!opportunity) throw new EventInvariantError("Volunteer opportunity not found.");
    const updated = await tx.volunteerOpportunity.update({ where: { id: opportunityId }, data: { status } });
    await audit(tx, { programId: opportunity.event.programId, actor, action: "UPDATE", entityType: "VolunteerOpportunity", entityId: opportunityId, summary: "Updated volunteer opportunity status", fields: ["status"] });
    return updated;
  });
}

export async function addVolunteerSignup(db: DatabaseClient, opportunityId: string, personId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const opportunity = await tx.volunteerOpportunity.findUnique({ where: { id: opportunityId }, include: { event: true, signups: { where: { status: VolunteerSignupStatus.CONFIRMED } } } });
    if (!opportunity || opportunity.status !== VolunteerOpportunityStatus.OPEN) throw new EventInvariantError("Choose an open volunteer opportunity.");
    if (opportunity.signups.length >= opportunity.capacity) throw new EventInvariantError("This volunteer opportunity is already full.");
    const person = await tx.person.findFirst({ where: { id: personId, programId: opportunity.event.programId, status: PersonStatus.ACTIVE } });
    if (!person) throw new EventInvariantError("Choose an active person from this program.");
    const signup = await tx.volunteerSignup.upsert({
      where: { opportunityId_personId: { opportunityId, personId } },
      create: { id: randomUUID(), opportunityId, personId, createdBy: actor },
      update: { status: VolunteerSignupStatus.CONFIRMED, signedUpAt: new Date(), createdBy: actor },
    });
    await audit(tx, { programId: opportunity.event.programId, actor, action: "SIGN_UP", entityType: "VolunteerSignup", entityId: signup.id, summary: "Recorded event volunteer assignment", fields: ["opportunityId", "personId", "status"] });
    return signup;
  });
}

export async function cancelVolunteerSignup(db: DatabaseClient, signupId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const signup = await tx.volunteerSignup.findUnique({ where: { id: signupId }, include: { opportunity: { include: { event: true } } } });
    if (!signup) throw new EventInvariantError("Volunteer signup not found.");
    const updated = await tx.volunteerSignup.update({ where: { id: signupId }, data: { status: VolunteerSignupStatus.CANCELED } });
    await audit(tx, { programId: signup.opportunity.event.programId, actor, action: "CANCEL", entityType: "VolunteerSignup", entityId: signupId, summary: "Canceled event volunteer assignment", fields: ["status"] });
    return updated;
  });
}

export async function recordEventReminder(db: DatabaseClient, input: { eventId: string; announcementId: string; audience: EventReminderAudience; scheduledFor?: Date | null }, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new EventInvariantError("Event not found.");
    const reminder = await tx.eventReminder.create({ data: { id: randomUUID(), eventId: input.eventId, announcementId: input.announcementId, audience: input.audience, scheduledFor: input.scheduledFor ?? null, createdBy: actor } });
    await audit(tx, { programId: event.programId, actor, action: "CREATE_REMINDER", entityType: "EventReminder", entityId: reminder.id, summary: "Created event email reminder", fields: ["announcementId", "audience", "scheduledFor"] });
    return reminder;
  });
}

export async function createEventReminderAnnouncement(db: DatabaseClient, input: { eventId: string; audience: EventReminderAudience; scheduledFor?: Date | null }, actor: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      include: {
        participants: { where: { status: EventParticipantStatus.ACTIVE }, select: { personId: true } },
        volunteerOpportunities: { include: { signups: { where: { status: VolunteerSignupStatus.CONFIRMED }, select: { personId: true } } } },
      },
    });
    if (!event) throw new EventInvariantError("Event not found.");
    const personIds = input.audience === EventReminderAudience.VOLUNTEERS
      ? [...new Set(event.volunteerOpportunities.flatMap((opportunity) => opportunity.signups.map((signup) => signup.personId)))]
      : [...new Set(event.participants.map((participant) => participant.personId))];
    if (!personIds.length) throw new EventInvariantError("The selected reminder audience is empty.");
    const targets: AudienceTargetInput[] = personIds.map((personId) => ({
      targetType: EmailAudienceTargetType.PERSON,
      recipientKind: input.audience === EventReminderAudience.GUARDIANS ? EmailAudienceRecipientKind.GUARDIANS : EmailAudienceRecipientKind.SELF,
      personId,
    }));
    const announcement = await createAnnouncementInTransaction(tx, {
      programId: event.programId,
      operatingPeriodId: event.operatingPeriodId,
      subject: `Reminder: ${event.name}`,
      body: `${event.name} begins ${event.startsAt.toLocaleString()}${event.location ? ` at ${event.location}` : ""}. Please review the current program itinerary and contact staff through the approved school channel with questions.`,
      scheduledAt: input.scheduledFor,
      targets,
      attachments: [],
    }, actor);
    const reminder = await tx.eventReminder.create({ data: { id: randomUUID(), eventId: event.id, announcementId: announcement.id, audience: input.audience, scheduledFor: input.scheduledFor ?? null, createdBy: actor } });
    await audit(tx, { programId: event.programId, actor, action: "CREATE_REMINDER", entityType: "EventReminder", entityId: reminder.id, summary: "Created event email reminder and announcement atomically", fields: ["announcementId", "audience", "scheduledFor"] });
    return { announcement, reminder };
  });
}

function hashCalendarToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCalendarSubscription(db: DatabaseClient, programId: string, name: string, actor: string) {
  const token = randomBytes(32).toString("base64url");
  const subscription = await db.$transaction(async (tx) => {
    const created = await tx.calendarSubscription.create({ data: { id: randomUUID(), programId, name: required(name, "Calendar name", 120), tokenHash: hashCalendarToken(token), createdBy: actor } });
    await audit(tx, { programId, actor, action: "CREATE", entityType: "CalendarSubscription", entityId: created.id, summary: "Created private calendar subscription token", fields: ["name", "tokenHash"] });
    return created;
  });
  return { subscription, token };
}

export async function revokeCalendarSubscription(db: DatabaseClient, subscriptionId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const subscription = await tx.calendarSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw new EventInvariantError("Calendar subscription not found.");
    const revoked = await tx.calendarSubscription.update({ where: { id: subscriptionId }, data: { revokedAt: new Date() } });
    await audit(tx, { programId: subscription.programId, actor, action: "REVOKE", entityType: "CalendarSubscription", entityId: subscriptionId, summary: "Revoked private calendar subscription token", fields: ["revokedAt"] });
    return revoked;
  });
}

export async function findCalendarSubscriptionByToken(db: DatabaseClient, token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  return db.calendarSubscription.findFirst({ where: { tokenHash: hashCalendarToken(token), revokedAt: null }, include: { program: true } });
}
