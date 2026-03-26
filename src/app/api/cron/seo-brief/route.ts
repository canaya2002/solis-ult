// SOLIS AI — SEO Brief Cron (Monday 8am CT / 1pm UTC)
import { NextRequest } from "next/server";
import { generateSEOBriefFull } from "@/lib/seo/seo-advisor";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return apiError("Unauthorized", 401);

  try {
    const brief = await generateSEOBriefFull();
    const topOps = brief.opportunities.slice(0, 3).map((o, i) => `<li><strong>${o.keyword}</strong> — posición ${o.currentPosition || "N/A"}, vol ${o.volume}. ${o.action}</li>`).join("");
    const topWins = brief.quickWins.slice(0, 3).map(q => `<li>${q.page}: "${q.currentTitle}" → "${q.suggestedTitle}"</li>`).join("");

    await sendTeamAlert({
      subject: "SEO Brief semanal",
      body: `<h3 style="color:#cda64e;">Top Oportunidades</h3><ol>${topOps}</ol><h3>Quick Wins</h3><ol>${topWins}</ol><p><a href="${process.env.APP_URL}/seo" style="color:#cda64e;">Ver brief completo →</a></p>`,
      priority: "medium",
    }).catch(e => console.error("[cron/seo-brief] Email failed:", e));

    console.info(`[cron/seo-brief] Generated brief: ${brief.id}`);
    return apiSuccess({ briefId: brief.id });
  } catch (error) {
    console.error("[cron/seo-brief] failed:", error);
    return apiError("Cron failed", 500);
  }
}
