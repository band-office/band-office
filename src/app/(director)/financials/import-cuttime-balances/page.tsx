import { CircleDollarSign } from "lucide-react";
import { CutTimeBalanceImport } from "@/components/cuttime-balance-import";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";

export const metadata = { title: "Import CutTime Balances" };

export default async function CutTimeBalanceImportPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requirePermission("MANAGE_FINANCIALS");
  const params = await searchParams;
  return <main className="content narrow-content"><PageHeader eyebrow="Student fee accounts" title="Import CutTime balances" description="Record one verified opening balance per student without replacing existing people or groups." icon={CircleDollarSign} /><FlashMessage {...params} /><CutTimeBalanceImport /></main>;
}
