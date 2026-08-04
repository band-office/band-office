import Link from "next/link";
import { ArrowLeft, ClipboardPlus, Pencil, Tags, Trash2, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { deleteAssetAction, updateAssetAction, updateComponentAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { AssetCategory, AssetCondition, AssetStatus, ComponentStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { assetName, formatDate, formatMoney, titleCase } from "@/lib/format";
import { hasPermission, requireUser } from "@/lib/auth";

export default async function AssetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "VIEW_INVENTORY")) redirect("/today?error=Inventory%20access%20is%20not%20available%20for%20this%20account.");
  const asset = await getDb().asset.findUnique({
    where: { id },
    include: {
      components: { orderBy: { name: "asc" } },
      assignments: { include: { person: { include: { studentProfile: true } }, group: true, operatingPeriod: true }, orderBy: { checkedOutAt: "desc" } },
      repairs: { include: { operatingPeriod: true }, orderBy: { openedAt: "desc" } },
      eventEquipment: { select: { id: true } },
    },
  });
  if (!asset) notFound();
  const activeAssignment = asset.assignments.find((assignment) => !assignment.checkedInAt);
  const lifetimeRepairCost = asset.repairs.reduce((sum, repair) => sum + Number(repair.cost ?? 0), 0);
  const canManageInventory = hasPermission(user, "MANAGE_INVENTORY");
  const canAssign = hasPermission(user, "MANAGE_ASSIGNMENTS");
  const canManageRepairs = hasPermission(user, "MANAGE_REPAIRS");
  const canViewNotes = hasPermission(user, "VIEW_NOTES");
  const editableAssetStatuses: AssetStatus[] = [AssetStatus.AVAILABLE, AssetStatus.RETIRED, AssetStatus.MISSING];
  const canSetAssetStatus = !activeAssignment && editableAssetStatuses.includes(asset.status);
  const canDelete = canManageInventory && asset.assignments.length === 0 && asset.repairs.length === 0 && asset.eventEquipment.length === 0;

  return <main className="content">
    <Link className="back-link" href="/assets"><ArrowLeft size={16} />Assets</Link>
    <PageHeader eyebrow={titleCase(asset.category)} title={asset.schoolAssetTag ?? assetName(asset)} description={assetName(asset)} actions={<>{asset.schoolAssetTag ? <Link className="button secondary" href={`/assets/labels?asset=${asset.id}`}><Tags size={16} />Print label</Link> : null}{canManageInventory ? <details className="popover wide"><summary className="button secondary"><Pencil size={16} />Edit asset</summary><form action={updateAssetAction} className="popover-panel form-grid"><input type="hidden" name="id" value={asset.id} /><h3>Edit asset</h3><Field label="Category"><select name="category" defaultValue={asset.category}>{Object.values(AssetCategory).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Asset tag"><input name="schoolAssetTag" defaultValue={asset.schoolAssetTag ?? ""} required /></Field><Field label="Make"><input name="make" defaultValue={asset.make ?? ""} /></Field><Field label="Model"><input name="model" defaultValue={asset.model ?? ""} /></Field><Field label="Serial number"><input name="serialNumber" defaultValue={asset.serialNumber ?? ""} /></Field><Field label="Size"><input name="size" defaultValue={asset.size ?? ""} /></Field><Field label="Condition"><select name="condition" defaultValue={asset.condition}>{Object.values(AssetCondition).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field>{canSetAssetStatus ? <Field label="Status"><select name="status" defaultValue={asset.status}>{editableAssetStatuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field> : null}<Field label="Location"><input name="location" defaultValue={asset.location ?? ""} /></Field><Field label="Purchase year"><input name="purchaseYear" type="number" defaultValue={asset.purchaseYear ?? ""} /></Field><Field label="Estimated value"><input name="estimatedValue" type="number" step="0.01" defaultValue={asset.estimatedValue?.toString() ?? ""} /></Field>{canViewNotes ? <Field label="Notes" wide hint="No medical, disciplinary, or family information."><textarea name="notes" rows={3} defaultValue={asset.notes ?? ""} /></Field> : null}<div className="form-actions field-wide"><SubmitButton>Save changes</SubmitButton></div></form></details> : null}{canDelete ? <details className="popover"><summary className="button danger"><Trash2 size={16} />Delete asset</summary><form action={deleteAssetAction} className="popover-panel"><input type="hidden" name="id" value={asset.id} /><h3>Delete unused asset?</h3><p>Deletion is permanent. Assets with assignment, repair, or event history must be retired instead.</p><SubmitButton className="button danger">Delete permanently</SubmitButton></form></details> : null}</>} />
    <FlashMessage {...query} />
    <section className="asset-summary-band"><div><span>Status</span><StatusPill value={asset.status} /></div><div><span>Condition</span><StatusPill value={asset.condition} /></div><div><span>Estimated value</span><strong>{formatMoney(asset.estimatedValue)}</strong></div><div><span>Lifetime repairs</span><strong>{formatMoney(lifetimeRepairCost)}</strong></div><div><span>Location</span><strong>{asset.location ?? "Not set"}</strong></div></section>
    <div className="detail-grid">
      <section className="detail-main">
        <div className="section-heading"><div><h2>Current assignment</h2><p>Who is responsible for this asset now</p></div>{canAssign && !activeAssignment && asset.status === "AVAILABLE" ? <Link className="button primary" href={`/checkout?asset=${asset.id}`}><ClipboardPlus size={16} />Check out</Link> : null}</div>
        {activeAssignment ? <article className="assignment-callout"><div><span className="avatar">{activeAssignment.person.firstName[0]}{activeAssignment.person.lastName[0] ?? ""}</span><span><strong>{activeAssignment.person.firstName} {activeAssignment.person.lastName}</strong><small>{activeAssignment.person.studentProfile ? `Grade ${activeAssignment.person.studentProfile.grade}` : "Program contact"}{activeAssignment.group ? ` · ${activeAssignment.group.name}` : ""}</small></span></div><dl><div><dt>Checked out</dt><dd>{formatDate(activeAssignment.checkedOutAt)}</dd></div><div><dt>Expected return</dt><dd>{formatDate(activeAssignment.expectedReturnAt)}</dd></div><div><dt>Agreement</dt><dd>{activeAssignment.agreementOnFile ? "On file" : "Missing"}</dd></div></dl>{canAssign ? <Link className="button secondary" href={`/checkin?assignment=${activeAssignment.id}`}>Check in asset</Link> : null}</article> : <div className="panel-empty bordered">This asset is not currently assigned.</div>}

        {asset.components.length ? <><div className="section-heading top-gap"><div><h2>Attached components</h2><p>Components travel with the primary asset</p></div></div><div className="item-stack">{asset.components.map((component) => canManageInventory ? <form action={updateComponentAction} className="component-row" key={component.id}><input type="hidden" name="id" value={component.id} /><input type="hidden" name="assetId" value={asset.id} /><div><strong>{component.name}</strong><small>{canViewNotes ? component.notes ?? "No component note" : titleCase(component.status)}</small></div><select name="status" defaultValue={component.status}>{Object.values(ComponentStatus).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>{canViewNotes ? <input name="notes" defaultValue={component.notes ?? ""} placeholder="Optional note" /> : null}<button className="button small secondary" type="submit">Update</button></form> : <article className="membership-row" key={component.id}><strong>{component.name}</strong><StatusPill value={component.status} /></article>)}</div></> : null}

        <div className="section-heading top-gap"><div><h2>Assignment history</h2><p>{asset.assignments.length} total assignments</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Person</th><th>Group</th><th>Period</th><th>Out</th><th>Returned</th><th>Condition</th></tr></thead><tbody>{asset.assignments.map((assignment) => <tr key={assignment.id}><td><Link className="row-link" href={`/roster/${assignment.personId}`}>{assignment.person.lastName}, {assignment.person.firstName}</Link></td><td>{assignment.group?.name ?? "—"}</td><td>{assignment.operatingPeriod.label}</td><td>{formatDate(assignment.checkedOutAt)}</td><td>{formatDate(assignment.checkedInAt)}</td><td>{titleCase(assignment.conditionOut)}{assignment.conditionIn ? ` → ${titleCase(assignment.conditionIn)}` : ""}</td></tr>)}</tbody></table></div>

        <div className="section-heading top-gap"><div><h2>Repair history</h2><p>{asset.repairs.length} service records</p></div>{canManageRepairs ? <Link className="button secondary" href={`/repairs?asset=${asset.id}`}><Wrench size={16} />Add repair</Link> : null}</div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Opened</th><th>Description</th><th>Vendor</th><th>Cost</th><th>Status</th></tr></thead><tbody>{asset.repairs.map((repair) => <tr key={repair.id}><td>{formatDate(repair.openedAt)}</td><td>{repair.description}</td><td>{repair.vendor ?? "—"}</td><td>{formatMoney(repair.cost)}</td><td><StatusPill value={repair.status} /></td></tr>)}</tbody></table>{asset.repairs.length === 0 ? <div className="panel-empty">No repair history.</div> : null}</div>
      </section>
      <aside className="detail-aside"><h3>Asset record</h3><dl className="fact-list"><div><dt>Serial number</dt><dd>{asset.serialNumber ?? "Not set"}</dd></div><div><dt>Purchase year</dt><dd>{asset.purchaseYear ?? "Not set"}</dd></div><div><dt>Size</dt><dd>{asset.size ?? "Not applicable"}</dd></div><div><dt>Components</dt><dd>{asset.components.length}</dd></div></dl>{canViewNotes && asset.notes ? <div className="notes-block"><span>Director notes</span><p>{asset.notes}</p></div> : null}</aside>
    </div>
  </main>;
}
