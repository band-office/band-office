import { ClipboardPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { checkoutAction } from "@/app/actions";
import { Field } from "@/components/field";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { SearchSelect } from "@/components/search-select";
import { AssetCondition, AssetStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { assetName, titleCase } from "@/lib/format";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ person?: string; asset?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  if (!hasPermission(user, "MANAGE_ASSIGNMENTS")) redirect("/today?error=Checkout%20access%20is%20restricted.");
  const program = await getProgram(getDb());
  const [people, groups, assets] = await Promise.all([
    getDb().person.findMany({ where: { programId: program.id, status: "ACTIVE" }, include: { studentProfile: true, classifications: true, groupMemberships: { where: { endedAt: null }, include: { group: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getDb().group.findMany({ where: { programId: program.id, active: true }, orderBy: { name: "asc" } }),
    getDb().asset.findMany({ where: { programId: program.id, status: AssetStatus.AVAILABLE }, orderBy: [{ category: "asc" }, { schoolAssetTag: "asc" }] }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const personOptions = people.map((person) => ({ value: person.id, label: `${person.lastName ? `${person.lastName}, ` : ""}${person.firstName}`, meta: person.studentProfile ? `Grade ${person.studentProfile.grade} · ${person.groupMemberships.map((membership) => membership.group.name).join(", ")} · ${person.studentProfile.schoolStudentId ?? "No student ID"}` : `${person.classifications.map(({ classification }) => titleCase(classification)).join(", ")} · ${person.groupMemberships.map((membership) => membership.group.name).join(", ") || "No groups"}`, groupIds: person.groupMemberships.map((membership) => membership.groupId) }));
  const assetOptions = assets.map((asset) => ({ value: asset.id, label: `${asset.schoolAssetTag ?? "Untagged"} · ${assetName(asset)}`, meta: `${titleCase(asset.category)} · ${titleCase(asset.condition)} · ${asset.location ?? "No location"}`, scanCodes: [asset.schoolAssetTag, asset.serialNumber].filter((code): code is string => Boolean(code)) }));
  return <main className="content station-content"><PageHeader eyebrow="Assignment station" title="Check out an asset" description="Record responsibility and condition in one transaction." icon={ClipboardPlus} /><FlashMessage {...params} /><form action={checkoutAction} className="station-form"><section><span className="step-number">1</span><div><h2>Choose person</h2><p>Search any active student, staff member, booster, or external contact</p><SearchSelect name="personId" label="Person" placeholder="Search the program directory" options={personOptions} defaultValue={params.person} relatedSelect={{ name: "groupId", label: "Group context", options: groups.map((group) => ({ value: group.id, label: group.name })) }} /></div></section><section><span className="step-number">2</span><div><h2>Choose available asset</h2><p>Search by tag, description, category, condition, or location</p><SearchSelect name="assetId" label="Asset" placeholder="Search available inventory" options={assetOptions} defaultValue={params.asset} scanLabel="Scan available asset" /></div></section><section><span className="step-number">3</span><div><h2>Record condition and dates</h2><div className="form-grid"><Field label="Condition out"><select name="conditionOut" defaultValue={AssetCondition.GOOD}>{Object.values(AssetCondition).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Checkout date"><input name="checkedOutAt" type="date" defaultValue={today} required /></Field><Field label="Expected return"><input name="expectedReturnAt" type="date" /></Field><Field label="Assignment note"><input name="notes" placeholder="Optional" /></Field></div><label className="check-control"><input name="agreementOnFile" type="checkbox" /><span><strong>Usage agreement is on file</strong><small>This may be updated later from the person record.</small></span></label></div></section><div className="station-submit"><SubmitButton>Complete checkout</SubmitButton><span>The asset status will change to assigned.</span></div></form></main>;
}
