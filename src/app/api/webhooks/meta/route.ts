// SOLIS AI — Meta Lead Ads Webhook
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sendLeadFollowUp } from "@/lib/comms/twilio";
import { sendLeadAlert } from "@/lib/comms/resend";

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

async function fetchLeadData(
  leadgenId: string
): Promise<{
  name: string;
  email: string;
  phone: string;
  caseType: string;
  city: string;
  formName: string;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
} | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${token}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      field_data?: Array<{ name: string; values: string[] }>;
      form_id?: string;
    };

    const fields = data.field_data || [];
    const get = (key: string) =>
      fields.find(
        (f) =>
          f.name.toLowerCase().includes(key)
      )?.values[0] || "";

    let formName = "";
    if (data.form_id) {
      try {
        const formRes = await fetch(
          `https://graph.facebook.com/v21.0/${data.form_id}?fields=name&access_token=${token}`
        );
        if (formRes.ok) {
          const formData = (await formRes.json()) as { name?: string };
          formName = formData.name || "";
        }
      } catch { /* ignore */ }
    }

    // Attribution: fetch campaign/ad IDs from the lead
    let campaignId: string | undefined;
    let adSetId: string | undefined;
    let adId: string | undefined;
    try {
      const attrRes = await fetch(
        `https://graph.facebook.com/v21.0/${leadgenId}?fields=campaign_id,adset_id,ad_id&access_token=${token}`
      );
      if (attrRes.ok) {
        const attrData = (await attrRes.json()) as {
          campaign_id?: string;
          adset_id?: string;
          ad_id?: string;
        };
        campaignId = attrData.campaign_id;
        adSetId = attrData.adset_id;
        adId = attrData.ad_id;
      }
    } catch { /* attribution is best-effort */ }

    return {
      name:
        get("full_name") ||
        `${get("first_name")} ${get("last_name")}`.trim() ||
        "Sin nombre",
      email: get("email"),
      phone: get("phone"),
      caseType: get("case") || get("tipo") || get("servicio") || "",
      city: get("city") || get("ciudad") || "",
      formName,
      campaignId,
      adSetId,
      adId,
    };
  } catch (e) {
    console.error("[webhook/meta] fetchLeadData failed:", e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    console.info("[webhook/meta] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (process.env.META_APP_SECRET && !verifySignature(rawBody, signature)) {
    console.error("[webhook/meta] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            leadgen_id?: string;
            form_id?: string;
            page_id?: string;
            created_time?: number;
          };
        }>;
      }>;
    };

    const entries = payload.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        const leadData = await fetchLeadData(leadgenId);
        if (!leadData) continue;

        // Deduplication
        const dedupeKey = leadData.email
          ? `lead:${leadData.email}`
          : leadData.phone
            ? `lead:${leadData.phone}`
            : null;

        if (dedupeKey) {
          const exists = await redis.get(dedupeKey);
          if (exists) {
            console.info(
              `[webhook/meta] Duplicate lead skipped: ${dedupeKey}`
            );
            continue;
          }
          await redis.set(dedupeKey, "1", { ex: 86400 });
        }

        // Save to DB (with attribution data for ROI tracking)
        const lead = await db.lead.create({
          data: {
            name: leadData.name,
            email: leadData.email || null,
            phone: leadData.phone || null,
            source: "META_AD",
            sourceDetail: leadData.formName || `leadgen:${leadgenId}`,
            status: "NEW",
            caseType: leadData.caseType || null,
            city: leadData.city || null,
            metaCampaignId: leadData.campaignId || null,
            metaAdSetId: leadData.adSetId || null,
            metaAdId: leadData.adId || null,
          },
        });

        console.info(
          `[webhook/meta] Lead created: ${lead.id} — ${leadData.name}`
        );

        // Follow-up (async, don't block response)
        if (leadData.phone) {
          sendLeadFollowUp({
            name: leadData.name,
            phone: leadData.phone,
            caseType: leadData.caseType || undefined,
          })
            .then(() =>
              db.lead.update({
                where: { id: lead.id },
                data: { status: "CONTACTED" },
              })
            )
            .catch((e) =>
              console.error("[webhook/meta] Follow-up failed:", e)
            );
        }

        // Team alert (async)
        sendLeadAlert({
          name: leadData.name,
          source: "Meta Ads",
          caseType: leadData.caseType || undefined,
          city: leadData.city || undefined,
        }).catch((e) =>
          console.error("[webhook/meta] Alert failed:", e)
        );
      }
    }
  } catch (e) {
    console.error("[webhook/meta] Processing error:", e);
  }

  // Always return 200 (Meta requires fast response)
  return NextResponse.json({ received: true }, { status: 200 });
}
