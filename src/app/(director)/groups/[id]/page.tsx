import Link from "next/link";
import { ArrowLeft, Pencil, UserPlus, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { addGroupMembershipAction, endGroupMembershipAction, updateGroupAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { GroupKind, PersonStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { hasPermission, requireUser } from "@/lib/auth";

export default async function GroupDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_GROUPS")) redirect("/today?error=Group%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const group = await db.group.findUnique({
    where: { id },
    include: {
      memberships: { include: { person: { include: { studentProfile: true, classifications: true, assignments: { where: { checkedInAt: null }, select: { id: true } } } } }, orderBy: { person: { lastName: "asc" } } },
      assignments: { include: { asset: true, person: true }, orderBy: { checkedOutAt: "desc" } },
    },
  });
  if (!group) notFound();
  const canManage = hasPermission(user, "MANAGE_GROUPS");
  const activeMemberships = group.memberships.filter((membership) => !membership.endedAt);
  const availablePeople = await db.person.findMany({ where: { programId: group.programId, status: PersonStatus.ACTIVE, id: { notIn: activeMemberships.map((membership) => membership.personId) } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  return <main className="content">
    <Link className="back-link" href="/groups"><ArrowLeft size={16} />Groups</Link>
    <PageHeader eyebrow={titleCase(group.kind)} title={group.name} description={group.description ?? `${activeMemberships.length} active members`} icon={UsersRound} actions={canManage ? <details className="popover wide"><summary className="button secondary"><Pencil size={16} />Edit group</summary><form action={updateGroupAction} className="popover-panel form-grid"><input type="hidden" name="id" value={group.id} /><h3>Edit group</h3><Field label="Name"><input name="name" defaultValue={group.name} required /></Field><Field label="Kind"><select name="kind" defaultValue={group.kind}>{Object.values(GroupKind).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Description" wide><textarea name="description" rows={3} defaultValue={group.description ?? ""} /></Field><label className="check-control field-wide"><input name="active" type="checkbox" defaultChecked={group.active} /><span><strong>Active group</strong></span></label><div className="form-actions field-wide"><SubmitButton>Save group</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...query} />
    <div className="detail-grid">
      <section className="detail-main">
        <div className="section-heading"><div><h2>Active members</h2><p>{activeMemberships.length} people</p></div></div>
        {canManage ? <form action={addGroupMembershipAction} className="inline-form"><input type="hidden" name="groupId" value={group.id} /><input type="hidden" name="returnTo" value={`/groups/${group.id}`} /><select name="personId" required defaultValue=""><option value="" disabled>Choose person</option>{availablePeople.map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}</option>)}</select><input name="roleLabel" placeholder="Optional role" /><button className="button primary" type="submit"><UserPlus size={16} />Add member</button></form> : null}
        <div className="data-table-wrap top-gap"><table className="data-table"><thead><tr><th>Person</th><th>Classification</th><th>Student</th><th>Role</th><th>Holdings</th><th aria-label="Action" /></tr></thead><tbody>{activeMemberships.map((membership) => <tr key={membership.id}><td><Link className="row-link" href={`/roster/${membership.personId}`}>{membership.person.lastName}, {membership.person.firstName}</Link></td><td>{membership.person.classifications.map(({ classification }) => titleCase(classification)).join(", ")}</td><td>{membership.person.studentProfile ? `Grade ${membership.person.studentProfile.grade}` : "—"}</td><td>{membership.roleLabel ?? "—"}</td><td>{membership.person.assignments.length}</td><td>{canManage ? <form action={endGroupMembershipAction}><input type="hidden" name="id" value={membership.id} /><input type="hidden" name="returnTo" value={`/groups/${group.id}`} /><button className="button small ghost" type="submit">End</button></form> : null}</td></tr>)}</tbody></table>{activeMemberships.length === 0 ? <div className="panel-empty">No active members.</div> : null}</div>
        <div className="section-heading top-gap"><div><h2>Group-context assignments</h2><p>Assets issued for this group</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Person</th><th>Checked out</th><th>Status</th></tr></thead><tbody>{group.assignments.map((assignment) => <tr key={assignment.id}><td><Link className="row-link" href={`/assets/${assignment.assetId}`}>{assignment.asset.schoolAssetTag ?? assignment.asset.id}</Link></td><td><Link className="row-link" href={`/roster/${assignment.personId}`}>{assignment.person.lastName}, {assignment.person.firstName}</Link></td><td>{assignment.checkedOutAt.toLocaleDateString()}</td><td><StatusPill value={assignment.checkedInAt ? "returned" : "assigned"} /></td></tr>)}</tbody></table>{group.assignments.length === 0 ? <div className="panel-empty">No assignments carry this group context.</div> : null}</div>
      </section>
      <aside className="detail-aside"><h3>Group record</h3><dl className="fact-list"><div><dt>Kind</dt><dd>{titleCase(group.kind)}</dd></div><div><dt>Status</dt><dd><StatusPill value={group.active ? "active" : "inactive"} /></dd></div><div><dt>Active members</dt><dd>{activeMemberships.length}</dd></div><div><dt>Total assignments</dt><dd>{group.assignments.length}</dd></div></dl></aside>
    </div>
  </main>;
}
