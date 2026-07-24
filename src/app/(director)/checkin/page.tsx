import { ClipboardCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { checkinAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { SearchSelect } from "@/components/search-select";
import { AssetCondition } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { assetName, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Check-in" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ assignment?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  if (!hasPermission(user, "MANAGE_ASSIGNMENTS")) redirect("/today?error=Check-in%20access%20is%20restricted.");
  const program = await getProgram(getDb());
  const assignments = await getDb().assignment.findMany({ where: { asset: { programId: program.id }, checkedInAt: null }, include: { asset: true, person: true, group: true }, orderBy: { asset: { schoolAssetTag: "asc" } } });
  const today = new Date().toISOString().slice(0, 10);
  const assignmentOptions = assignments.map((assignment) => ({ value: assignment.id, label: `${assignment.asset.schoolAssetTag ?? "Untagged"} · ${assetName(assignment.asset)}`, meta: `${assignment.person.lastName}, ${assignment.person.firstName}${assignment.group ? ` · ${assignment.group.name}` : ""}`, scanCodes: [assignment.asset.schoolAssetTag, assignment.asset.serialNumber].filter((code): code is string => Boolean(code)) }));
  return <main className="content station-content"><PageHeader eyebrow="Return station" title="Check in an asset" description="Close the assignment and flag damage without duplicate entry." icon={ClipboardCheck} /><FlashMessage {...params} /><form action={checkinAction} className="station-form"><section><span className="step-number">1</span><div><h2>Choose assigned asset</h2><p>Search by asset tag, description, person, or group</p><SearchSelect name="assignmentId" label="Current assignment" placeholder="Search active assignments" options={assignmentOptions} defaultValue={params.assignment} scanLabel="Scan assigned asset" /></div></section><section><span className="step-number">2</span><div><h2>Inspect and close</h2><div className="form-grid"><Field label="Condition in"><select name="conditionIn" defaultValue={AssetCondition.GOOD}>{Object.values(AssetCondition).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Check-in date"><input name="checkedInAt" type="date" defaultValue={today} required /></Field><Field label="Return note" wide><textarea name="notes" rows={3} placeholder="Optional condition or return note" /></Field></div><label className="check-control danger-check"><input name="openRepair" type="checkbox" /><span><strong>Open a repair for damage</strong><small>The asset moves directly into the repair queue in the same transaction.</small></span></label><Field label="Repair description"><input name="repairDescription" placeholder="Required only when opening a repair" /></Field></div></section><div className="station-submit"><SubmitButton>Complete check-in</SubmitButton><span>The assignment history remains permanent.</span></div></form></main>;
}
