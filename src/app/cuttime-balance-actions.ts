"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { commitCutTimeBalanceImport, previewCutTimeBalanceImport } from "@/lib/cuttime-balance-import";
import type { CutTimeBalanceImportInput } from "@/lib/cuttime-migration-types";
import { getDb } from "@/lib/db";
import { getProgramContext } from "@/lib/program-context";

function withMessage(path: string, kind: "success" | "error", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(value)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The balance import could not be completed.";
}

export async function previewCutTimeBalanceImportAction(input: CutTimeBalanceImportInput) {
  await requirePermission("MANAGE_FINANCIALS");
  const db = getDb();
  const { program } = await getProgramContext(db);
  return previewCutTimeBalanceImport(db, program.id, input);
}

export async function commitCutTimeBalanceImportAction(formData: FormData) {
  let result: Awaited<ReturnType<typeof commitCutTimeBalanceImport>>;
  try {
    const raw = formData.get("balanceImportJson");
    if (typeof raw !== "string" || !raw) throw new Error("Preview the CutTime balance import before committing it.");
    const balances = JSON.parse(raw) as CutTimeBalanceImportInput;
    const user = await requirePermission("MANAGE_FINANCIALS");
    const db = getDb();
    const { program, operatingPeriod } = await getProgramContext(db);
    result = await commitCutTimeBalanceImport(db, { programId: program.id, operatingPeriodId: operatingPeriod.id, actor: user.username, balances });
  } catch (error) {
    redirect(withMessage("/financials/import-cuttime-balances", "error", errorMessage(error)));
  }
  revalidatePath("/financials");
  redirect(withMessage("/financials", "success", `CutTime balances imported: ${result.preview.counts.charges} charges and ${result.preview.counts.credits} credits.`));
}
