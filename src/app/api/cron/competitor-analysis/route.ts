// SOLIS AI — Weekly competitor analysis cron (Monday 9am CT / 2pm UTC)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getDomainOverview, getOrganicKeywords } from "@/lib/analytics/semrush";
import { analyzeContent } from "@/lib/ai/claude";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const competitors = await db.competitor.findMany();
    if (!competitors.length) {
      return apiSuccess({ message: "No competitors configured" });
    }

    const ownOverview = await getDomainOverview("manuelsolis.com");
    const summaries: string[] = [];

    for (const comp of competitors) {
      const overview = await getDomainOverview(comp.domain);
      const keywords = await getOrganicKeywords(comp.domain, 10);

      await db.competitorAnalysis.create({
        data: {
          competitorId: comp.id,
          data: { overview, topKeywords: keywords },
          insights: "",
          weekOf: new Date(),
        },
      });

      summaries.push(
        `${comp.name} (${comp.domain}): ${overview?.organicTraffic || 0} tráfico, ${overview?.organicKeywords || 0} keywords`
      );
    }

    let insights = "";
    try {
      insights = await analyzeContent(
        `Manuel Solís: ${ownOverview?.organicTraffic || 0} tráfico, ${ownOverview?.organicKeywords || 0} keywords\nCompetidores:\n${summaries.join("\n")}`,
        "Resumen breve de cómo está Manuel Solís vs sus competidores en SEO. 3-4 oraciones. En español."
      );
    } catch { insights = "Análisis AI no disponible."; }

    await sendTeamAlert({
      subject: "Análisis semanal de competidores SEO",
      body: `<h3 style="color:#cda64e;">Competitor Watch</h3><p>${insights}</p><p><a href="${process.env.APP_URL}/seo/competitors" style="color:#cda64e;">Ver detalle →</a></p>`,
      priority: "low",
    }).catch(() => {});

    console.info(`[cron/competitor-analysis] Analyzed ${competitors.length} competitors`);
    return apiSuccess({ analyzed: competitors.length });
  } catch (error) {
    console.error("[cron/competitor-analysis] failed:", error);
    return apiError("Cron failed", 500);
  }
}
