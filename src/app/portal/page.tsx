import { ClipboardList, LogOut, PackageCheck, WalletCards } from "lucide-react";
import { portalLogoutAction } from "@/app/portal-actions";
import { BrandMark } from "@/components/brand-mark";
import { StatusPill } from "@/components/status-pill";
import { getDb } from "@/lib/db";
import { assetName, formatDate, formatFinancialAmount } from "@/lib/format";
import { requirePortalUser } from "@/lib/portal-auth";

export const metadata = { title: "Program portal" };
export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const user = await requirePortalUser();
  const db = getDb();
  const guardianLinks = await db.guardianStudent.findMany({
    where: { guardianId: user.personId },
    select: { studentId: true },
  });
  const personIds = [...new Set([
    ...(user.person.studentProfile ? [user.personId] : []),
    ...guardianLinks.map(({ studentId }) => studentId),
  ])];
  const [students, balances, requests] = await Promise.all([
    db.person.findMany({
      where: { id: { in: personIds }, programId: user.programId },
      include: {
        studentProfile: true,
        assignments: {
          where: { checkedInAt: null },
          include: { asset: true, group: true },
          orderBy: { checkedOutAt: "desc" },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    personIds.length
      ? db.financialEntry.groupBy({
          by: ["personId"],
          where: { personId: { in: personIds } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    db.formRequest.findMany({
      where: { recipientPersonId: user.personId },
      include: {
        subjectPerson: true,
        campaign: { include: { templateVersion: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const balanceByPerson = new Map(balances.map((row) => [row.personId, Number(row._sum.amount ?? 0)]));

  return <main className="portal-shell">
    <header className="portal-topbar">
      <div className="portal-brand"><span><BrandMark size={26} reverse /></span><div><strong>Band Office</strong><small>{user.program.name}</small></div></div>
      <div className="portal-account"><span>{user.person.firstName} {user.person.lastName}</span><form action={portalLogoutAction}><button className="icon-button portal-signout" type="submit" aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></form></div>
    </header>
    <div className="portal-content">
      <header className="portal-heading"><p>Student and guardian portal</p><h1>Program account</h1><span>Current school records shared by your band program.</span></header>
      {students.length ? <div className="portal-student-grid">{students.map((student) => {
        const balance = balanceByPerson.get(student.id) ?? 0;
        return <section className="portal-student" key={student.id}>
          <header><div><small>Student</small><h2>{student.firstName} {student.lastName}</h2><span>{student.studentProfile ? `Grade ${student.studentProfile.grade}` : "Program member"}</span></div><div className="portal-balance"><WalletCards size={17} /><span><small>Balance</small><strong>{formatFinancialAmount(balance)}</strong></span></div></header>
          <div className="portal-section-heading"><PackageCheck size={17} /><div><h3>Assigned property</h3><span>{student.assignments.length} current items</span></div></div>
          {student.assignments.length ? <div className="portal-list">{student.assignments.map((assignment) => <div key={assignment.id}><span><strong>{assignment.asset.schoolAssetTag}</strong><small>{assetName(assignment.asset)}{assignment.group ? ` · ${assignment.group.name}` : ""}</small></span><span className="portal-list-meta">Due {formatDate(assignment.expectedReturnAt)}</span></div>)}</div> : <p className="panel-empty">No property is currently assigned.</p>}
        </section>;
      })}</div> : <section className="panel portal-empty"><PackageCheck size={23} /><strong>No linked students</strong><span>Ask the program director to review the guardian relationship on your record.</span></section>}
      <section className="portal-forms">
        <div className="portal-section-heading"><ClipboardList size={17} /><div><h2>Forms</h2><span>Requests assigned to your portal account</span></div></div>
        {requests.length ? <div className="portal-list">{requests.map((request) => <div key={request.id}><span><strong>{request.campaign.templateVersion.title}</strong><small>For {request.subjectPerson.firstName} {request.subjectPerson.lastName}{request.campaign.dueAt ? ` · due ${formatDate(request.campaign.dueAt)}` : ""}</small></span><StatusPill value={request.status} /></div>)}</div> : <p className="panel-empty">No form requests are assigned to this account.</p>}
      </section>
    </div>
  </main>;
}
