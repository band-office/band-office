import Link from "next/link";
import { BookCopy, Clock3, Music2, Plus, Search, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import { createLibraryItemAction } from "@/app/library-actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { LibraryItemStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";

export const metadata = { title: "Music Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; success?: string; error?: string }> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_LIBRARY")) redirect("/today?error=Music%20library%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const program = await getProgram(db);
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const category = params.category ?? "";
  const canManage = hasPermission(user, "MANAGE_LIBRARY");
  const [items, categoryRows, totals] = await Promise.all([
    db.libraryItem.findMany({
      where: {
        programId: program.id,
        ...(status ? { status: status as LibraryItemStatus } : {}),
        ...(category ? { category } : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { composer: { contains: q } }, { arranger: { contains: q } }, { publisher: { contains: q } }, { catalogNumber: { contains: q } }] } : {}),
      },
      include: {
        loans: { where: { returnedAt: null, status: "CHECKED_OUT" }, orderBy: { checkedOutAt: "desc" }, take: 1 },
        componentNotes: { where: { resolvedAt: null, status: { in: ["MISSING", "DAMAGED"] } }, select: { id: true } },
        _count: { select: { performanceRecords: true, resources: true } },
      },
      orderBy: [{ title: "asc" }, { composer: "asc" }],
    }),
    db.libraryItem.findMany({ where: { programId: program.id, category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    db.libraryItem.groupBy({ by: ["status"], where: { programId: program.id }, _count: { _all: true } }),
  ]);
  const count = (value: LibraryItemStatus) => totals.find((row) => row.status === value)?._count._all ?? 0;
  const overdue = items.filter((item) => item.loans[0]?.expectedReturnAt && item.loans[0].expectedReturnAt < new Date()).length;

  return <main className="content">
    <PageHeader eyebrow="Whole score-and-parts sets" title="Music library" description="Catalog, loans, missing parts, resources, and performance history." icon={BookCopy} actions={canManage ? <><Link className="button secondary" href="/library/import"><Upload size={16} />Import CutTime library</Link><details className="popover wide"><summary className="button primary"><Plus size={17} />Add music</summary><form action={createLibraryItemAction} className="popover-panel form-grid library-item-form"><h3>New whole-set record</h3><Field label="Title" wide><input name="title" required autoFocus /></Field><Field label="Composer"><input name="composer" /></Field><Field label="Arranger"><input name="arranger" /></Field><Field label="Publisher"><input name="publisher" /></Field><Field label="Grade"><input name="grade" placeholder="2.5" /></Field><Field label="Category"><input name="category" placeholder="Concert band" /></Field><Field label="Catalog number"><input name="catalogNumber" /></Field><Field label="Storage location"><input name="storageLocation" placeholder="Shelf B-4" /></Field><Field label="Acquired"><input name="acquisitionDate" type="date" /></Field><Field label="Acquisition source"><input name="acquisitionSource" /></Field><Field label="Acquisition cost"><input name="acquisitionCost" type="number" min="0" step="0.01" /></Field><Field label="Comments" wide hint="Do not enter student information in library comments."><textarea name="comments" rows={3} /></Field><div className="form-actions field-wide"><SubmitButton>Add to library</SubmitButton></div></form></details></> : undefined} />
    <FlashMessage {...params} />
    <section className="metric-strip library-metrics"><div><span>Cataloged sets</span><strong>{totals.reduce((sum, row) => sum + row._count._all, 0)}</strong><small>Whole sets</small></div><div><span>Available</span><strong>{count(LibraryItemStatus.AVAILABLE)}</strong><small>Ready to loan</small></div><div><span>On loan</span><strong>{count(LibraryItemStatus.ON_LOAN)}</strong><small>{overdue} overdue in this view</small></div><div><span>Needs attention</span><strong>{count(LibraryItemStatus.INCOMPLETE) + count(LibraryItemStatus.MISSING)}</strong><small>Incomplete or missing</small></div></section>
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={q} placeholder="Search title, composer, publisher, or catalog number" /></label><select name="status" defaultValue={status}><option value="">All statuses</option>{Object.values(LibraryItemStatus).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><select name="category" defaultValue={category}><option value="">All categories</option>{categoryRows.map((row) => row.category ? <option key={row.category} value={row.category}>{row.category}</option> : null)}</select><button className="button secondary" type="submit">Filter</button>{q || status || category ? <Link className="text-link" href="/library">Clear</Link> : null}</form>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Title</th><th>Composer / arranger</th><th>Grade</th><th>Status</th><th>Current borrower</th><th>Location</th><th>History</th><th aria-label="Open" /></tr></thead><tbody>{items.map((item) => { const loan = item.loans[0]; return <tr key={item.id}><td><Link className="primary-cell" href={`/library/${item.id}`}><span className="asset-icon"><Music2 size={17} /></span><span><strong>{item.title}</strong><small>{item.publisher ?? item.catalogNumber ?? "No publisher or catalog number"}</small></span></Link></td><td>{item.composer ?? "—"}{item.arranger ? <small className="cell-subtitle">arr. {item.arranger}</small> : null}</td><td>{item.grade ?? "—"}</td><td><StatusPill value={item.status} />{item.componentNotes.length ? <small className="cell-subtitle alert-copy">{item.componentNotes.length} component issue{item.componentNotes.length === 1 ? "" : "s"}</small> : null}</td><td>{loan ? <span>{loan.borrowerName}<small className={loan.expectedReturnAt && loan.expectedReturnAt < new Date() ? "cell-subtitle alert-copy" : "cell-subtitle"}><Clock3 size={12} />{loan.expectedReturnAt ? `Due ${formatDate(loan.expectedReturnAt)}` : "No return date"}</small></span> : "—"}</td><td>{item.storageLocation ?? "—"}</td><td>{item._count.performanceRecords} performances · {item._count.resources} resources</td><td><Link className="row-link" href={`/library/${item.id}`}>Open</Link></td></tr>; })}</tbody></table>{items.length === 0 ? <div className="empty-state"><BookCopy size={24} /><strong>No music found</strong><span>Adjust the filters or add a whole score-and-parts set.</span></div> : null}</div>
  </main>;
}
