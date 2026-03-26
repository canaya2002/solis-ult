// SOLIS AI — Twilio SMS + WhatsApp wrapper
import { ratelimit } from "@/lib/redis";
import type { TwilioMessageResult } from "@/types/comms";

const BASE_URL = "https://api.twilio.com/2010-04-01";

function getConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || null,
  };
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

async function twilioSend(params: {
  to: string;
  from: string;
  body: string;
}): Promise<{ sid: string; status: string }> {
  const config = getConfig();
  if (!config.accountSid || !config.authToken) {
    throw new Error(
      "API_KEY not configured: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN"
    );
  }

  const { success } = await ratelimit.limit("twilio");
  if (!success) throw new Error("Rate limit exceeded for Twilio API");

  const url = `${BASE_URL}/Accounts/${config.accountSid}/Messages.json`;
  const auth = Buffer.from(
    `${config.accountSid}:${config.authToken}`
  ).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: params.to,
      From: params.from,
      Body: params.body,
    }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { message?: string };
    throw new Error(
      `Twilio error ${response.status}: ${err.message || response.statusText}`
    );
  }

  return response.json() as Promise<{ sid: string; status: string }>;
}

export async function sendSMS(
  to: string,
  body: string
): Promise<TwilioMessageResult> {
  const config = getConfig();
  if (!config.phoneNumber) {
    return {
      success: false,
      error: "API_KEY not configured: TWILIO_PHONE_NUMBER",
      channel: "sms",
    };
  }
  try {
    const result = await withRetry(() =>
      twilioSend({ to, from: config.phoneNumber!, body })
    );
    console.info(`[twilio] sendSMS to ${to}: ${result.sid}`);
    return { success: true, messageSid: result.sid, channel: "sms" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[twilio] sendSMS failed:", msg);
    return { success: false, error: msg, channel: "sms" };
  }
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<TwilioMessageResult> {
  const config = getConfig();
  if (!config.whatsappNumber) {
    return {
      success: false,
      error: "API_KEY not configured: TWILIO_WHATSAPP_NUMBER",
      channel: "whatsapp",
    };
  }
  try {
    const waTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const result = await withRetry(() =>
      twilioSend({ to: waTo, from: config.whatsappNumber!, body })
    );
    console.info(`[twilio] sendWhatsApp to ${to}: ${result.sid}`);
    return { success: true, messageSid: result.sid, channel: "whatsapp" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[twilio] sendWhatsApp failed:", msg);
    return { success: false, error: msg, channel: "whatsapp" };
  }
}

export async function sendLeadFollowUp(lead: {
  name: string;
  phone: string;
  caseType?: string;
}): Promise<TwilioMessageResult> {
  const caseLabel = lead.caseType || "inmigración";
  const message = `Hola ${lead.name}, gracias por contactar a Manuel Solís Law Office. Un especialista en ${caseLabel} te contactará en los próximos minutos. Si es urgente, llama al (214) 414-4414. Visita manuelsolis.com`;

  // Try WhatsApp first, fallback to SMS
  const waResult = await sendWhatsApp(lead.phone, message);
  if (waResult.success) return waResult;

  console.info(
    "[twilio] sendLeadFollowUp: WhatsApp failed, falling back to SMS"
  );
  return sendSMS(lead.phone, message);
}

export async function sendReviewRequest(params: {
  name: string;
  phone: string;
  officeName: string;
  googleReviewLink: string;
}): Promise<TwilioMessageResult> {
  const message = `Hola ${params.name}, del equipo de Manuel Solís Law Office (${params.officeName}). Nos alegra haber podido ayudarte. Si tuviste una buena experiencia, nos ayudaría mucho una reseña en Google: ${params.googleReviewLink} Tu opinión ayuda a otras familias. ¡Gracias!`;

  // Try WhatsApp first, fallback to SMS
  const waResult = await sendWhatsApp(params.phone, message);
  if (waResult.success) return waResult;

  return sendSMS(params.phone, message);
}

export async function getMessageStatus(
  messageSid: string
): Promise<string> {
  const config = getConfig();
  if (!config.accountSid || !config.authToken) {
    return "error: TWILIO_ACCOUNT_SID not configured";
  }
  try {
    const url = `${BASE_URL}/Accounts/${config.accountSid}/Messages/${messageSid}.json`;
    const auth = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString("base64");

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) return "error: failed to fetch status";
    const data = (await response.json()) as { status: string };
    return data.status;
  } catch (error) {
    console.error("[twilio] getMessageStatus failed:", error);
    return "error";
  }
}
