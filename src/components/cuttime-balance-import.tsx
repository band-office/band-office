"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { commitCutTimeBalanceImportAction, previewCutTimeBalanceImportAction } from "@/app/cuttime-balance-actions";
import { SubmitButton } from "@/components/submit-button";
import { parseCutTimeExportFile } from "@/lib/cuttime-export-file";
import type { CutTimeBalanceImportInput, CutTimeBalanceImportPreview, CutTimeMigrationSource } from "@/lib/cuttime-migration-types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CutTimeBalanceImport() {
  const [cutoverDate, setCutoverDate] = useState(today);
  const [source, setSource] = useState<CutTimeMigrationSource | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CutTimeBalanceImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();

  async function loadFile(file: File) {
    setLoading(true);
    setFileError("");
    setPreview(null);
    try {
      setSource(await parseCutTimeExportFile("balances", file));
    } catch (error) {
      setSource(null);
      setFileError(error instanceof Error ? error.message : "The balance export could not be read.");
    } finally {
      setLoading(false);
    }
  }

  const input: CutTimeBalanceImportInput | null = source ? { cutoverDate, source } : null;
  function requestPreview() {
    if (!input) return;
    startPreview(async () => setPreview(await previewCutTimeBalanceImportAction(input)));
  }

  return <div className="cuttime-migration">
    <section className="migration-intro"><ShieldCheck size={22} /><div><strong>Import CutTime opening balances</strong><p>Use this after people are already in Band Office. Each nonzero balance becomes one dated opening charge or credit. Payment history is not imported.</p></div></section>
    <section className="import-step">
      <div className="import-step-title"><span>1</span><div><h2>Set the balance date</h2><p>Use the date the CutTime export represents. It appears on every imported student statement.</p></div></div>
      <label className="field inline-date-field"><span>CutTime balance date</span><input aria-label="CutTime balance date" type="date" value={cutoverDate} onChange={(event) => { setCutoverDate(event.target.value); setPreview(null); }} required /></label>
    </section>
    <section className="import-step">
      <div className="import-step-title"><span>2</span><div><h2>Add the CutTime balance export</h2><p>CSV and XLSX are accepted. The original file is read in this browser and is not stored in Band Office.</p></div></div>
      <label className="migration-file single-source"><input aria-label="Select CutTime balance export" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /><span className="migration-file-icon">{loading ? <LoaderCircle className="spin" size={18} /> : source ? <CheckCircle2 size={18} /> : <Upload size={18} />}</span><span><strong>Student balances</strong><small>{source ? `${source.filename} · ${source.rows.length} rows` : "Select the CutTime export with Student ID and Student balance."}</small></span>{fileError ? <em>{fileError}</em> : null}</label>
    </section>
    <section className="import-step">
      <div className="import-step-title"><span>3</span><div><h2>Preview opening entries</h2><p>Nothing changes until student IDs and balance values reconcile.</p></div></div>
      <button className="button secondary" type="button" disabled={!input || previewing} onClick={requestPreview}>{previewing ? <LoaderCircle className="spin" size={16} /> : <FileSpreadsheet size={16} />}{previewing ? "Reviewing export" : "Preview balances"}</button>
      {preview ? <div className="migration-preview"><div className={`migration-ready ${preview.ready ? "success" : "error"}`}>{preview.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<strong>{preview.ready ? "Ready to import" : "Resolve the blocking items"}</strong><span>{preview.ready ? "Review the opening entries, then record this one-time balance import." : `${preview.errors.length} blocking item${preview.errors.length === 1 ? "" : "s"} must be resolved.`}</span></div><div className="migration-counts"><span><strong>{preview.counts.charges}</strong>charges</span><span><strong>{preview.counts.credits}</strong>credits</span><span><strong>{preview.counts.zeroBalances}</strong>zero balances skipped</span></div>{preview.errors.length ? <div className="migration-messages error"><strong>Blocking items</strong>{preview.errors.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}{preview.warnings.length ? <div className="migration-messages warning"><strong>Review after import</strong>{preview.warnings.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}{item.rowNumber ? ` Row ${item.rowNumber}.` : ""}</p>)}</div> : null}<div className="migration-source-list"><div><strong>Balances</strong><span>{preview.source.filename} · {preview.source.rowCount} rows</span><small>{preview.source.mappedFields.length ? `Detected: ${preview.source.mappedFields.join(", ")}` : "No supported fields detected"}</small></div></div></div> : null}
    </section>
    <section className="import-step migration-commit"><div className="import-step-title"><span>4</span><div><h2>Commit opening balances</h2><p>This import can run once per program. Later corrections use normal financial ledger entries, preserving the audit trail.</p></div></div><form action={commitCutTimeBalanceImportAction}><input type="hidden" name="balanceImportJson" value={preview?.ready && input ? JSON.stringify(input) : ""} /><SubmitButton className="button primary" disabled={!preview?.ready}><ArrowRight size={16} />Import opening balances</SubmitButton></form></section>
    <Link className="text-link import-back-link" href="/financials"><ArrowLeft size={15} />Back to Financials</Link>
  </div>;
}
