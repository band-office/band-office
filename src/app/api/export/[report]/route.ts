import { getDb } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";
import {
  missingOrDamagedComponents,
  outstandingAssignments,
  repairCostByAsset,
  repairCostByPeriod,
  unassignedAssets,
  whoHasWhat,
} from "@/lib/reports";
import { randomUUID } from "node:crypto";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { getProgram } from "@/lib/program-context";
import { assessmentBatches, financialTransactions, studentBalances } from "@/lib/financial-reports";
import { announcementHistory, contactReadiness, deliveryOutcomes } from "@/lib/communications-reports";
import { libraryCatalog, libraryComponentIssues, libraryLoans, libraryPerformanceHistory, libraryResourcePresence, overdueLibraryLoans } from "@/lib/library-reports";
import { formCampaignCompletion, formReminderHistory, formResponseExtract, formRetentionStatus, formUploadRegister, outstandingFormRequests } from "@/lib/forms-reports";
import { eventAbsenceReport, eventAttendanceReport, eventEquipmentReport, eventRoster, eventRsvpReport, eventTripRoster, eventVolunteerReport } from "@/lib/events-reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await requireApiUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  if (!hasPermission(user, "EXPORT_DATA")) return new Response("Forbidden", { status: 403 });
  const { report } = await params;
  const db = getDb();
  const program = await getProgram(db);
  const financialReportNames = new Set(["student-balances", "financial-transactions", "assessment-batches", "financial-statement"]);
  const communicationReportNames = new Set(["announcement-history", "delivery-outcomes", "contact-readiness"]);
  const libraryReportNames = new Set(["library-catalog", "library-loans", "overdue-library-loans", "library-components", "library-performances", "library-resources"]);
  const formReportNames = new Set(["form-campaigns", "outstanding-forms", "form-responses", "form-uploads", "form-reminders", "form-retention"]);
  const eventReportNames = new Set(["event-roster", "event-rsvp", "event-attendance", "event-absences", "event-volunteers", "event-trip-roster", "event-equipment"]);
  if (financialReportNames.has(report) && !hasPermission(user, "VIEW_FINANCIALS")) return new Response("Forbidden", { status: 403 });
  if (communicationReportNames.has(report) && !hasPermission(user, "VIEW_COMMUNICATIONS")) return new Response("Forbidden", { status: 403 });
  if (libraryReportNames.has(report) && !hasPermission(user, "VIEW_LIBRARY")) return new Response("Forbidden", { status: 403 });
  if (formReportNames.has(report) && !hasPermission(user, "VIEW_FORMS")) return new Response("Forbidden", { status: 403 });
  if (eventReportNames.has(report) && !hasPermission(user, "VIEW_EVENTS")) return new Response("Forbidden", { status: 403 });
  const personId = new URL(request.url).searchParams.get("personId");
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (campaignId) {
    const campaign = await db.formCampaign.findFirst({ where: { id: campaignId, programId: program.id }, select: { id: true } });
    if (!campaign) return new Response("Form campaign not found", { status: 404 });
  }
  if (eventId) {
    const event = await db.event.findFirst({ where: { id: eventId, programId: program.id }, select: { id: true } });
    if (!event) return new Response("Event not found", { status: 404 });
  }
  if (report === "financial-statement") {
    if (!personId) return new Response("Student account is required", { status: 400 });
    const account = await db.studentProfile.findFirst({ where: { personId, person: { programId: program.id } }, select: { personId: true } });
    if (!account) return new Response("Student account not found", { status: 404 });
  }
  const loaders: Record<string, () => Promise<Array<Record<string, unknown>>>> = {
    "who-has-what": () => whoHasWhat(db, program.id),
    "unassigned-assets": () => unassignedAssets(db, program.id),
    "overdue-returns": () => outstandingAssignments(db, program.id),
    "flagged-components": () => missingOrDamagedComponents(db, program.id),
    "repair-cost-by-period": () => repairCostByPeriod(db, program.id),
    "repair-cost-by-asset": () => repairCostByAsset(db, program.id),
    "student-balances": () => studentBalances(db, program.id),
    "financial-transactions": () => financialTransactions(db, program.id),
    "assessment-batches": () => assessmentBatches(db, program.id),
    "financial-statement": () => financialTransactions(db, program.id, personId),
    "announcement-history": () => announcementHistory(db, program.id),
    "delivery-outcomes": () => deliveryOutcomes(db, program.id),
    "contact-readiness": () => contactReadiness(db, program.id),
    "library-catalog": () => libraryCatalog(db, program.id),
    "library-loans": () => libraryLoans(db, program.id),
    "overdue-library-loans": () => overdueLibraryLoans(db, program.id),
    "library-components": () => libraryComponentIssues(db, program.id),
    "library-performances": () => libraryPerformanceHistory(db, program.id),
    "library-resources": () => libraryResourcePresence(db, program.id),
    "form-campaigns": () => formCampaignCompletion(db, program.id),
    "outstanding-forms": () => outstandingFormRequests(db, program.id),
    "form-responses": () => formResponseExtract(db, program.id, campaignId),
    "form-uploads": () => formUploadRegister(db, program.id),
    "form-reminders": () => formReminderHistory(db, program.id),
    "form-retention": () => formRetentionStatus(db, program.id),
    "event-roster": () => eventRoster(db, program.id, eventId),
    "event-rsvp": () => eventRsvpReport(db, program.id, eventId),
    "event-attendance": () => eventAttendanceReport(db, program.id, eventId),
    "event-absences": () => eventAbsenceReport(db, program.id, eventId),
    "event-volunteers": () => eventVolunteerReport(db, program.id, eventId),
    "event-trip-roster": () => eventTripRoster(db, program.id, eventId),
    "event-equipment": () => eventEquipmentReport(db, program.id, eventId),
  };
  const loader = loaders[report];
  if (!loader) return new Response("Unknown report", { status: 404 });
  const rows = await loader();
  await db.auditLog.create({ data: { id: randomUUID(), programId: program.id, actor: user.username, action: "EXPORT", entityType: "Report", entityId: report, changeSummary: `Exported ${report} report` } });
  return new Response(rowsToCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="band-office-${report}.csv"` } });
}
