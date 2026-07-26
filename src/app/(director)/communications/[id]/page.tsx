import Link from "next/link";
import { ArrowLeft, Ban, Clock3, Mail, Paperclip, Pencil, RotateCcw, Send, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { cancelAnnouncementAction, confirmOverdueAnnouncementAction, sendAnnouncementAction } from "@/app/actions";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { AnnouncementRecipientStatus, AnnouncementStatus, CommunicationJobStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getProgram } from "@/lib/program-context";

export const metadata = { title: "Announcement review" };
export const dynamic = "force-dynamic";

function reasons(value: string) {
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

export default async function AnnouncementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_COMMUNICATIONS")) redirect("/today");
  const db = getDb();
  const program = await getProgram(db);
  const announcement = await db.announcement.findFirst({
    where: { id, programId: program.id },
    include: {
      emailConnection: true,
      audienceTargets: { include: { group: true, person: true } },
      recipients: { include: { attempts: { orderBy: { attemptedAt: "desc" }, take: 1 } }, orderBy: [{ status: "asc" }, { displayNameSnapshot: "asc" }] },
      attachments: { orderBy: { fileName: "asc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!announcement) notFound();
  const canManage = hasPermission(user, "MANAGE_COMMUNICATIONS");
  const latestJob = announcement.jobs[0];
  const counts = new Map<AnnouncementRecipientStatus, number>();
  for (const recipient of announcement.recipients) counts.set(recipient.status, (counts.get(recipient.status) || 0) + 1);
  const eligible = announcement.recipients.filter((recipient) => recipient.permissionResult === AnnouncementRecipientStatus.ELIGIBLE).length;
  const failed = counts.get(AnnouncementRecipientStatus.FAILED) || 0;
  const sent = counts.get(AnnouncementRecipientStatus.SENT) || 0;
  const finalStatus = latestJob?.status === CommunicationJobStatus.OVERDUE ? "OVERDUE" : announcement.status;
  const maySend = canManage && (announcement.status === AnnouncementStatus.READY || announcement.status === AnnouncementStatus.FAILED || announcement.status === AnnouncementStatus.PARTIAL || latestJob?.status === CommunicationJobStatus.FAILED);
  const mayCancel = canManage && announcement.status !== AnnouncementStatus.SENT && announcement.status !== AnnouncementStatus.SENDING && announcement.status !== AnnouncementStatus.CANCELED;
  const mayEdit = canManage && sent === 0 && (announcement.status === AnnouncementStatus.READY || announcement.status === AnnouncementStatus.SCHEDULED);

  return <main className="content">
    <Link className="back-link" href="/communications"><ArrowLeft size={15} />Communications</Link>
    <PageHeader eyebrow={`Created ${formatDate(announcement.createdAt)} · ${announcement.createdBy}`} title={announcement.subject} description={`From ${announcement.emailConnection?.fromAddress || "unconfigured shared mailbox"}`} icon={Mail} actions={<>{mayEdit ? <Link className="button secondary" href={`/communications/${announcement.id}/edit`}><Pencil size={15} />Edit</Link> : null}<StatusPill value={finalStatus} /></>} />
    <FlashMessage {...query} />
    {latestJob?.status === CommunicationJobStatus.OVERDUE ? <section className="connection-banner overdue-banner"><Clock3 size={20} /><div><strong>Scheduled delivery missed while Band Office was closed</strong><span>{latestJob.lastError}</span></div>{canManage ? <form action={confirmOverdueAnnouncementAction}><input type="hidden" name="announcementId" value={announcement.id} /><SubmitButton>Confirm and send</SubmitButton></form> : null}</section> : null}
    <section className="metric-strip compact-metrics communication-metrics"><div><span>Eligible</span><strong>{eligible}</strong><small>Deduplicated destinations</small></div><div><span>Accepted</span><strong>{sent}</strong><small>Provider accepted</small></div><div><span>Failed</span><strong>{failed}</strong><small>Retryable destinations</small></div></section>
    <div className="announcement-layout">
      <div className="announcement-main">
        <section className="work-panel message-preview"><div className="panel-heading"><div><Mail size={18} /><h2>Message</h2></div></div><div className="message-subject">{announcement.subject}</div><div className="message-body">{announcement.body}</div>{announcement.attachments.length ? <div className="attachment-list"><strong><Paperclip size={14} />Attachments</strong>{announcement.attachments.map((attachment) => <span key={attachment.id}>{attachment.fileName}<small>{(attachment.byteSize / 1024).toFixed(1)} KB · {attachment.mimeType}</small></span>)}</div> : null}</section>
        <section className="work-panel top-gap"><div className="panel-heading"><div><UsersRound size={18} /><h2>Audience snapshot</h2></div><span className="muted-copy">{announcement.recipients.length} destinations</span></div><div className="data-table-wrap top-gap"><table className="data-table recipient-table"><thead><tr><th>Recipient</th><th>Included because</th><th>Permission</th><th>Delivery</th><th>Attempts</th></tr></thead><tbody>{announcement.recipients.map((recipient) => <tr key={recipient.id}><td><strong>{recipient.displayNameSnapshot}</strong><small className="cell-subtitle">{recipient.emailSnapshot || "No email address"}</small></td><td><div className="reason-list">{reasons(recipient.inclusionReasonsJson).map((reason) => <span key={reason}>{reason}</span>)}</div></td><td><StatusPill value={recipient.permissionResult} /></td><td><StatusPill value={recipient.status} />{recipient.lastError ? <small className="delivery-error">{recipient.lastError}</small> : null}</td><td>{recipient.attemptCount}{recipient.lastAttemptAt ? <small className="cell-subtitle">{formatDate(recipient.lastAttemptAt)}</small> : null}</td></tr>)}</tbody></table></div></section>
      </div>
      <aside className="detail-aside announcement-aside"><h3>Release control</h3><dl className="fact-list"><div><dt>Status</dt><dd><StatusPill value={finalStatus} /></dd></div><div><dt>Scheduled</dt><dd>{announcement.scheduledAt ? formatDate(announcement.scheduledAt) : "No"}</dd></div><div><dt>Audience frozen</dt><dd>{announcement.audienceResolvedAt ? formatDate(announcement.audienceResolvedAt) : "No"}</dd></div><div><dt>Sent</dt><dd>{announcement.sentAt ? formatDate(announcement.sentAt) : "No"}</dd></div></dl><div className="release-actions">{maySend ? <form action={sendAnnouncementAction}><input type="hidden" name="announcementId" value={announcement.id} /><SubmitButton>{failed ? <><RotateCcw size={16} />Retry {failed} failed</> : <><Send size={16} />Send to {eligible}</>}</SubmitButton></form> : null}{mayCancel ? <form action={cancelAnnouncementAction}><input type="hidden" name="announcementId" value={announcement.id} /><SubmitButton className="button secondary"><Ban size={16} />Cancel announcement</SubmitButton></form> : null}</div><p className="privacy-copy">Provider acceptance confirms SMTP handoff, not final inbox delivery. Recipient addresses and message content are excluded from audit diffs.</p></aside>
    </div>
  </main>;
}
