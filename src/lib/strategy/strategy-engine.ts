// SOLIS AI — Weekly Strategy Engine
// Prescriptive AI strategy: not "what happened" but "what to DO this week".
import { db } from "@/lib/db";
import { analyzeContent } from "@/lib/ai/claude";
import { sendNotification } from "@/lib/notifications/notification-engine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StrategyAction {
  title: string;
  reason: string;
  expectedImpact: string;
  urgency: "high" | "medium" | "low";
  type: "ads" | "content" | "seo" | "engagement" | "reputation";
  actionUrl: string;
  actionLabel: string;
  prefilledData?: Record<string, unknown>;
}

export interface WeeklyStrategyResult {
  id: string;
  weekOf: Date;
  summary: string;
  actions: StrategyAction[];
  metrics: Record<string, unknown>;
}

// ─── Data Gathering ────────────────────────────────────────────────────────────

async function gatherStrategyData(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // Leads pipeline
  const leadsByStatus = await db.lead.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const newLeadsThisWeek = await db.lead.count({
    where: { createdAt: { gte: weekAgo } },
  });
  const newLeadsLastWeek = await db.lead.count({
    where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
  });

  // Campaign performance
  const campaigns = await db.campaign.findMany({
    where: { status: "ACTIVE" },
    select: { name: true, budget: true, spent: true, leadsGenerated: true, cpl: true },
    take: 10,
  });

  // Top performing content
  const topContent = await db.content.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: weekAgo } },
    include: { performance: true },
    orderBy: { performance: { engagement: "desc" } },
    take: 5,
  });

  // Reviews
  const pendingReviews = await db.review.count({
    where: { responseStatus: "PENDING" },
  });
  const negativeReviews = await db.review.findMany({
    where: { responseStatus: "PENDING", rating: { lte: 3 } },
    take: 3,
  });

  // Pending comments
  const pendingComments = await db.comment.count({
    where: { responseStatus: "PENDING" },
  });

  // Boosts pending
  const pendingBoosts = await db.boost.count({
    where: { status: "PENDING" },
  });

  // Web metrics
  const webThisWeek = await db.webMetric.findMany({
    where: { date: { gte: weekAgo } },
    orderBy: { date: "desc" },
    take: 7,
  });
  const totalSessions = webThisWeek.reduce((s, w) => s + w.sessions, 0);

  return `LEADS PIPELINE:
${leadsByStatus.map(l => `- ${l.status}: ${l._count.id}`).join("\n")}
Leads nuevos esta semana: ${newLeadsThisWeek} (semana pasada: ${newLeadsLastWeek})

CAMPA\u00d1AS ACTIVAS:
${campaigns.map(c => `- ${c.name}: $${Number(c.budget)}/d\u00eda, ${c.leadsGenerated} leads, CPL $${c.cpl ? Number(c.cpl).toFixed(2) : "N/A"}`).join("\n") || "Ninguna"}

TOP CONTENIDO ESTA SEMANA:
${topContent.map(c => `- ${c.title} (${c.platform}): ${c.performance?.engagement || 0} engagement, ${c.performance?.impressions || 0} impressions`).join("\n") || "Sin contenido publicado"}

RESE\u00d1AS:
- Pendientes de respuesta: ${pendingReviews}
- Negativas sin responder: ${negativeReviews.length}
${negativeReviews.map(r => `  - ${r.officeName}: ${r.rating}/5 de ${r.author}`).join("\n")}

ENGAGEMENT:
- Comentarios pendientes: ${pendingComments}
- Boosts pendientes: ${pendingBoosts}

WEB:
- Sesiones esta semana: ${totalSessions}
- Promedio diario: ${Math.round(totalSessions / 7)}`;
}

// ─── Strategy Generation ───────────────────────────────────────────────────────

export async function generateWeeklyStrategy(): Promise<WeeklyStrategyResult> {
  const data = await gatherStrategyData();

  const systemPrompt = `Eres el director de marketing AI de Manuel Sol\u00eds Law Office.
NO me digas qu\u00e9 pas\u00f3. Dime qu\u00e9 HACER esta semana. Para cada acci\u00f3n:
- title: la acci\u00f3n concreta (en espa\u00f1ol)
- reason: el dato que la justifica
- expectedImpact: qu\u00e9 resultado esperas
- urgency: "high" | "medium" | "low"
- type: "ads" | "content" | "seo" | "engagement" | "reputation"

M\u00e1ximo 7 acciones, priorizadas por impacto. S\u00e9 espec\u00edfico y accionable.

Responde SOLO JSON v\u00e1lido:
{
  "summary": "resumen de 2-3 l\u00edneas de la estrategia semanal",
  "actions": [{"title":"","reason":"","expectedImpact":"","urgency":"","type":""}]
}`;

  const raw = await analyzeContent(data, systemPrompt);

  // Detect error responses from Claude wrapper
  if (raw.includes('"error"') && !raw.includes('"summary"')) {
    const errMatch = raw.match(/"error"\s*:\s*"([^"]+)"/);
    throw new Error(errMatch ? errMatch[1] : "Claude API no disponible");
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI no gener\u00f3 estrategia v\u00e1lida");

  const parsed = JSON.parse(match[0]) as {
    summary: string;
    actions: Array<{ title: string; reason: string; expectedImpact: string; urgency: "high" | "medium" | "low"; type: "ads" | "content" | "seo" | "engagement" | "reputation" }>;
  };

  // Map actions to URLs
  const mappedActions: StrategyAction[] = parsed.actions.map(a => {
    let actionUrl = "/";
    let actionLabel = "Ejecutar";

    switch (a.type) {
      case "ads":
        actionUrl = "/ads/create";
        actionLabel = "Crear campa\u00f1a";
        break;
      case "content":
        actionUrl = "/content/create";
        actionLabel = "Crear contenido";
        break;
      case "seo":
        actionUrl = "/seo";
        actionLabel = "Ver brief SEO";
        break;
      case "engagement":
        actionUrl = "/engagement";
        actionLabel = "Ver cola";
        break;
      case "reputation":
        actionUrl = "/reputation/responses";
        actionLabel = "Responder rese\u00f1as";
        break;
    }

    return { ...a, actionUrl, actionLabel };
  });

  // Save to DB
  const strategy = await db.weeklyStrategy.create({
    data: {
      weekOf: new Date(),
      summary: parsed.summary,
      actions: JSON.parse(JSON.stringify(mappedActions)),
    },
  });

  // Notification
  await sendNotification({
    type: "strategy_recommendation",
    title: `Estrategia semanal lista: ${mappedActions.length} acciones recomendadas`,
    message: parsed.summary,
    actionUrl: "/analytics/reports",
    actionLabel: "Ver estrategia",
    priority: "high",
    data: { strategyId: strategy.id },
    remindAfterMinutes: [240, 1440],
  });

  return {
    id: strategy.id,
    weekOf: new Date(),
    summary: parsed.summary,
    actions: mappedActions,
    metrics: {},
  };
}
