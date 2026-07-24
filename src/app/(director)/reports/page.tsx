import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { allStageTwoReports } from "@/lib/reports";
import { getProgram } from "@/lib/program-context";
import { hasPermission, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assessmentBatches, financialTransactions, studentBalances } from "@/lib/financial-reports";
import { announcementHistory, contactReadiness, deliveryOutcomes } from "@/lib/communications-reports";
import { libraryCatalog, libraryComponentIssues, libraryLoans, libraryPerformanceHistory, libraryResourcePresence, overdueLibraryLoans } from "@/lib/library-reports";
import { formCampaignCompletion, formReminderHistory, formResponseExtract, formRetentionStatus, formUploadRegister, outstandingFormRequests } from "@/lib/forms-reports";
import { eventAbsenceReport, eventAttendanceReport, eventEquipmentReport, eventRoster, eventRsvpReport, eventTripRoster, eventVolunteerReport } from "@/lib/events-reports";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const definitions = [
  { key: "who-has-what", title: "Who has what", description: "Every active assignment with person, group context, asset, dates, and agreement status.", countKey: "holdings" },
  { key: "unassigned-assets", title: "Unassigned assets", description: "The available, missing, retired, and repair inventory without an active holder.", countKey: "unassigned" },
  { key: "overdue-returns", title: "Overdue returns", description: "Assignments past their expected return date, ordered oldest first.", countKey: "outstanding" },
  { key: "flagged-components", title: "Missing or damaged components", description: "Cases and accessories requiring reconciliation or replacement.", countKey: "flaggedComponents" },
  { key: "repair-cost-by-period", title: "Repair spending by period", description: "Service count and cost summarized by operating period.", countKey: "costsByPeriod" },
  { key: "repair-cost-by-asset", title: "Lifetime repair cost by asset", description: "Repair frequency and total spend for each serviced asset.", countKey: "costsByAsset" },
] as const;

const financialDefinitions = [
  { key: "student-balances", title: "Student account balances", description: "Charges, payments, credits, reversals, and current balance for every student account.", countKey: "balances" },
  { key: "financial-transactions", title: "Financial transaction ledger", description: "The complete immutable ledger with dates, group context, references, and posting user.", countKey: "transactions" },
  { key: "assessment-batches", title: "Group assessment history", description: "Bulk fee assessments with student counts, per-student amount, and posted total.", countKey: "batches" },
] as const;

const communicationDefinitions = [
  { key: "announcement-history", title: "Announcement history", description: "Subjects, schedules, destination counts, accepted deliveries, and failures.", countKey: "history" },
  { key: "delivery-outcomes", title: "Email delivery outcomes", description: "The deduplicated recipient snapshot, permission result, attempt count, and final provider status.", countKey: "outcomes" },
  { key: "contact-readiness", title: "Contact readiness", description: "Usable addresses, missing email, disabled contacts, invalid addresses, and administrative holds.", countKey: "contacts" },
] as const;

const libraryDefinitions = [
  { key: "library-catalog", title: "Music library catalog", description: "Every whole score-and-parts set with status, location, component, performance, and resource counts.", countKey: "catalog" },
  { key: "library-loans", title: "Music loan history", description: "Current and closed whole-set loans with borrower, dates, period, and resolution.", countKey: "loans" },
  { key: "overdue-library-loans", title: "Overdue music loans", description: "Complete sets still out after their expected return date.", countKey: "overdueLoans" },
  { key: "library-components", title: "Music component history", description: "Missing, damaged, replaced, and resolved score or part exceptions.", countKey: "components" },
  { key: "library-performances", title: "Performance history", description: "Music performed by date, event, group, conductor, and operating period.", countKey: "performances" },
  { key: "library-resources", title: "Digital resource register", description: "Managed files and links with hashes, sizes, status, and no file contents.", countKey: "resources" },
] as const;

const formDefinitions = [
  { key: "form-campaigns", title: "Form campaign completion", description: "Recipient totals, completed, outstanding, and waived requests by campaign.", countKey: "campaigns" },
  { key: "outstanding-forms", title: "Outstanding form requests", description: "Students, recipients, due dates, progress, and reminder counts still requiring action.", countKey: "outstandingForms" },
  { key: "form-responses", title: "Form response extract", description: "Question-level response values with recipient and submission context.", countKey: "formResponses" },
  { key: "form-uploads", title: "Form upload register", description: "Managed response files with type, size, hash, and retention status.", countKey: "formUploads" },
  { key: "form-reminders", title: "Form reminder history", description: "Every form reminder draft with recipient and announcement reference.", countKey: "formReminders" },
  { key: "form-retention", title: "Form retention status", description: "Manual, retained, expired, and purged response records.", countKey: "formRetention" },
] as const;

const eventDefinitions = [
  { key: "event-roster", title: "Event roster", description: "Preserved participant snapshots with group, RSVP, and attendance status.", countKey: "roster" },
  { key: "event-rsvp", title: "Event RSVP", description: "Participant RSVP state, recording date, and recording staff member.", countKey: "rsvp" },
  { key: "event-attendance", title: "Event attendance", description: "Present, absent, late, excused, and not-recorded status without reason fields.", countKey: "attendance" },
  { key: "event-absences", title: "Event absences", description: "Absent and excused participant records for operational follow-up.", countKey: "absences" },
  { key: "event-volunteers", title: "Volunteer assignments", description: "Bounded opportunities, confirmed volunteers, capacity, and contact details.", countKey: "volunteers" },
  { key: "event-trip-roster", title: "Trip roster", description: "Students, grades, groups, RSVP, and assigned school assets for each event.", countKey: "tripRoster" },
  { key: "event-equipment", title: "Event equipment list", description: "Required and packed quantities with linked asset tags.", countKey: "equipment" },
] as const;

export default async function ReportsPage() {
  const db = getDb();
  const [program, user] = await Promise.all([getProgram(db), requireUser()]);
  if (!hasPermission(user, "VIEW_REPORTS")) redirect("/today?error=Report%20access%20is%20not%20available%20for%20this%20account.");
  const canExport = hasPermission(user, "EXPORT_DATA");
  const canViewFinancials = hasPermission(user, "VIEW_FINANCIALS");
  const canViewCommunications = hasPermission(user, "VIEW_COMMUNICATIONS");
  const canViewLibrary = hasPermission(user, "VIEW_LIBRARY");
  const canViewForms = hasPermission(user, "VIEW_FORMS");
  const canViewEvents = hasPermission(user, "VIEW_EVENTS");
  const [reports, balances, transactions, batches, history, outcomes, contacts, catalog, loans, overdueLoans, components, performances, resources, formCampaigns, outstandingForms, formResponses, formUploads, formReminders, formRetention, eventRosterRows, eventRsvpRows, eventAttendanceRows, eventAbsenceRows, eventVolunteerRows, eventTripRows, eventEquipmentRows] = await Promise.all([
    allStageTwoReports(db, program.id),
    canViewFinancials ? studentBalances(db, program.id) : Promise.resolve([]),
    canViewFinancials ? financialTransactions(db, program.id) : Promise.resolve([]),
    canViewFinancials ? assessmentBatches(db, program.id) : Promise.resolve([]),
    canViewCommunications ? announcementHistory(db, program.id) : Promise.resolve([]),
    canViewCommunications ? deliveryOutcomes(db, program.id) : Promise.resolve([]),
    canViewCommunications ? contactReadiness(db, program.id) : Promise.resolve([]),
    canViewLibrary ? libraryCatalog(db, program.id) : Promise.resolve([]),
    canViewLibrary ? libraryLoans(db, program.id) : Promise.resolve([]),
    canViewLibrary ? overdueLibraryLoans(db, program.id) : Promise.resolve([]),
    canViewLibrary ? libraryComponentIssues(db, program.id) : Promise.resolve([]),
    canViewLibrary ? libraryPerformanceHistory(db, program.id) : Promise.resolve([]),
    canViewLibrary ? libraryResourcePresence(db, program.id) : Promise.resolve([]),
    canViewForms ? formCampaignCompletion(db, program.id) : Promise.resolve([]),
    canViewForms ? outstandingFormRequests(db, program.id) : Promise.resolve([]),
    canViewForms ? formResponseExtract(db, program.id) : Promise.resolve([]),
    canViewForms ? formUploadRegister(db, program.id) : Promise.resolve([]),
    canViewForms ? formReminderHistory(db, program.id) : Promise.resolve([]),
    canViewForms ? formRetentionStatus(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventRoster(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventRsvpReport(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventAttendanceReport(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventAbsenceReport(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventVolunteerReport(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventTripRoster(db, program.id) : Promise.resolve([]),
    canViewEvents ? eventEquipmentReport(db, program.id) : Promise.resolve([]),
  ]);
  const value = reports.value[0];
  const financialReports = { balances, transactions, batches };
  const communicationReports = { history, outcomes, contacts };
  const libraryReports = { catalog, loans, overdueLoans, components, performances, resources };
  const formReports = { campaigns: formCampaigns, outstandingForms, formResponses, formUploads, formReminders, formRetention };
  const eventReports = { roster: eventRosterRows, rsvp: eventRsvpRows, attendance: eventAttendanceRows, absences: eventAbsenceRows, volunteers: eventVolunteerRows, tripRoster: eventTripRows, equipment: eventEquipmentRows };
  return <main className="content"><PageHeader eyebrow="Reports" title="Reports" description="Current operational views with controlled CSV export." icon={FileBarChart} actions={<PrintButton />} /><section className="report-summary"><div><span>Total fleet value</span><strong>{formatMoney(value.totalFleetValue)}</strong></div><div><span>Assigned-out value</span><strong>{formatMoney(value.assignedOutValue)}</strong></div><div><span>Asset records</span><strong>{value.assetCount}</strong></div></section><div className="report-catalog">{definitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{reports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div>{canViewFinancials ? <><div className="section-heading top-gap"><div><h2>Financial reports</h2><p>Student fee account records</p></div></div><div className="report-catalog">{financialDefinitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{financialReports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div></> : null}{canViewCommunications ? <><div className="section-heading top-gap"><div><h2>Communication reports</h2><p>Audience, delivery, and contact readiness</p></div></div><div className="report-catalog">{communicationDefinitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{communicationReports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div></> : null}{canViewLibrary ? <><div className="section-heading top-gap"><div><h2>Music library reports</h2><p>Catalog, loans, components, performances, and resource custody</p></div></div><div className="report-catalog">{libraryDefinitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{libraryReports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div></> : null}{canViewForms ? <><div className="section-heading top-gap"><div><h2>Form reports</h2><p>Completion, responses, uploads, reminders, and retention</p></div></div><div className="report-catalog">{formDefinitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{formReports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div></> : null}{canViewEvents ? <><div className="section-heading top-gap"><div><h2>Event reports</h2><p>Roster, RSVP, attendance, trips, equipment, and volunteers</p></div></div><div className="report-catalog">{eventDefinitions.map((definition) => <article className="report-item" key={definition.key}><div className="report-file-icon"><FileBarChart size={20} /></div><div><h2>{definition.title}</h2><p>{definition.description}</p><span>{eventReports[definition.countKey].length} rows currently</span></div>{canExport ? <a className="button secondary" href={`/api/export/${definition.key}`}><Download size={16} />CSV</a> : <span className="muted-copy">View only</span>}</article>)}</div></> : null}{canExport ? <p className="privacy-copy report-warning">Exports contain readable school records. Store them only in district-approved locations.</p> : null}</main>;
}
