import Link from "next/link";
import { ArrowLeft, MailPlus, Paperclip, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { updateAnnouncementAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { AnnouncementStatus, EmailAudienceRecipientKind, EmailAudienceTargetType, PersonClassificationType, PersonStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProgram } from "@/lib/program-context";

export const metadata = { title: "Edit announcement" };
export const dynamic = "force-dynamic";

const audienceClassifications = [PersonClassificationType.STUDENT, PersonClassificationType.GUARDIAN, PersonClassificationType.STAFF, PersonClassificationType.BOOSTER, PersonClassificationType.EXTERNAL];

function localDateTime(value: Date | null) {
  if (!value) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default async function EditAnnouncementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "MANAGE_COMMUNICATIONS")) redirect(`/communications/${id}`);
  const db = getDb();
  const program = await getProgram(db);
  const [announcement, groups, people, gradeRows] = await Promise.all([
    db.announcement.findFirst({ where: { id, programId: program.id }, include: { audienceTargets: true, attachments: { orderBy: { fileName: "asc" } } } }),
    db.group.findMany({ where: { programId: program.id, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.person.findMany({ where: { programId: program.id, status: PersonStatus.ACTIVE }, include: { classifications: true, studentProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.studentProfile.findMany({ where: { programId: program.id, person: { status: PersonStatus.ACTIVE } }, distinct: ["grade"], select: { grade: true }, orderBy: { grade: "asc" } }),
  ]);
  if (!announcement) notFound();
  if (announcement.status !== AnnouncementStatus.READY && announcement.status !== AnnouncementStatus.SCHEDULED) redirect(`/communications/${id}?error=Only%20reviewed%2C%20unsent%20announcements%20can%20be%20edited.`);
  const selected = (targetType: EmailAudienceTargetType, recipientKind: EmailAudienceRecipientKind, field: "classification" | "groupId" | "grade" | "personId", value: string | number) => announcement.audienceTargets.some((target) => target.targetType === targetType && target.recipientKind === recipientKind && target[field] === value);

  return <main className="content narrow-content compose-content">
    <Link className="back-link" href={`/communications/${id}`}><ArrowLeft size={15} />Announcement preview</Link>
    <PageHeader title="Edit announcement" description="Saving replaces the unsent audience snapshot and schedule." icon={MailPlus} />
    <FlashMessage {...query} />
    <form action={updateAnnouncementAction} className="compose-form"><input type="hidden" name="announcementId" value={id} />
      <section className="compose-section"><div className="section-heading"><div><h2>Message</h2></div></div><div className="form-grid"><Field label="Subject" wide><input name="subject" required maxLength={200} defaultValue={announcement.subject} /></Field><Field label="Message" wide><textarea name="body" rows={12} required maxLength={50000} defaultValue={announcement.body} /></Field>{announcement.attachments.length ? <Field label="Existing attachments" wide><div className="attachment-edit-list">{announcement.attachments.map((attachment) => <label className="check-control compact" key={attachment.id}><input type="checkbox" name="removeAttachmentIds" value={attachment.id} /><span><strong>{attachment.fileName}</strong><small>Remove · {(attachment.byteSize / 1024).toFixed(1)} KB</small></span></label>)}</div></Field> : null}<Field label="Add attachments" hint="Up to 5 files and 10 MB total." wide><span className="file-control"><Paperclip size={17} /><input name="attachments" type="file" multiple /></span></Field></div></section>
      <section className="compose-section"><div className="section-heading"><div><h2>Audience</h2></div><UsersRound size={19} /></div><div className="audience-columns">
        <fieldset><legend>Contact types</legend>{audienceClassifications.map((classification) => <label className="check-control compact" key={classification}><input type="checkbox" name="classificationTargets" value={classification} defaultChecked={selected(EmailAudienceTargetType.CLASSIFICATION, EmailAudienceRecipientKind.SELF, "classification", classification)} /><span>{classification.toLowerCase()}</span></label>)}</fieldset>
        <fieldset><legend>Grades</legend>{gradeRows.map(({ grade }) => <div className="audience-row" key={grade}><strong>Grade {grade}</strong><label className="check-control compact"><input type="checkbox" name="gradeStudents" value={grade} defaultChecked={selected(EmailAudienceTargetType.GRADE, EmailAudienceRecipientKind.SELF, "grade", grade)} /><span>Students</span></label><label className="check-control compact"><input type="checkbox" name="gradeGuardians" value={grade} defaultChecked={selected(EmailAudienceTargetType.GRADE, EmailAudienceRecipientKind.GUARDIANS, "grade", grade)} /><span>Guardians</span></label></div>)}</fieldset>
        <fieldset className="span-2"><legend>Groups and sections</legend>{groups.map((group) => <div className="audience-row group-row" key={group.id}><strong>{group.name}<small>{group.kind.toLowerCase()}</small></strong><label className="check-control compact"><input type="checkbox" name="groupMembers" value={group.id} defaultChecked={selected(EmailAudienceTargetType.GROUP, EmailAudienceRecipientKind.SELF, "groupId", group.id)} /><span>Members</span></label><label className="check-control compact"><input type="checkbox" name="groupGuardians" value={group.id} defaultChecked={selected(EmailAudienceTargetType.GROUP, EmailAudienceRecipientKind.GUARDIANS, "groupId", group.id)} /><span>Guardians</span></label></div>)}</fieldset>
        <fieldset className="span-2"><legend>Selected people</legend><div className="people-check-list">{people.map((person) => <label className="check-control compact" key={person.id}><input type="checkbox" name="personIds" value={person.id} defaultChecked={selected(EmailAudienceTargetType.PERSON, EmailAudienceRecipientKind.SELF, "personId", person.id)} /><span><strong>{person.lastName}, {person.firstName}</strong><small>{person.classifications.map((item) => item.classification.toLowerCase()).join(", ")}{person.studentProfile ? ` · grade ${person.studentProfile.grade}` : ""}</small></span></label>)}</div></fieldset>
      </div></section>
      <section className="compose-section delivery-section"><div><Field label="Schedule (optional)" hint="Desktop delivery runs only while Band Office is open."><input name="scheduledAt" type="datetime-local" defaultValue={localDateTime(announcement.scheduledAt)} /></Field></div><div className="form-actions"><Link className="button secondary" href={`/communications/${id}`}>Cancel</Link><SubmitButton>Save and rebuild preview</SubmitButton></div></section>
    </form>
  </main>;
}
