import Link from "next/link";
import { ArrowLeft, AtSign, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { updateEmailContactStateAction } from "@/app/actions";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { EmailContactStatus, PersonStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProgram } from "@/lib/program-context";

export const metadata = { title: "Email contacts" };
export const dynamic = "force-dynamic";

export default async function EmailContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; success?: string; error?: string }> }) {
  const [query, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_COMMUNICATIONS")) redirect("/today");
  const db = getDb();
  const program = await getProgram(db);
  const canManage = hasPermission(user, "MANAGE_COMMUNICATIONS");
  const [people, states] = await Promise.all([
    db.person.findMany({ where: { programId: program.id, status: PersonStatus.ACTIVE }, include: { classifications: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.emailContactState.findMany({ where: { programId: program.id } }),
  ]);
  const stateByEmail = new Map(states.map((state) => [state.emailNormalized, state]));
  const byEmail = new Map<string, typeof people>();
  for (const person of people.filter((person) => person.email)) {
    const email = person.email!.trim().toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) || []), person]);
  }
  const q = query.q?.trim().toLowerCase() || "";
  const selectedState = query.state || "";
  const rows = [...byEmail.entries()].map(([email, contacts]) => ({ email, contacts, state: stateByEmail.get(email) })).filter((row) => {
    const status = row.state?.status || EmailContactStatus.ENABLED;
    return (!selectedState || status === selectedState) && (!q || row.email.includes(q) || row.contacts.some((person) => `${person.firstName} ${person.lastName}`.toLowerCase().includes(q)));
  });
  const missing = people.filter((person) => !person.email);

  return <main className="content">
    <Link className="back-link" href="/communications"><ArrowLeft size={15} />Communications</Link>
    <PageHeader title="Email contacts" description={`${rows.length} unique addresses · ${missing.length} active contacts without email`} icon={AtSign} />
    <FlashMessage {...query} />
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={query.q || ""} placeholder="Search name or email" /></label><select name="state" defaultValue={selectedState}><option value="">All states</option>{Object.values(EmailContactStatus).map((status) => <option key={status} value={status}>{status.toLowerCase()}</option>)}</select><button className="button secondary" type="submit">Filter</button></form>
    <div className="data-table-wrap"><table className="data-table contact-table"><thead><tr><th>Email address</th><th>People</th><th>Classifications</th><th>State</th><th>Administrative control</th></tr></thead><tbody>{rows.map((row) => { const status = row.state?.status || EmailContactStatus.ENABLED; return <tr key={row.email}><td><strong>{row.email}</strong>{row.state?.reason ? <small className="cell-subtitle">{row.state.reason}</small> : null}</td><td>{row.contacts.map((person) => `${person.firstName} ${person.lastName}`).join(", ")}</td><td><div className="pill-row">{[...new Set(row.contacts.flatMap((person) => person.classifications.map((item) => item.classification)))].map((classification) => <StatusPill key={classification} value={classification} />)}</div></td><td><StatusPill value={status} /></td><td>{canManage ? <form action={updateEmailContactStateAction} className="contact-state-form"><input type="hidden" name="email" value={row.email} /><select name="status" defaultValue={status}>{Object.values(EmailContactStatus).map((option) => <option value={option} key={option}>{option.toLowerCase()}</option>)}</select><input name="reason" defaultValue={row.state?.reason || ""} placeholder="Reason" /><button className="button secondary small" type="submit">Save</button></form> : "—"}</td></tr>; })}</tbody></table>{rows.length === 0 ? <div className="panel-empty">No email contacts match these filters.</div> : null}</div>
    {missing.length ? <section className="work-panel top-gap"><div className="panel-heading"><div><AtSign size={18} /><h2>Missing email addresses</h2></div><span className="count-badge">{missing.length}</span></div><div className="missing-contact-list">{missing.map((person) => <Link href={`/roster/${person.id}`} key={person.id}><strong>{person.lastName}, {person.firstName}</strong><span>{person.classifications.map((item) => item.classification.toLowerCase()).join(", ")}</span></Link>)}</div></section> : null}
  </main>;
}
