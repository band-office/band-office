import { afterAll, describe, expect, it } from "vitest";
import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  ComponentStatus,
  AnnouncementRecipientStatus,
  CommunicationJobStatus,
  EmailAudienceRecipientKind,
  EmailAudienceTargetType,
  EmailContactStatus,
  EmailConnectionStatus,
  EmailProviderKind,
  FinancialEntryType,
  GroupKind,
  LibraryComponentStatus,
  LibraryItemStatus,
  LibraryLoanStatus,
  LibraryResourceKind,
  FormAudienceType,
  FormQuestionType,
  FormRecipientMode,
  AttendanceStatus,
  EventReminderAudience,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  PersonClassificationType,
  PortalUserStatus,
  RepairStatus,
  StaffRole,
} from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import {
  checkinAsset,
  checkinAssetWithOptionalRepair,
  checkoutAsset,
  createAsset,
  createAssetComponent,
  createGuardianAndLinkStudent,
  createGroup,
  createPerson,
  createRepair,
  deleteAsset,
  deleteAssetComponent,
  deleteAssignment,
  deletePerson,
  deleteRepair,
  InventoryInvariantError,
  addGroupMembership,
  linkGuardianStudent,
  unlinkGuardianStudent,
  updateAssetComponent,
  updatePerson,
  updateRepair,
  rolloverOperatingPeriod,
  importAssets,
} from "@/lib/inventory-service";
import {
  fleetValue,
  missingOrDamagedComponents,
  outstandingAssignments,
  repairCostByAsset,
  repairCostByPeriod,
  unassignedAssets,
  whoHasWhat,
} from "@/lib/reports";
import { normalizeAssetCode } from "@/lib/asset-codes";
import { createAssetLabelSvg, paginateLabels } from "@/lib/asset-labels";
import {
  activeAssignments,
  assets,
  CURRENT_PERIOD_ID,
  REPORT_AS_OF,
  RIDGELINE_PROGRAM_ID,
  SEED_EXPECTATIONS,
} from "@/lib/seed-data";
import { hasPermission } from "@/lib/auth";
import { authenticationAllowed, recordAuthenticationResult } from "@/lib/auth-throttle";
import { createPortalAccount, PortalAuthError, requestPortalPasswordReset, resetPortalPassword } from "@/lib/portal-auth";
import { FinancialInvariantError, postFinancialEntry, postGroupAssessment, reverseFinancialEntry } from "@/lib/financial-service";
import { assessmentBatches, financialSummary, financialTransactions, studentBalances } from "@/lib/financial-reports";
import { createAnnouncement, processDueCommunicationJobs, saveEmailConnection, sendAnnouncement, testEmailConnection, updateAnnouncement, updateEmailContactState } from "@/lib/communications-service";
import { addLibraryComponentNote, addLibraryResource, addPerformanceRecord, checkoutLibraryItem, closeLibraryLoan, createLibraryItem, LibraryInvariantError, resolveLibraryComponentNote } from "@/lib/library-service";
import { libraryCatalog, libraryComponentIssues, libraryLoans, libraryPerformanceHistory, libraryResourcePresence, overdueLibraryLoans } from "@/lib/library-reports";
import { addFormQuestion, createFormCampaign, createFormRevision, createFormTemplate, FormInvariantError, publishFormVersion, purgeExpiredFormResponses, saveFormResponse } from "@/lib/forms-service";
import { formCampaignCompletion, formReminderHistory, formResponseExtract, formRetentionStatus, formUploadRegister, outstandingFormRequests } from "@/lib/forms-reports";
import { addEventEquipmentItem, addEventParticipant, addVolunteerSignup, createCalendarSubscription, createEvent, createEventReminderAnnouncement, createVolunteerOpportunity, EventInvariantError, recordAttendance, recordEventRsvp, refreshEventRoster, removeEventParticipant, setEventStatus } from "@/lib/events-service";
import { eventAbsenceReport, eventAttendanceReport, eventEquipmentReport, eventRoster, eventRsvpReport, eventTripRoster, eventVolunteerReport } from "@/lib/events-reports";

const db = createPrismaClient(process.env.DATABASE_URL);

afterAll(async () => {
  await db.$disconnect();
});

describe.sequential("deterministic Ridgeline fixture", () => {
  it("loads every requested entity count", async () => {
    const [personCount, studentCount, groupCount, membershipCount, guardianLinkCount, assetCount, componentCount, activeCount, historicalCount, repairCount, openRepairCount, financialBatchCount, financialEntryCount, libraryItemCount, libraryLoanCount, libraryComponentCount, performanceCount, libraryResourceCount, formTemplateCount, formQuestionCount, formCampaignCount, formRequestCount, eventCount, eventParticipantCount, eventEquipmentCount, volunteerOpportunityCount, volunteerSignupCount] = await Promise.all([
      db.person.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.studentProfile.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.group.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.groupMembership.count({ where: { group: { programId: RIDGELINE_PROGRAM_ID }, endedAt: null } }),
      db.guardianStudent.count({ where: { student: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.asset.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.assetComponent.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.assignment.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID }, checkedInAt: null } }),
      db.assignment.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID }, checkedInAt: { not: null } } }),
      db.repair.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.repair.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID }, status: { in: [RepairStatus.OPEN, RepairStatus.AT_VENDOR] } } }),
      db.financialBatch.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.financialEntry.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.libraryItem.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.libraryLoan.count({ where: { item: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.libraryComponentNote.count({ where: { item: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.performanceRecord.count({ where: { item: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.libraryResource.count({ where: { item: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.formTemplate.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.formQuestion.count({ where: { version: { template: { programId: RIDGELINE_PROGRAM_ID } } } }),
      db.formCampaign.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.formRequest.count({ where: { campaign: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.event.count({ where: { programId: RIDGELINE_PROGRAM_ID } }),
      db.eventParticipant.count({ where: { event: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.eventEquipmentItem.count({ where: { event: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.volunteerOpportunity.count({ where: { event: { programId: RIDGELINE_PROGRAM_ID } } }),
      db.volunteerSignup.count({ where: { opportunity: { event: { programId: RIDGELINE_PROGRAM_ID } } } }),
    ]);

    expect(personCount).toBe(SEED_EXPECTATIONS.people);
    expect(studentCount).toBe(SEED_EXPECTATIONS.students);
    expect(groupCount).toBe(SEED_EXPECTATIONS.groups);
    expect(membershipCount).toBe(SEED_EXPECTATIONS.memberships);
    expect(guardianLinkCount).toBe(SEED_EXPECTATIONS.guardianLinks);
    expect(assetCount).toBe(SEED_EXPECTATIONS.assets);
    expect(componentCount).toBe(SEED_EXPECTATIONS.components);
    expect(activeCount).toBe(SEED_EXPECTATIONS.activeAssignments);
    expect(historicalCount).toBe(SEED_EXPECTATIONS.historicalAssignments);
    expect(repairCount).toBe(SEED_EXPECTATIONS.repairs);
    expect(openRepairCount).toBe(SEED_EXPECTATIONS.openRepairs);
    expect(financialBatchCount).toBe(SEED_EXPECTATIONS.financialBatches);
    expect(financialEntryCount).toBe(SEED_EXPECTATIONS.financialEntries);
    expect(libraryItemCount).toBe(SEED_EXPECTATIONS.libraryItems);
    expect(libraryLoanCount).toBe(SEED_EXPECTATIONS.libraryLoans);
    expect(libraryComponentCount).toBe(SEED_EXPECTATIONS.libraryComponentNotes);
    expect(performanceCount).toBe(SEED_EXPECTATIONS.performanceRecords);
    expect(libraryResourceCount).toBe(SEED_EXPECTATIONS.libraryResources);
    expect(formTemplateCount).toBe(SEED_EXPECTATIONS.formTemplates);
    expect(formQuestionCount).toBe(SEED_EXPECTATIONS.formQuestions);
    expect(formCampaignCount).toBe(SEED_EXPECTATIONS.formCampaigns);
    expect(formRequestCount).toBe(SEED_EXPECTATIONS.formRequests);
    expect(eventCount).toBe(SEED_EXPECTATIONS.events);
    expect(eventParticipantCount).toBe(SEED_EXPECTATIONS.eventParticipants);
    expect(eventEquipmentCount).toBe(SEED_EXPECTATIONS.eventEquipmentItems);
    expect(volunteerOpportunityCount).toBe(SEED_EXPECTATIONS.volunteerOpportunities);
    expect(volunteerSignupCount).toBe(SEED_EXPECTATIONS.volunteerSignups);
  });

  it("preserves the requested category and agreement counts", async () => {
    const [instrumentCount, uniformCount, equipmentCount, unsignedCount] = await Promise.all([
      db.asset.count({ where: { programId: RIDGELINE_PROGRAM_ID, category: AssetCategory.INSTRUMENT } }),
      db.asset.count({ where: { programId: RIDGELINE_PROGRAM_ID, category: AssetCategory.UNIFORM } }),
      db.asset.count({ where: { programId: RIDGELINE_PROGRAM_ID, category: AssetCategory.EQUIPMENT } }),
      db.assignment.count({ where: { asset: { programId: RIDGELINE_PROGRAM_ID }, checkedInAt: null, agreementOnFile: false } }),
    ]);

    expect(instrumentCount).toBe(SEED_EXPECTATIONS.instruments);
    expect(uniformCount).toBe(SEED_EXPECTATIONS.uniforms);
    expect(equipmentCount).toBe(SEED_EXPECTATIONS.equipment);
    expect(unsignedCount).toBe(SEED_EXPECTATIONS.unsignedAssignments);
  });
});

describe("asset labels", () => {
  it.each(["qrcode", "code128"] as const)("generates a self-contained %s vector symbol", (format) => {
    const svg = createAssetLabelSvg("RMS-EQP-010", format);
    expect(svg).toMatch(/^<svg viewBox="0 0 \d+ \d+" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("href=");
  });

  it("uses the same normalized asset-tag identity as scanner lookup", () => {
    const printedPayload = "RMS-EQP-010";
    expect(normalizeAssetCode(printedPayload)).toBe(normalizeAssetCode("bandos:asset:rms-eqp-010"));
  });

  it("paginates without dropping or duplicating labels", () => {
    const labels = Array.from({ length: 31 }, (_, index) => index + 1);
    const pages = paginateLabels(labels, 30);
    expect(pages.map((page) => page.length)).toEqual([30, 1]);
    expect(pages.flat()).toEqual(labels);
  });
});

describe("staff access matrix", () => {
  it("keeps helper access operational but excludes PII notes, exports, and administration", () => {
    const helper = { role: StaffRole.INVENTORY_HELPER };
    expect(hasPermission(helper, "VIEW_PEOPLE")).toBe(true);
    expect(hasPermission(helper, "VIEW_CONTACT_DETAILS")).toBe(false);
    expect(hasPermission(helper, "VIEW_FAMILY_LINKS")).toBe(false);
    expect(hasPermission(helper, "VIEW_GROUPS")).toBe(true);
    expect(hasPermission(helper, "VIEW_INVENTORY")).toBe(true);
    expect(hasPermission(helper, "MANAGE_INVENTORY")).toBe(true);
    expect(hasPermission(helper, "MANAGE_ASSIGNMENTS")).toBe(true);
    expect(hasPermission(helper, "VIEW_REPAIRS")).toBe(true);
    expect(hasPermission(helper, "VIEW_REPORTS")).toBe(true);
    expect(hasPermission(helper, "VIEW_NOTES")).toBe(false);
    expect(hasPermission(helper, "EXPORT_DATA")).toBe(false);
    expect(hasPermission(helper, "MANAGE_USERS")).toBe(false);
    expect(hasPermission(helper, "VIEW_FINANCIALS")).toBe(false);
    expect(hasPermission(helper, "VIEW_COMMUNICATIONS")).toBe(false);
    expect(hasPermission(helper, "VIEW_LIBRARY")).toBe(false);
    expect(hasPermission(helper, "VIEW_FORMS")).toBe(false);
    expect(hasPermission(helper, "VIEW_EVENTS")).toBe(false);
  });

  it("defines read-only access explicitly without mutation or sensitive-module permissions", () => {
    const readOnly = { role: StaffRole.READ_ONLY };
    expect(hasPermission(readOnly, "VIEW_PEOPLE")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_CONTACT_DETAILS")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_FAMILY_LINKS")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_GROUPS")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_INVENTORY")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_REPAIRS")).toBe(true);
    expect(hasPermission(readOnly, "VIEW_REPORTS")).toBe(true);
    expect(hasPermission(readOnly, "MANAGE_PEOPLE")).toBe(false);
    expect(hasPermission(readOnly, "MANAGE_INVENTORY")).toBe(false);
    expect(hasPermission(readOnly, "VIEW_FINANCIALS")).toBe(false);
    expect(hasPermission(readOnly, "VIEW_EVENTS")).toBe(false);
    expect(hasPermission(readOnly, "EXPORT_DATA")).toBe(false);
  });

  it("gives assistants operational access without director-only settings or rollover", () => {
    const assistant = { role: StaffRole.ASSISTANT_DIRECTOR };
    expect(hasPermission(assistant, "MANAGE_PEOPLE")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_REPAIRS")).toBe(true);
    expect(hasPermission(assistant, "VIEW_NOTES")).toBe(true);
    expect(hasPermission(assistant, "ROLLOVER")).toBe(false);
    expect(hasPermission(assistant, "MANAGE_USERS")).toBe(false);
    expect(hasPermission(assistant, "VIEW_FINANCIALS")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_FINANCIALS")).toBe(true);
    expect(hasPermission(assistant, "VIEW_COMMUNICATIONS")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_COMMUNICATIONS")).toBe(true);
    expect(hasPermission(assistant, "VIEW_LIBRARY")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_LIBRARY")).toBe(true);
    expect(hasPermission(assistant, "VIEW_FORMS")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_FORMS")).toBe(true);
    expect(hasPermission(assistant, "RECORD_FORM_RESPONSES")).toBe(true);
    expect(hasPermission(assistant, "VIEW_EVENTS")).toBe(true);
    expect(hasPermission(assistant, "MANAGE_EVENTS")).toBe(true);
    expect(hasPermission(assistant, "RECORD_ATTENDANCE")).toBe(true);
  });
});

describe("authentication throttling", () => {
  it("blocks repeated failures without storing the submitted identifier and clears after success", async () => {
    const identifier = "private.guardian@example.test";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await recordAuthenticationResult(db, "portal", identifier, false);
    }
    expect(await authenticationAllowed(db, "portal", identifier)).toBe(false);
    const throttle = await db.authenticationThrottle.findFirstOrThrow({ where: { scope: "portal" } });
    expect(throttle.identifierHash).not.toContain(identifier);

    await recordAuthenticationResult(db, "portal", identifier, true);
    expect(await authenticationAllowed(db, "portal", identifier)).toBe(true);
  });
});

describe.sequential("events and attendance", () => {
  it("reports rosters, RSVP, attendance, absences, volunteers, trips, and equipment", async () => {
    const [roster, rsvp, attendance, absences, volunteers, trips, equipmentRows] = await Promise.all([
      eventRoster(db, RIDGELINE_PROGRAM_ID),
      eventRsvpReport(db, RIDGELINE_PROGRAM_ID),
      eventAttendanceReport(db, RIDGELINE_PROGRAM_ID),
      eventAbsenceReport(db, RIDGELINE_PROGRAM_ID),
      eventVolunteerReport(db, RIDGELINE_PROGRAM_ID),
      eventTripRoster(db, RIDGELINE_PROGRAM_ID),
      eventEquipmentReport(db, RIDGELINE_PROGRAM_ID),
    ]);
    expect(roster).toHaveLength(SEED_EXPECTATIONS.eventParticipants);
    expect(rsvp).toHaveLength(SEED_EXPECTATIONS.eventParticipants);
    expect(attendance).toHaveLength(SEED_EXPECTATIONS.eventParticipants);
    expect(absences).toHaveLength(2);
    expect(volunteers).toHaveLength(SEED_EXPECTATIONS.volunteerSignups);
    expect(trips).toHaveLength(SEED_EXPECTATIONS.eventParticipants);
    expect(equipmentRows).toHaveLength(SEED_EXPECTATIONS.eventEquipmentItems);
  });

  it("preserves roster history and audits the event operating cycle", async () => {
    const auditCountBefore = await db.auditLog.count();
    const result = await createEvent(db, {
      programId: RIDGELINE_PROGRAM_ID,
      operatingPeriodId: CURRENT_PERIOD_ID,
      name: "Test event",
      startsAt: new Date("2026-10-01T22:00:00.000Z"),
      endsAt: new Date("2026-10-02T00:00:00.000Z"),
      location: "Test auditorium",
      visibility: EventVisibility.PRIVATE,
      rsvpEnabled: true,
      attendanceEnabled: true,
      groupIds: ["group-section-clarinet"],
      seriesName: "Test series",
    }, "test-director");
    expect(result.participantCount).toBe(10);
    await expect(setEventStatus(db, result.event.id, EventStatus.COMPLETED, "test-director")).rejects.toBeInstanceOf(EventInvariantError);
    await setEventStatus(db, result.event.id, EventStatus.PUBLISHED, "test-director");
    await expect(setEventStatus(db, result.event.id, EventStatus.DRAFT, "test-director")).rejects.toBeInstanceOf(EventInvariantError);
    const participants = await db.eventParticipant.findMany({ where: { eventId: result.event.id }, orderBy: { personId: "asc" } });
    await recordEventRsvp(db, participants[0].id, EventRsvpStatus.YES, "test-director");
    await recordAttendance(db, result.event.id, participants.map((participant, index) => ({ participantId: participant.id, status: index === 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT })), "test-director");
    await removeEventParticipant(db, participants[0].id, "test-director");
    expect(await db.eventParticipant.count({ where: { eventId: result.event.id } })).toBe(10);
    expect(await db.eventParticipant.count({ where: { eventId: result.event.id, status: "ACTIVE" } })).toBe(9);
    const restored = await refreshEventRoster(db, result.event.id, "test-director");
    expect(restored).toBe(0);
    expect(await db.eventParticipant.count({ where: { eventId: result.event.id } })).toBe(10);
    expect(await db.eventParticipant.count({ where: { eventId: result.event.id, status: "ACTIVE" } })).toBe(9);
    await addEventParticipant(db, result.event.id, participants[0].personId, "test-director");
    expect(await db.eventParticipant.count({ where: { eventId: result.event.id, status: "ACTIVE" } })).toBe(10);

    await addEventEquipmentItem(db, { eventId: result.event.id, assetId: "asset-equipment-002", label: "Test equipment cart", quantity: 1 }, "test-director");
    const opportunity = await createVolunteerOpportunity(db, { eventId: result.event.id, title: "Test volunteer role", capacity: 1 }, "test-director");
    await addVolunteerSignup(db, opportunity.id, "guardian-001", "test-director");
    await expect(addVolunteerSignup(db, opportunity.id, "guardian-002", "test-director")).rejects.toBeInstanceOf(EventInvariantError);
    const announcementCountBefore = await db.announcement.count();
    const reminderResult = await createEventReminderAnnouncement(db, { eventId: result.event.id, audience: EventReminderAudience.PARTICIPANTS }, "test-director");
    expect(reminderResult.reminder.announcementId).toBe(reminderResult.announcement.id);
    expect(await db.announcement.count()).toBe(announcementCountBefore + 1);
    await expect(createEventReminderAnnouncement(db, { eventId: "missing-event", audience: EventReminderAudience.PARTICIPANTS }, "test-director")).rejects.toBeInstanceOf(EventInvariantError);
    expect(await db.announcement.count()).toBe(announcementCountBefore + 1);
    const calendar = await createCalendarSubscription(db, RIDGELINE_PROGRAM_ID, "Test private calendar", "test-director");
    expect(calendar.token.length).toBeGreaterThan(40);
    const storedSubscription = await db.calendarSubscription.findUniqueOrThrow({ where: { id: calendar.subscription.id } });
    expect(storedSubscription.tokenHash).not.toBe(calendar.token);
    expect((await db.auditLog.count()) - auditCountBefore).toBeGreaterThanOrEqual(10);
  });
});

describe.sequential("forms", () => {
  it("reports campaigns, outstanding requests, responses, uploads, reminders, and retention", async () => {
    const [campaigns, outstanding, responses, uploads, reminders, retention] = await Promise.all([
      formCampaignCompletion(db, RIDGELINE_PROGRAM_ID), outstandingFormRequests(db, RIDGELINE_PROGRAM_ID), formResponseExtract(db, RIDGELINE_PROGRAM_ID),
      formUploadRegister(db, RIDGELINE_PROGRAM_ID), formReminderHistory(db, RIDGELINE_PROGRAM_ID), formRetentionStatus(db, RIDGELINE_PROGRAM_ID),
    ]);
    expect(campaigns).toHaveLength(SEED_EXPECTATIONS.formCampaigns);
    expect(outstanding).toHaveLength(2);
    expect(responses).toHaveLength(5);
    expect(uploads).toHaveLength(0);
    expect(reminders).toHaveLength(1);
    expect(retention).toHaveLength(SEED_EXPECTATIONS.formRequests);
  });

  it("locks published versions and completes an audited recipient workflow", async () => {
    const { template, version } = await createFormTemplate(db, { programId: RIDGELINE_PROGRAM_ID, name: "Test permission form", title: "Test permission form", retentionDays: 30 }, "test-director");
    const question = await addFormQuestion(db, { versionId: version.id, prompt: "I acknowledge the test statement.", type: FormQuestionType.ACKNOWLEDGMENT, required: false }, "test-director");
    await publishFormVersion(db, version.id, "test-director");
    await expect(addFormQuestion(db, { versionId: version.id, prompt: "Late edit", type: FormQuestionType.SHORT_TEXT, required: false }, "test-director")).rejects.toBeInstanceOf(FormInvariantError);
    const { campaign } = await createFormCampaign(db, { programId: RIDGELINE_PROGRAM_ID, operatingPeriodId: CURRENT_PERIOD_ID, templateVersionId: version.id, name: "Test campaign", audienceType: FormAudienceType.PERSON, audienceValue: "member-001", audienceSummary: "Marlow Tenby", recipientMode: FormRecipientMode.STUDENTS }, "test-director");
    const request = await db.formRequest.findFirstOrThrow({ where: { campaignId: campaign.id } });
    await expect(saveFormResponse(db, request.id, { answers: [], uploads: [], submit: true }, "test-director")).rejects.toBeInstanceOf(FormInvariantError);
    await saveFormResponse(db, request.id, { answers: [{ questionId: question.id, acknowledged: true }], uploads: [], submit: true }, "test-director");
    expect((await db.formRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("COMPLETE");
    const revision = await createFormRevision(db, template.id, "test-director");
    expect(revision.version).toBe(2);
    expect(await db.formQuestion.count({ where: { versionId: revision.id } })).toBe(1);
    await db.formRequest.update({ where: { id: request.id }, data: { retentionExpiresAt: new Date("2020-01-01T00:00:00.000Z") } });
    const purged = await purgeExpiredFormResponses(db, campaign.id, "test-director");
    expect(purged.count).toBe(1);
    expect((await db.formResponse.findUniqueOrThrow({ where: { requestId: request.id } })).status).toBe("PURGED");
    expect(await db.auditLog.count({ where: { entityId: { in: [template.id, version.id, question.id, campaign.id] } } })).toBeGreaterThanOrEqual(5);
  });
});

describe.sequential("music library", () => {
  it("reports catalog, loans, overdue sets, components, performances, and resources", async () => {
    const [catalog, loans, overdue, components, performances, resources] = await Promise.all([
      libraryCatalog(db, RIDGELINE_PROGRAM_ID), libraryLoans(db, RIDGELINE_PROGRAM_ID), overdueLibraryLoans(db, RIDGELINE_PROGRAM_ID, REPORT_AS_OF),
      libraryComponentIssues(db, RIDGELINE_PROGRAM_ID), libraryPerformanceHistory(db, RIDGELINE_PROGRAM_ID), libraryResourcePresence(db, RIDGELINE_PROGRAM_ID),
    ]);
    expect(catalog).toHaveLength(SEED_EXPECTATIONS.libraryItems);
    expect(loans).toHaveLength(SEED_EXPECTATIONS.libraryLoans);
    expect(overdue).toHaveLength(1);
    expect(components).toHaveLength(SEED_EXPECTATIONS.libraryComponentNotes);
    expect(performances).toHaveLength(SEED_EXPECTATIONS.performanceRecords);
    expect(resources).toHaveLength(SEED_EXPECTATIONS.libraryResources);
  });

  it("preserves whole-set lifecycle history and synchronizes availability", async () => {
    const item = await createLibraryItem(db, { id: "test-library-item", programId: RIDGELINE_PROGRAM_ID, title: "Test Suite", composer: "Test Composer", catalogNumber: "TEST-LIB-001" }, "test-director");
    const issue = await addLibraryComponentNote(db, { id: "test-library-component", itemId: item.id, componentName: "Trumpet 1 part", status: LibraryComponentStatus.MISSING, notedAt: REPORT_AS_OF }, "test-director");
    expect((await db.libraryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LibraryItemStatus.INCOMPLETE);
    await resolveLibraryComponentNote(db, issue.id, REPORT_AS_OF, "test-director");
    expect((await db.libraryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LibraryItemStatus.AVAILABLE);

    const loan = await checkoutLibraryItem(db, { id: "test-library-loan", itemId: item.id, borrowerName: "Test Organization", operatingPeriodId: CURRENT_PERIOD_ID, checkedOutAt: REPORT_AS_OF, expectedReturnAt: new Date("2026-08-01T12:00:00.000Z") }, "test-director");
    expect((await db.libraryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LibraryItemStatus.ON_LOAN);
    await expect(checkoutLibraryItem(db, { itemId: item.id, borrowerName: "Second Borrower", operatingPeriodId: CURRENT_PERIOD_ID, checkedOutAt: REPORT_AS_OF }, "test-director")).rejects.toBeInstanceOf(LibraryInvariantError);
    await closeLibraryLoan(db, loan.id, { returnedAt: new Date("2026-07-25T12:00:00.000Z"), status: LibraryLoanStatus.RETURNED }, "test-director");
    expect((await db.libraryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LibraryItemStatus.AVAILABLE);

    await addPerformanceRecord(db, { id: "test-library-performance", itemId: item.id, operatingPeriodId: CURRENT_PERIOD_ID, eventName: "Test Concert", performedAt: REPORT_AS_OF, groupId: "group-grade-8" }, "test-director");
    await addLibraryResource(db, { id: "test-library-resource", itemId: item.id, kind: LibraryResourceKind.EXTERNAL_LINK, label: "Test resource", externalUrl: ["https:", "//example.invalid/test-resource"].join(""), copyrightAcknowledgedAt: REPORT_AS_OF }, "test-director");
    expect(await db.auditLog.count({ where: { entityId: { in: [item.id, issue.id, loan.id, "test-library-performance", "test-library-resource"] } } })).toBeGreaterThanOrEqual(7);
  });
});

describe.sequential("email communications", () => {
  it("freezes a deduplicated guardian audience and records per-recipient delivery", async () => {
    process.env.BANDOS_EMAIL_TRANSPORT = "mock";
    await saveEmailConnection(db, {
      programId: RIDGELINE_PROGRAM_ID,
      provider: EmailProviderKind.SMTP,
      fromName: "Ridgeline Band",
      fromAddress: "band@ridgeline.example",
      smtpHost: "smtp.ridgeline.example",
      smtpPort: 587,
      smtpSecure: false,
    }, "test-director");
    await testEmailConnection(db, RIDGELINE_PROGRAM_ID, "test-director");
    const announcement = await createAnnouncement(db, {
      programId: RIDGELINE_PROGRAM_ID,
      operatingPeriodId: CURRENT_PERIOD_ID,
      subject: "Synthetic rehearsal reminder",
      body: "This is a deterministic test message.",
      targets: [
        { targetType: EmailAudienceTargetType.GROUP, recipientKind: EmailAudienceRecipientKind.GUARDIANS, groupId: "group-grade-6" },
        { targetType: EmailAudienceTargetType.CLASSIFICATION, recipientKind: EmailAudienceRecipientKind.SELF, classification: PersonClassificationType.BOOSTER },
      ],
      attachments: [{ fileName: "schedule.txt", mimeType: "text/plain", content: new TextEncoder().encode("Synthetic schedule") }],
    }, "test-director");
    const recipients = await db.announcementRecipient.findMany({ where: { announcementId: announcement.id } });
    expect(recipients).toHaveLength(3);
    expect(recipients.find((recipient) => recipient.emailNormalized === "guardian1@ridgeline.example")?.inclusionReasonsJson).toContain("Guardian for");
    expect(recipients.find((recipient) => recipient.emailNormalized === "guardian1@ridgeline.example")?.inclusionReasonsJson).toContain("booster");
    const originalAttachment = await db.announcementAttachment.findFirstOrThrow({ where: { announcementId: announcement.id } });
    await updateAnnouncement(db, announcement.id, {
      subject: "Updated synthetic rehearsal reminder",
      body: "This is the corrected deterministic test message.",
      targets: [
        { targetType: EmailAudienceTargetType.GROUP, recipientKind: EmailAudienceRecipientKind.GUARDIANS, groupId: "group-grade-6" },
        { targetType: EmailAudienceTargetType.CLASSIFICATION, recipientKind: EmailAudienceRecipientKind.SELF, classification: PersonClassificationType.BOOSTER },
      ],
      attachments: [{ fileName: "updated.txt", mimeType: "text/plain", content: new TextEncoder().encode("Updated schedule") }],
      removeAttachmentIds: [originalAttachment.id],
    }, "test-director");
    expect((await db.announcement.findUniqueOrThrow({ where: { id: announcement.id } })).subject).toBe("Updated synthetic rehearsal reminder");
    expect(await db.announcementAttachment.count({ where: { announcementId: announcement.id } })).toBe(1);
    expect(await db.announcementRecipient.count({ where: { announcementId: announcement.id } })).toBe(3);

    const result = await sendAnnouncement(db, announcement.id, "test-director");
    expect(result).toMatchObject({ sent: 3, failed: 0, status: "SENT" });
    expect(await db.deliveryAttempt.count({ where: { recipient: { announcementId: announcement.id }, status: "SENT" } })).toBe(3);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Announcement", entityId: announcement.id, action: "SEND" } });
    expect(audit.changeDiffJson).not.toContain("Synthetic rehearsal reminder");
    delete process.env.BANDOS_EMAIL_TRANSPORT;
  });

  it("honors address-level suppression and holds overdue desktop jobs for confirmation", async () => {
    await updateEmailContactState(db, { programId: RIDGELINE_PROGRAM_ID, email: "casey@ridgeline.example", status: EmailContactStatus.SUPPRESSED, reason: "Administrative test hold" }, "test-director");
    const scheduledAt = new Date(Date.now() + 120_000);
    const announcement = await createAnnouncement(db, {
      programId: RIDGELINE_PROGRAM_ID,
      operatingPeriodId: CURRENT_PERIOD_ID,
      subject: "Scheduled booster note",
      body: "This message must not leave automatically after downtime.",
      scheduledAt,
      targets: [{ targetType: EmailAudienceTargetType.CLASSIFICATION, recipientKind: EmailAudienceRecipientKind.SELF, classification: PersonClassificationType.BOOSTER }],
      attachments: [],
    }, "test-director");
    const suppressed = await db.announcementRecipient.findFirstOrThrow({ where: { announcementId: announcement.id, emailNormalized: "casey@ridgeline.example" } });
    expect(suppressed.permissionResult).toBe(AnnouncementRecipientStatus.SUPPRESSED);
    await db.communicationJob.updateMany({ where: { announcementId: announcement.id }, data: { status: CommunicationJobStatus.LEASED, leaseToken: "interrupted-test-lease", leaseExpiresAt: new Date(Date.now() - 1_000) } });
    await processDueCommunicationJobs(db, new Date(scheduledAt.getTime() + 1_000));
    const job = await db.communicationJob.findFirstOrThrow({ where: { announcementId: announcement.id } });
    expect(job.status).toBe(CommunicationJobStatus.OVERDUE);
  });
});

describe.sequential("financial reports", () => {
  it("derives student balances from immutable signed entries", async () => {
    const rows = await studentBalances(db, RIDGELINE_PROGRAM_ID);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.students);
    expect(Number(rows.find((row) => row.personId === "member-001")?.balance)).toBe(15);
    expect(Number(rows.find((row) => row.personId === "member-002")?.balance)).toBe(-10);
  });

  it("reports every transaction and group assessment batch", async () => {
    const [transactions, batches] = await Promise.all([
      financialTransactions(db, RIDGELINE_PROGRAM_ID),
      assessmentBatches(db, RIDGELINE_PROGRAM_ID),
    ]);
    expect(transactions).toHaveLength(SEED_EXPECTATIONS.financialEntries);
    expect(batches).toHaveLength(SEED_EXPECTATIONS.financialBatches);
    expect(batches.reduce((sum, batch) => sum + Number(batch.studentCount), 0)).toBe(52);
  });

  it("summarizes current-period charges, payments, and credits", async () => {
    const [summary] = await financialSummary(db, RIDGELINE_PROGRAM_ID, CURRENT_PERIOD_ID);
    expect(Number(summary.studentAccountCount)).toBe(SEED_EXPECTATIONS.students);
    expect(Number(summary.currentCharges)).toBe(2945);
    expect(Number(summary.currentPaymentsAndCredits)).toBe(630);
  });

  it("scopes financial reports to the requested program", async () => {
    const [balances, transactions, batches] = await Promise.all([
      studentBalances(db, "program-with-no-records"),
      financialTransactions(db, "program-with-no-records"),
      assessmentBatches(db, "program-with-no-records"),
    ]);
    expect(balances).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(batches).toHaveLength(0);
  });
});

describe.sequential("audited financial ledger", () => {
  it("posts charges, payments, credits, and a non-destructive reversal", async () => {
    const person = await createPerson(db, {
      id: "test-financial-student",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Ledger",
      lastName: "Student",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 8 },
    }, "test-director");
    const charge = await postFinancialEntry(db, {
      id: "test-financial-charge",
      programId: RIDGELINE_PROGRAM_ID,
      personId: person.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      type: FinancialEntryType.CHARGE,
      amount: "100.00",
      occurredAt: REPORT_AS_OF,
      description: "Test fee",
    }, "test-director");
    await postFinancialEntry(db, {
      id: "test-financial-payment",
      programId: RIDGELINE_PROGRAM_ID,
      personId: person.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      type: FinancialEntryType.PAYMENT,
      amount: "40.00",
      occurredAt: REPORT_AS_OF,
      description: "Manual payment",
    }, "test-director");
    await postFinancialEntry(db, {
      id: "test-financial-credit",
      programId: RIDGELINE_PROGRAM_ID,
      personId: person.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      type: FinancialEntryType.CREDIT,
      amount: "10.00",
      occurredAt: REPORT_AS_OF,
      description: "Assistance credit",
    }, "test-director");
    const reversal = await reverseFinancialEntry(db, charge.id, REPORT_AS_OF, "Duplicate test fee", "test-director");
    const account = await financialTransactions(db, RIDGELINE_PROGRAM_ID, person.id);
    expect(account.reduce((sum, entry) => sum + Number(entry.amount), 0)).toBe(-50);
    expect(reversal.reversalOfId).toBe(charge.id);
    expect(await db.financialEntry.count({ where: { id: charge.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityType: "FinancialEntry", entityId: { in: account.map((entry) => entry.entryId) } } })).toBe(4);
  });

  it("snapshots active student membership for group assessments", async () => {
    const result = await postGroupAssessment(db, {
      id: "test-financial-batch",
      programId: RIDGELINE_PROGRAM_ID,
      operatingPeriodId: CURRENT_PERIOD_ID,
      groupId: "group-grade-8",
      amount: "12.50",
      occurredAt: REPORT_AS_OF,
      description: "Grade 8 test assessment",
    }, "test-director");
    expect(result.studentCount).toBe(20);
    expect(await db.financialEntry.count({ where: { batchId: result.batch.id, type: FinancialEntryType.CHARGE } })).toBe(20);
  });

  it("rejects invalid monetary precision before writing", async () => {
    await expect(postFinancialEntry(db, {
      programId: RIDGELINE_PROGRAM_ID,
      personId: "member-001",
      operatingPeriodId: CURRENT_PERIOD_ID,
      type: FinancialEntryType.CHARGE,
      amount: "1.999",
      occurredAt: REPORT_AS_OF,
      description: "Invalid precision",
    }, "test-director")).rejects.toBeInstanceOf(FinancialInvariantError);
  });
});

describe.sequential("Stage 2 report queries", () => {
  it("returns who-has-what", async () => {
    const rows = await whoHasWhat(db, RIDGELINE_PROGRAM_ID);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.activeAssignments);
    expect(rows.every((row) => row.personName && row.assetTag)).toBe(true);
  });

  it("returns all assets without an active assignment", async () => {
    const rows = await unassignedAssets(db, RIDGELINE_PROGRAM_ID);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.unassignedAssets);
  });

  it("defines outstanding assignments from the supplied as-of date", async () => {
    const rows = await outstandingAssignments(db, RIDGELINE_PROGRAM_ID, REPORT_AS_OF);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.overdueAssignmentsAtReportDate);
    expect(rows.every((row) => Number(row.daysOverdue) >= 3)).toBe(true);
  });

  it("returns only missing or damaged attached components", async () => {
    const rows = await missingOrDamagedComponents(db, RIDGELINE_PROGRAM_ID);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.flaggedComponents);
    const flaggedStatuses = new Set<ComponentStatus>([ComponentStatus.MISSING, ComponentStatus.DAMAGED]);
    expect(rows.every((row) => flaggedStatuses.has(row.componentStatus as ComponentStatus))).toBe(true);
  });

  it("totals repair cost by operating period", async () => {
    const rows = await repairCostByPeriod(db, RIDGELINE_PROGRAM_ID);
    const totals = Object.fromEntries(rows.map((row) => [row.periodLabel, Number(row.totalCost)]));
    expect(rows).toHaveLength(2);
    expect(totals["2025-2026"]).toBe(810);
    expect(totals["2026-2027"]).toBe(6090);
  });

  it("totals repair cost by asset", async () => {
    const rows = await repairCostByAsset(db, RIDGELINE_PROGRAM_ID);
    expect(rows).toHaveLength(SEED_EXPECTATIONS.repairs);
    expect(Number(rows[0].totalCost)).toBe(4200);
  });

  it("returns total fleet and assigned-out value", async () => {
    const [row] = await fleetValue(db, RIDGELINE_PROGRAM_ID);
    const assignedIds = new Set(activeAssignments.map((assignment) => assignment.assetId));
    const expectedFleetValue = assets.reduce((sum, asset) => sum + Number(asset.estimatedValue ?? 0), 0);
    const expectedAssignedValue = assets
      .filter((asset) => assignedIds.has(asset.id))
      .reduce((sum, asset) => sum + Number(asset.estimatedValue ?? 0), 0);

    expect(Number(row.assetCount)).toBe(SEED_EXPECTATIONS.assets);
    expect(Number(row.assignedAssetCount)).toBe(SEED_EXPECTATIONS.activeAssignments);
    expect(Number(row.totalFleetValue)).toBe(expectedFleetValue);
    expect(Number(row.assignedOutValue)).toBe(expectedAssignedValue);
  });

  it("scopes every report to the requested program", async () => {
    const emptyProgram = "program-with-no-records";
    const resultSets = await Promise.all([
      whoHasWhat(db, emptyProgram),
      unassignedAssets(db, emptyProgram),
      outstandingAssignments(db, emptyProgram, REPORT_AS_OF),
      missingOrDamagedComponents(db, emptyProgram),
      repairCostByPeriod(db, emptyProgram),
      repairCostByAsset(db, emptyProgram),
      fleetValue(db, emptyProgram),
    ]);

    expect(resultSets.slice(0, 6).every((rows) => rows.length === 0)).toBe(true);
    expect(Number(resultSets[6][0].assetCount)).toBe(0);
  });
});

describe.sequential("audited inventory data access", () => {
  it("supports multi-role people and removable guardian relationships", async () => {
    const student = await createPerson(db, {
      id: "test-student-family",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Family",
      lastName: "Student",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 6 },
    }, "test-director");
    const guardian = await createPerson(db, {
      id: "test-guardian-family",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Family",
      lastName: "Guardian",
      classifications: [PersonClassificationType.GUARDIAN, PersonClassificationType.BOOSTER],
    }, "test-director");
    const link = await linkGuardianStudent(db, {
      guardianId: guardian.id,
      studentId: student.id,
      relationshipLabel: "Parent",
      primaryContact: true,
    }, "test-director");

    expect(await db.personClassification.count({ where: { personId: guardian.id } })).toBe(2);
    expect((await db.guardianStudent.findUniqueOrThrow({ where: { id: link.id } })).primaryContact).toBe(true);
    await unlinkGuardianStudent(db, link.id, "test-director");
    expect(await db.guardianStudent.count({ where: { id: link.id } })).toBe(0);
    await deletePerson(db, guardian.id, "test-director");
    await deletePerson(db, student.id, "test-director");
  });

  it("creates and links a guardian without requiring a student ID", async () => {
    const student = await createPerson(db, {
      id: "test-student-inline-guardian",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Inline",
      lastName: "Student",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 6 },
    }, "test-director");

    const result = await createGuardianAndLinkStudent(db, {
      studentId: student.id,
      firstName: "Inline",
      lastName: "Guardian",
      email: "inline.guardian@example.test",
      relationshipLabel: "Parent",
      primaryContact: true,
    }, "test-director");

    expect(result.guardian.email).toBe("inline.guardian@example.test");
    expect(result.link.studentId).toBe(student.id);
    expect(result.link.primaryContact).toBe(true);
    expect(await db.personClassification.count({ where: { personId: result.guardian.id, classification: PersonClassificationType.GUARDIAN } })).toBe(1);
    await expect(createGuardianAndLinkStudent(db, {
      studentId: student.id,
      firstName: "Duplicate",
      lastName: "Guardian",
      email: "INLINE.GUARDIAN@example.test",
    }, "test-director")).rejects.toThrow(/already uses that email/);
    expect(await db.person.count({ where: { programId: RIDGELINE_PROGRAM_ID, email: { contains: "guardian@example.test" } } })).toBe(1);

    await deletePerson(db, result.guardian.id, "test-director");
    await deletePerson(db, student.id, "test-director");
  });

  it("lets portal users set and reset their own password without exposing account existence", async () => {
    const portalUser = await createPortalAccount(db, "guardian-001", "test-director");
    expect(portalUser.status).toBe(PortalUserStatus.PENDING);
    await db.emailConnection.upsert({
      where: { programId: RIDGELINE_PROGRAM_ID },
      update: {
        status: EmailConnectionStatus.VERIFIED,
        fromName: "Ridgeline Band",
        fromAddress: "band@ridgeline.example",
        smtpHost: "smtp.ridgeline.example",
        smtpPort: 587,
      },
      create: {
        id: "portal-reset-email",
        programId: RIDGELINE_PROGRAM_ID,
        provider: EmailProviderKind.SMTP,
        status: EmailConnectionStatus.VERIFIED,
        fromName: "Ridgeline Band",
        fromAddress: "band@ridgeline.example",
        smtpHost: "smtp.ridgeline.example",
        smtpPort: 587,
      },
    });

    const deliveries: Array<{ to: string; body: string }> = [];
    const delivery = await requestPortalPasswordReset(
      db,
      "GUARDIAN1@RIDGELINE.EXAMPLE",
      async (input) => {
        deliveries.push({ to: input.to, body: input.body });
        return { messageId: "portal-reset-test" };
      },
    );
    expect(delivery.delivery).toBe("sent");
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].to).toBe("guardian1@ridgeline.example");
    const code = deliveries[0].body.match(/\b\d{8}\b/)?.[0];
    expect(code).toMatch(/^\d{8}$/);

    let unknownDeliveries = 0;
    const unknown = await requestPortalPasswordReset(db, "unknown@ridgeline.example", async () => {
      unknownDeliveries += 1;
      return { messageId: "should-not-send" };
    });
    expect(unknown.delivery).toBe("unavailable");
    expect(unknownDeliveries).toBe(0);

    await db.portalSession.create({
      data: {
        id: "portal-session-before-reset",
        userId: portalUser.id,
        tokenHash: "portal-session-before-reset-token",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(resetPortalPassword(db, {
      email: "guardian1@ridgeline.example",
      code: "00000000",
      password: "BandOffice-Guardian-New-Password!",
    })).rejects.toBeInstanceOf(PortalAuthError);
    await resetPortalPassword(db, {
      email: "guardian1@ridgeline.example",
      code: code!,
      password: "BandOffice-Guardian-New-Password!",
    });
    const activated = await db.portalUser.findUniqueOrThrow({ where: { id: portalUser.id } });
    expect(activated.status).toBe(PortalUserStatus.ACTIVE);
    expect(activated.passwordHash).not.toContain("BandOffice-Guardian-New-Password!");
    expect(await db.portalSession.count({ where: { userId: portalUser.id } })).toBe(0);
    await expect(resetPortalPassword(db, {
      email: "guardian1@ridgeline.example",
      code: code!,
      password: "BandOffice-Guardian-New-Password!",
    })).rejects.toBeInstanceOf(PortalAuthError);
  });

  it("stores valid group context on checkout and rejects a group the borrower has not joined", async () => {
    const member = await createPerson(db, {
      id: "test-person-grouped",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Grouped",
      lastName: "Borrower",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 7 },
    }, "test-director");
    const outsider = await createPerson(db, {
      id: "test-person-outsider",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Outside",
      lastName: "Borrower",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 7 },
    }, "test-director");
    const group = await createGroup(db, { id: "test-group-checkout", programId: RIDGELINE_PROGRAM_ID, name: "Test Ensemble", kind: GroupKind.ENSEMBLE }, "test-director");
    await addGroupMembership(db, { groupId: group.id, personId: member.id }, "test-director");
    const asset = await createAsset(db, {
      id: "test-asset-group-context",
      programId: RIDGELINE_PROGRAM_ID,
      category: AssetCategory.EQUIPMENT,
      condition: AssetCondition.GOOD,
      schoolAssetTag: "TEST-GROUP-001",
    }, "test-director");
    const assignment = await checkoutAsset(db, {
      id: "test-assignment-group-context",
      assetId: asset.id,
      personId: member.id,
      groupId: group.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      checkedOutAt: REPORT_AS_OF,
      conditionOut: AssetCondition.GOOD,
    }, "test-director");
    expect(assignment.groupId).toBe(group.id);
    await checkinAsset(db, assignment.id, { checkedInAt: REPORT_AS_OF, conditionIn: AssetCondition.GOOD }, "test-director");
    await expect(checkoutAsset(db, {
      assetId: asset.id,
      personId: outsider.id,
      groupId: group.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      checkedOutAt: REPORT_AS_OF,
      conditionOut: AssetCondition.GOOD,
    }, "test-director")).rejects.toThrow(/not an active member of that group/);

    await deleteAssignment(db, assignment.id, "test-director");
    await deleteAsset(db, asset.id, "test-director");
    await db.groupMembership.deleteMany({ where: { groupId: group.id } });
    await db.group.delete({ where: { id: group.id } });
    await deletePerson(db, outsider.id, "test-director");
    await deletePerson(db, member.id, "test-director");
  });

  it("audits person create, update, and delete in their transactions", async () => {
    const person = await createPerson(db, {
      id: "test-member-audit",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Synthetic",
      lastName: "Member",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 7 },
      notes: "Private fixture note",
    }, "test-director");
    await updatePerson(db, person.id, { email: "synthetic@example.test" }, "test-director");
    await deletePerson(db, person.id, "test-director");

    const logs = await db.auditLog.findMany({
      where: { entityType: "Person", entityId: person.id },
      orderBy: { timestamp: "asc" },
    });
    expect(logs.map((log) => log.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
    expect(logs.map((log) => log.changeDiffJson).join(" ")).not.toContain("Synthetic");
    expect(logs.map((log) => log.changeDiffJson).join(" ")).not.toContain("Private fixture note");
  });

  it("audits component mutations and asset deletion", async () => {
    const asset = await createAsset(db, {
      id: "test-asset-component",
      programId: RIDGELINE_PROGRAM_ID,
      category: AssetCategory.INSTRUMENT,
      condition: AssetCondition.GOOD,
      schoolAssetTag: "TEST-COMPONENT-001",
    }, "test-director");
    const component = await createAssetComponent(db, {
      id: "test-component",
      assetId: asset.id,
      name: "Case",
    }, "test-director");
    await updateAssetComponent(db, component.id, { status: ComponentStatus.DAMAGED }, "test-director");
    await deleteAssetComponent(db, component.id, "test-director");
    await deleteAsset(db, asset.id, "test-director");

    const componentActions = await db.auditLog.findMany({
      where: { entityType: "AssetComponent", entityId: component.id },
      select: { action: true },
      orderBy: { timestamp: "asc" },
    });
    expect(componentActions.map((entry) => entry.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
  });

  it("keeps asset status synchronized through checkout and check-in", async () => {
    const person = await createPerson(db, {
      id: "test-member-lifecycle",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Lifecycle",
      lastName: "Student",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 8 },
    }, "test-director");
    const asset = await createAsset(db, {
      id: "test-asset-lifecycle",
      programId: RIDGELINE_PROGRAM_ID,
      category: AssetCategory.EQUIPMENT,
      condition: AssetCondition.GOOD,
      schoolAssetTag: "TEST-LIFECYCLE-001",
    }, "test-director");

    const assignment = await checkoutAsset(db, {
      id: "test-assignment-lifecycle",
      assetId: asset.id,
      personId: person.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      checkedOutAt: REPORT_AS_OF,
      expectedReturnAt: new Date("2026-08-01T12:00:00.000Z"),
      conditionOut: AssetCondition.GOOD,
    }, "test-director");
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe(AssetStatus.ASSIGNED);

    await checkinAsset(db, assignment.id, {
      checkedInAt: new Date("2026-07-20T12:00:00.000Z"),
      conditionIn: AssetCondition.GOOD,
    }, "test-director");
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe(AssetStatus.AVAILABLE);

    await deleteAssignment(db, assignment.id, "test-director");
    await deleteAsset(db, asset.id, "test-director");
    await deletePerson(db, person.id, "test-director");

    const assignmentActions = await db.auditLog.findMany({
      where: { entityType: "Assignment", entityId: assignment.id },
      select: { action: true },
      orderBy: { timestamp: "asc" },
    });
    expect(assignmentActions.map((entry) => entry.action)).toEqual(["CHECKOUT", "CHECKIN", "DELETE"]);
  });

  it("checks in and opens a damage repair atomically", async () => {
    const assignment = await db.assignment.findFirstOrThrow({
      where: { checkedInAt: null, asset: { status: AssetStatus.ASSIGNED } },
      include: { asset: true },
    });
    const result = await checkinAssetWithOptionalRepair(db, assignment.id, {
      checkedInAt: REPORT_AS_OF,
      conditionIn: AssetCondition.POOR,
      repair: { description: "Damage found during test return" },
    }, "test-director");
    expect(result.repair?.assetId).toBe(assignment.assetId);
    expect((await db.asset.findUniqueOrThrow({ where: { id: assignment.assetId } })).status).toBe(AssetStatus.IN_REPAIR);
    expect(await db.auditLog.count({ where: { entityId: { in: [assignment.id, result.repair!.id] } } })).toBeGreaterThanOrEqual(2);
  });

  it("rolls back a damage check-in when repair creation fails", async () => {
    const assignment = await db.assignment.findFirstOrThrow({ where: { checkedInAt: null } });
    await expect(checkinAssetWithOptionalRepair(db, assignment.id, {
      checkedInAt: REPORT_AS_OF,
      conditionIn: AssetCondition.POOR,
      repair: { description: "Invalid cost should abort everything", cost: "not-a-number" },
    }, "test-director")).rejects.toThrow();
    expect((await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } })).checkedInAt).toBeNull();
  });

  it("blocks rollover while assignments remain open", async () => {
    await expect(rolloverOperatingPeriod(db, {
      programId: RIDGELINE_PROGRAM_ID,
      currentPeriodId: CURRENT_PERIOD_ID,
      nextLabel: "2027-2028",
      nextStartsAt: new Date("2027-07-01T12:00:00.000Z"),
    }, "test-director")).rejects.toThrow(/assignments remain open/);
  });

  it("rejects checkout for missing assets", async () => {
    const person = await createPerson(db, {
      id: "test-member-rejected",
      programId: RIDGELINE_PROGRAM_ID,
      firstName: "Rejected",
      lastName: "Checkout",
      classifications: [PersonClassificationType.STUDENT],
      student: { grade: 6 },
    }, "test-director");
    const asset = await createAsset(db, {
      id: "test-asset-missing",
      programId: RIDGELINE_PROGRAM_ID,
      category: AssetCategory.INSTRUMENT,
      condition: AssetCondition.POOR,
      status: AssetStatus.MISSING,
      schoolAssetTag: "TEST-MISSING-001",
    }, "test-director");

    await expect(checkoutAsset(db, {
      assetId: asset.id,
      personId: person.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      checkedOutAt: REPORT_AS_OF,
      conditionOut: AssetCondition.POOR,
    }, "test-director")).rejects.toBeInstanceOf(InventoryInvariantError);

    expect(await db.assignment.count({ where: { assetId: asset.id } })).toBe(0);
    await deleteAsset(db, asset.id, "test-director");
    await deletePerson(db, person.id, "test-director");
  });

  it("rejects an asset import with duplicate asset tags before writing records", async () => {
    await expect(importAssets(db, RIDGELINE_PROGRAM_ID, [
      { category: AssetCategory.INSTRUMENT, schoolAssetTag: "TEST-DUPLICATE-IMPORT", condition: AssetCondition.GOOD },
      { category: AssetCategory.INSTRUMENT, schoolAssetTag: "test-duplicate-import", condition: AssetCondition.FAIR },
    ], "test-director")).rejects.toThrow(/Asset tags must be unique within an import/);
    expect(await db.asset.count({ where: { programId: RIDGELINE_PROGRAM_ID, schoolAssetTag: { in: ["TEST-DUPLICATE-IMPORT", "test-duplicate-import"] } } })).toBe(0);
  });

  it("does not delete an asset with assignment history", async () => {
    const asset = await db.asset.findFirstOrThrow({ where: { programId: RIDGELINE_PROGRAM_ID, assignments: { some: {} } } });
    await expect(deleteAsset(db, asset.id, "test-director")).rejects.toThrow(/cannot be deleted/);
    expect(await db.asset.findUnique({ where: { id: asset.id } })).not.toBeNull();
  });

  it("keeps asset status synchronized through repair lifecycle", async () => {
    const asset = await createAsset(db, {
      id: "test-asset-repair",
      programId: RIDGELINE_PROGRAM_ID,
      category: AssetCategory.INSTRUMENT,
      condition: AssetCondition.FAIR,
      schoolAssetTag: "TEST-REPAIR-001",
    }, "test-director");
    const repair = await createRepair(db, {
      id: "test-repair-lifecycle",
      assetId: asset.id,
      operatingPeriodId: CURRENT_PERIOD_ID,
      openedAt: REPORT_AS_OF,
      description: "Synthetic repair",
      cost: 100,
    }, "test-director");
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe(AssetStatus.IN_REPAIR);

    await updateRepair(db, repair.id, {
      status: RepairStatus.CLOSED,
      closedAt: new Date("2026-07-21T12:00:00.000Z"),
    }, "test-director");
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe(AssetStatus.AVAILABLE);

    await deleteRepair(db, repair.id, "test-director");
    await deleteAsset(db, asset.id, "test-director");
  });
});
