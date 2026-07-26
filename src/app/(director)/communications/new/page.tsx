import Link from "next/link";
import { ArrowLeft, MailPlus, Paperclip, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createAnnouncementAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PersonClassificationType, PersonStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProgramContext } from "@/lib/program-context";

export const metadata = { title: "Compose email" };
export const dynamic = "force-dynamic";

const audienceClassifications = [PersonClassificationType.STUDENT, PersonClassificationType.GUARDIAN, PersonClassificationType.STAFF, PersonClassificationType.BOOSTER, PersonClassificationType.EXTERNAL];

export default async function ComposeEmailPage({ searchParams }: { searchParams: Promise<{ template?: string; error?: string; success?: string }> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "MANAGE_COMMUNICATIONS")) redirect("/communications?error=Your%20account%20cannot%20compose%20announcements.");
  const db = getDb();
  const { program, operatingPeriod } = await getProgramContext(db);
  const [groups, people, gradeRows, template] = await Promise.all([
    db.group.findMany({ where: { programId: program.id, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.person.findMany({ where: { programId: program.id, status: PersonStatus.ACTIVE }, include: { classifications: true, studentProfile: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.studentProfile.findMany({ where: { programId: program.id, person: { status: PersonStatus.ACTIVE } }, distinct: ["grade"], select: { grade: true }, orderBy: { grade: "asc" } }),
    params.template ? db.emailTemplate.findFirst({ where: { id: params.template, programId: program.id } }) : null,
  ]);

  return <main className="content narrow-content compose-content">
    <Link className="back-link" href="/communications"><ArrowLeft size={15} />Communications</Link>
    <PageHeader eyebrow={`Current period · ${operatingPeriod.label}`} title="Compose email" description="Build the message and freeze a reviewable audience before delivery." icon={MailPlus} />
    <FlashMessage {...params} />
    <form action={createAnnouncementAction} className="compose-form">
      <section className="compose-section"><div className="section-heading"><div><h2>Message</h2><p>Replies return to the connected shared mailbox.</p></div></div><div className="form-grid"><Field label="Subject" wide><input name="subject" required maxLength={200} defaultValue={template?.subject || ""} /></Field><Field label="Message" wide><textarea name="body" rows={12} required maxLength={50000} defaultValue={template?.body || ""} /></Field><Field label="Attachments" hint="Up to 5 files and 10 MB total." wide><span className="file-control"><Paperclip size={17} /><input name="attachments" type="file" multiple /></span></Field></div></section>
      <section className="compose-section"><div className="section-heading"><div><h2>Audience</h2><p>Guardians are deduplicated across linked students.</p></div><UsersRound size={19} /></div>
        <div className="audience-columns">
          <fieldset><legend>Contact types</legend>{audienceClassifications.map((classification) => <label className="check-control compact" key={classification}><input type="checkbox" name="classificationTargets" value={classification} /><span>{classification.toLowerCase()}</span></label>)}</fieldset>
          <fieldset><legend>Grades</legend>{gradeRows.map(({ grade }) => <div className="audience-row" key={grade}><strong>Grade {grade}</strong><label className="check-control compact"><input type="checkbox" name="gradeStudents" value={grade} /><span>Students</span></label><label className="check-control compact"><input type="checkbox" name="gradeGuardians" value={grade} /><span>Guardians</span></label></div>)}</fieldset>
          <fieldset className="span-2"><legend>Groups and sections</legend>{groups.map((group) => <div className="audience-row group-row" key={group.id}><strong>{group.name}<small>{group.kind.toLowerCase()}</small></strong><label className="check-control compact"><input type="checkbox" name="groupMembers" value={group.id} /><span>Members</span></label><label className="check-control compact"><input type="checkbox" name="groupGuardians" value={group.id} /><span>Guardians</span></label></div>)}</fieldset>
          <fieldset className="span-2"><legend>Selected people</legend><div className="people-check-list">{people.map((person) => <label className="check-control compact" key={person.id}><input type="checkbox" name="personIds" value={person.id} /><span><strong>{person.lastName}, {person.firstName}</strong><small>{person.classifications.map((item) => item.classification.toLowerCase()).join(", ")}{person.studentProfile ? ` · grade ${person.studentProfile.grade}` : ""}</small></span></label>)}</div></fieldset>
        </div>
      </section>
      <section className="compose-section delivery-section"><div><Field label="Schedule (optional)" hint="Desktop delivery runs only while Band Office is open."><input name="scheduledAt" type="datetime-local" /></Field></div><div className="form-actions"><Link className="button secondary" href="/communications">Cancel</Link><SubmitButton>Build audience preview</SubmitButton></div></section>
    </form>
  </main>;
}
