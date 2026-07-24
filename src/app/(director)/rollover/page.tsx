import Link from "next/link";
import { ArchiveRestore, CheckCircle2, Circle, Download, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { rolloverAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getProgramContext } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Rollover" };
export const dynamic = "force-dynamic";

export default async function RolloverPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const user = await requireUser();
  if (!hasPermission(user, "ROLLOVER")) redirect("/today?error=Rollover%20access%20is%20restricted.");
  const db = getDb();
  const { program, operatingPeriod: period } = await getProgramContext(db);
  const [outstanding, graduating, latestBackup, latestMutation] = await Promise.all([
    db.assignment.count({ where: { operatingPeriodId: period.id, checkedInAt: null } }),
    db.person.count({ where: { programId: program.id, status: "ACTIVE", studentProfile: { is: { grade: { gte: program.graduationGrade } } } } }),
    db.backupRecord.findFirst({ where: { programId: program.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findFirst({ where: { programId: program.id, action: { not: "EXPORT" } }, orderBy: { timestamp: "desc" } }),
  ]);
  const backupCurrent = Boolean(latestBackup && (!latestMutation || latestBackup.createdAt >= latestMutation.timestamp));
  const ready = outstanding === 0 && backupCurrent;
  const currentYear = period.startsAt.getFullYear();
  const nextLabel = `${currentYear + 1}-${currentYear + 2}`;
  return <main className="content narrow-content">
    <PageHeader eyebrow="Period closeout" title={`Close ${period.label}`} description="Rollover is one audited transaction after assignments and archive checks pass." icon={ArchiveRestore} />
    <FlashMessage error={query.error} />
    <div className="rollover-steps">
      <section className={outstanding ? "rollover-step" : "rollover-step complete-step"}><span className="step-state">{outstanding ? <Circle size={22} /> : <CheckCircle2 size={22} />}</span><div><span>Step 1</span><h2>Resolve outstanding assignments</h2><p>{outstanding} assets remain checked out. Every assignment must be returned or explicitly resolved before closeout.</p>{outstanding ? <Link className="button secondary" href="/checkin">Open check-in station</Link> : <span className="complete-label"><CheckCircle2 size={16} />All assignments resolved</span>}</div></section>
      <section className={backupCurrent ? "rollover-step complete-step" : "rollover-step"}><span className="step-state">{backupCurrent ? <CheckCircle2 size={22} /> : <Circle size={22} />}</span><div><span>Step 2</span><h2>Create a current archive</h2><p>{latestBackup ? `Latest archive: ${latestBackup.filename}, created ${formatDate(latestBackup.createdAt)}.` : "No full backup has been recorded."} A record change after that archive makes it stale.</p>{backupCurrent ? <span className="complete-label"><CheckCircle2 size={16} />Latest changes covered</span> : <Link className="button secondary" href="/settings"><Download size={16} />Create fresh archive</Link>}</div></section>
      <section className={ready ? "rollover-step" : "rollover-step locked"}><span className="step-state">{ready ? <Circle size={22} /> : <LockKeyhole size={22} />}</span><div><span>Step 3</span><h2>Review and commit</h2><p>{graduating} active students at grade {program.graduationGrade} will graduate and leave their active groups. Remaining active students advance one grade. The current period closes and the next opens together.</p><form action={rolloverAction} className="rollover-form"><Field label="Next period label"><input name="nextLabel" defaultValue={nextLabel} required disabled={!ready} /></Field><Field label="Next period starts"><input name="nextStartsAt" type="date" defaultValue={`${currentYear + 1}-07-01`} required disabled={!ready} /></Field><Field label={`Type ${period.label} to confirm`} wide><input name="confirmation" autoComplete="off" required disabled={!ready} /></Field><div className="form-actions field-wide"><SubmitButton disabled={!ready}>Close period and open next</SubmitButton></div></form></div></section>
    </div>
    <p className="privacy-copy">No period, person, or group data changes until the final form succeeds. Any failure rolls back the complete rollover.</p>
  </main>;
}
