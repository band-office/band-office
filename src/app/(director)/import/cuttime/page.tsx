import Link from "next/link";
import { ArrowLeft, Waypoints } from "lucide-react";
import { CutTimeMigrationWizard } from "@/components/cuttime-migration-wizard";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";

export const metadata = { title: "Migrate from CutTime" };

export default async function CutTimeMigrationPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  await requirePermission("RUN_MIGRATION");
  const params = await searchParams;
  return <main className="content narrow-content"><Link className="back-link" href="/import"><ArrowLeft size={15} />Back to imports</Link><PageHeader eyebrow="One-time migration" title="Migrate from CutTime" description="Bring a new program into Band Office from exported CutTime files. This is a cutover, not a live sync." icon={Waypoints} /><FlashMessage {...params} /><CutTimeMigrationWizard /></main>;
}
