// SOLIS AI — Meta Comments Webhook (Facebook + Instagram)
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processComment } from "@/lib/engagement/comment-processor";

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
        changes?: Array<{
          field?: string;
          value?: {
            item?: string;
            comment_id?: string;
            parent_id?: string;
            post_id?: string;
            from?: { id: string; name: string };
            message?: string;
            created_time?: number;
          };
        }>;
      }>;
    };

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "feed" && change.field !== "comments") continue;
        const val = change.value;
        if (!val || val.item !== "comment" || !val.comment_id || !val.message) continue;
        // Skip replies to our own comments
        if (val.parent_id && val.from?.id === process.env.META_PAGE_ID) continue;

        const platform = payload.object === "instagram" ? "INSTAGRAM" : "FACEBOOK";

        processComment({
          platform,
          commentId: val.comment_id,
          postId: val.post_id || "",
          text: val.message,
          authorName: val.from?.name || "Usuario",
          authorId: val.from?.id || "",
          createdAt: val.created_time ? new Date(val.created_time * 1000) : new Date(),
        }).catch((e) => console.error("[webhook/meta-comments] Process failed:", e));
      }
    }
  } catch (e) {
    console.error("[webhook/meta-comments] Parse error:", e);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
