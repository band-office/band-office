import Link from "next/link";
import { Clock3, Plus, Wrench } from "lucide-react";
import { closeRepairAction, createRepairAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { AssetStatus, RepairStatus } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { assetName, daysSince, formatDate, formatMoney } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Repairs" };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<{ asset?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "VIEW_REPAIRS")) redirect("/today?error=Repair%20access%20is%20not%20available%20for%20this%20account.");
  const canManage = hasPermission(user, "MANAGE_REPAIRS");
  const [openRepairs, closedRepairs, eligibleAssets] = await Promise.all([
    db.repair.findMany({ where: { asset: { programId: program.id }, status: { in: [RepairStatus.OPEN, RepairStatus.AT_VENDOR] } }, include: { asset: true }, orderBy: { openedAt: "asc" } }),
    db.repair.findMany({ where: { asset: { programId: program.id }, status: RepairStatus.CLOSED }, include: { asset: true }, orderBy: { closedAt: "desc" }, take: 20 }),
    db.asset.findMany({ where: { programId: program.id, status: { notIn: [AssetStatus.RETIRED, AssetStatus.MISSING, AssetStatus.ASSIGNED] } }, orderBy: { schoolAssetTag: "asc" } }),
  ]);
  const totalOpenCost = openRepairs.reduce((sum, repair) => sum + Number(repair.cost ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  return <main className="content">
    <PageHeader eyebrow="Inventory service" title="Repair queue" description={`${openRepairs.length} repairs need attention`} icon={Wrench} actions={canManage ? <details className="popover wide" open={Boolean(params.asset)}><summary className="button primary"><Plus size={17} />Add repair</summary><form action={createRepairAction} className="popover-panel form-grid"><h3>New repair record</h3><Field label="Asset" wide><select name="assetId" defaultValue={params.asset ?? ""} required><option value="" disabled>Select an asset</option>{eligibleAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.schoolAssetTag} · {assetName(asset)}</option>)}</select></Field><Field label="Opened date"><input name="openedAt" type="date" defaultValue={today} required /></Field><Field label="Status"><select name="status" defaultValue={RepairStatus.OPEN}><option value={RepairStatus.OPEN}>Open</option><option value={RepairStatus.AT_VENDOR}>At vendor</option></select></Field><Field label="Vendor"><input name="vendor" /></Field><Field label="Estimated cost"><input name="cost" type="number" min="0" step="0.01" /></Field><Field label="Description" wide><textarea name="description" rows={3} required /></Field><div className="form-actions field-wide"><SubmitButton>Add to repair queue</SubmitButton></div></form></details> : undefined} />
    <FlashMessage {...params} />
    <section className="metric-strip compact-metrics"><div><span>Open repairs</span><strong>{openRepairs.length}</strong><small>active work orders</small></div><div><span>Known open cost</span><strong>{formatMoney(totalOpenCost)}</strong><small>excludes pending estimates</small></div><div><span>Stale repairs</span><strong>{openRepairs.filter((repair) => daysSince(repair.openedAt) > 30).length}</strong><small>open more than 30 days</small></div></section>
    <section className="work-section"><div className="section-heading"><div><h2>Open work</h2><p>Oldest repairs appear first</p></div></div><div className="repair-grid">{openRepairs.map((repair) => <article className="repair-card" key={repair.id}><div className="repair-top"><div><Link href={`/assets/${repair.assetId}`}>{repair.asset.schoolAssetTag}</Link><strong>{assetName(repair.asset)}</strong></div><StatusPill value={repair.status} /></div><p>{repair.description}</p><dl><div><dt>Opened</dt><dd>{formatDate(repair.openedAt)}</dd></div><div><dt>Age</dt><dd className={daysSince(repair.openedAt) > 30 ? "danger-text" : ""}>{daysSince(repair.openedAt)} days</dd></div><div><dt>Vendor</dt><dd>{repair.vendor ?? "Not assigned"}</dd></div><div><dt>Cost</dt><dd>{repair.cost ? formatMoney(repair.cost) : "Pending"}</dd></div></dl>{canManage ? <details><summary className="button secondary full">Close repair</summary><form action={closeRepairAction} className="inline-form"><input type="hidden" name="id" value={repair.id} /><Field label="Date returned"><input name="closedAt" type="date" defaultValue={today} required /></Field><Field label="Final vendor"><input name="vendor" defaultValue={repair.vendor ?? ""} /></Field><Field label="Final cost"><input name="cost" type="number" min="0" step="0.01" defaultValue={repair.cost?.toString() ?? ""} /></Field><SubmitButton>Close and return to service</SubmitButton></form></details> : null}</article>)}</div>{openRepairs.length === 0 ? <div className="empty-state"><Clock3 size={24} /><strong>Repair queue is clear</strong><span>No assets are waiting for service.</span></div> : null}</section>
    <section className="work-section"><div className="section-heading"><div><h2>Recently closed</h2><p>Last 20 completed repairs</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Description</th><th>Vendor</th><th>Opened</th><th>Closed</th><th>Cost</th></tr></thead><tbody>{closedRepairs.map((repair) => <tr key={repair.id}><td><Link className="row-link" href={`/assets/${repair.assetId}`}>{repair.asset.schoolAssetTag}</Link><small className="cell-subtitle">{assetName(repair.asset)}</small></td><td>{repair.description}</td><td>{repair.vendor ?? "—"}</td><td>{formatDate(repair.openedAt)}</td><td>{formatDate(repair.closedAt)}</td><td>{formatMoney(repair.cost)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
