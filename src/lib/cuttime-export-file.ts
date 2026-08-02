"use client";

import JSZip from "jszip";
import Papa from "papaparse";
import type { CutTimeMigrationSource, CutTimeSourceKind } from "@/lib/cuttime-migration-types";

function cellColumn(reference: string) {
  const letters = reference.replace(/\d/g, "");
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsx(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sharedStringsXml = zip.file("xl/sharedStrings.xml") ? await zip.file("xl/sharedStrings.xml")!.async("string") : "";
  const sharedStrings = sharedStringsXml ? Array.from(new DOMParser().parseFromString(sharedStringsXml, "application/xml").getElementsByTagName("si")).map((item) => Array.from(item.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("")) : [];
  const worksheetName = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0];
  if (!worksheetName) throw new Error("The spreadsheet does not contain a readable worksheet.");
  const document = new DOMParser().parseFromString(await zip.file(worksheetName)!.async("string"), "application/xml");
  return Array.from(document.getElementsByTagName("row")).map((row) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const index = cellColumn(cell.getAttribute("r") ?? "A1");
      const type = cell.getAttribute("t");
      const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      values[index] = type === "s" ? sharedStrings[Number(value)] ?? "" : type === "inlineStr" ? Array.from(cell.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("") : value;
    }
    return values;
  });
}

async function parseCsv(csvText: string) {
  return new Promise<string[][]>((resolve, reject) => {
    Papa.parse<string[]>(csvText, {
      skipEmptyLines: true,
      complete: (result) => result.errors.length ? reject(new Error(result.errors[0].message)) : resolve(result.data),
      error: reject,
    });
  });
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parseCutTimeExportFile(kind: CutTimeSourceKind, file: File): Promise<CutTimeMigrationSource> {
  if (file.size > 12 * 1024 * 1024) throw new Error("Files larger than 12 MB are not accepted by the CutTime migration preview.");
  const rows = file.name.toLowerCase().endsWith(".xlsx") ? await parseXlsx(file) : await parseCsv(await file.text());
  if (rows.length < 2) throw new Error("The export needs a header row and at least one data row.");
  const headers = rows[0].map((header) => header.trim());
  if (!headers.some(Boolean)) throw new Error("The export header row is empty.");
  return { kind, filename: file.name, contentHash: await sha256(file), headers, rows: rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]))) };
}
