import Link from "next/link";
import { Archive, ArrowLeft, BookOpenCheck, Download, ExternalLink, FilePlus2, Pencil, Plus, RotateCcw, SendToBack, TriangleAlert, Upload } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import {
  addLibraryComponentAction,
  addLibraryLinkAction,
  addPerformanceRecordAction,
  archiveLibraryItemAction,
  checkoutLibraryItemAction,
  closeLibraryLoanAction,
  removeLibraryResourceAction,
  resolveLibraryComponentAction,
  updateLibraryItemAction,
  uploadLibraryFileAction,
} from "@/app/library-actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { LibraryComponentStatus, LibraryItemStatus, LibraryLoanStatus, LibraryResourceKind } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, formatFinancialAmount, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

function inputDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function LibraryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_LIBRARY")) redirect("/today?error=Music%20library%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const [item, people, groups] = await Promise.all([
    db.libraryItem.findFirst({
      where: { id, programId: user.programId },
      include: {
        componentNotes: { orderBy: [{ resolvedAt: "asc" }, { notedAt: "desc" }] },
        loans: { include: { borrowerPerson: true, operatingPeriod: true }, orderBy: { checkedOutAt: "desc" } },
        performanceRecords: { include: { group: true, operatingPeriod: true }, orderBy: { performedAt: "desc" } },
        resources: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      },
    }),
    db.person.findMany({ where: { programId: user.programId, status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.group.findMany({ where: { programId: user.programId, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  ]);
  if (!item) notFound();
  const canManage = hasPermission(user, "MANAGE_LIBRARY");
  const activeLoan = item.loans.find((loan) => !loan.returnedAt && loan.status === LibraryLoanStatus.CHECKED_OUT);
  const activeIssues = item.componentNotes.filter((note) => !note.resolvedAt);
  const activeResources = item.resources.filter((resource) => resource.status === "ACTIVE");
  const today = new Date().toISOString().slice(0, 10);

  return <main className="content">
    <Link className="back-link" href="/library"><ArrowLeft size={16} />Music library</Link>
    <PageHeader eyebrow={item.category ?? "Whole score-and-parts set"} title={item.title} description={[item.composer, item.arranger ? `arr. ${item.arranger}` : null].filter(Boolean).join(" · ") || "Composer and arranger not set"} icon={BookOpenCheck} actions={canManage ? <details className="popover wide"><summary className="button secondary"><Pencil size={16} />Edit record</summary><form action={updateLibraryItemAction} className="popover-panel form-grid library-item-form"><input type="hidden" name="itemId" value={item.id} /><h3>Edit whole-set record</h3><Field label="Title" wide><input name="title" required defaultValue={item.title} /></Field><Field label="Composer"><input name="composer" defaultValue={item.composer ?? ""} /></Field><Field label="Arranger"><input name="arranger" defaultValue={item.arranger ?? ""} /></Field><Field label="Publisher"><input name="publisher" defaultValue={item.publisher ?? ""} /></Field><Field label="Grade"><input name="grade" defaultValue={item.grade ?? ""} /></Field><Field label="Category"><input name="category" defaultValue={item.category ?? ""} /></Field><Field label="Catalog number"><input name="catalogNumber" defaultValue={item.catalogNumber ?? ""} /></Field><Field label="Storage location"><input name="storageLocation" defaultValue={item.storageLocation ?? ""} /></Field><Field label="Acquired"><input name="acquisitionDate" type="date" defaultValue={inputDate(item.acquisitionDate)} /></Field><Field label="Acquisition source"><input name="acquisitionSource" defaultValue={item.acquisitionSource ?? ""} /></Field><Field label="Acquisition cost"><input name="acquisitionCost" type="number" min="0" step="0.01" defaultValue={item.acquisitionCost?.toString() ?? ""} /></Field><Field label="Comments" wide hint="Do not enter student information in library comments."><textarea name="comments" rows={3} defaultValue={item.comments ?? ""} /></Field><div className="form-actions field-wide"><SubmitButton>Save record</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...query} />
    <section className="asset-summary-band library-summary"><div><span>Status</span><StatusPill value={item.status} /></div><div><span>Grade</span><strong>{item.grade ?? "Not set"}</strong></div><div><span>Publisher</span><strong>{item.publisher ?? "Not set"}</strong></div><div><span>Location</span><strong>{item.storageLocation ?? "Not set"}</strong></div><div><span>Catalog number</span><strong>{item.catalogNumber ?? "Not set"}</strong></div></section>

    <div className="detail-grid library-detail-grid">
      <section className="detail-main">
        <div className="section-heading"><div><h2>Current loan</h2><p>The complete set moves as one item</p></div></div>
        {activeLoan ? <article className="assignment-callout library-loan-callout"><div><span className="avatar">{activeLoan.borrowerName.slice(0, 2).toUpperCase()}</span><span><strong>{activeLoan.borrowerName}</strong><small>Checked out {formatDate(activeLoan.checkedOutAt)} · {activeLoan.expectedReturnAt ? `Due ${formatDate(activeLoan.expectedReturnAt)}` : "No expected return"}</small></span></div>{canManage ? <details className="popover"><summary className="button primary"><RotateCcw size={16} />Close loan</summary><form action={closeLibraryLoanAction} className="popover-panel form-grid"><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="loanId" value={activeLoan.id} /><h3>Close whole-set loan</h3><Field label="Resolution"><select name="status" defaultValue={LibraryLoanStatus.RETURNED}><option value={LibraryLoanStatus.RETURNED}>Returned</option><option value={LibraryLoanStatus.LOST}>Lost</option></select></Field><Field label="Resolved date"><input name="returnedAt" type="date" defaultValue={today} required /></Field><Field label="Return note" wide><textarea name="notes" rows={2} defaultValue={activeLoan.notes ?? ""} /></Field><div className="form-actions field-wide"><SubmitButton>Close loan</SubmitButton></div></form></details> : null}</article> : item.status === LibraryItemStatus.AVAILABLE && canManage ? <form action={checkoutLibraryItemAction} className="work-panel form-grid library-checkout-form"><input type="hidden" name="itemId" value={item.id} /><Field label="Program person"><select name="borrowerPersonId" defaultValue=""><option value="">External borrower or organization</option>{people.map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}</option>)}</select></Field><Field label="External borrower"><input name="borrowerName" placeholder="School or director name" /></Field><Field label="Checkout date"><input name="checkedOutAt" type="date" defaultValue={today} required /></Field><Field label="Expected return"><input name="expectedReturnAt" type="date" /></Field><Field label="Loan notes" wide><textarea name="notes" rows={2} /></Field><div className="form-actions field-wide"><SubmitButton><SendToBack size={16} />Check out set</SubmitButton></div></form> : <div className="panel-empty bordered">{item.status === LibraryItemStatus.AVAILABLE ? "This set is available." : `This set cannot be loaned while its status is ${titleCase(item.status)}.`}</div>}

        <div className="section-heading top-gap"><div><h2>Missing or replaced components</h2><p>Part-level exceptions without inventorying every part</p></div>{canManage && item.status !== LibraryItemStatus.ARCHIVED ? <details className="popover"><summary className="button secondary"><Plus size={16} />Add issue</summary><form action={addLibraryComponentAction} className="popover-panel form-grid"><input type="hidden" name="itemId" value={item.id} /><h3>Record component issue</h3><Field label="Component"><input name="componentName" required placeholder="Flute 1 part" /></Field><Field label="Status"><select name="status" defaultValue={LibraryComponentStatus.MISSING}><option value={LibraryComponentStatus.MISSING}>Missing</option><option value={LibraryComponentStatus.DAMAGED}>Damaged</option></select></Field><Field label="Noted date"><input name="notedAt" type="date" defaultValue={today} required /></Field><Field label="Notes" wide><textarea name="notes" rows={2} /></Field><div className="form-actions field-wide"><SubmitButton>Add issue</SubmitButton></div></form></details> : null}</div>
        <div className="item-stack">{item.componentNotes.map((note) => <article className="component-row library-component-row" key={note.id}><div><strong>{note.componentName}</strong><small>{formatDate(note.notedAt)}{note.notes ? ` · ${note.notes}` : ""}</small></div><StatusPill value={note.status} />{note.resolvedAt ? <span className="muted-copy">Resolved {formatDate(note.resolvedAt)}</span> : canManage ? <form action={resolveLibraryComponentAction}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="componentNoteId" value={note.id} /><input type="hidden" name="resolvedAt" value={today} /><button className="button small secondary" type="submit">Mark replaced</button></form> : null}</article>)}{item.componentNotes.length === 0 ? <div className="panel-empty bordered">No missing or damaged component history.</div> : null}</div>

        <div className="section-heading top-gap"><div><h2>Performance history</h2><p>When and where this music was performed</p></div>{canManage ? <details className="popover wide"><summary className="button secondary"><Plus size={16} />Add performance</summary><form action={addPerformanceRecordAction} className="popover-panel form-grid"><input type="hidden" name="itemId" value={item.id} /><h3>Add performance</h3><Field label="Performance or event" wide><input name="eventName" required /></Field><Field label="Date"><input name="performedAt" type="date" defaultValue={today} required /></Field><Field label="Group"><select name="groupId" defaultValue=""><option value="">No group selected</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field><Field label="Conductor"><input name="conductor" /></Field><Field label="Notes" wide><textarea name="notes" rows={2} /></Field><div className="form-actions field-wide"><SubmitButton>Add performance</SubmitButton></div></form></details> : null}</div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Conductor</th><th>Period</th></tr></thead><tbody>{item.performanceRecords.map((record) => <tr key={record.id}><td>{formatDate(record.performedAt)}</td><td>{record.eventName}{record.notes ? <small className="cell-subtitle">{record.notes}</small> : null}</td><td>{record.group?.name ?? "—"}</td><td>{record.conductor ?? "—"}</td><td>{record.operatingPeriod.label}</td></tr>)}</tbody></table>{item.performanceRecords.length === 0 ? <div className="panel-empty">No performance history.</div> : null}</div>

        <div className="section-heading top-gap"><div><h2>Digital resources</h2><p>Managed local files and approved HTTPS links</p></div>{canManage && item.status !== LibraryItemStatus.ARCHIVED ? <div className="form-actions"><details className="popover"><summary className="button secondary"><Upload size={16} />Upload</summary><form action={uploadLibraryFileAction} className="popover-panel form-grid"><input type="hidden" name="itemId" value={item.id} /><h3>Store local file</h3><Field label="Label"><input name="label" placeholder="Full score PDF" /></Field><Field label="File" wide hint="Maximum 25 MB. Executables and active web files are blocked."><input name="file" type="file" required /></Field><label className="check-row field-wide"><input name="copyrightAcknowledged" type="checkbox" required /><span>I confirm the program is permitted to retain and use this file.</span></label><div className="form-actions field-wide"><SubmitButton>Store file</SubmitButton></div></form></details><details className="popover"><summary className="button secondary"><ExternalLink size={16} />Add link</summary><form action={addLibraryLinkAction} className="popover-panel form-grid"><input type="hidden" name="itemId" value={item.id} /><h3>Add external resource</h3><Field label="Label"><input name="label" required /></Field><Field label="HTTPS link" wide><input name="externalUrl" type="url" required placeholder="Secure resource link" /></Field><label className="check-row field-wide"><input name="copyrightAcknowledged" type="checkbox" required /><span>I confirm the program is permitted to retain and use this link.</span></label><div className="form-actions field-wide"><SubmitButton>Add link</SubmitButton></div></form></details></div> : null}</div>
        <div className="resource-list">{activeResources.map((resource) => <article key={resource.id}><span className="resource-icon">{resource.kind === LibraryResourceKind.LOCAL_FILE ? <FilePlus2 size={18} /> : <ExternalLink size={18} />}</span><div><strong>{resource.label}</strong><small>{resource.kind === LibraryResourceKind.LOCAL_FILE ? `${resource.fileName} · ${fileSize(resource.byteSize)}` : resource.externalUrl}</small></div>{resource.kind === LibraryResourceKind.LOCAL_FILE ? <a className="button small secondary" href={`/api/library/files/${resource.id}`}><Download size={15} />Download</a> : <a className="button small secondary" href={resource.externalUrl ?? "#"} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a>}{canManage ? <form action={removeLibraryResourceAction}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="resourceId" value={resource.id} /><button className="icon-button danger-icon" type="submit" aria-label={`Remove ${resource.label}`} title="Remove resource"><Archive size={15} /></button></form> : null}</article>)}{activeResources.length === 0 ? <div className="panel-empty bordered">No digital resources attached.</div> : null}</div>

        <div className="section-heading top-gap"><div><h2>Loan history</h2><p>{item.loans.length} complete-set loans</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Borrower</th><th>Checked out</th><th>Expected</th><th>Closed</th><th>Status</th><th>Period</th></tr></thead><tbody>{item.loans.map((loan) => <tr key={loan.id}><td>{loan.borrowerPerson ? <Link className="row-link" href={`/roster/${loan.borrowerPerson.id}`}>{loan.borrowerName}</Link> : loan.borrowerName}{loan.notes ? <small className="cell-subtitle">{loan.notes}</small> : null}</td><td>{formatDate(loan.checkedOutAt)}</td><td>{formatDate(loan.expectedReturnAt)}</td><td>{formatDate(loan.returnedAt)}</td><td><StatusPill value={loan.status} /></td><td>{loan.operatingPeriod.label}</td></tr>)}</tbody></table>{item.loans.length === 0 ? <div className="panel-empty">No loan history.</div> : null}</div>
      </section>

      <aside className="detail-aside library-aside"><h3>Set record</h3><dl className="fact-list"><div><dt>Catalog number</dt><dd>{item.catalogNumber ?? "Not set"}</dd></div><div><dt>Acquired</dt><dd>{formatDate(item.acquisitionDate)}</dd></div><div><dt>Source</dt><dd>{item.acquisitionSource ?? "Not set"}</dd></div><div><dt>Cost</dt><dd>{item.acquisitionCost ? formatFinancialAmount(item.acquisitionCost) : "Not set"}</dd></div><div><dt>Performances</dt><dd>{item.performanceRecords.length}</dd></div><div><dt>Resources</dt><dd>{activeResources.length}</dd></div></dl>{item.comments ? <div className="notes-block"><span>Library comments</span><p>{item.comments}</p></div> : null}{activeIssues.length ? <div className="library-warning"><TriangleAlert size={18} /><div><strong>Set incomplete</strong><span>{activeIssues.length} unresolved component issue{activeIssues.length === 1 ? "" : "s"}</span></div></div> : null}{canManage && item.status !== LibraryItemStatus.ARCHIVED ? <form action={archiveLibraryItemAction} className="archive-action"><input type="hidden" name="itemId" value={item.id} /><button className="button danger" type="submit"><Archive size={16} />Archive record</button><small>Archiving removes this set from active work while preserving all history.</small></form> : null}</aside>
    </div>
  </main>;
}
