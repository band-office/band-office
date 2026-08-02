"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { commitCutTimeMigration, previewCutTimeMigration } from "@/lib/cuttime-migration";
import type { CutTimeMigrationInput } from "@/lib/cuttime-migration-types";
import { getDb } from "@/lib/db";
import { getProgramContext } from "@/lib/program-context";

function withMessage(path: string, kind: "success" | "error", message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The migration could not be completed.";
}

export async function previewCutTimeMigrationAction(input: CutTimeMigrationInput) {
  await requirePermission("RUN_MIGRATION");
  const db = getDb();
  const { program } = await getProgramContext(db);
  return previewCutTimeMigration(db, program.id, input);
}

export async function commitCutTimeMigrationAction(formData: FormData) {
  let result: Awaited<ReturnType<typeof commitCutTimeMigration>>;
  try {
    const user = await requirePermission("RUN_MIGRATION");
    const raw = formData.get("migrationJson");
    if (typeof raw !== "string") throw new Error("Preview the CutTime migration before committing it.");
    const migration = JSON.parse(raw) as CutTimeMigrationInput;
    const db = getDb();
    const { program, operatingPeriod } = await getProgramContext(db);
    result = await commitCutTimeMigration(db, { programId: program.id, operatingPeriodId: operatingPeriod.id, actor: user.username, migration });
  } catch (error) {
    redirect(withMessage("/import/cuttime", "error", errorMessage(error)));
  }
  revalidatePath("/today");
  revalidatePath("/roster");
  revalidatePath("/groups");
  revalidatePath("/assets");
  revalidatePath("/financials");
  redirect(withMessage("/today", "success", `CutTime migration complete: ${result.preview.counts.students} students, ${result.preview.counts.assets} assets, and ${result.preview.counts.openingBalances} opening balances.`));
}
