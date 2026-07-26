"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LibraryComponentStatus, LibraryLoanStatus, LibraryResourceKind } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  addLibraryComponentNote,
  addLibraryResource,
  addPerformanceRecord,
  archiveLibraryItem,
  checkoutLibraryItem,
  closeLibraryLoan,
  createLibraryItem,
  removeLibraryResource,
  resolveLibraryComponentNote,
  updateLibraryItem,
} from "@/lib/library-service";
import { deleteLibraryFile, storeLibraryFile } from "@/lib/library-storage";
import { getProgramContext } from "@/lib/program-context";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function date(formData: FormData, key: string, required = true) {
  const value = text(formData, key);
  if (!value) {
    if (required) throw new Error(`${key.replaceAll(/([A-Z])/g, " $1").toLowerCase()} is required.`);
    return null;
  }
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date.");
  return parsed;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The library operation could not be completed.";
}

function withMessage(path: string, kind: "success" | "error", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(value)}`;
}

async function actor() {
  return (await requirePermission("MANAGE_LIBRARY")).username;
}

function itemInput(formData: FormData) {
  return {
    title: text(formData, "title"), composer: optional(formData, "composer"), arranger: optional(formData, "arranger"),
    publisher: optional(formData, "publisher"), grade: optional(formData, "grade"), category: optional(formData, "category"),
    catalogNumber: optional(formData, "catalogNumber"), storageLocation: optional(formData, "storageLocation"),
    acquisitionDate: date(formData, "acquisitionDate", false), acquisitionSource: optional(formData, "acquisitionSource"),
    acquisitionCost: optional(formData, "acquisitionCost"), comments: optional(formData, "comments"),
  };
}

export async function createLibraryItemAction(formData: FormData) {
  let itemId = "";
  try {
    const { program } = await getProgramContext(getDb());
    const item = await createLibraryItem(getDb(), { programId: program.id, ...itemInput(formData) }, await actor());
    itemId = item.id;
  } catch (error) {
    redirect(withMessage("/library", "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Music set added to the library."));
}

export async function updateLibraryItemAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    await updateLibraryItem(getDb(), itemId, itemInput(formData), await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  revalidatePath(`/library/${itemId}`);
  redirect(withMessage(`/library/${itemId}`, "success", "Library record updated."));
}

export async function archiveLibraryItemAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    await archiveLibraryItem(getDb(), itemId, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Library record archived. Its history remains available."));
}

export async function addLibraryComponentAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    const statusValue = text(formData, "status");
    const status = statusValue === LibraryComponentStatus.MISSING ? LibraryComponentStatus.MISSING : statusValue === LibraryComponentStatus.DAMAGED ? LibraryComponentStatus.DAMAGED : null;
    if (!status) throw new Error("Choose missing or damaged.");
    await addLibraryComponentNote(getDb(), {
      itemId, componentName: text(formData, "componentName"), status,
      notedAt: date(formData, "notedAt")!, notes: optional(formData, "notes"),
    }, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Component issue recorded."));
}

export async function resolveLibraryComponentAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    await resolveLibraryComponentNote(getDb(), text(formData, "componentNoteId"), date(formData, "resolvedAt")!, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Component marked replaced and resolved."));
}

export async function checkoutLibraryItemAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    const { operatingPeriod } = await getProgramContext(getDb());
    await checkoutLibraryItem(getDb(), {
      itemId, operatingPeriodId: operatingPeriod.id, borrowerPersonId: optional(formData, "borrowerPersonId"), borrowerName: optional(formData, "borrowerName"),
      checkedOutAt: date(formData, "checkedOutAt")!, expectedReturnAt: date(formData, "expectedReturnAt", false), notes: optional(formData, "notes"),
    }, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Complete score-and-parts set checked out."));
}

export async function closeLibraryLoanAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    const statusValue = text(formData, "status");
    const status = statusValue === LibraryLoanStatus.RETURNED ? LibraryLoanStatus.RETURNED : statusValue === LibraryLoanStatus.LOST ? LibraryLoanStatus.LOST : null;
    if (!status) throw new Error("Choose returned or lost.");
    await closeLibraryLoan(getDb(), text(formData, "loanId"), {
      returnedAt: date(formData, "returnedAt")!, status, notes: optional(formData, "notes"),
    }, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Library loan closed."));
}

export async function addPerformanceRecordAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    const { operatingPeriod } = await getProgramContext(getDb());
    await addPerformanceRecord(getDb(), {
      itemId, operatingPeriodId: operatingPeriod.id, eventName: text(formData, "eventName"), performedAt: date(formData, "performedAt")!,
      groupId: optional(formData, "groupId"), conductor: optional(formData, "conductor"), notes: optional(formData, "notes"),
    }, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath("/library");
  redirect(withMessage(`/library/${itemId}`, "success", "Performance added to the set history."));
}

export async function addLibraryLinkAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    if (formData.get("copyrightAcknowledged") !== "on") throw new Error("Acknowledge that the program may retain and use this resource.");
    await addLibraryResource(getDb(), {
      itemId, kind: LibraryResourceKind.EXTERNAL_LINK, label: text(formData, "label"), externalUrl: text(formData, "externalUrl"), copyrightAcknowledgedAt: new Date(),
    }, await actor());
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath(`/library/${itemId}`);
  redirect(withMessage(`/library/${itemId}`, "success", "External resource link added."));
}

export async function uploadLibraryFileAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  let stored: Awaited<ReturnType<typeof storeLibraryFile>> | null = null;
  try {
    if (formData.get("copyrightAcknowledged") !== "on") throw new Error("Acknowledge that the program may retain and use this file.");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a local file.");
    stored = await storeLibraryFile(itemId, file);
    await addLibraryResource(getDb(), {
      itemId, kind: LibraryResourceKind.LOCAL_FILE, label: text(formData, "label") || stored.fileName,
      ...stored, copyrightAcknowledgedAt: new Date(),
    }, await actor());
  } catch (error) {
    if (stored) await deleteLibraryFile(stored.storageKey).catch(() => undefined);
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath(`/library/${itemId}`);
  redirect(withMessage(`/library/${itemId}`, "success", "Local file stored in the managed Band Office library."));
}

export async function removeLibraryResourceAction(formData: FormData) {
  const itemId = text(formData, "itemId");
  try {
    const resource = await removeLibraryResource(getDb(), text(formData, "resourceId"), await actor());
    if (resource.storageKey) await deleteLibraryFile(resource.storageKey);
  } catch (error) {
    redirect(withMessage(`/library/${itemId}`, "error", message(error)));
  }
  revalidatePath(`/library/${itemId}`);
  redirect(withMessage(`/library/${itemId}`, "success", "Library resource removed. Its audit record remains."));
}
