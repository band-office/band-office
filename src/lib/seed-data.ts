import {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  ComponentStatus,
  FinancialEntryType,
  GroupKind,
  LibraryComponentStatus,
  LibraryItemStatus,
  LibraryLoanStatus,
  LibraryResourceKind,
  LibraryResourceStatus,
  FormAudienceType,
  FormQuestionType,
  FormRecipientMode,
  FormRequestStatus,
  FormResponseStatus,
  FormTemplateVersionStatus,
  AttendanceStatus,
  EventParticipantStatus,
  EventReminderAudience,
  EventResourceKind,
  EventResourceStatus,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  VolunteerOpportunityStatus,
  VolunteerSignupStatus,
  OperatingPeriodStatus,
  PersonClassificationType,
  PersonStatus,
  RepairStatus,
} from "@/generated/prisma/client";
import { RIDGELINE_PROGRAM_ID } from "@/lib/demo";

export { RIDGELINE_PROGRAM_ID };
export const CURRENT_PERIOD_ID = "period-2026-2027";
export const PRIOR_PERIOD_ID = "period-2025-2026";
export const REPORT_AS_OF = new Date("2026-07-19T12:00:00.000Z");

const firstNames = [
  "Marlow", "Ansel", "Petra", "Ivo", "Tamsin", "Corin", "Leda", "Bram", "Nola", "Eamon",
  "Vera", "Orson", "Mira", "Calder", "Elowen", "Soren", "Della", "Perrin", "Inez", "Hollis",
  "Alba", "Tobin", "Mavis", "Ronan", "Esme", "Cato", "Linnea", "Alden", "Thea", "Larkin",
  "Odette", "Basil", "Freya", "Quincy", "Nell", "Arden", "Calla", "Dorian", "Elsin", "Faye",
  "Galen", "Hera", "Isolde", "Jory", "Keira", "Leif", "Maeve", "Nico", "Opal", "Pax",
  "Reeve", "Selah", "Talia", "Urban", "Veda", "Wynn", "Xanthe", "Yara", "Zane", "Aster",
  "Blythe", "Cleo",
];

const lastNames = [
  "Tenby", "Quirk", "Voss", "Alder", "Bexley", "Cairn", "Darrow", "Eames", "Fenwick", "Grove",
  "Hale", "Irons", "Jasper", "Keene", "Loomis", "Morrow", "North", "Orchard", "Pryce", "Ridge",
  "Sable", "Thorne", "Umber", "Vale", "West", "Yarrow", "Zeller", "Ashby", "Briar", "Crane",
  "Dune", "Ellery", "Frost", "Gable", "Harbor", "Ingram", "Jett", "Knoll", "Linden", "March",
  "Nash", "Oakes", "Penn", "Roan", "Stowe", "Tolliver", "Unity", "Verne", "Wells", "York",
  "Ames", "Brice", "Cove", "Drake", "Ember", "Flint", "Gray", "Heath", "Ivory", "Jones",
  "Kestrel", "Lane",
];

const sectionCounts: Array<[string, number]> = [
  ["flute", 8],
  ["clarinet", 10],
  ["saxophone", 6],
  ["trumpet", 9],
  ["horn", 3],
  ["trombone", 7],
  ["euphonium", 3],
  ["tuba", 2],
  ["percussion", 10],
  ["oboe", 2],
  ["bassoon", 1],
  ["guard", 1],
];

const sections = sectionCounts.flatMap(([section, count]) => Array.from({ length: count }, () => section));

export const studentPeople = firstNames.map((firstName, index) => ({
  id: `member-${String(index + 1).padStart(3, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  firstName,
  lastName: lastNames[index],
  email: null,
  phone: null,
  status: PersonStatus.ACTIVE,
  notes: null,
}));

export const studentProfiles = studentPeople.map((person, index) => ({
  personId: person.id,
  programId: RIDGELINE_PROGRAM_ID,
  grade: 6 + (index % 3),
  schoolStudentId: `RMS-${String(2201 + index)}`,
}));

export const guardianPeople = Array.from({ length: 6 }, (_, index) => ({
  id: `guardian-${String(index + 1).padStart(3, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  firstName: ["Rowan", "Dana", "Avery", "Morgan", "Riley", "Jordan"][index],
  lastName: lastNames[index],
  email: `guardian${index + 1}@ridgeline.example`,
  phone: `555-010${index}`,
  status: PersonStatus.ACTIVE,
  notes: null,
}));

export const otherPeople = [
  { id: "booster-001", programId: RIDGELINE_PROGRAM_ID, firstName: "Casey", lastName: "Booster", email: "casey@ridgeline.example", phone: null, status: PersonStatus.ACTIVE, notes: null },
  { id: "external-001", programId: RIDGELINE_PROGRAM_ID, firstName: "Taylor", lastName: "Repair", email: "taylor@repair.example", phone: null, status: PersonStatus.ACTIVE, notes: null },
];

export const people = [...studentPeople, ...guardianPeople, ...otherPeople];

export const personClassifications = [
  ...studentPeople.map((person) => ({ personId: person.id, classification: PersonClassificationType.STUDENT })),
  ...guardianPeople.map((person) => ({ personId: person.id, classification: PersonClassificationType.GUARDIAN })),
  { personId: guardianPeople[0].id, classification: PersonClassificationType.BOOSTER },
  { personId: "booster-001", classification: PersonClassificationType.BOOSTER },
  { personId: "external-001", classification: PersonClassificationType.EXTERNAL },
];

export const groups = [
  ...sectionCounts.map(([name]) => ({ id: `group-section-${name}`, programId: RIDGELINE_PROGRAM_ID, name, kind: GroupKind.SECTION, description: null, active: true })),
  ...[6, 7, 8].map((grade) => ({ id: `group-grade-${grade}`, programId: RIDGELINE_PROGRAM_ID, name: `Grade ${grade} Band`, kind: GroupKind.ENSEMBLE, description: null, active: true })),
];

export const groupMemberships = studentPeople.flatMap((person, index) => [
  { id: `membership-section-${String(index + 1).padStart(3, "0")}`, groupId: `group-section-${sections[index]}`, personId: person.id, roleLabel: null },
  { id: `membership-grade-${String(index + 1).padStart(3, "0")}`, groupId: `group-grade-${studentProfiles[index].grade}`, personId: person.id, roleLabel: null },
]);

export const guardianLinks = guardianPeople.map((guardian, index) => ({
  id: `guardian-link-${String(index + 1).padStart(3, "0")}`,
  guardianId: guardian.id,
  studentId: studentPeople[index].id,
  relationshipLabel: "Guardian",
  primaryContact: true,
  receivesCommunication: true,
}));

const instrumentTypes = [
  "Flute", "Flute", "Flute", "Flute", "Flute", "Flute",
  "Clarinet", "Clarinet", "Clarinet", "Clarinet", "Clarinet", "Clarinet", "Clarinet", "Bass Clarinet",
  "Alto Saxophone", "Alto Saxophone", "Alto Saxophone", "Tenor Saxophone", "Baritone Saxophone",
  "Trumpet", "Trumpet", "Trumpet", "Trumpet", "Trumpet", "Trumpet", "Trumpet", "Trumpet",
  "Horn", "Horn", "Horn",
  "Trombone", "Trombone", "20K Sousaphone", "Trombone", "Bass Trombone",
  "Euphonium", "Euphonium", "Tuba",
  "Snare Drum", "Bell Kit", "Bell Kit", "Concert Bass Drum", "Timpani Set",
  "Oboe", "Oboe", "Bassoon", "Sousaphone", "Field Drum",
];

const instrumentMakeModel = (type: string, index: number) => {
  if (type === "20K Sousaphone") return { make: "Conn", model: "20K" };
  if (type === "Sousaphone") return { make: "King", model: "2350" };
  if (type.includes("Flute")) return { make: "Yamaha", model: "YFL-222" };
  if (type.includes("Clarinet")) return { make: "Buffet", model: index % 2 ? "E11" : "Prodige" };
  if (type.includes("Saxophone")) return { make: "Yamaha", model: "YAS-280" };
  if (type === "Trumpet") return { make: "Yamaha", model: "YTR-2330" };
  if (type === "Horn") return { make: "Holton", model: "H179" };
  if (type.includes("Trombone")) return { make: "Bach", model: "TB200" };
  if (type === "Euphonium") return { make: "Jupiter", model: "JEP700" };
  if (type === "Tuba") return { make: "Yamaha", model: "YBB-321" };
  if (type === "Oboe") return { make: "Fox", model: "Renard 330" };
  if (type === "Bassoon") return { make: "Fox", model: "Renard 41" };
  return { make: "Pearl", model: type.replaceAll(" ", "-").toUpperCase() };
};

export const instruments = instrumentTypes.map((type, index) => {
  const identity = instrumentMakeModel(type, index);
  const status = index < 30
    ? AssetStatus.ASSIGNED
    : index >= 34 && index <= 37
      ? AssetStatus.IN_REPAIR
      : index >= 43 && index <= 44
        ? AssetStatus.RETIRED
        : index >= 45
          ? AssetStatus.MISSING
          : AssetStatus.AVAILABLE;

  return {
    id: `asset-instrument-${String(index + 1).padStart(3, "0")}`,
    programId: RIDGELINE_PROGRAM_ID,
    category: AssetCategory.INSTRUMENT,
    make: identity.make,
    model: identity.model,
    serialNumber: `RMS-SYN-${String(730100 + index)}`,
    schoolAssetTag: `RMS-INST-${String(index + 1).padStart(3, "0")}`,
    size: null,
    condition: index >= 43 ? AssetCondition.POOR : index % 7 === 0 ? AssetCondition.FAIR : AssetCondition.GOOD,
    status,
    purchaseYear: 2004 + (index % 22),
    estimatedValue: type.includes("Sousaphone") ? 7400 : 900 + index * 85,
    location: index % 2 === 0 ? "Instrument Room A" : "Instrument Room B",
    notes: type,
  };
});

const uniformSizes = ["XS", "S", "M", "L", "XL", "2XL"];

export const uniforms = Array.from({ length: 74 }, (_, index) => ({
  id: `asset-uniform-${String(index + 1).padStart(3, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  category: AssetCategory.UNIFORM,
  make: "Fruhauf",
  model: index < 37 ? "Jacket" : "Bibber",
  serialNumber: null,
  schoolAssetTag: `RMS-UNI-${String(index + 1).padStart(3, "0")}`,
  size: uniformSizes[index % uniformSizes.length],
  condition: index % 11 === 0 ? AssetCondition.FAIR : AssetCondition.GOOD,
  status: index < 10 ? AssetStatus.ASSIGNED : AssetStatus.AVAILABLE,
  purchaseYear: 2017,
  estimatedValue: index < 37 ? 310 : 165,
  location: "Uniform Storage",
  notes: null,
}));

const equipmentTypes = [
  "Conductor Podium", "Equipment Cart", "Sousaphone Stand 1", "Sousaphone Stand 2", "Metronome",
  "Tuner Rack", "Percussion Cabinet", "Audio Mixer", "Speaker", "Music Stand Cart",
];

export const equipment = equipmentTypes.map((model, index) => ({
  id: `asset-equipment-${String(index + 1).padStart(3, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  category: AssetCategory.EQUIPMENT,
  make: index >= 7 ? "Yamaha" : "Ridgeline",
  model,
  serialNumber: `RMS-EQ-SYN-${String(4100 + index)}`,
  schoolAssetTag: `RMS-EQP-${String(index + 1).padStart(3, "0")}`,
  size: null,
  condition: AssetCondition.GOOD,
  status: index === 0 ? AssetStatus.ASSIGNED : AssetStatus.AVAILABLE,
  purchaseYear: 2018 + (index % 7),
  estimatedValue: 250 + index * 125,
  location: "Band Storage",
  notes: null,
}));

export const assets = [...instruments, ...uniforms, ...equipment];

const caseComponents = instruments.map((instrument, index) => ({
  id: `component-case-${String(index + 1).padStart(3, "0")}`,
  assetId: instrument.id,
  name: "Case",
  status: index === 3 || index === 22
    ? ComponentStatus.MISSING
    : index === 9
      ? ComponentStatus.DAMAGED
      : ComponentStatus.PRESENT,
  notes: index === 3 || index === 22 ? "Not present at audit" : index === 9 ? "Broken latch" : null,
}));

const accessoryComponents = instruments.slice(0, 16).map((instrument, index) => ({
  id: `component-accessory-${String(index + 1).padStart(3, "0")}`,
  assetId: instrument.id,
  name: instrumentTypes[index].includes("Flute") ? "Cleaning Rod" : instrumentTypes[index].includes("Clarinet") ? "Barrel" : "Neck Strap",
  status: index === 4 ? ComponentStatus.DAMAGED : index === 12 ? ComponentStatus.MISSING : ComponentStatus.PRESENT,
  notes: index === 4 ? "Needs replacement" : index === 12 ? "Not returned" : null,
}));

export const assetComponents = [...caseComponents, ...accessoryComponents];

const activeAssetIds = [
  ...instruments.slice(0, 30).map((asset) => asset.id),
  ...uniforms.slice(0, 10).map((asset) => asset.id),
  equipment[0].id,
];

export const activeAssignments = activeAssetIds.map((assetId, index) => ({
  id: `assignment-active-${String(index + 1).padStart(3, "0")}`,
  assetId,
  personId: studentPeople[index].id,
  groupId: `group-section-${sections[index]}`,
  operatingPeriodId: CURRENT_PERIOD_ID,
  checkedOutAt: new Date("2026-07-01T13:00:00.000Z"),
  expectedReturnAt: index < 8 ? new Date("2026-07-15T20:00:00.000Z") : new Date("2027-05-20T20:00:00.000Z"),
  conditionOut: AssetCondition.GOOD,
  agreementOnFile: index >= 6,
  checkedInAt: null,
  conditionIn: null,
  resolution: null,
  notes: null,
}));

const historicalAssetIds = [
  ...instruments.slice(0, 10).map((asset) => asset.id),
  ...uniforms.slice(20, 25).map((asset) => asset.id),
];

export const historicalAssignments = historicalAssetIds.map((assetId, index) => ({
  id: `assignment-history-${String(index + 1).padStart(3, "0")}`,
  assetId,
  personId: studentPeople[40 + index].id,
  groupId: `group-section-${sections[40 + index]}`,
  operatingPeriodId: PRIOR_PERIOD_ID,
  checkedOutAt: new Date("2025-08-05T13:00:00.000Z"),
  expectedReturnAt: new Date("2026-05-15T20:00:00.000Z"),
  conditionOut: AssetCondition.GOOD,
  agreementOnFile: true,
  checkedInAt: new Date("2026-05-12T17:00:00.000Z"),
  conditionIn: index % 4 === 0 ? AssetCondition.FAIR : AssetCondition.GOOD,
  resolution: "RETURNED" as const,
  notes: null,
}));

const closedRepairAssetIndexes = [0, 4, 8, 12, 16, 20, 24, 28, 30, 32];
const closedRepairCosts = [95, 140, 185, 225, 165, 210, 275, 320, 410, 4200];

export const closedRepairs = closedRepairAssetIndexes.map((assetIndex, index) => ({
  id: `repair-closed-${String(index + 1).padStart(3, "0")}`,
  assetId: instruments[assetIndex].id,
  operatingPeriodId: index < 5 ? PRIOR_PERIOD_ID : CURRENT_PERIOD_ID,
  openedAt: new Date(index < 5 ? "2026-02-10T13:00:00.000Z" : "2026-06-02T13:00:00.000Z"),
  description: index === 9 ? "Major valve and body overhaul" : "Routine playing-condition repair",
  vendor: index % 2 === 0 ? "Synthetic Music Repair" : "Ridgeline Instrument Service",
  cost: closedRepairCosts[index],
  closedAt: new Date(index < 5 ? "2026-02-24T13:00:00.000Z" : "2026-06-16T13:00:00.000Z"),
  status: RepairStatus.CLOSED,
}));

export const openRepairs = [34, 35, 36, 37].map((assetIndex, index) => ({
  id: `repair-open-${String(index + 1).padStart(3, "0")}`,
  assetId: instruments[assetIndex].id,
  operatingPeriodId: CURRENT_PERIOD_ID,
  openedAt: new Date(index === 0 ? "2026-04-20T13:00:00.000Z" : `2026-07-0${index + 1}T13:00:00.000Z`),
  description: index === 0 ? "Stale repair awaiting estimate" : "Open summer repair",
  vendor: index === 0 ? null : "Synthetic Music Repair",
  cost: index === 0 ? null : 125 + index * 50,
  closedAt: null,
  status: index === 3 ? RepairStatus.AT_VENDOR : RepairStatus.OPEN,
}));

export const repairs = [...closedRepairs, ...openRepairs];

export const operatingPeriods = [
  {
    id: PRIOR_PERIOD_ID,
    programId: RIDGELINE_PROGRAM_ID,
    label: "2025-2026",
    startsAt: new Date("2025-07-01T04:00:00.000Z"),
    endsAt: new Date("2026-06-30T03:59:59.000Z"),
    periodKind: "school_year",
    status: OperatingPeriodStatus.CLOSED,
    archivePath: "archives/ridgeline-2025-2026.zip",
  },
  {
    id: CURRENT_PERIOD_ID,
    programId: RIDGELINE_PROGRAM_ID,
    label: "2026-2027",
    startsAt: new Date("2026-07-01T04:00:00.000Z"),
    endsAt: new Date("2027-06-30T03:59:59.000Z"),
    periodKind: "school_year",
    status: OperatingPeriodStatus.OPEN,
    archivePath: null,
  },
];

export const financialBatches = [
  {
    id: "financial-batch-grade-6",
    programId: RIDGELINE_PROGRAM_ID,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: "group-grade-6",
    description: "Annual band program fee",
    amount: 75,
    occurredAt: new Date("2026-07-08T13:00:00.000Z"),
    dueDate: new Date("2026-08-15T20:00:00.000Z"),
    createdBy: "demo-director",
  },
  {
    id: "financial-batch-grade-7",
    programId: RIDGELINE_PROGRAM_ID,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: "group-grade-7",
    description: "Annual band program fee",
    amount: 50,
    occurredAt: new Date("2026-07-08T13:05:00.000Z"),
    dueDate: new Date("2026-08-15T20:00:00.000Z"),
    createdBy: "demo-director",
  },
  {
    id: "financial-batch-percussion",
    programId: RIDGELINE_PROGRAM_ID,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: "group-section-percussion",
    description: "Percussion equipment fee",
    amount: 30,
    occurredAt: new Date("2026-07-09T13:00:00.000Z"),
    dueDate: new Date("2026-08-20T20:00:00.000Z"),
    createdBy: "demo-director",
  },
];

const batchFinancialEntries = financialBatches.flatMap((batch) => {
  const members = groupMemberships.filter((membership) => membership.groupId === batch.groupId);
  return members.map((membership, index) => ({
    id: `financial-charge-${batch.id}-${String(index + 1).padStart(2, "0")}`,
    programId: RIDGELINE_PROGRAM_ID,
    personId: membership.personId,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: batch.groupId,
    batchId: batch.id,
    type: FinancialEntryType.CHARGE,
    amount: batch.amount,
    occurredAt: batch.occurredAt,
    dueDate: batch.dueDate,
    description: batch.description,
    reference: null,
    reversalOfId: null,
    createdBy: "demo-director",
  }));
});

const paymentEntries = studentPeople.slice(0, 12).map((person, index) => ({
  id: `financial-payment-${String(index + 1).padStart(2, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  personId: person.id,
  operatingPeriodId: CURRENT_PERIOD_ID,
  groupId: `group-grade-${studentProfiles[index].grade}`,
  batchId: null,
  type: FinancialEntryType.PAYMENT,
  amount: -50,
  occurredAt: new Date(`2026-07-${String(10 + (index % 5)).padStart(2, "0")}T14:00:00.000Z`),
  dueDate: null,
  description: "Manual payment received",
  reference: `RMS-REC-${String(1001 + index)}`,
  reversalOfId: null,
  createdBy: "demo-director",
}));

const creditEntries = studentPeople.slice(0, 3).map((person, index) => ({
  id: `financial-credit-${String(index + 1).padStart(2, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  personId: person.id,
  operatingPeriodId: CURRENT_PERIOD_ID,
  groupId: `group-grade-${studentProfiles[index].grade}`,
  batchId: null,
  type: FinancialEntryType.CREDIT,
  amount: -10,
  occurredAt: new Date("2026-07-16T14:00:00.000Z"),
  dueDate: null,
  description: "Program assistance credit",
  reference: "Synthetic demo credit",
  reversalOfId: null,
  createdBy: "demo-director",
}));

const correctionEntries = [
  {
    id: "financial-correction-original",
    programId: RIDGELINE_PROGRAM_ID,
    personId: studentPeople[15].id,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: "group-grade-6",
    batchId: null,
    type: FinancialEntryType.CHARGE,
    amount: 20,
    occurredAt: new Date("2026-07-17T14:00:00.000Z"),
    dueDate: null,
    description: "Duplicate synthetic charge",
    reference: null,
    reversalOfId: null,
    createdBy: "demo-director",
  },
  {
    id: "financial-correction-reversal",
    programId: RIDGELINE_PROGRAM_ID,
    personId: studentPeople[15].id,
    operatingPeriodId: CURRENT_PERIOD_ID,
    groupId: "group-grade-6",
    batchId: null,
    type: FinancialEntryType.REVERSAL,
    amount: -20,
    occurredAt: new Date("2026-07-18T14:00:00.000Z"),
    dueDate: null,
    description: "Reversal: Duplicate synthetic charge",
    reference: "Duplicate entry",
    reversalOfId: "financial-correction-original",
    createdBy: "demo-director",
  },
];

export const financialEntries = [...batchFinancialEntries, ...paymentEntries, ...creditEntries, ...correctionEntries];

const libraryTitles = [
  "Ridgeline Overture", "Lanterns at Dusk", "Copper Ridge March", "Northbound", "Riverstone Fanfare", "Quiet Harbor",
  "Signal Hill", "Cedar Run", "Winter Crossing", "Three Small Dances", "Summit Sketches", "Founders Processional",
];

export const libraryItems = libraryTitles.map((title, index) => ({
  id: `library-item-${String(index + 1).padStart(3, "0")}`,
  programId: RIDGELINE_PROGRAM_ID,
  title,
  composer: ["Elena Marlow", "D. Rowan", "Micah Vale", "S. Hollis"][index % 4],
  arranger: index % 3 === 0 ? "Avery North" : null,
  publisher: ["Ridgeline Editions", "Cairn Music", "Lantern Press"][index % 3],
  grade: ["1.5", "2", "2.5", "3"][index % 4],
  category: index % 4 === 2 ? "March" : "Concert band",
  catalogNumber: `RMS-LIB-${String(index + 1).padStart(3, "0")}`,
  storageLocation: `Library Shelf ${String.fromCharCode(65 + Math.floor(index / 4))}-${(index % 4) + 1}`,
  acquisitionDate: new Date(`${2015 + index}-08-01T12:00:00.000Z`),
  acquisitionSource: index % 2 ? "Program purchase" : "Booster purchase",
  acquisitionCost: 55 + index * 4,
  status: index === 0 || index === 3 ? LibraryItemStatus.ON_LOAN : index === 1 ? LibraryItemStatus.INCOMPLETE : index === 11 ? LibraryItemStatus.ARCHIVED : LibraryItemStatus.AVAILABLE,
  comments: index === 1 ? "Set requires reconciliation before the next performance." : null,
}));

export const libraryComponentNotes = [
  { id: "library-component-001", itemId: libraryItems[1].id, componentName: "Flute 1 part", status: LibraryComponentStatus.MISSING, notedAt: new Date("2026-07-05T12:00:00.000Z"), resolvedAt: null, notes: "Missing during summer shelf audit", createdBy: "demo-director" },
  { id: "library-component-002", itemId: libraryItems[2].id, componentName: "Full score cover", status: LibraryComponentStatus.REPLACED, notedAt: new Date("2025-10-12T12:00:00.000Z"), resolvedAt: new Date("2025-10-20T12:00:00.000Z"), notes: "Replacement cover added", createdBy: "demo-director" },
];

export const libraryLoans = [
  { id: "library-loan-001", itemId: libraryItems[0].id, borrowerPersonId: "external-001", borrowerName: "Taylor Repair", operatingPeriodId: CURRENT_PERIOD_ID, checkedOutAt: new Date("2026-07-01T12:00:00.000Z"), expectedReturnAt: new Date("2026-07-10T12:00:00.000Z"), returnedAt: null, status: LibraryLoanStatus.CHECKED_OUT, notes: "Reference loan to neighboring program", createdBy: "demo-director" },
  { id: "library-loan-002", itemId: libraryItems[2].id, borrowerPersonId: null, borrowerName: "Ridgeline Community Band", operatingPeriodId: PRIOR_PERIOD_ID, checkedOutAt: new Date("2026-03-01T12:00:00.000Z"), expectedReturnAt: new Date("2026-04-01T12:00:00.000Z"), returnedAt: new Date("2026-03-28T12:00:00.000Z"), status: LibraryLoanStatus.RETURNED, notes: null, createdBy: "demo-director" },
  { id: "library-loan-003", itemId: libraryItems[3].id, borrowerPersonId: "booster-001", borrowerName: "Casey Booster", operatingPeriodId: CURRENT_PERIOD_ID, checkedOutAt: new Date("2026-07-15T12:00:00.000Z"), expectedReturnAt: new Date("2026-08-15T12:00:00.000Z"), returnedAt: null, status: LibraryLoanStatus.CHECKED_OUT, notes: "Program display preparation", createdBy: "demo-director" },
];

export const performanceRecords = [
  { id: "performance-001", itemId: libraryItems[2].id, operatingPeriodId: PRIOR_PERIOD_ID, eventName: "Fall Concert", performedAt: new Date("2025-10-21T12:00:00.000Z"), groupId: "group-grade-8", conductor: "Demo Director", notes: null, createdBy: "demo-director" },
  { id: "performance-002", itemId: libraryItems[4].id, operatingPeriodId: PRIOR_PERIOD_ID, eventName: "Winter Concert", performedAt: new Date("2025-12-11T12:00:00.000Z"), groupId: "group-grade-7", conductor: "Demo Director", notes: null, createdBy: "demo-director" },
  { id: "performance-003", itemId: libraryItems[5].id, operatingPeriodId: PRIOR_PERIOD_ID, eventName: "Assessment Preview", performedAt: new Date("2026-02-24T12:00:00.000Z"), groupId: "group-grade-8", conductor: "Demo Director", notes: "Clinic performance", createdBy: "demo-director" },
  { id: "performance-004", itemId: libraryItems[2].id, operatingPeriodId: PRIOR_PERIOD_ID, eventName: "Spring Concert", performedAt: new Date("2026-05-07T12:00:00.000Z"), groupId: "group-grade-8", conductor: "Demo Director", notes: null, createdBy: "demo-director" },
  { id: "performance-005", itemId: libraryItems[7].id, operatingPeriodId: CURRENT_PERIOD_ID, eventName: "Summer Reading Session", performedAt: new Date("2026-07-17T12:00:00.000Z"), groupId: "group-grade-7", conductor: "Demo Director", notes: "First reading", createdBy: "demo-director" },
];

export const libraryResources = [
  { id: "library-resource-001", itemId: libraryItems[0].id, kind: LibraryResourceKind.EXTERNAL_LINK, label: "Publisher reference page", fileName: null, mimeType: null, byteSize: null, storageKey: null, contentHash: null, externalUrl: ["https:", "//example.invalid/ridgeline-overture"].join(""), copyrightAcknowledgedAt: new Date("2026-07-01T12:00:00.000Z"), status: LibraryResourceStatus.ACTIVE, removedAt: null, createdBy: "demo-director" },
  { id: "library-resource-002", itemId: libraryItems[4].id, kind: LibraryResourceKind.EXTERNAL_LINK, label: "Program notes reference", fileName: null, mimeType: null, byteSize: null, storageKey: null, contentHash: null, externalUrl: ["https:", "//example.invalid/riverstone-fanfare"].join(""), copyrightAcknowledgedAt: new Date("2026-07-02T12:00:00.000Z"), status: LibraryResourceStatus.ACTIVE, removedAt: null, createdBy: "demo-director" },
];

export const formTemplates = [
  { id: "form-template-trip", programId: RIDGELINE_PROGRAM_ID, name: "Trip information", description: "Routine trip preference and acknowledgment collection", archived: false, createdBy: "demo-director" },
  { id: "form-template-uniform", programId: RIDGELINE_PROGRAM_ID, name: "Uniform preferences", description: "Draft sizing and preference collection", archived: false, createdBy: "demo-director" },
];

export const formTemplateVersions = [
  { id: "form-version-trip-1", templateId: formTemplates[0].id, version: 1, status: FormTemplateVersionStatus.PUBLISHED, title: "Fall performance trip information", instructions: "Complete each item and return the requested information to the band office.", retentionDays: 365, publishedAt: new Date("2026-07-06T12:00:00.000Z"), createdBy: "demo-director" },
  { id: "form-version-uniform-1", templateId: formTemplates[1].id, version: 1, status: FormTemplateVersionStatus.DRAFT, title: "Uniform preference worksheet", instructions: "Staff draft for the next fitting cycle.", retentionDays: null, publishedAt: null, createdBy: "demo-director" },
];

export const formQuestions = [
  { id: "form-question-trip-1", versionId: formTemplateVersions[0].id, position: 1, prompt: "Preferred pickup contact name", helpText: "Enter the name only; contact details remain in the approved school directory.", type: FormQuestionType.SHORT_TEXT, required: true, optionsJson: null },
  { id: "form-question-trip-2", versionId: formTemplateVersions[0].id, position: 2, prompt: "Transportation plan", helpText: null, type: FormQuestionType.SINGLE_CHOICE, required: true, optionsJson: JSON.stringify(["School transportation", "Approved family pickup"]) },
  { id: "form-question-trip-3", versionId: formTemplateVersions[0].id, position: 3, prompt: "Select any equipment that must travel with the student", helpText: null, type: FormQuestionType.MULTIPLE_CHOICE, required: false, optionsJson: JSON.stringify(["School instrument", "Music folder", "Uniform garment bag"]) },
  { id: "form-question-trip-4", versionId: formTemplateVersions[0].id, position: 4, prompt: "Additional logistics note", helpText: "Do not enter medical, disciplinary, or family information.", type: FormQuestionType.LONG_TEXT, required: false, optionsJson: null },
  { id: "form-question-trip-5", versionId: formTemplateVersions[0].id, position: 5, prompt: "I acknowledge that the itinerary may be updated by program staff.", helpText: null, type: FormQuestionType.ACKNOWLEDGMENT, required: true, optionsJson: null },
  { id: "form-question-trip-6", versionId: formTemplateVersions[0].id, position: 6, prompt: "Optional approved district document", helpText: "Upload only files your school permits Band Office to retain.", type: FormQuestionType.FILE_UPLOAD, required: false, optionsJson: null },
  { id: "form-question-uniform-1", versionId: formTemplateVersions[1].id, position: 1, prompt: "Preferred jacket size", helpText: null, type: FormQuestionType.SINGLE_CHOICE, required: true, optionsJson: JSON.stringify(["Small", "Medium", "Large", "Extra large"]) },
  { id: "form-question-uniform-2", versionId: formTemplateVersions[1].id, position: 2, prompt: "Fitting completed", helpText: null, type: FormQuestionType.CHECKBOX, required: false, optionsJson: null },
];

export const formCampaigns = [
  { id: "form-campaign-trip", programId: RIDGELINE_PROGRAM_ID, operatingPeriodId: CURRENT_PERIOD_ID, templateVersionId: formTemplateVersions[0].id, name: "Fall trip forms", dueAt: new Date("2026-08-15T12:00:00.000Z"), audienceType: FormAudienceType.PERSON, audienceValue: null, audienceSummary: "Synthetic guardian pilot", recipientMode: FormRecipientMode.GUARDIANS, createdBy: "demo-director" },
];

export const formRequests = [
  { id: "form-request-001", campaignId: formCampaigns[0].id, recipientPersonId: guardianPeople[0].id, subjectPersonId: studentPeople[0].id, status: FormRequestStatus.COMPLETE, completedAt: new Date("2026-07-12T12:00:00.000Z"), waivedAt: null, retentionExpiresAt: new Date("2027-07-12T12:00:00.000Z") },
  { id: "form-request-002", campaignId: formCampaigns[0].id, recipientPersonId: guardianPeople[1].id, subjectPersonId: studentPeople[1].id, status: FormRequestStatus.IN_PROGRESS, completedAt: null, waivedAt: null, retentionExpiresAt: null },
  { id: "form-request-003", campaignId: formCampaigns[0].id, recipientPersonId: guardianPeople[2].id, subjectPersonId: studentPeople[2].id, status: FormRequestStatus.OUTSTANDING, completedAt: null, waivedAt: null, retentionExpiresAt: null },
  { id: "form-request-004", campaignId: formCampaigns[0].id, recipientPersonId: guardianPeople[3].id, subjectPersonId: studentPeople[3].id, status: FormRequestStatus.WAIVED, completedAt: null, waivedAt: new Date("2026-07-13T12:00:00.000Z"), retentionExpiresAt: null },
];

export const formResponses = [
  { id: "form-response-001", requestId: formRequests[0].id, status: FormResponseStatus.SUBMITTED, startedAt: new Date("2026-07-12T11:50:00.000Z"), submittedAt: new Date("2026-07-12T12:00:00.000Z"), recordedBy: "demo-director", purgedAt: null },
  { id: "form-response-002", requestId: formRequests[1].id, status: FormResponseStatus.DRAFT, startedAt: new Date("2026-07-13T12:00:00.000Z"), submittedAt: null, recordedBy: "demo-director", purgedAt: null },
];

export const formAnswers = [
  { id: "form-answer-001", responseId: formResponses[0].id, questionId: formQuestions[0].id, textValue: "Rowan Tenby", choiceValuesJson: null, booleanValue: null, acknowledgmentRecordedAt: null },
  { id: "form-answer-002", responseId: formResponses[0].id, questionId: formQuestions[1].id, textValue: null, choiceValuesJson: JSON.stringify(["School transportation"]), booleanValue: null, acknowledgmentRecordedAt: null },
  { id: "form-answer-003", responseId: formResponses[0].id, questionId: formQuestions[2].id, textValue: null, choiceValuesJson: JSON.stringify(["School instrument", "Music folder"]), booleanValue: null, acknowledgmentRecordedAt: null },
  { id: "form-answer-004", responseId: formResponses[0].id, questionId: formQuestions[4].id, textValue: null, choiceValuesJson: null, booleanValue: null, acknowledgmentRecordedAt: new Date("2026-07-12T12:00:00.000Z") },
  { id: "form-answer-005", responseId: formResponses[1].id, questionId: formQuestions[0].id, textValue: "Dana Quirk", choiceValuesJson: null, booleanValue: null, acknowledgmentRecordedAt: null },
];

export const formReminders = [
  { id: "form-reminder-001", requestId: formRequests[2].id, announcementId: null, createdAt: new Date("2026-07-18T12:00:00.000Z"), createdBy: "demo-director" },
];

export const eventSeries = [
  { id: "event-series-fall", programId: RIDGELINE_PROGRAM_ID, name: "Fall performances", description: "Public performances and travel", active: true, createdBy: "demo-director" },
];

export const events = [
  { id: "event-away-game", programId: RIDGELINE_PROGRAM_ID, operatingPeriodId: CURRENT_PERIOD_ID, seriesId: eventSeries[0].id, name: "Ridgeline away game", description: "Grade 8 pep band travel and performance.", startsAt: new Date("2026-08-28T21:30:00.000Z"), endsAt: new Date("2026-08-29T02:00:00.000Z"), location: "Valley Ridge High School", visibility: EventVisibility.PUBLIC, status: EventStatus.PUBLISHED, itinerary: "3:30 PM Load equipment\n4:15 PM Depart Ridgeline\n5:30 PM Warm up\n9:30 PM Estimated return", notes: null, rsvpEnabled: true, attendanceEnabled: true, createdBy: "demo-director" },
  { id: "event-summer-rehearsal", programId: RIDGELINE_PROGRAM_ID, operatingPeriodId: CURRENT_PERIOD_ID, seriesId: null, name: "Grade 7 summer rehearsal", description: "Summer music reading and equipment check.", startsAt: new Date("2026-07-17T14:00:00.000Z"), endsAt: new Date("2026-07-17T16:00:00.000Z"), location: "Ridgeline Band Room", visibility: EventVisibility.PRIVATE, status: EventStatus.COMPLETED, itinerary: "9:00 AM Check in\n9:15 AM Full ensemble\n11:00 AM Dismissal", notes: null, rsvpEnabled: false, attendanceEnabled: true, createdBy: "demo-director" },
  { id: "event-fall-clinic", programId: RIDGELINE_PROGRAM_ID, operatingPeriodId: CURRENT_PERIOD_ID, seriesId: eventSeries[0].id, name: "Grade 6 fall clinic", description: "Beginning-band rehearsal clinic.", startsAt: new Date("2026-09-05T13:00:00.000Z"), endsAt: new Date("2026-09-05T16:00:00.000Z"), location: "Ridgeline Middle School", visibility: EventVisibility.PRIVATE, status: EventStatus.PUBLISHED, itinerary: "8:30 AM Arrival\n9:00 AM Section rehearsals\n11:30 AM Pickup", notes: null, rsvpEnabled: true, attendanceEnabled: true, createdBy: "demo-director" },
];

export const eventGroups = [
  { id: "event-group-away", eventId: events[0].id, groupId: "group-grade-8", includedAt: new Date("2026-07-10T12:00:00.000Z"), removedAt: null },
  { id: "event-group-summer", eventId: events[1].id, groupId: "group-grade-7", includedAt: new Date("2026-07-10T12:00:00.000Z"), removedAt: null },
  { id: "event-group-clinic", eventId: events[2].id, groupId: "group-grade-6", includedAt: new Date("2026-07-10T12:00:00.000Z"), removedAt: null },
];

const eventRoster = [
  { eventId: events[0].id, personIds: groupMemberships.filter((row) => row.groupId === "group-grade-8").map((row) => row.personId) },
  { eventId: events[1].id, personIds: groupMemberships.filter((row) => row.groupId === "group-grade-7").map((row) => row.personId) },
  { eventId: events[2].id, personIds: groupMemberships.filter((row) => row.groupId === "group-grade-6").map((row) => row.personId) },
];

export const eventParticipants = eventRoster.flatMap((roster, rosterIndex) => roster.personIds.map((personId, index) => ({
  id: `event-participant-${rosterIndex + 1}-${String(index + 1).padStart(2, "0")}`,
  eventId: roster.eventId,
  personId,
  status: EventParticipantStatus.ACTIVE,
  addedAt: new Date("2026-07-10T12:00:00.000Z"),
  removedAt: null,
  addedBy: "demo-director",
})));

export const eventRsvps = eventParticipants.map((participant, index) => {
  const event = events.find((item) => item.id === participant.eventId)!;
  const status = !event.rsvpEnabled ? EventRsvpStatus.PENDING : index % 5 === 0 ? EventRsvpStatus.NO : index % 4 === 0 ? EventRsvpStatus.MAYBE : index % 3 === 0 ? EventRsvpStatus.PENDING : EventRsvpStatus.YES;
  return { id: `event-rsvp-${String(index + 1).padStart(3, "0")}`, participantId: participant.id, status, recordedAt: status === EventRsvpStatus.PENDING ? null : new Date("2026-07-18T12:00:00.000Z"), recordedBy: status === EventRsvpStatus.PENDING ? null : "demo-director" };
});

const summerParticipants = eventParticipants.filter((participant) => participant.eventId === events[1].id);
export const attendanceRecords = eventParticipants.map((participant, index) => {
  const summerIndex = summerParticipants.findIndex((row) => row.id === participant.id);
  const status = summerIndex < 0 ? AttendanceStatus.NOT_RECORDED : summerIndex === 0 ? AttendanceStatus.ABSENT : summerIndex === 1 ? AttendanceStatus.EXCUSED : summerIndex < 4 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
  return { id: `attendance-${String(index + 1).padStart(3, "0")}`, participantId: participant.id, status, recordedAt: status === AttendanceStatus.NOT_RECORDED ? null : new Date("2026-07-17T16:05:00.000Z"), recordedBy: status === AttendanceStatus.NOT_RECORDED ? null : "demo-director" };
});

export const eventEquipmentItems = [
  { id: "event-equipment-001", eventId: events[0].id, assetId: equipment[1].id, label: "Equipment cart", quantity: 1, packedQuantity: 1, notes: null, createdBy: "demo-director" },
  { id: "event-equipment-002", eventId: events[0].id, assetId: equipment[9].id, label: "Music stand cart", quantity: 1, packedQuantity: 0, notes: "Load after final rehearsal", createdBy: "demo-director" },
  { id: "event-equipment-003", eventId: events[0].id, assetId: null, label: "Water coolers", quantity: 2, packedQuantity: 1, notes: null, createdBy: "demo-director" },
  { id: "event-equipment-004", eventId: events[0].id, assetId: equipment[7].id, label: "Audio mixer", quantity: 1, packedQuantity: 1, notes: null, createdBy: "demo-director" },
  { id: "event-equipment-005", eventId: events[1].id, assetId: equipment[0].id, label: "Conductor podium", quantity: 1, packedQuantity: 1, notes: null, createdBy: "demo-director" },
  { id: "event-equipment-006", eventId: events[1].id, assetId: null, label: "Student music folders", quantity: 21, packedQuantity: 21, notes: null, createdBy: "demo-director" },
];

export const eventResources = [
  { id: "event-resource-001", eventId: events[0].id, kind: EventResourceKind.EXTERNAL_LINK, label: "Venue reference", fileName: null, mimeType: null, byteSize: null, storageKey: null, contentHash: null, externalUrl: ["https:", "//example.invalid/valley-ridge"].join(""), status: EventResourceStatus.ACTIVE, removedAt: null, createdBy: "demo-director" },
  { id: "event-resource-002", eventId: events[2].id, kind: EventResourceKind.EXTERNAL_LINK, label: "Clinic schedule reference", fileName: null, mimeType: null, byteSize: null, storageKey: null, contentHash: null, externalUrl: ["https:", "//example.invalid/fall-clinic"].join(""), status: EventResourceStatus.ACTIVE, removedAt: null, createdBy: "demo-director" },
];

export const volunteerOpportunities = [
  { id: "volunteer-opportunity-001", eventId: events[0].id, title: "Equipment loading", description: "Load and unload program equipment.", startsAt: new Date("2026-08-28T19:30:00.000Z"), endsAt: new Date("2026-08-28T21:00:00.000Z"), capacity: 3, status: VolunteerOpportunityStatus.OPEN, createdBy: "demo-director" },
  { id: "volunteer-opportunity-002", eventId: events[0].id, title: "Uniform check-in", description: "Assist staff with post-performance uniform return.", startsAt: new Date("2026-08-29T01:30:00.000Z"), endsAt: new Date("2026-08-29T02:15:00.000Z"), capacity: 2, status: VolunteerOpportunityStatus.OPEN, createdBy: "demo-director" },
];

export const volunteerSignups = [
  { id: "volunteer-signup-001", opportunityId: volunteerOpportunities[0].id, personId: guardianPeople[0].id, status: VolunteerSignupStatus.CONFIRMED, signedUpAt: new Date("2026-07-18T12:00:00.000Z"), createdBy: "demo-director" },
  { id: "volunteer-signup-002", opportunityId: volunteerOpportunities[0].id, personId: "booster-001", status: VolunteerSignupStatus.CONFIRMED, signedUpAt: new Date("2026-07-18T12:05:00.000Z"), createdBy: "demo-director" },
  { id: "volunteer-signup-003", opportunityId: volunteerOpportunities[1].id, personId: guardianPeople[1].id, status: VolunteerSignupStatus.CONFIRMED, signedUpAt: new Date("2026-07-18T12:10:00.000Z"), createdBy: "demo-director" },
];

export const eventReminders = [
  { id: "event-reminder-001", eventId: events[0].id, announcementId: null, audience: EventReminderAudience.GUARDIANS, scheduledFor: null, createdAt: new Date("2026-07-19T12:00:00.000Z"), createdBy: "demo-director" },
];

export const calendarSubscriptions = [
  { id: "calendar-subscription-revoked", programId: RIDGELINE_PROGRAM_ID, name: "Prior director calendar", tokenHash: "8f2f98f422d39aa022bd07cdb8e330e7796816d1a7ab2a9b38d07d90b1c16683", createdAt: new Date("2026-07-01T12:00:00.000Z"), revokedAt: new Date("2026-07-15T12:00:00.000Z"), lastUsedAt: new Date("2026-07-14T12:00:00.000Z"), createdBy: "demo-director" },
];

export const SEED_EXPECTATIONS = {
  people: 70,
  students: 62,
  groups: 15,
  memberships: 124,
  guardianLinks: 6,
  instruments: 48,
  uniforms: 74,
  equipment: 10,
  assets: 132,
  components: 64,
  flaggedComponents: 5,
  activeAssignments: 41,
  unsignedAssignments: 6,
  historicalAssignments: 15,
  repairs: 14,
  openRepairs: 4,
  overdueAssignmentsAtReportDate: 8,
  unassignedAssets: 91,
  financialBatches: 3,
  financialEntries: 69,
  libraryItems: 12,
  libraryLoans: 3,
  libraryComponentNotes: 2,
  performanceRecords: 5,
  libraryResources: 2,
  formTemplates: 2,
  formQuestions: 8,
  formCampaigns: 1,
  formRequests: 4,
  events: 3,
  eventParticipants: 62,
  eventEquipmentItems: 6,
  volunteerOpportunities: 2,
  volunteerSignups: 3,
} as const;
