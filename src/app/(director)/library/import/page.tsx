import { Waypoints } from "lucide-react";
import { CutTimeLibraryImport } from "@/components/cuttime-library-import";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { hasPermission, requireUser } from "@/lib/auth";

export const metadata = { title: "Import CutTime Library" };

export default async function CutTimeLibraryImportPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  if (!hasPermission(user, "MANAGE_LIBRARY")) return null;
  return <main className="content narrow-content"><PageHeader eyebrow="Music library" title="Import from CutTime" description="Bring whole score-and-parts catalog records into an existing Band Office program." icon={Waypoints} /><FlashMessage {...params} /><CutTimeLibraryImport /></main>;
}
