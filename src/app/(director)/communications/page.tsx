import Link from "next/link";
import { AlertTriangle, Clock3, Mail, MailCheck, Plus, Send, Settings2, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { saveEmailTemplateAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { AnnouncementRecipientStatus, AnnouncementStatus, CommunicationJobStatus, EmailConnectionStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getProgramContext } from "@/lib/program-context";

export const metadata = { title: "Email communications" };
export const dynamic = "force-dynamic";

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_COMMUNICATIONS")) redirect("/today?error=Communication%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const { program, operatingPeriod } = await getProgramContext(db);
  const canManage = hasPermission(user, "MANAGE_COMMUNICATIONS");
  const [connection, announcements, templates, scheduled, failures, sentThirtyDays, contactIssues] = await Promise.all([
    db.emailConnection.findUnique({ where: { programId: program.id } }),
    db.announcement.findMany({ where: { programId: program.id }, include: { _count: { select: { recipients: true, attachments: true } }, recipients: { select: { status: true } }, jobs: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.emailTemplate.findMany({ where: { programId: program.id }, orderBy: { name: "asc" } }),
    db.announcement.count({ where: { programId: program.id, status: AnnouncementStatus.SCHEDULED } }),
    db.announcementRecipient.count({ where: { announcement: { programId: program.id }, status: AnnouncementRecipientStatus.FAILED } }),
    db.announcement.count({ where: { programId: program.id, status: { in: [AnnouncementStatus.SENT, AnnouncementStatus.PARTIAL] }, sentAt: { gte: operatingPeriod.startsAt } } }),
    db.emailContactState.count({ where: { programId: program.id, status: { not: "ENABLED" } } }),
  ]);
  const overdue = announcements.filter((announcement) => announcement.jobs[0]?.status === CommunicationJobStatus.OVERDUE).length;

  return <main className="content">
    <PageHeader eyebrow={`Current period · ${operatingPeriod.label}`} title="Email communications" description="Shared-mailbox announcements with explicit audiences and per-recipient delivery history." icon={Mail} actions={<>{canManage ? <Link className="button primary" href="/communications/new"><Plus size={16} />Compose</Link> : null}<Link className="icon-button" href="/communications/settings" aria-label="Email settings" title="Email settings"><Settings2 size={17} /></Link></>} />
    <FlashMessage {...params} />
    {connection?.status !== EmailConnectionStatus.VERIFIED ? <section className="connection-banner"><AlertTriangle size={20} /><div><strong>Shared mailbox not verified</strong><span>Complete sender setup before releasing an announcement.</span></div>{canManage ? <Link className="button secondary" href="/communications/settings">Configure</Link> : null}</section> : null}
    <section className="metric-strip"><div><span>Scheduled</span><strong>{scheduled}</strong><small>{overdue ? `${overdue} awaiting confirmation` : "Queue clear"}</small></div><div><span>Sent this period</span><strong>{sentThirtyDays}</strong><small>Announcements</small></div><div><span>Delivery failures</span><strong>{failures}</strong><small>Retryable destinations</small></div><div><span>Contact holds</span><strong>{contactIssues}</strong><small><Link className="text-link" href="/communications/contacts">Review contacts</Link></small></div></section>
    <div className="dashboard-grid communications-grid">
      <section className="work-panel span-2"><div className="panel-heading"><div><Send size={18} /><h2>Announcement history</h2></div><span className="muted-copy">{announcements.length} recent</span></div><div className="data-table-wrap top-gap"><table className="data-table"><thead><tr><th>Created</th><th>Subject</th><th>Status</th><th>Audience</th><th>Delivery</th><th aria-label="Open" /></tr></thead><tbody>{announcements.map((announcement) => { const sent = announcement.recipients.filter((recipient) => recipient.status === AnnouncementRecipientStatus.SENT).length; const failed = announcement.recipients.filter((recipient) => recipient.status === AnnouncementRecipientStatus.FAILED).length; return <tr key={announcement.id}><td>{formatDate(announcement.createdAt)}</td><td><Link className="primary-cell compact-primary" href={`/communications/${announcement.id}`}><span className="avatar"><Mail size={15} /></span><span><strong>{announcement.subject}</strong><small>{announcement.createdBy}{announcement._count.attachments ? ` · ${announcement._count.attachments} attachments` : ""}</small></span></Link></td><td><StatusPill value={announcement.jobs[0]?.status === CommunicationJobStatus.OVERDUE ? "OVERDUE" : announcement.status} /></td><td>{announcement._count.recipients} destinations</td><td>{sent ? `${sent} sent` : "Not sent"}{failed ? ` · ${failed} failed` : ""}</td><td><Link className="row-link" href={`/communications/${announcement.id}`}>Open</Link></td></tr>; })}</tbody></table>{announcements.length === 0 ? <div className="panel-empty">No announcements yet.</div> : null}</div></section>
      <section className="work-panel"><div className="panel-heading"><div><MailCheck size={18} /><h2>Mailbox</h2></div></div><dl className="fact-list top-gap"><div><dt>Status</dt><dd><StatusPill value={connection?.status || "DISCONNECTED"} /></dd></div><div><dt>From</dt><dd>{connection?.fromAddress || "Not configured"}</dd></div><div><dt>Reply to</dt><dd>{connection?.replyTo || connection?.fromAddress || "—"}</dd></div><div><dt>Verified</dt><dd>{connection?.lastVerifiedAt ? formatDate(connection.lastVerifiedAt) : "Never"}</dd></div></dl></section>
      <section className="work-panel span-2"><div className="panel-heading"><div><UsersRound size={18} /><h2>Templates</h2></div>{canManage ? <details className="popover"><summary className="button secondary"><Plus size={15} />New template</summary><form action={saveEmailTemplateAction} className="popover-panel form-grid"><h3>New email template</h3><Field label="Name" wide><input name="name" required /></Field><Field label="Subject" wide><input name="subject" required maxLength={200} /></Field><Field label="Message" wide><textarea name="body" rows={7} required /></Field><div className="form-actions field-wide"><SubmitButton>Save template</SubmitButton></div></form></details> : null}</div><div className="template-list">{templates.map((template) => <Link href={`/communications/new?template=${template.id}`} key={template.id}><span><strong>{template.name}</strong><small>{template.subject}</small></span><Mail size={15} /></Link>)}{templates.length === 0 ? <div className="panel-empty">No reusable templates saved.</div> : null}</div></section>
      <section className="work-panel"><div className="panel-heading"><div><Clock3 size={18} /><h2>Queue</h2></div></div><div className="queue-summary"><strong>{scheduled}</strong><span>scheduled announcements</span><strong>{overdue}</strong><span>overdue confirmations</span><strong>{failures}</strong><span>failed destinations</span></div></section>
    </div>
  </main>;
}
