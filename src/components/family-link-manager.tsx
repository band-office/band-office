"use client";

import { Link2, UserPlus } from "lucide-react";
import { useState } from "react";
import { createGuardianAndLinkStudentAction, linkGuardianStudentAction } from "@/app/actions";
import { SearchSelect, type SearchOption } from "@/components/search-select";
import { SubmitButton } from "@/components/submit-button";

type FamilyLinkManagerProps = {
  personId: string;
  kind: "student" | "guardian";
  options: SearchOption[];
  returnTo: string;
};

function RelationshipFields() {
  return <>
    <label className="field"><span>Relationship</span><input name="relationshipLabel" placeholder="Parent, guardian, grandparent..." /></label>
    <div className="family-link-checks">
      <label className="check-control compact"><input name="primaryContact" type="checkbox" /><span>Primary contact</span></label>
      <label className="check-control compact"><input name="receivesCommunication" type="checkbox" defaultChecked /><span>Receives email</span></label>
    </div>
  </>;
}

export function FamilyLinkManager({ personId, kind, options, returnTo }: FamilyLinkManagerProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = useState("");
  const isStudent = kind === "student";

  return <section className="family-link-manager">
    <header>
      <div>
        <strong>{isStudent ? "Add a guardian" : "Link another student"}</strong>
        <span>{isStudent ? "Search the directory or create a guardian here. Student ID is not required." : "Search by name, grade, or student ID."}</span>
      </div>
      {isStudent ? <div aria-label="Guardian link method" className="segmented-control" role="group">
        <button aria-pressed={mode === "existing"} type="button" onClick={() => setMode("existing")}><Link2 size={15} />Existing</button>
        <button aria-pressed={mode === "new"} type="button" onClick={() => setMode("new")}><UserPlus size={15} />New guardian</button>
      </div> : null}
    </header>

    {mode === "existing" ? <form action={linkGuardianStudentAction} className="family-link-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      {isStudent ? <input type="hidden" name="studentId" value={personId} /> : <input type="hidden" name="guardianId" value={personId} />}
      <SearchSelect
        name={isStudent ? "guardianId" : "studentId"}
        label={isStudent ? "Guardian" : "Student"}
        placeholder={isStudent ? "Search name, email, phone, or linked student" : "Search name, grade, or student ID"}
        options={options}
        onSelectionChange={setSelectedId}
      />
      <RelationshipFields />
      <SubmitButton disabled={!selectedId}><Link2 size={16} />Save relationship</SubmitButton>
    </form> : <form action={createGuardianAndLinkStudentAction} className="family-link-form">
      <input type="hidden" name="studentId" value={personId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="family-link-person-fields">
        <label className="field"><span>First name</span><input name="firstName" autoComplete="given-name" required /></label>
        <label className="field"><span>Last name</span><input name="lastName" autoComplete="family-name" required /></label>
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" /></label>
        <label className="field"><span>Phone</span><input name="phone" type="tel" autoComplete="tel" /></label>
      </div>
      <RelationshipFields />
      <SubmitButton><UserPlus size={16} />Create and link guardian</SubmitButton>
    </form>}
  </section>;
}
