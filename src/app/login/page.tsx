import Link from "next/link";
import { Database, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { loginAction, setupDemoAction, setupDirectorAction } from "@/app/auth-actions";
import { BrandMark } from "@/components/brand-mark";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { hasStaffUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; setup?: string; mode?: string }> }) {
  const query = await searchParams;
  const accountExists = await hasStaffUser();
  const setup = !accountExists || query.setup === "1";
  const demo = setup && !accountExists && query.mode === "demo";
  const program = setup ? await getDb().program.findFirst({ orderBy: { name: "asc" } }) : null;
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span><BrandMark size={42} /></span><div><strong>Band Office</strong><small>Open-source operations for school music programs.</small></div></div>{setup && !accountExists ? <nav className="auth-mode" aria-label="First-run setup mode"><Link href="/login?setup=1" aria-current={!demo ? "page" : undefined}>My program</Link><Link href="/login?setup=1&mode=demo" aria-current={demo ? "page" : undefined}>Fictional demo</Link></nav> : null}<div className="auth-copy"><span className="large-icon">{demo ? <Database size={24} /> : <ShieldCheck size={24} />}</span><h1>{demo ? "Explore the fictional demo" : setup ? "Create the director account" : "Welcome back"}</h1><p>{demo ? "Load the invented Ridgeline program and create a local director account." : setup ? "This first account controls the local Band Office installation." : "Sign in to access school property records."}</p></div>{setup && !accountExists ? <div className="auth-safety"><ShieldAlert size={18} /><p><strong>Alpha data boundary</strong><span>{demo ? "Every Ridgeline record is fictional. Do not add real student information to this demo installation." : "Evaluate with fictional data first. Before loading student information, obtain school approval, use a managed encrypted computer, and complete an encrypted backup and verified restore."}</span></p></div> : null}{query.error ? <div className="flash flash-error">{query.error}</div> : null}<form action={setup ? demo ? setupDemoAction : setupDirectorAction : loginAction} className="auth-form">{setup && !demo ? <Field label="Program name"><input name="programName" defaultValue={program?.name ?? ""} required autoFocus /></Field> : null}<Field label="Username"><input name="username" autoComplete="username" required autoFocus={!setup || demo} /></Field><Field label="Password"><input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 12 : undefined} required /></Field>{setup ? <Field label="Confirm password"><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></Field> : null}<SubmitButton>{demo ? <Database size={16} /> : <KeyRound size={16} />}{demo ? "Load fictional demo" : setup ? "Create account" : "Sign in"}</SubmitButton></form>{!setup ? <div className="auth-links"><Link href="/portal/login">Student and guardian portal</Link></div> : null}<p className="auth-footnote">Staff sessions lock after 30 minutes without activity. Student and guardian password recovery is self-service through the portal.</p></section></main>;
}
