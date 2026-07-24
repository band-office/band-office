import Link from "next/link";
import { ArrowLeft, Download, FileText, Save } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { saveFormResponseAction } from "@/app/forms-actions";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { StatusPill } from "@/components/status-pill";
import { FormQuestionType, FormUploadStatus } from "@/generated/prisma/client";
import { hasPermission, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

function choices(value: string | null) {
  try { return value ? JSON.parse(value) as string[] : []; } catch { return []; }
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function FormResponsePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  if (!hasPermission(user, "RECORD_FORM_RESPONSES")) redirect("/forms?error=Your%20account%20cannot%20record%20form%20responses.");
  const request = await getDb().formRequest.findFirst({ where: { id, campaign: { programId: user.programId } }, include: { recipientPerson: true, subjectPerson: true, campaign: { include: { templateVersion: { include: { template: true, questions: { orderBy: { position: "asc" } } } } } }, response: { include: { answers: true, uploads: { where: { status: FormUploadStatus.ACTIVE }, orderBy: { createdAt: "desc" } } } } } });
  if (!request) notFound();
  const answerMap = new Map(request.response?.answers.map((answer) => [answer.questionId, answer]) ?? []);
  const uploadMap = new Map<string, NonNullable<typeof request.response>["uploads"]>();
  for (const upload of request.response?.uploads ?? []) uploadMap.set(upload.questionId, [...(uploadMap.get(upload.questionId) ?? []), upload]);

  return <main className="content form-response-content">
    <Link className="back-link" href={`/forms/campaigns/${request.campaign.id}`}><ArrowLeft size={16} />{request.campaign.name}</Link>
    <PageHeader eyebrow={`${request.campaign.templateVersion.template.name} · version ${request.campaign.templateVersion.version}`} title={request.campaign.templateVersion.title} description={`For ${request.subjectPerson.firstName} ${request.subjectPerson.lastName} · recorded from ${request.recipientPerson.firstName} ${request.recipientPerson.lastName}`} icon={FileText} actions={<><PrintButton /><StatusPill value={request.status} /></>} />
    <FlashMessage {...query} />
    <div className="form-response-meta"><span><strong>Recipient</strong>{request.recipientPerson.firstName} {request.recipientPerson.lastName}</span><span><strong>Student</strong>{request.subjectPerson.firstName} {request.subjectPerson.lastName}</span><span><strong>Due</strong>{formatDate(request.campaign.dueAt)}</span><span><strong>Last submitted</strong>{formatDate(request.response?.submittedAt)}</span></div>
    <form action={saveFormResponseAction} className="response-sheet"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="campaignId" value={request.campaign.id} /><header><h2>{request.campaign.templateVersion.title}</h2>{request.campaign.templateVersion.instructions ? <p>{request.campaign.templateVersion.instructions}</p> : null}<span>Staff entry from a returned form or approved collection process</span></header>
      <div className="response-question-list">{request.campaign.templateVersion.questions.map((question) => { const answer = answerMap.get(question.id); const name = `q_${question.id}`; const optionList = choices(question.optionsJson); const selected = choices(answer?.choiceValuesJson ?? null); const uploads = uploadMap.get(question.id) ?? []; return <section className="response-question" key={question.id}><label className="response-prompt" htmlFor={name}><span>{question.position}.</span><strong>{question.prompt}{question.required ? <em>Required</em> : null}</strong></label>{question.helpText ? <p className="response-help">{question.helpText}</p> : null}
        {question.type === FormQuestionType.SHORT_TEXT ? <input id={name} name={name} defaultValue={answer?.textValue ?? ""} /> : null}
        {question.type === FormQuestionType.LONG_TEXT ? <textarea id={name} name={name} rows={5} defaultValue={answer?.textValue ?? ""} /> : null}
        {question.type === FormQuestionType.SINGLE_CHOICE ? <div className="response-options">{optionList.map((option) => <label key={option}><input type="radio" name={name} value={option} defaultChecked={selected.includes(option)} /><span>{option}</span></label>)}</div> : null}
        {question.type === FormQuestionType.MULTIPLE_CHOICE ? <div className="response-options">{optionList.map((option) => <label key={option}><input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} /><span>{option}</span></label>)}</div> : null}
        {question.type === FormQuestionType.CHECKBOX ? <label className="acknowledgment-row"><input id={name} name={name} type="checkbox" defaultChecked={answer?.booleanValue ?? false} /><span>Checked</span></label> : null}
        {question.type === FormQuestionType.ACKNOWLEDGMENT ? <label className="acknowledgment-row"><input id={name} name={name} type="checkbox" defaultChecked={Boolean(answer?.acknowledgmentRecordedAt)} /><span>I acknowledge this statement.</span></label> : null}
        {question.type === FormQuestionType.FILE_UPLOAD ? <div className="upload-response"><input id={`file_${question.id}`} name={`file_${question.id}`} type="file" />{uploads.map((upload) => <a href={`/api/forms/files/${upload.id}`} className="attached-response-file" key={upload.id}><Download size={14} /><span>{upload.fileName}<small>{fileSize(upload.byteSize)}</small></span></a>)}</div> : null}
        <small className="question-type-label">{titleCase(question.type)}</small>
      </section>; })}</div>
      <footer className="response-actions"><button className="button secondary" name="intent" value="draft" type="submit"><Save size={16} />Save draft</button><button className="button primary" name="intent" value="submit" type="submit">Mark complete</button></footer>
    </form>
    <p className="form-legal-boundary">Acknowledgments in BandOS are ordinary recorded responses. This screen does not create or claim a legal electronic signature.</p>
  </main>;
}
