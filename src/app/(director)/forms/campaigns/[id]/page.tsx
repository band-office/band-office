import Link from "next/link";
import { ArrowLeft, Download, FileCheck2, FilePenLine, Mail, ShieldX, Trash2, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createFormReminderAction, purgeExpiredFormResponsesAction, waiveFormRequestAction } from "@/app/forms-actions";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { FormRequestStatus, FormResponseStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FormCampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; status?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_FORMS")) redirect("/today");
  const campaign = await getDb().formCampaign.findFirst({ where: { id, programId: user.programId }, include: { operatingPeriod: true, templateVersion: { include: { template: true } }, requests: { include: { recipientPerson: true, subjectPerson: true, response: true, reminders: { orderBy: { createdAt: "desc" } }, _count: { select: { reminders: true } } }, orderBy: [{ status: "asc" }, { subjectPerson: { lastName: "asc" } }, { recipientPerson: { lastName: "asc" } }] } } });
  if (!campaign) notFound();
  const statusFilter = query.status && Object.values(FormRequestStatus).includes(query.status as FormRequestStatus) ? query.status as FormRequestStatus : null;
  const requests = statusFilter ? campaign.requests.filter((request) => request.status === statusFilter) : campaign.requests;
  const count = (status: FormRequestStatus) => campaign.requests.filter((request) => request.status === status).length;
  const outstanding = count(FormRequestStatus.OUTSTANDING) + count(FormRequestStatus.IN_PROGRESS);
  const expired = campaign.requests.filter((request) => request.retentionExpiresAt && request.retentionExpiresAt <= new Date() && request.response?.status === FormResponseStatus.SUBMITTED).length;
  const canManage = hasPermission(user, "MANAGE_FORMS");
  const canRecord = hasPermission(user, "RECORD_FORM_RESPONSES");
  const canExport = hasPermission(user, "EXPORT_DATA");

  return <main className="content">
    <Link className="back-link" href="/forms"><ArrowLeft size={16} />Forms</Link>
    <PageHeader eyebrow={`${campaign.templateVersion.template.name} · version ${campaign.templateVersion.version}`} title={campaign.name} description={`${campaign.audienceSummary} · ${titleCase(campaign.recipientMode)} · ${campaign.operatingPeriod.label}`} icon={UsersRound} actions={<>{canExport ? <a className="button secondary" href={`/api/export/form-responses?campaignId=${campaign.id}`}><Download size={16} />Responses CSV</a> : null}{canManage && outstanding ? <form action={createFormReminderAction}><input type="hidden" name="campaignId" value={campaign.id} /><button className="button primary" type="submit"><Mail size={16} />Draft reminder</button></form> : null}</>} />
    <FlashMessage {...query} />
    <section className="metric-strip forms-metrics"><div><span>Recipients</span><strong>{campaign.requests.length}</strong><small>Snapshot at assignment</small></div><div><span>Complete</span><strong>{count(FormRequestStatus.COMPLETE)}</strong><small>{count(FormRequestStatus.WAIVED)} waived</small></div><div><span>Outstanding</span><strong>{outstanding}</strong><small>{count(FormRequestStatus.IN_PROGRESS)} in progress</small></div><div><span>Due</span><strong>{formatDate(campaign.dueAt)}</strong><small>{expired ? `${expired} response${expired === 1 ? "" : "s"} ready to purge` : "Retention current"}</small></div></section>

    <div className="campaign-toolbar"><div className="segmented-filter"><Link className={!statusFilter ? "active" : ""} href={`/forms/campaigns/${campaign.id}`}>All</Link>{Object.values(FormRequestStatus).map((status) => <Link className={statusFilter === status ? "active" : ""} href={`/forms/campaigns/${campaign.id}?status=${status}`} key={status}>{titleCase(status)} ({count(status)})</Link>)}</div>{canManage && expired ? <form action={purgeExpiredFormResponsesAction}><input type="hidden" name="campaignId" value={campaign.id} /><button className="button danger" type="submit"><Trash2 size={15} />Purge {expired} expired</button></form> : null}</div>

    <div className="data-table-wrap"><table className="data-table form-request-table"><thead><tr><th>Student</th><th>Recipient</th><th>Status</th><th>Completed</th><th>Retention</th><th>Reminders</th><th aria-label="Actions" /></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><Link className="row-link" href={`/roster/${request.subjectPerson.id}`}>{request.subjectPerson.lastName}, {request.subjectPerson.firstName}</Link></td><td>{request.recipientPerson.lastName}, {request.recipientPerson.firstName}{request.recipientPersonId === request.subjectPersonId ? <small className="cell-subtitle">student response</small> : <small className="cell-subtitle">guardian response</small>}</td><td><StatusPill value={request.response?.status === FormResponseStatus.PURGED ? "PURGED" : request.status} /></td><td>{formatDate(request.completedAt)}{request.response ? <small className="cell-subtitle">by {request.response.recordedBy}</small> : null}</td><td>{request.retentionExpiresAt ? formatDate(request.retentionExpiresAt) : "Manual"}</td><td>{request._count.reminders}{request.reminders[0] ? <small className="cell-subtitle">Last {formatDate(request.reminders[0].createdAt)}</small> : null}</td><td><div className="row-actions">{canRecord && request.status !== FormRequestStatus.WAIVED && request.response?.status !== FormResponseStatus.PURGED ? <Link className="button small secondary" href={`/forms/requests/${request.id}`}><FilePenLine size={14} />{request.status === FormRequestStatus.COMPLETE ? "Review" : "Record"}</Link> : request.response?.status === FormResponseStatus.PURGED ? <span className="muted-copy">Content purged</span> : null}{canManage && (request.status === FormRequestStatus.OUTSTANDING || request.status === FormRequestStatus.IN_PROGRESS) ? <form action={waiveFormRequestAction}><input type="hidden" name="campaignId" value={campaign.id} /><input type="hidden" name="requestId" value={request.id} /><button className="icon-button" type="submit" aria-label="Waive request" title="Waive request"><ShieldX size={15} /></button></form> : null}</div></td></tr>)}</tbody></table>{requests.length === 0 ? <div className="empty-state"><FileCheck2 size={24} /><strong>No requests in this view</strong><span>Choose another status filter.</span></div> : null}</div>
    <section className="form-cycle-note"><strong>Current collection path</strong><span>Print or distribute the form through your approved school process, then record returned answers here. Student and guardian self-service will use these same request records when the portal release is built.</span></section>
  </main>;
}
