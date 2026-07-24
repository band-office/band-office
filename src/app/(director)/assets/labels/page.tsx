import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { AssetLabelWorkspace } from "@/components/asset-label-workspace";
import { PageHeader } from "@/components/page-header";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assetName, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { redirect } from "next/navigation";

export const metadata = { title: "Print asset labels" };

export default async function AssetLabelsPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const [{ asset: initialAssetId }, program, user] = await Promise.all([searchParams, getProgram(getDb()), requireUser()]);
  if (!hasPermission(user, "VIEW_INVENTORY")) redirect("/today?error=Inventory%20access%20is%20not%20available%20for%20this%20account.");
  const assets = await getDb().asset.findMany({
    where: { programId: program.id, schoolAssetTag: { not: null } },
    select: { id: true, schoolAssetTag: true, make: true, model: true, category: true, status: true, location: true },
    orderBy: [{ category: "asc" }, { schoolAssetTag: "asc" }],
  });
  const labelAssets = assets.map((asset) => ({ id: asset.id, tag: asset.schoolAssetTag!, name: assetName(asset), category: titleCase(asset.category), status: titleCase(asset.status), location: asset.location }));

  return <main className="content label-page">
    <Link className="back-link no-print" href="/assets"><ArrowLeft size={16} />Assets</Link>
    <PageHeader eyebrow="Inventory" title="Print asset labels" description={`${labelAssets.length} tagged assets available`} icon={Tags} />
    <AssetLabelWorkspace assets={labelAssets} initialAssetId={initialAssetId} />
  </main>;
}
