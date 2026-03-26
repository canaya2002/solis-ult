// SOLIS AI — Learning Cycle Cron (1st and 15th of month, 9am CT)
import { NextRequest } from "next/server";
import { runLearningCycle } from "@/lib/analytics/learning-engine";
import { sendTeamAlert } from "@/lib/comms/resend";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return apiError("Unauthorized", 401);

  try {
    const result = await runLearningCycle();
    const actionable = result.insights.filter(i => i.actionable);

    if (actionable.length > 0) {
      await sendTeamAlert({
        subject: `AI Learning: ${actionable.length} insights nuevos`,
        body: `<h3 style="color:#cda64e;">Insights del ciclo de aprendizaje</h3><ul>${actionable.map(i => `<li><strong>[${i.category}]</strong> ${i.insight} (confianza: ${Math.round(i.confidence * 100)}%)</li>`).join("")}</ul><p>Estos insights se aplicarán automáticamente a la generación de contenido.</p>`,
        priority: "low",
      }).catch(() => {});
    }

    console.info(`[cron/learning-cycle] ${result.insights.length} insights from ${result.dataPoints} data points`);
    return apiSuccess({ insights: result.insights.length, dataPoints: result.dataPoints });
  } catch (error) {
    console.error("[cron/learning-cycle] failed:", error);
    return apiError("Cron failed", 500);
  }
}
