import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AttendanceWorkspace } from "@/components/attendance-workspace";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { EventParticipantStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventAttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "RECORD_ATTENDANCE")) redirect(`/events/${id}?error=Your%20account%20cannot%20record%20attendance.`);
  const event = await getDb().event.findFirst({
    where: { id, programId: user.programId },
    include: {
      participants: {
        where: { status: EventParticipantStatus.ACTIVE },
        include: {
          attendance: true,
          person: { include: { studentProfile: true, groupMemberships: { where: { endedAt: null }, include: { group: true } } } },
        },
        orderBy: [{ person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
      },
    },
  });
  if (!event) notFound();
  if (!event.attendanceEnabled) redirect(`/events/${id}?error=Attendance%20tracking%20is%20not%20enabled%20for%20this%20event.`);
  const rows = event.participants.map((participant) => ({
    participantId: participant.id,
    name: `${participant.person.lastName}, ${participant.person.firstName}`.trim(),
    grade: participant.person.studentProfile?.grade ?? null,
    groups: participant.person.groupMemberships.map((membership) => membership.group.name).join(", "),
    status: participant.attendance?.status ?? "NOT_RECORDED" as const,
  }));

  return (
    <main className="content attendance-page">
      <Link className="back-link no-print" href={`/events/${event.id}`}><ArrowLeft size={16} />{event.name}</Link>
      <PageHeader eyebrow={formatDateTime(event.startsAt)} title="Attendance" description={`${event.name} · ${event.location || "Location not set"}`} icon={ClipboardCheck} actions={<PrintButton />} />
      <FlashMessage {...query} />
      <AttendanceWorkspace eventId={event.id} rows={rows} />
      <p className="privacy-copy report-warning no-print">Attendance stores present, absent, late, excused, or not recorded. Explanations belong in approved school systems.</p>
    </main>
  );
}
