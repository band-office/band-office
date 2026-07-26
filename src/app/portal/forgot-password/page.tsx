import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { requestPortalPasswordResetAction } from "@/app/portal-actions";
import { BrandMark } from "@/components/brand-mark";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Reset portal password" };

export default async function ForgotPortalPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <main className="auth-page">
    <section className="auth-panel">
      <div className="auth-brand"><span><BrandMark size={42} /></span><div><strong>Band Office</strong><small>Student and guardian portal</small></div></div>
      <div className="auth-copy"><span className="large-icon"><Mail size={24} /></span><h1>Get a reset code</h1><p>Enter the email address your program has on file. The one-time code expires after 15 minutes.</p></div>
      {query.error ? <div className="flash flash-error">{query.error}</div> : null}
      {query.success ? <div className="flash flash-success">{query.success}</div> : null}
      <form action={requestPortalPasswordResetAction} className="auth-form">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required autoFocus /></Field>
        <SubmitButton><ShieldCheck size={16} />Email reset code</SubmitButton>
      </form>
      <div className="auth-links"><Link href="/portal/reset-password">I already have a code</Link><Link href="/portal/login">Back to portal sign in</Link></div>
    </section>
  </main>;
}
