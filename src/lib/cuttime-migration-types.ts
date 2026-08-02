export const CUTTIME_SOURCE_KINDS = ["students", "guardians", "groups", "instruments", "attire", "equipment", "balances"] as const;

export type CutTimeSourceKind = typeof CUTTIME_SOURCE_KINDS[number];

export type CutTimeMigrationSource = {
  kind: CutTimeSourceKind;
  filename: string;
  contentHash: string;
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type CutTimeMigrationInput = {
  cutoverDate: string;
  sources: CutTimeMigrationSource[];
};

export type CutTimeMigrationMessage = {
  code: string;
  message: string;
  sourceKind?: CutTimeSourceKind;
  rowNumber?: number;
};

export type CutTimeMigrationPreview = {
  ready: boolean;
  errors: CutTimeMigrationMessage[];
  warnings: CutTimeMigrationMessage[];
  counts: {
    students: number;
    guardians: number;
    groups: number;
    assets: number;
    assignments: number;
    openingBalances: number;
  };
  sources: Array<{
    kind: CutTimeSourceKind;
    filename: string;
    rowCount: number;
    mappedFields: string[];
  }>;
};
