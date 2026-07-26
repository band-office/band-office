import Link from "next/link";
import { ArrowLeft, MailCheck, Server, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { saveEmailConnectionAction, testEmailConnectionAction } from "@/app/actions";
import { EmailCredentialControl } from "@/components/email-credential-control";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getProgram } from "@/lib/program-context";

export const metadata = { title: "Email settings" };
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [query, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "MANAGE_COMMUNICATIONS")) redirect("/communications");
  const db = getDb();
  const program = await getProgram(db);
  const connection = await db.emailConnection.findUnique({ where: { programId: program.id } });

  return <main className="content narrow-content">
    <Link className="back-link" href="/communications"><ArrowLeft size={15} />Communications</Link>
    <PageHeader title="Shared mailbox" description="One approved sender identity for program announcements." icon={Server} actions={connection ? <StatusPill value={connection.status} /> : undefined} />
    <FlashMessage {...query} />
    <section className="settings-section"><div className="section-heading"><div><h2>SMTP connection</h2><p>Google and Microsoft OAuth adapters remain separate connector work.</p></div></div><form action={saveEmailConnectionAction} className="form-grid"><Field label="Sender name"><input name="fromName" required defaultValue={connection?.fromName || program.name} /></Field><Field label="From address"><input name="fromAddress" type="email" required defaultValue={connection?.fromAddress || ""} /></Field><Field label="Reply-to address"><input name="replyTo" type="email" defaultValue={connection?.replyTo || ""} /></Field><Field label="SMTP username"><input name="authUsername" defaultValue={connection?.authUsername || ""} /></Field><Field label="SMTP host"><input name="smtpHost" required defaultValue={connection?.smtpHost || ""} placeholder="smtp.school.org" /></Field><Field label="SMTP port"><input name="smtpPort" type="number" min={1} max={65535} required defaultValue={connection?.smtpPort || 587} /></Field><label className="check-control field-wide"><input name="smtpSecure" type="checkbox" defaultChecked={connection?.smtpSecure || false} /><span><strong>Implicit TLS</strong><small>Use for port 465. Port 587 normally upgrades with STARTTLS.</small></span></label><div className="form-actions field-wide"><SubmitButton>Save connection</SubmitButton></div></form></section>
    <section className="settings-section"><div className="section-heading"><div><h2>SMTP credential</h2><p>The password is never written to Band Office records or backups.</p></div><ShieldCheck size={19} /></div><EmailCredentialControl environmentCredential={Boolean(process.env.BANDOS_SMTP_PASSWORD)} /></section>
    <section className="settings-section verify-section"><div><MailCheck size={20} /><span><strong>Connection verification</strong><small>{connection?.lastVerifiedAt ? `Last verified ${formatDate(connection.lastVerifiedAt)}` : "Not verified"}{connection?.lastError ? ` · ${connection.lastError}` : ""}</small></span></div><form action={testEmailConnectionAction}><SubmitButton className="button secondary" disabled={!connection}>Verify connection</SubmitButton></form></section>
  </main>;
}
