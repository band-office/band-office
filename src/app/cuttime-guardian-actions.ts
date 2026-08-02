"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { commitCutTimeGuardianImport, previewCutTimeGuardianImport } from "@/lib/cuttime-guardian-import";
import type { CutTimeGuardianImportInput } from "@/lib/cuttime-migration-types";
import { getDb } from "@/lib/db";
import { getProgramContext } from "@/lib/program-context";

function withMessage(path: string, kind: "success" | "error", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(value)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The guardian import could not be completed.";
}

export async function previewCutTimeGuardianImportAction(input: CutTimeGuardianImportInput) {
  await requirePermission("MANAGE_PEOPLE");
  const db = getDb();
  const { program } = await getProgramContext(db);
  return previewCutTimeGuardianImport(db, program.id, input);
}

export async function commitCutTimeGuardianImportAction(formData: FormData) {
  let result: Awaited<ReturnType<typeof commitCutTimeGuardianImport>>;
  try {
    const raw = formData.get("guardianImportJson");
    if (typeof raw !== "string" || !raw) throw new Error("Preview the CutTime guardian import before committing it.");
    const guardians = JSON.parse(raw) as CutTimeGuardianImportInput;
    const user = await requirePermission("MANAGE_PEOPLE");
    const db = getDb();
    const { program } = await getProgramContext(db);
    result = await commitCutTimeGuardianImport(db, { programId: program.id, actor: user.username, guardians });
  } catch (error) {
    redirect(withMessage("/import/cuttime-guardians", "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  revalidatePath("/groups");
  redirect(withMessage("/roster", "success", `CutTime guardian import complete: ${result.preview.counts.guardians} guardians created and ${result.preview.counts.links} family links added.`));
}
