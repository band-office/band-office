import Link from "next/link";
import { KeyRound, UsersRound } from "lucide-react";
import { portalLoginAction } from "@/app/portal-actions";
import { BrandMark } from "@/components/brand-mark";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Student and guardian sign in" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <main className="auth-page">
    <section className="auth-panel">
      <div className="auth-brand"><span><BrandMark size={42} /></span><div><strong>Band Office</strong><small>Student and guardian portal</small></div></div>
      <div className="auth-copy"><span className="large-icon"><UsersRound size={24} /></span><h1>Program portal</h1><p>View linked student accounts, assigned property, balances, and forms.</p></div>
      {query.error ? <div className="flash flash-error">{query.error}</div> : null}
      {query.success ? <div className="flash flash-success">{query.success}</div> : null}
      <form action={portalLoginAction} className="auth-form">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required autoFocus /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton><KeyRound size={16} />Sign in</SubmitButton>
      </form>
      <div className="auth-links"><Link href="/portal/forgot-password">Forgot or need to set your password?</Link><Link href="/login">Director and staff sign in</Link></div>
    </section>
  </main>;
}
