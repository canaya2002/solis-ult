// SOLIS AI — AI-Powered Campaign Planner
// Uses Claude to analyze goals, historical performance, and generate complete campaign plans.
import { analyzeContent } from "@/lib/ai/claude";
import { db } from "@/lib/db";
import { isImmigrationCampaign, type CampaignObjective } from "./campaign-creator";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlanCampaignParams {
  goal: string;
  budget: number; // daily budget in dollars
  cities: string[];
  caseType?: string;
  mediaUrls?: string[];
}

export interface CampaignPlanAdSet {
  name: string;
  targeting: {
    geoLocations: { cities?: Array<{ key: string; name: string }>; regions?: Array<{ key: string }> };
    locales?: number[];
    interests?: Array<{ id: string; name: string }>;
    ageMin?: number;
    ageMax?: number;
  };
  dailyBudget: number;
  rationale: string;
}

export interface CampaignPlanAd {
  name: string;
  copy: string;
  cta: string;
  rationale: string;
}

export interface CampaignPlan {
  id: string;
  recommendation: string;
  campaign: {
    name: string;
    objective: CampaignObjective;
    dailyBudget: number;
    estimatedDailyLeads: number;
    estimatedCPL: number;
    specialAdCategories: string[];
  };
  adSets: CampaignPlanAdSet[];
  ads: CampaignPlanAd[];
  estimatedResults: {
    dailyLeads: number;
    weeklyCost: number;
    estimatedCPL: number;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
  status: "pending_approval";
  createdAt: Date;
  expiresAt: Date;
}

// ─── City Key Mapping for Meta Targeting ───────────────────────────────────────

const CITY_KEYS: Record<string, { key: string; name: string }> = {
  dallas: { key: "2418956", name: "Dallas" },
  chicago: { key: "2379574", name: "Chicago" },
  "los angeles": { key: "2420379", name: "Los Angeles" },
  la: { key: "2420379", name: "Los Angeles" },
  memphis: { key: "2425539", name: "Memphis" },
  houston: { key: "2411588", name: "Houston" },
  "san antonio": { key: "2508411", name: "San Antonio" },
  austin: { key: "2357536", name: "Austin" },
};

const REGION_KEYS: Record<string, { key: string }> = {
  texas: { key: "3886" },
  "todo texas": { key: "3886" },
  illinois: { key: "3856" },
  california: { key: "3847" },
  tennessee: { key: "3883" },
};

// ─── Historical Data Gathering ─────────────────────────────────────────────────

async function getHistoricalPerformance(): Promise<string> {
  try {
    // Get recent campaign logs for performance context
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { logs: { orderBy: { createdAt: "desc" }, take: 3 } },
    });

    if (!campaigns.length) return "No hay datos históricos de campañas previas.";

    const summary = campaigns.map(c => {
      const cpl = c.cpl ? `$${Number(c.cpl).toFixed(2)}` : "N/A";
      return `- ${c.name}: ${c.status}, budget $${Number(c.budget)}/día, ${c.leadsGenerated} leads, CPL ${cpl}`;
    }).join("\n");

    return `Campañas recientes:\n${summary}`;
  } catch {
    return "No se pudieron cargar datos históricos.";
  }
}

async function getRecentLeadData(caseType?: string): Promise<string> {
  try {
    const where: Record<string, unknown> = {};
    if (caseType) where.caseType = caseType;

    const leads = await db.lead.groupBy({
      by: ["source", "city"],
      _count: { id: true },
      where: {
        ...where,
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    });

    if (!leads.length) return "No hay datos de leads de los últimos 30 días.";

    return `Leads últimos 30 días:\n${leads.map(l =>
      `- ${l.source} / ${l.city || "Sin ciudad"}: ${l._count.id} leads`
    ).join("\n")}`;
  } catch {
    return "No se pudieron cargar datos de leads.";
  }
}

// ─── AI Planning ───────────────────────────────────────────────────────────────

export async function planCampaign(params: PlanCampaignParams): Promise<CampaignPlan> {
  const { goal, budget, cities, caseType, mediaUrls } = params;

  // Gather context in parallel
  const [historicalData, leadData] = await Promise.all([
    getHistoricalPerformance(),
    getRecentLeadData(caseType),
  ]);

  // Determine if this is immigration-related (almost always yes for this firm)
  const isImmigration = isImmigrationCampaign(goal, caseType || "");

  // Resolve city keys
  const resolvedCities = cities.flatMap(city => {
    const lower = city.toLowerCase();
    if (lower === "nacional") return []; // National = no city restriction
    if (REGION_KEYS[lower]) return []; // Handle as region
    return CITY_KEYS[lower] ? [CITY_KEYS[lower]] : [];
  });
  const resolvedRegions = cities.flatMap(city => {
    const lower = city.toLowerCase();
    return REGION_KEYS[lower] ? [REGION_KEYS[lower]] : [];
  });
  const isNational = cities.some(c => c.toLowerCase() === "nacional");

  const systemPrompt = `Eres un experto en Meta Ads para bufetes de abogados de inmigración en Estados Unidos.
Tu trabajo es generar planes de campañas optimizados basados en datos históricos y el objetivo del cliente.

REGLAS IMPORTANTES:
1. Los ads de inmigración REQUIEREN specialAdCategories: ['HOUSING'] en Meta, lo cual PROHÍBE segmentar por edad, género, o código postal.
2. El targeting se limita a: ubicación (ciudades/estados), idioma, intereses.
3. Todo se crea PAUSADO. El equipo humano revisa y activa.
4. El presupuesto es en dólares por día.
5. Los copies deben ser en español, profesionales, empáticos, y cumplir con las políticas de Meta (no prometer resultados, no crear urgencia falsa).
6. Cada decisión debe incluir una razón clara basada en datos.

Responde SOLO con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "recommendation": "string explicando por qué recomiendas esta estrategia",
  "campaign": {
    "name": "string",
    "objective": "OUTCOME_LEADS" | "OUTCOME_TRAFFIC",
    "dailyBudget": number,
    "estimatedDailyLeads": number,
    "estimatedCPL": number
  },
  "adSets": [{
    "name": "string",
    "targeting": {
      "locales": [24],
      "interests": [{"id": "string", "name": "string"}]
    },
    "dailyBudget": number,
    "rationale": "string"
  }],
  "ads": [{
    "name": "string",
    "copy": "string (el texto del ad)",
    "cta": "LEARN_MORE" | "CONTACT_US" | "GET_QUOTE" | "BOOK_NOW",
    "rationale": "string"
  }],
  "estimatedResults": {
    "dailyLeads": number,
    "weeklyCost": number,
    "estimatedCPL": number,
    "confidence": "high" | "medium" | "low",
    "reasoning": "string"
  }
}`;

  const prompt = `OBJETIVO: ${goal}
PRESUPUESTO DIARIO: $${budget}
CIUDADES: ${cities.join(", ")}
${caseType ? `TIPO DE CASO: ${caseType}` : ""}
${mediaUrls?.length ? `CREATIVOS DISPONIBLES: ${mediaUrls.length} archivos` : "Sin creativos — genera ads de solo texto/link"}
ES CAMPAÑA DE INMIGRACIÓN: ${isImmigration ? "SÍ — usar specialAdCategories HOUSING" : "NO"}

DATOS HISTÓRICOS:
${historicalData}

${leadData}

Genera un plan de campaña completo optimizado para este objetivo.`;

  const raw = await analyzeContent(prompt, systemPrompt);

  // Parse AI response — detect error responses from Claude wrapper
  if (raw.includes('"error"') && !raw.includes('"recommendation"')) {
    const errMatch = raw.match(/"error"\s*:\s*"([^"]+)"/);
    throw new Error(errMatch ? errMatch[1] : "Claude API no disponible");
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI no gener\u00f3 un plan v\u00e1lido");
  }

  const aiPlan = JSON.parse(jsonMatch[0]) as {
    recommendation: string;
    campaign: { name: string; objective: string; dailyBudget: number; estimatedDailyLeads: number; estimatedCPL: number };
    adSets: Array<{ name: string; targeting: { locales?: number[]; interests?: Array<{ id: string; name: string }> }; dailyBudget: number; rationale: string }>;
    ads: Array<{ name: string; copy: string; cta: string; rationale: string }>;
    estimatedResults: { dailyLeads: number; weeklyCost: number; estimatedCPL: number; confidence: "high" | "medium" | "low"; reasoning: string };
  };

  // Build the full plan with resolved targeting
  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  const plan: CampaignPlan = {
    id: planId,
    recommendation: aiPlan.recommendation,
    campaign: {
      name: aiPlan.campaign.name,
      objective: aiPlan.campaign.objective as CampaignObjective,
      dailyBudget: aiPlan.campaign.dailyBudget || budget,
      estimatedDailyLeads: aiPlan.campaign.estimatedDailyLeads,
      estimatedCPL: aiPlan.campaign.estimatedCPL,
      specialAdCategories: isImmigration ? ["HOUSING"] : [],
    },
    adSets: aiPlan.adSets.map(as => ({
      ...as,
      targeting: {
        geoLocations: {
          ...(isNational ? { countries: ["US"] } : {}),
          ...(resolvedCities.length ? { cities: resolvedCities } : {}),
          ...(resolvedRegions.length ? { regions: resolvedRegions } : {}),
        },
        locales: as.targeting.locales || [24], // 24 = Spanish
        interests: as.targeting.interests || [],
        // No age/gender for housing category
      },
    })),
    ads: aiPlan.ads,
    estimatedResults: aiPlan.estimatedResults,
    status: "pending_approval",
    createdAt: now,
    expiresAt,
  };

  console.info(`[campaign-planner] Generated plan ${planId}: ${plan.campaign.name}`);
  return plan;
}
