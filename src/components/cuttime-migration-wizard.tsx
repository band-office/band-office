"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { commitCutTimeMigrationAction, previewCutTimeMigrationAction } from "@/app/migration-actions";
import { SubmitButton } from "@/components/submit-button";
import { parseCutTimeExportFile } from "@/lib/cuttime-export-file";
import {
  CUTTIME_SOURCE_KINDS,
  type CutTimeMigrationInput,
  type CutTimeMigrationPreview,
  type CutTimeMigrationSource,
  type CutTimeSourceKind,
} from "@/lib/cuttime-migration-types";

const SOURCE_DETAILS: Record<CutTimeSourceKind, { label: string; help: string; required?: boolean }> = {
  students: { label: "Members", help: "Required. Export the member directory with student ID, name, grade, position, and groups.", required: true },
  guardians: { label: "Guardians", help: "Optional. Standard CutTime member exports already include Guardian 1 and Guardian 2 details, which Band Office imports automatically." },
  groups: { label: "Groups", help: "Optional. Use when group membership is exported separately from members." },
  instruments: { label: "Instruments", help: "Optional. Include CutTime ID, asset tag, condition, and assigned student ID when available." },
  attire: { label: "Attire", help: "Optional. Include CutTime ID, asset tag, size, condition, and assigned student ID when available." },
  equipment: { label: "Equipment", help: "Optional. Include CutTime ID, asset tag, condition, and assigned student ID when available." },
  balances: { label: "Student balances", help: "Optional. Imports one opening balance per student, not payment history." },
  library: { label: "Library", help: "Optional. Imports whole-set catalog details. Loans, files, and performance history stay outside this migration." },
};

export function CutTimeMigrationWizard() {
  const [cutoverDate, setCutoverDate] = useState("");
  const [sources, setSources] = useState<Partial<Record<CutTimeSourceKind, CutTimeMigrationSource>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<CutTimeSourceKind, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<CutTimeSourceKind, boolean>>>({});
  const [preview, setPreview] = useState<CutTimeMigrationPreview | null>(null);
  const [previewing, startPreview] = useTransition();

  useEffect(() => setCutoverDate(new Date().toISOString().slice(0, 10)), []);
  const migration = useMemo<CutTimeMigrationInput>(() => ({ cutoverDate, sources: CUTTIME_SOURCE_KINDS.flatMap((kind) => sources[kind] ? [sources[kind]!] : []) }), [cutoverDate, sources]);

  async function loadSource(kind: CutTimeSourceKind, file: File) {
    setLoading((current) => ({ ...current, [kind]: true }));
    setFileErrors((current) => ({ ...current, [kind]: "" }));
    setPreview(null);
    try {
      const source = await parseCutTimeExportFile(kind, file);
      setSources((current) => ({ ...current, [kind]: source }));
    } catch (error) {
      setSources((current) => ({ ...current, [kind]: undefined }));
      setFileErrors((current) => ({ ...current, [kind]: error instanceof Error ? error.message : "The export could not be read." }));
    } finally {
      setLoading((current) => ({ ...current, [kind]: false }));
    }
  }

  function requestPreview() {
    startPreview(async () => setPreview(await previewCutTimeMigrationAction(migration)));
  }

  return <div className="cuttime-migration">
    <section className="migration-intro">
      <ShieldCheck size={22} />
      <div><strong>One-time CutTime cutover</strong><p>Band Office reads exported files on this device, never connects to CutTime, and retains only the migration manifest, mappings, and results.</p></div>
    </section>

    <section className="import-step">
      <div className="import-step-title"><span>1</span><div><h2>Set the cutoff date</h2><p>Stop changing records in CutTime before creating the final exports. This date marks the starting point for current assignments and opening balances.</p></div></div>
      <label className="field migration-date"><span>CutTime became read-only on</span><input aria-label="CutTime cutover date" type="date" value={cutoverDate} onChange={(event) => { setCutoverDate(event.target.value); setPreview(null); }} required /></label>
    </section>

    <section className="import-step">
      <div className="import-step-title"><span>2</span><div><h2>Add CutTime exports</h2><p>Use the exports produced by CutTime. CSV and XLSX are accepted. The raw files are not stored in Band Office.</p></div></div>
      <div className="migration-file-grid">{CUTTIME_SOURCE_KINDS.map((kind) => {
        const detail = SOURCE_DETAILS[kind];
        const source = sources[kind];
        return <label className="migration-file" key={kind}>
          <input aria-label={`Select ${detail.label} export`} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadSource(kind, file); }} />
          <span className="migration-file-icon">{loading[kind] ? <LoaderCircle className="spin" size={18} /> : source ? <CheckCircle2 size={18} /> : <Upload size={18} />}</span>
          <span><strong>{detail.label}{detail.required ? " *" : ""}</strong><small>{source ? `${source.filename} · ${source.rows.length} rows` : detail.help}</small></span>
          {fileErrors[kind] ? <em>{fileErrors[kind]}</em> : null}
        </label>;
      })}</div>
    </section>

    <section className="import-step">
      <div className="import-step-title"><span>3</span><div><h2>Reconcile before importing</h2><p>The migration will not write anything until the preview is clear.</p></div></div>
      <button className="button secondary" type="button" disabled={!sources.students || previewing || !cutoverDate} onClick={requestPreview}>{previewing ? <LoaderCircle className="spin" size={16} /> : <FileSpreadsheet size={16} />}{previewing ? "Reviewing exports" : "Preview migration"}</button>
      {preview ? <div className="migration-preview">
        <div className={`migration-ready ${preview.ready ? "success" : "error"}`}>{preview.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<strong>{preview.ready ? "Ready to import" : "Resolve the blocking items"}</strong><span>{preview.ready ? "Review the counts and warnings, then commit one recorded cutover." : `${preview.errors.length} blocking item${preview.errors.length === 1 ? "" : "s"} must be resolved.`}</span></div>
        <div className="migration-counts"><span><strong>{preview.counts.students}</strong>students</span><span><strong>{preview.counts.guardians}</strong>guardians</span><span><strong>{preview.counts.groups}</strong>groups</span><span><strong>{preview.counts.assets}</strong>assets</span><span><strong>{preview.counts.assignments}</strong>assignments</span><span><strong>{preview.counts.openingBalances}</strong>balances</span><span><strong>{preview.counts.libraryItems}</strong>library sets</span></div>
        {preview.errors.length ? <div className="migration-messages error"><strong>Blocking items</strong>{preview.errors.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}
        {preview.warnings.length ? <div className="migration-messages warning"><strong>Review after import</strong>{preview.warnings.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}</p>)}</div> : null}
        <div className="migration-source-list">{preview.sources.map((source) => <div key={source.kind}><strong>{SOURCE_DETAILS[source.kind].label}</strong><span>{source.filename} · {source.rowCount} rows</span><small>{source.mappedFields.length ? `Detected: ${source.mappedFields.join(", ")}` : "No supported fields detected"}</small></div>)}</div>
      </div> : null}
    </section>

    <section className="import-step migration-commit">
      <div className="import-step-title"><span>4</span><div><h2>Commit the cutover</h2><p>This creates an auditable migration record. It cannot be run again in this program; later changes use the regular spreadsheet importer.</p></div></div>
      <form action={commitCutTimeMigrationAction}><input type="hidden" name="migrationJson" value={preview?.ready ? JSON.stringify(migration) : ""} /><SubmitButton className="button primary" disabled={!preview?.ready}><ArrowRight size={16} />Commit CutTime migration</SubmitButton></form>
    </section>
  </div>;
}
