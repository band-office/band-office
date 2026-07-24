import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { StatusPill } from "@/components/status-pill";
import { DEFAULT_AGREEMENT_TEMPLATE } from "@/lib/agreement";
import { getDb } from "@/lib/db";
import { assetName, formatDate, titleCase } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AgreementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const assignment = await getDb().assignment.findUnique({
    where: { id },
    include: { person: { include: { studentProfile: true } }, group: true, asset: { include: { components: true, program: true } }, operatingPeriod: true },
  });
  if (!assignment) notFound();
  const template = assignment.asset.program.agreementTemplate || DEFAULT_AGREEMENT_TEMPLATE;
  return <main className="agreement-page">
    <header className="agreement-toolbar no-print"><Link className="back-link" href={query.new ? "/checkout" : `/roster/${assignment.personId}`}><ArrowLeft size={16} />{query.new ? "Next checkout" : "Person record"}</Link><div>{query.new ? <span className="complete-label"><CheckCircle2 size={16} />Checkout saved</span> : null}<PrintButton /></div></header>
    <article className="agreement-document">
      <header><div><span>School property record</span><h1>{assignment.asset.program.name}</h1><p>{assignment.operatingPeriod.label} usage acknowledgment</p></div><Printer size={28} /></header>
      <section className="agreement-parties"><div><span>Assigned to</span><strong>{assignment.person.firstName} {assignment.person.lastName}</strong><small>{assignment.person.studentProfile ? `Grade ${assignment.person.studentProfile.grade}` : "Program contact"}{assignment.group ? ` · ${assignment.group.name}` : ""}</small></div><div><span>Asset</span><strong>{assignment.asset.schoolAssetTag ?? "Untagged asset"}</strong><small>{assetName(assignment.asset)}</small></div></section>
      <section className="agreement-facts"><div><span>Serial number</span><strong>{assignment.asset.serialNumber ?? "Not recorded"}</strong></div><div><span>Condition out</span><strong>{titleCase(assignment.conditionOut)}</strong></div><div><span>Checked out</span><strong>{formatDate(assignment.checkedOutAt)}</strong></div><div><span>Expected return</span><strong>{formatDate(assignment.expectedReturnAt)}</strong></div></section>
      {assignment.asset.components.length ? <section><h2>Components issued with this asset</h2><ul className="component-checklist">{assignment.asset.components.map((component) => <li key={component.id}><span>□</span>{component.name}<StatusPill value={component.status} /></li>)}</ul></section> : null}
      <section className="agreement-copy"><h2>Responsibility acknowledgment</h2>{template.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>
      <section className="signature-grid"><div><span>Responsible person signature</span><hr /><small>Date</small></div>{assignment.person.studentProfile ? <div><span>Guardian signature</span><hr /><small>Date</small></div> : null}<div><span>Director or staff</span><hr /><small>Date</small></div></section>
      <footer>Assignment record {assignment.id} · Generated {formatDate(new Date())}</footer>
    </article>
  </main>;
}
