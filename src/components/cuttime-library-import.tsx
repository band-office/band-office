"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { commitCutTimeLibraryImportAction, previewCutTimeLibraryImportAction } from "@/app/library-actions";
import { SubmitButton } from "@/components/submit-button";
import { parseCutTimeExportFile } from "@/lib/cuttime-export-file";
import type { CutTimeLibraryImportInput, CutTimeLibraryImportPreview, CutTimeMigrationSource } from "@/lib/cuttime-migration-types";

export function CutTimeLibraryImport() {
  const [source, setSource] = useState<CutTimeMigrationSource | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CutTimeLibraryImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();

  async function loadFile(file: File) {
    setLoading(true);
    setFileError("");
    setPreview(null);
    try {
      setSource(await parseCutTimeExportFile("library", file));
    } catch (error) {
      setSource(null);
      setFileError(error instanceof Error ? error.message : "The library export could not be read.");
    } finally {
      setLoading(false);
    }
  }

  function requestPreview() {
    if (!source) return;
    const input: CutTimeLibraryImportInput = { source };
    startPreview(async () => setPreview(await previewCutTimeLibraryImportAction(input)));
  }

  const input: CutTimeLibraryImportInput | null = source ? { source } : null;
  return <div className="cuttime-migration">
    <section className="migration-intro">
      <ShieldCheck size={22} />
      <div><strong>Import a CutTime music library</strong><p>This works after a people or inventory cutover. Band Office reads the export on this device and retains only its import manifest, recognized mappings, and results.</p></div>
    </section>

    <section className="import-step">
      <div className="import-step-title"><span>1</span><div><h2>Add the CutTime Library export</h2><p>CSV and XLSX are accepted. The original file is not stored in Band Office.</p></div></div>
      <label className="migration-file single-source">
        <input aria-label="Select CutTime Library export" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
        <span className="migration-file-icon">{loading ? <LoaderCircle className="spin" size={18} /> : source ? <CheckCircle2 size={18} /> : <Upload size={18} />}</span>
        <span><strong>Library export</strong><small>{source ? `${source.filename} · ${source.rows.length} rows` : "Select the CutTime library export with title, catalog, and location details."}</small></span>
        {fileError ? <em>{fileError}</em> : null}
      </label>
    </section>

    <section className="import-step">
      <div className="import-step-title"><span>2</span><div><h2>Preview the library import</h2><p>No library records change until the preview is clear.</p></div></div>
      <button className="button secondary" type="button" disabled={!source || previewing} onClick={requestPreview}>{previewing ? <LoaderCircle className="spin" size={16} /> : <FileSpreadsheet size={16} />}{previewing ? "Reviewing export" : "Preview library import"}</button>
      {preview ? <div className="migration-preview">
        <div className={`migration-ready ${preview.ready ? "success" : "error"}`}>{preview.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<strong>{preview.ready ? "Ready to import" : "Resolve the blocking items"}</strong><span>{preview.ready ? "Review the count and warnings, then commit this recorded library import." : `${preview.errors.length} blocking item${preview.errors.length === 1 ? "" : "s"} must be resolved.`}</span></div>
        <div className="migration-counts"><span><strong>{preview.count}</strong>library sets</span></div>
        {preview.errors.length ? <div className="migration-messages error"><strong>Blocking items</strong>{preview.errors.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}
        {preview.warnings.length ? <div className="migration-messages warning"><strong>Review after import</strong>{preview.warnings.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}
        <div className="migration-source-list"><div><strong>Library</strong><span>{preview.source.filename} · {preview.source.rowCount} rows</span><small>{preview.source.mappedFields.length ? `Detected: ${preview.source.mappedFields.join(", ")}` : "No supported fields detected"}</small></div></div>
      </div> : null}
    </section>

    <section className="import-step migration-commit">
      <div className="import-step-title"><span>3</span><div><h2>Commit the library import</h2><p>This creates an auditable import record. A repeat of the same CutTime library identifiers is blocked to prevent duplicates.</p></div></div>
      <form action={commitCutTimeLibraryImportAction}><input type="hidden" name="libraryImportJson" value={preview?.ready && input ? JSON.stringify(input) : ""} /><SubmitButton className="button primary" disabled={!preview?.ready}><ArrowRight size={16} />Import {preview?.count ?? 0} library sets</SubmitButton></form>
    </section>

    <Link className="text-link import-back-link" href="/library"><ArrowLeft size={15} />Back to music library</Link>
  </div>;
}
