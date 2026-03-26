// SOLIS AI — Resend email wrapper
import { Resend } from "resend";
import type { EmailResult } from "@/types/comms";

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "dashboard@manuelsolis.com";
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Max retries reached");
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    return { success: false, error: "API_KEY not configured: RESEND_API_KEY" };
  }

  try {
    const result = await withRetry(() =>
      client.emails.send({
        from: getFromEmail(),
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
      })
    );

    if (result.error) {
      console.error("[resend] sendEmail failed:", result.error);
      return { success: false, error: result.error.message };
    }

    console.info(`[resend] sendEmail: ${result.data?.id}`);
    return { success: true, id: result.data?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[resend] sendEmail failed:", msg);
    return { success: false, error: msg };
  }
}

export async function sendTeamAlert(params: {
  subject: string;
  body: string;
  priority?: "low" | "medium" | "high";
}): Promise<void> {
  const teamEmails = ["marketing@manuelsolis.com"];

  const priorityBadge =
    params.priority === "high"
      ? "🔴 URGENTE"
      : params.priority === "medium"
        ? "🟡 IMPORTANTE"
        : "🟢 INFO";

  await sendEmail({
    to: teamEmails,
    subject: `[${priorityBadge}] ${params.subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #12141d; padding: 20px; border-radius: 8px;">
          <h2 style="color: #cda64e; margin: 0 0 16px 0;">SOLIS AI — Alerta</h2>
          <div style="color: #e0e0e0; line-height: 1.6;">
            ${params.body}
          </div>
          <hr style="border: 1px solid #2a2d3a; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px;">
            Este es un mensaje automático de SOLIS AI Dashboard.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendWeeklyReport(params: {
  to: string[];
  reportHtml: string;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `SOLIS AI — Reporte Semanal ${params.periodStart} a ${params.periodEnd}`,
    html: `
      <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #12141d; padding: 24px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #cda64e; margin: 0;">SOLIS AI</h1>
            <p style="color: #888; margin: 4px 0 0 0;">
              Reporte Semanal: ${params.periodStart} — ${params.periodEnd}
            </p>
          </div>
          <div style="color: #e0e0e0; line-height: 1.7;">
            ${params.reportHtml}
          </div>
          <hr style="border: 1px solid #2a2d3a; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px; text-align: center;">
            Generado por SOLIS AI — Manuel Solís Law Office
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendLeadAlert(lead: {
  name: string;
  source: string;
  caseType?: string;
  city?: string;
}): Promise<void> {
  const details = [
    `<strong>Nombre:</strong> ${lead.name}`,
    `<strong>Fuente:</strong> ${lead.source}`,
    lead.caseType ? `<strong>Tipo de caso:</strong> ${lead.caseType}` : "",
    lead.city ? `<strong>Ciudad:</strong> ${lead.city}` : "",
  ]
    .filter(Boolean)
    .join("<br />");

  await sendTeamAlert({
    subject: `Nuevo Lead: ${lead.name} — ${lead.source}`,
    body: `
      <h3 style="color: #cda64e;">Nuevo Lead Recibido</h3>
      <p>${details}</p>
      <p style="margin-top: 16px;">
        <a href="${process.env.APP_URL || "http://localhost:3000"}" style="color: #cda64e;">
          Ver en el dashboard →
        </a>
      </p>
    `,
    priority: "high",
  });
}
