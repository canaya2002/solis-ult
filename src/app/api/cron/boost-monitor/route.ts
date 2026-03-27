// SOLIS AI — Cron: Boost Monitor
// Runs every hour to detect viral posts and generate boost recommendations.
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { checkAllPlatformPerformance } from "@/lib/ads/performance-monitor";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return apiError("Unauthorized", 401);

  try {
    const recommendations = await checkAllPlatformPerformance();

    console.info(
      `[cron/boost-monitor] Complete. ${recommendations.length} recommendations generated.`
    );

    return apiSuccess({
      checked: true,
      recommendations: recommendations.length,
      details: recommendations.map(r => ({
        platform: r.platform,
        postId: r.externalPostId,
        viralityScore: r.viralityScore,
        suggestedBudget: r.suggestedBudget,
        priority: r.priority,
      })),
    });
  } catch (error) {
    console.error("[cron/boost-monitor] Failed:", error);
    return apiError("Error checking performance", 500);
  }
}
