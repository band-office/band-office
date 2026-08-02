import { ArrowLeft, UsersRound } from "lucide-react";
import Link from "next/link";
import { CutTimeGuardianImport } from "@/components/cuttime-guardian-import";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";

export const metadata = { title: "Import CutTime Guardians" };

export default async function CutTimeGuardianImportPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requirePermission("MANAGE_PEOPLE");
  const params = await searchParams;
  return <main className="content narrow-content"><Link className="back-link" href="/import"><ArrowLeft size={15} />Back to imports</Link><PageHeader eyebrow="People and access" title="Import CutTime guardians" description="Populate family links from Guardian 1 and Guardian 2 columns in the CutTime member export." icon={UsersRound} /><FlashMessage {...params} /><CutTimeGuardianImport /></main>;
}
