import { randomUUID } from "node:crypto";
import {
  FormAudienceType,
  FormQuestionType,
  FormRecipientMode,
  FormRequestStatus,
  FormResponseStatus,
  FormTemplateVersionStatus,
  FormUploadStatus,
  PersonClassificationType,
  PersonStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;
type TransactionClient = Prisma.TransactionClient;

export class FormInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormInvariantError";
  }
}

function required(value: string, label: string, max = 500) {
  const clean = value.trim();
  if (!clean) throw new FormInvariantError(`${label} is required.`);
  if (clean.length > max) throw new FormInvariantError(`${label} cannot exceed ${max} characters.`);
  return clean;
}

function optional(value: string | null | undefined, max = 20_000) {
  const clean = value?.trim() || null;
  if (clean && clean.length > max) throw new FormInvariantError(`Text cannot exceed ${max} characters.`);
  return clean;
}

function auditFields(fields: string[]) {
  return JSON.stringify({ fields, values: "[redacted]" });
}

async function audit(tx: TransactionClient, input: { programId: string; actor: string; action: string; entityType: string; entityId: string; summary: string; fields?: string[] }) {
  await tx.auditLog.create({ data: { id: randomUUID(), programId: input.programId, actor: input.actor, action: input.action, entityType: input.entityType, entityId: input.entityId, changeSummary: input.summary, changeDiffJson: input.fields ? auditFields(input.fields) : null } });
}

export async function createFormTemplate(db: DatabaseClient, input: { programId: string; name: string; description?: string | null; title: string; instructions?: string | null; retentionDays?: number | null }, actor: string) {
  if (input.retentionDays !== null && input.retentionDays !== undefined && (input.retentionDays < 1 || input.retentionDays > 3650)) throw new FormInvariantError("Retention must be between 1 and 3650 days, or left blank for manual retention.");
  return db.$transaction(async (tx) => {
    const template = await tx.formTemplate.create({ data: { id: randomUUID(), programId: input.programId, name: required(input.name, "Template name", 120), description: optional(input.description, 1000), createdBy: actor } });
    const version = await tx.formTemplateVersion.create({ data: { id: randomUUID(), templateId: template.id, version: 1, title: required(input.title, "Form title", 160), instructions: optional(input.instructions), retentionDays: input.retentionDays ?? null, createdBy: actor } });
    await audit(tx, { programId: input.programId, actor, action: "CREATE", entityType: "FormTemplate", entityId: template.id, summary: "Created form template and draft version", fields: ["name", "description", "title", "instructions", "retentionDays"] });
    return { template, version };
  });
}

export async function updateDraftFormVersion(db: DatabaseClient, versionId: string, input: { name: string; description?: string | null; title: string; instructions?: string | null; retentionDays?: number | null }, actor: string) {
  if (input.retentionDays !== null && input.retentionDays !== undefined && (input.retentionDays < 1 || input.retentionDays > 3650)) throw new FormInvariantError("Retention must be between 1 and 3650 days, or left blank for manual retention.");
  return db.$transaction(async (tx) => {
    const existing = await tx.formTemplateVersion.findUnique({ where: { id: versionId }, include: { template: true } });
    if (!existing) throw new FormInvariantError("Form version not found.");
    if (existing.status !== FormTemplateVersionStatus.DRAFT) throw new FormInvariantError("Published form versions are immutable. Create a revision instead.");
    await tx.formTemplate.update({ where: { id: existing.templateId }, data: { name: required(input.name, "Template name", 120), description: optional(input.description, 1000) } });
    const version = await tx.formTemplateVersion.update({ where: { id: versionId }, data: { title: required(input.title, "Form title", 160), instructions: optional(input.instructions), retentionDays: input.retentionDays ?? null } });
    await audit(tx, { programId: existing.template.programId, actor, action: "UPDATE", entityType: "FormTemplateVersion", entityId: version.id, summary: "Updated draft form template", fields: ["name", "description", "title", "instructions", "retentionDays"] });
    return version;
  });
}

function normalizeOptions(type: FormQuestionType, options: string[]) {
  if (type !== FormQuestionType.SINGLE_CHOICE && type !== FormQuestionType.MULTIPLE_CHOICE) return null;
  const cleaned = [...new Set(options.map((value) => value.trim()).filter(Boolean))];
  if (cleaned.length < 2) throw new FormInvariantError("Choice questions require at least two distinct options.");
  if (cleaned.length > 30) throw new FormInvariantError("Choice questions can have at most 30 options.");
  return JSON.stringify(cleaned);
}

export async function addFormQuestion(db: DatabaseClient, input: { versionId: string; prompt: string; helpText?: string | null; type: FormQuestionType; required: boolean; options?: string[] }, actor: string) {
  return db.$transaction(async (tx) => {
    const version = await tx.formTemplateVersion.findUnique({ where: { id: input.versionId }, include: { template: true, _count: { select: { questions: true } } } });
    if (!version) throw new FormInvariantError("Form version not found.");
    if (version.status !== FormTemplateVersionStatus.DRAFT) throw new FormInvariantError("Published form versions cannot be changed.");
    const question = await tx.formQuestion.create({ data: { id: randomUUID(), versionId: version.id, position: version._count.questions + 1, prompt: required(input.prompt, "Question", 500), helpText: optional(input.helpText, 1000), type: input.type, required: input.type === FormQuestionType.ACKNOWLEDGMENT ? true : input.required, optionsJson: normalizeOptions(input.type, input.options ?? []) } });
    await audit(tx, { programId: version.template.programId, actor, action: "CREATE", entityType: "FormQuestion", entityId: question.id, summary: "Added question to draft form", fields: ["prompt", "helpText", "type", "required", "options"] });
    return question;
  });
}

export async function removeFormQuestion(db: DatabaseClient, questionId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const question = await tx.formQuestion.findUnique({ where: { id: questionId }, include: { version: { include: { template: true } } } });
    if (!question) throw new FormInvariantError("Question not found.");
    if (question.version.status !== FormTemplateVersionStatus.DRAFT) throw new FormInvariantError("Published form versions cannot be changed.");
    await tx.formQuestion.delete({ where: { id: questionId } });
    const remaining = await tx.formQuestion.findMany({ where: { versionId: question.versionId }, orderBy: { position: "asc" } });
    for (let index = 0; index < remaining.length; index += 1) await tx.formQuestion.update({ where: { id: remaining[index].id }, data: { position: index + 1 } });
    await audit(tx, { programId: question.version.template.programId, actor, action: "DELETE", entityType: "FormQuestion", entityId: question.id, summary: "Removed question from draft form" });
  });
}

export async function moveFormQuestion(db: DatabaseClient, questionId: string, direction: "up" | "down", actor: string) {
  return db.$transaction(async (tx) => {
    const question = await tx.formQuestion.findUnique({ where: { id: questionId }, include: { version: { include: { template: true } } } });
    if (!question) throw new FormInvariantError("Question not found.");
    if (question.version.status !== FormTemplateVersionStatus.DRAFT) throw new FormInvariantError("Published form versions cannot be changed.");
    const targetPosition = question.position + (direction === "up" ? -1 : 1);
    const target = await tx.formQuestion.findUnique({ where: { versionId_position: { versionId: question.versionId, position: targetPosition } } });
    if (!target) return question;
    await tx.formQuestion.update({ where: { id: question.id }, data: { position: 0 } });
    await tx.formQuestion.update({ where: { id: target.id }, data: { position: question.position } });
    const moved = await tx.formQuestion.update({ where: { id: question.id }, data: { position: targetPosition } });
    await audit(tx, { programId: question.version.template.programId, actor, action: "REORDER", entityType: "FormQuestion", entityId: question.id, summary: "Reordered draft form question", fields: ["position"] });
    return moved;
  });
}

export async function publishFormVersion(db: DatabaseClient, versionId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const version = await tx.formTemplateVersion.findUnique({ where: { id: versionId }, include: { template: true, questions: true } });
    if (!version) throw new FormInvariantError("Form version not found.");
    if (version.status !== FormTemplateVersionStatus.DRAFT) throw new FormInvariantError("Only a draft version can be published.");
    if (!version.questions.length) throw new FormInvariantError("Add at least one question before publishing.");
    await tx.formTemplateVersion.updateMany({ where: { templateId: version.templateId, status: FormTemplateVersionStatus.PUBLISHED }, data: { status: FormTemplateVersionStatus.RETIRED } });
    const published = await tx.formTemplateVersion.update({ where: { id: versionId }, data: { status: FormTemplateVersionStatus.PUBLISHED, publishedAt: new Date() } });
    await audit(tx, { programId: version.template.programId, actor, action: "PUBLISH", entityType: "FormTemplateVersion", entityId: version.id, summary: "Published immutable form template version", fields: ["status", "publishedAt"] });
    return published;
  });
}

export async function createFormRevision(db: DatabaseClient, templateId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const template = await tx.formTemplate.findUnique({ where: { id: templateId }, include: { versions: { include: { questions: { orderBy: { position: "asc" } } }, orderBy: { version: "desc" } } } });
    if (!template) throw new FormInvariantError("Form template not found.");
    if (template.versions.some((version) => version.status === FormTemplateVersionStatus.DRAFT)) throw new FormInvariantError("Finish the existing draft before creating another revision.");
    const source = template.versions[0];
    if (!source) throw new FormInvariantError("Form template has no source version.");
    const version = await tx.formTemplateVersion.create({ data: { id: randomUUID(), templateId, version: source.version + 1, title: source.title, instructions: source.instructions, retentionDays: source.retentionDays, createdBy: actor } });
    if (source.questions.length) await tx.formQuestion.createMany({ data: source.questions.map((question) => ({ id: randomUUID(), versionId: version.id, position: question.position, prompt: question.prompt, helpText: question.helpText, type: question.type, required: question.required, optionsJson: question.optionsJson })) });
    await audit(tx, { programId: template.programId, actor, action: "CREATE_REVISION", entityType: "FormTemplateVersion", entityId: version.id, summary: "Created draft revision from published form", fields: ["version"] });
    return version;
  });
}

async function campaignSubjects(tx: TransactionClient, input: { programId: string; audienceType: FormAudienceType; audienceValue?: string | null }) {
  const common = { programId: input.programId, status: PersonStatus.ACTIVE, classifications: { some: { classification: PersonClassificationType.STUDENT } } } as const;
  if (input.audienceType === FormAudienceType.GROUP) {
    if (!input.audienceValue) throw new FormInvariantError("Choose a group.");
    return tx.person.findMany({ where: { ...common, groupMemberships: { some: { groupId: input.audienceValue, endedAt: null } } }, include: { studentGuardianLinks: { include: { guardian: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  }
  if (input.audienceType === FormAudienceType.GRADE) {
    const grade = Number(input.audienceValue);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new FormInvariantError("Choose a valid grade.");
    return tx.person.findMany({ where: { ...common, studentProfile: { grade } }, include: { studentGuardianLinks: { include: { guardian: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  }
  if (input.audienceType === FormAudienceType.PERSON) {
    if (!input.audienceValue) throw new FormInvariantError("Choose a student.");
    return tx.person.findMany({ where: { ...common, id: input.audienceValue }, include: { studentGuardianLinks: { include: { guardian: true } } } });
  }
  return tx.person.findMany({ where: common, include: { studentGuardianLinks: { include: { guardian: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
}

export async function createFormCampaign(db: DatabaseClient, input: { programId: string; operatingPeriodId: string; templateVersionId: string; name: string; dueAt?: Date | null; audienceType: FormAudienceType; audienceValue?: string | null; audienceSummary: string; recipientMode: FormRecipientMode }, actor: string) {
  return db.$transaction(async (tx) => {
    const version = await tx.formTemplateVersion.findUnique({ where: { id: input.templateVersionId }, include: { template: true } });
    if (!version || version.template.programId !== input.programId || version.status !== FormTemplateVersionStatus.PUBLISHED) throw new FormInvariantError("Choose a published form version from this program.");
    const period = await tx.operatingPeriod.findUnique({ where: { id: input.operatingPeriodId } });
    if (!period || period.programId !== input.programId) throw new FormInvariantError("Choose an operating period from this program.");
    const subjects = await campaignSubjects(tx, input);
    if (!subjects.length) throw new FormInvariantError("The selected audience has no active students.");
    const campaign = await tx.formCampaign.create({ data: { id: randomUUID(), programId: input.programId, operatingPeriodId: input.operatingPeriodId, templateVersionId: version.id, name: required(input.name, "Request name", 160), dueAt: input.dueAt ?? null, audienceType: input.audienceType, audienceValue: optional(input.audienceValue, 200), audienceSummary: required(input.audienceSummary, "Audience summary", 300), recipientMode: input.recipientMode, createdBy: actor } });
    const rows: Array<{ id: string; campaignId: string; recipientPersonId: string; subjectPersonId: string }> = [];
    for (const subject of subjects) {
      if (input.recipientMode === FormRecipientMode.STUDENTS || input.recipientMode === FormRecipientMode.BOTH) rows.push({ id: randomUUID(), campaignId: campaign.id, recipientPersonId: subject.id, subjectPersonId: subject.id });
      if (input.recipientMode === FormRecipientMode.GUARDIANS || input.recipientMode === FormRecipientMode.BOTH) {
        for (const link of subject.studentGuardianLinks) if (link.guardian.status === PersonStatus.ACTIVE) rows.push({ id: randomUUID(), campaignId: campaign.id, recipientPersonId: link.guardianId, subjectPersonId: subject.id });
      }
    }
    if (!rows.length) throw new FormInvariantError("The selected audience produced no student or guardian requests.");
    await tx.formRequest.createMany({ data: rows });
    await audit(tx, { programId: input.programId, actor, action: "CREATE", entityType: "FormCampaign", entityId: campaign.id, summary: `Created form request campaign with ${rows.length} recipient requests`, fields: ["templateVersionId", "name", "dueAt", "audienceType", "audienceValue", "recipientMode"] });
    return { campaign, requestCount: rows.length };
  });
}

export type FormAnswerInput = { questionId: string; textValue?: string | null; choices?: string[]; booleanValue?: boolean | null; acknowledged?: boolean };
export type FormUploadInput = { questionId: string; fileName: string; mimeType: string; byteSize: number; storageKey: string; contentHash: string };

function hasAnswer(question: { type: FormQuestionType }, answer: FormAnswerInput | undefined, uploadCount: number) {
  if (question.type === FormQuestionType.FILE_UPLOAD) return uploadCount > 0;
  if (question.type === FormQuestionType.SHORT_TEXT || question.type === FormQuestionType.LONG_TEXT) return Boolean(answer?.textValue?.trim());
  if (question.type === FormQuestionType.SINGLE_CHOICE || question.type === FormQuestionType.MULTIPLE_CHOICE) return Boolean(answer?.choices?.length);
  if (question.type === FormQuestionType.CHECKBOX) return answer?.booleanValue === true;
  return answer?.acknowledged === true;
}

export async function saveFormResponse(db: DatabaseClient, requestId: string, input: { answers: FormAnswerInput[]; uploads: FormUploadInput[]; submit: boolean }, actor: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.formRequest.findUnique({
      where: { id: requestId },
      include: {
        campaign: { include: { templateVersion: { include: { questions: { orderBy: { position: "asc" } } } } } },
        response: { include: { uploads: { where: { status: FormUploadStatus.ACTIVE } } } },
      },
    });
    if (!request) throw new FormInvariantError("Form request not found.");
    if (request.status === FormRequestStatus.WAIVED) throw new FormInvariantError("Waived requests cannot receive responses.");
    if (request.response?.status === FormResponseStatus.PURGED) throw new FormInvariantError("Purged responses cannot be restored. Create a new request if collection is still required.");
    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer]));
    const questionIds = new Set(request.campaign.templateVersion.questions.map((question) => question.id));
    if (input.answers.some((answer) => !questionIds.has(answer.questionId)) || input.uploads.some((upload) => !questionIds.has(upload.questionId))) throw new FormInvariantError("Response contains a question outside this form version.");
    const existingUploads = request.response?.uploads ?? [];
    if (input.submit) {
      const missing = request.campaign.templateVersion.questions.filter((question) => question.required && !hasAnswer(question, answerMap.get(question.id), existingUploads.filter((upload) => upload.questionId === question.id).length + input.uploads.filter((upload) => upload.questionId === question.id).length));
      if (missing.length) throw new FormInvariantError(`Complete required question: ${missing[0].prompt}`);
    }
    const now = new Date();
    const response = request.response
      ? await tx.formResponse.update({ where: { id: request.response.id }, data: { status: input.submit ? FormResponseStatus.SUBMITTED : FormResponseStatus.DRAFT, submittedAt: input.submit ? now : null, recordedBy: actor } })
      : await tx.formResponse.create({ data: { id: randomUUID(), requestId, status: input.submit ? FormResponseStatus.SUBMITTED : FormResponseStatus.DRAFT, submittedAt: input.submit ? now : null, recordedBy: actor } });
    for (const question of request.campaign.templateVersion.questions) {
      const answer = answerMap.get(question.id);
      if (!answer) continue;
      const choices = answer.choices?.map((choice) => choice.trim()).filter(Boolean) ?? [];
      if (choices.length && question.optionsJson) {
        const valid = new Set(JSON.parse(question.optionsJson) as string[]);
        if (choices.some((choice) => !valid.has(choice))) throw new FormInvariantError(`Invalid choice supplied for: ${question.prompt}`);
      }
      await tx.formAnswer.upsert({ where: { responseId_questionId: { responseId: response.id, questionId: question.id } }, create: { id: randomUUID(), responseId: response.id, questionId: question.id, textValue: optional(answer.textValue), choiceValuesJson: choices.length ? JSON.stringify(choices) : null, booleanValue: answer.booleanValue ?? null, acknowledgmentRecordedAt: answer.acknowledged ? now : null }, update: { textValue: optional(answer.textValue), choiceValuesJson: choices.length ? JSON.stringify(choices) : null, booleanValue: answer.booleanValue ?? null, acknowledgmentRecordedAt: answer.acknowledged ? now : null } });
    }
    for (const upload of input.uploads) await tx.formUpload.create({ data: { id: randomUUID(), responseId: response.id, questionId: upload.questionId, fileName: upload.fileName, mimeType: upload.mimeType, byteSize: upload.byteSize, storageKey: upload.storageKey, contentHash: upload.contentHash } });
    const retentionDays = request.campaign.templateVersion.retentionDays;
    await tx.formRequest.update({ where: { id: requestId }, data: { status: input.submit ? FormRequestStatus.COMPLETE : FormRequestStatus.IN_PROGRESS, completedAt: input.submit ? now : null, retentionExpiresAt: input.submit && retentionDays ? new Date(now.getTime() + retentionDays * 86_400_000) : null } });
    await audit(tx, { programId: request.campaign.programId, actor, action: input.submit ? "SUBMIT" : "SAVE_DRAFT", entityType: "FormResponse", entityId: response.id, summary: input.submit ? "Recorded completed form response" : "Saved form response draft", fields: ["answers", "uploads", "status", "submittedAt", "retentionExpiresAt"] });
    return response;
  });
}

export async function waiveFormRequest(db: DatabaseClient, requestId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.formRequest.findUnique({ where: { id: requestId }, include: { campaign: true } });
    if (!request) throw new FormInvariantError("Form request not found.");
    if (request.status === FormRequestStatus.COMPLETE) throw new FormInvariantError("Completed requests cannot be waived.");
    const waived = await tx.formRequest.update({ where: { id: requestId }, data: { status: FormRequestStatus.WAIVED, waivedAt: new Date() } });
    await audit(tx, { programId: request.campaign.programId, actor, action: "WAIVE", entityType: "FormRequest", entityId: request.id, summary: "Waived outstanding form request", fields: ["status", "waivedAt"] });
    return waived;
  });
}

export async function recordFormReminders(db: DatabaseClient, campaignId: string, requestIds: string[], announcementId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const campaign = await tx.formCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new FormInvariantError("Form campaign not found.");
    const eligible = await tx.formRequest.findMany({ where: { campaignId, id: { in: requestIds }, status: { in: [FormRequestStatus.OUTSTANDING, FormRequestStatus.IN_PROGRESS] } }, select: { id: true } });
    if (!eligible.length) throw new FormInvariantError("No outstanding recipients are eligible for a reminder.");
    await tx.formReminder.createMany({ data: eligible.map((request) => ({ id: randomUUID(), requestId: request.id, announcementId, createdBy: actor })) });
    await audit(tx, { programId: campaign.programId, actor, action: "CREATE_REMINDER", entityType: "FormCampaign", entityId: campaignId, summary: `Created email reminder draft for ${eligible.length} form requests`, fields: ["announcementId", "requestIds"] });
    return eligible.length;
  });
}

export async function purgeExpiredFormResponses(db: DatabaseClient, campaignId: string, actor: string) {
  return db.$transaction(async (tx) => {
    const campaign = await tx.formCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new FormInvariantError("Form campaign not found.");
    const responses = await tx.formResponse.findMany({ where: { request: { campaignId, retentionExpiresAt: { lte: new Date() } }, status: FormResponseStatus.SUBMITTED }, include: { uploads: { where: { status: FormUploadStatus.ACTIVE } } } });
    const storageKeys = responses.flatMap((response) => response.uploads.map((upload) => upload.storageKey));
    for (const response of responses) {
      await tx.formAnswer.deleteMany({ where: { responseId: response.id } });
      await tx.formUpload.updateMany({ where: { responseId: response.id, status: FormUploadStatus.ACTIVE }, data: { status: FormUploadStatus.REMOVED, removedAt: new Date() } });
      await tx.formResponse.update({ where: { id: response.id }, data: { status: FormResponseStatus.PURGED, purgedAt: new Date() } });
    }
    await audit(tx, { programId: campaign.programId, actor, action: "PURGE", entityType: "FormCampaign", entityId: campaignId, summary: `Purged ${responses.length} expired form responses while retaining completion history`, fields: ["answers", "uploads", "responseStatus"] });
    return { count: responses.length, storageKeys };
  });
}
