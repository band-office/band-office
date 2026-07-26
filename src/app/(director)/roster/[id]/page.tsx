import Link from "next/link";
import { ArrowLeft, ClipboardPlus, KeyRound, Pencil, Plus, UserRound, UsersRound, WalletCards } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { addGroupMembershipAction, addPersonClassificationAction, createPortalAccountAction, endGroupMembershipAction, setPortalAccountEnabledAction, unlinkGuardianStudentAction, updateAgreementAction, updatePersonAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FamilyLinkManager } from "@/components/family-link-manager";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { PersonClassificationType, PersonStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { assetName, formatDate, formatFinancialAmount, titleCase } from "@/lib/format";
import { hasPermission, requireUser } from "@/lib/auth";

export default async function PersonDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_PEOPLE")) redirect("/today?error=People%20access%20is%20not%20available%20for%20this%20account.");
  const db = getDb();
  const person = await db.person.findUnique({
    where: { id },
    include: {
      studentProfile: true,
      classifications: true,
      groupMemberships: { include: { group: true }, orderBy: { startedAt: "desc" } },
      guardianLinks: { include: { student: true } },
      studentGuardianLinks: { include: { guardian: true } },
      portalUser: true,
      assignments: { include: { asset: true, operatingPeriod: true, group: true }, orderBy: { checkedOutAt: "desc" } },
    },
  });
  if (!person) notFound();
  const canManagePeople = hasPermission(user, "MANAGE_PEOPLE");
  const canManageGroups = hasPermission(user, "MANAGE_GROUPS");
  const canAssign = hasPermission(user, "MANAGE_ASSIGNMENTS");
  const canViewContactDetails = hasPermission(user, "VIEW_CONTACT_DETAILS");
  const canViewFamilyLinks = hasPermission(user, "VIEW_FAMILY_LINKS");
  const canViewNotes = hasPermission(user, "VIEW_NOTES");
  const canViewFinancials = hasPermission(user, "VIEW_FINANCIALS");
  const canManagePortal = hasPermission(user, "MANAGE_USERS");
  const [groups, guardianCandidates, studentCandidates] = await Promise.all([
    db.group.findMany({ where: { programId: person.programId, active: true }, orderBy: { name: "asc" } }),
    db.person.findMany({
      where: { programId: person.programId, id: { not: person.id }, status: PersonStatus.ACTIVE },
      include: { classifications: true, guardianLinks: { include: { student: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.person.findMany({
      where: { programId: person.programId, id: { not: person.id }, status: PersonStatus.ACTIVE, studentProfile: { isNot: null } },
      include: { studentProfile: true, studentGuardianLinks: { include: { guardian: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const isStudent = Boolean(person.studentProfile);
  const financialBalance = isStudent && canViewFinancials
    ? Number((await db.financialEntry.aggregate({ where: { personId: person.id }, _sum: { amount: true } }))._sum.amount ?? 0)
    : null;
  const current = person.assignments.filter((assignment) => !assignment.checkedInAt);
  const history = person.assignments.filter((assignment) => assignment.checkedInAt);
  const activeMemberships = person.groupMemberships.filter((membership) => !membership.endedAt);
  const missingClassifications = Object.values(PersonClassificationType).filter((classification) => !person.classifications.some((record) => record.classification === classification));
  const linkedGuardianIds = new Set(person.studentGuardianLinks.map((link) => link.guardianId));
  const linkedStudentIds = new Set(person.guardianLinks.map((link) => link.studentId));
  const guardianOptions = guardianCandidates.filter((candidate) => !linkedGuardianIds.has(candidate.id)).map((candidate) => ({
    value: candidate.id,
    label: `${candidate.lastName}, ${candidate.firstName}`,
    meta: [
      candidate.email || "No email",
      candidate.phone || "No phone",
      candidate.classifications.map(({ classification }) => titleCase(classification)).join(", "),
      candidate.guardianLinks.length ? `Linked to ${candidate.guardianLinks.map((link) => `${link.student.firstName} ${link.student.lastName}`).join(", ")}` : "No students linked",
    ].join(" · "),
  }));
  const studentOptions = studentCandidates.filter((candidate) => !linkedStudentIds.has(candidate.id)).map((candidate) => ({
    value: candidate.id,
    label: `${candidate.lastName}, ${candidate.firstName}`,
    meta: [
      `Grade ${candidate.studentProfile!.grade}`,
      candidate.studentProfile!.schoolStudentId ? `ID ${candidate.studentProfile!.schoolStudentId}` : "No student ID",
      candidate.studentGuardianLinks.length ? `${candidate.studentGuardianLinks.length} guardian${candidate.studentGuardianLinks.length === 1 ? "" : "s"} linked` : "No guardians linked",
    ].join(" · "),
  }));

  return <main className="content">
    <Link className="back-link" href="/roster"><ArrowLeft size={16} />People</Link>
    <PageHeader eyebrow={person.classifications.map(({ classification }) => titleCase(classification)).join(" · ")} title={`${person.firstName} ${person.lastName}`} icon={UserRound} actions={canManagePeople ? <details className="popover wide"><summary className="button secondary"><Pencil size={16} />Edit person</summary><form action={updatePersonAction} className="popover-panel form-grid"><input type="hidden" name="id" value={person.id} /><input type="hidden" name="isStudent" value={String(isStudent)} /><h3>Edit person</h3><Field label="First name"><input name="firstName" defaultValue={person.firstName} required /></Field><Field label="Last name"><input name="lastName" defaultValue={person.lastName} required /></Field><Field label="Email"><input name="email" type="email" defaultValue={person.email ?? ""} /></Field><Field label="Phone"><input name="phone" type="tel" defaultValue={person.phone ?? ""} /></Field>{isStudent ? <><Field label="Grade"><input name="grade" type="number" min="1" max="12" defaultValue={person.studentProfile!.grade} required /></Field><Field label="Student ID (optional)"><input name="schoolStudentId" defaultValue={person.studentProfile!.schoolStudentId ?? ""} /></Field></> : null}<Field label="Status"><select name="status" defaultValue={person.status}>{Object.values(PersonStatus).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Notes" wide hint="No medical, disciplinary, or family information."><textarea name="notes" defaultValue={person.notes ?? ""} rows={3} /></Field><div className="form-actions field-wide"><SubmitButton>Save changes</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...query} />
    <div className="detail-grid">
      <section className="detail-main">
        {isStudent && canViewFinancials ? <div className="account-callout"><div><span className="asset-icon"><WalletCards size={17} /></span><span><small>Student fee account</small><strong className={financialBalance! > 0.004 ? "balance-due" : financialBalance! < -0.004 ? "balance-credit" : "balance-settled"}>{formatFinancialAmount(financialBalance)}</strong></span></div><Link className="button secondary" href={`/financials/${person.id}`}>Open statement</Link></div> : null}
        <div className="section-heading"><div><h2>Current holdings</h2><p>{current.length} assets assigned</p></div>{canAssign ? <Link className="button primary" href={`/checkout?person=${person.id}`}><ClipboardPlus size={16} />Assign asset</Link> : null}</div>
        {current.length ? <div className="item-stack">{current.map((assignment) => <article className="inventory-item" key={assignment.id}><Link href={`/assets/${assignment.assetId}`} className="inventory-identity"><span className="asset-icon">{assignment.asset.category[0]}</span><span><strong>{assignment.asset.schoolAssetTag}</strong><small>{assetName(assignment.asset)}{assignment.group ? ` · ${assignment.group.name}` : ""}</small></span></Link><div className="inventory-facts"><span>Out {formatDate(assignment.checkedOutAt)}</span><span>Due {formatDate(assignment.expectedReturnAt)}</span></div><div className="inventory-actions"><Link className="button small ghost" href={`/agreements/${assignment.id}`}>Print agreement</Link>{assignment.agreementOnFile ? <StatusPill value="agreement filed" /> : canAssign ? <form action={updateAgreementAction}><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="returnTo" value={`/roster/${person.id}`} /><button className="button small secondary" type="submit">Mark agreement filed</button></form> : <StatusPill value="agreement missing" />}{canAssign ? <Link className="button small ghost" href={`/checkin?assignment=${assignment.id}`}>Check in</Link> : null}</div></article>)}</div> : <div className="panel-empty bordered">No assets currently assigned.</div>}

        <div className="section-heading top-gap"><div><h2>Classifications</h2><p>A person may hold more than one program role</p></div></div>
        <div className="pill-row">{person.classifications.map(({ classification }) => <StatusPill key={classification} value={classification} />)}</div>
        {canManagePeople && missingClassifications.length ? <form action={addPersonClassificationAction} className="inline-form top-gap"><input type="hidden" name="personId" value={person.id} /><select name="classification" required defaultValue=""><option value="" disabled>Add classification</option>{missingClassifications.map((classification) => <option key={classification} value={classification}>{titleCase(classification)}</option>)}</select><input name="grade" type="number" min="1" max="12" placeholder="Grade if student" /><input name="schoolStudentId" placeholder="Optional student ID" /><button className="button secondary" type="submit"><Plus size={16} />Add</button></form> : null}

        <div className="section-heading top-gap"><div><h2>Groups</h2><p>{activeMemberships.length} active memberships</p></div></div>
        <div className="item-stack">{activeMemberships.map((membership) => <article className="membership-row" key={membership.id}><Link href={`/groups/${membership.groupId}`}><strong>{membership.group.name}</strong><small>{titleCase(membership.group.kind)}{membership.roleLabel ? ` · ${membership.roleLabel}` : ""}</small></Link>{canManageGroups ? <form action={endGroupMembershipAction}><input type="hidden" name="id" value={membership.id} /><input type="hidden" name="returnTo" value={`/roster/${person.id}`} /><button className="button small ghost" type="submit">End membership</button></form> : null}</article>)}</div>
        {canManageGroups ? <form action={addGroupMembershipAction} className="inline-form top-gap"><input type="hidden" name="personId" value={person.id} /><input type="hidden" name="returnTo" value={`/roster/${person.id}`} /><select name="groupId" required defaultValue=""><option value="" disabled>Add to group</option>{groups.filter((group) => !activeMemberships.some((membership) => membership.groupId === group.id)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><input name="roleLabel" placeholder="Optional role" /><button className="button secondary" type="submit"><UsersRound size={16} />Add</button></form> : null}

        {canViewFamilyLinks && (isStudent || person.classifications.some(({ classification }) => classification === PersonClassificationType.GUARDIAN)) ? <><div className="section-heading top-gap"><div><h2>Family links</h2><p>Guardian and student relationships</p></div></div><div className="item-stack">{person.studentGuardianLinks.map((link) => <article className="membership-row" key={link.id}><Link href={`/roster/${link.guardianId}`}><strong>{link.guardian.firstName} {link.guardian.lastName}</strong><small>{link.relationshipLabel ?? "Guardian"}{link.primaryContact ? " · primary" : ""}</small></Link><div className="inventory-actions"><StatusPill value={link.receivesCommunication ? "communication" : "no communication"} />{canManagePeople ? <form action={unlinkGuardianStudentAction}><input type="hidden" name="id" value={link.id} /><input type="hidden" name="returnTo" value={`/roster/${person.id}`} /><button className="button small ghost" type="submit">Remove</button></form> : null}</div></article>)}{person.guardianLinks.map((link) => <article className="membership-row" key={link.id}><Link href={`/roster/${link.studentId}`}><strong>{link.student.firstName} {link.student.lastName}</strong><small>{link.relationshipLabel ?? "Student"}</small></Link>{canManagePeople ? <form action={unlinkGuardianStudentAction}><input type="hidden" name="id" value={link.id} /><input type="hidden" name="returnTo" value={`/roster/${person.id}`} /><button className="button small ghost" type="submit">Remove</button></form> : null}</article>)}</div>{canManagePeople ? <FamilyLinkManager personId={person.id} kind={isStudent ? "student" : "guardian"} options={isStudent ? guardianOptions : studentOptions} returnTo={`/roster/${person.id}`} /> : null}</> : null}

        <div className="section-heading top-gap"><div><h2>Assignment history</h2><p>Permanent checkout and return record</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Group</th><th>Period</th><th>Checked out</th><th>Checked in</th><th>Resolution</th></tr></thead><tbody>{history.map((assignment) => <tr key={assignment.id}><td><Link className="row-link" href={`/assets/${assignment.assetId}`}>{assignment.asset.schoolAssetTag}</Link><small className="cell-subtitle">{assetName(assignment.asset)}</small></td><td>{assignment.group?.name ?? "—"}</td><td>{assignment.operatingPeriod.label}</td><td>{formatDate(assignment.checkedOutAt)}</td><td>{formatDate(assignment.checkedInAt)}</td><td><StatusPill value={assignment.resolution ?? "closed"} /></td></tr>)}</tbody></table>{history.length === 0 ? <div className="panel-empty">No historical assignments.</div> : null}</div>
      </section>
      <aside className="detail-aside">
        <h3>Person record</h3>
        <dl className="fact-list"><div><dt>Status</dt><dd><StatusPill value={person.status} /></dd></div>{canViewContactDetails ? <><div><dt>Email</dt><dd>{person.email ?? "Not set"}</dd></div><div><dt>Phone</dt><dd>{person.phone ?? "Not set"}</dd></div></> : null}{isStudent ? <><div><dt>Student ID</dt><dd>{person.studentProfile!.schoolStudentId ?? "Not set"}</dd></div><div><dt>Grade</dt><dd>{person.studentProfile!.grade}</dd></div></> : null}</dl>
        {canManagePortal && (isStudent || person.classifications.some(({ classification }) => classification === PersonClassificationType.GUARDIAN)) ? <section className="portal-access-control">
          <div><KeyRound size={17} /><span><strong>Portal access</strong><small>{person.portalUser ? person.portalUser.emailNormalized : "Not enabled"}</small></span>{person.portalUser ? <StatusPill value={person.portalUser.status} /> : null}</div>
          {person.portalUser ? <form action={setPortalAccountEnabledAction}><input type="hidden" name="personId" value={person.id} /><input type="hidden" name="portalUserId" value={person.portalUser.id} /><input type="hidden" name="enabled" value={String(person.portalUser.status === "DISABLED")} /><button className="button small secondary" type="submit">{person.portalUser.status === "DISABLED" ? "Enable access" : "Disable access"}</button></form> : <form action={createPortalAccountAction}><input type="hidden" name="personId" value={person.id} /><button className="button small secondary" type="submit">Enable portal access</button></form>}
          <p>Users set and reset their own passwords by email. Band Office never shows a password to staff.</p>
        </section> : null}
        {canViewNotes && person.notes ? <div className="notes-block"><span>Director notes</span><p>{person.notes}</p></div> : null}
        {canViewNotes ? <p className="privacy-copy">No medical, disciplinary, or family information. Notes are included in exports.</p> : null}
      </aside>
    </div>
  </main>;
}
