"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({ children, className = "button primary", disabled = false }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending || disabled}>{pending ? <LoaderCircle className="spin" size={17} /> : null}{pending ? "Saving…" : children}</button>;
}
