import {
  AttendanceStatus,
  EventParticipantStatus,
  VolunteerSignupStatus,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? "";
}

function eventWhere(programId: string, eventId?: string | null) {
  return { event: { programId, ...(eventId ? { id: eventId } : {}) } };
}

export async function eventRoster(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.eventParticipant.findMany({
    where: { ...eventWhere(programId, eventId), status: EventParticipantStatus.ACTIVE },
    include: {
      event: { include: { groups: { where: { removedAt: null }, include: { group: true } }, series: true } },
      person: { include: { studentProfile: true } },
      rsvp: true,
      attendance: true,
    },
    orderBy: [{ event: { startsAt: "asc" } }, { person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
  });
  return rows.map((row) => ({
    eventId: row.eventId,
    event: row.event.name,
    series: row.event.series?.name ?? "",
    startsAt: iso(row.event.startsAt),
    location: row.event.location ?? "",
    personId: row.personId,
    personName: `${row.person.lastName}, ${row.person.firstName}`.trim(),
    grade: row.person.studentProfile?.grade ?? "",
    eventGroups: row.event.groups.map((group) => group.group.name).join("; "),
    rsvp: row.rsvp?.status ?? "PENDING",
    attendance: row.attendance?.status ?? "NOT_RECORDED",
  }));
}

export async function eventRsvpReport(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.eventRsvp.findMany({
    where: { participant: { ...eventWhere(programId, eventId), status: EventParticipantStatus.ACTIVE } },
    include: { participant: { include: { event: true, person: true } } },
    orderBy: [{ participant: { event: { startsAt: "asc" } } }, { participant: { person: { lastName: "asc" } } }],
  });
  return rows.map((row) => ({
    eventId: row.participant.eventId,
    event: row.participant.event.name,
    startsAt: iso(row.participant.event.startsAt),
    personId: row.participant.personId,
    personName: `${row.participant.person.lastName}, ${row.participant.person.firstName}`.trim(),
    status: row.status,
    recordedAt: iso(row.recordedAt),
    recordedBy: row.recordedBy ?? "",
  }));
}

export async function eventAttendanceReport(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.attendanceRecord.findMany({
    where: { participant: { ...eventWhere(programId, eventId), status: EventParticipantStatus.ACTIVE } },
    include: { participant: { include: { event: true, person: { include: { studentProfile: true } } } } },
    orderBy: [{ participant: { event: { startsAt: "asc" } } }, { participant: { person: { lastName: "asc" } } }],
  });
  return rows.map((row) => ({
    eventId: row.participant.eventId,
    event: row.participant.event.name,
    startsAt: iso(row.participant.event.startsAt),
    personId: row.participant.personId,
    personName: `${row.participant.person.lastName}, ${row.participant.person.firstName}`.trim(),
    grade: row.participant.person.studentProfile?.grade ?? "",
    status: row.status,
    recordedAt: iso(row.recordedAt),
    recordedBy: row.recordedBy ?? "",
  }));
}

export async function eventAbsenceReport(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await eventAttendanceReport(db, programId, eventId);
  return rows.filter((row) => row.status === AttendanceStatus.ABSENT || row.status === AttendanceStatus.EXCUSED);
}

export async function eventVolunteerReport(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.volunteerSignup.findMany({
    where: {
      status: VolunteerSignupStatus.CONFIRMED,
      opportunity: { event: { programId, ...(eventId ? { id: eventId } : {}) } },
    },
    include: { person: true, opportunity: { include: { event: true } } },
    orderBy: [{ opportunity: { event: { startsAt: "asc" } } }, { opportunity: { title: "asc" } }, { person: { lastName: "asc" } }],
  });
  return rows.map((row) => ({
    eventId: row.opportunity.eventId,
    event: row.opportunity.event.name,
    eventStartsAt: iso(row.opportunity.event.startsAt),
    opportunity: row.opportunity.title,
    opportunityStartsAt: iso(row.opportunity.startsAt),
    capacity: row.opportunity.capacity,
    personId: row.personId,
    volunteerName: `${row.person.lastName}, ${row.person.firstName}`.trim(),
    email: row.person.email ?? "",
    phone: row.person.phone ?? "",
    signedUpAt: iso(row.signedUpAt),
  }));
}

export async function eventTripRoster(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.eventParticipant.findMany({
    where: { ...eventWhere(programId, eventId), status: EventParticipantStatus.ACTIVE },
    include: {
      event: true,
      person: {
        include: {
          studentProfile: true,
          groupMemberships: { where: { endedAt: null }, include: { group: true } },
          assignments: { where: { checkedInAt: null }, include: { asset: true } },
        },
      },
      rsvp: true,
    },
    orderBy: [{ event: { startsAt: "asc" } }, { person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
  });
  return rows.map((row) => ({
    eventId: row.eventId,
    event: row.event.name,
    startsAt: iso(row.event.startsAt),
    location: row.event.location ?? "",
    personId: row.personId,
    studentName: `${row.person.lastName}, ${row.person.firstName}`.trim(),
    grade: row.person.studentProfile?.grade ?? "",
    groups: row.person.groupMemberships.map((membership) => membership.group.name).sort().join("; "),
    rsvp: row.rsvp?.status ?? "PENDING",
    assignedAssets: row.person.assignments.map((assignment) => assignment.asset.schoolAssetTag || assignment.asset.model || assignment.asset.category).join("; "),
  }));
}

export async function eventEquipmentReport(db: DatabaseClient, programId: string, eventId?: string | null) {
  const rows = await db.eventEquipmentItem.findMany({
    where: { event: { programId, ...(eventId ? { id: eventId } : {}) } },
    include: { event: true, asset: true },
    orderBy: [{ event: { startsAt: "asc" } }, { label: "asc" }],
  });
  return rows.map((row) => ({
    eventId: row.eventId,
    event: row.event.name,
    startsAt: iso(row.event.startsAt),
    item: row.label,
    assetTag: row.asset?.schoolAssetTag ?? "",
    quantity: row.quantity,
    packedQuantity: row.packedQuantity,
    ready: row.packedQuantity >= row.quantity ? "yes" : "no",
    notes: row.notes ?? "",
  }));
}
