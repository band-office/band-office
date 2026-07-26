import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { createPersonAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { PersonClassificationType } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; classification?: string; group?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const classification = params.classification ?? "";
  const groupId = params.group ?? "";
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "VIEW_PEOPLE")) redirect("/today?error=People%20access%20is%20not%20available%20for%20this%20account.");
  const canManage = hasPermission(user, "MANAGE_PEOPLE");
  const canViewContactDetails = hasPermission(user, "VIEW_CONTACT_DETAILS");
  const [people, groups] = await Promise.all([
    db.person.findMany({
      where: {
        programId: program.id,
        ...(classification ? { classifications: { some: { classification: classification as PersonClassificationType } } } : {}),
        ...(groupId ? { groupMemberships: { some: { groupId, endedAt: null } } } : {}),
        ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, ...(canViewContactDetails ? [{ email: { contains: q } }] : []), { studentProfile: { schoolStudentId: { contains: q } } }] } : {}),
      },
      include: {
        studentProfile: true,
        classifications: true,
        groupMemberships: { where: { endedAt: null }, include: { group: true }, orderBy: { group: { name: "asc" } } },
        assignments: { where: { checkedInAt: null }, select: { id: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.group.findMany({ where: { programId: program.id, active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  ]);

  return <main className="content">
    <PageHeader eyebrow="Program directory" title="People" description={`${people.length} people shown`} actions={canManage ? <details className="popover wide"><summary className="button primary"><Plus size={17} />Add person</summary><form action={createPersonAction} className="popover-panel form-grid"><h3>New person</h3><Field label="First name"><input name="firstName" required /></Field><Field label="Last name"><input name="lastName" required /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Phone"><input name="phone" type="tel" /></Field><Field label="Classifications" wide><div className="check-grid">{Object.values(PersonClassificationType).map((value) => <label className="check-control compact" key={value}><input name="classifications" type="checkbox" value={value} defaultChecked={value === PersonClassificationType.STUDENT} /><span>{titleCase(value)}</span></label>)}</div></Field><Field label="Grade"><input name="grade" type="number" min="1" max="12" defaultValue="6" /></Field><Field label="Student ID (optional)"><input name="schoolStudentId" /></Field><Field label="Initial groups" wide><select name="groupIds" multiple size={Math.min(5, Math.max(2, groups.length))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {titleCase(group.kind)}</option>)}</select></Field><Field label="Notes" wide hint="No medical, disciplinary, or family information."><textarea name="notes" rows={2} /></Field><div className="form-actions field-wide"><SubmitButton>Add person</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...params} />
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={q} placeholder={canViewContactDetails ? "Search name, email, or student ID" : "Search name or student ID"} /></label><select name="classification" defaultValue={classification}><option value="">All classifications</option>{Object.values(PersonClassificationType).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><select name="group" defaultValue={groupId}><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button className="button secondary" type="submit">Filter</button>{q || classification || groupId ? <Link className="text-link" href="/roster">Clear</Link> : null}</form>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Person</th><th>Classification</th><th>Student</th><th>Groups</th><th>Holdings</th><th>Status</th><th aria-label="Open" /></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><Link className="primary-cell" href={`/roster/${person.id}`}><span className="avatar">{person.firstName[0]}{person.lastName[0] ?? ""}</span><span><strong>{person.lastName ? `${person.lastName}, ` : ""}{person.firstName}</strong><small>{canViewContactDetails ? person.email ?? person.studentProfile?.schoolStudentId ?? "No contact identifier" : person.studentProfile?.schoolStudentId ?? "Program person"}</small></span></Link></td><td><div className="pill-row">{person.classifications.map(({ classification: value }) => <StatusPill key={value} value={value} />)}</div></td><td>{person.studentProfile ? `Grade ${person.studentProfile.grade} · ${person.studentProfile.schoolStudentId ?? "No ID"}` : "—"}</td><td>{person.groupMemberships.map((membership) => membership.group.name).join(", ") || "—"}</td><td>{person.assignments.length}</td><td><StatusPill value={person.status} /></td><td><Link className="row-link" href={`/roster/${person.id}`}>Open</Link></td></tr>)}</tbody></table>{people.length === 0 ? <div className="empty-state"><Users size={24} /><strong>No people found</strong><span>Adjust the filters or add a person.</span></div> : null}</div>
  </main>;
}
