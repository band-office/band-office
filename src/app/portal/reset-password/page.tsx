import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { resetPortalPasswordAction } from "@/app/portal-actions";
import { BrandMark } from "@/components/brand-mark";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Set portal password" };

export default async function ResetPortalPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return <main className="auth-page">
    <section className="auth-panel">
      <div className="auth-brand"><span><BrandMark size={42} /></span><div><strong>Band Office</strong><small>Student and guardian portal</small></div></div>
      <div className="auth-copy"><span className="large-icon"><KeyRound size={24} /></span><h1>Set a new password</h1><p>Use the one-time code from your email. Completing this step signs out any existing portal sessions.</p></div>
      {query.error ? <div className="flash flash-error">{query.error}</div> : null}
      <form action={resetPortalPasswordAction} className="auth-form">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required autoFocus /></Field>
        <Field label="8-digit code"><input name="code" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="one-time-code" required /></Field>
        <Field label="New password"><input name="password" type="password" minLength={12} autoComplete="new-password" required /></Field>
        <Field label="Confirm password"><input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></Field>
        <SubmitButton><ShieldCheck size={16} />Update password</SubmitButton>
      </form>
      <div className="auth-links"><Link href="/portal/forgot-password">Request another code</Link><Link href="/portal/login">Back to portal sign in</Link></div>
    </section>
  </main>;
}
