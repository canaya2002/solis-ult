// SOLIS AI — Daily Trends Cron (7am CT / 12pm UTC)
import { NextRequest } from "next/server";
import { getImmigrationTrends } from "@/lib/analytics/trends";
import { analyzeTrends } from "@/lib/ai/claude";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError("Unauthorized", 401);
  }

  try {
    const rawTrends = await getImmigrationTrends();

    const trendSummary = `
Trending: ${rawTrends.trendingKeywords.join(", ")}
Rising: ${rawTrends.risingQueries.slice(0, 10).map((q) => q.query).join(", ")}
Top: ${rawTrends.topQueries.slice(0, 10).map((q) => q.query).join(", ")}
    `.trim();

    const ideas = await analyzeTrends(trendSummary);

    for (const idea of ideas) {
      await db.contentIdea.create({
        data: {
          topic: idea.topic,
          angle: idea.angle,
          hook: idea.hook,
          hashtags: idea.hashtags,
          platform: (idea.platform?.toUpperCase() || "FACEBOOK") as "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "BLOG",
          trendSource: idea.trendSource || "Google Trends",
          used: false,
        },
      });
    }

    await redis.set("trends:daily", {
      ideas,
      rawTrends: {
        trendingKeywords: rawTrends.trendingKeywords,
        risingQueries: rawTrends.risingQueries.slice(0, 15),
        topQueries: rawTrends.topQueries.slice(0, 15),
      },
      generatedAt: new Date().toISOString(),
    }, { ex: 7200 });

    // Email to team
    const ideaList = ideas
      .map(
        (idea, i) =>
          `<li style="margin-bottom:12px;">
            <strong>${i + 1}. ${idea.topic}</strong><br/>
            <em>${idea.angle}</em><br/>
            Hook: "${idea.hook}"<br/>
            <span style="color:#cda64e;">Plataforma: ${idea.platform}</span> · Fuente: ${idea.trendSource}<br/>
            Hashtags: ${idea.hashtags.slice(0, 5).join(", ")}
          </li>`
      )
      .join("");

    await sendTeamAlert({
      subject: "Ideas de contenido para hoy",
      body: `<h3 style="color:#cda64e;">5 Ideas de Contenido — ${new Date().toLocaleDateString("es-MX")}</h3>
        <ol style="padding-left:20px;">${ideaList}</ol>
        <p><a href="${process.env.APP_URL || "http://localhost:3000"}/content" style="color:#cda64e;">Ver en el dashboard →</a></p>`,
      priority: "medium",
    }).catch((e) => console.error("[cron/daily-trends] Email failed:", e));

    console.info(`[cron/daily-trends] Generated ${ideas.length} ideas`);
    return apiSuccess({ generated: ideas.length });
  } catch (error) {
    console.error("[cron/daily-trends] failed:", error);
    return apiError("Cron job failed", 500);
  }
}
