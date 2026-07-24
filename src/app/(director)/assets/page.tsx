import Link from "next/link";
import { PackageOpen, Plus, Search, Tags } from "lucide-react";
import { createAssetAction } from "@/app/actions";
import { AssetScanner } from "@/components/asset-scanner";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { AssetCategory, AssetCondition, AssetStatus } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { assetName, formatMoney, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Assets" };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const status = params.status ?? "";
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "VIEW_INVENTORY")) redirect("/today?error=Inventory%20access%20is%20not%20available%20for%20this%20account.");
  const canManage = hasPermission(user, "MANAGE_INVENTORY");
  const canViewNotes = hasPermission(user, "VIEW_NOTES");
  const [assets, scannableAssets] = await Promise.all([
    db.asset.findMany({
      where: { programId: program.id, ...(category ? { category: category as AssetCategory } : {}), ...(status ? { status: status as AssetStatus } : {}), ...(q ? { OR: [{ schoolAssetTag: { contains: q } }, { serialNumber: { contains: q } }, { make: { contains: q } }, { model: { contains: q } }] } : {}) },
      include: { assignments: { where: { checkedInAt: null }, include: { person: true } }, components: { where: { status: { in: ["MISSING", "DAMAGED"] } } } },
      orderBy: [{ category: "asc" }, { schoolAssetTag: "asc" }],
    }),
    db.asset.findMany({
      where: { programId: program.id, OR: [{ schoolAssetTag: { not: null } }, { serialNumber: { not: null } }] },
      select: { id: true, schoolAssetTag: true, serialNumber: true, make: true, model: true, category: true },
      orderBy: [{ category: "asc" }, { schoolAssetTag: "asc" }],
    }),
  ]);
  const scanRecords = scannableAssets.map((asset) => ({ value: asset.id, label: `${asset.schoolAssetTag ?? "Untagged"} · ${assetName(asset)}`, codes: [asset.schoolAssetTag, asset.serialNumber].filter((code): code is string => Boolean(code)), href: `/assets/${asset.id}` }));

  return <main className="content">
    <PageHeader eyebrow="Inventory" title="Assets" description={`${assets.length} assets shown`} actions={<><AssetScanner records={scanRecords} /><Link className="button secondary" href="/assets/labels"><Tags size={17} />Print labels</Link>{canManage ? <details className="popover wide"><summary className="button primary"><Plus size={17} />Add asset</summary><form action={createAssetAction} className="popover-panel form-grid"><h3>New inventory asset</h3><Field label="Category"><select name="category">{Object.values(AssetCategory).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Asset tag"><input name="schoolAssetTag" required placeholder="RMS-INST-049" /></Field><Field label="Make"><input name="make" /></Field><Field label="Model"><input name="model" /></Field><Field label="Serial number"><input name="serialNumber" /></Field><Field label="Size"><input name="size" /></Field><Field label="Condition"><select name="condition" defaultValue={AssetCondition.GOOD}>{Object.values(AssetCondition).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Location"><input name="location" /></Field><Field label="Purchase year"><input name="purchaseYear" type="number" min="1900" max="2100" /></Field><Field label="Estimated value"><input name="estimatedValue" type="number" min="0" step="0.01" /></Field>{canViewNotes ? <Field label="Notes" wide hint="No medical, disciplinary, or family information."><textarea name="notes" rows={2} /></Field> : null}<div className="form-actions field-wide"><SubmitButton>Add asset</SubmitButton></div></form></details> : null}</>} />
    <FlashMessage {...params} />
    <form className="filter-bar" method="get"><label className="search-control"><Search size={17} /><input name="q" defaultValue={q} placeholder="Search tag, serial, make, or model" /></label><select name="category" defaultValue={category}><option value="">All categories</option>{Object.values(AssetCategory).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><select name="status" defaultValue={status}><option value="">All statuses</option>{Object.values(AssetStatus).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select><button className="button secondary" type="submit">Filter</button>{q || category || status ? <Link className="text-link" href="/assets">Clear</Link> : null}</form>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Category</th><th>Condition</th><th>Status</th><th>Assigned to</th><th>Location</th><th>Value</th><th aria-label="Open" /></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><Link className="primary-cell" href={`/assets/${asset.id}`}><span className="asset-icon"><PackageOpen size={17} /></span><span><strong>{asset.schoolAssetTag ?? "Untagged"}</strong><small>{assetName(asset)}</small></span></Link></td><td>{titleCase(asset.category)}</td><td><StatusPill value={asset.condition} /></td><td><StatusPill value={asset.status} /></td><td>{asset.assignments[0] ? `${asset.assignments[0].person.firstName} ${asset.assignments[0].person.lastName}` : "—"}</td><td>{asset.location ?? "—"}</td><td>{formatMoney(asset.estimatedValue)}</td><td><Link className="row-link" href={`/assets/${asset.id}`}>Open</Link></td></tr>)}</tbody></table>{assets.length === 0 ? <div className="empty-state"><PackageOpen size={24} /><strong>No assets found</strong><span>Adjust the filters or add an inventory asset.</span></div> : null}</div>
  </main>;
}
