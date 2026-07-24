import Link from "next/link";
import { FileUp } from "lucide-react";
import { redirect } from "next/navigation";
import { importAssetsAction, importStudentsAction } from "@/app/actions";
import { FlashMessage } from "@/components/flash-message";
import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/page-header";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Import" };

const memberFields = [
  { key: "firstName", label: "First name", required: true, aliases: ["first_name", "firstname"] },
  { key: "lastName", label: "Last name", required: true, aliases: ["last_name", "lastname"] },
  { key: "grade", label: "Grade", required: true },
  { key: "section", label: "Section", required: true, aliases: ["instrument", "class"] },
  { key: "schoolStudentId", label: "Student ID", aliases: ["school_student_id", "studentid", "id"] },
];

const assetFields = [
  { key: "category", label: "Category", required: true },
  { key: "schoolAssetTag", label: "Asset tag", required: true, aliases: ["school_asset_tag", "assettag", "tag"] },
  { key: "make", label: "Make" }, { key: "model", label: "Model" },
  { key: "serialNumber", label: "Serial number", aliases: ["serial_number", "serial"] },
  { key: "size", label: "Size" }, { key: "condition", label: "Condition", required: true },
  { key: "purchaseYear", label: "Purchase year", aliases: ["purchase_year", "year"] },
  { key: "estimatedValue", label: "Estimated value", aliases: ["estimated_value", "value"] },
  { key: "location", label: "Location" },
];

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ kind?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const assets = params.kind === "assets";
  const user = await requireUser();
  const canImportPeople = hasPermission(user, "MANAGE_PEOPLE");
  const canImportAssets = hasPermission(user, "MANAGE_INVENTORY");
  if ((!assets && !canImportPeople) || (assets && !canImportAssets)) {
    if (!assets && canImportAssets) redirect("/import?kind=assets");
    redirect("/today?error=Import%20access%20is%20restricted.");
  }
  return <main className="content narrow-content"><PageHeader eyebrow="Data migration" title="Import records" description="Map and reconcile spreadsheet data before any records change." icon={FileUp} /><FlashMessage {...params} /><div className="segment-tabs">{canImportPeople ? <Link className={!assets ? "active" : ""} href="/import">Students</Link> : null}{canImportAssets ? <Link className={assets ? "active" : ""} href="/import?kind=assets">Assets</Link> : null}</div>{assets ? <ImportWizard kind="assets" fields={assetFields} action={importAssetsAction} /> : <ImportWizard kind="students" fields={memberFields} action={importStudentsAction} />}<p className="privacy-copy">Imports become school records. Review the dry run and keep source files in district-approved storage.</p></main>;
}
