// SOLIS AI — API Connection Verification (Real API calls)
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";

const schema = z.object({ api: z.string().min(1) });

const OAUTH_URL = "https://oauth2.googleapis.com/token";

async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN no configurado");
  }

  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const desc = (err as Record<string, string>).error_description || (err as Record<string, string>).error || "Token refresh failed";
    throw new Error(`Google OAuth: ${desc}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function testApi(api: string): Promise<{ connected: boolean; error?: string; latency: number }> {
  const start = Date.now();
  try {
    switch (api) {
      // ─── Meta Graph API ───
      case "meta": {
        if (!process.env.META_ACCESS_TOKEN) return { connected: false, error: "META_ACCESS_TOKEN no configurado", latency: 0 };
        const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${process.env.META_ACCESS_TOKEN}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `Meta: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Google Analytics 4 (real API call) ───
      case "ga4": {
        if (!process.env.GA4_PROPERTY_ID) return { connected: false, error: "GA4_PROPERTY_ID no configurado", latency: 0 };
        const token = await getGoogleAccessToken();
        const propertyId = process.env.GA4_PROPERTY_ID;
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: today, endDate: today }],
            metrics: [{ name: "sessions" }],
            limit: 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `GA4: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Google Search Console (real API call) ───
      case "gsc": {
        if (!process.env.GOOGLE_SEARCH_CONSOLE_SITE) return { connected: false, error: "GOOGLE_SEARCH_CONSOLE_SITE no configurado", latency: 0 };
        const token = await getGoogleAccessToken();
        const site = encodeURIComponent(process.env.GOOGLE_SEARCH_CONSOLE_SITE);
        const today = new Date();
        const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString().split("T")[0];
        const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: threeDaysAgo,
            endDate: threeDaysAgo,
            dimensions: ["query"],
            rowLimit: 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `GSC: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Semrush ───
      case "semrush": {
        if (!process.env.SEMRUSH_API_KEY) return { connected: false, error: "SEMRUSH_API_KEY no configurado", latency: 0 };
        const res = await fetch(`https://api.semrush.com/?type=domain_ranks&key=${process.env.SEMRUSH_API_KEY}&domain=manuelsolis.com&database=us&export_columns=Rk`);
        if (!res.ok) {
          return { connected: false, error: `Semrush: HTTP ${res.status} — API key inválida o sin créditos`, latency: Date.now() - start };
        }
        const text = await res.text();
        if (text.includes("ERROR")) {
          return { connected: false, error: `Semrush: ${text.trim().substring(0, 120)}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── TikTok (real API call) ───
      case "tiktok": {
        if (!process.env.TIKTOK_ACCESS_TOKEN) return { connected: false, error: "TIKTOK_ACCESS_TOKEN no configurado", latency: 0 };
        const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count", {
          headers: { Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `TikTok: ${msg}`, latency: Date.now() - start };
        }
        const data = await res.json() as { data?: { user?: unknown }; error?: { code?: string; message?: string } };
        if (data.error?.code && data.error.code !== "ok") {
          return { connected: false, error: `TikTok: ${data.error.message || data.error.code}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── YouTube (real API call) ───
      case "youtube": {
        if (!process.env.YOUTUBE_CHANNEL_ID) return { connected: false, error: "YOUTUBE_CHANNEL_ID no configurado", latency: 0 };
        const token = await getGoogleAccessToken();
        const channelId = process.env.YOUTUBE_CHANNEL_ID;
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `YouTube: ${msg}`, latency: Date.now() - start };
        }
        const data = await res.json() as { items?: unknown[] };
        if (!data.items?.length) {
          return { connected: false, error: "YouTube: Canal no encontrado o sin permisos", latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Twilio ───
      case "twilio": {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
          return { connected: false, error: "TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no configurado", latency: 0 };
        }
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { message?: string })?.message || `HTTP ${res.status}`;
          return { connected: false, error: `Twilio: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Claude AI ───
      case "claude": {
        if (!process.env.ANTHROPIC_API_KEY) return { connected: false, error: "ANTHROPIC_API_KEY no configurado", latency: 0 };
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 5,
          messages: [{ role: "user", content: "test" }],
        });
        return { connected: true, latency: Date.now() - start };
      }

      // ─── OpenAI ───
      case "openai": {
        if (!process.env.OPENAI_API_KEY) return { connected: false, error: "OPENAI_API_KEY no configurado", latency: 0 };
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        });
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Resend (real API call) ───
      case "resend": {
        if (!process.env.RESEND_API_KEY) return { connected: false, error: "RESEND_API_KEY no configurado", latency: 0 };
        const res = await fetch("https://api.resend.com/api-keys", {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { message?: string })?.message || `HTTP ${res.status}`;
          return { connected: false, error: `Resend: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      // ─── Google Business Profile (real API call) ───
      case "gbp": {
        if (!process.env.GOOGLE_BUSINESS_ACCOUNT_ID) return { connected: false, error: "GOOGLE_BUSINESS_ACCOUNT_ID no configurado", latency: 0 };
        const token = await getGoogleAccessToken();
        const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, error: `Google Business: ${msg}`, latency: Date.now() - start };
        }
        return { connected: true, latency: Date.now() - start };
      }

      default:
        return { connected: false, error: `API desconocida: ${api}`, latency: 0 };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { connected: false, error: msg, latency: Date.now() - start };
  }
}

// POST — verify single API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const result = await testApi(parsed.data.api);
    return apiSuccess({ api: parsed.data.api, ...result });
  } catch (error) {
    console.error("[api/settings/verify-api] POST failed:", error);
    return apiError("Error al verificar API", 500);
  }
}
