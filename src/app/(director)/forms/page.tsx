import Link from "next/link";
import { ClipboardList, FileCheck2, FileClock, Files, Plus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createFormTemplateAction } from "@/app/forms-actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { FormRequestStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [query, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_FORMS")) redirect("/today?error=Forms%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const [templates, campaigns, counts] = await Promise.all([
    db.formTemplate.findMany({ where: { programId: user.programId, archived: false }, include: { versions: { include: { _count: { select: { questions: true, campaigns: true } } }, orderBy: { version: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    db.formCampaign.findMany({ where: { programId: user.programId }, include: { templateVersion: { include: { template: true } }, requests: { select: { status: true } }, _count: { select: { requests: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.formRequest.groupBy({ by: ["status"], where: { campaign: { programId: user.programId } }, _count: { _all: true } }),
  ]);
  const count = (status: FormRequestStatus) => counts.find((row) => row.status === status)?._count._all ?? 0;
  const completed = count(FormRequestStatus.COMPLETE);
  const outstanding = count(FormRequestStatus.OUTSTANDING) + count(FormRequestStatus.IN_PROGRESS);
  const canManage = hasPermission(user, "MANAGE_FORMS");

  return <main className="content">
    <PageHeader eyebrow="Routine information collection" title="Forms" description="Versioned templates, recipient tracking, response files, reminders, exports, and retention." icon={Files} actions={canManage ? <details className="popover wide"><summary className="button primary"><Plus size={17} />New template</summary><form action={createFormTemplateAction} className="popover-panel form-grid"><h3>Create form template</h3><Field label="Template name" wide hint="Internal name used by staff."><input name="name" required autoFocus /></Field><Field label="Form title" wide><input name="title" required /></Field><Field label="Description" wide><textarea name="description" rows={2} /></Field><Field label="Instructions" wide><textarea name="instructions" rows={4} /></Field><Field label="Retention days" wide hint="Leave blank to retain responses until a director deliberately removes them."><input name="retentionDays" type="number" min="1" max="3650" /></Field><div className="form-actions field-wide"><SubmitButton>Create draft</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...query} />
    <section className="metric-strip forms-metrics"><div><span>Active templates</span><strong>{templates.length}</strong><small>Revision controlled</small></div><div><span>Request campaigns</span><strong>{campaigns.length}</strong><small>Current history shown</small></div><div><span>Outstanding</span><strong>{outstanding}</strong><small>Not yet complete</small></div><div><span>Completed</span><strong>{completed}</strong><small>{count(FormRequestStatus.WAIVED)} waived</small></div></section>

    <div className="dashboard-grid forms-dashboard-grid">
      <section className="work-panel span-2"><div className="panel-heading"><div><ClipboardList size={18} /><h2>Request campaigns</h2></div><span className="muted-copy">Recipient snapshots</span></div><div className="data-table-wrap top-gap"><table className="data-table"><thead><tr><th>Campaign</th><th>Form</th><th>Audience</th><th>Due</th><th>Progress</th><th aria-label="Open" /></tr></thead><tbody>{campaigns.map((campaign) => { const done = campaign.requests.filter((request) => request.status === FormRequestStatus.COMPLETE || request.status === FormRequestStatus.WAIVED).length; return <tr key={campaign.id}><td><Link className="primary-cell compact-primary" href={`/forms/campaigns/${campaign.id}`}><span className="avatar"><UsersRound size={15} /></span><span><strong>{campaign.name}</strong><small>Created {formatDate(campaign.createdAt)}</small></span></Link></td><td>{campaign.templateVersion.template.name}<small className="cell-subtitle">Version {campaign.templateVersion.version}</small></td><td>{campaign.audienceSummary}<small className="cell-subtitle">{campaign.recipientMode.toLowerCase()}</small></td><td>{formatDate(campaign.dueAt)}</td><td><strong>{done}/{campaign._count.requests}</strong><small className="cell-subtitle">complete or waived</small></td><td><Link className="row-link" href={`/forms/campaigns/${campaign.id}`}>Open</Link></td></tr>; })}</tbody></table>{campaigns.length === 0 ? <div className="empty-state"><FileClock size={24} /><strong>No form requests yet</strong><span>Publish a template, then assign it to students, guardians, or both.</span></div> : null}</div></section>

      <section className="work-panel span-2"><div className="panel-heading"><div><FileCheck2 size={18} /><h2>Templates</h2></div><span className="muted-copy">{templates.length} active</span></div><div className="template-list forms-template-list">{templates.map((template) => { const latest = template.versions[0]; const published = template.versions.find((version) => version.status === "PUBLISHED"); return <Link href={`/forms/templates/${template.id}`} key={template.id}><span><strong>{template.name}</strong><small>{latest ? `Version ${latest.version} · ${latest._count.questions} questions` : "No version"}{published ? ` · ${published._count.campaigns} campaigns` : " · not published"}</small></span>{latest ? <StatusPill value={latest.status} /> : null}</Link>; })}{templates.length === 0 ? <div className="panel-empty">No templates. Create the first draft to begin.</div> : null}</div></section>
    </div>
  </main>;
}
