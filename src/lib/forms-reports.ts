import { Prisma } from "@/generated/prisma/client";
import type { createPrismaClient } from "@/lib/db";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

export async function formCampaignCompletion(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.id AS campaign_id, campaign.name, template.name AS template_name,
      version.version AS template_version, campaign.audienceSummary AS audience,
      campaign.recipientMode AS recipient_mode, campaign.dueAt AS due_at,
      COUNT(request.id) AS total_requests,
      SUM(CASE WHEN request.status = 'COMPLETE' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN request.status IN ('OUTSTANDING', 'IN_PROGRESS') THEN 1 ELSE 0 END) AS outstanding,
      SUM(CASE WHEN request.status = 'WAIVED' THEN 1 ELSE 0 END) AS waived
    FROM FormCampaign campaign
    JOIN FormTemplateVersion version ON version.id = campaign.templateVersionId
    JOIN FormTemplate template ON template.id = version.templateId
    LEFT JOIN FormRequest request ON request.campaignId = campaign.id
    WHERE campaign.programId = ${programId}
    GROUP BY campaign.id
    ORDER BY campaign.createdAt DESC
  `);
}

export async function outstandingFormRequests(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.name AS campaign, version.title AS form_title, campaign.dueAt AS due_at,
      subject.lastName || ', ' || subject.firstName AS student,
      recipient.lastName || ', ' || recipient.firstName AS recipient,
      CASE WHEN request.recipientPersonId = request.subjectPersonId THEN 'student' ELSE 'guardian' END AS recipient_kind,
      request.status, request.createdAt AS requested_at,
      COUNT(reminder.id) AS reminder_count, MAX(reminder.createdAt) AS last_reminded_at
    FROM FormRequest request
    JOIN FormCampaign campaign ON campaign.id = request.campaignId
    JOIN FormTemplateVersion version ON version.id = campaign.templateVersionId
    JOIN Person subject ON subject.id = request.subjectPersonId
    JOIN Person recipient ON recipient.id = request.recipientPersonId
    LEFT JOIN FormReminder reminder ON reminder.requestId = request.id
    WHERE campaign.programId = ${programId} AND request.status IN ('OUTSTANDING', 'IN_PROGRESS')
    GROUP BY request.id
    ORDER BY campaign.dueAt, subject.lastName, subject.firstName, recipient.lastName
  `);
}

export async function formResponseExtract(db: DatabaseClient, programId: string, campaignId?: string | null) {
  const campaignFilter = campaignId ? Prisma.sql`AND campaign.id = ${campaignId}` : Prisma.empty;
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.id AS campaign_id, campaign.name AS campaign,
      subject.lastName || ', ' || subject.firstName AS student,
      recipient.lastName || ', ' || recipient.firstName AS recipient,
      response.status AS response_status, response.submittedAt AS submitted_at,
      response.recordedBy AS recorded_by, question.position AS question_number,
      question.prompt, question.type AS question_type, answer.textValue AS text_response,
      answer.choiceValuesJson AS choice_response, answer.booleanValue AS checked,
      answer.acknowledgmentRecordedAt AS acknowledged_at
    FROM FormResponse response
    JOIN FormRequest request ON request.id = response.requestId
    JOIN FormCampaign campaign ON campaign.id = request.campaignId
    JOIN Person subject ON subject.id = request.subjectPersonId
    JOIN Person recipient ON recipient.id = request.recipientPersonId
    LEFT JOIN FormAnswer answer ON answer.responseId = response.id
    LEFT JOIN FormQuestion question ON question.id = answer.questionId
    WHERE campaign.programId = ${programId} ${campaignFilter}
    ORDER BY campaign.createdAt DESC, subject.lastName, recipient.lastName, question.position
  `);
}

export async function formUploadRegister(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.name AS campaign, subject.lastName || ', ' || subject.firstName AS student,
      recipient.lastName || ', ' || recipient.firstName AS recipient, question.prompt,
      upload.fileName AS file_name, upload.mimeType AS mime_type, upload.byteSize AS byte_size,
      upload.contentHash AS sha256, upload.status, upload.createdAt AS uploaded_at, upload.removedAt AS removed_at
    FROM FormUpload upload
    JOIN FormResponse response ON response.id = upload.responseId
    JOIN FormRequest request ON request.id = response.requestId
    JOIN FormCampaign campaign ON campaign.id = request.campaignId
    JOIN Person subject ON subject.id = request.subjectPersonId
    JOIN Person recipient ON recipient.id = request.recipientPersonId
    JOIN FormQuestion question ON question.id = upload.questionId
    WHERE campaign.programId = ${programId}
    ORDER BY upload.createdAt DESC
  `);
}

export async function formReminderHistory(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.name AS campaign, subject.lastName || ', ' || subject.firstName AS student,
      recipient.lastName || ', ' || recipient.firstName AS recipient,
      reminder.createdAt AS reminder_created_at, reminder.createdBy AS created_by,
      reminder.announcementId AS announcement_id
    FROM FormReminder reminder
    JOIN FormRequest request ON request.id = reminder.requestId
    JOIN FormCampaign campaign ON campaign.id = request.campaignId
    JOIN Person subject ON subject.id = request.subjectPersonId
    JOIN Person recipient ON recipient.id = request.recipientPersonId
    WHERE campaign.programId = ${programId}
    ORDER BY reminder.createdAt DESC
  `);
}

export async function formRetentionStatus(db: DatabaseClient, programId: string) {
  return db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT campaign.name AS campaign, subject.lastName || ', ' || subject.firstName AS student,
      recipient.lastName || ', ' || recipient.firstName AS recipient,
      request.status AS request_status, response.status AS response_status,
      response.submittedAt AS submitted_at, request.retentionExpiresAt AS retention_expires_at,
      response.purgedAt AS purged_at,
      CASE WHEN response.status = 'PURGED' THEN 'purged'
        WHEN request.retentionExpiresAt IS NULL THEN 'manual retention'
        WHEN request.retentionExpiresAt <= CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'retained' END AS retention_state
    FROM FormRequest request
    JOIN FormCampaign campaign ON campaign.id = request.campaignId
    JOIN Person subject ON subject.id = request.subjectPersonId
    JOIN Person recipient ON recipient.id = request.recipientPersonId
    LEFT JOIN FormResponse response ON response.requestId = request.id
    WHERE campaign.programId = ${programId}
    ORDER BY request.retentionExpiresAt, campaign.createdAt DESC
  `);
}
