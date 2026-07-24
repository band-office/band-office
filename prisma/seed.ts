import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPrismaClient } from "../src/lib/db";
import {
  activeAssignments,
  assetComponents,
  assets,
  historicalAssignments,
  groupMemberships,
  groups,
  guardianLinks,
  financialBatches,
  financialEntries,
  libraryItems,
  libraryComponentNotes,
  libraryLoans,
  performanceRecords,
  libraryResources,
  formTemplates,
  formTemplateVersions,
  formQuestions,
  formCampaigns,
  formRequests,
  formResponses,
  formAnswers,
  formReminders,
  eventSeries,
  events,
  eventGroups,
  eventParticipants,
  eventRsvps,
  attendanceRecords,
  eventEquipmentItems,
  eventResources,
  volunteerOpportunities,
  volunteerSignups,
  eventReminders,
  calendarSubscriptions,
  operatingPeriods,
  people,
  personClassifications,
  repairs,
  RIDGELINE_PROGRAM_ID,
  studentProfiles,
} from "../src/lib/seed-data";

export async function seedRidgeline(prisma: ReturnType<typeof createPrismaClient>) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.eventReminder.deleteMany(),
    prisma.volunteerSignup.deleteMany(),
    prisma.volunteerOpportunity.deleteMany(),
    prisma.eventResource.deleteMany(),
    prisma.eventEquipmentItem.deleteMany(),
    prisma.attendanceRecord.deleteMany(),
    prisma.eventRsvp.deleteMany(),
    prisma.eventParticipant.deleteMany(),
    prisma.eventGroup.deleteMany(),
    prisma.event.deleteMany(),
    prisma.eventSeries.deleteMany(),
    prisma.calendarSubscription.deleteMany(),
    prisma.formReminder.deleteMany(),
    prisma.formUpload.deleteMany(),
    prisma.formAnswer.deleteMany(),
    prisma.formResponse.deleteMany(),
    prisma.formRequest.deleteMany(),
    prisma.formCampaign.deleteMany(),
    prisma.formQuestion.deleteMany(),
    prisma.formTemplateVersion.deleteMany(),
    prisma.formTemplate.deleteMany(),
    prisma.libraryResource.deleteMany(),
    prisma.performanceRecord.deleteMany(),
    prisma.libraryLoan.deleteMany(),
    prisma.libraryComponentNote.deleteMany(),
    prisma.libraryItem.deleteMany(),
    prisma.deliveryAttempt.deleteMany(),
    prisma.announcementRecipient.deleteMany(),
    prisma.announcementAttachment.deleteMany(),
    prisma.communicationJob.deleteMany(),
    prisma.announcementAudienceTarget.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.emailContactState.deleteMany(),
    prisma.emailConnection.deleteMany(),
    prisma.financialEntry.deleteMany(),
    prisma.financialBatch.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.repair.deleteMany(),
    prisma.assetComponent.deleteMany(),
    prisma.guardianStudent.deleteMany(),
    prisma.groupMembership.deleteMany(),
    prisma.personClassification.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.person.deleteMany(),
    prisma.group.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.operatingPeriod.deleteMany(),
    prisma.program.deleteMany(),
  ]);

  await prisma.program.create({
    data: { id: RIDGELINE_PROGRAM_ID, name: "Ridgeline Middle School Band" },
  });
  await prisma.operatingPeriod.createMany({ data: operatingPeriods });
  await prisma.person.createMany({ data: people });
  await prisma.studentProfile.createMany({ data: studentProfiles });
  await prisma.personClassification.createMany({ data: personClassifications });
  await prisma.group.createMany({ data: groups });
  await prisma.groupMembership.createMany({ data: groupMemberships });
  await prisma.guardianStudent.createMany({ data: guardianLinks });
  await prisma.emailTemplate.createMany({ data: [
    { id: "email-template-rehearsal", programId: RIDGELINE_PROGRAM_ID, name: "Rehearsal reminder", subject: "Band rehearsal reminder", body: "This is a reminder about our upcoming rehearsal. Please check the program calendar for the confirmed time and location.", createdBy: "seed" },
    { id: "email-template-equipment", programId: RIDGELINE_PROGRAM_ID, name: "Equipment return", subject: "School equipment return", body: "Please return the listed school-owned equipment to the band room by the posted deadline. Reply to this email with any questions.", createdBy: "seed" },
  ] });
  await prisma.financialBatch.createMany({ data: financialBatches });
  await prisma.financialEntry.createMany({ data: financialEntries });
  await prisma.libraryItem.createMany({ data: libraryItems });
  await prisma.libraryComponentNote.createMany({ data: libraryComponentNotes });
  await prisma.libraryLoan.createMany({ data: libraryLoans });
  await prisma.performanceRecord.createMany({ data: performanceRecords });
  await prisma.libraryResource.createMany({ data: libraryResources });
  await prisma.formTemplate.createMany({ data: formTemplates });
  await prisma.formTemplateVersion.createMany({ data: formTemplateVersions });
  await prisma.formQuestion.createMany({ data: formQuestions });
  await prisma.formCampaign.createMany({ data: formCampaigns });
  await prisma.formRequest.createMany({ data: formRequests });
  await prisma.formResponse.createMany({ data: formResponses });
  await prisma.formAnswer.createMany({ data: formAnswers });
  await prisma.formReminder.createMany({ data: formReminders });
  await prisma.eventSeries.createMany({ data: eventSeries });
  await prisma.event.createMany({ data: events });
  await prisma.eventGroup.createMany({ data: eventGroups });
  await prisma.eventParticipant.createMany({ data: eventParticipants });
  await prisma.eventRsvp.createMany({ data: eventRsvps });
  await prisma.attendanceRecord.createMany({ data: attendanceRecords });
  await prisma.eventResource.createMany({ data: eventResources });
  await prisma.volunteerOpportunity.createMany({ data: volunteerOpportunities });
  await prisma.volunteerSignup.createMany({ data: volunteerSignups });
  await prisma.eventReminder.createMany({ data: eventReminders });
  await prisma.calendarSubscription.createMany({ data: calendarSubscriptions });
  await prisma.asset.createMany({ data: assets });
  await prisma.assetComponent.createMany({ data: assetComponents });
  await prisma.assignment.createMany({ data: [...activeAssignments, ...historicalAssignments] });
  await prisma.repair.createMany({ data: repairs });
  await prisma.eventEquipmentItem.createMany({ data: eventEquipmentItems });
  await prisma.auditLog.createMany({
    data: [
      ["Person", people.length],
      ["Group", groups.length],
      ["Asset", assets.length],
      ["AssetComponent", assetComponents.length],
      ["Assignment", activeAssignments.length + historicalAssignments.length],
      ["Repair", repairs.length],
      ["FinancialBatch", financialBatches.length],
      ["FinancialEntry", financialEntries.length],
      ["LibraryItem", libraryItems.length],
      ["LibraryLoan", libraryLoans.length],
      ["LibraryComponentNote", libraryComponentNotes.length],
      ["PerformanceRecord", performanceRecords.length],
      ["LibraryResource", libraryResources.length],
      ["FormTemplate", formTemplates.length],
      ["FormTemplateVersion", formTemplateVersions.length],
      ["FormQuestion", formQuestions.length],
      ["FormCampaign", formCampaigns.length],
      ["FormRequest", formRequests.length],
      ["FormResponse", formResponses.length],
      ["FormAnswer", formAnswers.length],
      ["FormReminder", formReminders.length],
      ["EventSeries", eventSeries.length],
      ["Event", events.length],
      ["EventGroup", eventGroups.length],
      ["EventParticipant", eventParticipants.length],
      ["EventRsvp", eventRsvps.length],
      ["AttendanceRecord", attendanceRecords.length],
      ["EventEquipmentItem", eventEquipmentItems.length],
      ["EventResource", eventResources.length],
      ["VolunteerOpportunity", volunteerOpportunities.length],
      ["VolunteerSignup", volunteerSignups.length],
      ["EventReminder", eventReminders.length],
      ["CalendarSubscription", calendarSubscriptions.length],
      ["OperatingPeriod", operatingPeriods.length],
    ].map(([entityType, count], index) => ({
      id: `audit-seed-${String(index + 1).padStart(3, "0")}`,
      programId: RIDGELINE_PROGRAM_ID,
      timestamp: new Date(Date.UTC(2026, 6, 1, 12, index, 0)),
      actor: "seed",
      action: "IMPORT",
      entityType: String(entityType),
      entityId: RIDGELINE_PROGRAM_ID,
      changeSummary: `Loaded ${count} deterministic ${entityType} fixture records`,
      changeDiffJson: JSON.stringify({ fields: ["fixture"], values: "[redacted]" }),
    })),
  });
}

const isMainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  const prisma = createPrismaClient();
  seedRidgeline(prisma)
    .then(async () => {
      console.log("Seeded deterministic Ridgeline Middle School demo data.");
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
