// SOLIS AI — API Connection Verification
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/utils";

const schema = z.object({ api: z.string().min(1) });

async function testApi(api: string): Promise<{ connected: boolean; error?: string; latency: number }> {
  const start = Date.now();
  try {
    switch (api) {
      case "meta": {
        if (!process.env.META_ACCESS_TOKEN) return { connected: false, error: "META_ACCESS_TOKEN no configurado", latency: 0 };
        const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${process.env.META_ACCESS_TOKEN}`);
        return { connected: res.ok, error: res.ok ? undefined : "Token inválido", latency: Date.now() - start };
      }
      case "ga4": {
        if (!process.env.GA4_PROPERTY_ID || !process.env.GOOGLE_CLIENT_ID) return { connected: false, error: "GA4_PROPERTY_ID o GOOGLE_CLIENT_ID no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      case "gsc": {
        if (!process.env.GOOGLE_SEARCH_CONSOLE_SITE) return { connected: false, error: "GOOGLE_SEARCH_CONSOLE_SITE no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      case "semrush": {
        if (!process.env.SEMRUSH_API_KEY) return { connected: false, error: "SEMRUSH_API_KEY no configurado", latency: 0 };
        const res = await fetch(`https://api.semrush.com/?type=domain_ranks&key=${process.env.SEMRUSH_API_KEY}&domain=google.com&database=us&export_columns=Rk`);
        return { connected: res.ok, error: res.ok ? undefined : "API key inválida", latency: Date.now() - start };
      }
      case "tiktok": {
        if (!process.env.TIKTOK_ACCESS_TOKEN) return { connected: false, error: "TIKTOK_ACCESS_TOKEN no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      case "youtube": {
        if (!process.env.YOUTUBE_CHANNEL_ID || !process.env.GOOGLE_CLIENT_ID) return { connected: false, error: "YOUTUBE_CHANNEL_ID no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      case "twilio": {
        if (!process.env.TWILIO_ACCOUNT_SID) return { connected: false, error: "TWILIO_ACCOUNT_SID no configurado", latency: 0 };
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, { headers: { Authorization: `Basic ${auth}` } });
        return { connected: res.ok, error: res.ok ? undefined : "Credenciales inválidas", latency: Date.now() - start };
      }
      case "claude": {
        if (!process.env.ANTHROPIC_API_KEY) return { connected: false, error: "ANTHROPIC_API_KEY no configurado", latency: 0 };
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "Hi" }] });
        return { connected: true, latency: Date.now() - start };
      }
      case "openai": {
        if (!process.env.OPENAI_API_KEY) return { connected: false, error: "OPENAI_API_KEY no configurado", latency: 0 };
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        await client.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hi" }], max_tokens: 5 });
        return { connected: true, latency: Date.now() - start };
      }
      case "resend": {
        if (!process.env.RESEND_API_KEY) return { connected: false, error: "RESEND_API_KEY no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      case "gbp": {
        if (!process.env.GOOGLE_BUSINESS_ACCOUNT_ID) return { connected: false, error: "GOOGLE_BUSINESS_ACCOUNT_ID no configurado", latency: 0 };
        return { connected: true, latency: Date.now() - start };
      }
      default:
        return { connected: false, error: `API desconocida: ${api}`, latency: 0 };
    }
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "Error desconocido", latency: Date.now() - start };
  }
}

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
