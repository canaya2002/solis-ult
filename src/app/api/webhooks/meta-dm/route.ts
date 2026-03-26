// SOLIS AI — Meta DM Webhook (Facebook Messenger + Instagram DMs)
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handleDMMessage } from "@/lib/engagement/dm-qualifier";
import { sendMessage } from "@/lib/social/meta";

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (process.env.META_APP_SECRET && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      object?: string;
      entry?: Array<{
        messaging?: Array<{
          sender?: { id: string };
          recipient?: { id: string };
          message?: { mid: string; text: string };
          timestamp?: number;
        }>;
      }>;
    };

    const isInstagram = payload.object === "instagram";

    for (const entry of payload.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event.message?.text || !event.sender?.id) continue;
        // Skip messages from our own page
        if (event.sender.id === process.env.META_PAGE_ID) continue;

        const platform = isInstagram ? "instagram" : "facebook";

        // Get sender name (simplified — in production you'd fetch from Graph API)
        const senderName = "Usuario";

        const response = await handleDMMessage({
          platform,
          senderId: event.sender.id,
          senderName,
          message: event.message.text,
        });

        // Send response
        if (response.message) {
          sendMessage(undefined, event.sender.id, response.message).catch(
            (e) => console.error("[webhook/meta-dm] Send failed:", e)
          );
        }
      }
    }
  } catch (e) {
    console.error("[webhook/meta-dm] Parse error:", e);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
