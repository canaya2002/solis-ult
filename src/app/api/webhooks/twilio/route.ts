// SOLIS AI — Twilio SMS/WhatsApp Webhook
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTeamAlert } from "@/lib/comms/resend";

function normalizePhone(phone: string): string {
  return phone
    .replace(/^whatsapp:/, "")
    .replace(/[\s\-()]/g, "")
    .replace(/^\+/, "");
}

function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let dataString = url;
  for (const key of sortedKeys) {
    dataString += key + params[key];
  }

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(dataString, "utf-8"))
    .digest("base64");

  return expected === signature;
}

const INTEREST_KEYWORDS = [
  "sí",
  "si",
  "quiero",
  "cuándo",
  "cuando",
  "horario",
  "cita",
  "appointment",
  "yes",
  "interesado",
  "interesada",
  "disponible",
  "ayuda",
  "help",
  "necesito",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Validate Twilio signature
    const signature = request.headers.get("x-twilio-signature");
    const url = request.url;
    if (
      process.env.TWILIO_AUTH_TOKEN &&
      !verifyTwilioSignature(url, params, signature)
    ) {
      console.error("[webhook/twilio] Invalid signature");
      return new NextResponse("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const from = params["From"] || "";
    const body = params["Body"] || "";
    const messageSid = params["MessageSid"] || "";

    const normalizedPhone = normalizePhone(from);
    const channel = from.startsWith("whatsapp:") ? "WhatsApp" : "SMS";

    console.info(
      `[webhook/twilio] ${channel} from ${normalizedPhone}: "${body.substring(0, 50)}..."`
    );

    // Find lead by phone
    const lead = await db.lead.findFirst({
      where: {
        OR: [
          { phone: { contains: normalizedPhone.slice(-10) } },
          { phone: normalizedPhone },
          { phone: `+${normalizedPhone}` },
          { phone: `+1${normalizedPhone}` },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (lead) {
      // Update lead notes
      const existingNotes = lead.notes || "";
      const newNote = `\n[${new Date().toISOString()}] ${channel}: ${body}`;
      await db.lead.update({
        where: { id: lead.id },
        data: {
          notes: existingNotes + newNote,
        },
      });

      // Check for interest signals
      const bodyLower = body.toLowerCase();
      const showsInterest = INTEREST_KEYWORDS.some((kw) =>
        bodyLower.includes(kw)
      );

      if (
        showsInterest &&
        (lead.status === "NEW" || lead.status === "CONTACTED")
      ) {
        await db.lead.update({
          where: { id: lead.id },
          data: { status: "QUALIFIED" },
        });
        console.info(
          `[webhook/twilio] Lead ${lead.id} qualified based on response`
        );
      }

      // Alert team
      sendTeamAlert({
        subject: `Lead ${lead.name} respondió por ${channel}`,
        body: `<p><strong>${lead.name}</strong> (${lead.source}) respondió:</p><blockquote style="border-left:3px solid #cda64e;padding-left:12px;color:#aaa;">${body}</blockquote><p>Status: ${showsInterest ? "QUALIFIED ✅" : lead.status}</p>`,
        priority: showsInterest ? "high" : "medium",
      }).catch((e) =>
        console.error("[webhook/twilio] Alert failed:", e)
      );
    } else {
      // Create new lead from unknown number
      await db.lead.create({
        data: {
          name: `${channel} — ${normalizedPhone}`,
          phone: from.replace("whatsapp:", ""),
          source: channel === "WhatsApp" ? "WHATSAPP" : "OTHER",
          sourceDetail: `Incoming ${channel}: ${messageSid}`,
          status: "NEW",
          notes: `[${new Date().toISOString()}] ${channel}: ${body}`,
        },
      });
      console.info(
        `[webhook/twilio] New lead from unknown ${channel}: ${normalizedPhone}`
      );
    }
  } catch (e) {
    console.error("[webhook/twilio] Processing error:", e);
  }

  // Always return TwiML (even on error)
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
