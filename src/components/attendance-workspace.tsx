"use client";

import { useMemo, useState } from "react";
import { CheckCheck, RotateCcw, Save, Search } from "lucide-react";
import { recordAttendanceAction } from "@/app/events-actions";

type AttendanceValue = "NOT_RECORDED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type AttendanceRow = { participantId: string; name: string; grade: number | null; groups: string; status: AttendanceValue };

const statuses: Array<{ value: AttendanceValue; label: string }> = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
  { value: "NOT_RECORDED", label: "Not recorded" },
];

export function AttendanceWorkspace({ eventId, rows }: { eventId: string; rows: AttendanceRow[] }) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, AttendanceValue>>(() => Object.fromEntries(rows.map((row) => [row.participantId, row.status])));
  const visibleRows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean ? rows.filter((row) => `${row.name} ${row.grade ?? ""} ${row.groups}`.toLowerCase().includes(clean)) : rows;
  }, [query, rows]);
  const counts = statuses.map((status) => ({ ...status, count: rows.filter((row) => values[row.participantId] === status.value).length }));

  function setAll(value: AttendanceValue) {
    setValues(Object.fromEntries(rows.map((row) => [row.participantId, value])));
  }

  return (
    <form action={recordAttendanceAction} className="attendance-workspace">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="attendance-toolbar no-print">
        <label className="search-box"><Search size={16} /><span className="sr-only">Filter roster</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter roster" /></label>
        <div className="attendance-bulk-actions">
          <button className="button secondary" type="button" onClick={() => setAll("PRESENT")}><CheckCheck size={16} />Mark all present</button>
          <button className="icon-button" type="button" onClick={() => setAll("NOT_RECORDED")} aria-label="Reset attendance" title="Reset attendance"><RotateCcw size={17} /></button>
        </div>
      </div>
      <div className="attendance-summary">{counts.map((item) => <span key={item.value} className={`attendance-count ${item.value.toLowerCase()}`}><strong>{item.count}</strong>{item.label}</span>)}</div>
      <div className="attendance-list">
        {visibleRows.map((row) => (
          <section className="attendance-row" key={row.participantId}>
            <div className="attendance-person"><strong>{row.name}</strong><span>{row.grade ? `Grade ${row.grade}` : "Program contact"}{row.groups ? ` · ${row.groups}` : ""}</span></div>
            <div className="attendance-options" role="radiogroup" aria-label={`Attendance for ${row.name}`}>
              {statuses.map((status) => (
                <label key={status.value} className={values[row.participantId] === status.value ? `selected ${status.value.toLowerCase()}` : ""}>
                  <input
                    type="radio"
                    name={`attendance_${row.participantId}`}
                    value={status.value}
                    checked={values[row.participantId] === status.value}
                    onChange={() => setValues((current) => ({ ...current, [row.participantId]: status.value }))}
                  />
                  <span>{status.label}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        {!visibleRows.length ? <p className="panel-empty">No roster members match this filter.</p> : null}
      </div>
      <div className="attendance-save no-print"><button className="button primary" type="submit"><Save size={16} />Save attendance</button></div>
    </form>
  );
}
