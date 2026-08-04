"use client";

import Papa from "papaparse";
import { FileCheck2, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";

type ImportField = { key: string; label: string; required?: boolean; aliases?: string[] };

type UniqueField = { key: string; label: string };

export function ImportWizard({ kind, fields, action, uniqueField }: { kind: string; fields: ImportField[]; action: (formData: FormData) => void | Promise<void>; uniqueField?: UniqueField }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [parseError, setParseError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const mappedRows = useMemo(() => rows.map((row) => Object.fromEntries(fields.map((field) => [field.key, mapping[field.key] === null || mapping[field.key] === undefined ? "" : row[mapping[field.key]!] ?? ""]))), [fields, mapping, rows]);
  const missingFields = fields.filter((field) => field.required && (mapping[field.key] === null || mapping[field.key] === undefined));
  const invalidRows = mappedRows.filter((row) => fields.some((field) => field.required && !row[field.key]?.trim())).length;
  const duplicateValues = useMemo(() => {
    if (!uniqueField) return [];
    const occurrences = new Map<string, { value: string; rowNumbers: number[] }>();
    mappedRows.forEach((row, index) => {
      const value = row[uniqueField.key]?.trim();
      if (!value) return;
      const key = value.toLowerCase();
      const occurrence = occurrences.get(key) ?? { value, rowNumbers: [] };
      occurrence.rowNumbers.push(index + 2);
      occurrences.set(key, occurrence);
    });
    return [...occurrences.values()].filter((occurrence) => occurrence.rowNumbers.length > 1);
  }, [mappedRows, uniqueField]);
  const ready = rows.length > 0 && missingFields.length === 0 && invalidRows === 0 && duplicateValues.length === 0;

  async function loadFile(file: File) {
    setParseError("");
    const contents = await file.text();
    Papa.parse<string[]>(contents, {
      skipEmptyLines: true,
      complete(result) {
        if (result.errors.length || result.data.length < 2) {
          setParseError(result.errors[0]?.message ?? "The CSV needs a header row and at least one data row.");
          return;
        }
        const nextHeaders = result.data[0].map((header) => header.trim());
        const normalized = nextHeaders.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const nextMapping: Record<string, number | null> = {};
        for (const field of fields) {
          const candidates = [field.key, ...(field.aliases ?? [])].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
          const index = normalized.findIndex((header) => candidates.includes(header));
          nextMapping[field.key] = index >= 0 ? index : null;
        }
        setFileName(file.name);
        setHeaders(nextHeaders);
        setRows(result.data.slice(1));
        setMapping(nextMapping);
      },
      error(error: Error) { setParseError(error.message); },
    });
  }

  return <div className="import-wizard">
    <section className="import-step"><div className="import-step-title"><span>1</span><div><h2>Select {kind} CSV</h2><p>The file is parsed locally in this browser.</p></div></div><label className={`file-drop${isReady ? "" : " disabled"}`}><input aria-label={`Select ${kind} CSV`} type="file" accept=".csv,text/csv" disabled={!isReady} onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /><Upload size={22} /><strong>{fileName || (isReady ? "Choose a CSV file" : "Preparing importer")}</strong><small>{fileName ? `${rows.length} data rows detected` : isReady ? "Click to browse" : "Available in a moment"}</small></label>{parseError ? <p className="inline-error">{parseError}</p> : null}</section>
    {headers.length ? <section className="import-step"><div className="import-step-title"><span>2</span><div><h2>Map columns</h2><p>Confirm which source column supplies each Band Office field.</p></div></div><div className="mapping-grid">{fields.map((field) => <label className="field" key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value === "" ? null : Number(event.target.value) }))}><option value="">Do not import</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div>{missingFields.length ? <p className="inline-error">Map required fields: {missingFields.map((field) => field.label).join(", ")}.</p> : null}</section> : null}
    {headers.length ? <section className="import-step">
      <div className="import-step-title"><span>3</span><div><h2>Dry-run preview</h2><p>No records change until you commit the validated rows.</p></div></div>
      {invalidRows ? <p className="inline-error">{invalidRows} rows are missing required mapped values. Correct the CSV before importing.</p> : duplicateValues.length ? <p className="inline-error">{uniqueField!.label} must be unique. Duplicate values: {duplicateValues.slice(0, 5).map((occurrence) => `${occurrence.value} (rows ${occurrence.rowNumbers.join(", ")})`).join("; ")}{duplicateValues.length > 5 ? `; and ${duplicateValues.length - 5} more` : ""}. Map a unique identifier before importing.</p> : <div className="import-ready"><FileCheck2 size={18} /><strong>{mappedRows.length} rows ready for reconciliation</strong></div>}
      <div className="data-table-wrap import-preview"><table className="data-table"><thead><tr>{fields.filter((field) => mapping[field.key] !== null && mapping[field.key] !== undefined).map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{mappedRows.slice(0, 5).map((row, index) => <tr key={index}>{fields.filter((field) => mapping[field.key] !== null && mapping[field.key] !== undefined).map((field) => <td key={field.key}>{row[field.key] || "—"}</td>)}</tr>)}</tbody></table></div>
      {mappedRows.length > 5 ? <p className="preview-note">Previewing 5 of {mappedRows.length} rows.</p> : null}
      <form action={action} className="import-commit"><input type="hidden" name="rowsJson" value={JSON.stringify(mappedRows)} /><div><FileSpreadsheet size={20} /><span><strong>Commit {mappedRows.length} rows</strong><small>Existing IDs or asset tags update; new records are created.</small></span></div><SubmitButton className="button primary" disabled={!ready}>Import {kind}</SubmitButton></form>
      {!ready ? <p className="inline-error">Resolve mapping and row errors before committing.</p> : null}
    </section> : null}
  </div>;
}
