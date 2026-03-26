// SOLIS AI — Learning Engine (continuous improvement)
import { db } from "@/lib/db";
import { analyzeContent } from "@/lib/ai/claude";

export interface LearningResult {
  insights: Array<{ category: string; insight: string; confidence: number; actionable: boolean }>;
  dataPoints: number;
  periodAnalyzed: string;
}

export async function runLearningCycle(): Promise<LearningResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const content = await db.content.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: thirtyDaysAgo } },
    include: { performance: true },
  });

  if (content.length < 10) {
    return {
      insights: [{ category: "insufficient_data", insight: `Se necesitan al menos 30 piezas publicadas. Llevas ${content.length}/30.`, confidence: 0, actionable: false }],
      dataPoints: content.length,
      periodAnalyzed: "30d",
    };
  }

  // Analyze by content type
  const byType: Record<string, { count: number; engagement: number; leads: number }> = {};
  const byPlatform: Record<string, { count: number; engagement: number }> = {};
  const byAI: { ai: { count: number; engagement: number }; human: { count: number; engagement: number } } = {
    ai: { count: 0, engagement: 0 }, human: { count: 0, engagement: 0 },
  };

  for (const c of content) {
    const eng = c.performance?.engagement || 0;
    const lds = c.performance?.leads || 0;

    // By type
    if (!byType[c.contentType]) byType[c.contentType] = { count: 0, engagement: 0, leads: 0 };
    byType[c.contentType].count++;
    byType[c.contentType].engagement += eng;
    byType[c.contentType].leads += lds;

    // By platform
    if (!byPlatform[c.platform]) byPlatform[c.platform] = { count: 0, engagement: 0 };
    byPlatform[c.platform].count++;
    byPlatform[c.platform].engagement += eng;

    // AI vs human
    const bucket = c.aiGenerated ? byAI.ai : byAI.human;
    bucket.count++;
    bucket.engagement += eng;
  }

  // Build analysis data
  const analysisData = {
    byType: Object.entries(byType).map(([type, d]) => ({
      type, count: d.count, avgEngagement: d.count > 0 ? Math.round(d.engagement / d.count) : 0, leads: d.leads,
    })),
    byPlatform: Object.entries(byPlatform).map(([p, d]) => ({
      platform: p, count: d.count, avgEngagement: d.count > 0 ? Math.round(d.engagement / d.count) : 0,
    })),
    aiVsHuman: {
      ai: { count: byAI.ai.count, avgEngagement: byAI.ai.count > 0 ? Math.round(byAI.ai.engagement / byAI.ai.count) : 0 },
      human: { count: byAI.human.count, avgEngagement: byAI.human.count > 0 ? Math.round(byAI.human.engagement / byAI.human.count) : 0 },
    },
    totalContent: content.length,
  };

  // AI analysis
  let aiInsights: Array<{ category: string; insight: string; confidence: number; actionable: boolean }> = [];
  try {
    const raw = await analyzeContent(
      JSON.stringify(analysisData, null, 2),
      `Analiza estos datos de rendimiento de contenido de Manuel Solís Law Office. Genera 5 insights accionables en JSON array: [{ "category": "content_performance|best_times|platform_preference|content_length", "insight": "texto", "confidence": 0.0-1.0, "actionable": true/false }]. Sé específico con números.`
    );
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) aiInsights = JSON.parse(match[0]);
  } catch {
    // Fallback manual insights
    const topType = analysisData.byType.sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
    const topPlatform = analysisData.byPlatform.sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
    if (topType) aiInsights.push({ category: "content_performance", insight: `El tipo ${topType.type} genera ${topType.avgEngagement} de engagement promedio — el mejor rendimiento.`, confidence: 0.7, actionable: true });
    if (topPlatform) aiInsights.push({ category: "platform_preference", insight: `${topPlatform.platform} tiene el mayor engagement promedio (${topPlatform.avgEngagement}).`, confidence: 0.7, actionable: true });
  }

  // Save insights to DB
  for (const insight of aiInsights) {
    await db.aILearning.create({
      data: {
        category: insight.category,
        insight: insight.insight,
        data: analysisData,
        appliedTo: ["copy-generation", "scheduling"],
      },
    });
  }

  return { insights: aiInsights, dataPoints: content.length, periodAnalyzed: "30d" };
}
