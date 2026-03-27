// SOLIS AI — AI Audience Builder
// Analyzes converted client profiles and creates Custom/Lookalike audiences in Meta.
import { db } from "@/lib/db";
import { metaAdsRatelimit } from "@/lib/redis";
import { analyzeContent } from "@/lib/ai/claude";
import { sendNotification } from "@/lib/notifications/notification-engine";

const BASE_URL = "https://graph.facebook.com/v21.0";

function getToken(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN not configured");
  return t;
}
function getAdAccountId(): string {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("META_AD_ACCOUNT_ID not configured");
  return id;
}

async function adsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const { success } = await metaAdsRatelimit.limit("meta-ads-audience");
  if (!success) throw new Error("Rate limit exceeded");
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${sep}access_token=${token}`;
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API ${res.status}: ${(err as { error?: { message?: string } }).error?.message || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ClientProfile {
  topCities: Array<{ city: string; count: number }>;
  topCaseTypes: Array<{ caseType: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
  avgContractValue: number;
  totalClients: number;
  patterns: string;
}

export interface AudienceStrategy {
  customAudiences: Array<{ name: string; source: "email" | "phone"; size: number; rationale: string }>;
  lookalikes: Array<{ name: string; sourceAudience: string; ratio: number; rationale: string }>;
  exclusions: Array<{ name: string; rationale: string }>;
  recommendation: string;
}

// ─── Client Analysis ───────────────────────────────────────────────────────────

export async function analyzeClientProfile(): Promise<ClientProfile> {
  const leads = await db.lead.findMany({
    where: { status: "CONVERTED" },
    select: { city: true, caseType: true, source: true, contractValue: true },
  });

  const cityMap = new Map<string, number>();
  const caseMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  let totalValue = 0;
  let valueCount = 0;

  for (const l of leads) {
    if (l.city) cityMap.set(l.city, (cityMap.get(l.city) || 0) + 1);
    if (l.caseType) caseMap.set(l.caseType, (caseMap.get(l.caseType) || 0) + 1);
    sourceMap.set(l.source, (sourceMap.get(l.source) || 0) + 1);
    if (l.contractValue) { totalValue += Number(l.contractValue); valueCount++; }
  }

  const topCities = [...cityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([city, count]) => ({ city, count }));
  const topCaseTypes = [...caseMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([caseType, count]) => ({ caseType, count }));
  const topSources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, count]) => ({ source, count }));

  return {
    topCities,
    topCaseTypes,
    topSources,
    avgContractValue: valueCount > 0 ? Math.round(totalValue / valueCount) : 0,
    totalClients: leads.length,
    patterns: `${leads.length} clientes convertidos. Top ciudad: ${topCities[0]?.city || "N/A"}. Top caso: ${topCaseTypes[0]?.caseType || "N/A"}.`,
  };
}

// ─── Custom Audience ───────────────────────────────────────────────────────────

export async function createCustomAudience(params: {
  name: string;
  source: "email" | "phone";
  description: string;
}): Promise<{ audienceId: string; size: number }> {
  const accountId = getAdAccountId();

  // Fetch contacts
  const field = params.source === "email" ? "email" : "phone";
  const leads = await db.lead.findMany({
    where: { status: "CONVERTED", [field]: { not: null } },
    select: { [field]: true },
  });

  const contacts = leads.map(l => (l as Record<string, string | null>)[field]).filter(Boolean) as string[];
  if (!contacts.length) throw new Error(`No hay ${params.source === "email" ? "emails" : "tel\u00e9fonos"} de clientes convertidos`);

  // Create custom audience
  const audience = await adsFetch<{ id: string }>(`/${accountId}/customaudiences`, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      subtype: "CUSTOM",
      description: params.description,
      customer_file_source: "USER_PROVIDED_ONLY",
    }),
  });

  // Upload contacts (hashed)
  const crypto = await import("crypto");
  const hashedContacts = contacts.map(c => {
    const normalized = c.toLowerCase().trim();
    return crypto.createHash("sha256").update(normalized).digest("hex");
  });

  const schema = params.source === "email" ? ["EMAIL"] : ["PHONE"];
  await adsFetch(`/${audience.id}/users`, {
    method: "POST",
    body: JSON.stringify({
      payload: { schema, data: hashedContacts.map(h => [h]) },
    }),
  });

  console.info(`[audience-builder] Created custom audience ${audience.id}: ${params.name} (${contacts.length} contacts)`);
  return { audienceId: audience.id, size: contacts.length };
}

// ─── Lookalike Audience ────────────────────────────────────────────────────────

export async function createLookalikeAudience(params: {
  sourceAudienceId: string;
  country: string;
  ratio: number;
  name: string;
}): Promise<{ audienceId: string }> {
  const accountId = getAdAccountId();

  const audience = await adsFetch<{ id: string }>(`/${accountId}/customaudiences`, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      subtype: "LOOKALIKE",
      origin_audience_id: params.sourceAudienceId,
      lookalike_spec: JSON.stringify({
        type: "similarity",
        country: params.country,
        ratio: params.ratio,
      }),
    }),
  });

  console.info(`[audience-builder] Created lookalike ${audience.id}: ${params.name} (${params.ratio * 100}%)`);
  return { audienceId: audience.id };
}

// ─── AI Strategy Generation ────────────────────────────────────────────────────

export async function generateAudienceStrategy(): Promise<AudienceStrategy> {
  const profile = await analyzeClientProfile();

  const emailCount = await db.lead.count({ where: { status: "CONVERTED", email: { not: null } } });
  const phoneCount = await db.lead.count({ where: { status: "CONVERTED", phone: { not: null } } });
  const lostCount = await db.lead.count({ where: { status: "LOST" } });

  const prompt = `DATOS DE CLIENTES:
${JSON.stringify(profile, null, 2)}

Clientes con email: ${emailCount}
Clientes con tel\u00e9fono: ${phoneCount}
Leads perdidos: ${lostCount}

Genera una estrategia de audiencias para Meta Ads. Responde SOLO JSON v\u00e1lido:
{
  "customAudiences": [{"name":"","source":"email"|"phone","size":0,"rationale":""}],
  "lookalikes": [{"name":"","sourceAudience":"referencia a custom","ratio":0.01|0.03|0.05,"rationale":""}],
  "exclusions": [{"name":"","rationale":""}],
  "recommendation": "resumen de la estrategia"
}`;

  const systemPrompt = `Eres un experto en Meta Ads para bufetes de inmigraci\u00f3n.
Genera estrategias de audiencia basadas en datos de clientes reales.
Lookalike 1% = m\u00e1s similar al cliente ideal pero m\u00e1s peque\u00f1a.
Lookalike 3-5% = m\u00e1s amplia pero menos precisa.
Siempre excluir clientes actuales para no desperdiciar presupuesto.`;

  const raw = await analyzeContent(prompt, systemPrompt);

  if (raw.includes('"error"') && !raw.includes('"recommendation"')) {
    const errMatch = raw.match(/"error"\s*:\s*"([^"]+)"/);
    throw new Error(errMatch ? errMatch[1] : "Claude API no disponible");
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI no gener\u00f3 estrategia v\u00e1lida");

  const strategy = JSON.parse(match[0]) as AudienceStrategy;

  // Create notification
  const audienceCount = strategy.customAudiences.length + strategy.lookalikes.length;
  await sendNotification({
    type: "strategy_recommendation",
    title: `Plan de audiencias listo: ${audienceCount} audiencias sugeridas`,
    message: strategy.recommendation,
    actionUrl: "/ads/audiences",
    actionLabel: "Revisar y aprobar plan",
    priority: "medium",
    data: { strategy },
    remindAfterMinutes: [240, 1440],
  });

  return strategy;
}
