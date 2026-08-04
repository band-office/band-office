"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AssignmentResolution,
  ComponentStatus,
  FinancialEntryType,
  EmailAudienceRecipientKind,
  EmailAudienceTargetType,
  EmailContactStatus,
  EmailProviderKind,
  GroupKind,
  PersonClassificationType,
  PersonStatus,
  RepairStatus,
  StaffRole,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  checkinAssetWithOptionalRepair,
  checkoutAsset,
  createAsset,
  deleteAsset,
  createGroup,
  createGuardianAndLinkStudent,
  createPerson,
  createRepair,
  addPersonClassification,
  addGroupMembership,
  endGroupMembership,
  linkGuardianStudent,
  unlinkGuardianStudent,
  updateAsset,
  updateAssetComponent,
  updateAssignment,
  updateGroup,
  updatePerson,
  updateRepair,
  rolloverOperatingPeriod,
  importStudents,
  importAssets,
  type StudentImportRow,
  type AssetImportRow,
  updateProgramSettings,
} from "@/lib/inventory-service";
import { postFinancialEntry, postGroupAssessment, reverseFinancialEntry } from "@/lib/financial-service";
import {
  cancelAnnouncement,
  confirmOverdueAnnouncement,
  createAnnouncement,
  saveEmailConnection,
  saveEmailTemplate,
  sendAnnouncement,
  testEmailConnection,
  updateEmailContactState,
  updateAnnouncement,
  type AudienceTargetInput,
  type AnnouncementAttachmentInput,
} from "@/lib/communications-service";
import { getProgramContext } from "@/lib/program-context";
import { createStaffAccount, hasPermission, requirePermission, updateStaffRole, type Permission } from "@/lib/auth";
import { createPortalAccount, setPortalAccountEnabled } from "@/lib/portal-auth";

async function currentActor(permission: Permission) {
  const user = await requirePermission(permission);
  return user.username;
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  return textValue(formData, key) || null;
}

function dateValue(formData: FormData, key: string, fallback = new Date()) {
  const value = textValue(formData, key);
  return value ? new Date(`${value}T12:00:00`) : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The operation could not be completed.";
}

function withMessage(path: string, kind: "success" | "error", message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

export async function createPersonAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    const firstName = textValue(formData, "firstName");
    const lastName = textValue(formData, "lastName");
    if (!firstName || !lastName) throw new Error("First and last name are required.");
    const classifications = formData.getAll("classifications").filter((value): value is string => typeof value === "string").map((value) => value as PersonClassificationType);
    const student = classifications.includes(PersonClassificationType.STUDENT)
      ? { grade: Number(textValue(formData, "grade")), schoolStudentId: optionalText(formData, "schoolStudentId") }
      : undefined;
    await createPerson(getDb(), {
      programId: program.id,
      firstName,
      lastName,
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      status: PersonStatus.ACTIVE,
      notes: optionalText(formData, "notes"),
      classifications,
      student,
      groupIds: formData.getAll("groupIds").filter((value): value is string => typeof value === "string"),
    }, await currentActor("MANAGE_PEOPLE"));
  } catch (error) {
    redirect(withMessage("/roster", "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  redirect(withMessage("/roster", "success", "Person added to the directory."));
}

export async function updatePersonAction(formData: FormData) {
  const id = textValue(formData, "id");
  try {
    await updatePerson(getDb(), id, {
      firstName: textValue(formData, "firstName"),
      lastName: textValue(formData, "lastName"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      status: textValue(formData, "status") as PersonStatus,
      notes: optionalText(formData, "notes"),
      student: textValue(formData, "isStudent") === "true" ? { grade: Number(textValue(formData, "grade")), schoolStudentId: optionalText(formData, "schoolStudentId") } : undefined,
    }, await currentActor("MANAGE_PEOPLE"));
  } catch (error) {
    redirect(withMessage(`/roster/${id}`, "error", errorMessage(error)));
  }
  revalidatePath(`/roster/${id}`);
  revalidatePath("/roster");
  redirect(withMessage(`/roster/${id}`, "success", "Person record updated."));
}

export async function addPersonClassificationAction(formData: FormData) {
  const id = textValue(formData, "personId");
  const classification = textValue(formData, "classification") as PersonClassificationType;
  try {
    const actor = await currentActor("MANAGE_PEOPLE");
    if (classification === PersonClassificationType.STUDENT) {
      const grade = Number(textValue(formData, "grade"));
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error("A student classification requires a grade from 1 to 12.");
      await updatePerson(getDb(), id, { student: { grade, schoolStudentId: optionalText(formData, "schoolStudentId") } }, actor);
    } else {
      await addPersonClassification(getDb(), id, classification, actor);
    }
  } catch (error) {
    redirect(withMessage(`/roster/${id}`, "error", errorMessage(error)));
  }
  revalidatePath(`/roster/${id}`);
  revalidatePath("/roster");
  redirect(withMessage(`/roster/${id}`, "success", "Person classification added."));
}

export async function createGroupAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    await createGroup(getDb(), {
      programId: program.id,
      name: textValue(formData, "name"),
      kind: textValue(formData, "kind") as GroupKind,
      description: optionalText(formData, "description"),
    }, await currentActor("MANAGE_GROUPS"));
  } catch (error) {
    redirect(withMessage("/groups", "error", errorMessage(error)));
  }
  revalidatePath("/groups");
  redirect(withMessage("/groups", "success", "Group created."));
}

export async function updateGroupAction(formData: FormData) {
  const id = textValue(formData, "id");
  try {
    await updateGroup(getDb(), id, {
      name: textValue(formData, "name"),
      kind: textValue(formData, "kind") as GroupKind,
      description: optionalText(formData, "description"),
      active: formData.get("active") === "on",
    }, await currentActor("MANAGE_GROUPS"));
  } catch (error) {
    redirect(withMessage(`/groups/${id}`, "error", errorMessage(error)));
  }
  revalidatePath(`/groups/${id}`);
  revalidatePath("/groups");
  redirect(withMessage(`/groups/${id}`, "success", "Group updated."));
}

export async function addGroupMembershipAction(formData: FormData) {
  const groupId = textValue(formData, "groupId");
  const personId = textValue(formData, "personId");
  const returnTo = textValue(formData, "returnTo") || `/groups/${groupId}`;
  try {
    await addGroupMembership(getDb(), { groupId, personId, roleLabel: optionalText(formData, "roleLabel") }, await currentActor("MANAGE_GROUPS"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/groups");
  revalidatePath("/roster");
  redirect(withMessage(returnTo, "success", "Group membership saved."));
}

export async function endGroupMembershipAction(formData: FormData) {
  const id = textValue(formData, "id");
  const returnTo = textValue(formData, "returnTo") || "/groups";
  try {
    await endGroupMembership(getDb(), id, await currentActor("MANAGE_GROUPS"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/groups");
  revalidatePath("/roster");
  redirect(withMessage(returnTo, "success", "Group membership ended."));
}

export async function linkGuardianStudentAction(formData: FormData) {
  const studentId = textValue(formData, "studentId");
  const returnTo = textValue(formData, "returnTo") || `/roster/${studentId}`;
  try {
    await linkGuardianStudent(getDb(), {
      guardianId: textValue(formData, "guardianId"),
      studentId,
      relationshipLabel: optionalText(formData, "relationshipLabel"),
      primaryContact: formData.get("primaryContact") === "on",
      receivesCommunication: formData.get("receivesCommunication") === "on",
    }, await currentActor("MANAGE_PEOPLE"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  redirect(withMessage(returnTo, "success", "Guardian relationship saved."));
}

export async function createGuardianAndLinkStudentAction(formData: FormData) {
  const studentId = textValue(formData, "studentId");
  const returnTo = textValue(formData, "returnTo") || `/roster/${studentId}`;
  try {
    await createGuardianAndLinkStudent(getDb(), {
      studentId,
      firstName: textValue(formData, "firstName"),
      lastName: textValue(formData, "lastName"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      relationshipLabel: optionalText(formData, "relationshipLabel"),
      primaryContact: formData.get("primaryContact") === "on",
      receivesCommunication: formData.get("receivesCommunication") === "on",
    }, await currentActor("MANAGE_PEOPLE"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  redirect(withMessage(returnTo, "success", "Guardian created and linked."));
}

export async function unlinkGuardianStudentAction(formData: FormData) {
  const returnTo = textValue(formData, "returnTo") || "/roster";
  try {
    await unlinkGuardianStudent(getDb(), textValue(formData, "id"), await currentActor("MANAGE_PEOPLE"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  redirect(withMessage(returnTo, "success", "Guardian relationship removed."));
}

export async function createStaffAccountAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    await createStaffAccount({
      programId: program.id,
      personId: textValue(formData, "personId"),
      username: textValue(formData, "username"),
      password: textValue(formData, "password"),
      role: textValue(formData, "role") as StaffRole,
    }, await currentActor("MANAGE_USERS"));
  } catch (error) {
    redirect(withMessage("/settings", "error", errorMessage(error)));
  }
  revalidatePath("/settings");
  redirect(withMessage("/settings", "success", "Staff account created."));
}

export async function updateStaffRoleAction(formData: FormData) {
  try {
    await updateStaffRole(textValue(formData, "userId"), textValue(formData, "role") as StaffRole, await currentActor("MANAGE_USERS"));
  } catch (error) {
    redirect(withMessage("/settings", "error", errorMessage(error)));
  }
  revalidatePath("/settings");
  redirect(withMessage("/settings", "success", "Staff role updated."));
}

export async function createPortalAccountAction(formData: FormData) {
  const personId = textValue(formData, "personId");
  const returnTo = `/roster/${personId}`;
  try {
    await createPortalAccount(getDb(), personId, await currentActor("MANAGE_USERS"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath(returnTo);
  redirect(withMessage(returnTo, "success", "Portal access enabled. The student or guardian can now set a password from the portal sign-in page."));
}

export async function setPortalAccountEnabledAction(formData: FormData) {
  const personId = textValue(formData, "personId");
  const returnTo = `/roster/${personId}`;
  try {
    await setPortalAccountEnabled(
      getDb(),
      textValue(formData, "portalUserId"),
      textValue(formData, "enabled") === "true",
      await currentActor("MANAGE_USERS"),
    );
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath(returnTo);
  redirect(withMessage(returnTo, "success", textValue(formData, "enabled") === "true" ? "Portal access enabled." : "Portal access disabled and existing portal sessions ended."));
}

export async function postFinancialEntryAction(formData: FormData) {
  const personId = textValue(formData, "personId");
  const returnTo = textValue(formData, "returnTo") || `/financials/${personId}`;
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    await postFinancialEntry(getDb(), {
      programId: program.id,
      personId,
      operatingPeriodId: operatingPeriod.id,
      groupId: optionalText(formData, "groupId"),
      type: textValue(formData, "type") as Exclude<FinancialEntryType, "REVERSAL">,
      amount: textValue(formData, "amount"),
      occurredAt: dateValue(formData, "occurredAt"),
      dueDate: textValue(formData, "dueDate") ? dateValue(formData, "dueDate") : null,
      description: textValue(formData, "description"),
      reference: optionalText(formData, "reference"),
    }, await currentActor("MANAGE_FINANCIALS"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath("/financials");
  revalidatePath(`/financials/${personId}`);
  revalidatePath(`/roster/${personId}`);
  redirect(withMessage(returnTo, "success", "Financial entry posted."));
}

export async function postGroupAssessmentAction(formData: FormData) {
  let successMessage = "Group assessment posted.";
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    const result = await postGroupAssessment(getDb(), {
      programId: program.id,
      operatingPeriodId: operatingPeriod.id,
      groupId: textValue(formData, "groupId"),
      amount: textValue(formData, "amount"),
      occurredAt: dateValue(formData, "occurredAt"),
      dueDate: textValue(formData, "dueDate") ? dateValue(formData, "dueDate") : null,
      description: textValue(formData, "description"),
    }, await currentActor("MANAGE_FINANCIALS"));
    successMessage = `Assessment posted to ${result.studentCount} student accounts.`;
  } catch (error) {
    redirect(withMessage("/financials", "error", errorMessage(error)));
  }
  revalidatePath("/financials");
  revalidatePath("/reports");
  redirect(withMessage("/financials", "success", successMessage));
}

export async function reverseFinancialEntryAction(formData: FormData) {
  const personId = textValue(formData, "personId");
  try {
    await reverseFinancialEntry(
      getDb(),
      textValue(formData, "entryId"),
      dateValue(formData, "occurredAt"),
      textValue(formData, "reason"),
      await currentActor("MANAGE_FINANCIALS"),
    );
  } catch (error) {
    redirect(withMessage(`/financials/${personId}`, "error", errorMessage(error)));
  }
  revalidatePath("/financials");
  revalidatePath(`/financials/${personId}`);
  redirect(withMessage(`/financials/${personId}`, "success", "Ledger entry reversed. The original remains in the statement."));
}

function audienceTargets(formData: FormData): AudienceTargetInput[] {
  const targets: AudienceTargetInput[] = [];
  for (const classification of formData.getAll("classificationTargets").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.CLASSIFICATION, recipientKind: EmailAudienceRecipientKind.SELF, classification: classification as PersonClassificationType });
  }
  for (const groupId of formData.getAll("groupMembers").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.GROUP, recipientKind: EmailAudienceRecipientKind.SELF, groupId });
  }
  for (const groupId of formData.getAll("groupGuardians").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.GROUP, recipientKind: EmailAudienceRecipientKind.GUARDIANS, groupId });
  }
  for (const grade of formData.getAll("gradeStudents").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.GRADE, recipientKind: EmailAudienceRecipientKind.SELF, grade: Number(grade) });
  }
  for (const grade of formData.getAll("gradeGuardians").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.GRADE, recipientKind: EmailAudienceRecipientKind.GUARDIANS, grade: Number(grade) });
  }
  for (const personId of formData.getAll("personIds").filter((value): value is string => typeof value === "string")) {
    targets.push({ targetType: EmailAudienceTargetType.PERSON, recipientKind: EmailAudienceRecipientKind.SELF, personId });
  }
  return targets;
}

async function announcementAttachments(formData: FormData): Promise<AnnouncementAttachmentInput[]> {
  const attachments: AnnouncementAttachmentInput[] = [];
  for (const value of formData.getAll("attachments")) {
    if (!(value instanceof File) || !value.size) continue;
    attachments.push({ fileName: value.name, mimeType: value.type || "application/octet-stream", content: new Uint8Array(await value.arrayBuffer()) });
  }
  return attachments;
}

export async function createAnnouncementAction(formData: FormData) {
  let announcementId = "";
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    const scheduledValue = textValue(formData, "scheduledAt");
    const announcement = await createAnnouncement(getDb(), {
      programId: program.id,
      operatingPeriodId: operatingPeriod.id,
      subject: textValue(formData, "subject"),
      body: textValue(formData, "body"),
      scheduledAt: scheduledValue ? new Date(scheduledValue) : null,
      targets: audienceTargets(formData),
      attachments: await announcementAttachments(formData),
    }, await currentActor("MANAGE_COMMUNICATIONS"));
    announcementId = announcement.id;
  } catch (error) {
    redirect(withMessage("/communications/new", "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage(`/communications/${announcementId}`, "success", "Audience snapshot created. Review every recipient before sending."));
}

export async function updateAnnouncementAction(formData: FormData) {
  const id = textValue(formData, "announcementId");
  try {
    const scheduledValue = textValue(formData, "scheduledAt");
    await updateAnnouncement(getDb(), id, {
      subject: textValue(formData, "subject"),
      body: textValue(formData, "body"),
      scheduledAt: scheduledValue ? new Date(scheduledValue) : null,
      targets: audienceTargets(formData),
      attachments: await announcementAttachments(formData),
      removeAttachmentIds: formData.getAll("removeAttachmentIds").filter((value): value is string => typeof value === "string"),
    }, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage(`/communications/${id}/edit`, "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage(`/communications/${id}`, "success", "Announcement and audience snapshot updated."));
}

export async function sendAnnouncementAction(formData: FormData) {
  const id = textValue(formData, "announcementId");
  let kind: "success" | "error" = "success";
  let message = "Announcement sent.";
  try {
    const result = await sendAnnouncement(getDb(), id, await currentActor("MANAGE_COMMUNICATIONS"));
    kind = result.failed ? "error" : "success";
    message = result.failed ? `${result.sent} messages accepted; ${result.failed} failed and remain in the retry queue.` : `${result.sent} messages accepted by the email provider.`;
  } catch (error) {
    redirect(withMessage(`/communications/${id}`, "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage(`/communications/${id}`, kind, message));
}

export async function cancelAnnouncementAction(formData: FormData) {
  const id = textValue(formData, "announcementId");
  try {
    await cancelAnnouncement(getDb(), id, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage(`/communications/${id}`, "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage(`/communications/${id}`, "success", "Announcement canceled."));
}

export async function confirmOverdueAnnouncementAction(formData: FormData) {
  const id = textValue(formData, "announcementId");
  let kind: "success" | "error" = "success";
  let message = "Scheduled announcement sent.";
  try {
    const actor = await currentActor("MANAGE_COMMUNICATIONS");
    await confirmOverdueAnnouncement(getDb(), id, actor);
    const result = await sendAnnouncement(getDb(), id, actor);
    kind = result.failed ? "error" : "success";
    message = `${result.sent} messages accepted; ${result.failed} failed.`;
  } catch (error) {
    redirect(withMessage(`/communications/${id}`, "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage(`/communications/${id}`, kind, message));
}

export async function saveEmailConnectionAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    await saveEmailConnection(getDb(), {
      programId: program.id,
      provider: EmailProviderKind.SMTP,
      fromName: textValue(formData, "fromName"),
      fromAddress: textValue(formData, "fromAddress"),
      replyTo: optionalText(formData, "replyTo"),
      smtpHost: optionalText(formData, "smtpHost"),
      smtpPort: Number(textValue(formData, "smtpPort")),
      smtpSecure: formData.get("smtpSecure") === "on",
      authUsername: optionalText(formData, "authUsername"),
      credentialReference: "desktop-safe-storage-or-environment",
    }, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage("/communications/settings", "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage("/communications/settings", "success", "Shared mailbox settings saved. Verify the connection before sending."));
}

export async function testEmailConnectionAction() {
  try {
    const { program } = await getProgramContext(getDb());
    await testEmailConnection(getDb(), program.id, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage("/communications/settings", "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage("/communications/settings", "success", "Connection verified. Band Office can authenticate with the SMTP server."));
}

export async function saveEmailTemplateAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    await saveEmailTemplate(getDb(), { programId: program.id, name: textValue(formData, "name"), subject: textValue(formData, "subject"), body: textValue(formData, "body") }, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage("/communications", "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage("/communications", "success", "Email template saved."));
}

export async function updateEmailContactStateAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    await updateEmailContactState(getDb(), { programId: program.id, email: textValue(formData, "email"), status: textValue(formData, "status") as EmailContactStatus, reason: optionalText(formData, "reason") }, await currentActor("MANAGE_COMMUNICATIONS"));
  } catch (error) {
    redirect(withMessage("/communications/contacts", "error", errorMessage(error)));
  }
  revalidatePath("/communications");
  redirect(withMessage("/communications/contacts", "success", "Contact delivery state updated."));
}

export async function createAssetAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    const category = textValue(formData, "category") as AssetCategory;
    await createAsset(getDb(), {
      programId: program.id,
      category,
      make: optionalText(formData, "make"),
      model: optionalText(formData, "model"),
      serialNumber: optionalText(formData, "serialNumber"),
      schoolAssetTag: optionalText(formData, "schoolAssetTag"),
      size: optionalText(formData, "size"),
      condition: textValue(formData, "condition") as AssetCondition,
      purchaseYear: textValue(formData, "purchaseYear") ? Number(textValue(formData, "purchaseYear")) : null,
      estimatedValue: textValue(formData, "estimatedValue") || null,
      location: optionalText(formData, "location"),
      notes: optionalText(formData, "notes"),
    }, await currentActor("MANAGE_INVENTORY"));
  } catch (error) {
    redirect(withMessage("/assets", "error", errorMessage(error)));
  }
  revalidatePath("/assets");
  redirect(withMessage("/assets", "success", "Asset added to inventory."));
}

export async function updateAssetAction(formData: FormData) {
  const id = textValue(formData, "id");
  try {
    const user = await requirePermission("MANAGE_INVENTORY");
    const status = optionalText(formData, "status") as AssetStatus | null;
    await updateAsset(getDb(), id, {
      category: textValue(formData, "category") as AssetCategory,
      make: optionalText(formData, "make"),
      model: optionalText(formData, "model"),
      serialNumber: optionalText(formData, "serialNumber"),
      schoolAssetTag: optionalText(formData, "schoolAssetTag"),
      size: optionalText(formData, "size"),
      condition: textValue(formData, "condition") as AssetCondition,
      purchaseYear: textValue(formData, "purchaseYear") ? Number(textValue(formData, "purchaseYear")) : null,
      estimatedValue: textValue(formData, "estimatedValue") || null,
      location: optionalText(formData, "location"),
      ...(status === AssetStatus.AVAILABLE || status === AssetStatus.RETIRED || status === AssetStatus.MISSING ? { status } : {}),
      ...(hasPermission(user, "VIEW_NOTES") ? { notes: optionalText(formData, "notes") } : {}),
    }, user.username);
  } catch (error) {
    redirect(withMessage(`/assets/${id}`, "error", errorMessage(error)));
  }
  revalidatePath(`/assets/${id}`);
  revalidatePath("/assets");
  redirect(withMessage(`/assets/${id}`, "success", "Asset record updated."));
}

export async function deleteAssetAction(formData: FormData) {
  const id = textValue(formData, "id");
  try {
    await deleteAsset(getDb(), id, await currentActor("MANAGE_INVENTORY"));
  } catch (error) {
    redirect(withMessage(`/assets/${id}`, "error", errorMessage(error)));
  }
  revalidatePath("/assets");
  redirect(withMessage("/assets", "success", "Unused asset deleted."));
}

export async function updateComponentAction(formData: FormData) {
  const id = textValue(formData, "id");
  const assetId = textValue(formData, "assetId");
  try {
    const user = await requirePermission("MANAGE_INVENTORY");
    await updateAssetComponent(getDb(), id, {
      status: textValue(formData, "status") as ComponentStatus,
      ...(hasPermission(user, "VIEW_NOTES") ? { notes: optionalText(formData, "notes") } : {}),
    }, user.username);
  } catch (error) {
    redirect(withMessage(`/assets/${assetId}`, "error", errorMessage(error)));
  }
  revalidatePath(`/assets/${assetId}`);
  redirect(withMessage(`/assets/${assetId}`, "success", "Component status updated."));
}

export async function checkoutAction(formData: FormData) {
  let assignmentId = "";
  try {
    const { operatingPeriod } = await getProgramContext(getDb());
    const assignment = await checkoutAsset(getDb(), {
      assetId: textValue(formData, "assetId"),
      personId: textValue(formData, "personId"),
      groupId: optionalText(formData, "groupId"),
      operatingPeriodId: operatingPeriod.id,
      checkedOutAt: dateValue(formData, "checkedOutAt"),
      expectedReturnAt: textValue(formData, "expectedReturnAt") ? dateValue(formData, "expectedReturnAt") : null,
      conditionOut: textValue(formData, "conditionOut") as AssetCondition,
      agreementOnFile: formData.get("agreementOnFile") === "on",
      notes: optionalText(formData, "notes"),
    }, await currentActor("MANAGE_ASSIGNMENTS"));
    assignmentId = assignment.id;
  } catch (error) {
    redirect(withMessage("/checkout", "error", errorMessage(error)));
  }
  revalidatePath("/");
  redirect(`/agreements/${assignmentId}?new=1`);
}

export async function checkinAction(formData: FormData) {
  try {
    const assignmentId = textValue(formData, "assignmentId");
    const damaged = formData.get("openRepair") === "on";
    const repairDescription = optionalText(formData, "repairDescription");
    if (damaged && !repairDescription) throw new Error("Describe the damage before opening a repair.");
    await checkinAssetWithOptionalRepair(getDb(), assignmentId, {
      checkedInAt: dateValue(formData, "checkedInAt"),
      conditionIn: textValue(formData, "conditionIn") as AssetCondition,
      resolution: AssignmentResolution.RETURNED,
      notes: optionalText(formData, "notes"),
      repair: damaged ? { description: repairDescription! } : undefined,
    }, await currentActor("MANAGE_ASSIGNMENTS"));
  } catch (error) {
    redirect(withMessage("/checkin", "error", errorMessage(error)));
  }
  revalidatePath("/");
  redirect(withMessage("/checkin", "success", "Check-in recorded and asset status updated."));
}

export async function updateAgreementAction(formData: FormData) {
  const assignmentId = textValue(formData, "assignmentId");
  const returnTo = textValue(formData, "returnTo") || "/today";
  try {
    await updateAssignment(getDb(), assignmentId, { agreementOnFile: true }, await currentActor("MANAGE_ASSIGNMENTS"));
  } catch (error) {
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
  revalidatePath(returnTo);
  redirect(withMessage(returnTo, "success", "Agreement marked on file."));
}

export async function createRepairAction(formData: FormData) {
  try {
    const { operatingPeriod } = await getProgramContext(getDb());
    await createRepair(getDb(), {
      assetId: textValue(formData, "assetId"),
      operatingPeriodId: operatingPeriod.id,
      openedAt: dateValue(formData, "openedAt"),
      description: textValue(formData, "description"),
      vendor: optionalText(formData, "vendor"),
      cost: textValue(formData, "cost") || null,
      status: textValue(formData, "status") as RepairStatus,
    }, await currentActor("MANAGE_REPAIRS"));
  } catch (error) {
    redirect(withMessage("/repairs", "error", errorMessage(error)));
  }
  revalidatePath("/repairs");
  redirect(withMessage("/repairs", "success", "Repair added to the queue."));
}

export async function rolloverAction(formData: FormData) {
  let successMessage = "Rollover completed.";
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    if (textValue(formData, "confirmation") !== operatingPeriod.label) {
      throw new Error(`Type ${operatingPeriod.label} to confirm rollover.`);
    }
    const result = await rolloverOperatingPeriod(getDb(), {
      programId: program.id,
      currentPeriodId: operatingPeriod.id,
      nextLabel: textValue(formData, "nextLabel"),
      nextStartsAt: dateValue(formData, "nextStartsAt"),
    }, await currentActor("ROLLOVER"));
    successMessage = `Opened ${result.nextPeriod.label}. ${result.promoted} students advanced and ${result.graduated} graduated.`;
  } catch (error) {
    redirect(withMessage("/rollover", "error", errorMessage(error)));
  }
  revalidatePath("/");
  redirect(withMessage("/today", "success", successMessage));
}

export async function importStudentsAction(formData: FormData) {
  let successMessage = "Roster import complete.";
  try {
    const { program } = await getProgramContext(getDb());
    const parsed = JSON.parse(textValue(formData, "rowsJson")) as Array<Record<string, string>>;
    const rows: StudentImportRow[] = parsed.map((row) => ({
      firstName: row.firstName?.trim(), lastName: row.lastName?.trim(), grade: Number(row.grade), section: row.section?.trim(), schoolStudentId: row.schoolStudentId?.trim() || null,
    }));
    const result = await importStudents(getDb(), program.id, rows, await currentActor("MANAGE_PEOPLE"));
    successMessage = `Roster import complete: ${result.created} created, ${result.updated} updated.`;
  } catch (error) {
    redirect(withMessage("/import", "error", errorMessage(error)));
  }
  revalidatePath("/roster");
  redirect(withMessage("/import", "success", successMessage));
}

export async function importAssetsAction(formData: FormData) {
  let successMessage = "Asset import complete.";
  try {
    const { program } = await getProgramContext(getDb());
    const parsed = JSON.parse(textValue(formData, "rowsJson")) as Array<Record<string, string>>;
    const rows: AssetImportRow[] = parsed.map((row) => ({
      category: row.category?.trim().toUpperCase() as AssetCategory,
      schoolAssetTag: row.schoolAssetTag?.trim(),
      make: row.make?.trim() || null,
      model: row.model?.trim() || null,
      serialNumber: row.serialNumber?.trim() || null,
      size: row.size?.trim() || null,
      condition: row.condition?.trim().toUpperCase() as AssetCondition,
      purchaseYear: row.purchaseYear?.trim() ? Number(row.purchaseYear) : null,
      estimatedValue: row.estimatedValue?.trim() ? Number(row.estimatedValue) : null,
      location: row.location?.trim() || null,
    }));
    const result = await importAssets(getDb(), program.id, rows, await currentActor("MANAGE_INVENTORY"));
    successMessage = `Asset import complete: ${result.created} created, ${result.updated} updated.`;
  } catch (error) {
    redirect(withMessage("/import?kind=assets", "error", errorMessage(error)));
  }
  revalidatePath("/assets");
  redirect(withMessage("/import?kind=assets", "success", successMessage));
}

export async function updateProgramSettingsAction(formData: FormData) {
  try {
    const { program } = await getProgramContext(getDb());
    const graduationGrade = Number(textValue(formData, "graduationGrade"));
    if (!Number.isInteger(graduationGrade) || graduationGrade < 1 || graduationGrade > 12) throw new Error("Graduation grade must be between 1 and 12.");
    await updateProgramSettings(getDb(), program.id, {
      name: textValue(formData, "name"),
      graduationGrade,
      agreementTemplate: optionalText(formData, "agreementTemplate"),
    }, await currentActor("MANAGE_SETTINGS"));
  } catch (error) {
    redirect(withMessage("/settings", "error", errorMessage(error)));
  }
  revalidatePath("/");
  redirect(withMessage("/settings", "success", "Program settings updated."));
}

export async function closeRepairAction(formData: FormData) {
  const id = textValue(formData, "id");
  try {
    await updateRepair(getDb(), id, {
      status: RepairStatus.CLOSED,
      closedAt: dateValue(formData, "closedAt"),
      vendor: optionalText(formData, "vendor"),
      cost: textValue(formData, "cost") || null,
    }, await currentActor("MANAGE_REPAIRS"));
  } catch (error) {
    redirect(withMessage("/repairs", "error", errorMessage(error)));
  }
  revalidatePath("/repairs");
  redirect(withMessage("/repairs", "success", "Repair closed and asset returned to service."));
}
