import Link from "next/link";
import { Plus, Search, UsersRound } from "lucide-react";
import { createGroupAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { GroupKind } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Groups" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const kind = params.kind ?? "";
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "VIEW_GROUPS")) redirect("/today?error=Group%20access%20is%20not%20available%20for%20this%20account.");
  const groups = await db.group.findMany({
    where: { programId: program.id, ...(kind ? { kind: kind as GroupKind } : {}), ...(q ? { name: { contains: q } } : {}) },
    include: { memberships: { where: { endedAt: null }, select: { id: true } }, assignments: { where: { checkedInAt: null }, select: { id: true } } },
    orderBy: [{ active: "desc" }, { kind: "asc" }, { name: "asc" }],
  });
  const canManage = hasPermission(user, "MANAGE_GROUPS");
  return <main className="content">
    <PageHeader eyebrow="Program structure" title="Groups" description={`${groups.length} groups shown`} icon={UsersRound} actions={canManage ? <details className="popover"><summary className="button primary"><Plus size={17} />Add group</summary><form action={createGroupAction} className="popover-panel form-grid"><h3>New group</h3><Field label="Name"><input name="name" required /></Field><Field label="Kind"><select name="kind" defaultValue={GroupKind.ENSEMBLE}>{Object.values(GroupKind).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Description" wide><textarea name="description" rows={3} /></Field><div className="form-actions field-wide"><SubmitButton>Create group</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...params} />
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={q} placeholder="Search group name" /></label><select name="kind" defaultValue={kind}><option value="">All kinds</option>{Object.values(GroupKind).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><button className="button secondary" type="submit">Filter</button>{q || kind ? <Link className="text-link" href="/groups">Clear</Link> : null}</form>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Group</th><th>Kind</th><th>Members</th><th>Assets out</th><th>Status</th><th aria-label="Open" /></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td><Link className="primary-cell" href={`/groups/${group.id}`}><span className="avatar"><UsersRound size={17} /></span><span><strong>{group.name}</strong><small>{group.description ?? "No description"}</small></span></Link></td><td>{titleCase(group.kind)}</td><td>{group.memberships.length}</td><td>{group.assignments.length}</td><td><StatusPill value={group.active ? "active" : "inactive"} /></td><td><Link className="row-link" href={`/groups/${group.id}`}>Open</Link></td></tr>)}</tbody></table>{groups.length === 0 ? <div className="empty-state"><UsersRound size={24} /><strong>No groups found</strong><span>Adjust the filters or create a group.</span></div> : null}</div>
  </main>;
}
