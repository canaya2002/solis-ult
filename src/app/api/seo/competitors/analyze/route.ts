// SOLIS AI — Competitor analysis API
import { db } from "@/lib/db";
import { getDomainOverview, getOrganicKeywords, getKeywordGap } from "@/lib/analytics/semrush";
import { analyzeContent } from "@/lib/ai/claude";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST() {
  try {
    const competitors = await db.competitor.findMany();
    if (!competitors.length) {
      return apiError("No hay competidores configurados. Agrega competidores primero.");
    }

    // Analyze manuelsolis.com
    const ownOverview = await getDomainOverview("manuelsolis.com");
    const ownKeywords = await getOrganicKeywords("manuelsolis.com", 50);

    // Analyze each competitor
    const competitorData: Array<{
      name: string;
      domain: string;
      overview: Awaited<ReturnType<typeof getDomainOverview>>;
      topKeywords: Awaited<ReturnType<typeof getOrganicKeywords>>;
    }> = [];

    for (const comp of competitors) {
      const overview = await getDomainOverview(comp.domain);
      const topKeywords = await getOrganicKeywords(comp.domain, 20);
      competitorData.push({
        name: comp.name,
        domain: comp.domain,
        overview,
        topKeywords,
      });
    }

    // Keyword gap
    const gapResults = await getKeywordGap(
      "manuelsolis.com",
      competitors.map((c) => c.domain)
    );

    // AI analysis
    const dataForAI = `
Manuel Solís (manuelsolis.com):
- Organic Keywords: ${ownOverview?.organicKeywords || "N/A"}
- Organic Traffic: ${ownOverview?.organicTraffic || "N/A"}
- Top Keywords: ${ownKeywords.slice(0, 10).map((k) => `${k.keyword} (#${k.position})`).join(", ")}

Competidores:
${competitorData.map((c) => `
${c.name} (${c.domain}):
- Organic Keywords: ${c.overview?.organicKeywords || "N/A"}
- Organic Traffic: ${c.overview?.organicTraffic || "N/A"}
- Top Keywords: ${c.topKeywords.slice(0, 5).map((k) => `${k.keyword} (#${k.position})`).join(", ")}
`).join("")}

Keyword Gaps (keywords donde competidores rankean pero nosotros no):
${gapResults.slice(0, 15).map((g) => `${g.keyword} (vol: ${g.volume})`).join(", ")}
    `.trim();

    let aiInsights = "";
    try {
      aiInsights = await analyzeContent(
        dataForAI,
        "Analiza estos datos de competidores SEO de Manuel Solís Law Office (inmigración). Identifica: 1) Amenazas (donde nos superan), 2) Oportunidades (keywords que podemos atacar), 3) Acciones recomendadas (top 5, concretas). En español."
      );
    } catch {
      aiInsights = "Análisis AI no disponible. Configura ANTHROPIC_API_KEY.";
    }

    // Save analyses
    for (const comp of competitorData) {
      const dbComp = competitors.find((c) => c.domain === comp.domain);
      if (dbComp) {
        await db.competitorAnalysis.create({
          data: {
            competitorId: dbComp.id,
            data: {
              overview: comp.overview,
              topKeywords: comp.topKeywords.slice(0, 20),
            },
            insights: aiInsights,
            weekOf: new Date(),
          },
        });
      }
    }

    return apiSuccess({
      own: { overview: ownOverview, topKeywords: ownKeywords.slice(0, 20) },
      competitors: competitorData.map((c) => ({
        name: c.name,
        domain: c.domain,
        overview: c.overview,
        topKeywords: c.topKeywords.slice(0, 10),
      })),
      keywordGaps: gapResults.slice(0, 30),
      aiInsights,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/seo/competitors/analyze] POST failed:", error);
    return apiError("Error al analizar competidores", 500);
  }
}
