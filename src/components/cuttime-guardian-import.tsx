"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { commitCutTimeGuardianImportAction, previewCutTimeGuardianImportAction } from "@/app/cuttime-guardian-actions";
import { SubmitButton } from "@/components/submit-button";
import { parseCutTimeExportFile } from "@/lib/cuttime-export-file";
import type { CutTimeGuardianImportInput, CutTimeGuardianImportPreview, CutTimeMigrationSource } from "@/lib/cuttime-migration-types";

export function CutTimeGuardianImport() {
  const [source, setSource] = useState<CutTimeMigrationSource | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CutTimeGuardianImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();

  async function loadFile(file: File) {
    setLoading(true);
    setFileError("");
    setPreview(null);
    try {
      setSource(await parseCutTimeExportFile("students", file));
    } catch (error) {
      setSource(null);
      setFileError(error instanceof Error ? error.message : "The member export could not be read.");
    } finally {
      setLoading(false);
    }
  }

  function requestPreview() {
    if (!source) return;
    const input: CutTimeGuardianImportInput = { source };
    startPreview(async () => setPreview(await previewCutTimeGuardianImportAction(input)));
  }

  const input: CutTimeGuardianImportInput | null = source ? { source } : null;
  return <div className="cuttime-migration">
    <section className="migration-intro"><ShieldCheck size={22} /><div><strong>Import guardians from a CutTime member export</strong><p>CutTime includes Guardian 1 and Guardian 2 details in the member export. Band Office uses the exported Student ID to create each guardian and family link without matching people by name.</p></div></section>
    <section className="import-step">
      <div className="import-step-title"><span>1</span><div><h2>Add the CutTime Member export</h2><p>CSV and XLSX are accepted. The original file is read in this browser and not stored in Band Office.</p></div></div>
      <label className="migration-file single-source"><input aria-label="Select CutTime Member export" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /><span className="migration-file-icon">{loading ? <LoaderCircle className="spin" size={18} /> : source ? <CheckCircle2 size={18} /> : <Upload size={18} />}</span><span><strong>Member export</strong><small>{source ? `${source.filename} · ${source.rows.length} rows` : "Select the same CutTime member export used for the roster."}</small></span>{fileError ? <em>{fileError}</em> : null}</label>
    </section>
    <section className="import-step">
      <div className="import-step-title"><span>2</span><div><h2>Preview family links</h2><p>Nothing changes until every student relationship can be reconciled.</p></div></div>
      <button className="button secondary" type="button" disabled={!source || previewing} onClick={requestPreview}>{previewing ? <LoaderCircle className="spin" size={16} /> : <FileSpreadsheet size={16} />}{previewing ? "Reviewing export" : "Preview guardian import"}</button>
      {preview ? <div className="migration-preview"><div className={`migration-ready ${preview.ready ? "success" : "error"}`}>{preview.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<strong>{preview.ready ? "Ready to import" : "Resolve the blocking items"}</strong><span>{preview.ready ? "Review the counts and warnings, then create the family links." : `${preview.errors.length} blocking item${preview.errors.length === 1 ? "" : "s"} must be resolved.`}</span></div><div className="migration-counts"><span><strong>{preview.counts.guardians}</strong>new guardians</span><span><strong>{preview.counts.links}</strong>family links</span><span><strong>{preview.counts.existingGuardians}</strong>already known</span></div>{preview.errors.length ? <div className="migration-messages error"><strong>Blocking items</strong>{preview.errors.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}{preview.warnings.length ? <div className="migration-messages warning"><strong>Review after import</strong>{preview.warnings.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}<div className="migration-source-list"><div><strong>Members</strong><span>{preview.source.filename} · {preview.source.rowCount} rows</span><small>{preview.source.mappedFields.length ? `Detected: ${preview.source.mappedFields.join(", ")}` : "No supported guardian fields detected"}</small></div></div></div> : null}
    </section>
    <section className="import-step migration-commit"><div className="import-step-title"><span>3</span><div><h2>Commit guardian import</h2><p>Shared guardians are created once and linked to every matching student. Re-running the same export only adds missing links.</p></div></div><form action={commitCutTimeGuardianImportAction}><input type="hidden" name="guardianImportJson" value={preview?.ready && input ? JSON.stringify(input) : ""} /><SubmitButton className="button primary" disabled={!preview?.ready}><ArrowRight size={16} />Create family links</SubmitButton></form></section>
    <Link className="text-link import-back-link" href="/import"><ArrowLeft size={15} />Back to imports</Link>
  </div>;
}
