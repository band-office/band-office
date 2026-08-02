import Link from "next/link";
import { CircleDollarSign, Plus, Search, Upload, UsersRound, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { postGroupAssessmentAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/lib/db";
import { assessmentBatches, financialSummary, studentBalances } from "@/lib/financial-reports";
import { formatDate, formatFinancialAmount } from "@/lib/format";
import { getProgramContext } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Financials" };
export const dynamic = "force-dynamic";

export default async function FinancialsPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string; standing?: string; success?: string; error?: string }> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_FINANCIALS")) redirect("/today?error=Financial%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const { program, operatingPeriod } = await getProgramContext(db);
  const groupId = params.group ?? "";
  const q = params.q?.trim().toLowerCase() ?? "";
  const standing = params.standing ?? "";
  const canManage = hasPermission(user, "MANAGE_FINANCIALS");
  const [summaryRows, balanceRows, groups, recentEntries, batches] = await Promise.all([
    financialSummary(db, program.id, operatingPeriod.id),
    studentBalances(db, program.id, groupId),
    db.group.findMany({
      where: { programId: program.id, active: true },
      include: { memberships: { where: { endedAt: null, person: { studentProfile: { isNot: null } } }, select: { id: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    db.financialEntry.findMany({
      where: { programId: program.id },
      include: { person: true, group: true, reversedBy: { select: { id: true } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    assessmentBatches(db, program.id),
  ]);
  const summary = summaryRows[0];
  const balances = balanceRows.filter((row) => {
    const matchesSearch = !q || row.personName.toLowerCase().includes(q) || row.schoolStudentId?.toLowerCase().includes(q);
    const balance = Number(row.balance);
    const matchesStanding = !standing || (standing === "due" && balance > 0.004) || (standing === "credit" && balance < -0.004) || (standing === "settled" && Math.abs(balance) <= 0.004);
    return matchesSearch && matchesStanding;
  });
  const today = new Date().toISOString().slice(0, 10);

  return <main className="content">
    <PageHeader eyebrow={`Current period · ${operatingPeriod.label}`} title="Financials" description="Student fee accounts, manual payments, credits, statements, and group assessments." icon={WalletCards} actions={canManage ? <><Link className="button secondary" href="/financials/import-cuttime-balances"><Upload size={16} />Import CutTime balances</Link><details className="popover wide"><summary className="button primary"><UsersRound size={16} />Assess group</summary><form action={postGroupAssessmentAction} className="popover-panel form-grid"><h3>Post group assessment</h3><Field label="Group" wide><select name="groupId" required defaultValue=""><option value="" disabled>Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.memberships.length} students</option>)}</select></Field><Field label="Description" wide><input name="description" required placeholder="Concert uniform fee" /></Field><Field label="Amount per student"><input name="amount" type="number" min="0.01" step="0.01" required /></Field><Field label="Posted date"><input name="occurredAt" type="date" defaultValue={today} required /></Field><Field label="Due date"><input name="dueDate" type="date" /></Field><div className="form-actions field-wide"><SubmitButton>Post assessment</SubmitButton></div><p className="privacy-copy field-wide">This creates a separate, permanent charge for every active student currently in the group.</p></form></details></> : undefined} />
    <FlashMessage {...params} />
    <section className="metric-strip financial-metrics"><div><span>Outstanding</span><strong>{formatFinancialAmount(summary.outstandingTotal)}</strong><small>{summary.positiveBalanceCount} accounts with balances</small></div><div><span>Credit balances</span><strong>{formatFinancialAmount(summary.creditBalanceTotal)}</strong><small>Available account credit</small></div><div><span>Current charges</span><strong>{formatFinancialAmount(summary.currentCharges)}</strong><small>{operatingPeriod.label}</small></div><div><span>Payments + credits</span><strong>{formatFinancialAmount(summary.currentPaymentsAndCredits)}</strong><small>{operatingPeriod.label}</small></div></section>
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={params.q ?? ""} placeholder="Search student or ID" /></label><select name="group" defaultValue={groupId}><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select name="standing" defaultValue={standing}><option value="">All balances</option><option value="due">Balance due</option><option value="settled">Settled</option><option value="credit">Credit balance</option></select><button className="button secondary" type="submit">Filter</button>{q || groupId || standing ? <Link className="text-link" href="/financials">Clear</Link> : null}</form>
    <div className="dashboard-grid financial-grid">
      <section className="work-panel span-2"><div className="panel-heading"><div><CircleDollarSign size={18} /><h2>Student accounts</h2></div><span className="muted-copy">{balances.length} shown</span></div><div className="data-table-wrap top-gap"><table className="data-table"><thead><tr><th>Student</th><th>Grade</th><th>Groups</th><th>Activity</th><th className="amount-cell">Balance</th><th aria-label="Open" /></tr></thead><tbody>{balances.map((row) => <tr key={row.personId}><td><Link className="primary-cell" href={`/financials/${row.personId}`}><span className="avatar">{row.personName.split(", ").map((part) => part[0]).join("")}</span><span><strong>{row.personName}</strong><small>{row.schoolStudentId ?? "No student ID"}</small></span></Link></td><td>{row.grade}</td><td>{row.groups || "—"}</td><td>{row.entryCount ? `${row.entryCount} entries · ${formatDate(row.lastActivityAt)}` : "No entries"}</td><td className={`amount-cell balance-${Number(row.balance) > 0.004 ? "due" : Number(row.balance) < -0.004 ? "credit" : "settled"}`}>{formatFinancialAmount(row.balance)}</td><td><Link className="row-link" href={`/financials/${row.personId}`}>Statement</Link></td></tr>)}</tbody></table>{balances.length === 0 ? <div className="panel-empty">No student accounts match these filters.</div> : null}</div></section>
      <section className="work-panel"><div className="panel-heading"><div><Plus size={18} /><h2>Recent activity</h2></div></div><div className="financial-activity-list">{recentEntries.map((entry) => <Link href={`/financials/${entry.personId}`} key={entry.id}><span><strong>{entry.description}</strong><small>{entry.person.lastName}, {entry.person.firstName}{entry.group ? ` · ${entry.group.name}` : ""}</small></span><span className={Number(entry.amount) > 0 ? "ledger-debit" : "ledger-credit"}>{formatFinancialAmount(entry.amount)}</span></Link>)}{recentEntries.length === 0 ? <div className="panel-empty">No financial activity yet.</div> : null}</div></section>
      <section className="work-panel span-2"><div className="panel-heading"><div><UsersRound size={18} /><h2>Assessment history</h2></div></div><div className="data-table-wrap top-gap"><table className="data-table"><thead><tr><th>Posted</th><th>Group</th><th>Description</th><th>Students</th><th className="amount-cell">Per student</th><th className="amount-cell">Total</th></tr></thead><tbody>{batches.slice(0, 12).map((batch) => <tr key={batch.batchId}><td>{formatDate(batch.occurredAt)}</td><td><Link className="row-link" href={`/groups/${batch.groupId}`}>{batch.groupName}</Link></td><td>{batch.description}{batch.reversedCount ? <small className="cell-subtitle">{batch.reversedCount} reversed</small> : null}</td><td>{batch.studentCount}</td><td className="amount-cell">{formatFinancialAmount(batch.amountPerStudent)}</td><td className="amount-cell">{formatFinancialAmount(batch.totalAssessed)}</td></tr>)}</tbody></table>{batches.length === 0 ? <div className="panel-empty">No group assessments posted.</div> : null}</div></section>
    </div>
  </main>;
}
