"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button className="button secondary print-button" type="button" onClick={() => window.print()}><Printer size={16} />Print page</button>;
}
