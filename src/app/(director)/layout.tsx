import { AppShell } from "@/components/app-shell";
import { getDb } from "@/lib/db";
import { ALL_PERMISSIONS, hasPermission, requireUser } from "@/lib/auth";
import { getProgram } from "@/lib/program-context";

export default async function DirectorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const program = await getProgram(getDb());
  return <AppShell programName={program.name} username={user.username} role={user.role} permissions={ALL_PERMISSIONS.filter((permission) => hasPermission(user, permission))}>{children}</AppShell>;
}
