"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EmailAudienceRecipientKind,
  EmailAudienceTargetType,
  FormAudienceType,
  FormQuestionType,
  FormRecipientMode,
} from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { createAnnouncement } from "@/lib/communications-service";
import { getDb } from "@/lib/db";
import { deleteFormFile, storeFormFile } from "@/lib/form-storage";
import {
  addFormQuestion,
  createFormCampaign,
  createFormRevision,
  createFormTemplate,
  moveFormQuestion,
  publishFormVersion,
  purgeExpiredFormResponses,
  recordFormReminders,
  removeFormQuestion,
  saveFormResponse,
  updateDraftFormVersion,
  waiveFormRequest,
  type FormAnswerInput,
  type FormUploadInput,
} from "@/lib/forms-service";
import { getProgramContext } from "@/lib/program-context";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function integer(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Enter a whole number of days.");
  return parsed;
}

function date(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date.");
  return parsed;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The form operation could not be completed.";
}

function withMessage(path: string, kind: "success" | "error", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(value)}`;
}

async function actor(permission: "MANAGE_FORMS" | "RECORD_FORM_RESPONSES") {
  return (await requirePermission(permission)).username;
}

export async function createFormTemplateAction(formData: FormData) {
  let templateId = "";
  try {
    const { program } = await getProgramContext(getDb());
    const result = await createFormTemplate(getDb(), { programId: program.id, name: text(formData, "name"), description: optional(formData, "description"), title: text(formData, "title"), instructions: optional(formData, "instructions"), retentionDays: integer(formData, "retentionDays") }, await actor("MANAGE_FORMS"));
    templateId = result.template.id;
  } catch (error) {
    redirect(withMessage("/forms", "error", message(error)));
  }
  revalidatePath("/forms");
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "Draft form created. Add questions before publishing."));
}

export async function updateDraftFormVersionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try {
    await updateDraftFormVersion(getDb(), text(formData, "versionId"), { name: text(formData, "name"), description: optional(formData, "description"), title: text(formData, "title"), instructions: optional(formData, "instructions"), retentionDays: integer(formData, "retentionDays") }, await actor("MANAGE_FORMS"));
  } catch (error) {
    redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error)));
  }
  revalidatePath("/forms");
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "Draft form details updated."));
}

export async function addFormQuestionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try {
    const typeValue = text(formData, "type");
    if (!Object.values(FormQuestionType).includes(typeValue as FormQuestionType)) throw new Error("Choose a valid question type.");
    await addFormQuestion(getDb(), { versionId: text(formData, "versionId"), prompt: text(formData, "prompt"), helpText: optional(formData, "helpText"), type: typeValue as FormQuestionType, required: formData.get("required") === "on", options: text(formData, "options").split("\n") }, await actor("MANAGE_FORMS"));
  } catch (error) {
    redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error)));
  }
  revalidatePath(`/forms/templates/${templateId}`);
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "Question added."));
}

export async function removeFormQuestionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try { await removeFormQuestion(getDb(), text(formData, "questionId"), await actor("MANAGE_FORMS")); }
  catch (error) { redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error))); }
  revalidatePath(`/forms/templates/${templateId}`);
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "Question removed."));
}

export async function moveFormQuestionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try { await moveFormQuestion(getDb(), text(formData, "questionId"), text(formData, "direction") === "down" ? "down" : "up", await actor("MANAGE_FORMS")); }
  catch (error) { redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error))); }
  revalidatePath(`/forms/templates/${templateId}`);
  redirect(`/forms/templates/${templateId}`);
}

export async function publishFormVersionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try { await publishFormVersion(getDb(), text(formData, "versionId"), await actor("MANAGE_FORMS")); }
  catch (error) { redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error))); }
  revalidatePath("/forms");
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "Form version published and locked for use."));
}

export async function createFormRevisionAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  try { await createFormRevision(getDb(), templateId, await actor("MANAGE_FORMS")); }
  catch (error) { redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error))); }
  revalidatePath(`/forms/templates/${templateId}`);
  redirect(withMessage(`/forms/templates/${templateId}`, "success", "New draft revision created from the latest version."));
}

async function audienceSummary(type: FormAudienceType, value: string | null) {
  if (type === FormAudienceType.ACTIVE_STUDENTS) return "All active students";
  if (type === FormAudienceType.GRADE) return `Grade ${value}`;
  const db = getDb();
  if (type === FormAudienceType.GROUP) return (await db.group.findUnique({ where: { id: value ?? "" }, select: { name: true } }))?.name ?? "Selected group";
  const person = await db.person.findUnique({ where: { id: value ?? "" }, select: { firstName: true, lastName: true } });
  return person ? `${person.firstName} ${person.lastName}`.trim() : "Selected student";
}

export async function createFormCampaignAction(formData: FormData) {
  const templateId = text(formData, "templateId");
  let campaignId = "";
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    const audienceTypeValue = text(formData, "audienceType");
    const recipientModeValue = text(formData, "recipientMode");
    if (!Object.values(FormAudienceType).includes(audienceTypeValue as FormAudienceType)) throw new Error("Choose a valid audience.");
    if (!Object.values(FormRecipientMode).includes(recipientModeValue as FormRecipientMode)) throw new Error("Choose students, guardians, or both.");
    const audienceType = audienceTypeValue as FormAudienceType;
    const audienceValue = audienceType === FormAudienceType.GROUP ? optional(formData, "groupId") : audienceType === FormAudienceType.GRADE ? optional(formData, "grade") : audienceType === FormAudienceType.PERSON ? optional(formData, "personId") : null;
    const result = await createFormCampaign(getDb(), { programId: program.id, operatingPeriodId: operatingPeriod.id, templateVersionId: text(formData, "versionId"), name: text(formData, "name"), dueAt: date(formData, "dueAt"), audienceType, audienceValue, audienceSummary: await audienceSummary(audienceType, audienceValue), recipientMode: recipientModeValue as FormRecipientMode }, await actor("MANAGE_FORMS"));
    campaignId = result.campaign.id;
  } catch (error) {
    redirect(withMessage(`/forms/templates/${templateId}`, "error", message(error)));
  }
  revalidatePath("/forms");
  redirect(withMessage(`/forms/campaigns/${campaignId}`, "success", "Recipient requests created from the current People and Groups records."));
}

export async function saveFormResponseAction(formData: FormData) {
  const requestId = text(formData, "requestId");
  const campaignId = text(formData, "campaignId");
  const stored: FormUploadInput[] = [];
  try {
    const request = await getDb().formRequest.findUnique({ where: { id: requestId }, include: { campaign: { include: { templateVersion: { include: { questions: true } } } } } });
    if (!request) throw new Error("Form request not found.");
    const answers: FormAnswerInput[] = [];
    for (const question of request.campaign.templateVersion.questions) {
      const name = `q_${question.id}`;
      if (question.type === FormQuestionType.SHORT_TEXT || question.type === FormQuestionType.LONG_TEXT) answers.push({ questionId: question.id, textValue: text(formData, name) });
      else if (question.type === FormQuestionType.SINGLE_CHOICE || question.type === FormQuestionType.MULTIPLE_CHOICE) answers.push({ questionId: question.id, choices: formData.getAll(name).filter((value): value is string => typeof value === "string") });
      else if (question.type === FormQuestionType.CHECKBOX) answers.push({ questionId: question.id, booleanValue: formData.get(name) === "on" });
      else if (question.type === FormQuestionType.ACKNOWLEDGMENT) answers.push({ questionId: question.id, acknowledged: formData.get(name) === "on" });
      else if (question.type === FormQuestionType.FILE_UPLOAD) {
        const file = formData.get(`file_${question.id}`);
        if (file instanceof File && file.size) stored.push({ questionId: question.id, ...(await storeFormFile(requestId, file)) });
      }
    }
    await saveFormResponse(getDb(), requestId, { answers, uploads: stored, submit: text(formData, "intent") !== "draft" }, await actor("RECORD_FORM_RESPONSES"));
  } catch (error) {
    await Promise.all(stored.map((file) => deleteFormFile(file.storageKey).catch(() => undefined)));
    redirect(withMessage(`/forms/requests/${requestId}`, "error", message(error)));
  }
  revalidatePath(`/forms/campaigns/${campaignId}`);
  redirect(withMessage(`/forms/campaigns/${campaignId}`, "success", text(formData, "intent") === "draft" ? "Response draft saved." : "Response marked complete."));
}

export async function waiveFormRequestAction(formData: FormData) {
  const campaignId = text(formData, "campaignId");
  try { await waiveFormRequest(getDb(), text(formData, "requestId"), await actor("MANAGE_FORMS")); }
  catch (error) { redirect(withMessage(`/forms/campaigns/${campaignId}`, "error", message(error))); }
  revalidatePath(`/forms/campaigns/${campaignId}`);
  redirect(withMessage(`/forms/campaigns/${campaignId}`, "success", "Request waived; the recipient remains in campaign history."));
}

export async function createFormReminderAction(formData: FormData) {
  const campaignId = text(formData, "campaignId");
  let announcementId = "";
  try {
    const formActor = await actor("MANAGE_FORMS");
    await requirePermission("MANAGE_COMMUNICATIONS");
    const campaign = await getDb().formCampaign.findUnique({ where: { id: campaignId }, include: { requests: { where: { status: { in: ["OUTSTANDING", "IN_PROGRESS"] } }, include: { recipientPerson: true } }, templateVersion: true } });
    if (!campaign || !campaign.requests.length) throw new Error("This campaign has no outstanding recipients.");
    const uniquePeople = [...new Set(campaign.requests.map((request) => request.recipientPersonId))];
    const announcement = await createAnnouncement(getDb(), { programId: campaign.programId, operatingPeriodId: campaign.operatingPeriodId, subject: `Reminder: ${campaign.name}`, body: `This is a reminder that ${campaign.templateVersion.title} is still outstanding${campaign.dueAt ? ` and is due ${campaign.dueAt.toLocaleDateString()}` : ""}. Please return the requested information to the program staff.`, targets: uniquePeople.map((personId) => ({ targetType: EmailAudienceTargetType.PERSON, recipientKind: EmailAudienceRecipientKind.SELF, personId })), attachments: [] }, formActor);
    announcementId = announcement.id;
    await recordFormReminders(getDb(), campaignId, campaign.requests.map((request) => request.id), announcement.id, formActor);
  } catch (error) {
    redirect(withMessage(`/forms/campaigns/${campaignId}`, "error", message(error)));
  }
  revalidatePath(`/forms/campaigns/${campaignId}`);
  redirect(withMessage(`/communications/${announcementId}`, "success", "Form reminder draft created. Review recipients and release it from Email."));
}

export async function purgeExpiredFormResponsesAction(formData: FormData) {
  const campaignId = text(formData, "campaignId");
  try {
    const result = await purgeExpiredFormResponses(getDb(), campaignId, await actor("MANAGE_FORMS"));
    await Promise.all(result.storageKeys.map((key) => deleteFormFile(key).catch(() => undefined)));
    revalidatePath(`/forms/campaigns/${campaignId}`);
    redirect(withMessage(`/forms/campaigns/${campaignId}`, "success", `${result.count} expired response${result.count === 1 ? "" : "s"} purged; completion history was retained.`));
  } catch (error) {
    redirect(withMessage(`/forms/campaigns/${campaignId}`, "error", message(error)));
  }
}
