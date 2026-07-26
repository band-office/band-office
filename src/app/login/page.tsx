import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { loginAction, setupDirectorAction } from "@/app/auth-actions";
import { BrandMark } from "@/components/brand-mark";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { hasStaffUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; setup?: string }> }) {
  const query = await searchParams;
  const accountExists = await hasStaffUser();
  const setup = !accountExists || query.setup === "1";
  const program = setup ? await getDb().program.findFirst({ orderBy: { name: "asc" } }) : null;
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span><BrandMark size={42} /></span><div><strong>Band Office</strong><small>Open-source operations for school music programs.</small></div></div><div className="auth-copy"><span className="large-icon"><ShieldCheck size={24} /></span><h1>{setup ? "Create the director account" : "Welcome back"}</h1><p>{setup ? "This first account controls the local Band Office installation." : "Sign in to access school property records."}</p></div>{query.error ? <div className="flash flash-error">{query.error}</div> : null}<form action={setup ? setupDirectorAction : loginAction} className="auth-form">{setup ? <Field label="Program name"><input name="programName" defaultValue={program?.name ?? ""} required autoFocus /></Field> : null}<Field label="Username"><input name="username" autoComplete="username" required autoFocus={!setup} /></Field><Field label="Password"><input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 12 : undefined} required /></Field>{setup ? <Field label="Confirm password"><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></Field> : null}<SubmitButton><KeyRound size={16} />{setup ? "Create account" : "Sign in"}</SubmitButton></form>{!setup ? <div className="auth-links"><Link href="/portal/login">Student and guardian portal</Link></div> : null}<p className="auth-footnote">Staff sessions lock after 30 minutes without activity. Student and guardian password recovery is self-service through the portal.</p></section></main>;
}
