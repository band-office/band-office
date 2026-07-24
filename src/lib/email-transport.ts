import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import type { EmailConnection } from "@/generated/prisma/client";

export type EmailDeliveryInput = {
  connection: EmailConnection;
  to: string;
  subject: string;
  body: string;
  attachments: Array<{ filename: string; contentType: string; content: Uint8Array }>;
};

export type EmailDeliveryResult = {
  messageId: string;
};

function smtpPassword() {
  return process.env.BANDOS_SMTP_PASSWORD?.trim() || null;
}

function smtpTransport(connection: EmailConnection) {
  if (!connection.smtpHost || !connection.smtpPort) throw new Error("Complete the SMTP host and port before verifying or sending.");
  const password = smtpPassword();
  if (connection.authUsername && !password) throw new Error("The SMTP credential is not available. Store it in the desktop app or set BANDOS_SMTP_PASSWORD before startup.");
  return nodemailer.createTransport({
    host: connection.smtpHost,
    port: connection.smtpPort,
    secure: connection.smtpSecure,
    requireTLS: !connection.smtpSecure,
    auth: connection.authUsername ? { user: connection.authUsername, pass: password! } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export function hasSmtpCredential(connection: Pick<EmailConnection, "authUsername">) {
  return !connection.authUsername || Boolean(smtpPassword());
}

export async function verifyEmailConnection(connection: EmailConnection) {
  if (process.env.BANDOS_EMAIL_TRANSPORT === "mock") return;
  const transport = smtpTransport(connection);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

export async function deliverEmail(input: EmailDeliveryInput): Promise<EmailDeliveryResult> {
  if (process.env.BANDOS_EMAIL_TRANSPORT === "mock") {
    return { messageId: `mock-${randomUUID()}` };
  }
  const transport = smtpTransport(input.connection);
  try {
    const result = await transport.sendMail({
      from: { name: input.connection.fromName, address: input.connection.fromAddress },
      replyTo: input.connection.replyTo || input.connection.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.body,
      attachments: input.attachments.map((attachment) => ({ ...attachment, content: Buffer.from(attachment.content) })),
    });
    return { messageId: result.messageId || "accepted-without-message-id" };
  } finally {
    transport.close();
  }
}

export function transportError(error: unknown) {
  const candidate = error as { code?: unknown; responseCode?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code.slice(0, 80) : null;
  const responseCode = typeof candidate?.responseCode === "number" ? String(candidate.responseCode) : null;
  const message = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 500) : "The email provider returned an unknown error.";
  return { code: [code, responseCode].filter(Boolean).join(":") || null, message };
}
