import { DatabaseBackup, Download, History, Settings, UserCog } from "lucide-react";
import { createStaffAccountAction, updateProgramSettingsAction, updateStaffRoleAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_AGREEMENT_TEMPLATE } from "@/lib/agreement";
import { DesktopRestore } from "@/components/desktop-restore";
import { getDb } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { PersonClassificationType, StaffRole } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "MANAGE_SETTINGS") && !hasPermission(user, "MANAGE_USERS")) redirect("/today?error=Settings%20access%20is%20restricted.");
  const canManageUsers = hasPermission(user, "MANAGE_USERS");
  const [periods, audit, backups, staffUsers, availableStaff] = await Promise.all([
    db.operatingPeriod.findMany({ where: { programId: program.id }, orderBy: { startsAt: "desc" } }),
    db.auditLog.findMany({ where: { programId: program.id }, orderBy: { timestamp: "desc" }, take: 50 }),
    db.backupRecord.findMany({ where: { programId: program.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.staffUser.findMany({ where: { programId: program.id }, include: { person: true }, orderBy: { username: "asc" } }),
    db.person.findMany({ where: { programId: program.id, classifications: { some: { classification: PersonClassificationType.STAFF } }, staffUsers: { none: {} } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  return <main className="content">
    <PageHeader eyebrow="Administration" title="Settings & audit" description="Program identity, data ownership, and recent record activity." icon={Settings} />
    <FlashMessage {...query} />
    <div className="settings-layout">
      <section className="settings-section">
        <div className="section-heading"><div><h2>Program</h2><p>One program is managed by this installation.</p></div></div>
        <form action={updateProgramSettingsAction} className="settings-form">
          <Field label="Program name"><input name="name" defaultValue={program.name} required /></Field>
          <Field label="Graduation grade"><input name="graduationGrade" type="number" min="1" max="12" defaultValue={program.graduationGrade} required /></Field>
          <Field label="Checkout agreement text" wide><textarea name="agreementTemplate" rows={9} defaultValue={program.agreementTemplate || DEFAULT_AGREEMENT_TEMPLATE} required /></Field>
          <div className="form-actions field-wide"><SubmitButton>Save program settings</SubmitButton></div>
        </form>
      </section>
      {canManageUsers ? <section className="settings-section full-section">
        <div className="section-heading"><div><h2>Staff access</h2><p>Local accounts are linked to staff people and limited by role.</p></div><UserCog size={19} /></div>
        <div className="access-grid">{staffUsers.map((staff) => <form action={updateStaffRoleAction} className="access-row" key={staff.id}><input type="hidden" name="userId" value={staff.id} /><div><strong>{staff.person.firstName} {staff.person.lastName}</strong><span>{staff.username}</span></div><select name="role" defaultValue={staff.role}>{Object.values(StaffRole).map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}</select><button className="button small secondary" type="submit">Update role</button></form>)}</div>
        {availableStaff.length ? <form action={createStaffAccountAction} className="settings-form top-gap"><Field label="Staff person"><select name="personId" required defaultValue=""><option value="" disabled>Choose staff person</option>{availableStaff.map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}</option>)}</select></Field><Field label="Username"><input name="username" minLength={3} required /></Field><Field label="Temporary password"><input name="password" type="password" minLength={12} required autoComplete="new-password" /></Field><Field label="Role"><select name="role" defaultValue={StaffRole.READ_ONLY}>{Object.values(StaffRole).map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}</select></Field><div className="form-actions field-wide"><SubmitButton>Create staff account</SubmitButton></div></form> : <p className="panel-empty">Every staff person already has an account. Add another staff-classified person from People first.</p>}
      </section> : null}
      <section className="settings-section">
        <div className="section-heading"><div><h2>Full backup</h2><p>SQLite plus every table as CSV and a manifest.</p></div></div>
        <div className="backup-action"><span className="large-icon"><DatabaseBackup size={24} /></span><div><strong>Download an encrypted archive</strong><span>The passphrase is never stored. Losing it makes the backup unrecoverable.</span></div></div>
        <form className="backup-form" action="/api/backup" method="post"><Field label="Backup passphrase"><input name="passphrase" type="password" minLength={12} autoComplete="new-password" required /></Field><button className="button primary" type="submit"><Download size={16} />Encrypted backup</button></form>
        <details className="advanced-backup"><summary>Advanced: readable ZIP export</summary><p>Contains unencrypted student records. Use only on encrypted district storage.</p><a className="button secondary" href="/api/backup"><Download size={16} />Readable ZIP</a></details>
        <DesktopRestore />
        <div className="backup-history">{backups.map((backup) => <div key={backup.id}><span>{backup.filename}</span><small>{formatDate(backup.createdAt)} · {backup.sha256.slice(0, 12)}…</small></div>)}</div>
      </section>
      <section className="settings-section">
        <div className="section-heading"><div><h2>Operating periods</h2><p>Historical records retain their original period.</p></div></div>
        <div className="period-list">{periods.map((period) => <div key={period.id}><div><strong>{period.label}</strong><span>{formatDate(period.startsAt)} to {formatDate(period.endsAt)}</span></div><StatusPill value={period.status} /></div>)}</div>
      </section>
      <section className="settings-section"><div className="section-heading"><div><h2>Runtime posture</h2><p>Inspect the local deployment boundary.</p></div></div><dl className="settings-list"><div><dt>Database</dt><dd>Local SQLite file</dd></div><div><dt>Runtime network calls</dt><dd>None enabled</dd></div><div><dt>External telemetry</dt><dd>Disabled</dd></div></dl></section>
      <section className="settings-section full-section"><div className="section-heading"><div><h2>Audit history</h2><p>Most recent 50 append-only events.</p></div><History size={19} /></div><div className="audit-list">{audit.map((entry) => <div key={entry.id}><span className="audit-action">{entry.action}</span><div><strong>{entry.changeSummary}</strong><span>{entry.entityType} · {entry.entityId}</span></div><div className="audit-meta"><strong>{entry.actor}</strong><span>{formatDate(entry.timestamp)}</span></div></div>)}</div></section>
    </div>
  </main>;
}
