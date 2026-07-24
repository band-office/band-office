"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

export function CalendarTokenReveal({ token, name }: { token: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/api/calendar/private/${token}`;
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  useEffect(() => {
    void fetch("/api/calendar/reveal", { method: "DELETE", credentials: "same-origin" });
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="calendar-token-reveal">
      <KeyRound size={20} />
      <div><strong>{name}</strong><span>This private subscription address is shown once.</span><input value={url} readOnly aria-label="Private calendar subscription address" suppressHydrationWarning /></div>
      <button className="icon-button" type="button" onClick={copy} aria-label="Copy private calendar link" title="Copy private calendar link">{copied ? <Check size={17} /> : <Copy size={17} />}</button>
    </section>
  );
}
