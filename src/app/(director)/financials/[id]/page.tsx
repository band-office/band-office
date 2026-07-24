import Link from "next/link";
import { ArrowLeft, Download, Plus, RotateCcw, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { postFinancialEntryAction, reverseFinancialEntryAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { FinancialEntryType } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { formatDate, formatFinancialAmount, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FinancialStatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_FINANCIALS")) redirect("/today?error=Financial%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const [person, program] = await Promise.all([
    db.person.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        groupMemberships: { where: { endedAt: null }, include: { group: true }, orderBy: { group: { name: "asc" } } },
        studentGuardianLinks: { include: { guardian: true } },
        financialEntries: {
          include: { group: true, operatingPeriod: true, batch: true, reversalOf: { select: { id: true } }, reversedBy: { select: { id: true } } },
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        },
      },
    }),
    getProgram(db),
  ]);
  if (!person?.studentProfile || person.programId !== program.id) notFound();
  const canManage = hasPermission(user, "MANAGE_FINANCIALS");
  const canExport = hasPermission(user, "EXPORT_DATA");
  const statement = person.financialEntries.reduce<{ balance: number; rows: Array<(typeof person.financialEntries)[number] & { runningBalance: number }> }>((state, entry) => {
    const runningBalance = state.balance + Number(entry.amount);
    return { balance: runningBalance, rows: [...state.rows, { ...entry, runningBalance }] };
  }, { balance: 0, rows: [] });
  const rows = statement.rows;
  const runningBalance = statement.balance;
  const charges = rows.filter((entry) => entry.type === FinancialEntryType.CHARGE).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const payments = -rows.filter((entry) => entry.type === FinancialEntryType.PAYMENT).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const credits = -rows.filter((entry) => entry.type === FinancialEntryType.CREDIT).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const today = new Date().toISOString().slice(0, 10);

  return <main className="content statement-page">
    <Link className="back-link no-print" href="/financials"><ArrowLeft size={16} />Financials</Link>
    <PageHeader eyebrow={`Student account · Grade ${person.studentProfile.grade}`} title={`${person.firstName} ${person.lastName}`} description={person.studentProfile.schoolStudentId ?? "No student ID"} icon={UserRound} actions={<><PrintButton />{canExport ? <a className="button secondary" href={`/api/export/financial-statement?personId=${person.id}`}><Download size={16} />CSV</a> : null}{canManage ? <details className="popover wide"><summary className="button primary"><Plus size={16} />Post entry</summary><form action={postFinancialEntryAction} className="popover-panel form-grid"><input type="hidden" name="personId" value={person.id} /><input type="hidden" name="returnTo" value={`/financials/${person.id}`} /><h3>Post account entry</h3><Field label="Entry type"><select name="type" defaultValue={FinancialEntryType.CHARGE}>{[FinancialEntryType.CHARGE, FinancialEntryType.PAYMENT, FinancialEntryType.CREDIT].map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></Field><Field label="Amount"><input name="amount" type="number" min="0.01" step="0.01" required /></Field><Field label="Description" wide><input name="description" required placeholder="Band fee, cash payment, scholarship credit" /></Field><Field label="Group context"><select name="groupId" defaultValue=""><option value="">No group context</option>{person.groupMemberships.map((membership) => <option key={membership.groupId} value={membership.groupId}>{membership.group.name}</option>)}</select></Field><Field label="Posted date"><input name="occurredAt" type="date" defaultValue={today} required /></Field><Field label="Due date" hint="Used for charges only"><input name="dueDate" type="date" /></Field><Field label="Reference" hint="Receipt, check, or office reference"><input name="reference" /></Field><div className="form-actions field-wide"><SubmitButton>Post entry</SubmitButton></div></form></details> : null}</>} />
    <FlashMessage {...query} />
    <section className="metric-strip compact-metrics statement-summary"><div><span>Current balance</span><strong className={runningBalance > 0.004 ? "balance-due" : runningBalance < -0.004 ? "balance-credit" : "balance-settled"}>{formatFinancialAmount(runningBalance)}</strong><small>{runningBalance > 0.004 ? "Amount due" : runningBalance < -0.004 ? "Credit balance" : "Settled"}</small></div><div><span>Posted charges</span><strong>{formatFinancialAmount(charges)}</strong><small>Before reversals</small></div><div><span>Posted payments + credits</span><strong>{formatFinancialAmount(payments + credits)}</strong><small>Before reversals · {formatFinancialAmount(payments)} payments · {formatFinancialAmount(credits)} credits</small></div></section>
    <div className="statement-heading"><div><h2>Account statement</h2><p>{program.name} · Generated {formatDate(new Date())}</p></div><span>{rows.length} ledger entries</span></div>
    <div className="data-table-wrap statement-table"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Group / reference</th><th className="amount-cell">Entry</th><th className="amount-cell">Balance</th><th className="no-print" aria-label="Action" /></tr></thead><tbody>{rows.map((entry) => <tr key={entry.id} className={entry.type === FinancialEntryType.REVERSAL ? "reversal-row" : undefined}><td>{formatDate(entry.occurredAt)}{entry.dueDate ? <small className="cell-subtitle">Due {formatDate(entry.dueDate)}</small> : null}</td><td><StatusPill value={entry.type} />{entry.reversedBy ? <StatusPill value="reversed" /> : null}</td><td><strong>{entry.description}</strong><small className="cell-subtitle">{entry.operatingPeriod.label}{entry.batch ? " · group assessment" : ""}</small></td><td>{entry.group?.name ?? "—"}{entry.reference ? <small className="cell-subtitle">{entry.reference}</small> : null}</td><td className={Number(entry.amount) > 0 ? "amount-cell ledger-debit" : "amount-cell ledger-credit"}>{formatFinancialAmount(entry.amount)}</td><td className="amount-cell">{formatFinancialAmount(entry.runningBalance)}</td><td className="no-print">{canManage && entry.type !== FinancialEntryType.REVERSAL && !entry.reversedBy ? <details className="popover compact"><summary className="icon-button" aria-label={`Reverse ${entry.description}`} title="Reverse entry"><RotateCcw size={15} /></summary><form action={reverseFinancialEntryAction} className="popover-panel reversal-form"><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="personId" value={person.id} /><h3>Reverse ledger entry</h3><p>This posts an equal and opposite entry. The original remains visible.</p><Field label="Reversal date"><input name="occurredAt" type="date" defaultValue={today} required /></Field><Field label="Reason"><input name="reason" required placeholder="Duplicate charge or correction" /></Field><SubmitButton>Post reversal</SubmitButton></form></details> : null}</td></tr>)}</tbody></table>{rows.length === 0 ? <div className="panel-empty">No charges, payments, or credits have been posted.</div> : null}</div>
    <footer className="statement-footer"><div><strong>Account holder</strong><span>{person.firstName} {person.lastName}</span><span>{person.studentProfile.schoolStudentId ?? "No student ID"}</span></div><div><strong>Current groups</strong><span>{person.groupMemberships.map((membership) => membership.group.name).join(", ") || "None"}</span></div><div><strong>Guardians on file</strong><span>{person.studentGuardianLinks.map((link) => `${link.guardian.firstName} ${link.guardian.lastName}`).join(", ") || "None"}</span></div></footer>
  </main>;
}
